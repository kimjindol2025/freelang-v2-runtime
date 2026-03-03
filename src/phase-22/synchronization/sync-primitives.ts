/**
 * Phase 22.2: Synchronization Primitives
 *
 * Thread synchronization mechanisms:
 * - Mutex (mutual exclusion)
 * - Semaphore (counting semaphore)
 * - RWLock (reader-writer lock)
 * - ConditionVariable (waiting/signaling)
 */

export type LockType = 'mutex' | 'rwlock' | 'semaphore' | 'condition';

export interface LockStatistics {
  lock_type: LockType;
  name: string;
  owner_thread?: number;
  waiting_count: number;
  acquire_count: number;
  release_count: number;
  contention_ratio: number;
  avg_hold_time_ms: number;
}

/**
 * Mutex (Mutual Exclusion Lock)
 * Ensures only one thread can access critical section
 */
export class Mutex {
  private name: string;
  private locked: boolean = false;
  private owner_thread?: number;
  private waiting_threads: Array<(value?: any) => void> = [];
  private acquire_count: number = 0;
  private release_count: number = 0;
  private hold_times: number[] = [];
  private last_acquire_time: number = 0;

  constructor(name: string = 'mutex') {
    this.name = name;
  }

  /**
   * Acquire lock (blocking)
   * Fix: Prevent race condition and busy wait
   */
  async lock(thread_id?: number): Promise<void> {
    while (this.locked) {
      await new Promise<void>(resolve => {
        this.waiting_threads.push(resolve);
      });
      // After waking, retry acquiring lock
    }

    this.locked = true;
    this.owner_thread = thread_id;
    this.acquire_count++;
    this.last_acquire_time = Date.now();
  }

  /**
   * Try acquire lock (non-blocking)
   */
  tryLock(thread_id?: number): boolean {
    if (this.locked) {
      return false;
    }

    this.locked = true;
    this.owner_thread = thread_id;
    this.acquire_count++;
    this.last_acquire_time = Date.now();
    return true;
  }

  /**
   * Release lock
   * Fix: Unlock first, then wake waiting thread
   * This prevents lost notifications and race conditions
   */
  unlock(): void {
    if (!this.locked) {
      throw new Error(`Mutex ${this.name} is not locked`);
    }

    const hold_time = Date.now() - this.last_acquire_time;
    this.hold_times.push(hold_time);

    this.release_count++;
    this.owner_thread = undefined;

    // CRITICAL: Set locked to false BEFORE waking waiters
    // This allows waiting threads to acquire lock in their while loop
    this.locked = false;

    // Wake up ONE waiting thread
    // That thread will retry acquiring the lock in its while loop
    if (this.waiting_threads.length > 0) {
      const waiter = this.waiting_threads.shift();
      if (waiter) waiter();
    }
  }

  /**
   * Check if locked
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Get owner thread ID
   */
  getOwner(): number | undefined {
    return this.owner_thread;
  }

  /**
   * Get waiting count
   */
  getWaitingCount(): number {
    return this.waiting_threads.length;
  }

  /**
   * Get statistics
   */
  getStats(): LockStatistics {
    const avg_hold = this.hold_times.length > 0
      ? this.hold_times.reduce((a, b) => a + b, 0) / this.hold_times.length
      : 0;

    return {
      lock_type: 'mutex',
      name: this.name,
      owner_thread: this.owner_thread,
      waiting_count: this.waiting_threads.length,
      acquire_count: this.acquire_count,
      release_count: this.release_count,
      contention_ratio: this.acquire_count > 0 ? this.waiting_threads.length / this.acquire_count : 0,
      avg_hold_time_ms: avg_hold,
    };
  }
}

/**
 * Semaphore (Counting Semaphore)
 * Allows multiple threads up to a count
 */
export class Semaphore {
  private name: string;
  private count: number;
  private max_count: number;
  private waiting_threads: Array<(value?: any) => void> = [];
  private acquire_count: number = 0;
  private release_count: number = 0;

  constructor(name: string = 'semaphore', initial_count: number = 1, max_count: number = initial_count) {
    this.name = name;
    this.count = initial_count;
    this.max_count = max_count;
  }

  /**
   * Acquire permit (blocking)
   */
  async acquire(): Promise<void> {
    while (this.count <= 0) {
      await new Promise(resolve => {
        this.waiting_threads.push(resolve);
      });
    }

    this.count--;
    this.acquire_count++;
  }

  /**
   * Try acquire permit (non-blocking)
   */
  tryAcquire(): boolean {
    if (this.count <= 0) {
      return false;
    }

    this.count--;
    this.acquire_count++;
    return true;
  }

