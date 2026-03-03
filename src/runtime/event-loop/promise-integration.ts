/**
 * Promise & Event Loop Integration
 * 
 * Phase 16의 Promise Bridge를 Event Loop Core와 연결
 * 
 * 아키텍처:
 * async fn
 *   ↓ (State Machine Transformer)
 * Promise-based State Machine
 *   ↓ (await point)
 * Event Loop Core
 *   ├─ queueMicrotask() → Promise callback
 *   └─ queueMacrotask() → Timer/IO
 *   ↓ (비동기 작업 완료)
 * Promise resolve/reject
 *   ↓ (다음 state로 점프)
 * async fn 계속 실행
 */

import { eventLoopCore, TaskPriority } from './event-loop-core';

/**
 * Promise State Wrapper
 * State Machine의 각 상태를 Promise로 감싸기
 */
export class PromiseState<T = any> {
  private promise: Promise<T>;
  private resolve!: (value: T) => void;
  private reject!: (reason?: any) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  get value(): Promise<T> {
    return this.promise;
  }

  complete(value: T): void {
    this.resolve(value);
  }

  fail(error: Error): void {
    this.reject(error);
  }
}

/**
 * Async Function Executor
 * 
 * State Machine을 실행하고 Event Loop과 협력
 */
export class AsyncFunctionExecutor {
  /**
   * State Machine 함수 실행
   * 
   * 예: execute(myAsyncFn, [arg1, arg2])
   */
  static async execute<T>(
    stateMachineFn: (...args: any[]) => Promise<T>,
    args: any[] = [],
    priority: TaskPriority = TaskPriority.HIGH
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // State Machine 함수를 Microtask로 등록
      eventLoopCore.queueMicrotask(
        async () => {
          try {
            const result = await stateMachineFn(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        },
        priority
      );
    });
  }

  /**
   * Await Point 처리
   * 
   * State Machine에서 await을 만날 때마다 호출
   */
  static async handleAwait<T>(
    promise: Promise<T>,
    isIO: boolean = false
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (isIO) {
        // I/O 작업은 Macrotask (낮은 우선순위)
        eventLoopCore.queueMacrotask(
          async () => {
            try {
              const result = await promise;
              resolve(result);
            } catch (error) {
              reject(error);
            }
          },
          TaskPriority.NORMAL
        );
      } else {
        // Promise는 Microtask (높은 우선순위)
        eventLoopCore.queueMicrotask(
          async () => {
            try {
              const result = await promise;
              resolve(result);
            } catch (error) {
              reject(error);
            }
          },
          TaskPriority.HIGH
        );
      }
    });
  }
}

/**
 * Async Wrapper Functions (FreeLang Stdlib에서 사용)
 */

/**
 * setTimeout 구현 (Macrotask)
 */
export function setTimeout(fn: () => void, ms: number): string {
  return eventLoopCore.queueMacrotask(async () => {
    await new Promise((resolve) => {
      const timer = globalThis.setTimeout(() => {
        fn();
        resolve(null);
      }, ms);
    });
  });
}

/**
 * setInterval 구현 (반복 Macrotask)
 */
export function setInterval(fn: () => void, ms: number): string {
  const intervalId = `interval-${Date.now()}`;

  const scheduleNext = () => {
    eventLoopCore.queueMacrotask(async () => {
      await new Promise((resolve) => {
        const timer = globalThis.setTimeout(() => {
          fn();
          scheduleNext(); // 다음 interval 스케줄
          resolve(null);
        }, ms);
      });
    });
  };

  scheduleNext();
  return intervalId;
}

/**
 * Promise.all 구현
 */
export async function all<T>(
  promises: Promise<T>[]
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    eventLoopCore.queueMicrotask(
      async () => {
        try {
          const results = await Promise.all(promises);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      },
      TaskPriority.HIGH
    );
  });
}

/**
 * Promise.race 구현
 */
export async function race<T>(
  promises: Promise<T>[]
): Promise<T> {
  return new Promise((resolve, reject) => {
    eventLoopCore.queueMicrotask(
      async () => {
        try {
          const result = await Promise.race(promises);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      },
      TaskPriority.HIGH
    );
  });
}

/**
 * queueMicrotask (커스텀 작업 큐)
 */
export function queueMicrotask(fn: () => void): string {
  return eventLoopCore.queueMicrotask(fn, TaskPriority.NORMAL);
}

/**
 * queueMacrotask (커스텀 작업 큐)
 */
export function queueMacrotask(fn: () => void): string {
  return eventLoopCore.queueMacrotask(fn, TaskPriority.NORMAL);
}
