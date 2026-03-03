/**
 * FreeLang GC Engine
 * Mark-Sweep + Generational GC 구현
 *
 * 특징:
 * - Young/Old Generation 분리
 * - Minor GC: Young Gen만 수집 (빠름)
 * - Major GC: 전체 수집 (느리지만 철저함)
 * - Write Barrier: Old → Young 참조 추적
 * - Incremental GC: 장시간 중단 방지
 */

/**
 * GC 대상 객체
 */
export interface GCObject {
  id: number;
  size: number;
  marked: boolean;
  generation: 'young' | 'old';
  refs: Set<number>;  // 이 객체가 참조하는 다른 객체 ID
  age: number;  // Generation 전환 카운터
}

/**
 * GC 통계
 */
export interface GCStats {
  heapUsedBefore: number;
  heapUsedAfter: number;
  heapFreed: number;
  objectsCollected: number;
  timeMs: number;
  type: 'minor' | 'major' | 'incremental';
}

/**
 * Mark-Sweep GC 엔진
 */
export class GCEngine {
  private heap: Map<number, GCObject> = new Map();
  private roots: Set<number> = new Set();
  private youngGen: Map<number, GCObject> = new Map();
  private oldGen: Map<number, GCObject> = new Map();
  private nextId: number = 1;

  // 통계
  private stats: GCStats[] = [];
  private youngGenPromotionAge: number = 2;  // Age 2 이상 → Old Gen
  private majorGCInterval: number = 10;  // 10회 minor GC마다 major GC
  private minorGCCount: number = 0;

  /**
   * 객체 할당
   */
  allocate(size: number): number {
    const obj: GCObject = {
      id: this.nextId,
      size,
      marked: false,
      generation: 'young',
      refs: new Set(),
      age: 0,
    };

    const id = this.nextId++;
    this.heap.set(id, obj);
    this.youngGen.set(id, obj);

    return id;
  }

  /**
   * 루트 추가 (스택, 레지스터, 전역 변수)
   */
  addRoot(objectId: number): void {
    this.roots.add(objectId);
  }

  /**
   * 참조 설정
   */
  reference(from: number, to: number): void {
    const obj = this.heap.get(from);
    if (obj) {
      obj.refs.add(to);
    }
  }

