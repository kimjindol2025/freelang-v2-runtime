/**
 * Phase 23.2: Resilience Patterns
 *
 * Resilience patterns for distributed systems:
 * - Circuit Breaker (fault isolation)
 * - Retry Policy (transient fault handling)
 * - Timeout Policy (preventing hangs)
 * - Bulkhead Pattern (isolation/threading model)
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export type RetryBackoffStrategy = 'FIXED' | 'LINEAR' | 'EXPONENTIAL' | 'RANDOM';

export interface CircuitBreakerConfig {
  name: string;
  failure_threshold: number; // Failures before opening
  success_threshold: number; // Successes to close
  timeout_ms: number; // Time before half-open attempt
  half_open_max_calls: number; // Max calls in half-open state
}

export interface CircuitBreakerStats {
  state: CircuitState;
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  rejected_calls: number;
  last_failure_time?: number;
  last_success_time?: number;
}

/**
 * Circuit Breaker Pattern
 * Prevents cascading failures by fast-failing
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = 'CLOSED';
  private failure_count: number = 0;
  private success_count: number = 0;
  private total_calls: number = 0;
  private successful_calls: number = 0;
  private failed_calls: number = 0;
  private rejected_calls: number = 0;
  private last_failure_time?: number;
  private last_success_time?: number;
  private half_open_calls: number = 0;
  private state_changed_time: number = Date.now();

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Execute with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // Check if timeout expired
      if (Date.now() - this.state_changed_time > this.config.timeout_ms) {
        this.transitionToHalfOpen();
      } else {
        this.rejected_calls++;
        throw new Error(`Circuit breaker ${this.config.name} is OPEN`);
      }
    }

    if (this.state === 'HALF_OPEN') {
      if (this.half_open_calls >= this.config.half_open_max_calls) {
        throw new Error(`Circuit breaker ${this.config.name} max half-open calls exceeded`);
      }
      this.half_open_calls++;
    }

    this.total_calls++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Private: Handle success
   */
  private onSuccess(): void {
    this.successful_calls++;
    this.last_success_time = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.success_count++;
      if (this.success_count >= this.config.success_threshold) {
        this.transitionToClosed();
      }
    } else if (this.state === 'CLOSED') {
      this.failure_count = 0;
    }
  }

  /**
   * Private: Handle failure
   */
  private onFailure(): void {
    this.failed_calls++;
    this.last_failure_time = Date.now();

    if (this.state === 'CLOSED') {
      this.failure_count++;
      if (this.failure_count >= this.config.failure_threshold) {
        this.transitionToOpen();
      }
    } else if (this.state === 'HALF_OPEN') {
      this.transitionToOpen();
    }
  }

  /**
   * Private: Transition to CLOSED
   */
  private transitionToClosed(): void {
    this.state = 'CLOSED';
    this.state_changed_time = Date.now();
    this.failure_count = 0;
    this.success_count = 0;
    this.half_open_calls = 0;
  }

  /**
   * Private: Transition to OPEN
   */
  private transitionToOpen(): void {
    this.state = 'OPEN';
    this.state_changed_time = Date.now();
    this.success_count = 0;
    this.half_open_calls = 0;
  }

  /**
   * Private: Transition to HALF_OPEN
   */
  private transitionToHalfOpen(): void {
    this.state = 'HALF_OPEN';
    this.state_changed_time = Date.now();
    this.failure_count = 0;
    this.success_count = 0;
    this.half_open_calls = 0;
  }

  /**
   * Get state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      total_calls: this.total_calls,
      successful_calls: this.successful_calls,
      failed_calls: this.failed_calls,
      rejected_calls: this.rejected_calls,
      last_failure_time: this.last_failure_time,
      last_success_time: this.last_success_time,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.transitionToClosed();
    this.total_calls = 0;
    this.successful_calls = 0;
    this.failed_calls = 0;
    this.rejected_calls = 0;
  }
}

/**
 * Retry Policy
 * Retries transient failures with backoff
 */
export class RetryPolicy {
  private max_retries: number;
  private backoff_strategy: RetryBackoffStrategy;
  private initial_delay_ms: number;
  private max_delay_ms: number;
  private retry_count: number = 0;
  private total_attempts: number = 0;

