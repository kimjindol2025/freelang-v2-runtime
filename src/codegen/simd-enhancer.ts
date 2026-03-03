/**
 * Phase 14-3: Vectorization 보강 (Enhancement)
 *
 * 목적: SIMD 성능 최적화
 * - NEON 지원 (ARM 128비트)
 * - 루프 언롤 개선
 * - 메모리 정렬 (Alignment) 자동화
 * - 캐시 프리페칭
 * - 성능 벤치마크 유틸리티
 *
 * LOC: 320 (implementation)
 * Status: Phase 14-3 新建
 */

export type SIMDArchitecture = 'SSE' | 'AVX' | 'AVX512' | 'NEON';

export interface VectorizationConfig {
  architecture: SIMDArchitecture;
  alignment: number;           // 16 (SSE), 32 (AVX), 64 (AVX512), 16 (NEON)
  unrollFactor: number;        // Loop unroll factor
  prefetchDistance: number;    // Cache line prefetch distance
  enablePrefetch: boolean;
  enableAlignment: boolean;
}

export interface LoopOptimization {
  originalCode: string;
  optimizedCode: string;
  memoryAlignment: string;
  loopUnrollFactor: number;
  prefetchCode: string[];
  estimatedSpeedup: number;
}

export interface BenchmarkResult {
  name: string;
  architecture: SIMDArchitecture;
  vectorWidth: number;
  elementCount: number;
  sequentialTime: number;      // ms
  vectorizedTime: number;      // ms
  speedup: number;             // vectorized / sequential
  throughput: number;          // elements/ms
  memoryBandwidth: number;     // GB/s
}

/**
 * SIMD 벡터화 최적화 엔진
 */
export class SIMDEnhancer {
  private config: VectorizationConfig;
  private benchmarks: BenchmarkResult[] = [];

  constructor(config?: Partial<VectorizationConfig>) {
    this.config = {
      architecture: 'AVX',
      alignment: 32,
      unrollFactor: 4,
      prefetchDistance: 8,
      enablePrefetch: true,
      enableAlignment: true,
      ...config,
    };
  }

  /**
   * NEON 코드 생성 (ARM 아키텍처)
   *
   * 예:
   * for (i = 0; i < n; i += 4) {
   *   float32x4_t va = vld1q_f32(&a[i]);
   *   float32x4_t vb = vld1q_f32(&b[i]);
   *   float32x4_t vr = vaddq_f32(va, vb);
   *   vst1q_f32(&result[i], vr);
   * }
   */
  static generateNEONCode(
    loopBody: string,
    arrayNames: string[],
    elementType: 'f32' | 'f64' = 'f32'
  ): string {
    const width = elementType === 'f32' ? 4 : 2;
    const dataType = elementType === 'f32' ? 'float32x4_t' : 'float64x2_t';
    const loadFunc = elementType === 'f32' ? 'vld1q_f32' : 'vld1q_f64';
    const storeFunc = elementType === 'f32' ? 'vst1q_f32' : 'vst1q_f64';

    const arrays = arrayNames.join(', ');
    const loads = arrayNames
      .map((arr) => `  ${dataType} v${arr} = ${loadFunc}(&${arr}[i]);`)
      .join('\n');

    const stores = arrayNames
      .map((arr) => `  ${storeFunc}(&${arr}_out[i], v${arr});`)
      .join('\n');

    return `
// NEON Vectorization (ARM 128-bit)
#include <arm_neon.h>

for (int i = 0; i < n; i += ${width}) {
${loads}
  // Compute: ${loopBody}
${stores}
}
`;
  }

