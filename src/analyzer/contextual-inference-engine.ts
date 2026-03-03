/**
 * Phase 3 Stage 3 - Contextual Inference Engine
 *
 * 4개 분석기를 통합하는 오케스트레이터
 * - NameAnalyzer: 함수명/변수명 의미 분석
 * - DomainKnowledgeBase: 도메인 검출 + 타입 매핑
 * - SemanticAnalyzer (기존): AST 코드 의미 분석
 * - ContextTracker (기존): 스코프 + 의존성 추적
 * - SemanticTypeEnhancer: 도메인별 타입 강화
 */

import { NameAnalyzer } from './name-analyzer';
import { SemanticTypeEnhancer } from './semantic-type-enhancer';
import { DomainKnowledgeBase } from '../knowledge/domain-knowledge-base';
import { SemanticAnalyzer, VariableInfo } from './semantic-analyzer';
import { ContextTracker, ScopeLevel } from './context-tracker';

/**
 * 최종 변수 타입 추론 결과
 */
export interface VariableTypeInference {
  variableName: string;
  functionName: string;

  // 기본 정보
  inferredType: string;
  enhancedType: string;
  domain: string | null;

  // 신뢰도
  confidence: number;
  nameAnalysisConfidence: number;      // 25%
  semanticAnalysisConfidence: number;  // 35%
  contextConfidence: number;           // 25%
  domainEnhancementConfidence: number; // 15%

  // 추론 과정
  reasoning: string[];
  nameAnalysisDetails?: string;
  semanticAnalysisDetails?: string;
  contextDetails?: string;
  domainEnhancementDetails?: string;

  // 검증 규칙
  validationRules?: string[];
  strictnessLevel?: string;
}

/**
 * 함수 전체 타입 추론 결과
 */
export interface FunctionTypeInference {
  functionName: string;
  domain: string | null;
  variables: Map<string, VariableTypeInference>;
  confidence: number;
  reasoning: string[];
}

/**
 * Contextual Inference Engine
 */
export class ContextualInferenceEngine {
  private nameAnalyzer: NameAnalyzer;
  private semanticTypeEnhancer: SemanticTypeEnhancer;
  private domainKnowledgeBase: DomainKnowledgeBase;
  private semanticAnalyzer: SemanticAnalyzer;
  private contextTracker: ContextTracker;

  // 신뢰도 가중치 (합계 1.0)
  private readonly WEIGHTS = {
    nameAnalysis: 0.25,
    semanticAnalysis: 0.35,
    contextTracking: 0.25,
    domainEnhancement: 0.15,
  };

  constructor() {
    this.nameAnalyzer = new NameAnalyzer();
    this.semanticTypeEnhancer = new SemanticTypeEnhancer();
    this.domainKnowledgeBase = new DomainKnowledgeBase();
    this.semanticAnalyzer = new SemanticAnalyzer();
    this.contextTracker = new ContextTracker();
  }

  /**
   * 함수 전체 타입 추론
   * 함수명과 코드를 분석하여 모든 변수의 타입을 추론
   */
  public inferTypes(functionName: string, code: string): FunctionTypeInference {
    const reasoning: string[] = [];

    // Step 1: 함수명 분석으로 도메인 추론
    const functionNameParts = this.nameAnalyzer.parseName(functionName, true);
    const nameDomainInference = this.nameAnalyzer.inferIntentFromWords(functionNameParts.words);
    const functionDomain = nameDomainInference?.domain || null;

    reasoning.push(`함수명 "${functionName}" 분석 → 도메인: ${functionDomain || 'unknown'}`);

    // Step 2: 코드 의미 분석
    const semanticVariables = this.semanticAnalyzer.analyzeVariableLifecycle(code);
    reasoning.push(`코드 의미 분석: ${semanticVariables.size}개 변수 검출`);

    // Step 3: 각 변수별 타입 추론
    const variableInferences = new Map<string, VariableTypeInference>();

    for (const [varName, semanticInfo] of semanticVariables) {
      const inference = this.inferVariableType(
        varName,
        functionName,
        code,
        semanticInfo
      );
      variableInferences.set(varName, inference);
    }

    // Step 4: 최종 신뢰도 계산 (평균)
    let totalConfidence = 0;
    for (const inference of variableInferences.values()) {
      totalConfidence += inference.confidence;
    }
    const averageConfidence =
      variableInferences.size > 0 ? totalConfidence / variableInferences.size : 0;

    reasoning.push(`전체 신뢰도: ${(averageConfidence * 100).toFixed(1)}%`);

    return {
      functionName,
      domain: functionDomain,
      variables: variableInferences,
      confidence: averageConfidence,
      reasoning,
    };
  }

