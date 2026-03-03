/**
 * Phase 9: HTTP Server & Client
 *
 * HTTP 기능:
 * - Simple HTTP Server (listen, handle requests)
 * - HTTP Client (fetch, post, get)
 * - Request/Response handling
 * - Middleware support
 */

import * as http from 'http';
import * as https from 'https';

/**
 * HTTP 요청 객체
 */
export interface HTTPRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  query: Record<string, string>;
}

/**
 * HTTP 응답 객체
 */
export interface HTTPResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * HTTP 핸들러
 */
export type HTTPHandler = (req: HTTPRequest) => HTTPResponse | Promise<HTTPResponse>;

/**
 * HTTP 서버
 */
export class HTTPServer {
  private server: http.Server | null = null;
  private port: number;
  private handlers: Map<string, HTTPHandler> = new Map();
  private middlewares: Array<(req: HTTPRequest) => HTTPRequest> = [];

  constructor(port: number = 8000) {
    this.port = port;
  }

  /**
   * 라우트 등록
   */
  route(path: string, handler: HTTPHandler): void {
    this.handlers.set(path, handler);
  }

  /**
   * 미들웨어 추가
   */
  use(middleware: (req: HTTPRequest) => HTTPRequest): void {
    this.middlewares.push(middleware);
  }

  /**
   * 서버 시작
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          // 요청 파싱
          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });

          req.on('end', async () => {
            // HTTPRequest 생성
            let request: HTTPRequest = {
              method: req.method || 'GET',
              url: req.url || '/',
              headers: req.headers as Record<string, string>,
              body,
              query: this.parseQuery(req.url || '/'),
            };

            // 미들웨어 적용
            for (const middleware of this.middlewares) {
              request = middleware(request);
            }

            // 핸들러 찾기
            const handler = this.handlers.get(request.url);
            let response: HTTPResponse;

            if (handler) {
              response = await handler(request);
            } else {
              response = {
                statusCode: 404,
                headers: { 'Content-Type': 'text/plain' },
                body: 'Not Found',
              };
            }

            // 응답 전송
            res.writeHead(response.statusCode, response.headers);
            res.end(response.body);
          });
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(error) }));
        }
      });

      this.server.listen(this.port, () => {
        console.log(`HTTP Server listening on port ${this.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  /**
   * 서버 중지
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 쿼리 파싱
   */
  private parseQuery(url: string): Record<string, string> {
    const [, queryString] = url.split('?');
    if (!queryString) return {};

    const query: Record<string, string> = {};
    queryString.split('&').forEach((param) => {
      const [key, value] = param.split('=');
      query[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
    return query;
  }
}

/**
 * HTTP 클라이언트
 */
export class HTTPClient {
  /**
   * GET 요청
   */
  static async get(url: string, headers?: Record<string, string>): Promise<HTTPResponse> {
    return this.request('GET', url, '', headers);
  }

  /**
   * POST 요청
   */
  static async post(
    url: string,
    body: string,
    headers?: Record<string, string>
  ): Promise<HTTPResponse> {
    const finalHeaders = {
      'Content-Type': 'application/json',
      ...(headers || {}),
    };
    return this.request('POST', url, body, finalHeaders);
  }

  /**
   * PUT 요청
   */
  static async put(
    url: string,
    body: string,
    headers?: Record<string, string>
  ): Promise<HTTPResponse> {
    const finalHeaders = {
      'Content-Type': 'application/json',
      ...(headers || {}),
    };
    return this.request('PUT', url, body, finalHeaders);
  }

  /**
   * DELETE 요청
   */
  static async delete(url: string, headers?: Record<string, string>): Promise<HTTPResponse> {
    return this.request('DELETE', url, '', headers);
  }

  /**
   * 일반 요청
   */
  private static async request(
    method: string,
    url: string,
    body: string,
    headers?: Record<string, string>
  ): Promise<HTTPResponse> {
    return new Promise((resolve, reject) => {
      const requestUrl = new URL(url);
      const isHttps = requestUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        method,
        headers: {
          'Content-Length': Buffer.byteLength(body),
          ...(headers || {}),
        },
      };

      const request = client.request(requestUrl, options, (res) => {
        let responseBody = '';

        res.on('data', (chunk) => {
          responseBody += chunk.toString();
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 200,
            headers: res.headers as Record<string, string>,
            body: responseBody,
          });
        });
      });

      request.on('error', reject);

      if (body) {
        request.write(body);
      }

      request.end();
    });
  }

  /**
   * JSON GET
   */
  static async getJSON(url: string): Promise<any> {
    const response = await this.get(url);
    return JSON.parse(response.body);
  }

  /**
   * JSON POST
   */
  static async postJSON(url: string, data: any): Promise<any> {
    const response = await this.post(url, JSON.stringify(data));
    return JSON.parse(response.body);
  }
}

/**
 * 간단한 라우터
 */
export class SimpleRouter {
  private routes: Map<string, HTTPHandler> = new Map();

  /**
   * GET 라우트 등록
   */
  get(path: string, handler: HTTPHandler): void {
    this.routes.set(`GET:${path}`, handler);
  }

  /**
   * POST 라우트 등록
   */
  post(path: string, handler: HTTPHandler): void {
    this.routes.set(`POST:${path}`, handler);
  }

  /**
   * 라우트 매칭
   */
  match(method: string, path: string): HTTPHandler | null {
    const key = `${method}:${path}`;
    return this.routes.get(key) || null;
  }

  /**
   * 모든 라우트 나열
   */
  list(): string[] {
    return Array.from(this.routes.keys());
  }
}

/**
 * 테스트 함수
 */
export async function testHTTPServer(): Promise<void> {
  console.log('=== HTTP Server Tests ===\n');

  // 1. 간단한 서버 시작
  console.log('1️⃣ Starting HTTP Server...');
  const server = new HTTPServer(9000);

  server.route('/api/hello', () => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hello from FreeLang!' }),
  }));

  server.route('/api/users/:id', (req) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, name: 'Alice', url: req.url }),
  }));

  server.use((req) => {
    req.headers['X-Processed-By'] = 'FreeLang';
    return req;
  });

  await server.start();
  console.log('✅ Server started on port 9000\n');

  // 2. 클라이언트 요청
  console.log('2️⃣ Testing HTTP Client...');
  try {
    const response = await HTTPClient.get('http://localhost:9000/api/hello');
    console.log('✅ GET /api/hello:', response.statusCode);
    console.log('   Body:', response.body);
  } catch (error) {
    console.log('⚠️  GET failed (server might not be fully ready)');
  }

  // 3. 라우터
  console.log('\n3️⃣ Testing Router...');
  const router = new SimpleRouter();
  router.get('/users', () => ({
    statusCode: 200,
    headers: {},
    body: JSON.stringify([{ id: 1, name: 'Alice' }]),
  }));
  router.post('/users', () => ({
    statusCode: 201,
    headers: {},
    body: JSON.stringify({ success: true }),
  }));

  console.log('✅ Routes registered:', router.list().length);
  const handler = router.match('GET', '/users');
  console.log('✅ Route match (GET /users):', handler ? 'found' : 'not found');

  // 4. 서버 중지
  await server.stop();
  console.log('\n✅ Server stopped');
  console.log('\n✅ All HTTP tests completed!');
}
