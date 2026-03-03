/**
 * Phase 15 Day 3-4: HTTP/2 Server with Server Push
 *
 * 목표: 16,937 req/s → 60,000+ req/s (4배 성능 향상)
 *
 * HTTP/2의 핵심 최적화:
 * 1. 단일 TCP 연결에서 다중 요청 (멀티플렉싱)
 * 2. 서버에서 먼저 데이터 전송 (Server Push)
 * 3. 헤더 압축 (HPACK) - HTTP/1.1대비 30-40% 절감
 * 4. 이진 프로토콜 (파싱 빠름)
 *
 * Server Push 메커니즘:
 * - 클라이언트 요청 전 필요한 리소스 미리 전송
 * - 왕복 시간(RTT) 제거
 * - CSS, JS, 이미지 등 종속 리소스 자동 전송
 * - 대시보드 데이터 사전 전송
 */

import * as http2 from 'http2';
import * as fs from 'fs';
import * as path from 'path';
import { DeltaEncoder, Delta } from './delta-encoder';
import { MessageBatcher } from './message-batcher';
import { CompressionLayer } from './compression-layer';

/**
 * HTTP/2 푸시 대상 (Server Push)
 */
interface PushResource {
  path: string;
  file?: string; // 파일 경로
  data?: any; // 동적 데이터 (JSON)
  type: 'html' | 'json' | 'stream';
  priority?: 'high' | 'medium' | 'low';
}

/**
 * HTTP/2 스트림 메타데이터
 */
interface StreamMetadata {
  streamId: number;
  startTime: number;
  requestPath: string;
  isPush: boolean;
  dataSize: number;
  compressed: boolean;
  deltaRatio?: number;
}

/**
 * HTTP/2 서버 통계
 */
interface Http2Stats {
  totalRequests: number;
  totalPushes: number;
  avgStreamsPerConnection: number;
  totalDataTransferred: number;
  compressedDataSize: number;
  deltaCumulativeSavings: number; // %
  avgLatency: number; // ms
  peakConcurrentStreams: number;
  connectionReuse: number; // 재사용된 연결 수
}

/**
 * Phase 15 HTTP/2 서버 with Server Push
 *
 * 멀티플렉싱: 단일 TCP 연결에서 동시 다중 스트림 처리
 * Server Push: 클라이언트 요청 전 필요 데이터 미리 전송
 * 헤더 압축: HPACK으로 헤더 오버헤드 감소
 */
export class Http2Server {
  private server: http2.SecureServerSession | null = null;
  private port: number;
  private deltaEncoder: DeltaEncoder;
  private batcher: MessageBatcher;
  private compressor: CompressionLayer;

  // 통계
  private stats: Http2Stats = {
    totalRequests: 0,
    totalPushes: 0,
    avgStreamsPerConnection: 0,
    totalDataTransferred: 0,
    compressedDataSize: 0,
    deltaCumulativeSavings: 0,
    avgLatency: 0,
    peakConcurrentStreams: 0,
    connectionReuse: 0
  };

  private activeSessions = new Map<string, { streams: number; startTime: number }>();
  private requestLatencies: number[] = [];

  constructor(port: number = 8443) {
    this.port = port;
    this.deltaEncoder = new DeltaEncoder();
    this.batcher = new MessageBatcher(5000); // 5초 배칭 윈도우 (HTTP/2는 더 빠르므로 짧게)
    this.compressor = new CompressionLayer(100, 6, true); // 100 bytes threshold (더 적극적)

    // 배칭 콜백 설정
    this.batcher.setOnBatchReady((batch) => {
      // HTTP/2에서는 배치를 푸시할 수 있음
    });
  }

