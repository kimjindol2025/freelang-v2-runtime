/**
 * FreeLang Standard Library: std/promise
 *
 * Promise utilities and combinators for async programming
 */

/**
 * Wait for all promises to resolve
 * @param promises Array of promises to wait for
 * @returns Promise that resolves to array of results
 */
export function all<T>(promises: Promise<T>[]): Promise<T[]> {
  return Promise.all(promises);
}

/**
 * Wait for first promise to resolve or reject
 * @param promises Array of promises
 * @returns Promise that resolves to first result
 */
export function race<T>(promises: Promise<T>[]): Promise<T> {
  return Promise.race(promises);
}

/**
 * Wrap value in resolved promise
 * @param value Value to wrap
 * @returns Resolved promise with value
 */
export function resolve<T>(value: T | PromiseLike<T>): Promise<T> {
  return Promise.resolve(value);
}

/**
 * Create rejected promise with reason
 * @param reason Rejection reason
 * @returns Rejected promise
 */
export function reject<T>(reason?: any): Promise<T> {
  return Promise.reject(reason);
}

/**
 * Attach callback handlers
 * @param promise Source promise
 * @param onFulfilled Callback on fulfillment
 * @param onRejected Callback on rejection
 * @returns New promise
 */
export function then<T, R>(
  promise: Promise<T>,
  onFulfilled?: (value: T) => R | PromiseLike<R>,
  onRejected?: (reason: any) => R | PromiseLike<R>
): Promise<R> {
  return promise.then(onFulfilled, onRejected);
}

/**
 * Attach rejection handler
 * @param promise Source promise
 * @param onRejected Callback on rejection
 * @returns New promise
 */
export function catch_<T>(
  promise: Promise<T>,
  onRejected: (reason: any) => T | PromiseLike<T>
): Promise<T> {
  return promise.catch(onRejected);
}

/**
 * Attach finally handler (executes regardless of result)
 * @param promise Source promise
 * @param onFinally Callback to execute
 * @returns New promise
 */
export function finally_<T>(
  promise: Promise<T>,
  onFinally: () => void | PromiseLike<void>
): Promise<T> {
  return promise.finally(onFinally);
}

/**
 * Timeout wrapper - rejects if promise doesn't resolve in time
 * @param promise Promise to wrap
 * @param ms Timeout in milliseconds
 * @returns Promise with timeout
 */
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    )
  ]);
}

/**
 * Delay execution - resolves after specified time
 * @param ms Delay in milliseconds
 * @param value Value to resolve with
 * @returns Promise that resolves after delay
 */
export function delay<T>(ms: number, value?: T): Promise<T | void> {
  return new Promise(resolve => {
    setTimeout(() => resolve(value), ms);
  });
}

/**
 * Retry promise with exponential backoff
 * @param fn Function that returns promise
 * @param maxAttempts Maximum retry attempts
 * @param delayMs Initial delay between retries
 * @returns Promise with retry logic
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < maxAttempts - 1) {
        // Exponential backoff: delayMs * 2^i
        const backoffDelay = delayMs * Math.pow(2, i);
        await delay(backoffDelay, undefined);
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Sequence promises - execute promises sequentially
 * @param promiseFns Array of promise-returning functions
 * @returns Promise that resolves to array of results in order
 */
export async function sequence<T>(
  promiseFns: Array<() => Promise<T>>
): Promise<T[]> {
  const results: T[] = [];

  for (const fn of promiseFns) {
    results.push(await fn());
  }

  return results;
}

/**
 * Execute promises in parallel with concurrency limit
 * @param promiseFns Array of promise-returning functions
 * @param concurrency Maximum concurrent promises
 * @returns Promise that resolves to array of results
 */
export async function parallel<T>(
  promiseFns: Array<() => Promise<T>>,
  concurrency: number = 2
): Promise<T[]> {
  const results: T[] = new Array(promiseFns.length);
  const executing: Promise<void>[] = [];

  for (let i = 0; i < promiseFns.length; i++) {
    const p = Promise.resolve(promiseFns[i]()).then(r => {
      results[i] = r;
    });

    executing.push(p);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(ep => ep === p), 1);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Waterfall - pass results from one promise to next
 * @param promiseFns Array of promise-returning functions
 * @returns Promise with final result
 */
export async function waterfall<T>(
  promiseFns: Array<(prev: any) => Promise<T>>
): Promise<T> {
  let result: any;

  for (const fn of promiseFns) {
    result = await fn(result);
  }

  return result;
}

/**
 * Create promise that resolves or rejects based on condition
 * @param condition Condition to evaluate
 * @param value Value to resolve if true
 * @param reason Reason to reject if false
 * @returns Promise based on condition
 */
export function when<T>(
  condition: boolean,
  value: T,
  reason?: any
): Promise<T> {
  return condition ? resolve(value) : reject(reason);
}

/**
 * Create deferred - promise that can be resolved/rejected externally
 * @returns Object with promise and resolver functions
 */
export function deferred<T>(): Deferred<T> {
  let resolve_: ((value: T) => void) | null = null;
  let reject_: ((reason?: any) => void) | null = null;

  const promise = new Promise<T>((res, rej) => {
    resolve_ = res;
    reject_ = rej;
  });

  return {
    promise,
    resolve: resolve_!,
    reject: reject_!
  };
}

/**
 * Deferred promise object
 */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

/**
 * Map array with async function
 * @param array Input array
 * @param fn Async mapping function
 * @returns Promise of mapped array
 */
export async function map<T, R>(
  array: T[],
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  return Promise.all(array.map((item, index) => fn(item, index)));
}

/**
 * Filter array with async predicate
 * @param array Input array
 * @param predicate Async predicate function
 * @returns Promise of filtered array
 */
export async function filter<T>(
  array: T[],
  predicate: (item: T, index: number) => Promise<boolean>
): Promise<T[]> {
  const results = await Promise.all(
    array.map((item, index) => predicate(item, index))
  );
  return array.filter((_, index) => results[index]);
}

/**
 * Export all promise functions as default object
 */
export const promise = {
  all,
  race,
  resolve,
  reject,
  then,
  catch: catch_,
  finally: finally_,
  timeout,
  delay,
  retry,
  sequence,
  parallel,
  waterfall,
  when,
  deferred,
  map,
  filter
};
