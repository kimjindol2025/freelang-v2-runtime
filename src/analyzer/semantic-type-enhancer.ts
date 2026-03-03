/**
 * Phase 3 Stage 3 - Semantic Type Enhancer
 *
 * 도메인 컨텍스트 기반 타입 강화
 * 예: number (finance) → decimal
 * 예: string (web, 'email') → validated_string
 */

import { DomainKnowledgeBase } from '../knowledge/domain-knowledge-base';

export interface TypeEnhancement {
  originalType: string;      // 원본 타입 (number)
  enhancedType: string;      // 강화된 타입 (decimal)
  domain: string;            // 도메인 (finance)
  confidence: number;        // 신뢰도 (0.0-1.0)
  reasoning: string[];       // 추론 과정
}

export interface DomainInference {
  domain: string;
  confidence: number;
  evidence: string[];
}

export interface StrictTypeResult {
  strictType: string;
  validationRules: string[];
  rationale: string;
}

export class SemanticTypeEnhancer {
  private knowledgeBase: DomainKnowledgeBase;

  /**
   * 도메인별 기본 타입 강화 규칙
   */
  private enhancementRules = new Map<string, Map<string, string>>([
    // Finance domain
    ['finance', new Map([
      ['number', 'decimal'],
      ['string', 'validated_string'],
      ['bool', 'bool'],
      ['array<number>', 'array<decimal>'],
    ])],
    // Data Science domain
    ['data-science', new Map([
      ['number', 'number'],
      ['array', 'array<number>'],
      ['array<number>', 'array<number>'],
      ['string', 'string'],
    ])],
    // Web domain
    ['web', new Map([
      ['string', 'validated_string'],
      ['number', 'integer'],
      ['array', 'array<object>'],
    ])],
    // Crypto domain
    ['crypto', new Map([
      ['string', 'hash_string'],
      ['number', 'number'],
      ['array', 'array<hash_string>'],
    ])],
    // IoT domain
    ['iot', new Map([
      ['number', 'number'],
      ['string', 'string'],
      ['array<number>', 'array<number>'],
    ])],
  ]);

  /**
   * 엄격성 수준별 검증 규칙
   */
  private validationRulesMap = new Map<string, string[]>([
    ['decimal', ['non-negative', 'precision-2', 'no-floating-point-errors']],
    ['currency', ['non-negative', 'ISO-4217', 'exact-amount']],
    ['percentage', ['range-0-100', 'precision-2']],
    ['validated_string', ['format-validation', 'length-check', 'character-whitelist']],
    ['hash_string', ['hex-format', 'no-plaintext', 'fixed-length']],
    ['integer', ['whole-number', 'range-check']],
  ]);

  constructor() {
    this.knowledgeBase = new DomainKnowledgeBase();
  }

  /**
   * 함수명/변수명/연산으로부터 도메인 추론
   */
  public inferDomain(
    functionName: string,
    variableNames: string[],
    operations: string[]
  ): DomainInference | null {
    const context = {
      functionName,
      variableNames,
      operations,
    };

    const result = this.knowledgeBase.detectDomain(context);

    if (!result) {
      return null;
    }

    return {
      domain: result.domain,
      confidence: result.confidence,
      evidence: result.evidence,
    };
  }

  /**
   * 기본 타입을 도메인에 맞게 강화
   * 예: number (finance) → decimal
   */
  public enhanceType(
    baseType: string,
    domain: string,
    variableName?: string
  ): TypeEnhancement {
    const rules = this.enhancementRules.get(domain);

    if (!rules || !rules.has(baseType)) {
      // 규칙이 없으면 원본 타입 유지
      return {
        originalType: baseType,
        enhancedType: baseType,
        domain,
        confidence: 0.5,
        reasoning: [`No enhancement rule for ${baseType} in ${domain} domain`],
      };
    }

    const enhancedType = rules.get(baseType) || baseType;

    // 신뢰도 계산
    let confidence = 0.85;
    if (variableName) {
      const typeHint = this.knowledgeBase.inferTypeFromName(variableName, domain);
      if (typeHint && typeHint === enhancedType) {
        confidence = 0.95;  // 변수명도 일치하면 신뢰도 증가
      }
    }

    return {
      originalType: baseType,
      enhancedType,
      domain,
      confidence,
      reasoning: [
        `Base type: ${baseType}`,
        `Domain: ${domain}`,
        `Enhancement rule: ${baseType} → ${enhancedType}`,
        variableName ? `Variable name hint: ${variableName}` : '',
      ].filter(s => s.length > 0),
    };
  }

  /**
   * 변수명으로부터 도메인별 타입 매핑
   * 예: 'tax' (finance) → 'decimal'
   */
  public mapDomainType(variableName: string, domain: string): string | null {
    return this.knowledgeBase.inferTypeFromName(variableName, domain);
  }

  /**
   * 도메인 엄격성에 따른 타입 강화
   */
  public getStrictType(baseType: string, domain: string): StrictTypeResult {
    // 먼저 기본 강화
    const enhancement = this.enhanceType(baseType, domain);
    const strictType = enhancement.enhancedType;

    // 검증 규칙 조회
    const validationRules = this.knowledgeBase.getValidationRules(domain, strictType);

    // 도메인 정의 조회
    const domainDef = this.knowledgeBase.getDomain(domain);
    const strictnessLevel = domainDef?.strictnessLevel || 'moderate';

    let rationale = '';
    if (strictnessLevel === 'strict') {
      rationale = `${domain} domain requires strict type: ${strictType} with validation: ${validationRules?.join(', ') || 'standard'}`;
    } else {
      rationale = `${domain} domain uses moderate strictness: ${strictType}`;
    }

    return {
      strictType,
      validationRules: validationRules || [],
      rationale,
    };
  }

  /**
   * 여러 정보를 통합하여 최종 타입 결정
   */
  public inferTypeWithContext(
    baseType: string,
    functionName: string,
    variableName: string,
    operations: string[]
  ): {
    finalType: string;
    domain: string;
    confidence: number;
    enhancement: TypeEnhancement;
  } | null {
    // Step 1: 도메인 추론
    const domainInference = this.inferDomain(
      functionName,
      [variableName],
      operations
    );

    if (!domainInference) {
      // 도메인 추론 실패 → 기본 타입 반환
      return null;
    }

    // Step 2: 타입 강화
    const enhancement = this.enhanceType(
      baseType,
      domainInference.domain,
      variableName
    );

    // Step 3: 신뢰도 계산
    const finalConfidence = (domainInference.confidence + enhancement.confidence) / 2;

    return {
      finalType: enhancement.enhancedType,
      domain: domainInference.domain,
      confidence: finalConfidence,
      enhancement,
    };
  }

  /**
   * 검증 규칙 조회 (외부 사용)
   */
  public getValidationRules(domain: string, type: string): string[] | null {
    return this.knowledgeBase.getValidationRules(domain, type);
  }

  /**
   * 모든 도메인 조회
   */
  public getAllDomains() {
    return this.knowledgeBase.getAllDomains();
  }
}