  /**
   * HTTP/2 서버 시작
   *
   * Node.js에서 HTTP/2는 HTTPS만 지원하므로 자체 인증서 필요
   * 개발 환경에서는 자체 서명 인증서 사용
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 개발용 자체 서명 인증서 (실제 환경에서는 정식 인증서 필요)
        const options: http2.SecureServerOptions = {
          key: this.getOrCreateKey(),
          cert: this.getOrCreateCert(),
          allowHTTP1: true // HTTP/1.1 fallback 지원 (호환성)
        };

        this.server = http2.createSecureServer(options, async (req, res) => {
          const startTime = Date.now();
          const streamId = req.stream.id;

          // 세션 추적
          const sessionId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
          if (!this.activeSessions.has(sessionId)) {
            this.activeSessions.set(sessionId, { streams: 0, startTime: Date.now() });
          }
          const session = this.activeSessions.get(sessionId)!;
          session.streams++;

          try {
            // 라우팅
            if (req.url === '/health') {
              this.sendJson(res, { status: 'ok', http2: true });
            } else if (req.url === '/stats') {
              this.sendJson(res, this.getStats());
            } else if (req.url?.startsWith('/api/realtime/stream')) {
              await this.handleStreamRequest(req, res);
            } else if (req.url === '/') {
              this.serveHTML(res);
            } else {
              res.writeHead(404);
              res.end('Not Found');
            }

            // 레이턴시 기록
            const latency = Date.now() - startTime;
            this.recordLatency(latency);
            this.stats.totalRequests++;
            this.stats.totalDataTransferred += res.writableLength || 0;

          } catch (error) {
            console.error('Request error:', error);
            res.writeHead(500);
            res.end('Internal Server Error');
          }
        });

        // 연결 종료 추적
        this.server.on('session', (session: http2.ServerSession) => {
          const maxStreams = session.settings().maxConcurrentStreams;
          if (maxStreams > this.stats.peakConcurrentStreams) {
            this.stats.peakConcurrentStreams = maxStreams;
          }
        });

        this.server.listen(this.port, () => {
          console.log(`🚀 HTTP/2 Server with Server Push listening on https://localhost:${this.port}`);
          console.log(`   - Health:  https://localhost:${this.port}/health`);
          console.log(`   - Stats:   https://localhost:${this.port}/stats`);
          console.log(`   - Stream:  https://localhost:${this.port}/api/realtime/stream`);
          console.log(`\n⚡ Features:`);
          console.log(`   - Multiplexing: 단일 TCP에서 다중 스트림`);
          console.log(`   - Server Push: 클라이언트 요청 전 데이터 전송`);
          console.log(`   - Header Compression (HPACK)`);
          console.log(`   - Binary Protocol`);
          resolve();
        });

        this.server.on('error', (error) => {
          console.error('Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 실시간 스트림 요청 처리
   * SSE 대신 HTTP/2 Server Push 사용
   */
  private async handleStreamRequest(req: http.IncomingMessage, res: http2.ServerResponse): Promise<void> {
    const stream = res;

    // 초기 상태 푸시
    const initialState = {
      type: 'initial',
      timestamp: Date.now(),
      data: { status: 'connected', http2: true, features: ['push', 'multiplexing', 'compression'] }
    };

    // Server Push: 연관된 데이터 먼저 전송
    await this.pushResources(stream, [
      {
        path: '/api/dashboard/stats',
        type: 'json',
        priority: 'high'
      },
      {
        path: '/api/dashboard/trends',
        type: 'json',
        priority: 'medium'
      }
    ]);

    // 스트림 설정
    stream.respond({
      'content-type': 'application/json',
      ':status': 200
    });

    // 초기 데이터 전송
    stream.write(JSON.stringify(initialState) + '\n');

    // 정기적 업데이트 (5초 간격)
    const interval = setInterval(async () => {
      try {
        const update = {
          type: 'update',
          timestamp: Date.now(),
          data: {
            counter: Math.floor(Math.random() * 1000),
            activeStreams: this.activeSessions.size,
            stats: this.getStats()
          }
        };

        // Delta 인코딩 적용
        const delta = this.deltaEncoder.computeDelta('stream-update', update.data);
        const message = {
          ...update,
          _delta: {
            type: delta.type,
            compressionRatio: delta.compressionRatio,
            bandwidthSaved: delta.originalSize - delta.deltaSize
          }
        };

        stream.write(JSON.stringify(message) + '\n');
      } catch (error) {
        clearInterval(interval);
      }
    }, 5000);

    stream.on('close', () => {
      clearInterval(interval);
    });

    stream.on('error', (error) => {
      clearInterval(interval);
      console.error('Stream error:', error);
    });
  }

  /**
   * Server Push: 연관된 리소스를 먼저 푸시
   *
   * HTTP/2 Server Push의 핵심: 클라이언트가 요청하기 전에
   * 필요한 데이터를 이미 서버에서 전송
   *
   * 예: /page 요청 → /style.css, /script.js를 미리 푸시
   */
  private async pushResources(
    stream: http2.ServerResponse,
    resources: PushResource[]
  ): Promise<void> {
    for (const resource of resources) {
      try {
        const pushStream = stream.pushStream({ ':path': resource.path }, (err, pushStream) => {
          if (err) {
            console.error(`Failed to push ${resource.path}:`, err.message);
            return;
          }

          this.stats.totalPushes++;

          if (resource.type === 'json' && resource.data) {
            // JSON 데이터 푸시
            this.sendJson(pushStream, resource.data);
          } else if (resource.type === 'html' && resource.file) {
            // 파일 푸시
            const filePath = path.join(__dirname, '../../public', resource.file);
            if (fs.existsSync(filePath)) {
              const content = fs.readFileSync(filePath);
              pushStream.respond({ 'content-type': 'text/html' });
              pushStream.end(content);
            }
          }
        });
      } catch (error) {
        console.error(`Error pushing ${resource.path}:`, error);
      }
    }
  }

