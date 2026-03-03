/**
 * Phase 22.4: Thread Pool
 *
 * Efficient thread pooling for task execution:
 * - Worker thread management
 * - Task queue
 * - Dynamic sizing
 * - Performance metrics
 */

import { Channel, channel } from './channel';
import ThreadBase from '../threading/thread-base';

export type PoolStrategy = 'fixed' | 'dynamic' | 'cached';

export interface PoolConfig {
  name: string;
  strategy: PoolStrategy;
  min_threads: number;
  max_threads: number;
  queue_capacity: number;
  keep_alive_ms: number; // For cached pool
}

export interface PoolStatistics {
  name: string;
  active_threads: number;
  total_threads: number;
  queued_tasks: number;
  completed_tasks: number;
  rejected_tasks: number;
  avg_task_time_ms: number;
}

export interface Task<R> {
  id: number;
  fn: () => Promise<R>;
  created_at: number;
  completed_at?: number;
  result?: R;
  error?: Error;
}

/**
 * Worker Thread in Pool
 */
class PoolWorker extends ThreadBase {
  private task_receiver: any;
  private completed_count: number = 0;
  private task_times: number[] = [];

  constructor(
    id: number,
    task_receiver: any
  ) {
    super(`worker-${id}`, async () => {
      while (!this.isInterrupted()) {
        const task = await task_receiver.recv();
        if (!task) break; // Channel closed

        const start = Date.now();
        try {
          const result = await task.fn();
          task.result = result;
          task.completed_at = Date.now();
          this.completed_count++;
          this.task_times.push(task.completed_at - start);
        } catch (error: any) {
          task.error = error;
          task.completed_at = Date.now();
        }
      }
    });

    this.task_receiver = task_receiver;
  }

  getCompletedCount(): number {
    return this.completed_count;
  }

  getAvgTaskTime(): number {
    return this.task_times.length > 0
      ? this.task_times.reduce((a, b) => a + b, 0) / this.task_times.length
      : 0;
  }
}

/**
 * Thread Pool Executor
 */
export class ThreadPool {
  private config: PoolConfig;
  private workers: PoolWorker[] = [];
  private task_sender: any;
  private task_receiver: any;
  private task_queue: Task<any>[] = [];
  private task_id_counter: number = 0;
  private completed_count: number = 0;
  private rejected_count: number = 0;
  private task_times: number[] = [];
  private is_shutdown: boolean = false;

  constructor(config: PoolConfig) {
    this.config = config;
    const [sender, receiver] = channel<Task<any>>();
    this.task_sender = sender;
    this.task_receiver = receiver;

    // Initialize minimum threads
    this.scaleUp(config.min_threads);
  }

  /**
   * Submit task to pool
   */
  async submit<R>(fn: () => Promise<R>): Promise<Promise<R>> {
    if (this.is_shutdown) {
      throw new Error('Thread pool is shut down');
    }

    const task: Task<R> = {
      id: this.task_id_counter++,
      fn,
      created_at: Date.now(),
    };

    // Check if queue is full
    if (this.config.strategy === 'fixed' && this.task_queue.length >= this.config.queue_capacity) {
      this.rejected_count++;
      throw new Error('Task queue is full');
    }

    // Try to scale up if needed (for dynamic pool)
    if (this.config.strategy === 'dynamic' && this.workers.length < this.config.max_threads) {
      const load = this.task_queue.length / this.workers.length;
      if (load > 2) {
        this.scaleUp(1);
      }
    }

    await this.task_sender.send(task);
    this.task_queue.push(task);

    return new Promise((resolve, reject) => {
      const check = () => {
        if (task.completed_at) {
          this.task_queue = this.task_queue.filter(t => t.id !== task.id);
          if (task.error) {
            reject(task.error);
          } else {
            resolve(task.result);
          }
        } else {
          setTimeout(check, 1);
        }
      };
      check();
    });
  }

  /**
   * Execute task synchronously (wait for result)
   */
  async execute<R>(fn: () => Promise<R>): Promise<R> {
    return this.submit(fn);
  }

  /**
   * Scale up worker threads
   */
  private scaleUp(count: number): void {
    const new_count = Math.min(
      this.workers.length + count,
      this.config.max_threads
    );

    for (let i = this.workers.length; i < new_count; i++) {
      const worker = new PoolWorker(i, this.task_receiver);
      this.workers.push(worker);
      // Start worker in background
      worker.start().catch(() => {
        // Worker finished
      });
    }
  }

  /**
   * Scale down worker threads
   */
  private scaleDown(count: number): void {
    const new_count = Math.max(
      this.workers.length - count,
      this.config.min_threads
    );

    for (let i = this.workers.length - 1; i >= new_count; i--) {
      const worker = this.workers.pop();
      if (worker) {
        worker.interrupt();
      }
    }
  }

  /**
   * Get active thread count
   */
  getActiveCount(): number {
    return this.workers.filter(w => w.isAlive()).length;
  }

  /**
   * Get total thread count
   */
  getTotalCount(): number {
    return this.workers.length;
  }

  /**
   * Get queued task count
   */
  getQueuedCount(): number {
    return this.task_queue.length;
  }

  /**
   * Shutdown pool (wait for all tasks)
   */
  public async shutdown(): Promise<void> {
    this.is_shutdown = true;

    // Wait for all tasks to complete
    while (this.task_queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Close channel and interrupt workers
    this.task_receiver.close();
    for (const worker of this.workers) {
      worker.interrupt();
    }

    // Wait for all workers to finish
    await Promise.all(
      this.workers.map(w => w.join())
    );
  }

  /**
   * Shutdown now (interrupt all tasks)
   */
  shutdownNow(): void {
    this.is_shutdown = true;
    this.task_receiver.close();
    for (const worker of this.workers) {
      worker.interrupt();
    }
  }

  /**
   * Get statistics
   */
  getStats(): PoolStatistics {
    const avg_task_time = this.task_times.length > 0
      ? this.task_times.reduce((a, b) => a + b, 0) / this.task_times.length
      : 0;

    return {
      name: this.config.name,
      active_threads: this.getActiveCount(),
      total_threads: this.workers.length,
      queued_tasks: this.task_queue.length,
      completed_tasks: this.completed_count,
      rejected_tasks: this.rejected_count,
      avg_task_time_ms: avg_task_time,
    };
  }
}

/**
 * Create fixed-size thread pool
 */
export function newFixedThreadPool(size: number, name: string = 'pool'): ThreadPool {
  return new ThreadPool({
    name,
    strategy: 'fixed',
    min_threads: size,
    max_threads: size,
    queue_capacity: 1000,
    keep_alive_ms: 60000,
  });
}

/**
 * Create cached thread pool (grows as needed)
 */
export function newCachedThreadPool(name: string = 'cached-pool'): ThreadPool {
  return new ThreadPool({
    name,
    strategy: 'cached',
    min_threads: 0,
    max_threads: 64,
    queue_capacity: 10000,
    keep_alive_ms: 60000,
  });
}

/**
 * Create dynamic thread pool
 */
export function newDynamicThreadPool(
  min: number,
  max: number,
  name: string = 'dynamic-pool'
): ThreadPool {
  return new ThreadPool({
    name,
    strategy: 'dynamic',
    min_threads: min,
    max_threads: max,
    queue_capacity: 5000,
    keep_alive_ms: 60000,
  });
}

export default ThreadPool;
