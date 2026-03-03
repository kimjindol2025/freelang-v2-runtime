/**
 * Phase 4 Step 2: Variable Name Enhancer
 *
 * 변수명의 의미를 분석하여 타입 추론
 * 예: tax → 세금 → finance 도메인 → decimal 타입
 *     isActive → 상태값 → boolean
 *     email_list → 이메일 배열 → array<validated_string>
 */

export interface VariableNameAnalysis {
  variableName: string;
  words: string[];
  baseWord?: string;                // 주요 단어 (tax, email, count, etc)
  prefix?: string;                  // 접두사 (is, has, can, etc)
  suffix?: string;                  // 접미사 (count, list, array, etc)
  inferredType?: string;            // 추론된 타입
  domain?: string;                  // 도메인
  confidence: number;               // 0.0-1.0
  reasoning: string[];
}

/**
 * 변수명 강화 분석기
 */
export class VariableNameEnhancer {
  /**
   * Boolean 접두사
   */
  private booleanPrefixes = new Set([
    'is', 'has', 'can', 'should', 'will', 'might', 'must'
  ]);

  /**
   * 숫자 접미사
   */
  private numberSuffixes = new Set([
    'count', 'size', 'length', 'index', 'idx', 'id',
    'num', 'amount', 'total', 'sum', 'max', 'min',
    'value', 'rate', 'percentage', 'age', 'year',
    'month', 'day', 'hour', 'minute', 'second'
  ]);

  /**
   * 배열 접미사
   */
  private arraySuffixes = new Set([
    'list', 'array', 'items', 'elements', 'collection',
    'data', 'set', 'group', 'batch', 'cluster'
  ]);

  /**
   * 객체 접미사
   */
  private objectSuffixes = new Set([
    'map', 'dict', 'object', 'info', 'details', 'meta',
    'config', 'settings', 'options', 'params', 'args'
  ]);

  /**
   * 문자열 접미사
   */
  private stringSuffixes = new Set([
    'name', 'title', 'text', 'message', 'content', 'body',
    'path', 'route', 'url', 'href', 'key', 'label'
  ]);

  /**
   * 변수명 → 타입 매핑 (정확 매칭)
   */
  private variableTypeHints = new Map<string, {
    type: string;
    domain?: string;
    confidence: number;
  }>([
    // Numbers
    ['count', { type: 'number', confidence: 0.95 }],
    ['size', { type: 'number', confidence: 0.95 }],
    ['length', { type: 'number', confidence: 0.95 }],
    ['index', { type: 'number', confidence: 0.95 }],
    ['id', { type: 'number', confidence: 0.9 }],
    ['num', { type: 'number', confidence: 0.9 }],
    ['total', { type: 'decimal', domain: 'finance', confidence: 0.95 }],
    ['sum', { type: 'number', confidence: 0.95 }],
    ['amount', { type: 'decimal', domain: 'finance', confidence: 0.95 }],
    ['price', { type: 'currency', domain: 'finance', confidence: 0.95 }],
    ['tax', { type: 'decimal', domain: 'finance', confidence: 0.95 }],
    ['cost', { type: 'decimal', domain: 'finance', confidence: 0.95 }],
    ['rate', { type: 'percentage', domain: 'finance', confidence: 0.9 }],

    // Arrays
    ['list', { type: 'array', confidence: 0.95 }],
    ['array', { type: 'array', confidence: 0.95 }],
    ['items', { type: 'array', confidence: 0.95 }],
    ['data', { type: 'array', confidence: 0.8 }],
    ['vector', { type: 'array<number>', domain: 'data-science', confidence: 0.95 }],
    ['matrix', { type: 'array<array<number>>', domain: 'data-science', confidence: 0.95 }],
    ['tensor', { type: 'array<array<array<number>>>', domain: 'data-science', confidence: 0.9 }],

    // Strings & Web
    ['email', { type: 'validated_string', domain: 'web', confidence: 0.95 }],
    ['url', { type: 'validated_string', domain: 'web', confidence: 0.95 }],
    ['name', { type: 'string', confidence: 0.9 }],
    ['title', { type: 'string', confidence: 0.85 }],
    ['text', { type: 'string', confidence: 0.85 }],
    ['message', { type: 'string', confidence: 0.85 }],

    // Crypto
    ['hash', { type: 'hash_string', domain: 'crypto', confidence: 0.95 }],
    ['signature', { type: 'hash_string', domain: 'crypto', confidence: 0.95 }],
    ['key', { type: 'hash_string', domain: 'crypto', confidence: 0.9 }],
    ['token', { type: 'validated_string', domain: 'crypto', confidence: 0.9 }],

    // IoT
    ['sensor', { type: 'number', domain: 'iot', confidence: 0.85 }],
    ['reading', { type: 'number', domain: 'iot', confidence: 0.85 }],
    ['measurement', { type: 'number', domain: 'iot', confidence: 0.85 }],
  ]);

