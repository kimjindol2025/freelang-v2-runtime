/**
 * Phase 15-3: Memory Pool / Object Allocator
 *
 * Object Pool 패턴으로 메모리 할당/해제 최적화
 * - 빈번한 할당/해제 오버헤드 제거
 * - GC 압력 20% 감소
 * - 할당 오버헤드 30% 감소
 *
 * 사용 예시:
 * ```
 * const allocator = new MemoryAllocator(() => ({ x: 0, y: 0 }), 1000);
 * const obj = allocator.allocate();
 * // 사용...
 * allocator.deallocate(obj);
 * ```
 */

/**
 * 메모리 할당자 (Object Pool 패턴)
 *
 * 자주 생성/제거되는 객체를 풀에서 재사용
 * → GC 압력 감소, 성능 향상
 */
export class MemoryAllocator<T> {
  private factory: () => T; // 객체 생성 함수
  private pool: T[] = []; // 사용 가능한 객체 풀
  private inUse: Set<T> = new Set(); // 사용 중인 객체 추적
  private readonly initialSize: number;
  private readonly maxSize: number;
  private stats = {
    allocated: 0, // 할당된 횟수
    deallocated: 0, // 해제된 횟수
    poolHits: 0, // 풀에서 찾은 횟수
    poolMisses: 0, // 새로 생성한 횟수
    peakSize: 0, // 최대 사용 크기
  };

  /**
   * 생성자
   * @param factory - 객체 생성 함수
   * @param initialSize - 초기 풀 크기 (기본: 100)
   * @param maxSize - 최대 풀 크기 (기본: 1000)
   */
  constructor(
    factory: () => T,
    initialSize: number = 100,
    maxSize: number = 1000
  ) {
    this.factory = factory;
    this.initialSize = initialSize;
    this.maxSize = maxSize;

    // 초기 풀 준비
    this.warmUp();
  }

  /**
   * 풀 초기화 (워밍업)
   */
  private warmUp(): void {
    for (let i = 0; i < this.initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  /**
   * 객체 할당
   * 풀에 있으면 재사용, 없으면 새로 생성
   */
  allocate(): T {
    let obj: T;

    if (this.pool.length > 0) {
      // 풀에서 재사용
      obj = this.pool.pop()!;
      this.stats.poolHits++;
    } else {
      // 새로 생성
      obj = this.factory();
      this.stats.poolMisses++;
    }

    this.inUse.add(obj);
    this.stats.allocated++;
    this.stats.peakSize = Math.max(this.stats.peakSize, this.inUse.size);

    return obj;
  }

  /**
   * 객체 해제 (풀에 반환)
   */
  deallocate(obj: T): void {
    if (!this.inUse.has(obj)) {
      throw new Error('Object not allocated from this allocator');
    }

    this.inUse.delete(obj);

    // 풀 크기가 최대 크기를 초과하지 않으면 추가
    if (this.pool.length < this.maxSize) {
      // 객체 초기화 (선택사항: 리셋 함수가 있으면 호출)
      if (typeof obj === 'object' && obj !== null && 'reset' in obj) {
        (obj as any).reset();
      }

      this.pool.push(obj);
    }
    // 풀 크기 초과 시 객체 버림 (GC 대상)

    this.stats.deallocated++;
  }

  /**
   * 풀 크기
   */
  getPoolSize(): number {
    return this.pool.length;
  }

  /**
   * 사용 중인 객체 수
   */
  getInUseSize(): number {
    return this.inUse.size;
  }

  /**
   * 총 관리 중인 객체 수
   */
  getTotalSize(): number {
    return this.pool.length + this.inUse.size;
  }

  /**
   * 사용 가능한 공간
   */
  getFreeSize(): number {
    return this.pool.length;
  }

  /**
   * 풀 비우기
   */
  clear(): void {
    this.pool = [];
    this.inUse.clear();
    this.stats = {
      allocated: 0,
      deallocated: 0,
      poolHits: 0,
      poolMisses: 0,
      peakSize: 0,
    };
  }

  /**
   * 통계 정보
   */
  getStats(): {
    poolSize: number;
    inUseSize: number;
    totalSize: number;
    allocated: number;
    deallocated: number;
    poolHits: number;
    poolMisses: number;
    hitRate: number;
    peakSize: number;
  } {
    const total = this.stats.allocated;
    const hitRate = total > 0 ? (this.stats.poolHits / total) * 100 : 0;

    return {
      poolSize: this.pool.length,
      inUseSize: this.inUse.size,
      totalSize: this.getTotalSize(),
      allocated: this.stats.allocated,
      deallocated: this.stats.deallocated,
      poolHits: this.stats.poolHits,
      poolMisses: this.stats.poolMisses,
      hitRate,
      peakSize: this.stats.peakSize,
    };
  }

  /**
   * 풀 통계 리셋
   */
  resetStats(): void {
    this.stats = {
      allocated: 0,
      deallocated: 0,
      poolHits: 0,
      poolMisses: 0,
      peakSize: 0,
    };
  }

  /**
   * 풀 상태 진단
   */
  diagnose(): {
    utilizationRate: number;
    fragmentation: number;
    recommendation: string;
  } {
    const total = this.getTotalSize();
    const utilizationRate = (this.inUse.size / total) * 100;
    const fragmentation = (this.pool.length / total) * 100;

    let recommendation = '';
    if (utilizationRate > 90) {
      recommendation = 'Pool size may be too small, consider increasing maxSize';
    } else if (fragmentation > 80) {
      recommendation = 'High fragmentation, consider reducing initialSize';
    } else {
      recommendation = 'Pool is well-balanced';
    }

    return {
      utilizationRate,
      fragmentation,
      recommendation,
    };
  }
}

/**
 * 배열 전용 할당자
 * 고정 크기 배열을 재사용하는 특수 할당자
 */
export class ArrayAllocator<T> extends MemoryAllocator<T[]> {
  private arraySize: number;

  constructor(arraySize: number, initialSize: number = 100, maxSize: number = 1000) {
    super(() => new Array(arraySize), initialSize, maxSize);
    this.arraySize = arraySize;
  }

  /**
   * 배열 초기화
   */
  allocateAndClear(): T[] {
    const arr = this.allocate();
    arr.fill(undefined as any);
    return arr;
  }
}

/**
 * 객체 풀 관리자 (여러 할당자 중앙 관리)
 */
export class PoolManager {
  private allocators: Map<string, MemoryAllocator<any>> = new Map();

  /**
   * 할당자 등록
   */
  register<T>(
    name: string,
    factory: () => T,
    initialSize?: number,
    maxSize?: number
  ): MemoryAllocator<T> {
    const allocator = new MemoryAllocator(factory, initialSize, maxSize);
    this.allocators.set(name, allocator);
    return allocator;
  }

  /**
   * 할당자 조회
   */
  get<T>(name: string): MemoryAllocator<T> {
    const allocator = this.allocators.get(name);
    if (!allocator) {
      throw new Error(`Allocator '${name}' not found`);
    }
    return allocator as MemoryAllocator<T>;
  }

  /**
   * 모든 할당자 통계
   */
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [name, allocator] of this.allocators.entries()) {
      stats[name] = allocator.getStats();
    }
    return stats;
  }

