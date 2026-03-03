/**
 * Phase 13 Week 3: HTTP Batch Processing
 * Parallel, sequential, and rate-limited batch operations
 * Go Goroutine과 동등한 동시성 제공
 */

export interface BatchResult<T> {
  results: T[];
  errors: (Error | null)[];
  successCount: number;
  errorCount: number;
  totalDurationMs: number;
  perItemDurationMs: number[];
}

export interface BatchOptions {
  timeout?: number;          // 각 항목 타임아웃 (ms)
  continueOnError?: boolean; // 에러 발생해도 계속 (기본값 false)
  concurrency?: number;      // 동시 실행 제한 (기본값 무제한)
}

/**
 * Batch HTTP request handler
 *
 * Go Goroutine처럼 병렬 처리 지원:
 * ```
 * const urls = ['url1', 'url2', 'url3', ...];
 * const results = await HttpBatch.parallel(urls, url => http.get(url));
 * // 모든 요청 동시 실행 (Promise.all)
 * ```
 */
export class HttpBatch {
  /**
   * 병렬 처리 (모든 항목 동시 실행)
   * Go: go func() { ... }를 모든 항목에 대해
   */
  static async parallel<T, R>(
    items: T[],
    fn: (item: T, index: number) => Promise<R>,
    options?: BatchOptions
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const itemTimes: number[] = [];

    const promises = items.map(async (item, index) => {
      const itemStart = Date.now();
      try {
        const result = await this.executeWithTimeout(
          fn(item, index),
          options?.timeout
        );
        itemTimes[index] = Date.now() - itemStart;
        return { result, error: null };
      } catch (error) {
        itemTimes[index] = Date.now() - itemStart;
        if (options?.continueOnError) {
          return { result: null, error };
        }
        throw error;
      }
    });

    try {
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.error === null).length;
      const errorCount = results.length - successCount;

      return {
        results: results.map(r => r.result as R),
        errors: results.map(r => (r.error instanceof Error ? r.error : null)),
        successCount,
        errorCount,
        totalDurationMs: Date.now() - startTime,
        perItemDurationMs: itemTimes,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 순차 처리 (하나씩 실행)
   * Go에서는 sequentialial goroutine
   */
  static async sequential<T, R>(
    items: T[],
    fn: (item: T, index: number) => Promise<R>,
    options?: BatchOptions
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const results: R[] = [];
    const errors: (Error | null)[] = [];
    const itemTimes: number[] = [];
    let successCount = 0;

    for (let i = 0; i < items.length; i++) {
      const itemStart = Date.now();
      try {
        const result = await this.executeWithTimeout(
          fn(items[i], i),
          options?.timeout
        );
        results.push(result);
        errors.push(null);
        successCount++;
      } catch (error) {
        if (options?.continueOnError) {
          results.push(null as any);
          errors.push(error instanceof Error ? error : new Error(String(error)));
        } else {
          throw error;
        }
      }
      itemTimes.push(Date.now() - itemStart);
    }

    return {
      results,
      errors,
      successCount,
      errorCount: items.length - successCount,
      totalDurationMs: Date.now() - startTime,
      perItemDurationMs: itemTimes,
    };
  }

  /**
   * 동시 실행 제한이 있는 병렬 처리
   * Go: worker pool pattern (예: 10개씩 실행)
   */
  static async withLimit<T, R>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>,
    options?: BatchOptions
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const results: R[] = [];
    const errors: (Error | null)[] = [];
    const itemTimes: number[] = [];
    let successCount = 0;

    // 항목을 배치로 분할
    for (let i = 0; i < items.length; i += limit) {
      const batch = items.slice(i, i + limit);
      const batchPromises = batch.map(async (item, batchIndex) => {
        const itemStart = Date.now();
        const globalIndex = i + batchIndex;
        try {
          const result = await this.executeWithTimeout(
            fn(item, globalIndex),
            options?.timeout
          );
          itemTimes[globalIndex] = Date.now() - itemStart;
          return { globalIndex, result, error: null };
        } catch (error) {
          itemTimes[globalIndex] = Date.now() - itemStart;
          return {
            globalIndex,
            result: null,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const { globalIndex, result, error } of batchResults) {
        if (options?.continueOnError || error === null) {
          results[globalIndex] = result as R;
          errors[globalIndex] = error;
          if (error === null) successCount++;
        } else {
          throw error;
        }
      }
    }

    return {
      results,
      errors,
      successCount,
      errorCount: items.length - successCount,
      totalDurationMs: Date.now() - startTime,
      perItemDurationMs: itemTimes,
    };
  }

  /**
   * 진행 콜백이 있는 병렬 처리
   * 각 항목 완료 시 콜백 호출
   */
  static async parallelWithProgress<T, R>(
    items: T[],
    fn: (item: T, index: number) => Promise<R>,
    onProgress?: (completed: number, total: number, item: T, result?: R, error?: Error) => void,
    options?: BatchOptions
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const itemTimes: number[] = [];
    let completedCount = 0;

    const promises = items.map(async (item, index) => {
      const itemStart = Date.now();
      try {
        const result = await this.executeWithTimeout(
          fn(item, index),
          options?.timeout
        );
        itemTimes[index] = Date.now() - itemStart;
        completedCount++;
        if (onProgress) {
          onProgress(completedCount, items.length, item, result);
        }
        return { result, error: null };
      } catch (error) {
        itemTimes[index] = Date.now() - itemStart;
        completedCount++;
        if (onProgress) {
          onProgress(
            completedCount,
            items.length,
            item,
            undefined,
            error instanceof Error ? error : new Error(String(error))
          );
        }
        if (options?.continueOnError) {
          return { result: null, error };
        }
        throw error;
      }
    });

    try {
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.error === null).length;

      return {
        results: results.map(r => r.result as R),
        errors: results.map(r => (r.error instanceof Error ? r.error : null)),
        successCount,
        errorCount: results.length - successCount,
        totalDurationMs: Date.now() - startTime,
        perItemDurationMs: itemTimes,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 타임아웃이 있는 Promise 실행
   */
  private static executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    if (!timeoutMs) {
      return promise;
    }

    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs)
      ),
    ]);
  }

  /**
   * 배치 통계 정보
   */
  static getStats(result: BatchResult<any>): {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    medianDurationMs: number;
    throughput: number; // items/sec
  } {
    const durations = result.perItemDurationMs;
    const sorted = [...durations].sort((a, b) => a - b);

    const avgDurationMs =
      durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDurationMs = sorted[0];
    const maxDurationMs = sorted[sorted.length - 1];
    const medianDurationMs =
      sorted[Math.floor(sorted.length / 2)];
    const throughput = (durations.length / result.totalDurationMs) * 1000;

    return {
      avgDurationMs,
      minDurationMs,
      maxDurationMs,
      medianDurationMs,
      throughput,
    };
  }
}
