/**
 * Phase 3 Stage 3 - Domain Knowledge Base
 *
 * 도메인별 지식 저장소: 5개 내장 도메인 정의
 * - Finance: 금융 (tax, price, amount → decimal, currency)
 * - Data Science: 데이터 과학 (vector, matrix → array<number>)
 * - Web: 웹 개발 (url, email → validated_string)
 * - Crypto: 암호화 (hash, signature → hash_string)
 * - IoT: IoT (sensor, device → number)
 */

/**
 * 도메인 정의
 */
export interface DomainDefinition {
  name: string;                      // 도메인 이름
  keywords: string[];                // 트리거 키워드
  typeMapping: Map<string, string>;  // 변수명 패턴 → 타입
  strictnessLevel: 'relaxed' | 'moderate' | 'strict';
  validationRules?: Map<string, string[]>;  // 타입별 검증 규칙
}

/**
 * 도메인 지식 기반
 */
export class DomainKnowledgeBase {
  private domains: Map<string, DomainDefinition>;
  private defaultDomain: string = 'general';

  constructor() {
    this.domains = new Map();
    this.initializeBuiltInDomains();
  }

  /**
   * 내장 도메인 초기화 (5개)
   */
  private initializeBuiltInDomains(): void {
    // Domain 1: Finance
    this.registerDomain({
      name: 'finance',
      keywords: [
        'tax', 'price', 'amount', 'balance', 'cost', 'revenue',
        'expense', 'income', 'fee', 'rate', 'commission', 'salary',
        'payment', 'transaction', 'invoice', 'account', 'credit', 'debit',
        'calculate', 'compute', 'compute_tax', 'calculate_price'
      ],
      typeMapping: new Map([
        ['tax', 'decimal'],
        ['price', 'currency'],
        ['amount', 'decimal'],
        ['balance', 'decimal'],
        ['cost', 'decimal'],
        ['revenue', 'decimal'],
        ['rate', 'percentage'],
        ['commission', 'decimal'],
        ['salary', 'currency'],
        ['fee', 'decimal'],
        ['payment', 'currency'],
        ['total', 'decimal'],
        ['subtotal', 'decimal'],
      ]),
      strictnessLevel: 'strict',
      validationRules: new Map([
        ['decimal', ['non-negative', 'precision-2']],
        ['currency', ['non-negative', 'ISO-4217']],
        ['percentage', ['range-0-100', 'precision-2']],
      ]),
    });

    // Domain 2: Data Science
    this.registerDomain({
      name: 'data-science',
      keywords: [
        'vector', 'matrix', 'tensor', 'dataset', 'model', 'feature',
        'train', 'predict', 'classify', 'cluster', 'dimension', 'array',
        'data', 'sample', 'batch', 'epoch', 'parameter', 'weight',
        'gradient', 'loss', 'accuracy', 'metric', 'filter', 'aggregate'
      ],
      typeMapping: new Map([
        ['vector', 'array<number>'],
        ['matrix', 'array<array<number>>'],
        ['tensor', 'array<array<array<number>>>'],
        ['dataset', 'array<object>'],
        ['model', 'object'],
        ['feature', 'array<number>'],
        ['dimension', 'number'],
        ['sample', 'object'],
        ['batch', 'array<object>'],
        ['parameter', 'number'],
        ['weight', 'array<number>'],
        ['loss', 'number'],
        ['accuracy', 'percentage'],
        ['data', 'array<number> | array<object>'],
      ]),
      strictnessLevel: 'moderate',
      validationRules: new Map([
        ['array<number>', ['numeric-values']],
        ['percentage', ['range-0-100']],
      ]),
    });

    // Domain 3: Web
    this.registerDomain({
      name: 'web',
      keywords: [
        'url', 'email', 'phone', 'request', 'response', 'cookie',
        'session', 'token', 'header', 'body', 'query', 'param',
        'route', 'endpoint', 'api', 'rest', 'http', 'https',
        'validate', 'parse', 'format', 'encode', 'decode'
      ],
      typeMapping: new Map([
        ['url', 'validated_string'],
        ['email', 'validated_string'],
        ['phone', 'validated_string'],
        ['request', 'object'],
        ['response', 'object'],
        ['cookie', 'object'],
        ['session', 'object'],
        ['token', 'validated_string'],
        ['header', 'object'],
        ['body', 'object'],
        ['query', 'object'],
        ['param', 'string'],
        ['route', 'string'],
        ['endpoint', 'string'],
      ]),
      strictnessLevel: 'moderate',
      validationRules: new Map([
        ['url', ['RFC-3986']],
        ['email', ['RFC-5322']],
        ['phone', ['E.164-format']],
      ]),
    });

    // Domain 4: Crypto
    this.registerDomain({
      name: 'crypto',
      keywords: [
        'hash', 'signature', 'key', 'cipher', 'encrypt', 'decrypt',
        'sign', 'verify', 'public', 'private', 'nonce', 'salt',
        'hmac', 'sha', 'aes', 'rsa', 'ecc', 'blake'
      ],
      typeMapping: new Map([
        ['hash', 'hash_string'],
        ['signature', 'hash_string'],
        ['key', 'hash_string'],
        ['cipher', 'hash_string'],
        ['encrypted', 'hash_string'],
        ['decrypted', 'string'],
        ['nonce', 'hash_string'],
        ['salt', 'hash_string'],
        ['hmac', 'hash_string'],
      ]),
      strictnessLevel: 'strict',
      validationRules: new Map([
        ['hash_string', ['no-plaintext', 'hex-format']],
      ]),
    });

    // Domain 5: IoT
    this.registerDomain({
      name: 'iot',
      keywords: [
        'sensor', 'device', 'signal', 'reading', 'measurement', 'telemetry',
        'actuator', 'control', 'threshold', 'alert', 'status', 'state',
        'firmware', 'hardware', 'protocol', 'gateway', 'network'
      ],
      typeMapping: new Map([
        ['sensor', 'number'],
        ['device', 'object'],
        ['signal', 'number'],
        ['reading', 'number'],
        ['measurement', 'number'],
        ['value', 'number'],
        ['status', 'string'],
        ['state', 'string'],
        ['threshold', 'number'],
        ['temperature', 'number'],
        ['humidity', 'percentage'],
        ['pressure', 'number'],
      ]),
      strictnessLevel: 'moderate',
      validationRules: new Map([
        ['number', ['sensor-range']],
        ['percentage', ['range-0-100']],
      ]),
    });
  }