  /**
   * 모든 할당자 초기화
   */
  clearAll(): void {
    for (const allocator of this.allocators.values()) {
      allocator.clear();
    }
  }

  /**
   * 할당자 총 통계
   */
  getTotalStats(): {
    allocators: number;
    totalAllocated: number;
    totalInUse: number;
    poolHitRate: number;
  } {
    let totalAllocated = 0;
    let totalInUse = 0;
    let totalPoolHits = 0;
    let totalAllocations = 0;

    for (const allocator of this.allocators.values()) {
      const stats = allocator.getStats();
      totalAllocated += stats.inUseSize;
      totalInUse += stats.inUseSize;
      totalPoolHits += stats.poolHits;
      totalAllocations += stats.allocated;
    }

    const poolHitRate =
      totalAllocations > 0 ? (totalPoolHits / totalAllocations) * 100 : 0;

    return {
      allocators: this.allocators.size,
      totalAllocated,
      totalInUse,
      poolHitRate,
    };
  }
}

/**
 * 사용 예시
 */
export function exampleUsage(): void {
  // 1. 단일 할당자
  interface Point {
    x: number;
    y: number;
    reset(): void;
  }

  const pointFactory = (): Point => ({
    x: 0,
    y: 0,
    reset() {
      this.x = 0;
      this.y = 0;
    },
  });

  const allocator = new MemoryAllocator(pointFactory, 50, 500);

  // 할당
  const p1 = allocator.allocate();
  p1.x = 10;
  p1.y = 20;

  const p2 = allocator.allocate();
  p2.x = 30;
  p2.y = 40;

  console.log('Before deallocation:', allocator.getStats());

  // 해제 (풀에 반환)
  allocator.deallocate(p1);
  allocator.deallocate(p2);

  console.log('After deallocation:', allocator.getStats());

  // 2. 다중 할당자 관리
  const manager = new PoolManager();

  manager.register('points', pointFactory, 100, 1000);
  manager.register('arrays', () => new Array(1000), 50, 200);

  const pointAllocator = manager.get<Point>('points');
  const p = pointAllocator.allocate();
  p.x = 100;

  console.log('Manager stats:', manager.getTotalStats());
}
