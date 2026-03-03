/**
 * Phase 4 Step 4: AI-First Type Inference Engine
 *
 * 철학: "100% 확신은 없다. 다만 70% 이상의 확률로 맞는 타입을 제안한다"
 *
 * 동작:
 * 1. FunctionNameEnhancer → 함수명 분석
 * 2. VariableNameEnhancer → 변수명 분석
 * 3. CommentAnalyzer → 주석 분석
 * 4. 이 3가지를 통합하여 최종 타입 결정
 *
 * 핵심 규칙:
 * - 신뢰도 0.95 이상: 확정 타입
 * - 신뢰도 0.70-0.94: 제안 (선택 가능)
 * - 신뢰도 < 0.70: unknown
 *
 * AI의 특징:
 * - "이것이 최선이다"가 아니라 "70% 확률로 맞습니다"라고 말함
 * - 불확실성을 명시적으로 표현
 * - 다중 선택지 제공
 */

import { FunctionNameAnalysis, FunctionNameEnhancer } from './function-name-enhancer';
import { VariableNameAnalysis, VariableNameEnhancer } from './variable-name-enhancer';
import { CommentInfo, CommentAnalyzer } from './comment-analyzer';
import { AdvancedTypeInferenceEngine } from './advanced-type-inference-engine';
import { UnionNarrowingEngine } from './union-narrowing';
import { GenericsResolutionEngine } from './generics-resolution';
import { ConstraintSolverEngine } from './constraint-solver';
import { TraitEngine } from './trait-engine';

export interface TypeInferenceSource {
  fromFunctionName?: FunctionNameAnalysis;
  fromVariableName?: VariableNameAnalysis;
  fromComment?: CommentInfo;
}

export interface InferredType {
  type: string;                    // 최종 추론 타입
  confidence: number;              // 0.0-1.0
  sources: string[];               // 어디서 나온 정보?
  alternatives: Array<{            // 다른 가능성
    type: string;
    confidence: number;
    reason: string;
  }>;
  reasoning: string[];             // 왜 이 타입인가?
  uncertainty: string;             // 불확실성 설명
  recommendation: string;          // AI의 제안
}

/**
 * AI-First 타입 추론 엔진
 */
export class AIFirstTypeInferenceEngine {
  private advancedEngine: AdvancedTypeInferenceEngine;
  private functionNameEnhancer: FunctionNameEnhancer;
  private variableNameEnhancer: VariableNameEnhancer;
  private commentAnalyzer: CommentAnalyzer;

  // Advanced type system engines (Phase 4)
  private unionNarrowing?: UnionNarrowingEngine;
  private genericsResolution?: GenericsResolutionEngine;
  private constraintSolver?: ConstraintSolverEngine;
  private traitEngine?: TraitEngine;

  /**
   * 타입 호환성 매트릭스 (신뢰도 기반)
   * 같은 도메인 내에서는 타입이 일관되어야 함
   */
  private typeCompatibility = new Map<string, Set<string>>([
    // Finance 도메인
    ['currency', new Set(['decimal', 'number', 'float'])],
    ['percentage', new Set(['decimal', 'number', 'float'])],
    ['decimal', new Set(['currency', 'percentage', 'number', 'float'])],

    // Web 도메인
    ['validated_string', new Set(['string'])],
    ['email', new Set(['validated_string', 'string'])],
    ['url', new Set(['validated_string', 'string'])],

    // Data Science 도메인
    ['array<number>', new Set(['vector', 'array'])],
    ['vector', new Set(['array<number>', 'array'])],
    ['matrix', new Set(['array<array<number>>'])],

    // Crypto 도메인
    ['hash_string', new Set(['string', 'validated_string'])],
    ['encrypted', new Set(['string'])],
  ]);

  constructor() {
    this.advancedEngine = new AdvancedTypeInferenceEngine();
    this.functionNameEnhancer = new FunctionNameEnhancer();
    this.variableNameEnhancer = new VariableNameEnhancer();
    this.commentAnalyzer = new CommentAnalyzer();
  }

