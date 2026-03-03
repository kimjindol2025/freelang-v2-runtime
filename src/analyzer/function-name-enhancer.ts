/**
 * Phase 4 Step 1: Function Name Enhancer
 *
 * 함수명의 의미를 분석하여 반환 타입 및 도메인 추론
 * 예: calculateTax() → [calculate, tax] → finance → decimal
 *     getPrice() → [get, price] → finance → currency
 *     isValid() → [is, valid] → boolean (predicate)
 */

export interface FunctionNameAnalysis {
  functionName: string;
  words: string[];
  verb?: string;                    // 첫 번째 동사 (calculate, get, is, etc)
  object?: string;                  // 주요 명사 (tax, price, valid, etc)
  returnTypeHint?: string;          // 추론된 반환 타입
  domainHint?: string;              // 도메인 추론
  confidence: number;               // 0.0-1.0
  isPredicate: boolean;             // is/has/can prefix 검사
  reasoning: string[];
}

/**
 * 함수명 강화 분석기
 */
export class FunctionNameEnhancer {
  /**
   * 술어 함수 접두사 (boolean 반환 패턴)
   */
  private predicatePrefixes = new Set([
    'is', 'has', 'can', 'should', 'will', 'might',
    'are', 'have', 'isnt', 'hasnt', 'arent', 'havent'
  ]);

  /**
   * 동사 → 타입 힌트 매핑
   */
  private verbToTypeHints = new Map<string, {
    returnType: string;
    confidence: number;
  }>([
    // Query verbs → 호출된 함수의 반환 타입
    ['get', { returnType: 'inferred', confidence: 0.7 }],
    ['fetch', { returnType: 'inferred', confidence: 0.7 }],
    ['retrieve', { returnType: 'inferred', confidence: 0.7 }],
    ['query', { returnType: 'unknown', confidence: 0.5 }],

    // Calculate verbs → number 계열
    ['calculate', { returnType: 'number', confidence: 0.85 }],
    ['compute', { returnType: 'number', confidence: 0.85 }],
    ['sum', { returnType: 'number', confidence: 0.9 }],
    ['total', { returnType: 'number', confidence: 0.9 }],
    ['count', { returnType: 'number', confidence: 0.9 }],
    ['measure', { returnType: 'number', confidence: 0.8 }],
    ['average', { returnType: 'number', confidence: 0.85 }],

    // Create verbs → object/string
    ['create', { returnType: 'object', confidence: 0.8 }],
    ['build', { returnType: 'object', confidence: 0.8 }],
    ['make', { returnType: 'object', confidence: 0.75 }],
    ['generate', { returnType: 'string', confidence: 0.75 }],
    ['produce', { returnType: 'object', confidence: 0.7 }],

    // Transform verbs → string
    ['format', { returnType: 'string', confidence: 0.9 }],
    ['serialize', { returnType: 'string', confidence: 0.85 }],
    ['parse', { returnType: 'object', confidence: 0.75 }],
    ['convert', { returnType: 'inferred', confidence: 0.7 }],
    ['transform', { returnType: 'inferred', confidence: 0.7 }],

    // Validation verbs → boolean
    ['validate', { returnType: 'boolean', confidence: 0.95 }],
    ['verify', { returnType: 'boolean', confidence: 0.95 }],
    ['check', { returnType: 'boolean', confidence: 0.9 }],
    ['test', { returnType: 'boolean', confidence: 0.85 }],

    // Array verbs → array
    ['filter', { returnType: 'array', confidence: 0.9 }],
    ['map', { returnType: 'array', confidence: 0.9 }],
    ['reduce', { returnType: 'inferred', confidence: 0.7 }],
    ['flatten', { returnType: 'array', confidence: 0.9 }],
    ['sort', { returnType: 'array', confidence: 0.9 }],
    ['merge', { returnType: 'array', confidence: 0.85 }],
  ]);

