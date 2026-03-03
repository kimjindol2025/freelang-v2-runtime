/**
 * Phase 14-1: SIMD 루프 감지 엔진
 *
 * 목적: 벡터화 가능한 루프 자동 식별
 *
 * 벡터화 조건:
 * - 1D 배열 연산만 (2D 이상 제외)
 * - 단순 산술 연산 (+, -, *, /)
 * - 메모리 인덱싱 패턴 일관성
 * - 루프 중단 조건 명확 (i < n 형태)
 *
 * SIMD 전략:
 * - SSE: 128비트 = 4×float32 또는 2×float64
 * - AVX: 256비트 = 8×float32 또는 4×float64
 * - 기대: 4×~8× 성능 향상
 */

export interface LoopAnalysis {
  isVectorizable: boolean;
  confidence: number;      // 0.0 ~ 1.0
  arrayOperations: string[];
  operationType: 'arithmetic' | 'transcendental' | 'memory' | 'mixed';
  estimatedSpeedup: number;
  simdStrategy: 'SSE' | 'AVX' | 'none';
  elementCount?: number;
  unrollFactor?: number;
  reason?: string;
}

export interface ArrayOperation {
  operand: string;
  operator: '+' | '-' | '*' | '/' | '=' | 'sqrt' | 'sin' | 'cos';
  indexPattern: string;  // 'i', 'i+1', '2*i' 등
  dataType: 'f32' | 'f64' | 'i32' | 'i64' | 'unknown';
}

export class SIMDDetector {
  /**
   * 루프가 벡터화 가능한지 분석
   *
   * 예:
   * for i in 0..n
   *   result[i] = a[i] + b[i]
   *
   * → isVectorizable: true, simdStrategy: 'AVX', speedup: 8×
   */
  static analyzeLoop(
    loopBody: string,
    loopVar: string = 'i',
    arrayName: string = ''
  ): LoopAnalysis {
    const analysis: LoopAnalysis = {
      isVectorizable: false,
      confidence: 0,
      arrayOperations: [],
      operationType: 'arithmetic',
      estimatedSpeedup: 1,
      simdStrategy: 'none',
    };

    try {
      // 1. 배열 연산 추출
      const operations = this.extractArrayOperations(loopBody, loopVar);
      analysis.arrayOperations = operations.map(op => `${op.operand} ${op.operator} ...`);

      // 2. 벡터화 조건 확인
      const checks = {
        hasArrayAccess: operations.length > 0,
        isSimpleArithmetic: operations.every(op =>
          ['+', '-', '*', '/'].includes(op.operator)
        ),
        consistentIndexing: this.hasConsistentIndexing(operations, loopVar),
        noDataDependency: this.hasNoDependency(loopBody, loopVar),
        noNestedLoop: !loopBody.includes('for ') || loopBody.split('for ').length === 1,
        noConditional: !/(if|else|switch)[\s\(]/.test(loopBody),
      };

      // 3. 벡터화 가능성 판정
      const passCount = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.values(checks).length;

      analysis.confidence = passCount / totalChecks;
      analysis.isVectorizable = analysis.confidence >= 0.8;

      if (!analysis.isVectorizable) {
        analysis.reason = this.getFailureReason(checks);
        return analysis;
      }

      // 4. SIMD 전략 선택
      analysis.simdStrategy = this.chooseSIMDStrategy(operations);
      analysis.estimatedSpeedup = this.estimateSpeedup(analysis.simdStrategy);
      analysis.operationType = this.classifyOperationType(operations);

      return analysis;
    } catch (error) {
      analysis.isVectorizable = false;
      analysis.confidence = 0;
      analysis.reason = `분석 실패: ${error}`;
      return analysis;
    }
  }

  /**
   * 배열 연산 추출
   *
   * 예: "result[i] = a[i] * 2 + b[i]"
   * → [
   *   { operand: 'result[i]', operator: '=', ... },
   *   { operand: 'a[i]', operator: '*', ... },
   *   { operand: 'b[i]', operator: '+', ... }
   * ]
   */
  private static extractArrayOperations(
    loopBody: string,
    loopVar: string
  ): ArrayOperation[] {
    const operations: ArrayOperation[] = [];

    // 배열 접근 패턴 (array[i], array[i+1], array[2*i] 등)
    const arrayAccessPattern = /(\w+)\s*\[\s*([^\]]+)\s*\]/g;
    let match;

    // 연산자 추출 (다음 연산자 찾기)
    const getOperator = (position: number): '+' | '-' | '*' | '/' | '=' => {
      const substr = loopBody.substring(position, position + 10);
      if (substr.includes('*')) return '*';
      if (substr.includes('/')) return '/';
      if (substr.includes('+')) return '+';
      if (substr.includes('-')) return '-';
      if (substr.includes('=')) return '=';
      return '=';
    };

    while ((match = arrayAccessPattern.exec(loopBody)) !== null) {
      const [fullMatch, arrayName, indexExpr] = match;

      // 인덱스 식 정규화 (i, i+1, 2*i 등)
      const indexPattern = this.normalizeIndexExpr(indexExpr, loopVar);

      // 인덱스가 루프 변수를 포함해야 함
      if (indexPattern !== null) {
        const endPos = match.index + fullMatch.length;
        const operator = getOperator(endPos);

        operations.push({
          operand: `${arrayName}[${indexExpr}]`,
          operator,
          indexPattern,
          dataType: this.inferDataType(arrayName),
        });
      }
    }

    return operations;
  }

