/**
 * FreeLang v2 - C 코드 생성기
 * HeaderProposal → C 함수 코드 생성
 *
 * 각 operation별 템플릿 + Directive에 따른 최적화 적용
 */

import { HeaderProposal } from '../engine/header-generator';
import { SIMDDetector } from './simd-detector';
import { SIMDEmitter } from './simd-emitter';

/**
 * 생성된 C 코드
 */
export interface GeneratedCode {
  operation: string;
  cCode: string;
  includes: string[]; // #include 필요 라이브러리
  dependencies: string[]; // 의존하는 함수들
  memoryProfile: {
    heapUsage: string; // 동적 메모리 사용량
    stackUsage: string; // 스택 메모리 사용량
  };
}

/**
 * C 코드 생성기
 */
export class CGenerator {
  /**
   * HeaderProposal에서 C 함수 생성
   *
   * @param proposal 헤더 제안
   * @returns 생성된 C 코드
   */
  static generateCode(proposal: HeaderProposal): GeneratedCode {
    const { operation, directive, inputType, outputType } = proposal;

    let cCode = '';
    let includes: string[] = [];
    let dependencies: string[] = [];

    // Operation별 코드 생성
    switch (operation) {
      case 'sum':
        const sumResult = this._generateSum(inputType, directive);
        cCode = sumResult.code;
        includes = sumResult.includes;
        break;

      case 'average':
        const avgResult = this._generateAverage(inputType, directive);
        cCode = avgResult.code;
        includes = avgResult.includes;
        break;

      case 'max':
        const maxResult = this._generateMax(inputType, directive);
        cCode = maxResult.code;
        includes = maxResult.includes;
        break;

      case 'min':
        const minResult = this._generateMin(inputType, directive);
        cCode = minResult.code;
        includes = minResult.includes;
        break;

      case 'filter':
        const filterResult = this._generateFilter(inputType, outputType, directive);
        cCode = filterResult.code;
        includes = filterResult.includes;
        dependencies = filterResult.dependencies;
        break;

      case 'sort':
        const sortResult = this._generateSort(inputType, directive);
        cCode = sortResult.code;
        includes = sortResult.includes;
        break;

      default:
        cCode = this._generatePlaceholder(operation);
        includes = [];
    }

    return {
      operation,
      cCode,
      includes: [...new Set(includes)],
      dependencies,
      memoryProfile: this._analyzeMemory(operation, directive),
    };
  }

  /**
   * SIMD 최적화 적용 (Phase 14 통합)
   *
   * @param code 원본 C 코드
   * @param loopBody 루프 본체
   * @param directive 최적화 지시어
   * @returns SIMD 최적화 코드
   */
  static applySimdOptimization(
    code: string,
    loopBody: string,
    directive: string
  ): { code: string; optimized: boolean; speedup: number } {
    // Phase 14: SIMD 감지 및 최적화
    const analysis = SIMDDetector.analyzeLoop(loopBody, 'i');

    if (!analysis.isVectorizable || directive !== 'speed') {
      return { code, optimized: false, speedup: 1 };
    }

    try {
      // SIMD 코드 생성
      if (analysis.simdStrategy === 'none') {
        return { code, optimized: false, speedup: 1 };
      }

      const simdCode = SIMDEmitter.generateSIMDCode(
        loopBody,
        'array',
        'i',
        analysis.simdStrategy as 'SSE' | 'AVX',
        'f32'
      );

      // C 래퍼 생성
      const wrapper = SIMDEmitter.generateCWrapper('vector_simd', simdCode, 'f32');

      // 원본 코드 + SIMD 코드 결합
      const optimizedCode = `// Original code\n${code}\n\n// SIMD-optimized version (Phase 14)\n${wrapper}`;

      return {
        code: optimizedCode,
        optimized: true,
        speedup: analysis.estimatedSpeedup,
      };
    } catch (error) {
      // SIMD 생성 실패 시 원본 코드 반환
      return { code, optimized: false, speedup: 1 };
    }
  }

  /**
   * sum 함수 생성
   * @private
   */
  private static _generateSum(
    inputType: string,
    directive: string
  ): { code: string; includes: string[] } {
    const isMemoryOptimized = directive.includes('메모리 효율성');

    const code = `// 배열의 합 계산
double sum(const double* arr, int size) {
  if (!arr || size <= 0) return 0.0;

  double result = 0.0;
  for (int i = 0; i < size; i++) {
    result += arr[i];
  }
  return result;
}`;

    return {
      code,
      includes: ['<stddef.h>'],
    };
  }

  /**
   * average 함수 생성
   * @private
   */
  private static _generateAverage(
    inputType: string,
    directive: string
  ): { code: string; includes: string[] } {
    const code = `// 배열의 평균값 계산
double average(const double* arr, int size) {
  if (!arr || size <= 0) return 0.0;

  double sum = 0.0;
  for (int i = 0; i < size; i++) {
    sum += arr[i];
  }
  return sum / size;
}`;

    return {
      code,
      includes: ['<stddef.h>'],
    };
  }

