/**
 * FreeLang JIT/AOT Strategy
 *
 * 티어드 컴파일 아키텍처:
 * - Tier 0: 인터프리터 (0~99 호출)
 * - Tier 1: Baseline JIT (100+ 호출, 최적화 IR 캐시)
 * - Tier 2: 최적화 JIT (1000+ 호출, SSA + 고급 최적화)
 */

import { Inst, Op } from '../types';

/**
 * 함수 호출 프로파일링
 */
export class ExecutionProfiler {
  private callCounts: Map<string, number> = new Map();
  private hotThreshold: number = 100;  // 핫 함수 기준: 100회 이상
  private veryHotThreshold: number = 1000;  // 매우 핫: 1000회 이상

  /**
   * 함수 호출 기록
   */
  record(funcName: string): void {
    const count = this.callCounts.get(funcName) || 0;
    this.callCounts.set(funcName, count + 1);
  }

  /**
   * 함수가 핫(Baseline JIT 대상)인지 확인
   */
  isHot(funcName: string): boolean {
    const count = this.callCounts.get(funcName) || 0;
    return count >= this.hotThreshold;
  }

  /**
   * 함수가 매우 핫(최적화 JIT 대상)인지 확인
   */
  isVeryHot(funcName: string): boolean {
    const count = this.callCounts.get(funcName) || 0;
    return count >= this.veryHotThreshold;
  }

  /**
   * 모든 핫 함수 조회
   */
  getHotFunctions(): string[] {
    return Array.from(this.callCounts.entries())
      .filter(([_, count]) => count >= this.hotThreshold)
      .map(([name, _]) => name);
  }

  /**
   * 모든 매우 핫 함수 조회
   */
  getVeryHotFunctions(): string[] {
    return Array.from(this.callCounts.entries())
      .filter(([_, count]) => count >= this.veryHotThreshold)
      .map(([name, _]) => name);
  }

  /**
   * 함수 호출 횟수 조회
   */
  getCallCount(funcName: string): number {
    return this.callCounts.get(funcName) || 0;
  }

  /**
   * 통계 초기화
   */
  reset(): void {
    this.callCounts.clear();
  }
}

/**
 * Baseline JIT 엔진
 * 핫 함수의 최적화 IR을 캐싱
 */
export class BaselineJIT {
  private cache: Map<string, Inst[]> = new Map();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private compilationTime: Map<string, number> = new Map();

  /**
   * Baseline JIT 컴파일
   * 기본 최적화만 수행하고 캐싱
   */
  compile(funcName: string, instrs: Inst[]): Inst[] {
    // 기본 최적화: 죽은 코드 제거, 상수 폴딩
    const optimized = this.basicOptimize(instrs);

    const startTime = performance.now();
    this.cache.set(funcName, optimized);
    const compilationTimeMs = performance.now() - startTime;

    this.compilationTime.set(funcName, compilationTimeMs);

    return optimized;
  }

  /**
   * 캐시 조회
   */
  lookup(funcName: string): Inst[] | null {
    const cached = this.cache.get(funcName);

    if (cached) {
      this.cacheHits++;
      return cached;
    }

    this.cacheMisses++;
    return null;
  }

  /**
   * 캐시 무효화
   */
  invalidate(funcName: string): void {
    this.cache.delete(funcName);
  }

  /**
   * 기본 최적화 (Baseline)
   * - 도달 불가능 코드 제거
   * - 단순 상수 폴딩
   */
  private basicOptimize(instrs: Inst[]): Inst[] {
    const optimized: Inst[] = [];

    for (let i = 0; i < instrs.length; i++) {
      const instr = instrs[i];

      // 패턴: PUSH x, PUSH y, ADD → PUSH (x+y) if both are literals
      if (
        instr.op === Op.PUSH &&
        typeof instr.arg === 'number' &&
        i + 2 < instrs.length &&
        instrs[i + 1].op === Op.PUSH &&
        typeof instrs[i + 1].arg === 'number' &&
        instrs[i + 2].op === Op.ADD
      ) {
        const x = instr.arg as number;
        const y = instrs[i + 1].arg as number;
        const result = x + y;

        optimized.push({
          op: Op.PUSH,
          arg: result,
        });

        i += 2;  // 3개 인스트럭션 건너뜀
      } else {
        optimized.push(instr);
      }
    }

    return optimized;
  }