  /**
   * Release permit
   */
  release(): void {
    if (this.count >= this.max_count) {
      throw new Error(`Semaphore ${this.name} is full`);
    }

    this.count++;
    this.release_count++;

    // Wake up waiting thread
    if (this.waiting_threads.length > 0) {
      const waiter = this.waiting_threads.shift();
      if (waiter) waiter();
    }
  }

  /**
   * Get available permits
   */
  getAvailable(): number {
    return this.count;
  }

  /**
   * Get waiting count
   */
  getWaitingCount(): number {
    return this.waiting_threads.length;
  }

  /**
   * Get statistics
   */
  getStats(): LockStatistics {
    return {
      lock_type: 'semaphore',
      name: this.name,
      waiting_count: this.waiting_threads.length,
      acquire_count: this.acquire_count,
      release_count: this.release_count,
      contention_ratio: this.acquire_count > 0 ? this.waiting_threads.length / this.acquire_count : 0,
      avg_hold_time_ms: 0,
    };
  }
}

/**
 * ReaderWriter Lock (RWLock)
 * Allows multiple readers or single writer
 */
export class RWLock {
  private name: string;
  private readers: number = 0;
  private writer: boolean = false;
  private waiting_readers: Array<(value?: any) => void> = [];
  private waiting_writers: Array<(value?: any) => void> = [];
  private read_count: number = 0;
  private write_count: number = 0;

  constructor(name: string = 'rwlock') {
    this.name = name;
  }

  /**
   * Acquire read lock (blocking)
   */
  async readLock(): Promise<void> {
    while (this.writer || this.waiting_writers.length > 0) {
      await new Promise(resolve => {
        this.waiting_readers.push(resolve);
      });
    }

    this.readers++;
    this.read_count++;
  }

  /**
   * Release read lock
   */
  readUnlock(): void {
    if (this.readers <= 0) {
      throw new Error(`RWLock ${this.name} has no active readers`);
    }

    this.readers--;

    // Wake up waiting writer if no more readers
    if (this.readers === 0 && this.waiting_writers.length > 0) {
      const waiter = this.waiting_writers.shift();
      if (waiter) waiter();
    }
  }

  /**
   * Acquire write lock (blocking)
   */
  async writeLock(): Promise<void> {
    while (this.writer || this.readers > 0) {
      await new Promise(resolve => {
        this.waiting_writers.push(resolve);
      });
    }

    this.writer = true;
    this.write_count++;
  }

  /**
   * Release write lock
   */
  writeUnlock(): void {
    if (!this.writer) {
      throw new Error(`RWLock ${this.name} does not have write lock`);
    }

    this.writer = false;

    // Wake up waiting threads
    while (this.waiting_readers.length > 0) {
      const waiter = this.waiting_readers.shift();
      if (waiter) waiter();
    }

    if (this.waiting_writers.length > 0) {
      const waiter = this.waiting_writers.shift();
      if (waiter) waiter();
    }
  }

  /**
   * Get statistics
   */
  getStats(): LockStatistics {
    return {
      lock_type: 'rwlock',
      name: this.name,
      waiting_count: this.waiting_readers.length + this.waiting_writers.length,
      acquire_count: this.read_count + this.write_count,
      release_count: this.read_count + this.write_count,
      contention_ratio: 0,
      avg_hold_time_ms: 0,
    };
  }
}

/**
 * Condition Variable
 * For thread synchronization and wait/notify patterns
 */
export class ConditionVariable {
  private name: string;
  private waiting_threads: Array<(value?: any) => void> = [];
  private notify_count: number = 0;
  private notify_all_count: number = 0;

  constructor(name: string = 'condition') {
    this.name = name;
  }

  /**
   * Wait for signal (must hold lock)
   */
  async wait(): Promise<void> {
    await new Promise(resolve => {
      this.waiting_threads.push(resolve);
    });
  }

  /**
   * Notify one waiting thread
   */
  notify(): void {
    if (this.waiting_threads.length > 0) {
      const waiter = this.waiting_threads.shift();
      if (waiter) {
        this.notify_count++;
        waiter();
      }
    }
  }

  /**
   * Notify all waiting threads
   */
  notifyAll(): void {
    const count = this.waiting_threads.length;
    while (this.waiting_threads.length > 0) {
      const waiter = this.waiting_threads.shift();
      if (waiter) waiter();
    }
    this.notify_all_count++;
  }

  /**
   * Get waiting count
   */
  getWaitingCount(): number {
    return this.waiting_threads.length;
  }

  /**
   * Get statistics
   */
  getStats(): LockStatistics {
    return {
      lock_type: 'condition',
      name: this.name,
      waiting_count: this.waiting_threads.length,
      acquire_count: this.notify_count + this.notify_all_count,
      release_count: this.notify_count + this.notify_all_count,
      contention_ratio: 0,
      avg_hold_time_ms: 0,
    };
  }
}

export default { Mutex, Semaphore, RWLock, ConditionVariable };