  /**
   * 인덱스 식 정규화
   *
   * i → 'i'
   * i + 1 → 'i+1'
   * 2 * i → '2*i'
   * i + j → null (루프 변수 외 포함)
   */
  private static normalizeIndexExpr(expr: string, loopVar: string): string | null {
    // 공백 제거
    expr = expr.replace(/\s+/g, '');

    // 루프 변수만 포함 가능 (다른 변수 제외)
    const hasOtherVar = /[a-zA-Z_]\w*/.test(expr.replace(new RegExp(loopVar, 'g'), ''));
    if (hasOtherVar) return null;

    // 상수 연산만 허용
    if (!/^(\d+[\+\-\*\/]?)*\w+(\d+[\+\-\*\/]?)*$/.test(expr)) return null;

    return expr;
  }

  /**
   * 일관된 인덱싱 확인
   *
   * OK: a[i], b[i], c[i]  (모두 i)
   * NO: a[i], b[i+1], c[2*i] (패턴 불일치)
   */
  private static hasConsistentIndexing(
    operations: ArrayOperation[],
    loopVar: string
  ): boolean {
    if (operations.length === 0) return false;

    const firstPattern = operations[0].indexPattern;
    return operations.every(op => op.indexPattern === firstPattern);
  }

  /**
   * 데이터 종속성 없음 확인
   *
   * OK: result[i] = a[i] + b[i]  (독립적)
   * NO: result[i] = result[i-1] + a[i]  (종속적)
   */
  private static hasNoDependency(
    loopBody: string,
    loopVar: string
  ): boolean {
    // 루프 변수에 대한 역참조가 없어야 함
    // 예: result[i] = result[i-1] ← 나쁨

    // 1. 자기 참조 누적 패턴 (counter = counter + 1)
    const selfRefPattern = /(\w+)\s*[=\+\-\*\/\%]=?\s*\1\s*[\+\-\*\/]/;
    if (selfRefPattern.test(loopBody)) {
      return false; // 누적 종속성 있음
    }

    // 2. 배열 자기 참조 (result[i] = result[i-1] + ...)
    const arrayRefPattern = /(\w+)\s*\[\s*([^\]]*)\s*\]\s*[=\+\-\*\/]\s*\1\s*\[/;
    if (arrayRefPattern.test(loopBody)) {
      return false; // 배열 자기 참조 종속성
    }

    // 3. 루프 변수 역참조 (i-1, i-2)
    if (loopBody.includes(loopVar + '-1') ||
        loopBody.includes(loopVar + '-2')) {
      return false; // 역참조 종속성
    }

    return true;
  }

