/**
 * Phase 13 Week 3: HTTP Retry Logic
 * Exponential backoff + configurable retry strategy
 */

export interface RetryOptions {
  maxRetries: number;           // 최대 재시도 횟수 (기본값 3)
  backoffMs: number;            // 초기 대기 시간 (기본값 1000ms)
  maxBackoffMs?: number;        // 최대 대기 시간 (기본값 32000ms)
  factor?: number;              // 지수 (기본값 2.0)
  retryOn?: (error: any) => boolean;  // 재시도 조건
  jitterFactor?: number;        // 지터 추가 (0.0-1.0, 기본값 0.1)
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDurationMs: number;
}

/**
 * Exponential backoff retry engine
 *
 * 예시:
 * ```
 * const result = await HttpRetry.withRetry(
 *   () => HttpWrapper.get(url),
 *   {
 *     maxRetries: 3,
 *     backoffMs: 1000,
 *     retryOn: (error) => error.status_code >= 500,
 *   }
 * );
 * ```
 */
export class HttpRetry {
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    const {
      maxRetries = 3,
      backoffMs = 1000,
      maxBackoffMs = 32000,
      factor = 2.0,
      retryOn = () => true,
      jitterFactor = 0.1,
    } = options;

    let lastError: any;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // 마지막 시도면 에러 throw
        if (attempt === maxRetries) {
          throw error;
        }

        // 재시도 조건 확인
        if (!retryOn(error)) {
          throw error;
        }

        // Exponential backoff 계산
        const exponentialBackoff = backoffMs * Math.pow(factor, attempt);
        const cappedBackoff = Math.min(exponentialBackoff, maxBackoffMs);

        // 지터 추가 (±10%)
        const jitter = cappedBackoff * jitterFactor * (Math.random() * 2 - 1);
        const delayMs = Math.max(0, cappedBackoff + jitter);

        // 대기
        await this.sleep(delayMs);
      }
    }

    throw lastError;
  }

  /**
   * 재시도 결과 객체 반환 (에러를 throw하지 않음)
   */
  static async withRetryResult<T>(
    fn: () => Promise<T>,
    options: RetryOptions
  ): Promise<RetryResult<T>> {
    const {
      maxRetries = 3,
      backoffMs = 1000,
      maxBackoffMs = 32000,
      factor = 2.0,
      retryOn = () => true,
      jitterFactor = 0.1,
    } = options;

    const startTime = Date.now();
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const data = await fn();
        return {
          success: true,
          data,
          attempts: attempt + 1,
          totalDurationMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error;

        // 마지막 시도면 에러 반환
        if (attempt === maxRetries) {
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            attempts: attempt + 1,
            totalDurationMs: Date.now() - startTime,
          };
        }

        // 재시도 조건 확인
        if (!retryOn(error)) {
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            attempts: attempt + 1,
            totalDurationMs: Date.now() - startTime,
          };
        }

        // Exponential backoff 계산
        const exponentialBackoff = backoffMs * Math.pow(factor, attempt);
        const cappedBackoff = Math.min(exponentialBackoff, maxBackoffMs);

        // 지터 추가
        const jitter = cappedBackoff * jitterFactor * (Math.random() * 2 - 1);
        const delayMs = Math.max(0, cappedBackoff + jitter);

        // 대기
        await this.sleep(delayMs);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: maxRetries + 1,
      totalDurationMs: Date.now() - startTime,
    };
  }

  /**
   * 기본 HTTP 에러 감지 함수
   * 5xx 또는 타임아웃 에러만 재시도
   */
  static isRetryableError(error: any): boolean {
    // 서버 에러 (5xx)
    if (error.status_code && error.status_code >= 500) {
      return true;
    }

    // 타임아웃
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      return true;
    }

    // 일시적 네트워크 에러
    if (error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
      return true;
    }

    return false;
  }

  /**
   * 네트워크 조건이 악화된 환경을 위한 aggressive retry
   * 모든 에러를 재시도 (4xx 포함)
   */
  static isRetryableErrorAggressive(error: any): boolean {
    // 404, 401, 403 제외
    if (error.status_code === 404 || error.status_code === 401 || error.status_code === 403) {
      return false;
    }

    // 나머지 모든 에러 재시도
    return true;
  }

  /**
   * 조용한 sleep (Promise 기반)
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 디버그 정보 포함 재시도
   */
  static async withRetryDebug<T>(
    fn: () => Promise<T>,
    options: RetryOptions,
    onRetry?: (attempt: number, error: any, nextDelayMs: number) => void
  ): Promise<T> {
    const {
      maxRetries = 3,
      backoffMs = 1000,
      maxBackoffMs = 32000,
      factor = 2.0,
      retryOn = () => true,
      jitterFactor = 0.1,
    } = options;

    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          throw error;
        }

        if (!retryOn(error)) {
          throw error;
        }

        // 다음 재시도 지연 시간 계산
        const exponentialBackoff = backoffMs * Math.pow(factor, attempt);
        const cappedBackoff = Math.min(exponentialBackoff, maxBackoffMs);
        const jitter = cappedBackoff * jitterFactor * (Math.random() * 2 - 1);
        const delayMs = Math.max(0, cappedBackoff + jitter);

        // 콜백 호출 (디버그 정보)
        if (onRetry) {
          onRetry(attempt + 1, error, delayMs);
        }

        await this.sleep(delayMs);
      }
    }

    throw lastError;
  }
}