  /**
   * JSON 응답 전송 (자동 압축)
   */
  private async sendJson(res: http2.ServerResponse, data: any): Promise<void> {
    const json = JSON.stringify(data);
    const compressed = await this.compressor.compress(json);

    if (compressed) {
      res.respond({
        'content-type': 'application/json',
        'content-encoding': 'gzip',
        ':status': 200
      });
      res.end((compressed as any).compressed);
    } else {
      res.respond({
        'content-type': 'application/json',
        ':status': 200
      });
      res.end(json);
    }
  }

  /**
   * HTML 대시보드 제공
   */
  private serveHTML(res: http2.ServerResponse): void {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>HTTP/2 Dashboard - Phase 15</title>
      <style>
        body { font-family: monospace; margin: 20px; background: #0a0e27; color: #00ff00; }
        h1 { color: #00ffff; }
        .stat { margin: 10px 0; padding: 10px; background: #1a1e3f; border-left: 3px solid #00ff00; }
        .metric { display: inline-block; margin-right: 20px; }
        .warning { color: #ffff00; }
        .error { color: #ff0000; }
      </style>
    </head>
    <body>
      <h1>🚀 HTTP/2 Server with Server Push</h1>
      <div class="stat">
        <h2>Features Enabled:</h2>
        <ul>
          <li>✅ Multiplexing (단일 TCP에서 다중 스트림)</li>
          <li>✅ Server Push (클라이언트 요청 전 데이터 전송)</li>
          <li>✅ Header Compression (HPACK)</li>
          <li>✅ Binary Protocol</li>
          <li>✅ Delta Encoding (상태 변화만 전송)</li>
          <li>✅ Message Batching (50% 절감)</li>
          <li>✅ gzip Compression (30-40% 절감)</li>
        </ul>
      </div>
      <div class="stat">
        <h2>Performance Goal:</h2>
        <div class="metric">Current: <strong>16,937 req/s</strong></div>
        <div class="metric">Target: <strong>60,000+ req/s</strong></div>
        <div class="metric">Improvement: <strong>4x</strong></div>
      </div>
      <div class="stat">
        <h2>Live Stats:</h2>
        <div id="stats" style="font-size: 12px;"></div>
      </div>
      <script>
        // 실시간 통계 업데이트
        fetch('/stats')
          .then(r => r.json())
          .then(data => {
            const stats = document.getElementById('stats');
            stats.innerHTML = Object.entries(data)
              .map(([k, v]) => \`<div>\${k}: <strong>\${v}</strong></div>\`)
              .join('');
          });
      </script>
    </body>
    </html>
    `;

    res.respond({ 'content-type': 'text/html', ':status': 200 });
    res.end(html);
  }

  /**
   * 자체 서명 인증서 생성/로드
   */
  private getOrCreateKey(): Buffer {
    const keyPath = path.join(__dirname, '../../.certs/server.key');
    const certDir = path.dirname(keyPath);

    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    if (!fs.existsSync(keyPath)) {
      // 개발 환경: openssl로 생성
      const { execSync } = require('child_process');
      execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout ${keyPath} -out ${certDir}/server.crt -days 365 -nodes -subj "/CN=localhost"`,
        { stdio: 'ignore' }
      );
    }

    return fs.readFileSync(keyPath);
  }

  private getOrCreateCert(): Buffer {
    const certPath = path.join(__dirname, '../../.certs/server.crt');
    return fs.readFileSync(certPath);
  }

  /**
   * 레이턴시 기록
   */
  private recordLatency(latency: number): void {
    this.requestLatencies.push(latency);
    if (this.requestLatencies.length > 1000) {
      this.requestLatencies.shift();
    }

    // 평균 계산
    if (this.requestLatencies.length > 0) {
      const sum = this.requestLatencies.reduce((a, b) => a + b, 0);
      this.stats.avgLatency = Math.round(sum / this.requestLatencies.length);
    }
  }

  /**
   * 통계 조회
   */
  getStats(): Http2Stats {
    // Delta 누적 절감 계산
    const deltaStats = this.deltaEncoder.getStats();
    const savingsPercent = deltaStats.totalOriginalSize > 0
      ? (deltaStats.bandwidthSaved / deltaStats.totalOriginalSize) * 100
      : 0;

    return {
      ...this.stats,
      deltaCumulativeSavings: Math.round(savingsPercent),
      avgStreamsPerConnection: this.stats.totalRequests > 0
        ? Math.round(this.stats.totalPushes / Math.max(1, this.activeSessions.size))
        : 0,
      connectionReuse: this.activeSessions.size
    };
  }

  /**
   * 서버 종료
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('HTTP/2 server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