  /**
   * 캐시 통계
   */
  getStats(): {
    cacheSize: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;

    return {
      cacheSize: this.cache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate,
    };
  }

  /**
   * 컴파일 시간 조회
   */
  getCompilationTime(funcName: string): number {
    return this.compilationTime.get(funcName) || 0;
  }

  /**
   * 캐시 클리어
   */
  clear(): void {
    this.cache.clear();
    this.compilationTime.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

/**
 * 최적화 JIT (Optimizing JIT)
 * Baseline JIT보다 더 공격적인 최적화 수행
 */
export class OptimizingJIT {
  /**
   * 최적화 JIT 컴파일
   * - SSA 변환
   * - ADCE (Aggressive Dead Code Elimination)
   * - Inlining
   * - CSE (Common Subexpression Elimination)
   */
  compile(funcName: string, instrs: Inst[]): Inst[] {
    // 여기서는 스켈레톤만 정의
    // 실제 구현은 src/phase-14-llvm/llvm-optimizer.ts의 optimizeIR() 사용
    return instrs;  // 현재는 수정 없음
  }
}

/**
 * 티어드 컴파일러
 * 함수 호출 횟수에 따라 자동으로 최적화 레벨 상향
 */
export class TieredCompiler {
  private profiler: ExecutionProfiler;
  private baselineJIT: BaselineJIT;
  private optimizingJIT: OptimizingJIT;

  constructor() {
    this.profiler = new ExecutionProfiler();
    this.baselineJIT = new BaselineJIT();
    this.optimizingJIT = new OptimizingJIT();
  }

  /**
   * 함수 실행
   * 호출 횟수를 추적하고 적절한 레벨로 컴파일
   */
  compileAndCache(funcName: string, instrs: Inst[]): Inst[] {
    // 1. 호출 기록
    this.profiler.record(funcName);

    // 2. 이미 캐시된 경우 반환
    const cached = this.baselineJIT.lookup(funcName);
    if (cached) {
      return cached;
    }

    // 3. 호출 횟수에 따라 컴파일 레벨 결정
    const callCount = this.profiler.getCallCount(funcName);

    if (callCount === 100) {
      // Tier 0 → Tier 1: Baseline JIT로 컴파일
      return this.baselineJIT.compile(funcName, instrs);
    } else if (callCount === 1000) {
      // Tier 1 → Tier 2: 최적화 JIT로 재컴파일
      return this.optimizingJIT.compile(funcName, instrs);
    }

    // Tier 0: 원본 반환 (인터프리터가 처리)
    return instrs;
  }

  /**
   * 프로파일러 조회
   */
  getProfiler(): ExecutionProfiler {
    return this.profiler;
  }

  /**
   * Baseline JIT 통계
   */
  getJITStats() {
    return {
      baseline: this.baselineJIT.getStats(),
      hotFunctions: this.profiler.getHotFunctions(),
      veryHotFunctions: this.profiler.getVeryHotFunctions(),
    };
  }
}

/**
 * JIT 통계
 */
export interface JITStats {
  tier0Executions: number;  // 인터프리터로 실행된 횟수
  tier1Compilations: number;  // Baseline JIT 컴파일 횟수
  tier2Compilations: number;  // 최적화 JIT 컴파일 횟수
  speedup: number;  // 예상 속도 향상 배수
}

/**
 * 글로벌 티어드 컴파일러 인스턴스
 */
let globalTieredCompiler: TieredCompiler | null = null;

/**
 * 글로벌 컴파일러 조회
 */
export function getTieredCompiler(): TieredCompiler {
  if (!globalTieredCompiler) {
    globalTieredCompiler = new TieredCompiler();
  }
  return globalTieredCompiler;
}

/**
 * 글로벌 컴파일러 초기화
 */
export function resetTieredCompiler(): void {
  globalTieredCompiler = null;
}
