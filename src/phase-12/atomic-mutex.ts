/**
 * Phase 12.2: Promise-Based Mutex
 *
 * Fair mutual exclusion using Promise queue (FIFO)
 * Phase 12.2: Promise-based (works in event loop)
 * Phase 12.4: Will upgrade to Atomics.wait/notify for real worker_threads
 */

/**
 * Promise-Based Mutex
 *
 * Maintains a queue of pending lock requests
 * Ensures FIFO fairness
 */
export class AtomicMutex {
  private locked = false;
  private waitQueue: Array<() => void> = [];

  /**
   * Acquire lock (async, may wait in queue)
   *
   * @param timeoutMs - Timeout in milliseconds (default: 30000)
   * @throws If timeout expires
   */
  async lock(timeoutMs: number = 30000): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    // Lock is held, add to queue
    return new Promise((resolve, reject) => {
      let timeoutHandle: NodeJS.Timeout | null = null;

      const unblock = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        this.locked = true;
        resolve();
      };

      this.waitQueue.push(unblock);

      if (timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          // Remove from queue if still there
          const idx = this.waitQueue.indexOf(unblock);
          if (idx >= 0) {
            this.waitQueue.splice(idx, 1);
          }
          reject(new Error(
            `Mutex lock timeout after ${timeoutMs}ms (possible deadlock)`
          ));
        }, timeoutMs);
      }
    });
  }

  /**
   * Release lock and wake next waiter
   *
   * Must be called by lock owner
   */
  unlock(): void {
    if (!this.locked) {
      throw new Error('Mutex not locked');
    }

    const next = this.waitQueue.shift();
    if (next) {
      // Schedule next waiter to acquire lock
      setImmediate(next);
    } else {
      this.locked = false;
    }
  }

  /**
   * Execute function with lock held
   *
   * Automatically acquires and releases lock
   */
  async withLock<T>(fn: () => Promise<T> | T, timeoutMs?: number): Promise<T> {
    await this.lock(timeoutMs);
    try {
      const result = fn();
      if (result instanceof Promise) {
        return await result;
      }
      return result;
    } finally {
      this.unlock();
    }
  }

  /**
   * Try to acquire lock without blocking
   *
   * @returns true if lock acquired, false otherwise
   */
  tryLock(): boolean {
    if (!this.locked) {
      this.locked = true;
      return true;
    }
    return false;
  }

  /**
   * Check if lock is currently held
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Get queue size (for monitoring)
   */
  getQueueSize(): number {
    return this.waitQueue.length;
  }
}

/**
 * Shared Atomic Mutex (for future worker_threads integration)
 *
 * Placeholder for Phase 12.4 upgrade to SharedArrayBuffer-based implementation
 */
export class SharedAtomicMutex extends AtomicMutex {
  private sharedBuffer: SharedArrayBuffer;

  constructor(sharedBuffer?: SharedArrayBuffer) {
    super();
    // Phase 12.4: will implement Atomics.wait/notify on SharedArrayBuffer
    this.sharedBuffer = sharedBuffer || new SharedArrayBuffer(4);
  }

  /**
   * Get underlying SharedArrayBuffer (for inter-thread sharing)
   */
  getSharedBuffer(): SharedArrayBuffer {
    return this.sharedBuffer;
  }
}