  /**
   * 메모리 정렬 코드 생성
   *
   * 예:
   * float* aligned_a = (float*)aligned_alloc(32, n * sizeof(float));
   * __assume_aligned(result, 32);
   */
  static generateMemoryAlignment(
    arrayNames: string[],
    elementType: 'f32' | 'f64',
    alignment: number
  ): string {
    const elemSize = elementType === 'f32' ? 4 : 8;
    const lines: string[] = [];

    lines.push('// Memory Alignment Configuration');
    lines.push(`#define ALIGNMENT ${alignment}`);
    lines.push(`#define ELEMENT_SIZE ${elemSize}`);
    lines.push('');

    // 정렬된 메모리 할당
    for (const arr of arrayNames) {
      lines.push(
        `float* ${arr}_aligned = (float*)aligned_alloc(ALIGNMENT, n * ELEMENT_SIZE);`
      );
      lines.push(`if (${arr}_aligned == NULL) { /* error handling */ }`);
    }

    lines.push('');
    lines.push('// Compiler directives for alignment');

    for (const arr of arrayNames) {
      lines.push(`#pragma omp simd aligned(${arr}_aligned:ALIGNMENT)`);
    }

    return lines.join('\n');
  }

  /**
   * 루프 언롤 최적화 계산
   *
   * 휴리스틱:
   * - L1 캐시 크기 (32KB) 고려
   * - 레지스터 압박 (8~16개 일반 레지스터)
   * - 명령어 수준 병렬화 (ILP)
   */
  static calculateOptimalUnrollFactor(
    loopBodyInstructions: number,
    vectorWidth: number,
    dataElementSize: number
  ): number {
    // 기본 공식: UF = min(16 / instructions, L1_capacity / (width * size))
    const maxILPUnroll = Math.floor(16 / Math.max(loopBodyInstructions, 1));
    const l1CacheUnroll = Math.floor(32 * 1024 / (vectorWidth * dataElementSize * 4));
    const optimalUF = Math.min(maxILPUnroll, l1CacheUnroll);

    // 2의 거듭제곱으로 반올림 (컴파일러 최적화)
    return Math.pow(2, Math.floor(Math.log2(Math.max(optimalUF, 2))));
  }

  /**
   * 캐시 프리페칭 코드 생성
   *
   * 예:
   * for (i = 0; i < n; i += 8) {
   *   __builtin_prefetch(&a[i + 64], 0, 3);  // prefetch ahead
   *   // compute
   * }
   */
  static generatePrefetchCode(
    arrayNames: string[],
    vectorWidth: number,
    prefetchDistance: number
  ): string[] {
    const prefetchLines: string[] = [];

    for (const arr of arrayNames) {
      const lookAhead = vectorWidth * prefetchDistance;
      const locality = 3; // 0-3, higher = more temporal locality

      prefetchLines.push(
        `__builtin_prefetch(&${arr}[i + ${lookAhead}], 0, ${locality});`
      );
    }

    return prefetchLines;
  }

  /**
   * 최적화된 루프 코드 생성
   */
  optimizeLoop(
    loopBody: string,
    arrayNames: string[],
    elementType: 'f32' | 'f64' = 'f32'
  ): LoopOptimization {
    const vectorWidth = this.getVectorWidth(this.config.architecture, elementType);
    const alignment = this.config.alignment;
    const unrollFactor = this.config.unrollFactor;
    const prefetchDistance = this.config.prefetchDistance;

    // 메모리 정렬
    const memoryAlignment = this.config.enableAlignment
      ? SIMDEnhancer.generateMemoryAlignment(arrayNames, elementType, alignment)
      : '';

    // 루프 언롤
    const unrolledLoop = this.generateUnrolledLoop(
      loopBody,
      arrayNames,
      unrollFactor,
      vectorWidth
    );

    // 프리페치 코드
    const prefetchCode = this.config.enablePrefetch
      ? SIMDEnhancer.generatePrefetchCode(arrayNames, vectorWidth, prefetchDistance)
      : [];

    // 최적화된 코드 조합
    const optimizedCode = this.combineOptimizations(
      unrolledLoop,
      prefetchCode,
      alignment
    );

    // 성능 추정
    const estimatedSpeedup = this.estimateSpeedup(
      this.config.architecture,
      unrollFactor,
      prefetchCode.length > 0
    );

    return {
      originalCode: loopBody,
      optimizedCode,
      memoryAlignment,
      loopUnrollFactor: unrollFactor,
      prefetchCode,
      estimatedSpeedup,
    };
  }