  /**
   * 단일 변수 타입 추론
   * 함수명, 변수명, 코드 컨텍스트를 통합하여 최종 타입 결정
   */
  public inferVariableType(
    variableName: string,
    functionName: string,
    code: string,
    semanticInfo?: VariableInfo
  ): VariableTypeInference {
    const reasoning: string[] = [];

    // Step 1: 변수명 분석 (NameAnalyzer)
    const varNameParts = this.nameAnalyzer.parseName(variableName, false);
    const varNameSemantics = this.nameAnalyzer.analyzeWordSemantics(variableName);
    const nameAnalysisConfidence = varNameSemantics.confidence;
    const nameAnalysisDetails = `변수명 "${variableName}" → 역할: ${varNameSemantics.role}, 타입 힌트: ${varNameSemantics.typeHint || 'none'}`;

    reasoning.push(nameAnalysisDetails);

    // Step 2: 기본 타입 결정 (SemanticAnalyzer)
    let baseType = semanticInfo?.inferredType || 'unknown';
    let semanticAnalysisConfidence = semanticInfo?.confidence || 0.5;
    const semanticAnalysisDetails = `코드 분석 → 기본 타입: ${baseType} (신뢰도: ${(semanticAnalysisConfidence * 100).toFixed(1)}%)`;

    reasoning.push(semanticAnalysisDetails);

    // Step 3: 도메인 추론 (DomainKnowledgeBase + NameAnalyzer)
    const functionNameParts = this.nameAnalyzer.parseName(functionName, true);
    const domainResult = this.domainKnowledgeBase.detectDomain({
      functionName,
      variableNames: [variableName],
      operations: semanticInfo?.usages.map(u => u.context) || [],
    });

    const domain = domainResult?.domain || null;
    let contextConfidence = domainResult?.confidence || 0.5;

    // 함수명도 함께 고려
    const functionDomainInference = this.nameAnalyzer.inferIntentFromWords(functionNameParts.words);
    if (functionDomainInference && functionDomainInference.confidence > contextConfidence) {
      contextConfidence = functionDomainInference.confidence;
    }

    const contextDetails = `컨텍스트 분석 → 도메인: ${domain || 'unknown'} (신뢰도: ${(contextConfidence * 100).toFixed(1)}%)`;
    reasoning.push(contextDetails);

    // Step 4: 도메인 기반 타입 강화 (SemanticTypeEnhancer)
    let enhancedType = baseType;
    let domainEnhancementConfidence = 0.5;
    let validationRules: string[] | undefined;
    let strictnessLevel: string | undefined;

    if (domain && baseType !== 'unknown') {
      const enhancement = this.semanticTypeEnhancer.enhanceType(baseType, domain, variableName);
      enhancedType = enhancement.enhancedType;
      domainEnhancementConfidence = enhancement.confidence;

      const strictResult = this.semanticTypeEnhancer.getStrictType(baseType, domain);
      validationRules = strictResult.validationRules;
      strictnessLevel = strictResult.rationale;

      const domainEnhancementDetails = `타입 강화: ${baseType} (${domain}) → ${enhancedType}`;
      reasoning.push(domainEnhancementDetails);
    }

    // Step 5: 가중 신뢰도 계산
    const confidence =
      nameAnalysisConfidence * this.WEIGHTS.nameAnalysis +
      semanticAnalysisConfidence * this.WEIGHTS.semanticAnalysis +
      contextConfidence * this.WEIGHTS.contextTracking +
      domainEnhancementConfidence * this.WEIGHTS.domainEnhancement;

    // 최종 신뢰도 범위 정규화 (0.0-1.0)
    const normalizedConfidence = Math.min(Math.max(confidence, 0.0), 1.0);

    reasoning.push(
      `최종 신뢰도: ${(normalizedConfidence * 100).toFixed(1)}% ` +
      `(이름 25%×${(nameAnalysisConfidence * 100).toFixed(0)}, ` +
      `의미 35%×${(semanticAnalysisConfidence * 100).toFixed(0)}, ` +
      `컨텍스트 25%×${(contextConfidence * 100).toFixed(0)}, ` +
      `도메인 15%×${(domainEnhancementConfidence * 100).toFixed(0)})`
    );

    return {
      variableName,
      functionName,
      inferredType: baseType,
      enhancedType,
      domain,
      confidence: normalizedConfidence,
      nameAnalysisConfidence,
      semanticAnalysisConfidence,
      contextConfidence,
      domainEnhancementConfidence,
      reasoning,
      nameAnalysisDetails,
      semanticAnalysisDetails,
      contextDetails,
      domainEnhancementDetails: domain ? `타입 강화: ${baseType} → ${enhancedType}` : undefined,
      validationRules,
      strictnessLevel,
    };
  }

