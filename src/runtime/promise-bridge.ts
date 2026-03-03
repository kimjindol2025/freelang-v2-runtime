/**
 * PromiseBridge - FFI Callback to Promise Conversion
 *
 * FreeLang의 async/await를 지원하기 위해
 * C 콜백을 JavaScript Promise로 변환하는 브릿지 역할
 */

export interface CallbackHandler {
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timeout?: NodeJS.Timeout;
}

export class PromiseBridge {
  private pendingCallbacks = new Map<number, CallbackHandler>();
  private nextCallbackId = 1;

  /**
   * FreeLang의 native 함수 호출을 Promise로 래핑
   *
   * 예: await fs.readFile(path)
   * ↓ (FreeLang)
   * native fs_read_async(path, callbackId=123)
   * ↓ (C)
   * fs_open_callback() → vm_execute_callback(123, data)
   * ↓ (Promise Bridge)
   * Promise.resolve(data)
   * ↓ (FreeLang)
   * await 반환
   */
  registerCallback(timeoutMs: number = 5000): { promise: Promise<any>; callbackId: number } {
    const callbackId = this.nextCallbackId++;

    const promise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCallbacks.delete(callbackId);
        reject(new Error(`Callback ${callbackId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingCallbacks.set(callbackId, { resolve, reject, timeout });
    });

    return { promise, callbackId };
  }

  /**
   * C 코드에서 콜백 실행 (FreeLang VM에서 호출)
   *
   * 호출 경로:
   * C: freelang_enqueue_callback(ctx, callback_id, result)
   * → JavaScript: vm_execute_callback(callback_id, result)
   * → PromiseBridge: executeCallback(callback_id, result)
   */
  executeCallback(callbackId: number, result: any, error?: any): void {
    const handler = this.pendingCallbacks.get(callbackId);
    if (!handler) {
      console.warn(`[PromiseBridge] Unknown callback ID: ${callbackId}`);
      return;
    }

    // 타임아웃 정리
    if (handler.timeout) {
      clearTimeout(handler.timeout);
    }

    // 콜백 제거
    this.pendingCallbacks.delete(callbackId);

    // Promise 해결
    if (error) {
      handler.reject(new Error(error));
    } else {
      handler.resolve(result);
    }

    console.debug(`[PromiseBridge] Callback ${callbackId} executed`);
  }

  /**
   * 모든 pending 콜백 조회 (디버깅용)
   */
  getPendingCallbacks(): number[] {
    return Array.from(this.pendingCallbacks.keys());
  }

  /**
   * 특정 콜백 취소 (cleanup)
   */
  cancelCallback(callbackId: number): void {
    const handler = this.pendingCallbacks.get(callbackId);
    if (handler) {
      if (handler.timeout) {
        clearTimeout(handler.timeout);
      }
      this.pendingCallbacks.delete(callbackId);
    }
  }

  /**
   * 모든 pending 콜백 취소
   */
  cancelAll(): void {
    for (const [id, handler] of this.pendingCallbacks.entries()) {
      if (handler.timeout) {
        clearTimeout(handler.timeout);
      }
      handler.reject(new Error('PromiseBridge destroyed'));
    }
    this.pendingCallbacks.clear();
  }
}

// 전역 PromiseBridge 인스턴스
export const promiseBridge = new PromiseBridge();

/**
 * FreeLang VM에서 호출될 글로벌 함수
 *
 * C 코드에서: vm_execute_callback(callback_id, result)
 * 이를 JavaScript 바인딩으로 노출해야 함
 *
 * Node.js addon 예시:
 * ```c
 * napi_value ExecuteCallback(napi_env env, napi_callback_info info) {
 *   uint32_t callback_id;
 *   napi_value result;
 *   // ... napi_get_value_uint32, napi_get_value_string ...
 *   promiseBridge.executeCallback(callback_id, result);
 * }
 * ```
 */
export function executeCallbackFromC(callbackId: number, result: any, error?: any): void {
  promiseBridge.executeCallback(callbackId, result, error);
}

/**
 * 테스트용 헬퍼: async/await 호출 시뮬레이션
 *
 * 예시:
 * ```typescript
 * const { promise, callbackId } = promiseBridge.registerCallback();
 * simulateAsyncCall(callbackId, 'Hello', 1000);
 * const result = await promise;  // "Hello"
 * ```
 */
export function simulateAsyncCall(
  callbackId: number,
  result: any,
  delayMs: number = 0
): void {
  setTimeout(() => {
    promiseBridge.executeCallback(callbackId, result);
  }, delayMs);
}

export default promiseBridge;
