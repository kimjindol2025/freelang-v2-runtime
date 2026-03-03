/**
 * ════════════════════════════════════════════════════════════════════
 * Performance Optimizer
 *
 * 공유 성능 최적화 유틸리티:
 * - Regex 캐싱
 * - LRU 메모이제이션
 * - 객체 풀링
 * - 캐시 관리
 * ════════════════════════════════════════════════════════════════════
 */

/**
 * LRU 캐시 구현 (메모이제이션용)
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    // 성능 우선: LRU 재정렬 생략 (단순 캐시 조회만)
    return this.cache.get(key);
  }

  set(key: K, value: V): void {
    // 이미 있으면 업데이트만
    if (this.cache.has(key)) {
      // Map은 이미 최신 순서로 유지됨
      this.cache.set(key, value);
      return;
    }

    this.cache.set(key, value);

    // 크기 초과 시 가장 오래된 항목 제거 (O(1) 연산)
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; maxSize: number; hitRate: number } {
    return { size: this.cache.size, maxSize: this.maxSize, hitRate: 0 };
  }
}

/**
 * 정규식 캐시 (컴파일된 패턴 재사용)
 */
export class RegexCache {
  private static patterns: Map<string, RegExp> = new Map();
  private static hits: number = 0;
  private static misses: number = 0;

  /**
   * 정규식 가져오기 (없으면 컴파일)
   */
  static getPattern(pattern: string, flags?: string): RegExp {
    const key = `${pattern}:${flags || ''}`;

    if (this.patterns.has(key)) {
      this.hits++;
      return this.patterns.get(key)!;
    }

    this.misses++;
    const regex = new RegExp(pattern, flags);
    this.patterns.set(key, regex);
    return regex;
  }

  /**
   * 전체 캐시 초기화
   */
  static clear(): void {
    this.patterns.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 통계 조회
   */
  static getStats(): {
    cached: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    return {
      cached: this.patterns.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0
    };
  }

  /**
   * 특정 패턴 미리 컴파일 (워밍업)
   */
  static warmup(patterns: string[]): void {
    for (const pattern of patterns) {
      this.getPattern(pattern);
    }
  }
}

/**
 * 객체 풀 (메모리 할당 감소)
 */
export class ObjectPool<T> {
  private available: T[] = [];
  private inUse: Set<T> = new Set();
  private factory: () => T;
  private reset?: (obj: T) => void;
  private maxPoolSize: number;

  constructor(
    factory: () => T,
    reset?: (obj: T) => void,
    maxPoolSize: number = 500
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxPoolSize = maxPoolSize;
  }

  /**
   * 객체 획득
   */
  acquire(): T {
    let obj: T;
    if (this.available.length > 0) {
      obj = this.available.pop()!;
      if (this.reset) this.reset(obj);
    } else {
      obj = this.factory();
    }
    this.inUse.add(obj);
    return obj;
  }

  /**
   * 객체 반환
   */
  release(obj: T): void {
    this.inUse.delete(obj);
    if (this.available.length < this.maxPoolSize) {
      this.available.push(obj);
    }
  }

  /**
   * 풀 초기화
   */
  clear(): void {
    this.available = [];
    this.inUse.clear();
  }

  /**
   * 풀 통계
   */
  getStats(): { available: number; inUse: number; total: number } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size
    };
  }
}

/**
 * 메모이제이션 데코레이터
 */
export function memoize<Args extends any[], Return>(
  fn: (...args: Args) => Return,
  cache: LRUCache<string, Return>
): (...args: Args) => Return {
  return (...args: Args) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key as any);
    if (cached !== undefined) {
      return cached;
    }
    const result = fn(...args);
    cache.set(key as any, result);
    return result;
  };
}

/**
 * 성능 측정 유틸리티
 */
export class PerformanceTimer {
  private startTime: bigint = 0n;
  private startMemory: number = 0;

  start(): void {
    this.startTime = process.hrtime.bigint();
    this.startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  }

  end(): { timeMs: number; memoryMb: number } {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;

    const timeMs = Number(endTime - this.startTime) / 1_000_000;
    const memoryMb = Math.abs(endMemory - this.startMemory);

    return { timeMs, memoryMb };
  }
}

/**
 * 배치 처리기 (여러 작업을 한 번에 처리)
 */
export class BatchProcessor<T, R> {
  private queue: T[] = [];
  private processor: (items: T[]) => R;
  private batchSize: number;

  constructor(processor: (items: T[]) => R, batchSize: number = 100) {
    this.processor = processor;
    this.batchSize = batchSize;
  }

  /**
   * 항목 추가
   */
  add(item: T): void {
    this.queue.push(item);
  }

  /**
   * 배치 처리 (남은 항목들도 처리)
   */
  flush(): R[] {
    const results: R[] = [];
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);
      results.push(this.processor(batch));
    }
    return results;
  }

  /**
   * 큐 크기
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * 큐 초기화
   */
  clear(): void {
    this.queue = [];
  }
}

/**
 * 전역 성능 메트릭 수집
 */
export class PerformanceMetrics {
  private static metrics: Map<string, { count: number; totalTime: number }> =
    new Map();

  static record(name: string, timeMs: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, { count: 0, totalTime: 0 });
    }
    const metric = this.metrics.get(name)!;
    metric.count++;
    metric.totalTime += timeMs;
  }

  static getMetrics(name: string): {
    count: number;
    avgTime: number;
    totalTime: number;
  } | null {
    const metric = this.metrics.get(name);
    if (!metric) return null;
    return {
      count: metric.count,
      avgTime: metric.totalTime / metric.count,
      totalTime: metric.totalTime
    };
  }

  static getAllMetrics(): Record<
    string,
    { count: number; avgTime: number; totalTime: number }
  > {
    const result: Record<
      string,
      { count: number; avgTime: number; totalTime: number }
    > = {};
    for (const [name, metric] of this.metrics) {
      result[name] = {
        count: metric.count,
        avgTime: metric.totalTime / metric.count,
        totalTime: metric.totalTime
      };
    }
    return result;
  }

  static clear(): void {
    this.metrics.clear();
  }

  static print(): void {
    console.log('\n📊 Performance Metrics');
    console.log('═'.repeat(60));
    for (const [name, metric] of this.metrics) {
      const avgTime = (metric.totalTime / metric.count).toFixed(2);
      console.log(
        `${name.padEnd(30)} | Count: ${metric.count.toString().padEnd(6)} | Avg: ${avgTime}ms`
      );
    }
  }
}

/**
 * 초기화: 일반적인 패턴 미리 컴파일
 */
export function initializeOptimizations(): void {
  // Trait Engine 패턴
  RegexCache.warmup([
    /trait\s+(\w+)/,
    /impl\s+(\w+)\s+for\s+(\w+)/,
    /fn\s+(\w+)\s*\(/,
    /:\s*(\w+(?:<[^>]+>)?)/,
    /type\s+(\w+)\s*=/
  ].map(r => r.source));

  // Generics 패턴
  RegexCache.warmup([
    /(\w+)<([A-Z][a-zA-Z0-9]*(?:\s*,\s*[A-Z][a-zA-Z0-9]*)*)>/,
    /extends\s+([a-zA-Z0-9<>,\s]+)/,
    /where\s+([^{]+)/
  ].map(r => r.source));

  // Union Narrowing 패턴
  RegexCache.warmup([
    /typeof\s+(\w+)\s*===?\s*['"?](\w+)['"?]/,
    /instanceof\s+(\w+)/,
    /===?\s*null/,
    /!==?\s*null/
  ].map(r => r.source));
}