  /**
   * 도메인 등록 (확장성)
   */
  public registerDomain(domain: DomainDefinition): void {
    if (!domain.name || domain.name.length === 0) {
      throw new Error('Domain name cannot be empty');
    }
    this.domains.set(domain.name, domain);
  }

  /**
   * 도메인 감지
   *
   * 함수명, 변수명, 연산에서 도메인 키워드를 매칭
   */
  public detectDomain(context: {
    functionName: string;
    variableNames: string[];
    operations: string[];
  }): {
    domain: string;
    confidence: number;
    evidence: string[];
  } | null {
    if (!context || (!context.functionName && context.variableNames.length === 0)) {
      return null;
    }

    const allText = [
      context.functionName,
      ...context.variableNames,
      ...context.operations,
    ]
      .join(' ')
      .toLowerCase();

    // 각 도메인의 키워드 매칭 점수 계산
    let bestDomain: string | null = null;
    let bestScore = 0;
    let evidence: string[] = [];

    for (const [domainName, domain] of this.domains) {
      let score = 0;
      const domainEvidence: string[] = [];

      for (const keyword of domain.keywords) {
        const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = allText.match(keywordRegex);
        if (matches) {
          score += matches.length;
          domainEvidence.push(`keyword "${keyword}" found ${matches.length}x`);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestDomain = domainName;
        evidence = domainEvidence;
      }
    }

    if (!bestDomain || bestScore === 0) {
      return null;
    }

    // 신뢰도: 매칭된 키워드 개수 기반
    // 1-2개 키워드: 0.6, 3-4개: 0.8, 5+개: 0.95
    let confidence = 0.6;
    if (bestScore >= 5) {
      confidence = 0.95;
    } else if (bestScore >= 3) {
      confidence = 0.8;
    }

    return {
      domain: bestDomain,
      confidence,
      evidence,
    };
  }

  /**
   * 도메인의 타입 매핑 조회
   */
  public getTypeMapping(domain: string): Map<string, string> | null {
    const domainDef = this.domains.get(domain);
    return domainDef ? domainDef.typeMapping : null;
  }

  /**
   * 도메인별 검증 규칙 조회
   */
  public getValidationRules(domain: string, type: string): string[] | null {
    const domainDef = this.domains.get(domain);
    if (!domainDef || !domainDef.validationRules) {
      return null;
    }
    return domainDef.validationRules.get(type) || null;
  }

  /**
   * 도메인 조회
   */
  public getDomain(name: string): DomainDefinition | null {
    return this.domains.get(name) || null;
  }

  /**
   * 등록된 모든 도메인 조회
   */
  public getAllDomains(): Map<string, DomainDefinition> {
    return new Map(this.domains);
  }

  /**
   * 변수명으로 타입 추론
   * 예: 'tax' (finance domain) → 'decimal'
   */
  public inferTypeFromName(
    variableName: string,
    domain: string
  ): string | null {
    const typeMapping = this.getTypeMapping(domain);
    if (!typeMapping) {
      return null;
    }

    const lowerName = variableName.toLowerCase();

    // 정확 매칭 (confidence: 0.95)
    if (typeMapping.has(lowerName)) {
      return typeMapping.get(lowerName) || null;
    }

    // 부분 매칭 (변수명이 키를 포함하는 경우)
    for (const [key, type] of typeMapping) {
      if (lowerName.includes(key) || key.includes(lowerName)) {
        return type;
      }
    }

    return null;
  }
}

/**
 * Export 기본 도메인들 (테스트/참조용)
 */
export const DOMAIN_NAMES = {
  FINANCE: 'finance',
  DATA_SCIENCE: 'data-science',
  WEB: 'web',
  CRYPTO: 'crypto',
  IOT: 'iot',
};
