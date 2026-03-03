/**
 * Phase 14-2: SIMD 코드 생성 엔진
 *
 * 목적: 벡터화 가능한 루프 → SSE/AVX 명령어 생성
 *
 * 지원:
 * - SSE: 128비트 (4× float32, 2× float64)
 * - AVX: 256비트 (8× float32, 4× float64)
 *
 * 예:
 * Input:  for i in 0..n: result[i] = a[i] + b[i]
 * Output: SIMD-optimized C code with __m256 intrinsics
 */

export interface SIMDCode {
  header: string[];           // #include <immintrin.h> 등
  setup: string;              // 벡터 초기화 코드
  loop: string;               // SIMD 루프 본체
  cleanup: string;            // 남은 요소 처리
  metadata: SIMDMetadata;
}

export interface SIMDMetadata {
  strategy: 'SSE' | 'AVX';
  elementType: 'f32' | 'f64' | 'i32' | 'i64';
  vectorWidth: number;        // 4 (SSE) or 8 (AVX)
  unrollFactor: number;
  estimatedSpeedup: number;
  instructionCount: number;
}

export class SIMDEmitter {
  /**
   * SIMD 코드 생성
   *
   * 입력: 루프 본체, 배열명, 연산 타입
   * 출력: SSE/AVX 최적화 C 코드
   */
  static generateSIMDCode(
    loopBody: string,
    arrayName: string,
    loopVar: string,
    strategy: 'SSE' | 'AVX' = 'AVX',
    elementType: 'f32' | 'f64' = 'f32'
  ): SIMDCode {
    const vectorWidth = this.getVectorWidth(strategy, elementType);
    const intrinsicType = this.getIntrinsicType(strategy, elementType);

    // 1. 헤더 생성
    const header = this.generateHeaders(strategy);

    // 2. 벡터 초기화
    const setup = this.generateSetup(arrayName, intrinsicType, strategy);

    // 3. SIMD 루프 생성
    const loop = this.generateVectorLoop(
      loopBody,
      arrayName,
      intrinsicType,
      strategy,
      elementType
    );

    // 4. 정리 코드 (스칼라 처리)
    const cleanup = this.generateCleanup(loopBody, arrayName, loopVar);

    // 5. 메타데이터
    const metadata: SIMDMetadata = {
      strategy,
      elementType,
      vectorWidth,
      unrollFactor: vectorWidth,
      estimatedSpeedup: this.estimateSpeedup(strategy),
      instructionCount: this.countInstructions(loop),
    };

    return { header, setup, loop, cleanup, metadata };
  }

  /**
   * 헤더 생성
   */
  private static generateHeaders(strategy: 'SSE' | 'AVX'): string[] {
    const headers = ['#include <immintrin.h>'];

    if (strategy === 'SSE') {
      headers.push('#include <xmmintrin.h>');  // SSE
      headers.push('#include <emmintrin.h>');  // SSE2
    } else if (strategy === 'AVX') {
      headers.push('#include <avxintrin.h>');  // AVX
    }

    return headers;
  }

  /**
   * 벡터 초기화 코드
   *
   * 예:
   * __m256 v_a, v_b, v_result;
   * float* pa = (float*)a;
   */
  private static generateSetup(
    arrayName: string,
    intrinsicType: string,
    strategy: 'SSE' | 'AVX'
  ): string {
    const code: string[] = [];

    code.push(`// SIMD Setup (${strategy})`);
    code.push(`${intrinsicType} v_a, v_b, v_result;`);
    code.push(`${intrinsicType} v_sum = _mm${strategy === 'AVX' ? '256' : ''}_setzero_ps();`);
    code.push('');
    code.push(`// Pointer alignment check`);
    code.push(`if ((uintptr_t)${arrayName} % 32 != 0) {`);
    code.push(`  // Handle unaligned case`);
    code.push(`}`);
    code.push('');

    return code.join('\n');
  }