  /**
   * 명사 → 타입 힌트 매핑
   */
  private nounToTypeHints = new Map<string, {
    returnType: string;
    domain: string;
    confidence: number;
  }>([
    // Finance
    ['tax', { returnType: 'decimal', domain: 'finance', confidence: 0.95 }],
    ['price', { returnType: 'currency', domain: 'finance', confidence: 0.95 }],
    ['amount', { returnType: 'decimal', domain: 'finance', confidence: 0.9 }],
    ['total', { returnType: 'decimal', domain: 'finance', confidence: 0.9 }],
    ['cost', { returnType: 'decimal', domain: 'finance', confidence: 0.9 }],
    ['rate', { returnType: 'percentage', domain: 'finance', confidence: 0.85 }],
    ['fee', { returnType: 'decimal', domain: 'finance', confidence: 0.9 }],

    // Data Science
    ['vector', { returnType: 'array<number>', domain: 'data-science', confidence: 0.95 }],
    ['matrix', { returnType: 'array<array<number>>', domain: 'data-science', confidence: 0.95 }],
    ['tensor', { returnType: 'array<array<array<number>>>', domain: 'data-science', confidence: 0.9 }],
    ['dataset', { returnType: 'array<object>', domain: 'data-science', confidence: 0.9 }],
    ['model', { returnType: 'object', domain: 'data-science', confidence: 0.8 }],

    // Web
    ['email', { returnType: 'validated_string', domain: 'web', confidence: 0.95 }],
    ['url', { returnType: 'validated_string', domain: 'web', confidence: 0.95 }],
    ['phone', { returnType: 'validated_string', domain: 'web', confidence: 0.9 }],
    ['request', { returnType: 'object', domain: 'web', confidence: 0.85 }],
    ['response', { returnType: 'object', domain: 'web', confidence: 0.85 }],

    // Crypto
    ['hash', { returnType: 'hash_string', domain: 'crypto', confidence: 0.95 }],
    ['signature', { returnType: 'hash_string', domain: 'crypto', confidence: 0.95 }],
    ['cipher', { returnType: 'hash_string', domain: 'crypto', confidence: 0.9 }],
    ['key', { returnType: 'hash_string', domain: 'crypto', confidence: 0.9 }],
    ['token', { returnType: 'validated_string', domain: 'crypto', confidence: 0.9 }],

    // IoT
    ['sensor', { returnType: 'number', domain: 'iot', confidence: 0.85 }],
    ['reading', { returnType: 'number', domain: 'iot', confidence: 0.85 }],
    ['measurement', { returnType: 'number', domain: 'iot', confidence: 0.85 }],
    ['signal', { returnType: 'number', domain: 'iot', confidence: 0.8 }],
  ]);

  /**
   * 형용사 → 타입 힌트 매핑 (is/has prefix 후 형용사)
   */
  private adjectiveToTypeHints = new Map<string, {
    returnType: string;
    confidence: number;
  }>([
    ['valid', { returnType: 'boolean', confidence: 0.95 }],
    ['invalid', { returnType: 'boolean', confidence: 0.95 }],
    ['active', { returnType: 'boolean', confidence: 0.95 }],
    ['inactive', { returnType: 'boolean', confidence: 0.95 }],
    ['enabled', { returnType: 'boolean', confidence: 0.95 }],
    ['disabled', { returnType: 'boolean', confidence: 0.95 }],
    ['ready', { returnType: 'boolean', confidence: 0.9 }],
    ['empty', { returnType: 'boolean', confidence: 0.9 }],
    ['null', { returnType: 'boolean', confidence: 0.9 }],
    ['present', { returnType: 'boolean', confidence: 0.9 }],
    ['available', { returnType: 'boolean', confidence: 0.9 }],
    ['accessible', { returnType: 'boolean', confidence: 0.9 }],
    ['complete', { returnType: 'boolean', confidence: 0.85 }],
    ['finished', { returnType: 'boolean', confidence: 0.85 }],
  ]);