  /**
   * 루프 언롤 코드 생성
   */
  private generateUnrolledLoop(
    loopBody: string,
    _arrayNames: string[],
    unrollFactor: number,
    _vectorWidth: number
  ): string {
    const lines: string[] = [];

    lines.push(`// Loop unrolling factor: ${unrollFactor}`);
    lines.push(`for (int i = 0; i < n; i += ${unrollFactor}) {`);

    for (let j = 0; j < unrollFactor; j++) {
      lines.push(`  // Iteration ${j}`);
      const unrolledBody = loopBody
        .replace(/\bi\b/g, `(i + ${j})`)
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n');

      lines.push(unrolledBody);
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * 최적화 코드 결합
   */
  private combineOptimizations(
    unrolledLoop: string,
    prefetchCode: string[],
    alignment: number
  ): string {
    const lines: string[] = [];

    lines.push(`// Vectorization Enhancement (ALIGNMENT=${alignment})`);
    lines.push('#pragma omp simd');

    if (prefetchCode.length > 0) {
      lines.push('// Prefetch directives:');
      lines.push(...prefetchCode.map((line) => `  ${line}`));
    }

    lines.push('');
    lines.push(unrolledLoop);

    return lines.join('\n');
  }

  /**
   * 아키텍처별 벡터 너비 반환
   */
  private getVectorWidth(
    architecture: SIMDArchitecture,
    elementType: 'f32' | 'f64'
  ): number {
    const map: Record<SIMDArchitecture, Record<string, number>> = {
      SSE: { f32: 4, f64: 2 },
      AVX: { f32: 8, f64: 4 },
      AVX512: { f32: 16, f64: 8 },
      NEON: { f32: 4, f64: 2 },
    };

    return map[architecture]?.[elementType] ?? 4;
  }

  /**
   * 성능 추정 (Speedup 배수)
   */
  private estimateSpeedup(
    architecture: SIMDArchitecture,
    unrollFactor: number,
    withPrefetch: boolean
  ): number {
    const baseSpeedup: Record<SIMDArchitecture, number> = {
      SSE: 4,
      AVX: 8,
      AVX512: 16,
      NEON: 4,
    };

    let speedup = baseSpeedup[architecture];
    speedup *= Math.log2(unrollFactor + 1); // Logarithmic benefit
    if (withPrefetch) speedup *= 1.1; // Prefetch: ~10% benefit

    return speedup;
  }

  /**
   * 벤치마크 결과 기록
   */
  recordBenchmark(result: BenchmarkResult): void {
    this.benchmarks.push(result);
  }

  /**
   * 벤치마크 결과 조회
   */
  getBenchmarks(): BenchmarkResult[] {
    return this.benchmarks;
  }

  /**
   * 벤치마크 통계
   */
  getBenchmarkStats(): {
    avgSpeedup: number;
    maxSpeedup: number;
    minSpeedup: number;
    totalTests: number;
  } {
    if (this.benchmarks.length === 0) {
      return { avgSpeedup: 0, maxSpeedup: 0, minSpeedup: 0, totalTests: 0 };
    }

    const speedups = this.benchmarks.map((b) => b.speedup);
    const avgSpeedup = speedups.reduce((a, b) => a + b, 0) / speedups.length;
    const maxSpeedup = Math.max(...speedups);
    const minSpeedup = Math.min(...speedups);

    return {
      avgSpeedup: Math.round(avgSpeedup * 100) / 100,
      maxSpeedup: Math.round(maxSpeedup * 100) / 100,
      minSpeedup: Math.round(minSpeedup * 100) / 100,
      totalTests: this.benchmarks.length,
    };
  }
}

export default SIMDEnhancer;
