/**
 * FreeLang Phase 13: HTTP Type Definitions
 * HTTP 요청/응답/옵션 타입 정의
 */

/**
 * HTTP 응답 객체
 * FreeLang에서 http.get(), http.post() 등의 반환 타입
 */
export interface HttpResponse {
  status_code: number;           // HTTP status (200, 404, 500 등)
  body: string;                  // 응답 본문
  headers: Record<string, string>; // 응답 헤더
  elapsed_ms: number;            // 요청 소요 시간 (ms)
}

/**
 * HTTP 옵션 객체
 * 미래 확장용 (timeout, redirect 등)
 */
export interface HttpOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;              // 밀리초 단위 타임아웃
  max_redirects?: number;        // 최대 리다이렉트 횟수 (기본값 5)
}

/**
 * HTTP 에러
 * HTTP 요청 실패 시 던지는 에러
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public status_code: number,
    public response?: HttpResponse
  ) {
    super(message);
    this.name = 'HttpError';
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}
