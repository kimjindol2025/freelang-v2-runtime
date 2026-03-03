/**
 * Phase 22.5: Async/Await Infrastructure
 *
 * Future and Promise-like primitives:
 * - AsyncTask for asynchronous execution
 * - Future for deferred computation
 * - Promise wrapper for JavaScript interop
 */

export type TaskState = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface AsyncTaskConfig {
  timeout_ms?: number;
  executor?: (task: AsyncTask<any>) => void;
}

/**
 * AsyncTask<T> - Generic asynchronous task
 * Similar to Java's Future or JavaScript's Promise
 */
export class AsyncTask<T> {
  private state: TaskState = 'pending';
  private value?: T;
  private error?: Error;
  private callbacks: Array<() => void> = [];
  private error_callbacks: Array<(error: Error) => void> = [];
  private created_at: number = Date.now();
  private completed_at?: number;
  private timeout_ms?: number;
  private timeout_handle?: NodeJS.Timeout;

  constructor(fn?: (resolve: (value: T) => void, reject: (error: Error) => void) => void) {
    if (fn) {
      // Execute executor asynchronously to allow state checks before execution
      Promise.resolve().then(() => {
        try {
          fn(
            (value: T) => this.resolve(value),
            (error: Error) => this.reject(error)
          );
        } catch (error: any) {
          this.reject(error);
        }
      });
    }
  }

  /**
   * Resolve with value
   */
  resolve(value: T): void {
    if (this.state !== 'pending') return;

    this.state = 'completed';
    this.value = value;
    this.completed_at = Date.now();

    if (this.timeout_handle) {
      clearTimeout(this.timeout_handle);
    }

    this.notify();
  }

  /**
   * Reject with error
   */
  reject(error: Error): void {
    if (this.state !== 'pending') return;

    this.state = 'failed';
    this.error = error;
    this.completed_at = Date.now();

    if (this.timeout_handle) {
      clearTimeout(this.timeout_handle);
    }

    this.notifyError();
  }

  /**
   * Cancel task
   */
  cancel(): boolean {
    if (this.state !== 'pending') return false;

    this.state = 'cancelled';
    this.completed_at = Date.now();

    if (this.timeout_handle) {
      clearTimeout(this.timeout_handle);
    }

    return true;
  }

  /**
   * Set timeout
   */
  setTimeout(ms: number): void {
    this.timeout_ms = ms;

    this.timeout_handle = setTimeout(() => {
      if (this.state === 'pending') {
        this.reject(new Error(`AsyncTask timeout after ${ms}ms`));
      }
    }, ms);
  }

  /**
   * Wait for completion
   */
  async await(): Promise<T> {
    if (this.state === 'completed') {
      return this.value as T;
    }

    if (this.state === 'failed') {
      throw this.error;
    }

    if (this.state === 'cancelled') {
      throw new Error('Task was cancelled');
    }

    return new Promise((resolve, reject) => {
      this.callbacks.push(() => resolve(this.value as T));
      this.error_callbacks.push(reject);
    });
  }

  /**
   * Get result (throws if not completed)
   */
  get(): T {
    if (this.state === 'pending') {
      throw new Error('Task not yet completed');
    }

    if (this.state === 'failed') {
      throw this.error;
    }

    if (this.state === 'cancelled') {
      throw new Error('Task was cancelled');
    }

    return this.value as T;
  }

  /**
   * Try to get result
   */
  tryGet(): T | undefined {
    return this.state === 'completed' ? this.value : undefined;
  }

  /**
   * Then: chain with another task
   */
  then<R>(fn: (value: T) => R | Promise<R>): AsyncTask<R> {
    return new AsyncTask((resolve, reject) => {
      this.callbacks.push(() => {
        try {
          const result = fn(this.value as T);
          if (result instanceof Promise) {
            result.then(resolve).catch(reject);
          } else if (result instanceof AsyncTask) {
            result.await().then(resolve).catch(reject);
          } else {
            resolve(result);
          }
        } catch (error: any) {
          reject(error);
        }
      });

      this.error_callbacks.push(reject);

      if (this.state === 'completed') {
        this.notify();
      }
    });
  }

