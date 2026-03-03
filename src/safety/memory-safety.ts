/**
 * FreeLang Memory Safety Module
 *
 * Use-after-free, 이중 해제, 버퍼 오버플로우 방지
 * 런타임 검사 기반 메모리 안전성 보장
 */

/**
 * 안전 참조 (Safe Reference)
 * 포인터 대신 사용되는 구조체
 */
export interface SafeRef {
  id: number;
  size: number;
  isFreed: boolean;
  accessCount: number;
  createdAt: number;
}

/**
 * 메모리 접근 타입
 */
export enum AccessType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
}

/**
 * 메모리 안전 위반 정보
 */
export interface MemorySafetyViolation {
  type: 'use_after_free' | 'double_release' | 'buffer_overflow' | 'null_deref';
  refId: number;
  message: string;
  timestamp: number;
}

/**
 * 수명 추적기 (Lifetime Tracker)
 * 객체 할당, 해제, 접근을 추적
 */
export class LifetimeTracker {
  private refs: Map<number, SafeRef> = new Map();
  private nextId: number = 1;
  private violations: MemorySafetyViolation[] = [];

  /**
   * 메모리 할당
   */
  allocate(size: number): SafeRef {
    const ref: SafeRef = {
      id: this.nextId,
      size,
      isFreed: false,
      accessCount: 0,
      createdAt: Date.now(),
    };

    this.refs.set(this.nextId, ref);
    this.nextId++;

    return ref;
  }

  /**
   * 명시적 메모리 해제
   */
  release(ref: SafeRef): void {
    const stored = this.refs.get(ref.id);

    if (!stored) {
      // 할당되지 않은 참조 해제 시도
      this.recordViolation({
        type: 'double_release',
        refId: ref.id,
        message: `Attempted to release unallocated reference ${ref.id}`,
        timestamp: Date.now(),
      });
      return;
    }

    if (stored.isFreed) {
      // 이중 해제
      this.recordViolation({
        type: 'double_release',
        refId: ref.id,
        message: `Attempted to double-release reference ${ref.id}`,
        timestamp: Date.now(),
      });
      return;
    }

    stored.isFreed = true;
  }

  /**
   * 경계 검사
   */
  checkBounds(ref: SafeRef, offset: number): boolean {
    if (offset < 0 || offset >= ref.size) {
      this.recordViolation({
        type: 'buffer_overflow',
        refId: ref.id,
        message: `Buffer overflow: accessing offset ${offset} in ${ref.size}-byte buffer`,
        timestamp: Date.now(),
      });
      return false;
    }

    return true;
  }

  /**
   * 안전 위반 기록
   */
  private recordViolation(violation: MemorySafetyViolation): void {
    this.violations.push(violation);
  }

  /**
   * 위반 기록 조회
   */
  getViolations(): MemorySafetyViolation[] {
    return this.violations;
  }

  /**
   * 참조 조회
   */
  getRef(id: number): SafeRef | undefined {
    return this.refs.get(id);
  }

  /**
   * 전체 참조 목록
   */
  getAllRefs(): SafeRef[] {
    return Array.from(this.refs.values());
  }
}

/**
 * 런타임 메모리 안전 검사기
 */
export class SafetyChecker {
  private tracker: LifetimeTracker;

  constructor(tracker: LifetimeTracker) {
    this.tracker = tracker;
  }

  /**
   * Null 역참조 검사
   */
  checkNullDeref(ref: SafeRef | null): void {
    if (ref === null) {
      throw new Error('Null pointer dereference');
    }
  }

  /**
   * 경계 검사
   */
  checkBounds(ref: SafeRef, index: number): void {
    if (!this.tracker.checkBounds(ref, index)) {
      throw new Error(
        `Buffer overflow: index ${index} out of bounds (size: ${ref.size})`
      );
    }
  }

