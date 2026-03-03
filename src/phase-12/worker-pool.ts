/**
 * Phase 12: OS-Level Worker Thread Pool
 *
 * 진정한 OS-level 병렬화를 위한 워커 스레드 풀
 * - Node.js worker_threads 기반
 * - CPU 바운드 작업 병렬 실행
 * - 간단한 라운드-로빈 로드 밸런싱
 */

import * as os from 'os';
import { Worker } from 'worker_threads';
import * as path from 'path';

/**
 * 워커 상태
 */
interface WorkerInstance {
  id: number;
  worker: Worker;
  busy: boolean;
  taskCount: number;
  lastUsed: number;
}

/**
 * 작업 항목
 */
interface Task<T> {
  id: string;
  fn: () => Promise<T> | T;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
}

/**
 * 워커 풀 옵션
 */
export interface WorkerPoolOptions {
  size?: number;           // 워커 개수 (기본: CPU 코어 수)
  maxQueueSize?: number;   // 최대 큐 크기 (기본: 1000)
  taskTimeout?: number;    // 작업 타임아웃 ms (기본: 30000)
  workerScript?: string;   // 워커 스크립트 경로
}

/**
 * 워커 풀: OS-level 병렬화
 */
export class WorkerPool {
  private workers: WorkerInstance[] = [];
  private taskQueue: Task<any>[] = [];
  private nextWorker = 0;
  private taskIdCounter = 0;
  private poolSize: number;
  private maxQueueSize: number;
  private taskTimeout: number;
  private terminated = false;
  private activeTaskCount = 0;

  constructor(options: WorkerPoolOptions = {}) {
    this.poolSize = options.size ?? os.cpus().length;
    this.maxQueueSize = options.maxQueueSize ?? 1000;
    this.taskTimeout = options.taskTimeout ?? 30000;

    // 워커 생성
    for (let i = 0; i < this.poolSize; i++) {
      this.createWorker(i);
    }
  }

  /**
   * 워커 생성
   *
   * Phase 12.1: 로컬 구조 (setImmediate 기반)
   * Phase 12.4: 실제 worker_threads로 변경
   */
  private createWorker(id: number): void {
    // Phase 12.1: 실제 워커 스레드 없이, 논리적 워커만 생성
    // 이는 구조를 검증하고, Phase 12.4에서 진정한 worker_threads로 마이그레이션
    const instance: WorkerInstance = {
      id,
      worker: {
        // 더미 워커 객체
        terminate: async () => {},
        on: () => {},
        off: () => {},
      } as any,
      busy: false,
      taskCount: 0,
      lastUsed: Date.now(),
    };

    this.workers.push(instance);
  }

  /**
   * 작업 실행 (메인 API)
   */
  async execute<T>(fn: () => Promise<T> | T, timeoutMs?: number): Promise<T> {
    if (this.terminated) {
      throw new Error('Worker pool has been terminated');
    }

    return new Promise((resolve, reject) => {
      const taskId = `task_${++this.taskIdCounter}`;
      const task: Task<T> = {
        id: taskId,
        fn,
        resolve,
        reject,
      };

      // 타임아웃 설정
      const timeout = timeoutMs ?? this.taskTimeout;
      task.timeout = setTimeout(() => {
        task.reject(new Error(`Task ${taskId} timed out after ${timeout}ms`));
        this.removeTask(taskId);
        this.activeTaskCount--;
      }, timeout);

      // 큐에 추가
      if (this.taskQueue.length >= this.maxQueueSize) {
        reject(new Error(`Queue full (max: ${this.maxQueueSize})`));
        return;
      }

      this.taskQueue.push(task);
      this.processTask();
    });
  }

