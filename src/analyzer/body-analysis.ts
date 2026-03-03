/**
 * FreeLang v2 Phase 5 Task 4.2 - Function Body Analysis
 *
 * 함수 본체 코드를 분석하여 패턴을 감지합니다:
 * 1. 루프 감지 (for, while)
 * 2. 누적 패턴 (+=, -=, *=, /=)
 * 3. 메모리 사용 추정 (변수 선언)
 * 4. (Phase 5 Stage 3.2) 변수 타입 추론
 *
 * 분석 결과는 directive 결정 및 타입 추론에 사용됩니다.
 */

import { AdvancedTypeInferenceEngine } from './advanced-type-inference-engine';
import { VariableTypeInfo } from './variable-type-recommender';

/**
 * 루프 분석 결과
 */
export interface LoopAnalysis {
  hasLoop: boolean;           // for/while 루프 존재
  loopCount: number;          // 루프 개수
  hasNestedLoop: boolean;     // 중첩 루프 존재
  isComplexLoop: boolean;     // O(n^2) 이상의 복잡도 추정
}

/**
 * 누적 패턴 분석 결과
 */
export interface AccumulationAnalysis {
  hasAccumulation: boolean;   // +=, -=, *= 등 누적 연산 존재
  operationTypes: string[];   // 누적 연산 타입 목록
  operationCount: number;     // 누적 연산 개수
  suggestsSpeed: boolean;     // "속도 우선" 지시어 제안 여부
}

/**
 * 메모리 사용 분석 결과
 */
export interface MemoryAnalysis {
  estimatedVariables: number; // 추정 변수 개수
  hasArrayDeclaration: boolean; // 배열 선언 존재
  hasComplexDataStructure: boolean; // 복잡한 자료구조
  suggestsMemory: boolean;    // "메모리 효율" 지시어 제안 여부
}

/**
 * 본체 분석 전체 결과
 */
export interface BodyAnalysisResult {
  loops: LoopAnalysis;
  accumulation: AccumulationAnalysis;
  memory: MemoryAnalysis;

  // 종합 판단
  suggestedDirective: 'speed' | 'memory' | 'safety';
  confidence: number;         // 분석 신뢰도 (0.0 ~ 1.0)
  details: string;            // 분석 상세 설명

  // Phase 5 Stage 3.2: 변수 타입 추론
  inferredVariableTypes?: Map<string, VariableTypeInfo>; // 변수명 → 타입 정보
}

/**
 * Body Pattern Analyzer
 *
 * 함수 본체 코드를 토큰 수준에서 분석
 * Phase 5 Stage 3.2: 변수 타입 추론 기능 포함
 */
export class BodyAnalyzer {
  private bodyTokens: string[];
  private keywordCounts: Map<string, number> | null = null; // Cache
  private body: string;  // Phase 5 Stage 3.2: 원본 본체 코드 저장
  private advancedEngine: AdvancedTypeInferenceEngine; // Phase 5 Stage 3.2: 타입 추론 엔진

  constructor(body: string) {
    // 본체를 토큰으로 분해 (공백 기준)
    this.bodyTokens = body
      .split(/\s+/)
      .filter(t => t.length > 0);

    // Phase 5 Stage 3.2: 원본 본체 코드와 타입 추론 엔진 저장
    this.body = body;
    this.advancedEngine = new AdvancedTypeInferenceEngine();
  }

  /**
   * Phase 4.5: Optimized keyword counting (한 번의 순회로 모든 카운트)
   *
   * 최적화 전: countKeyword()를 16번 호출 → O(16n)
   * 최적화 후: 한 번의 순회 → O(n)
   *
   * 예상 개선: 1.30ms → 0.3-0.4ms (70% 감소)
   */
  private ensureKeywordCounts(): void {
    if (this.keywordCounts !== null) return; // Already cached

    this.keywordCounts = new Map();

    // O(n): 한 번의 순회로 모든 키워드 카운트
    for (const token of this.bodyTokens) {
      const count = this.keywordCounts.get(token) || 0;
      this.keywordCounts.set(token, count + 1);
    }
  }

  /**
   * 캐시된 카운트 조회 (O(1))
   */
  private countKeywordOptimized(keyword: string): number {
    this.ensureKeywordCounts();
    return this.keywordCounts?.get(keyword) || 0;
  }