  /**
   * 변수명 분석
   */
  public analyzeVariableName(variableName: string): VariableNameAnalysis {
    const words = this.extractWords(variableName);

    let prefix: string | undefined;
    let baseWord: string | undefined;
    let suffix: string | undefined;
    let inferredType: string | undefined;
    let domain: string | undefined;
    let confidence = 0.5;
    const reasoning: string[] = [];

    // Step 1: Boolean 접두사 검사
    if (words.length > 0) {
      const firstWord = words[0].toLowerCase();
      if (this.booleanPrefixes.has(firstWord)) {
        prefix = firstWord;
        inferredType = 'boolean';
        confidence = 0.95;
        reasoning.push(`Boolean prefix detected: "${prefix}" → boolean (confidence: 0.95)`);

        if (words.length > 1) {
          baseWord = words.slice(1).join('_').toLowerCase();
        }

        return {
          variableName,
          words,
          prefix,
          baseWord,
          suffix,
          inferredType,
          domain,
          confidence,
          reasoning
        };
      }
    }

    // Step 2: 전체 변수명에서 정확 매칭 (가장 높은 신뢰도)
    const lowerName = variableName.toLowerCase();
    if (this.variableTypeHints.has(lowerName)) {
      const hint = this.variableTypeHints.get(lowerName)!;
      inferredType = hint.type;
      domain = hint.domain;
      confidence = Math.max(confidence, hint.confidence);
      baseWord = lowerName;
      reasoning.push(`Exact match: "${lowerName}" → type: ${hint.type} (confidence: ${hint.confidence})`);

      return {
        variableName,
        words,
        prefix,
        baseWord,
        suffix,
        inferredType,
        domain,
        confidence,
        reasoning
      };
    }

    // Step 3: 접미사 분석
    if (words.length > 0) {
      const lastWord = words[words.length - 1].toLowerCase();
      baseWord = words[0].toLowerCase();

      // Number 접미사
      if (this.numberSuffixes.has(lastWord)) {
        suffix = lastWord;
        inferredType = 'number';
        confidence = Math.max(confidence, 0.85);
        reasoning.push(`Number suffix detected: "${suffix}" → number (confidence: 0.85)`);
      }
      // Array 접미사
      else if (this.arraySuffixes.has(lastWord)) {
        suffix = lastWord;
        inferredType = 'array';
        confidence = Math.max(confidence, 0.85);
        reasoning.push(`Array suffix detected: "${suffix}" → array (confidence: 0.85)`);
      }
      // Object 접미사
      else if (this.objectSuffixes.has(lastWord)) {
        suffix = lastWord;
        inferredType = 'object';
        confidence = Math.max(confidence, 0.8);
        reasoning.push(`Object suffix detected: "${suffix}" → object (confidence: 0.8)`);
      }
      // String 접미사
      else if (this.stringSuffixes.has(lastWord)) {
        suffix = lastWord;
        inferredType = 'string';
        confidence = Math.max(confidence, 0.8);
        reasoning.push(`String suffix detected: "${suffix}" → string (confidence: 0.8)`);
      }
    }

    // Step 4: 기본 단어에서 타입 추론
    if (baseWord) {
      const baseWordLower = baseWord.toLowerCase();
      if (this.variableTypeHints.has(baseWordLower)) {
        const hint = this.variableTypeHints.get(baseWordLower)!;

        // 접미사와 기본 단어가 충돌하는 경우
        if (suffix && inferredType && inferredType !== hint.type) {
          // suffix가 이미 type을 설정했으면, 기본 단어는 domain만 추가
          domain = domain || hint.domain;
          reasoning.push(
            `Base word "${baseWord}" suggests ${hint.type}, but suffix "${suffix}" → ${inferredType}. ` +
            `Using suffix type. Domain from base word: ${hint.domain}`
          );
        } else {
          // 접미사가 없으면 기본 단어의 타입 사용
          inferredType = hint.type;
          domain = hint.domain;
          confidence = Math.max(confidence, hint.confidence);
          reasoning.push(`Base word "${baseWord}" → type: ${hint.type}, domain: ${hint.domain} (confidence: ${hint.confidence})`);
        }
      }
    }

    // Step 5: 신뢰도 정규화
    confidence = Math.min(0.95, Math.max(0.0, confidence));

    return {
      variableName,
      words,
      prefix,
      baseWord,
      suffix,
      inferredType,
      domain,
      confidence,
      reasoning
    };
  }

  /**
   * snake_case/camelCase 단어 추출
   */
  private extractWords(identifier: string): string[] {
    if (!identifier || identifier.length === 0) {
      return [];
    }

    // snake_case 처리
    if (identifier.includes('_')) {
      return identifier
        .split('_')
        .filter(w => w.length > 0)
        .map(w => w.toLowerCase());
    }

    // camelCase 처리
    const words = identifier
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      .split(/\s+/)
      .filter(w => w.length > 0)
      .map(w => w.toLowerCase());

    return words;
  }

  /**
   * 여러 변수명 분석
   */
  public analyzeVariables(variableNames: string[]): VariableNameAnalysis[] {
    return variableNames.map(name => this.analyzeVariableName(name));
  }

  /**
   * 특정 단어가 어떤 타입을 나타내는지 조회
   */
  public getWordTypeHint(word: string): {
    type: string;
    domain?: string;
    confidence: number;
  } | null {
    return this.variableTypeHints.get(word.toLowerCase()) || null;
  }

  /**
   * 높은 신뢰도의 타입 힌트만 추출
   */
  public getHighConfidenceTypeHint(
    variableName: string,
    minConfidence: number = 0.8
  ): string | null {
    const analysis = this.analyzeVariableName(variableName);

    if (analysis.confidence >= minConfidence && analysis.inferredType) {
      return analysis.inferredType;
    }

    return null;
  }

  /**
   * 변수명이 boolean 타입인지 검사
   */
  public isBoolean(variableName: string): boolean {
    const analysis = this.analyzeVariableName(variableName);
    return analysis.inferredType === 'boolean';
  }

  /**
   * 변수명이 배열 타입인지 검사
   */
  public isArray(variableName: string): boolean {
    const analysis = this.analyzeVariableName(variableName);
    return analysis.inferredType?.startsWith('array') || false;
  }

  /**
   * 변수명이 숫자 타입인지 검사
   */
  public isNumeric(variableName: string): boolean {
    const analysis = this.analyzeVariableName(variableName);
    return (
      analysis.inferredType === 'number' ||
      analysis.inferredType === 'decimal' ||
      analysis.inferredType === 'percentage' ||
      analysis.inferredType === 'currency'
    );
  }
}