  /**
   * Catch: handle error
   */
  catch(fn: (error: Error) => T | Promise<T>): AsyncTask<T> {
    return new AsyncTask((resolve, reject) => {
      this.callbacks.push(() => resolve(this.value as T));

      this.error_callbacks.push((error: Error) => {
        try {
          const result = fn(error);
          if (result instanceof Promise) {
            result.then(resolve).catch(reject);
          } else if (result instanceof AsyncTask) {
            result.await().then(resolve).catch(reject);
          } else {
            resolve(result);
          }
        } catch (err: any) {
          reject(err);
        }
      });

      if (this.state === 'failed') {
        this.notifyError();
      }
    });
  }

  /**
   * Finally: execute regardless of state
   */
  finally(fn: () => void | Promise<void>): AsyncTask<T> {
    return new AsyncTask((resolve, reject) => {
      const execute_finally = async () => {
        try {
          await fn?.();
        } catch (error: any) {
          reject(error);
          return;
        }

        if (this.state === 'completed') {
          resolve(this.value as T);
        } else if (this.state === 'failed') {
          reject(this.error);
        }
      };

      this.callbacks.push(() => execute_finally());
      this.error_callbacks.push(() => execute_finally());

      if (this.state !== 'pending') {
        execute_finally();
      }
    });
  }

  /**
   * Check state
   */
  getState(): TaskState {
    return this.state;
  }

  /**
   * Check if completed
   */
  isDone(): boolean {
    return this.state !== 'pending';
  }

  /**
   * Check if cancelled
   */
  isCancelled(): boolean {
    return this.state === 'cancelled';
  }

  /**
   * Get execution time
   */
  getExecutionTime(): number {
    if (!this.completed_at) return 0;
    return this.completed_at - this.created_at;
  }

  /**
   * Private: Notify callbacks
   */
  private notify(): void {
    while (this.callbacks.length > 0) {
      const callback = this.callbacks.shift();
      if (callback) callback();
    }
  }

  /**
   * Private: Notify error callbacks
   */
  private notifyError(): void {
    while (this.error_callbacks.length > 0) {
      const callback = this.error_callbacks.shift();
      if (callback) callback(this.error as Error);
    }
  }
}

/**
 * Promise-like wrapper for JavaScript interop
 */
export class PromiseTask<T> extends AsyncTask<T> {
  constructor(fn: (resolve: (value: T) => void, reject: (error: Error) => void) => void) {
    super(fn);
  }

  /**
   * Convert to JavaScript Promise
   */
  toPromise(): Promise<T> {
    return new Promise((resolve, reject) => {
      this.then(resolve).catch(reject);
    });
  }

  /**
   * Create from JavaScript Promise
   */
  static from<T>(promise: Promise<T>): PromiseTask<T> {
    return new PromiseTask((resolve, reject) => {
      promise.then(resolve).catch(reject);
    });
  }
}

/**
 * Async utilities
 */
export const asyncUtils = {
  /**
   * Resolve immediately
   */
  resolved<T>(value: T): AsyncTask<T> {
    const task = new AsyncTask<T>();
    task.resolve(value);
    return task;
  },

  /**
   * Reject immediately
   */
  rejected<T>(error: Error): AsyncTask<T> {
    const task = new AsyncTask<T>();
    task.reject(error);
    return task;
  },

  /**
   * All: Wait for all tasks
   */
  async all<T>(tasks: AsyncTask<T>[]): Promise<T[]> {
    const results: T[] = [];
    for (const task of tasks) {
      results.push(await task.await());
    }
    return results;
  },

  /**
   * Race: Wait for first task
   */
  async race<T>(tasks: AsyncTask<T>[]): Promise<T> {
    return Promise.race(tasks.map(t => t.await()));
  },

  /**
   * Sleep
   */
  sleep(ms: number): AsyncTask<void> {
    return new AsyncTask((resolve) => {
      setTimeout(() => resolve(), ms);
    });
  },
};

export default { AsyncTask, PromiseTask, asyncUtils };