  /**
   * 전체 분석 실행
   * Phase 5 Stage 3.2: 변수 타입 추론 포함
   */
  public analyze(): BodyAnalysisResult {
    // Pre-compute all keyword counts once (O(n))
    this.ensureKeywordCounts();

    const loops = this.analyzeLoops();
    const accumulation = this.analyzeAccumulation();
    const memory = this.analyzeMemory();

    const suggestedDirective = this.decideDirect(loops, accumulation, memory);
    const confidence = this.calculateConfidence(loops, accumulation, memory);
    const details = this.generateDetails(loops, accumulation, memory);

    // Phase 5 Stage 3.2: 변수 타입 추론
    const inferredVariableTypes = this.inferVariableTypes();

    return {
      loops,
      accumulation,
      memory,
      suggestedDirective,
      confidence,
      details,
      inferredVariableTypes
    };
  }

  /**
   * Phase 5 Task 4.2a: 루프 감지
   */
  private analyzeLoops(): LoopAnalysis {
    const forCount = this.countKeywordOptimized('for');
    const whileCount = this.countKeywordOptimized('while');
    const hasLoop = forCount > 0 || whileCount > 0;
    const loopCount = forCount + whileCount;

    // 중첩 루프 감지: 같은 중괄호 깊이에 여러 루프가 있거나,
    // 루프 내에 루프가 있으면 중첩으로 판단
    const hasNestedLoop = this.detectNestedLoops();

    // 복잡도 추정: 중첩 루프 또는 여러 루프 = O(n^2)
    const isComplexLoop = hasNestedLoop || loopCount > 1;

    return {
      hasLoop,
      loopCount,
      hasNestedLoop,
      isComplexLoop
    };
  }

  /**
   * Phase 5 Task 4.2b: 누적 패턴 감지
   */
  private analyzeAccumulation(): AccumulationAnalysis {
    const operationTypes: string[] = [];
    let operationCount = 0;

    // 누적 연산 키워드
    const accumulationOps = ['+=', '-=', '*=', '/=', '%='];

    for (const op of accumulationOps) {
      const count = this.countKeywordOptimized(op); // 최적화: 캐시된 카운트 사용
      if (count > 0) {
        operationTypes.push(op);
        operationCount += count;
      }
    }

    const hasAccumulation = operationCount > 0;

    // 누적 연산이 있으면 "속도 우선" 제안
    // (루프 내 누적 = 성능 최적화 필요)
    const suggestsSpeed = hasAccumulation;

    return {
      hasAccumulation,
      operationTypes,
      operationCount,
      suggestsSpeed
    };
  }

  /**
   * Phase 5 Task 4.2c (파트 1): 메모리 사용 추정
   */
  private analyzeMemory(): MemoryAnalysis {
    // 변수 선언: let, const 키워드 개수
    const letCount = this.countKeywordOptimized('let'); // 최적화: 캐시 사용
    const constCount = this.countKeywordOptimized('const'); // 최적화: 캐시 사용
    const estimatedVariables = letCount + constCount;

    // 배열 선언 감지: [, push, pop 등 배열 메서드
    // - 정확한 토큰 매치: 'push', 'pop' 등
    // - 포함 감지: '[' 문자가 있는 모든 토큰 ([1, [a], arr[0] 등)
    const arrayKeywords = ['push', 'pop', 'shift', 'unshift'];
    const hasArrayDeclaration =
      arrayKeywords.some(kw => this.bodyTokens.includes(kw)) ||
      this.bodyTokens.some(t => t.includes('['));

    // 복잡한 자료구조: map, struct 등
    const complexKeywords = ['map', 'struct', 'HashMap', 'Vec', 'Array'];
    const hasComplexDataStructure = complexKeywords.some(kw =>
      this.countKeywordOptimized(kw) > 0 // 최적화: 캐시 사용
    );

    // 메모리 효율성 제안: 변수 많거나 복잡한 자료구조 또는 배열
    const suggestsMemory =
      estimatedVariables > 3 || hasComplexDataStructure || hasArrayDeclaration;

    return {
      estimatedVariables,
      hasArrayDeclaration,
      hasComplexDataStructure,
      suggestsMemory
    };
  }

  /**
   * 최종 Directive 결정
   */
  private decideDirect(
    loops: LoopAnalysis,
    accumulation: AccumulationAnalysis,
    memory: MemoryAnalysis
  ): 'speed' | 'memory' | 'safety' {
    // 우선순위:
    // 1. (루프 AND 누적) OR 복잡한 루프 → "speed" (루프 최적화 필요)
    // 2. 복잡한 메모리 사용 → "memory"
    // 3. 기본값 → "safety"

    // 루프와 누적 연산이 함께 있거나, 복잡한 루프 구조
    const needsSpeed =
      (loops.hasLoop && accumulation.hasAccumulation) ||
      loops.isComplexLoop;

    if (needsSpeed) {
      return 'speed';
    }

    if (memory.suggestsMemory) {
      return 'memory';
    }

    return 'safety';
  }