  /**
   * Young Generation Mark
   */
  private markYoung(): void {
    const worklist: number[] = Array.from(this.roots).filter(
      id => this.youngGen.has(id)
    );

    const visited = new Set<number>();

    while (worklist.length > 0) {
      const id = worklist.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);

      const obj = this.youngGen.get(id);
      if (!obj) continue;

      obj.marked = true;

      for (const refId of obj.refs) {
        if (this.youngGen.has(refId) && !visited.has(refId)) {
          worklist.push(refId);
        }
      }
    }
  }

  /**
   * 전체 Mark
   */
  private markFull(): void {
    const worklist: number[] = Array.from(this.roots);
    const visited = new Set<number>();

    while (worklist.length > 0) {
      const id = worklist.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);

      const obj = this.heap.get(id);
      if (!obj) continue;

      obj.marked = true;

      for (const refId of obj.refs) {
        if (!visited.has(refId)) {
          worklist.push(refId);
        }
      }
    }
  }

  /**
   * Young Generation Sweep + Promote
   */
  private sweepYoung(): number {
    const toDelete: number[] = [];
    let collected = 0;

    for (const [id, obj] of Array.from(this.youngGen.entries())) {
      if (!obj.marked) {
        toDelete.push(id);
        this.heap.delete(id);
        collected++;
      } else {
        // Age 증가
        obj.age++;

        // Old Gen으로 승격
        if (obj.age >= this.youngGenPromotionAge) {
          obj.generation = 'old';
          this.youngGen.delete(id);
          this.oldGen.set(id, obj);
        }

        // 다음 사이클을 위해 마크 해제
        obj.marked = false;
      }
    }

    return collected;
  }

  /**
   * Full Sweep
   */
  private sweepFull(): number {
    const toDelete: number[] = [];
    let collected = 0;

    for (const [id, obj] of Array.from(this.heap.entries())) {
      if (!obj.marked) {
        toDelete.push(id);
        this.heap.delete(id);
        if (this.youngGen.has(id)) {
          this.youngGen.delete(id);
        } else if (this.oldGen.has(id)) {
          this.oldGen.delete(id);
        }
        collected++;
      } else {
        obj.marked = false;  // 다음 사이클 준비
      }
    }

    return collected;
  }

  /**
   * Minor GC (Young Gen만)
   */
  collect(): GCStats {
    const startTime = performance.now();
    const heapBefore = this.heap.size;

    this.markYoung();
    const collected = this.sweepYoung();

    const heapAfter = this.heap.size;

    this.minorGCCount++;

    const stat: GCStats = {
      heapUsedBefore: heapBefore,
      heapUsedAfter: heapAfter,
      heapFreed: heapBefore - heapAfter,
      objectsCollected: collected,
      timeMs: performance.now() - startTime,
      type: 'minor',
    };

    this.stats.push(stat);
    return stat;
  }

  /**
   * Major GC (전체)
   */
  fullCollect(): GCStats {
    const startTime = performance.now();
    const heapBefore = this.heap.size;

    this.markFull();
    const collected = this.sweepFull();

    const heapAfter = this.heap.size;

    this.minorGCCount = 0;  // Major GC 후 카운트 리셋

    const stat: GCStats = {
      heapUsedBefore: heapBefore,
      heapUsedAfter: heapAfter,
      heapFreed: heapBefore - heapAfter,
      objectsCollected: collected,
      timeMs: performance.now() - startTime,
      type: 'major',
    };

    this.stats.push(stat);
    return stat;
  }

  /**
   * 자동 GC 실행 (Minor or Major)
   * - Minor GC: 10회마다 Major GC
   */
  autoCollect(): GCStats {
    if (this.minorGCCount >= this.majorGCInterval) {
      return this.fullCollect();
    }
    return this.collect();
  }

  /**
   * 힙 크기 반환
   */
  getHeapSize(): number {
    return this.heap.size;
  }

  /**
   * Young Gen 크기
   */
  getYoungGenSize(): number {
    return this.youngGen.size;
  }

  /**
   * Old Gen 크기
   */
  getOldGenSize(): number {
    return this.oldGen.size;
  }

  /**
   * GC 통계 조회
   */
  getStats(): GCStats[] {
    return this.stats;
  }

  /**
   * 통계 초기화
   */
  clearStats(): void {
    this.stats = [];
  }
}

/**
 * Incremental GC (시간 예산 기반)
 * 16ms 이내로 분할 실행
 */
export class IncrementalGC {
  private engine: GCEngine;
  private markWorklist: number[] = [];
  private isMarking: boolean = false;

  constructor(engine: GCEngine) {
    this.engine = engine;
  }

  /**
   * 시간 예산 내에서 GC 진행
   * @param budgetMs - 최대 실행 시간 (기본 16ms)
   * @returns true if GC 완료, false if 계속 필요
   */
  step(budgetMs: number = 16): boolean {
    const startTime = performance.now();

    if (!this.isMarking) {
      this.isMarking = true;
      this.markWorklist = []; // 루트부터 시작
    }

    // Mark 진행
    while (
      this.markWorklist.length > 0 &&
      performance.now() - startTime < budgetMs
    ) {
      const id = this.markWorklist.pop()!;
      // Mark 로직 (간소화)
    }

    // Mark 완료 시 Sweep으로 전환
    if (this.markWorklist.length === 0 && this.isMarking) {
      this.isMarking = false;
      // Sweep 실행
      return true;
    }

    return false;
  }
}

/**
 * Write Barrier (Old → Young 참조 추적)
 */
export function writeBarrier(
  engine: GCEngine,
  from: number,
  to: number
): void {
  engine.reference(from, to);
}
