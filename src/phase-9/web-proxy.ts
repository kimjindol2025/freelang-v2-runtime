/**
 * Phase 9: Web Proxy
 *
 * 프록시 기능:
 * - 요청 포워딩
 * - 응답 캐싱
 * - 로드 밸런싱
 * - 성능 모니터링
 * - 에러 처리
 */

import { HTTPServer, HTTPRequest, HTTPResponse, HTTPClient } from './http-server';
import { Spawn, AsyncUtils } from './async-concurrency';
import { MemoryMonitor } from './memory-monitor';

/**
 * 프록시 설정
 */
export interface ProxyConfig {
  port: number;
  targets: string[]; // 백엔드 서버들
  cacheEnabled: boolean;
  cacheTTL: number; // milliseconds
  timeout: number; // milliseconds
  maxRetries: number;
}

/**
 * 캐시 항목
 */
export interface CacheEntry {
  response: HTTPResponse;
  timestamp: number;
  ttl: number;
}

/**
 * 프록시 통계
 */
export interface ProxyStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  avgResponseTime: number;
  upstreamIndex: number;
}

/**
 * 웹 프록시
 */
export class WebProxy {
  private server: HTTPServer;
  private config: ProxyConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private stats: ProxyStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgResponseTime: 0,
    upstreamIndex: 0,
  };
  private responseTimes: number[] = [];
  private monitor = new MemoryMonitor();

  constructor(config: ProxyConfig) {
    this.config = config;
    this.server = new HTTPServer(config.port);
    this.setupRoutes();
  }

  /**
   * 라우트 설정
   */
  private setupRoutes(): void {
    // 프록시 라우트
    this.server.route('/*', async (req) => {
      return this.proxyRequest(req);
    });

    // 통계 엔드포인트
    this.server.route('/proxy/stats', () => ({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.stats),
    }));

    // 캐시 청소 엔드포인트
    this.server.route('/proxy/cache/clear', () => {
      this.cache.clear();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, message: 'Cache cleared' }),
      };
    });

    // 헬스 체크
    this.server.route('/proxy/health', () => ({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'healthy',
        uptime: process.uptime(),
        memory: MemoryMonitor.getReport(),
      }),
    }));

    // 모니터링 미들웨어
    this.server.use((req) => {
      this.monitor.recordSnapshot();
      return req;
    });
  }

  /**
   * 프록시 요청 처리
   */
  private async proxyRequest(req: HTTPRequest): Promise<HTTPResponse> {
    const start = performance.now();
    this.stats.totalRequests++;

    // 캐시 확인
    const cacheKey = `${req.method}:${req.url}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }
    this.stats.cacheMisses++;

    try {
      // 백엔드 선택 (라운드 로빈)
      const target = this.selectTarget();
      const targetUrl = `${target}${req.url}`;

      // 요청 포워딩
      let response = await this.forwardRequest(req.method, targetUrl, req.body, req.headers);

      // 재시도 로직
      let retries = 0;
      while (!response.success && retries < this.config.maxRetries) {
        await AsyncUtils.delay(1000 * (retries + 1)); // 지수 백오프
        const newTarget = this.selectTarget();
        const newTargetUrl = `${newTarget}${req.url}`;
        response = await this.forwardRequest(req.method, newTargetUrl, req.body, req.headers);
        retries++;
      }

      if (!response.success) {
        this.stats.failedRequests++;
        return {
          statusCode: 502,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Bad Gateway', message: response.error }),
        };
      }

      // 캐시 저장
      if (this.config.cacheEnabled) {
        this.cache.set(cacheKey, {
          response: response.response!,
          timestamp: Date.now(),
          ttl: this.config.cacheTTL,
        });
      }

      this.stats.successfulRequests++;
      return response.response!;
    } catch (error) {
      this.stats.failedRequests++;
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal Server Error', message: String(error) }),
      };
    } finally {
      const duration = performance.now() - start;
      this.responseTimes.push(duration);
      this.stats.avgResponseTime =
        this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    }
  }

  /**
   * 요청 포워딩
   */
  private async forwardRequest(
    method: string,
    url: string,
    body: string,
    headers: Record<string, string>
  ): Promise<{ success: boolean; response?: HTTPResponse; error?: string }> {
    try {
      const response = await AsyncUtils.withTimeout(
        this.executeRequest(method, url, body, headers),
        this.config.timeout,
        `Request to ${url}`
      );
      return { success: true, response };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 실제 요청 실행
   */
  private async executeRequest(
    method: string,
    url: string,
    body: string,
    headers: Record<string, string>
  ): Promise<HTTPResponse> {
    if (method === 'GET') {
      return HTTPClient.get(url, headers);
    } else if (method === 'POST') {
      return HTTPClient.post(url, body, headers);
    } else if (method === 'PUT') {
      return HTTPClient.put(url, body, headers);
    } else if (method === 'DELETE') {
      return HTTPClient.delete(url, headers);
    } else {
      throw new Error(`Unsupported method: ${method}`);
    }
  }

  /**
   * 캐시 조회
   */
  private getCached(key: string): HTTPResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // TTL 확인
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.response;
  }

  /**
   * 백엔드 선택 (라운드 로빈)
   */
  private selectTarget(): string {
    const target = this.config.targets[this.stats.upstreamIndex % this.config.targets.length];
    this.stats.upstreamIndex++;
    return target;
  }

  /**
   * 프록시 시작
   */
  async start(): Promise<void> {
    await this.server.start();
    console.log(`Web Proxy started on port ${this.config.port}`);
    console.log(`Proxying to: ${this.config.targets.join(', ')}`);
  }

  /**
   * 프록시 중지
   */
  async stop(): Promise<void> {
    await this.server.stop();
    console.log('Web Proxy stopped');
  }

  /**
   * 통계 조회
   */
  getStats(): ProxyStats {
    return { ...this.stats };
  }

  /**
   * 캐시 상태
   */
  getCacheStats(): { size: number; capacity: number } {
    return {
      size: this.cache.size,
      capacity: 10000, // 최대 캐시 항목 수
    };
  }
}

/**
 * 로드 밸런서
 */
export class LoadBalancer {
  private proxies: WebProxy[] = [];

  /**
   * 프록시 추가
   */
  addProxy(config: ProxyConfig): WebProxy {
    const proxy = new WebProxy(config);
    this.proxies.push(proxy);
    return proxy;
  }

  /**
   * 모든 프록시 시작
   */
  async startAll(): Promise<void> {
    await Spawn.runMany(
      this.proxies.map((p) => () => p.start()),
      5
    );
  }

  /**
   * 모든 프록시 중지
   */
  async stopAll(): Promise<void> {
    await Spawn.runMany(
      this.proxies.map((p) => () => p.stop()),
      5
    );
  }

  /**
   * 전체 통계
   */
  getAllStats(): Map<number, ProxyStats> {
    const stats = new Map();
    this.proxies.forEach((p, i) => {
      stats.set(p.getStats().upstreamIndex || i, p.getStats());
    });
    return stats;
  }
}

/**
 * 테스트 함수
 */
export async function testWebProxy(): Promise<void> {
  console.log('=== Web Proxy Tests ===\n');

  // 1. 프록시 설정
  console.log('1️⃣ Proxy Configuration:');
  const proxyConfig: ProxyConfig = {
    port: 9001,
    targets: ['http://localhost:3000', 'http://localhost:3001'],
    cacheEnabled: true,
    cacheTTL: 60000, // 1분
    timeout: 5000, // 5초
    maxRetries: 3,
  };
  console.log(`✅ Proxy port: ${proxyConfig.port}`);
  console.log(`✅ Targets: ${proxyConfig.targets.join(', ')}`);
  console.log(`✅ Cache: ${proxyConfig.cacheEnabled ? 'enabled' : 'disabled'}`);

  // 2. 프록시 생성 (실제 시작 안 함 - 백엔드 없으므로)
  console.log('\n2️⃣ Creating Proxy:');
  const proxy = new WebProxy(proxyConfig);
  console.log('✅ Proxy created');

  // 3. 통계 확인
  console.log('\n3️⃣ Initial Statistics:');
  const stats = proxy.getStats();
  console.log(`✅ Total requests: ${stats.totalRequests}`);
  console.log(`✅ Success: ${stats.successfulRequests}`);
  console.log(`✅ Failed: ${stats.failedRequests}`);
  console.log(`✅ Cache hits: ${stats.cacheHits}`);

  // 4. 로드 밸런서
  console.log('\n4️⃣ Load Balancer:');
  const lb = new LoadBalancer();
  lb.addProxy({ ...proxyConfig, port: 9001, targets: ['http://localhost:3000'] });
  lb.addProxy({ ...proxyConfig, port: 9002, targets: ['http://localhost:3001'] });
  console.log('✅ 2 proxies added to load balancer');

  console.log('\n✅ Web proxy tests completed!');
}