  /**
   * 코드 요소(함수/변수)의 최종 타입을 추론
   *
   * Phase 5 Stage 2: Semantic analysis 통합
   * - code 매개변수를 추가하여 AdvancedTypeInferenceEngine 호출 가능
   */
  inferType(
    name: string,
    nameType: 'function' | 'variable',
    comment?: string,
    code?: string
  ): InferredType {
    const sources: TypeInferenceSource = {};
    const inferenceLogs: string[] = [];

    // Step 0: Semantic analysis (NEW - Phase 5 Stage 2)
    let semanticInfo: any = null;
    if (code) {
      const semanticAnalysis = this.advancedEngine.infer(code);
      if (semanticAnalysis.has(name)) {
        semanticInfo = semanticAnalysis.get(name);
        inferenceLogs.push(`[Semantic] "${name}" analyzed (confidence: ${(semanticInfo.confidence * 100).toFixed(0)}%)`);
      }
    }

    // Step 1: 함수명/변수명 분석
    if (nameType === 'function') {
      sources.fromFunctionName = this.functionNameEnhancer.analyzeFunctionName(name);
      inferenceLogs.push(`[Function] "${name}" analyzed`);
    } else {
      sources.fromVariableName = this.variableNameEnhancer.analyzeVariableName(name);
      inferenceLogs.push(`[Variable] "${name}" analyzed`);
    }

    // Step 2: 주석 분석 (있으면)
    if (comment) {
      sources.fromComment = this.commentAnalyzer.analyzeComment(comment);
      inferenceLogs.push(`[Comment] "${comment.substring(0, 50)}" analyzed`);
    }

    // Step 3: 통합하여 최종 타입 결정 (semantic info 포함)
    const result = this.synthesizeType(name, nameType, sources, inferenceLogs, semanticInfo);

    return result;
  }

  /**
   * 여러 소스의 정보를 통합
   *
   * Phase 5 Stage 2: Semantic analysis 추가 (가장 높은 가중치)
   */
  private synthesizeType(
    name: string,
    nameType: 'function' | 'variable',
    sources: TypeInferenceSource,
    logs: string[],
    semanticInfo?: any
  ): InferredType {
    const candidates: Array<{
      type: string;
      confidence: number;
      source: string;
    }> = [];

    // Step 0: Semantic analysis (NEW - Phase 5 Stage 2)
    // 가중치 0.30으로 처리하지만, code 기반 추론이므로 신뢰도 제한 (max 0.80)
    // (code가 불완전할 수 있으므로 다른 소스들과의 충돌 방지)
    if (semanticInfo) {
      candidates.push({
        type: semanticInfo.inferredType,
        confidence: Math.min(semanticInfo.confidence, 0.80),  // Cap at 0.80
        source: 'semantic_analysis',
      });
    }

    // 각 소스에서 타입 추출
    if (sources.fromFunctionName) {
      if (sources.fromFunctionName.returnTypeHint) {
        candidates.push({
          type: sources.fromFunctionName.returnTypeHint,
          confidence: sources.fromFunctionName.confidence,
          source: 'function_name',
        });
      }
    }

    if (sources.fromVariableName) {
      if (sources.fromVariableName.inferredType) {
        candidates.push({
          type: sources.fromVariableName.inferredType,
          confidence: sources.fromVariableName.confidence,
          source: 'variable_name',
        });
      }
    }

    if (sources.fromComment) {
      // 주석에서 명시적 도메인/포맷 정보를 타입으로 변환
      if (sources.fromComment.format) {
        const typeFromFormat = this.formatToType(sources.fromComment.format);
        candidates.push({
          type: typeFromFormat,
          confidence: sources.fromComment.confidence,
          source: 'comment_format',
        });
      }

      if (sources.fromComment.domain && !sources.fromComment.format) {
        const typeFromDomain = this.domainToDefaultType(sources.fromComment.domain);
        candidates.push({
          type: typeFromDomain,
          confidence: sources.fromComment.confidence * 0.8, // 도메인만으로는 신뢰도 감소
          source: 'comment_domain',
        });
      }
    }

    // 후보가 없으면 unknown
    if (candidates.length === 0) {
      return {
        type: 'unknown',
        confidence: 0,
        sources: [],
        alternatives: [],
        reasoning: ['No type hints found'],
        uncertainty: 'No information available to infer type',
        recommendation: 'Consider adding type annotation or comments',
      };
    }

    // 가장 높은 신뢰도의 타입 선택
    const sorted = candidates.sort((a, b) => b.confidence - a.confidence);
    const primaryType = sorted[0];

    // 타입 충돌 확인
    const conflict = this.detectConflict(candidates, logs);

    // 최종 결과 구성
    const result: InferredType = {
      type: primaryType.type,
      confidence: primaryType.confidence,
      sources: [primaryType.source],
      alternatives: sorted
        .slice(1)
        .map((c) => ({
          type: c.type,
          confidence: c.confidence,
          reason: c.source,
        })),
      reasoning: [
        `Primary source: ${primaryType.source}`,
        `Confidence: ${(primaryType.confidence * 100).toFixed(0)}%`,
        ...logs,
      ],
      uncertainty: this.assessUncertainty(
        primaryType.confidence,
        candidates.length,
        conflict
      ),
      recommendation: this.generateRecommendation(
        primaryType.confidence,
        nameType,
        conflict
      ),
    };

    return result;
  }