  /**
   * 벡터 루프 생성
   *
   * 예:
   * for (int i = 0; i < n - 7; i += 8) {
   *   v_a = _mm256_loadu_ps(&a[i]);
   *   v_b = _mm256_loadu_ps(&b[i]);
   *   v_result = _mm256_add_ps(v_a, v_b);
   *   _mm256_storeu_ps(&result[i], v_result);
   * }
   */
  private static generateVectorLoop(
    loopBody: string,
    arrayName: string,
    intrinsicType: string,
    strategy: 'SSE' | 'AVX',
    elementType: 'f32' | 'f64'
  ): string {
    const code: string[] = [];
    const vectorWidth = this.getVectorWidth(strategy, elementType);
    const mmWidth = strategy === 'AVX' ? '256' : '128';
    const suffix = elementType === 'f32' ? 'ps' : 'pd';

    code.push(`// SIMD Vector Loop`);
    code.push(`int n_vectors = (n / ${vectorWidth});`);
    code.push(`for (int i = 0; i < n_vectors * ${vectorWidth}; i += ${vectorWidth}) {`);
    code.push('');

    // 1. 벡터 로드
    code.push(`  // Load vectors`);
    code.push(`  ${intrinsicType} v_a = _mm${mmWidth}_loadu_${suffix}((${elementType}*)&a[i]);`);
    code.push(`  ${intrinsicType} v_b = _mm${mmWidth}_loadu_${suffix}((${elementType}*)&b[i]);`);
    code.push('');

    // 2. 벡터 연산
    code.push(`  // Vector operation`);
    const operation = this.extractOperation(loopBody);
    const instruction = this.getIntrinsic(operation, strategy, suffix);
    code.push(`  ${intrinsicType} v_result = ${instruction}(v_a, v_b);`);
    code.push('');

    // 3. 벡터 저장
    code.push(`  // Store result`);
    code.push(`  _mm${mmWidth}_storeu_${suffix}((${elementType}*)&result[i], v_result);`);
    code.push('}');
    code.push('');

    return code.join('\n');
  }

  /**
   * 정리 코드 (스칼라 처리)
   *
   * SIMD는 vectorWidth 배수만 처리하므로,
   * 남은 요소는 일반 루프로 처리
   */
  private static generateCleanup(
    loopBody: string,
    arrayName: string,
    loopVar: string
  ): string {
    const code: string[] = [];

    code.push(`// Scalar cleanup for remaining elements`);
    code.push(`int remainder = n % vectorWidth;`);
    code.push(`for (int i = n - remainder; i < n; i++) {`);
    code.push(`  // Original scalar code`);
    code.push(`  ${loopBody.replace(new RegExp(`\\[${loopVar}\\]`, 'g'), '[i]')}`);
    code.push('}');
    code.push('');

    return code.join('\n');
  }

  /**
   * 연산 추출
   *
   * a + b → '+'
   * a * b → '*'
   * a - b → '-'
   */
  private static extractOperation(loopBody: string): '+' | '-' | '*' | '/' {
    if (loopBody.includes('*')) return '*';
    if (loopBody.includes('/')) return '/';
    if (loopBody.includes('+')) return '+';
    if (loopBody.includes('-')) return '-';
    return '+'; // default
  }

  /**
   * SIMD 내장 함수 선택
   *
   * 예:
   * AVX, float32, '+' → _mm256_add_ps
   * SSE, float32, '*' → _mm_mul_ps
   */
  private static getIntrinsic(
    operation: '+' | '-' | '*' | '/',
    strategy: 'SSE' | 'AVX',
    suffix: string
  ): string {
    const mmWidth = strategy === 'AVX' ? '256' : '';

    switch (operation) {
      case '+':
        return `_mm${mmWidth}_add_${suffix}`;
      case '-':
        return `_mm${mmWidth}_sub_${suffix}`;
      case '*':
        return `_mm${mmWidth}_mul_${suffix}`;
      case '/':
        return `_mm${mmWidth}_div_${suffix}`;
      default:
        return `_mm${mmWidth}_add_${suffix}`;
    }
  }

  /**
   * Intrinsic 타입 선택
   *
   * AVX, f32 → __m256
   * SSE, f32 → __m128
   * AVX, f64 → __m256d
   */
  private static getIntrinsicType(
    strategy: 'SSE' | 'AVX',
    elementType: 'f32' | 'f64'
  ): string {
    if (strategy === 'AVX') {
      return elementType === 'f32' ? '__m256' : '__m256d';
    } else {
      return elementType === 'f32' ? '__m128' : '__m128d';
    }
  }

  /**
   * 벡터 폭 계산
   *
   * SSE, f32: 128비트 / 32비트 = 4개
   * AVX, f32: 256비트 / 32비트 = 8개
   * AVX, f64: 256비트 / 64비트 = 4개
   */
  private static getVectorWidth(strategy: 'SSE' | 'AVX', elementType: 'f32' | 'f64'): number {
    const bits = strategy === 'AVX' ? 256 : 128;
    const elementBits = elementType === 'f32' ? 32 : 64;
    return bits / elementBits;
  }