  /**
   * SIMD 전략 선택
   */
  private static chooseSIMDStrategy(operations: ArrayOperation[]): 'SSE' | 'AVX' | 'none' {
    if (operations.length === 0) return 'none';

    // 부동소수점 연산 → AVX 선호 (8× float32)
    const hasFloatOp = operations.some(op => op.dataType === 'f32');
    if (hasFloatOp) return 'AVX';

    // 정수 연산 → SSE (4× int32)
    const hasIntOp = operations.some(op => op.dataType === 'i32');
    if (hasIntOp) return 'SSE';

    return 'AVX'; // 기본값
  }

  /**
   * 성능 향상 예측
   */
  private static estimateSpeedup(strategy: 'SSE' | 'AVX' | 'none'): number {
    switch (strategy) {
      case 'SSE': return 4;    // 128비트 = 4개 int32
      case 'AVX': return 8;    // 256비트 = 8개 float32
      case 'none': return 1;
    }
  }

  /**
   * 연산 유형 분류
   */
  private static classifyOperationType(
    operations: ArrayOperation[]
  ): 'arithmetic' | 'transcendental' | 'memory' | 'mixed' {
    const operators = new Set(operations.map(op => op.operator));

    if (operators.has('sqrt') || operators.has('sin') || operators.has('cos')) {
      return 'transcendental';
    }

    if (operators.size === 1 && operators.has('=')) {
      return 'memory';
    }

    return 'arithmetic';
  }

  /**
   * 실패 원인 설명
   */
  private static getFailureReason(checks: Record<string, boolean>): string {
    if (!checks.hasArrayAccess) {
      return '배열 접근 없음';
    }
    if (!checks.isSimpleArithmetic) {
      return '복잡한 연산 (sqrt, sin, cos 등)';
    }
    if (!checks.consistentIndexing) {
      return '일관되지 않은 인덱싱 패턴';
    }
    if (!checks.noDataDependency) {
      return '데이터 종속성 있음';
    }
    if (!checks.noNestedLoop) {
      return '중첩 루프 포함';
    }
    return '알 수 없음';
  }

  /**
   * 데이터 타입 추론
   */
  private static inferDataType(arrayName: string): 'f32' | 'f64' | 'i32' | 'i64' | 'unknown' {
    // 이름 기반 추론 (실제로는 타입 체커와 통합)
    if (arrayName.includes('float') || arrayName.includes('f')) return 'f32';
    if (arrayName.includes('double') || arrayName.includes('d')) return 'f64';
    if (arrayName.includes('int') || arrayName.includes('i')) return 'i32';
    if (arrayName.includes('long') || arrayName.includes('l')) return 'i64';
    return 'unknown';
  }

  /**
   * 루프 언롤 팩터 계산
   *
   * SIMD 폭에 따라 다름:
   * - SSE (4×): 언롤 4
   * - AVX (8×): 언롤 8
   * - AVX-512 (16×): 언롤 16
   */
  static calculateUnrollFactor(strategy: 'SSE' | 'AVX' | 'none'): number {
    switch (strategy) {
      case 'SSE': return 4;
      case 'AVX': return 8;
      case 'none': return 1;
    }
  }

  /**
   * 가능한 요소 개수 계산
   *
   * 루프 범위에서 벡터화할 수 있는 요소 개수
   * for i in 0..n → n개 요소
   */
  static estimateElementCount(loopStart: number, loopEnd: number): number {
    return loopEnd - loopStart;
  }

  /**
   * 종합 점수 계산 (0~100)
   */
  static calculateScore(analysis: LoopAnalysis): number {
    let score = analysis.confidence * 50; // 기본: 50점

    // SIMD 전략 가산점
    if (analysis.simdStrategy === 'AVX') score += 30;
    if (analysis.simdStrategy === 'SSE') score += 20;

    // 성능 향상 가산점
    if (analysis.estimatedSpeedup >= 8) score += 20;
    if (analysis.estimatedSpeedup >= 4) score += 10;

    return Math.min(score, 100);
  }
}