  /**
   * 포맷 정보 → 타입 변환
   */
  private formatToType(format: string): string {
    const formatTypeMap: { [key: string]: string } = {
      percent: 'decimal',
      percentage: 'decimal',
      currency: 'decimal',
      cents: 'number',
      bytes: 'number',
      hex: 'string',
      hash: 'hash_string',
      encrypted: 'encrypted',
      validated: 'validated_string',
    };
    return formatTypeMap[format] || 'unknown';
  }

  /**
   * 도메인 → 기본 타입 매핑
   */
  private domainToDefaultType(domain: string): string {
    const domainTypeMap: { [key: string]: string } = {
      finance: 'decimal',
      web: 'string',
      crypto: 'string',
      'data-science': 'array<number>',
      iot: 'number',
    };
    return domainTypeMap[domain] || 'unknown';
  }

  /**
   * 타입 충돌 감지
   */
  private detectConflict(
    candidates: Array<{ type: string; confidence: number; source: string }>,
    logs: string[]
  ): { hasConflict: boolean; conflictTypes: string[] } {
    if (candidates.length <= 1) {
      return { hasConflict: false, conflictTypes: [] };
    }

    const types = new Set(candidates.map((c) => c.type));
    if (types.size <= 1) {
      return { hasConflict: false, conflictTypes: [] };
    }

    // 타입이 호환되지 않으면 충돌
    const primaryType = candidates[0].type;
    const compatible = this.typeCompatibility.get(primaryType) || new Set();

    const conflictTypes = candidates
      .slice(1)
      .filter((c) => !compatible.has(c.type))
      .map((c) => c.type);

    if (conflictTypes.length > 0) {
      logs.push(`[CONFLICT] Incompatible types detected: ${conflictTypes.join(', ')}`);
      return { hasConflict: true, conflictTypes };
    }

    return { hasConflict: false, conflictTypes: [] };
  }

  /**
   * 불확실성 평가
   */
  private assessUncertainty(
    confidence: number,
    sourceCount: number,
    conflict: { hasConflict: boolean; conflictTypes: string[] }
  ): string {
    if (confidence >= 0.95) {
      return 'Very high confidence - type is likely correct';
    }
    if (confidence >= 0.80) {
      return 'High confidence - type is probably correct';
    }
    if (confidence >= 0.70) {
      return 'Moderate confidence - type is likely but not certain';
    }
    if (confidence >= 0.50) {
      return 'Low confidence - consider explicit annotation';
    }

    return 'Very low confidence - type is uncertain';
  }

  /**
   * AI의 추천 생성
   */
  private generateRecommendation(
    confidence: number,
    nameType: 'function' | 'variable',
    conflict: { hasConflict: boolean; conflictTypes: string[] }
  ): string {
    if (conflict.hasConflict) {
      return `⚠️ Type conflict detected. Please add explicit type annotation. Conflicting types: ${conflict.conflictTypes.join(', ')}`;
    }

    if (confidence >= 0.95) {
      return `✅ Confident: Use type "${nameType === 'function' ? 'return type' : 'variable type'}" as inferred`;
    }

    if (confidence >= 0.80) {
      return `✓ Likely correct: Use inferred type, but consider adding comment for clarity`;
    }

    if (confidence >= 0.70) {
      return `◐ Probable: Type seems likely (~${(confidence * 100).toFixed(0)}% confidence). Consider adding type annotation`;
    }

    return `✗ Uncertain: Add explicit type annotation. AI confidence is too low (${(confidence * 100).toFixed(0)}%)`;
  }

  /**
   * 복수 타입 추론 (E2E 통합용)
   *
   * Phase 5 Stage 2: code를 inferType에 전달하여 semantic analysis 활용
   */
  inferTypes(name: string, code: string, comments?: string[]): {
    signature: { domain?: string; confidence: number };
    variables: Array<{
      name: string;
      inferredType: string;
      domain?: string;
      confidence: number;
    }>;
  } {
    const comment = comments ? comments[0] : undefined;
    const result = this.inferType(name, 'function', comment, code);

    // 변수 추출 (간단한 정규식 기반)
    const variableMatches = code.match(/(?:const|let|var|function)\s+(\w+)/g) || [];
    const variables: Array<{
      name: string;
      inferredType: string;
      domain?: string;
      confidence: number;
    }> = [];

    for (const match of variableMatches) {
      const varName = match.replace(/(?:const|let|var|function)\s+/, '');
      if (varName !== name) {
        const varResult = this.inferType(varName, 'variable', undefined, code);
        variables.push({
          name: varName,
          inferredType: varResult.type,
          domain: this.extractDomain(varResult.reasoning),
          confidence: varResult.confidence,
        });
      }
    }

    return {
      signature: {
        domain: this.extractDomain(result.reasoning),
        confidence: result.confidence,
      },
      variables,
    };
  }