  /**
   * 성능 향상 예측
   */
  private static estimateSpeedup(strategy: 'SSE' | 'AVX'): number {
    return strategy === 'AVX' ? 8 : 4;
  }

  /**
   * 명령어 수 계산 (코드 복잡도)
   */
  private static countInstructions(code: string): number {
    // 간단한 휴리스틱: _mm 함수 호출 개수
    const matches = code.match(/_mm\w+_\w+/g);
    return matches ? matches.length : 0;
  }

  /**
   * 완전한 C 래퍼 함수 생성
   *
   * int vector_add(float* a, float* b, float* result, int n) {
   *   // SIMD code here
   * }
   */
  static generateCWrapper(
    functionName: string,
    simdCode: SIMDCode,
    elementType: 'f32' | 'f64' = 'f32'
  ): string {
    const code: string[] = [];
    const cType = elementType === 'f32' ? 'float' : 'double';

    // 1. 헤더
    code.push(...simdCode.header);
    code.push('');

    // 2. 함수 정의
    code.push(`int ${functionName}(${cType}* a, ${cType}* b, ${cType}* result, int n) {`);
    code.push('  if (n <= 0 || !a || !b || !result) return -1;');
    code.push('');

    // 3. 벡터폭 정의
    const vectorWidth = simdCode.metadata.vectorWidth;
    code.push(`  int vectorWidth = ${vectorWidth};`);
    code.push('');

    // 4. 설정
    code.push(simdCode.setup.split('\n').map(line => '  ' + line).join('\n'));
    code.push('');

    // 5. SIMD 루프
    code.push(simdCode.loop.split('\n').map(line => '  ' + line).join('\n'));
    code.push('');

    // 6. 정리
    code.push(simdCode.cleanup.split('\n').map(line => '  ' + line).join('\n'));
    code.push('');

    // 7. 반환
    code.push('  return 0;  // Success');
    code.push('}');
    code.push('');

    return code.join('\n');
  }

  /**
   * 성능 메트릭 생성
   */
  static generateMetrics(simdCode: SIMDCode): {
    speedup: string;
    parallelism: number;
    memoryBandwidth: string;
  } {
    return {
      speedup: `${simdCode.metadata.estimatedSpeedup}×`,
      parallelism: simdCode.metadata.vectorWidth,
      memoryBandwidth: `${simdCode.metadata.vectorWidth * (simdCode.metadata.elementType === 'f32' ? 4 : 8)} bytes/cycle`,
    };
  }

  /**
   * 최적화 옵션 적용
   */
  static applyOptimizations(code: SIMDCode, options: {
    useAlignment?: boolean;
    unroll?: number;
    prefetch?: boolean;
  }): SIMDCode {
    const optimized = { ...code };

    if (options.useAlignment) {
      optimized.setup = this.addAlignmentCode(optimized.setup);
    }

    if (options.unroll && options.unroll > 1) {
      optimized.loop = this.unrollLoop(optimized.loop, options.unroll);
    }

    if (options.prefetch) {
      optimized.loop = this.addPrefetch(optimized.loop);
    }

    return optimized;
  }

  /**
   * 메모리 정렬 코드 추가
   */
  private static addAlignmentCode(setup: string): string {
    const alignment = `
  // Ensure 32-byte alignment
  const size_t alignment = 32;
  size_t offset = (alignment - (uintptr_t)a % alignment) % alignment;
    `;
    return setup + alignment;
  }

  /**
   * 루프 언롤
   */
  private static unrollLoop(loop: string, factor: number): string {
    // 간단한 언롤 (factor배만큼 명령어 반복)
    let unrolled = loop;
    for (let i = 1; i < factor; i++) {
      unrolled += `
  // Unroll iteration ${i}
  v_a = _mm256_loadu_ps((float*)&a[i]);
  v_b = _mm256_loadu_ps((float*)&b[i]);
  v_result = _mm256_add_ps(v_a, v_b);
  _mm256_storeu_ps((float*)&result[i], v_result);
      `;
    }
    return unrolled;
  }

  /**
   * 프리페치 추가
   */
  private static addPrefetch(loop: string): string {
    const prefetch = `
  // Hardware prefetch
  _mm_prefetch((char*)&a[i + 16], _MM_HINT_T0);
  _mm_prefetch((char*)&b[i + 16], _MM_HINT_T0);
    `;
    return loop.replace('for (int i', `for (int i`) + prefetch;
  }
}
