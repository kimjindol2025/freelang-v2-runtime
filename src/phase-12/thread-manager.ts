/**
 * Phase 12.3: Real ThreadManager using WorkerPool
 *
 * Upgrade from Phase 10's Promise-based threading to true OS-level parallelism
 * - API-compatible with Phase 10 ThreadManager
 * - Uses WorkerPool from Phase 12.1 for true parallelism
 * - Thread-safe execution with AtomicMutex
 * - Backward compatible (all Phase 10 tests should still pass)
 */

import * as os from 'os';
import { WorkerPool, WorkerPoolOptions } from './worker-pool';
import { AtomicMutex } from './atomic-mutex';

/**
 * Thread state
 */
export type ThreadState = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Thread object
 */
export interface Thread<T> {
  id: string;
  state: ThreadState;
  result?: T;
  error?: string;
  duration: number;
  startTime: number;
  workerPoolId?: string; // Worker pool task ID
}

/**
 * Real ThreadManager using OS-level worker threads
 *
 * Phase 12.3: Replaces Phase 10's Promise-based implementation
 * - Same API for backward compatibility
 * - Uses real OS threads via WorkerPool
 * - Expected 3-4x speedup on CPU-bound tasks
 */
export class RealThreadManager {
  private threads: Map<string, Thread<any>> = new Map();
  private threadIdCounter = 0;
  private workerPool: WorkerPool;
  private threadsMutex = new AtomicMutex();

  constructor(options?: WorkerPoolOptions) {
    this.workerPool = new WorkerPool(options);
  }

  /**
   * Spawn thread (real OS-level execution)
   *
   * API-compatible with Phase 10 ThreadManager.spawnThread()
   */
  async spawnThread<T>(
    fn: () => Promise<T> | T,
    name?: string
  ): Promise<Thread<T>> {
    const id = `thread_${++this.threadIdCounter}`;
    const thread: Thread<T> = {
      id,
      state: 'pending',
      duration: 0,
      startTime: performance.now(),
    };

    await this.threadsMutex.lock();
    this.threads.set(id, thread);
    this.threadsMutex.unlock();

    // Execute in worker pool (true parallelism)
    setImmediate(async () => {
      try {
        await this.threadsMutex.lock();
        thread.state = 'running';
        this.threadsMutex.unlock();

        // Execute in worker pool for OS-level parallelism
        thread.result = await this.workerPool.execute(fn);

        await this.threadsMutex.lock();
        thread.state = 'completed';
        this.threadsMutex.unlock();
      } catch (error) {
        await this.threadsMutex.lock();
        thread.error = String(error);
        thread.state = 'failed';
        this.threadsMutex.unlock();
      } finally {
        thread.duration = performance.now() - thread.startTime;
      }
    });

    return thread;
  }

  /**
   * Wait for thread completion
   *
   * API-compatible with Phase 10 ThreadManager.join()
   */
  async join<T>(thread: Thread<T>, timeoutMs?: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (thread.state === 'completed') {
          clearInterval(checkInterval);
          if (timeout) clearTimeout(timeout);
          resolve(thread.result!);
        } else if (thread.state === 'failed') {
          clearInterval(checkInterval);
          if (timeout) clearTimeout(timeout);
          reject(new Error(thread.error));
        }
      }, 10);

      let timeout: NodeJS.Timeout | null = null;
      if (timeoutMs) {
        timeout = setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error(`Thread ${thread.id} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
    });
  }

  /**
   * Wait for all threads
   *
   * API-compatible with Phase 10 ThreadManager.joinAll()
   */
  async joinAll(): Promise<Map<string, any>> {
    const results = new Map();
    for (const [id, thread] of this.threads) {
      try {
        const result = await this.join(thread);
        results.set(id, result);
      } catch (error) {
        results.set(id, { error: String(error) });
      }
    }
    return results;
  }

  /**
   * Get thread status
   *
   * API-compatible with Phase 10 ThreadManager.getThreadStatus()
   */
  getThreadStatus(threadId: string): Thread<any> | undefined {
    return this.threads.get(threadId);
  }

  /**
   * Get all thread statuses
   *
   * API-compatible with Phase 10 ThreadManager.getAllThreadStatus()
   */
  getAllThreadStatus(): Thread<any>[] {
    return Array.from(this.threads.values());
  }

  /**
   * Get thread count
   *
   * API-compatible with Phase 10 ThreadManager.getThreadCount()
   */
  getThreadCount(): number {
    return this.threads.size;
  }

  /**
   * Get worker pool status
   *
   * New API for Phase 12.3
   */
  getWorkerPoolStatus() {
    return this.workerPool.getStatus();
  }

  /**
   * Terminate thread manager
   *
   * Cleans up worker pool
   */
  async terminate(): Promise<void> {
    await this.workerPool.terminate();
    this.threads.clear();
  }
}

/**
 * Legacy API: Maintain Phase 10 ThreadManager for backward compatibility
 *
 * Users can choose:
 * - import { ThreadManager } from 'phase-10' (Promise-based, slow)
 * - import { RealThreadManager } from 'phase-12' (OS threads, fast)
 */
export class ThreadManager {
  private threads: Map<string, Thread<any>> = new Map();
  private threadIdCounter = 0;

  /**
   * Spawn thread (Promise-based, single event loop)
   */
  async spawnThread<T>(
    fn: () => Promise<T> | T,
    name?: string
  ): Promise<Thread<T>> {
    const id = `thread_${++this.threadIdCounter}`;
    const thread: Thread<T> = {
      id,
      state: 'pending',
      duration: 0,
      startTime: performance.now(),
    };

    this.threads.set(id, thread);

    // Async execution (single event loop, NOT true parallelism)
    setImmediate(async () => {
      try {
        thread.state = 'running';
        thread.result = await fn();
        thread.state = 'completed';
      } catch (error) {
        thread.error = String(error);
        thread.state = 'failed';
      } finally {
        thread.duration = performance.now() - thread.startTime;
      }
    });

    return thread;
  }

  /**
   * Wait for thread completion
   */
  async join<T>(thread: Thread<T>, timeoutMs?: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (thread.state === 'completed') {
          clearInterval(checkInterval);
          if (timeout) clearTimeout(timeout);
          resolve(thread.result!);
        } else if (thread.state === 'failed') {
          clearInterval(checkInterval);
          if (timeout) clearTimeout(timeout);
          reject(new Error(thread.error));
        }
      }, 10);

      let timeout: NodeJS.Timeout | null = null;
      if (timeoutMs) {
        timeout = setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error(`Thread ${thread.id} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
    });
  }

  /**
   * Wait for all threads
   */
  async joinAll(): Promise<Map<string, any>> {
    const results = new Map();
    for (const [id, thread] of this.threads) {
      try {
        const result = await this.join(thread);
        results.set(id, result);
      } catch (error) {
        results.set(id, { error: String(error) });
      }
    }
    return results;
  }

  /**
   * Get thread status
   */
  getThreadStatus(threadId: string): Thread<any> | undefined {
    return this.threads.get(threadId);
  }

  /**
   * Get all thread statuses
   */
  getAllThreadStatus(): Thread<any>[] {
    return Array.from(this.threads.values());
  }

  /**
   * Get thread count
   */
  getThreadCount(): number {
    return this.threads.size;
  }
}

/**
 * Create RealThreadManager with default settings
 */
export function createRealThreadManager(poolSize?: number): RealThreadManager {
  return new RealThreadManager({
    size: poolSize || os.cpus().length,
  });
}

/**
 * Create legacy ThreadManager for backward compatibility
 */
export function createThreadManager(): ThreadManager {
  return new ThreadManager();
}