  /**
   * 변수 타입 추론
   *
   * Phase 5 Stage 2: code 매개변수를 전달하여 semantic analysis 활용
   */
  inferVariableType(
    name: string,
    value: string,
    code?: string
  ): InferredType {
    return this.inferType(name, 'variable', undefined, code);
  }

  /**
   * 도메인별로 변수 그룹화
   */
  groupVariablesByDomain(
    variables: Array<{ name: string; inferredType: string; domain?: string; confidence: number }>
  ): { [domain: string]: typeof variables } {
    const grouped: { [key: string]: typeof variables } = {};

    for (const variable of variables) {
      const domain = variable.domain || 'unknown';
      if (!grouped[domain]) {
        grouped[domain] = [];
      }
      grouped[domain].push(variable);
    }

    return grouped;
  }

  /**
   * 신뢰도 기준으로 필터링
   */
  filterByConfidence(
    variables: Array<{ name: string; inferredType: string; domain?: string; confidence: number }>,
    threshold: number
  ): typeof variables {
    return variables.filter((v) => v.confidence >= threshold);
  }

  /**
   * 높은 신뢰도 타입 추출
   */
  getHighConfidenceTypes(
    result: InferredType,
    threshold: number
  ): InferredType[] {
    if (result.confidence >= threshold) {
      return [result];
    }

    return result.alternatives.filter((alt) => alt.confidence >= threshold).map((alt) => ({
      type: alt.type,
      confidence: alt.confidence,
      sources: ['alternative'],
      alternatives: [],
      reasoning: [alt.reason],
      uncertainty: `Alternative from ${alt.reason}`,
      recommendation: `Consider: ${alt.type}`,
    }));
  }

  /**
   * 고급 타입 엔진들을 활성화하여 확장된 타입 추론 수행
   *
   * Phase 4 통합: Union Narrowing, Generics Resolution, Constraint Solving, Traits
   */
  inferTypeWithAdvancedEngines(
    name: string,
    code: string,
    options?: {
      enableUnionNarrowing?: boolean;
      enableGenerics?: boolean;
      enableConstraints?: boolean;
      enableTraits?: boolean;
    }
  ): InferredType {
    // 기본 타입 추론 수행
    const baseResult = this.inferType(name, 'variable', undefined, code);

    // Union Narrowing
    if (options?.enableUnionNarrowing) {
      if (!this.unionNarrowing) {
        this.unionNarrowing = new UnionNarrowingEngine();
      }
      const unionResult = this.unionNarrowing.build(code);
      const narrowedType = this.unionNarrowing.getNarrowedType(unionResult, name);
      if (narrowedType && narrowedType !== baseResult.type) {
        baseResult.type = narrowedType;
        baseResult.confidence = Math.min(0.95, baseResult.confidence + 0.10);
        baseResult.sources.push('union_narrowing');
        baseResult.reasoning.push(`Union narrowing applied: ${narrowedType}`);
      }
    }

    // Generics Resolution
    if (options?.enableGenerics) {
      if (!this.genericsResolution) {
        this.genericsResolution = new GenericsResolutionEngine();
      }
      const genericsResult = this.genericsResolution.build(code);
      const instantiations = this.genericsResolution.getInstantiations(genericsResult, name);
      if (instantiations.length > 0 && instantiations[0].resultType !== baseResult.type) {
        baseResult.type = instantiations[0].resultType;
        baseResult.confidence = Math.min(0.95, baseResult.confidence + 0.05);
        baseResult.sources.push('generics_resolution');
        baseResult.reasoning.push(`Generics instantiated to: ${instantiations[0].resultType}`);
      }
    }

    return baseResult;
  }

  /**
   * 헬퍼: reasoning에서 도메인 추출
   */
  private extractDomain(reasoning: string[]): string | undefined {
    for (const line of reasoning) {
      if (line.includes('finance')) return 'finance';
      if (line.includes('web')) return 'web';
      if (line.includes('crypto')) return 'crypto';
      if (line.includes('data-science')) return 'data-science';
      if (line.includes('iot')) return 'iot';
    }
    return undefined;
  }
}