  /**
   * 함수 시그니처 추론 (입출력 타입)
   */
  public inferFunctionSignature(functionName: string, code: string) {
    const inference = this.inferTypes(functionName, code);

    const inputs = new Map<string, string>();
    const outputs = new Map<string, string>();

    for (const [varName, varInference] of inference.variables) {
      // 간단한 휴리스틱: 함수 초반에 나오는 변수는 input, 마지막은 output으로 간주
      if (varInference.enhancedType !== 'unknown') {
        inputs.set(varName, varInference.enhancedType);
      }
    }

    return {
      name: functionName,
      inputs,
      outputs,
      domain: inference.domain,
      confidence: inference.confidence,
    };
  }

  /**
   * 도메인별 변수 그룹화
   */
  public groupVariablesByDomain(functionTypeInference: FunctionTypeInference) {
    const groups = new Map<string, VariableTypeInference[]>();

    for (const variable of functionTypeInference.variables.values()) {
      const domain = variable.domain || 'unknown';
      if (!groups.has(domain)) {
        groups.set(domain, []);
      }
      groups.get(domain)!.push(variable);
    }

    return groups;
  }

  /**
   * 신뢰도 별 정렬 및 필터링
   */
  public filterByConfidence(
    variables: VariableTypeInference[],
    minConfidence: number = 0.5
  ): VariableTypeInference[] {
    return variables
      .filter(v => v.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 충돌하는 타입 감지
   * 같은 변수가 여러 도메인에서 다른 타입으로 추론된 경우
   */
  public detectTypeConflicts(functionTypeInference: FunctionTypeInference) {
    const conflicts: Array<{
      variable: string;
      domains: string[];
      types: string[];
    }> = [];

    for (const [varName, inference] of functionTypeInference.variables) {
      // 같은 변수가 다른 도메인에서 추론되었는지 확인
      const similar = Array.from(functionTypeInference.variables.values()).filter(
        v => v.variableName === varName && v.domain !== inference.domain
      );

      if (similar.length > 0) {
        const domains = [inference.domain || 'unknown', ...similar.map(s => s.domain || 'unknown')];
        const types = [inference.enhancedType, ...similar.map(s => s.enhancedType)];

        // 타입이 실제로 다른 경우만 충돌로 간주
        if (new Set(types).size > 1) {
          conflicts.push({
            variable: varName,
            domains: Array.from(new Set(domains)),
            types: Array.from(new Set(types)),
          });
        }
      }
    }

    return conflicts;
  }
}