  /**
   * 신뢰도 계산
   */
  private calculateConfidence(
    loops: LoopAnalysis,
    accumulation: AccumulationAnalysis,
    memory: MemoryAnalysis
  ): number {
    let confidence = 0.6; // 기본 신뢰도 60%

    // 루프 감지: +20%
    if (loops.hasLoop) confidence += 0.2;

    // 누적 패턴: +10%
    if (accumulation.hasAccumulation) confidence += 0.1;

    // 메모리 사용 명확: +10%
    if (memory.suggestsMemory) confidence += 0.1;

    return Math.min(confidence, 1.0); // Max 100%
  }

  /**
   * 분석 상세 설명 생성
   */
  private generateDetails(
    loops: LoopAnalysis,
    accumulation: AccumulationAnalysis,
    memory: MemoryAnalysis
  ): string {
    const parts: string[] = [];

    if (loops.hasLoop) {
      parts.push(`${loops.loopCount}개 루프`);
      if (loops.hasNestedLoop) parts.push('(중첩)');
    }

    if (accumulation.hasAccumulation) {
      parts.push(`누적 연산: ${accumulation.operationTypes.join(', ')}`);
    }

    if (memory.estimatedVariables > 0) {
      parts.push(`~${memory.estimatedVariables}개 변수`);
    }

    if (memory.hasArrayDeclaration) {
      parts.push('배열 사용');
    }

    return parts.join(', ') || '기본 패턴';
  }

  /**
   * Helper: 키워드 개수 세기
   */
  private countKeyword(keyword: string): number {
    return this.bodyTokens.filter(t => t === keyword).length;
  }

  /**
   * Helper: 중첩 루프 감지 (최적화 버전)
   *
   * 간단한 휴리스틱: for/while이 여러 개이고, 중괄호가 2개 이상 있으면
   * 중첩 루프로 판단
   *
   * 최적화: join() + match() 대신 filter() 사용 (O(n) → O(n), 하지만 상수 감소)
   */
  private detectNestedLoops(): boolean {
    const loopCount = this.countKeywordOptimized('for') + this.countKeywordOptimized('while');

    // 개선: join('').match() 대신 직접 필터링 (정규식 오버헤드 제거)
    const braceCount = this.bodyTokens.filter(t => t === '{').length;

    // 루프가 2개 이상이고, 중괄호가 깊으면 중첩으로 판단
    return loopCount >= 2 && braceCount >= 2;
  }

  /**
   * Phase 5 Stage 3.2: 변수 타입 추론
   *
   * 함수 본체에서 변수 선언을 감지하고, AdvancedTypeInferenceEngine을 사용하여
   * 각 변수의 타입을 추론합니다.
   *
   * 동작:
   * 1. 본체에서 변수 선언 패턴 추출 (let x = 5, const arr = [], 등)
   * 2. AdvancedTypeInferenceEngine에 본체 전체를 전달
   * 3. 추론된 타입 정보를 반환
   *
   * 예시:
   *   body: "let total = 0; for i in arr { total = total + i; }"
   *   returns: {
   *     total: { name: 'total', inferredType: 'number', confidence: 0.95, ... },
   *     i: { name: 'i', inferredType: 'number', confidence: 0.85, ... }
   *   }
   */
  private inferVariableTypes(): Map<string, VariableTypeInfo> {
    const result = new Map<string, VariableTypeInfo>();

    try {
      // AdvancedTypeInferenceEngine을 사용하여 변수 타입 추론
      const inferenceResults = this.advancedEngine.infer(this.body);

      // 추론 결과를 VariableTypeInfo 형식으로 변환
      // AdvancedTypeInfo의 variableName을 name으로 매핑
      inferenceResults.forEach((advancedInfo) => {
        const variableTypeInfo: VariableTypeInfo = {
          name: advancedInfo.variableName,  // ← variableName을 name으로 매핑
          inferredType: advancedInfo.inferredType,
          confidence: advancedInfo.confidence,
          source: advancedInfo.source,
          reasoning: advancedInfo.reasoning,
          relatedVariables: advancedInfo.relatedVariables
        };
        result.set(advancedInfo.variableName, variableTypeInfo);
      });

      return result;
    } catch (error) {
      // 추론 실패 시 빈 Map 반환 (안전성)
      console.warn('Variable type inference failed:', error);
      return result;
    }
  }
}

/**
 * 본체 분석 래퍼 함수
 */
export function analyzeBody(body: string): BodyAnalysisResult {
  const analyzer = new BodyAnalyzer(body);
  return analyzer.analyze();
}