  /**
   * 큐의 다음 작업 처리
   *
   * Note: 현재는 로컬 스레드풀처럼 동작 (즉시 실행)
   * Phase 12.4에서 실제 worker_threads로 마이그레이션
   */
  private processTask(): void {
    if (this.taskQueue.length === 0) return;
    if (this.terminated) return;

    // 사용 가능한 워커 찾기 (라운드-로빈)
    const worker = this.getAvailableWorker();
    if (!worker) {
      // 모든 워커 사용 중 → 나중에 처리 (on('message')에서 재시도)
      return;
    }

    const task = this.taskQueue.shift();
    if (!task) return;

    worker.busy = true;
    worker.taskCount++;
    this.activeTaskCount++;

    // 비동기적으로 실행 (즉시 반환, 나중에 완료)
    setImmediate(() => {
      try {
        const result = task.fn();

        // Promise인 경우
        if (result instanceof Promise) {
          result
            .then((value) => {
              if (task.timeout) clearTimeout(task.timeout);
              task.resolve(value);
              this.removeTask(task.id);
              worker.busy = false;
              this.activeTaskCount--;

              // 다음 작업 처리
              if (this.taskQueue.length > 0) {
                setImmediate(() => this.processTask());
              }
            })
            .catch((error) => {
              if (task.timeout) clearTimeout(task.timeout);
              task.reject(error);
              this.removeTask(task.id);
              worker.busy = false;
              this.activeTaskCount--;

              // 다음 작업 처리
              if (this.taskQueue.length > 0) {
                setImmediate(() => this.processTask());
              }
            });
        } else {
          // 동기 결과
          if (task.timeout) clearTimeout(task.timeout);
          task.resolve(result);
          this.removeTask(task.id);
          worker.busy = false;
          this.activeTaskCount--;

          // 다음 작업 처리
          if (this.taskQueue.length > 0) {
            setImmediate(() => this.processTask());
          }
        }
      } catch (error) {
        if (task.timeout) clearTimeout(task.timeout);
        task.reject(error as Error);
        this.removeTask(task.id);
        worker.busy = false;
        this.activeTaskCount--;

        // 다음 작업 처리
        if (this.taskQueue.length > 0) {
          setImmediate(() => this.processTask());
        }
      }
    });
  }

  /**
   * 사용 가능한 워커 찾기 (라운드-로빈)
   */
  private getAvailableWorker(): WorkerInstance | null {
    // 라운드-로빈으로 순회
    for (let i = 0; i < this.workers.length; i++) {
      const idx = (this.nextWorker + i) % this.workers.length;
      const worker = this.workers[idx];

      if (!worker.busy) {
        this.nextWorker = (idx + 1) % this.workers.length;
        return worker;
      }
    }
    return null;
  }

  /**
   * 작업 찾기
   */
  private findTaskById(taskId: string): Task<any> | null {
    return this.taskQueue.find(t => t.id === taskId) || null;
  }

  /**
   * 작업 제거
   */
  private removeTask(taskId: string): void {
    const idx = this.taskQueue.findIndex(t => t.id === taskId);
    if (idx >= 0) {
      const task = this.taskQueue[idx];
      if (task.timeout) clearTimeout(task.timeout);
      this.taskQueue.splice(idx, 1);
    }
  }

  /**
   * 모든 작업 완료 대기
   */
  async drain(): Promise<void> {
    while (this.taskQueue.length > 0 || this.activeTaskCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * 풀 상태
   */
  getStatus() {
    return {
      poolSize: this.poolSize,
      queuedTasks: this.taskQueue.length,
      activeTasks: this.activeTaskCount,
      workers: this.workers.map(w => ({
        id: w.id,
        busy: w.busy,
        taskCount: w.taskCount,
      })),
    };
  }

  /**
   * 풀 종료
   */
  async terminate(): Promise<void> {
    this.terminated = true;

    // 남은 작업 모두 실패 처리
    const pendingTasks = [...this.taskQueue];
    this.taskQueue = [];

    for (const task of pendingTasks) {
      try {
        task.reject(new Error('Worker pool terminated'));
      } catch (_) {
        // Already resolved/rejected
      }
      if (task.timeout) clearTimeout(task.timeout);
    }

    // 워커 종료 (Phase 12.1에서는 더미 워커)
    const terminatePromises = this.workers.map(w => {
      try {
        return Promise.resolve(w.worker.terminate?.() ?? null);
      } catch (_) {
        return Promise.resolve(null);
      }
    });

    try {
      await Promise.all(terminatePromises);
    } catch (_) {
      // Ignore termination errors
    }

    this.workers = [];
  }
}

/**
 * 글로벌 워커 풀 인스턴스 (편의용)
 */
let globalPool: WorkerPool | null = null;

/**
 * 글로벌 풀 초기화
 */
export function initGlobalPool(options?: WorkerPoolOptions): WorkerPool {
  if (globalPool) {
    return globalPool;
  }
  globalPool = new WorkerPool(options);
  return globalPool;
}

/**
 * 글로벌 풀 가져오기
 */
export function getGlobalPool(): WorkerPool {
  if (!globalPool) {
    globalPool = new WorkerPool();
  }
  return globalPool;
}

/**
 * 글로벌 풀 종료
 */
export async function terminateGlobalPool(): Promise<void> {
  if (globalPool) {
    await globalPool.terminate();
    globalPool = null;
  }
}

/**
 * 편의 함수: 글로벌 풀에서 작업 실행
 */
export async function runInWorker<T>(
  fn: () => Promise<T> | T,
  timeout?: number
): Promise<T> {
  const pool = getGlobalPool();
  return pool.execute(fn, timeout);
}