  constructor(
    max_retries: number = 3,
    initial_delay_ms: number = 100,
    max_delay_ms: number = 5000,
    backoff_strategy: RetryBackoffStrategy = 'EXPONENTIAL'
  ) {
    this.max_retries = max_retries;
    this.initial_delay_ms = initial_delay_ms;
    this.max_delay_ms = max_delay_ms;
    this.backoff_strategy = backoff_strategy;
  }

  /**
   * Execute with retry
   */
  async execute<T>(fn: () => Promise<T>, retriable?: (error: Error) => boolean): Promise<T> {
    let last_error: Error | undefined;

    for (let attempt = 0; attempt <= this.max_retries; attempt++) {
      this.total_attempts++;

      try {
        return await fn();
      } catch (error: any) {
        last_error = error;

        // Check if error is retriable
        if (!retriable || !retriable(error)) {
          throw error;
        }

        if (attempt < this.max_retries) {
          const delay = this.calculateBackoff(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          this.retry_count++;
        }
      }
    }

    throw last_error || new Error('Max retries exceeded');
  }

  /**
   * Calculate backoff delay
   */
  private calculateBackoff(attempt: number): number {
    let delay = this.initial_delay_ms;

    switch (this.backoff_strategy) {
      case 'FIXED':
        return delay;
      case 'LINEAR':
        delay = this.initial_delay_ms * (attempt + 1);
        break;
      case 'EXPONENTIAL':
        delay = this.initial_delay_ms * Math.pow(2, attempt);
        break;
      case 'RANDOM':
        delay = Math.random() * this.initial_delay_ms * (attempt + 1);
        break;
    }

    return Math.min(delay, this.max_delay_ms);
  }

  /**
   * Get retry count
   */
  getRetryCount(): number {
    return this.retry_count;
  }

  /**
   * Get total attempts
   */
  getTotalAttempts(): number {
    return this.total_attempts;
  }
}

/**
 * Timeout Policy
 * Cancels operations that take too long
 */
export class TimeoutPolicy {
  private timeout_ms: number;
  private timed_out_count: number = 0;

  constructor(timeout_ms: number = 5000) {
    this.timeout_ms = timeout_ms;
  }

  /**
   * Execute with timeout
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => {
            this.timed_out_count++;
            reject(new Error(`Operation timed out after ${this.timeout_ms}ms`));
          },
          this.timeout_ms
        )
      ),
    ]);
  }

  /**
   * Get timeout count
   */
  getTimeoutCount(): number {
    return this.timed_out_count;
  }

  /**
   * Set timeout
   */
  setTimeout(timeout_ms: number): void {
    this.timeout_ms = timeout_ms;
  }
}

/**
 * Bulkhead Pattern
 * Isolates resources to prevent cascading failures
 */
export class Bulkhead {
  private name: string;
  private max_concurrent: number;
  private current_concurrent: number = 0;
  private queued_tasks: Array<() => void> = [];
  private rejected_count: number = 0;
  private executed_count: number = 0;

  constructor(name: string, max_concurrent: number = 10) {
    this.name = name;
    this.max_concurrent = max_concurrent;
  }

  /**
   * Execute with isolation
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.current_concurrent >= this.max_concurrent) {
      this.rejected_count++;
      throw new Error(`Bulkhead ${this.name} is full (${this.max_concurrent} concurrent)`);
    }

    this.current_concurrent++;
    this.executed_count++;

    try {
      return await fn();
    } finally {
      this.current_concurrent--;

      // Process queued tasks
      if (this.queued_tasks.length > 0) {
        const task = this.queued_tasks.shift();
        if (task) task();
      }
    }
  }

  /**
   * Try execute (don't reject, queue instead)
   */
  async executeQueued<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        try {
          const result = await this.execute(fn);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      if (this.current_concurrent < this.max_concurrent) {
        task();
      } else {
        this.queued_tasks.push(task);
      }
    });
  }

  /**
   * Get current concurrent count
   */
  getCurrentConcurrent(): number {
    return this.current_concurrent;
  }

  /**
   * Get queued count
   */
  getQueuedCount(): number {
    return this.queued_tasks.length;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      name: this.name,
      max_concurrent: this.max_concurrent,
      current_concurrent: this.current_concurrent,
      queued_count: this.queued_tasks.length,
      rejected_count: this.rejected_count,
      executed_count: this.executed_count,
      utilization: this.current_concurrent / this.max_concurrent,
    };
  }
}

export default {
  CircuitBreaker,
  RetryPolicy,
  TimeoutPolicy,
  Bulkhead,
};