  /**
   * 함수명 분석
   */
  public analyzeFunctionName(functionName: string): FunctionNameAnalysis {
    // NameAnalyzer의 extractWords 패턴 재사용
    const words = this.extractWords(functionName);

    let verb: string | undefined;
    let object: string | undefined;
    let returnTypeHint: string | undefined;
    let domainHint: string | undefined;
    let confidence = 0.5;
    let isPredicate = false;
    const reasoning: string[] = [];

    // Step 1: Predicate 검사 (is/has/can prefix)
    if (words.length > 0) {
      const firstWord = words[0].toLowerCase();
      if (this.predicatePrefixes.has(firstWord)) {
        isPredicate = true;
        returnTypeHint = 'boolean';
        confidence = 0.95;
        verb = firstWord;

        reasoning.push(`Predicate function detected: "${firstWord}" prefix → boolean (confidence: 0.95)`);

        // is/has + adjective/noun 패턴
        if (words.length > 1) {
          object = words.slice(1).join('_').toLowerCase(); // 모든 나머지 단어를 object로 설정

          const firstNoun = words[1].toLowerCase();
          if (this.adjectiveToTypeHints.has(firstNoun)) {
            reasoning.push(`Adjective "${firstNoun}" confirms boolean return type`);
          } else {
            reasoning.push(`Object "${object}" analyzed as part of predicate`);
          }
        }

        return {
          functionName,
          words,
          verb,
          object,
          returnTypeHint,
          domainHint,
          confidence,
          isPredicate,
          reasoning
        };
      }
    }

    // Step 2: Verb 분석 (첫 단어)
    if (words.length > 0) {
      verb = words[0].toLowerCase();

      if (this.verbToTypeHints.has(verb)) {
        const hint = this.verbToTypeHints.get(verb)!;
        returnTypeHint = hint.returnType;
        confidence = Math.max(confidence, hint.confidence);
        reasoning.push(`Verb "${verb}" → return type: ${hint.returnType} (confidence: ${hint.confidence})`);
      }
    }

    // Step 3: Object 분석 (두 번째 단어 이후)
    if (words.length > 1) {
      object = words.slice(1).join('_').toLowerCase();

      // Verb에 따라 noun의 타입 사용 여부 결정
      // Validation 동사들은 항상 boolean을 반환 (noun 타입 무시)
      const validationVerbs = new Set(['validate', 'verify', 'check', 'test']);
      const shouldUseNounType = !validationVerbs.has(verb || '');

      if (this.nounToTypeHints.has(object)) {
        const hint = this.nounToTypeHints.get(object)!;

        if (shouldUseNounType) {
          // 동사가 validation 타입이 아니면, noun의 더 구체적인 타입 사용
          returnTypeHint = hint.returnType;
          domainHint = hint.domain;
          confidence = Math.max(confidence, hint.confidence);
          reasoning.push(`Noun "${object}" → type: ${hint.returnType}, domain: ${hint.domain} (confidence: ${hint.confidence})`);
        } else {
          // Validation 동사는 noun에 상관없이 boolean 유지
          domainHint = hint.domain; // 도메인 정보는 noun에서 가져옴
          reasoning.push(`Noun "${object}" detected (${hint.domain} domain), but ${verb} verb returns boolean`);
        }
      } else {
        // Partial matching: object가 여러 단어이면 각각 검사 (마지막 noun 우선)
        let lastMatchedHint: { returnType: string; domain: string; confidence: number } | null = null;
        let lastMatchedWord = '';

        for (const word of words.slice(1)) {
          const wordLower = word.toLowerCase();
          if (this.nounToTypeHints.has(wordLower)) {
            lastMatchedHint = this.nounToTypeHints.get(wordLower)!;
            lastMatchedWord = wordLower;
          }
        }

        if (lastMatchedHint) {
          if (shouldUseNounType) {
            returnTypeHint = lastMatchedHint.returnType;
            domainHint = lastMatchedHint.domain;
            confidence = Math.max(confidence, lastMatchedHint.confidence * 0.8); // Partial match penalty
            reasoning.push(`Partial noun match: "${lastMatchedWord}" → type: ${lastMatchedHint.returnType}, domain: ${lastMatchedHint.domain}`);
          } else {
            domainHint = lastMatchedHint.domain;
            reasoning.push(`Partial noun match: "${lastMatchedWord}" (${lastMatchedHint.domain} domain), but ${verb} verb returns boolean`);
          }
        }
      }
    }

    // Step 4: 신뢰도 정규화
    confidence = Math.min(0.95, confidence);

    return {
      functionName,
      words,
      verb,
      object,
      returnTypeHint,
      domainHint,
      confidence,
      isPredicate,
      reasoning
    };
  }

  /**
   * camelCase/snake_case 단어 추출
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
        .map(w => w.toLowerCase().replace(/\d+/g, '')) // 숫자 제거
        .filter(w => w.length > 0); // 숫자만 있던 부분 제거
    }

    // camelCase 처리
    const words = identifier
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      .split(/\s+/)
      .filter(w => w.length > 0)
      .map(w => w.toLowerCase().replace(/\d+/g, '')) // 숫자 제거
      .filter(w => w.length > 0); // 숫자만 있던 부분 제거

    return words;
  }

  /**
   * 함수명 모음 분석
   */
  public analyzeFunctions(functionNames: string[]): FunctionNameAnalysis[] {
    return functionNames.map(name => this.analyzeFunctionName(name));
  }

  /**
   * 특정 동사가 어떤 타입을 반환하는지 조회
   */
  public getVerbTypeHint(verb: string): { returnType: string; confidence: number } | null {
    return this.verbToTypeHints.get(verb.toLowerCase()) || null;
  }

  /**
   * 특정 명사가 어떤 타입을 반환하는지 조회
   */
  public getNounTypeHint(noun: string): {
    returnType: string;
    domain: string;
    confidence: number;
  } | null {
    return this.nounToTypeHints.get(noun.toLowerCase()) || null;
  }

  /**
   * 술어 함수 여부 검사
   */
  public isPredicate(functionName: string): boolean {
    const words = this.extractWords(functionName);
    return words.length > 0 && this.predicatePrefixes.has(words[0].toLowerCase());
  }

  /**
   * 정확한 타입 힌트 추출 (높은 신뢰도만)
   */
  public getHighConfidenceTypeHint(
    functionName: string,
    minConfidence: number = 0.8
  ): string | null {
    const analysis = this.analyzeFunctionName(functionName);

    if (analysis.confidence >= minConfidence && analysis.returnTypeHint) {
      return analysis.returnTypeHint;
    }

    return null;
  }
}