  /**
   * Use-after-free 검사
   */
  checkUseAfterFree(ref: SafeRef, access: AccessType): void {
    const stored = this.tracker.getRef(ref.id);

    if (!stored) {
      throw new Error(`Use-after-free: reference ${ref.id} was already freed`);
    }

    if (stored.isFreed) {
      throw new Error(`Use-after-free: attempting ${access} on freed reference`);
    }

    stored.accessCount++;
  }

  /**
   * 이중 해제 검사
   */
  checkDoubleRelease(ref: SafeRef): void {
    const stored = this.tracker.getRef(ref.id);

    if (stored && stored.isFreed) {
      throw new Error(`Double-release: reference ${ref.id} already freed`);
    }
  }

  /**
   * 모든 검사 수행
   */
  validate(ref: SafeRef, index: number, access: AccessType): void {
    this.checkNullDeref(ref);
    this.checkUseAfterFree(ref, access);
    this.checkBounds(ref, index);
  }
}

/**
 * 메모리 안전성 모니터
 * 컴파일 시점에서 경고 생성
 */
export class MemorySafetyMonitor {
  /**
   * 잠재적 문제 탐지
   * - 초기화 없이 사용
   * - 범위 초과 접근
   */
  detectPotentialIssues(code: string[]): string[] {
    const warnings: string[] = [];

    // 간단한 패턴 매칭 (실제 구현은 AST 분석 필요)
    for (let i = 0; i < code.length; i++) {
      const line = code[i];

      // 패턴: 미초기화 변수 접근
      if (line.match(/\[.*\]/) && !line.includes('let')) {
        warnings.push(
          `Line ${i + 1}: Potential uninitialized array access: ${line}`
        );
      }

      // 패턴: 고정 인덱스 접근 (범위 초과 가능)
      const arrayAccess = line.match(/arr\[(\d+)\]/);
      if (arrayAccess) {
        const index = parseInt(arrayAccess[1], 10);
        if (index > 1000) {
          warnings.push(
            `Line ${i + 1}: Potential buffer overflow at index ${index}`
          );
        }
      }
    }

    return warnings;
  }
}

/**
 * 메모리 통계
 */
export interface MemoryStats {
  allocatedCount: number;
  freedCount: number;
  activeCount: number;
  totalBytesAllocated: number;
  totalBytesFreed: number;
  violationCount: number;
}

/**
 * 메모리 안전성 시스템 (통합)
 */
export class MemorySafetySystem {
  private tracker: LifetimeTracker;
  private checker: SafetyChecker;
  private monitor: MemorySafetyMonitor;

  constructor() {
    this.tracker = new LifetimeTracker();
    this.checker = new SafetyChecker(this.tracker);
    this.monitor = new MemorySafetyMonitor();
  }

  /**
   * 메모리 할당
   */
  allocate(size: number): SafeRef {
    return this.tracker.allocate(size);
  }

  /**
   * 메모리 해제
   */
  release(ref: SafeRef): void {
    this.checker.checkDoubleRelease(ref);
    this.tracker.release(ref);
  }

  /**
   * 메모리 접근
   */
  access(ref: SafeRef, offset: number, type: AccessType): void {
    this.checker.validate(ref, offset, type);
  }

  /**
   * 통계 조회
   */
  getStats(): MemoryStats {
    const refs = this.tracker.getAllRefs();

    return {
      allocatedCount: refs.length,
      freedCount: refs.filter(r => r.isFreed).length,
      activeCount: refs.filter(r => !r.isFreed).length,
      totalBytesAllocated: refs.reduce((sum, r) => sum + r.size, 0),
      totalBytesFreed: refs
        .filter(r => r.isFreed)
        .reduce((sum, r) => sum + r.size, 0),
      violationCount: this.tracker.getViolations().length,
    };
  }

  /**
   * 위반 조회
   */
  getViolations(): MemorySafetyViolation[] {
    return this.tracker.getViolations();
  }

  /**
   * 코드 정적 분석
   */
  analyzeCode(code: string[]): string[] {
    return this.monitor.detectPotentialIssues(code);
  }
}
