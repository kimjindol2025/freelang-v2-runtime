/**
 * FreeLang Platform Abstraction Layer
 *
 * Linux, Windows, WASM에서 동일한 코드 실행을 위한 추상화
 * 플랫폼별 구현체 (platform-impl.ts)로 교체 가능
 */

/**
 * 플랫폼 타입
 */
export type Platform = 'linux' | 'windows' | 'wasm' | 'unknown';

/**
 * 플랫폼 감지
 */
export function detectPlatform(): Platform {
  // Node.js 환경
  if (typeof process !== 'undefined' && process.platform) {
    if (process.platform === 'linux') return 'linux';
    if (process.platform === 'win32') return 'windows';
  }

  // 브라우저 환경 (WASM)
  if (typeof window !== 'undefined') {
    return 'wasm';
  }

  return 'unknown';
}

/**
 * 파일시스템 추상화
 */
export interface PlatformFS {
  /**
   * 파일 읽기
   */
  readFile(path: string): string;

  /**
   * 파일 쓰기
   */
  writeFile(path: string, content: string): void;

  /**
   * 파일 존재 여부 확인
   */
  exists(path: string): boolean;

  /**
   * 디렉토리 생성
   */
  mkdir(path: string): void;

  /**
   * 디렉토리 내용 조회
   */
  listDir(path: string): string[];

  /**
   * 파일 삭제
   */
  deleteFile(path: string): void;

  /**
   * 파일 크기
   */
  fileSize(path: string): number;
}

/**
 * 네트워크 추상화
 */
export interface PlatformNet {
  /**
   * HTTP GET 요청
   */
  httpGet(url: string): Promise<string>;

  /**
   * HTTP POST 요청
   */
  httpPost(url: string, body: string): Promise<string>;

  /**
   * HTTP 헤더 설정
   */
  setHeaders(headers: Record<string, string>): void;
}

/**
 * 프로세스 추상화
 */
export interface PlatformProc {
  /**
   * 프로세스 종료
   */
  exit(code: number): never;

  /**
   * 명령줄 인자
   */
  argv: string[];

  /**
   * 환경 변수
   */
  env: Map<string, string>;

  /**
   * 현재 작업 디렉토리
   */
  cwd(): string;

  /**
   * 현재 사용자
   */
  getUser(): string;
}

/**
 * 시스템 정보
 */
export interface PlatformSys {
  /**
   * 운영체제
   */
  platform: Platform;

  /**
   * 프로세서 수
   */
  cpuCount: number;

  /**
   * 전체 메모리 (바이트)
   */
  totalMemory: number;

  /**
   * 사용 가능한 메모리 (바이트)
   */
  availableMemory: number;

  /**
   * 현재 메모리 사용량 (바이트)
   */
  getCurrentMemory(): number;
}

/**
 * 통합 플랫폼 API
 */
export interface PlatformAPI extends PlatformFS, PlatformNet, PlatformProc, PlatformSys {}

/**
 * 플랫폼 API 팩토리
 * 감지된 플랫폼에 따라 적절한 구현체 반환
 */
export function createPlatformAPI(): PlatformAPI {
  const platform = detectPlatform();

  // Node.js 환경: fs 모듈 사용
  if (platform === 'linux' || platform === 'windows') {
    return createNodePlatformAPI(platform);
  }

  // 브라우저 환경: fetch API 사용
  if (platform === 'wasm') {
    return createWASMPlatformAPI();
  }

  // 알 수 없는 환경
  throw new Error(`Unsupported platform: ${platform}`);
}

/**
 * Node.js 플랫폼 API
 */
function createNodePlatformAPI(platform: Platform): PlatformAPI {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const http = require('http');
  const https = require('https');

  const headers: Record<string, string> = {};

  return {
    // FS
    readFile: (p: string) => fs.readFileSync(p, 'utf-8'),
    writeFile: (p: string, content: string) => fs.writeFileSync(p, content, 'utf-8'),
    exists: (p: string) => fs.existsSync(p),
    mkdir: (p: string) => {
      if (!fs.existsSync(p)) {
        fs.mkdirSync(p, { recursive: true });
      }
    },
    listDir: (p: string) => fs.readdirSync(p),
    deleteFile: (p: string) => fs.unlinkSync(p),
    fileSize: (p: string) => fs.statSync(p).size,

    // Network
    httpGet: async (url: string) => {
      return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, { headers }, (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => { data += chunk; });
          res.on('end', () => resolve(data));
        }).on('error', reject);
      });
    },
    httpPost: async (url: string, body: string) => {
      return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const options = {
          method: 'POST',
          headers: { 'Content-Length': Buffer.byteLength(body), ...headers },
        };
        const req = client.request(url, options, (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => { data += chunk; });
          res.on('end', () => resolve(data));
        }).on('error', reject);
        req.write(body);
        req.end();
      });
    },
    setHeaders: (h: Record<string, string>) => {
      Object.assign(headers, h);
    },

    // Process
    exit: (code: number) => process.exit(code),
    argv: process.argv.slice(2),
    env: new Map(Object.entries(process.env)),
    cwd: () => process.cwd(),
    getUser: () => os.userInfo().username,

    // System
    platform,
    cpuCount: os.cpus().length,
    totalMemory: os.totalmem(),
    availableMemory: os.freemem(),
    getCurrentMemory: () => process.memoryUsage().heapUsed,
  };
}

/**
 * WASM (브라우저) 플랫폼 API
 */
function createWASMPlatformAPI(): PlatformAPI {
  const fileSystem = new Map<string, string>();  // 인메모리 파일시스템

  return {
    // FS (인메모리)
    readFile: (p: string) => {
      const content = fileSystem.get(p);
      if (!content) throw new Error(`File not found: ${p}`);
      return content;
    },
    writeFile: (p: string, content: string) => {
      fileSystem.set(p, content);
    },
    exists: (p: string) => fileSystem.has(p),
    mkdir: () => {},  // WASM에서는 디렉토리 개념 없음
    listDir: (p: string) => {
      const prefix = p.endsWith('/') ? p : p + '/';
      return Array.from(fileSystem.keys())
        .filter(k => k.startsWith(prefix))
        .map(k => k.replace(prefix, '').split('/')[0]);
    },
    deleteFile: (p: string) => {
      fileSystem.delete(p);
    },
    fileSize: (p: string) => {
      const content = fileSystem.get(p);
      return content ? content.length : 0;
    },

    // Network
    httpGet: async (url: string) => {
      const res = await fetch(url);
      return res.text();
    },
    httpPost: async (url: string, body: string) => {
      const res = await fetch(url, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      });
      return res.text();
    },
    setHeaders: () => {},  // WASM에서는 제한적

    // Process
    exit: (code: number) => {
      console.error(`Process exit called with code ${code}`);
      throw new Error(`Process exited with code ${code}`);
    },
    argv: [],
    env: new Map(),
    cwd: () => '/',
    getUser: () => 'anonymous',

    // System
    platform: 'wasm',
    cpuCount: navigator.hardwareConcurrency || 1,
    totalMemory: 0,  // 브라우저에서 불가능
    availableMemory: 0,  // 브라우저에서 불가능
    getCurrentMemory: () => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    },
  };
}

/**
 * 글로벌 플랫폼 API 인스턴스
 */
let globalAPI: PlatformAPI | null = null;

/**
 * 글로벌 플랫폼 API 조회
 */
export function getPlatformAPI(): PlatformAPI {
  if (!globalAPI) {
    globalAPI = createPlatformAPI();
  }
  return globalAPI;
}