  /**
   * max 함수 생성
   * @private
   */
  private static _generateMax(
    inputType: string,
    directive: string
  ): { code: string; includes: string[] } {
    const code = `// 배열의 최댓값 찾기
double max(const double* arr, int size) {
  if (!arr || size <= 0) return 0.0;

  double max_val = arr[0];
  for (int i = 1; i < size; i++) {
    if (arr[i] > max_val) {
      max_val = arr[i];
    }
  }
  return max_val;
}`;

    return {
      code,
      includes: ['<stddef.h>'],
    };
  }

  /**
   * min 함수 생성
   * @private
   */
  private static _generateMin(
    inputType: string,
    directive: string
  ): { code: string; includes: string[] } {
    const code = `// 배열의 최솟값 찾기
double min(const double* arr, int size) {
  if (!arr || size <= 0) return 0.0;

  double min_val = arr[0];
  for (int i = 1; i < size; i++) {
    if (arr[i] < min_val) {
      min_val = arr[i];
    }
  }
  return min_val;
}`;

    return {
      code,
      includes: ['<stddef.h>'],
    };
  }

  /**
   * filter 함수 생성
   * @private
   */
  private static _generateFilter(
    inputType: string,
    outputType: string,
    directive: string
  ): {
    code: string;
    includes: string[];
    dependencies: string[];
  } {
    const code = `// 배열 필터링 (threshold 이상의 값만)
int filter(const double* input, int input_size,
           double* output, double threshold) {
  if (!input || !output || input_size <= 0) return 0;

  int output_size = 0;
  for (int i = 0; i < input_size; i++) {
    if (input[i] >= threshold) {
      output[output_size++] = input[i];
    }
  }
  return output_size;
}`;

    return {
      code,
      includes: ['<stddef.h>'],
      dependencies: [],
    };
  }

  /**
   * sort 함수 생성 (간단한 bubble sort)
   * @private
   */
  private static _generateSort(
    inputType: string,
    directive: string
  ): { code: string; includes: string[] } {
    const isSpeedPriority = directive.includes('속도');

    let code: string;

    if (isSpeedPriority) {
      // Quick sort (더 빠름)
      code = `// 배열 정렬 (qsort 사용)
#include <stdlib.h>

int compare(const void* a, const void* b) {
  double diff = *(double*)a - *(double*)b;
  return (diff > 0) - (diff < 0);
}

void sort(double* arr, int size) {
  if (!arr || size <= 1) return;
  qsort(arr, size, sizeof(double), compare);
}`;
    } else {
      // Bubble sort (안정적, 간단)
      code = `// 배열 정렬 (bubble sort - 안정적)
void sort(double* arr, int size) {
  if (!arr || size <= 1) return;

  for (int i = 0; i < size - 1; i++) {
    for (int j = 0; j < size - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        double temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
      }
    }
  }
}`;
    }

    return {
      code,
      includes: isSpeedPriority ? ['<stdlib.h>'] : [],
    };
  }

  /**
   * 플레이스홀더 (미지원 operation)
   * @private
   */
  private static _generatePlaceholder(operation: string): string {
    return `// ${operation} 함수 (자동 생성 미지원)
// TODO: 수동으로 구현 필요
void ${operation}(/* parameters */) {
  // TODO: 함수 본문 구현
}`;
  }

  /**
   * 메모리 사용량 분석
   * @private
   */
  private static _analyzeMemory(
    operation: string,
    directive: string
  ): { heapUsage: string; stackUsage: string } {
    // 간단한 휴리스틱
    switch (operation) {
      case 'sum':
      case 'average':
      case 'max':
      case 'min':
        return {
          heapUsage: '0 bytes',
          stackUsage: 'O(1)', // 상수
        };

      case 'filter':
        return {
          heapUsage: 'O(n)', // 출력 배열
          stackUsage: 'O(1)',
        };

      case 'sort':
        return {
          heapUsage: directive.includes('속도') ? 'O(n)' : '0 bytes',
          stackUsage: 'O(log n)', // 재귀 스택
        };

      default:
        return {
          heapUsage: 'unknown',
          stackUsage: 'unknown',
        };
    }
  }

  /**
   * 생성된 코드 포맷팅
   */
  static formatCode(generated: GeneratedCode): string {
    let formatted = '';

    // Include 추가
    if (generated.includes.length > 0) {
      generated.includes.forEach(inc => {
        formatted += `#include ${inc}\n`;
      });
      formatted += '\n';
    }

    // 함수 코드
    formatted += generated.cCode;
    formatted += '\n';

    // 메타정보 (주석으로)
    formatted += `\n/* Memory Profile:\n`;
    formatted += `   Heap:  ${generated.memoryProfile.heapUsage}\n`;
    formatted += `   Stack: ${generated.memoryProfile.stackUsage}\n`;
    formatted += ` */\n`;

    return formatted;
  }
}
