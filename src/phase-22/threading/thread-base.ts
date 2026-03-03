/**
 * Phase 22.1: Thread Management System
 *
 * Core threading infrastructure with:
 * - Thread creation and lifecycle
 * - Thread identification and management
 * - Thread local storage
 * - Thread states and transitions
 */

export type ThreadState = 'new' | 'runnable' | 'running' | 'blocked' | 'waiting' | 'terminated';
export type ThreadPriority = 'low' | 'normal' | 'high' | 'critical';

export interface ThreadConfig {
  name: string;
  priority: ThreadPriority;
  stack_size: number; // in KB
  daemon: boolean; // Daemon threads don't block program exit
}

export interface ThreadStatistics {
  id: number;
  name: string;
  state: ThreadState;
  priority: ThreadPriority;
  start_time: number;
  end_time?: number;
  cpu_time_ms: number;
  user_time_ms: number;
  block_count: number;
  block_time_ms: number;
}

export interface ThreadLocalStorage {
  [key: string]: any;
}

/**
 * Thread Base Class
 * Manages thread lifecycle, state transitions, and local storage
 */
export class ThreadBase {
  protected id: number;
  protected name: string;
  protected config: ThreadConfig;
  protected state: ThreadState = 'new';
  protected priority: ThreadPriority;
  protected start_time: number = 0;
  protected end_time?: number;
  protected cpu_time_ms: number = 0;
  protected user_time_ms: number = 0;
  protected block_count: number = 0;
  protected block_time_ms: number = 0;
  protected local_storage: ThreadLocalStorage = {};
  protected runnable: () => Promise<void>;
  protected exception?: Error;
  protected interrupt_flag: boolean = false;
  protected started: boolean = false; // Prevent duplicate start

  private static id_counter = 0;
  private static active_threads: Map<number, ThreadBase> = new Map();

  constructor(name: string, runnable: () => Promise<void>, config?: Partial<ThreadConfig>) {
    this.id = ThreadBase.id_counter++;
    this.name = name;
    this.runnable = runnable;
    this.priority = config?.priority || 'normal';

    this.config = {
      name,
      priority: this.priority,
      stack_size: config?.stack_size || 1024,
      daemon: config?.daemon || false,
    };

    ThreadBase.active_threads.set(this.id, this);
  }

  /**
   * Start the thread
   */
  async start(): Promise<void> {
    // Prevent duplicate start (race condition safe)
    if (this.started) {
      throw new Error(`Thread ${this.name} already started`);
    }
    this.started = true;

    this.state = 'runnable';
    this.start_time = Date.now();

    try {
      this.state = 'running';
      await this.runnable();
      this.state = 'terminated';
      this.end_time = Date.now();
      this.cpu_time_ms = this.end_time - this.start_time;
    } catch (error: any) {
      this.exception = error;
      this.state = 'terminated';
      this.end_time = Date.now();
      throw error;
    } finally {
      ThreadBase.active_threads.delete(this.id);
    }
  }

  /**
   * Join (wait for thread completion)
   */
  async join(timeout_ms?: number): Promise<boolean> {
    if (this.state === 'new') {
      throw new Error(`Thread ${this.name} not started`);
    }

    const start = Date.now();
    while (this.state !== 'terminated') {
      if (timeout_ms && Date.now() - start > timeout_ms) {
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    if (this.exception) {
      throw this.exception;
    }

    return true;
  }

  /**
   * Interrupt thread
   */
  interrupt(): void {
    this.interrupt_flag = true;
  }

  /**
   * Check if interrupted
   */
  isInterrupted(): boolean {
    return this.interrupt_flag;
  }

  /**
   * Sleep (block for duration)
   */
  async sleep(ms: number): Promise<void> {
    const block_start = Date.now();
    this.state = 'blocked';

    try {
      await new Promise(resolve => setTimeout(resolve, ms));
    } finally {
      const block_duration = Date.now() - block_start;
      this.block_count++;
      this.block_time_ms += block_duration;
      this.state = 'running';
    }
  }

  /**
   * Yield to other threads
   */
  async yield(): Promise<void> {
    await new Promise(resolve => setImmediate(resolve));
  }

  /**
   * Set thread local storage
   */
  setLocal(key: string, value: any): void {
    this.local_storage[key] = value;
  }

  /**
   * Get thread local storage
   */
  getLocal(key: string): any {
    return this.local_storage[key];
  }

  /**
   * Remove thread local storage
   */
  removeLocal(key: string): void {
    delete this.local_storage[key];
  }

  /**
   * Change thread priority
   */
  setPriority(priority: ThreadPriority): void {
    this.priority = priority;
    this.config.priority = priority;
  }

  /**
   * Get thread ID
   */
  getId(): number {
    return this.id;
  }

  /**
   * Get thread name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get thread state
   */
  getState(): ThreadState {
    return this.state;
  }

  /**
   * Check if alive (must be started and not terminated)
   */
  isAlive(): boolean {
    return this.started && this.state !== 'terminated';
  }

  /**
   * Get configuration
   */
  getConfig(): ThreadConfig {
    return { ...this.config };
  }

  /**
   * Get statistics
   */
  getStats(): ThreadStatistics {
    return {
      id: this.id,
      name: this.name,
      state: this.state,
      priority: this.priority,
      start_time: this.start_time,
      end_time: this.end_time,
      cpu_time_ms: this.cpu_time_ms,
      user_time_ms: this.user_time_ms,
      block_count: this.block_count,
      block_time_ms: this.block_time_ms,
    };
  }

  /**
   * Get all active threads
   */
  static getAllThreads(): ThreadBase[] {
    return Array.from(this.active_threads.values());
  }

  /**
   * Get active thread count
   */
  static getActiveCount(): number {
    return this.active_threads.size;
  }

  /**
   * Find thread by ID
   */
  static findById(id: number): ThreadBase | undefined {
    return this.active_threads.get(id);
  }

  /**
   * Find thread by name
   */
  static findByName(name: string): ThreadBase | undefined {
    return Array.from(this.active_threads.values()).find(t => t.name === name);
  }

  /**
   * Reset ID counter (for testing)
   */
  static resetIdCounter(): void {
    this.id_counter = 0;
  }

  /**
   * Clear all threads (for testing)
   */
  static clearAll(): void {
    this.active_threads.clear();
  }
}

export default ThreadBase;
