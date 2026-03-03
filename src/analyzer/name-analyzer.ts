/**
 * Phase 3 Stage 3 - Name Analyzer
 *
 * 함수명/변수명을 분석하여 의미를 추출합니다:
 * - camelCase/snake_case 파싱
 * - 단어별 의미 분류 (verb/noun/adjective)
 * - 타입 힌트 추론
 * - Intent 추론
 */

export interface NameParts {
  original: string;
  words: string[];
  isFunction: boolean;
  isVariable: boolean;
  verbPhrase?: string;
  nounPhrase?: string;
}

export interface WordSemantics {
  word: string;
  role: 'verb' | 'noun' | 'adjective' | 'unknown';
  typeHint?: string;
  domainHint?: string;
  confidence: number;
}

export interface IntentInference {
  intent: string;
  domain?: string;
  confidence: number;
  reasoning: string[];
}

export class NameAnalyzer {
  /**
   * 동사 딕셔너리 (50개)
   */
  private verbs = new Set([
    'get', 'set', 'add', 'remove', 'delete', 'create', 'make', 'build',
    'calculate', 'compute', 'transform', 'convert', 'parse', 'format',
    'validate', 'verify', 'check', 'find', 'search', 'filter', 'map',
    'reduce', 'aggregate', 'join', 'split', 'merge', 'sort', 'order',
    'encrypt', 'decrypt', 'encode', 'decode', 'hash', 'sign', 'verify',
    'generate', 'produce', 'create', 'initialize', 'init', 'start', 'stop',
    'process', 'handle', 'execute', 'run', 'invoke', 'call', 'apply',
    'serialize', 'deserialize', 'write', 'read', 'save', 'load', 'fetch',
  ]);

  /**
   * 명사 딕셔너리 (80개)
   */
  private nouns = new Set([
    'user', 'admin', 'guest', 'account', 'profile', 'setting',
    'data', 'item', 'element', 'entry', 'record', 'value', 'object',
    'array', 'list', 'collection', 'set', 'map', 'hash', 'table',
    'string', 'text', 'message', 'content', 'body', 'header',
    'request', 'response', 'query', 'result', 'output', 'input',
    'error', 'exception', 'warning', 'info', 'log', 'trace',
    'price', 'cost', 'tax', 'amount', 'balance', 'total', 'sum', 'count',
    'vector', 'matrix', 'tensor', 'dimension', 'shape', 'size', 'length',
    'email', 'phone', 'address', 'name', 'id', 'key', 'token',
    'hash', 'signature', 'cipher', 'password', 'salt', 'nonce',
    'sensor', 'device', 'signal', 'reading', 'measurement', 'state', 'status',
    'database', 'cache', 'store', 'file', 'document', 'node', 'edge',
  ]);

  /**
   * 형용사 딕셔너리 (30개)
   */
  private adjectives = new Set([
    'valid', 'invalid', 'new', 'old', 'active', 'inactive', 'enable', 'disable',
    'public', 'private', 'protected', 'internal', 'external', 'local', 'global',
    'primary', 'secondary', 'main', 'default', 'custom', 'standard', 'special',
    'async', 'sync', 'fast', 'slow', 'safe', 'unsafe', 'strict', 'loose',
  ]);

  /**
   * 타입 힌트 딕셔너리
   * 변수명 패턴 → 타입
   */
  private typeHints = new Map<string, string>([
    // Numbers
    ['count', 'number'],
    ['size', 'number'],
    ['length', 'number'],
    ['index', 'number'],
    ['id', 'number'],
    ['price', 'decimal'],
    ['tax', 'decimal'],
    ['amount', 'decimal'],
    ['total', 'decimal'],
    ['sum', 'number'],
    ['value', 'number'],
    ['rate', 'percentage'],
    ['percentage', 'percentage'],
    ['age', 'number'],
    ['temperature', 'number'],
    ['humidity', 'percentage'],
    ['year', 'number'],
    ['month', 'number'],
    ['day', 'number'],
    // Arrays/Collections
    ['list', 'array'],
    ['array', 'array'],
    ['collection', 'array'],
    ['items', 'array'],
    ['elements', 'array'],
    ['data', 'array'],
    ['vector', 'array<number>'],
    ['matrix', 'array<array<number>>'],
    ['tensor', 'array<array<array<number>>>'],
    ['items_list', 'array'],
    // Strings
    ['name', 'string'],
    ['title', 'string'],
    ['text', 'string'],
    ['message', 'string'],
    ['content', 'string'],
    ['body', 'string'],
    ['email', 'validated_string'],
    ['url', 'validated_string'],
    ['path', 'string'],
    ['key', 'string'],
    ['token', 'validated_string'],
    // Booleans
    ['is_valid', 'bool'],
    ['is_active', 'bool'],
    ['is_enabled', 'bool'],
    ['can_proceed', 'bool'],
    ['should_process', 'bool'],
    ['is_ready', 'bool'],
    ['has_error', 'bool'],
  ]);

  /**
   * 도메인 힌트 딕셔너리
   * 단어 → 도메인
   */
  private domainHints = new Map<string, string>([
    // Finance
    ['tax', 'finance'],
    ['price', 'finance'],
    ['amount', 'finance'],
    ['total', 'finance'],
    ['cost', 'finance'],
    ['revenue', 'finance'],
    ['balance', 'finance'],
    ['payment', 'finance'],
    ['invoice', 'finance'],
    // Data Science
    ['vector', 'data-science'],
    ['matrix', 'data-science'],
    ['tensor', 'data-science'],
    ['model', 'data-science'],
    ['train', 'data-science'],
    ['predict', 'data-science'],
    ['data', 'data-science'],
    ['feature', 'data-science'],
    // Web
    ['email', 'web'],
    ['url', 'web'],
    ['request', 'web'],
    ['response', 'web'],
    ['api', 'web'],
    ['route', 'web'],
    // Crypto
    ['hash', 'crypto'],
    ['signature', 'crypto'],
    ['encrypt', 'crypto'],
    ['decrypt', 'crypto'],
    // IoT
    ['sensor', 'iot'],
    ['device', 'iot'],
    ['signal', 'iot'],
  ]);

  /**
   * 의도 패턴 매핑
   * [verb, noun] → intent
   */
  private intentPatterns = new Map<string, IntentInference>([
    ['calculate:tax', {
      intent: '세금 계산',
      domain: 'finance',
      confidence: 0.95,
      reasoning: ['calculate + tax = 세금 계산'],
    }],
    ['get:price', {
      intent: '가격 조회',
      domain: 'finance',
      confidence: 0.9,
      reasoning: ['get + price = 가격 조회'],
    }],
    ['validate:email', {
      intent: '이메일 검증',
      domain: 'web',
      confidence: 0.95,
      reasoning: ['validate + email = 이메일 검증'],
    }],
    ['filter:vector', {
      intent: '벡터 필터링',
      domain: 'data-science',
      confidence: 0.9,
      reasoning: ['filter + vector = 벡터 필터링'],
    }],
    ['generate:hash', {
      intent: '해시 생성',
      domain: 'crypto',
      confidence: 0.95,
      reasoning: ['generate + hash = 해시 생성'],
    }],
  ]);

  /**
   * camelCase/snake_case에서 단어 추출
   * 예: 'getUserName' → ['get', 'user', 'name']
   * 예: 'total_price' → ['total', 'price']
   */
  public extractWords(identifier: string): string[] {
    if (!identifier || identifier.length === 0) {
      return [];
    }

    // snake_case 처리
    if (identifier.includes('_')) {
      return identifier.split('_').filter(w => w.length > 0).map(w => w.toLowerCase());
    }

    // camelCase 처리: 정규식 사용
    // 대문자 앞에서 분할
    const words = identifier
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // lowercase → UPPERCASE 앞에 공백
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')  // Acronym 앞에 공백
      .split(/\s+/)
      .filter(w => w.length > 0)
      .map(w => w.toLowerCase());

    return words;
  }

  /**
   * 단어의 의미 분석
   */
  public analyzeWordSemantics(word: string): WordSemantics {
    const lowerWord = word.toLowerCase();

    // 역할 판단
    let role: 'verb' | 'noun' | 'adjective' | 'unknown' = 'unknown';
    if (this.verbs.has(lowerWord)) {
      role = 'verb';
    } else if (this.nouns.has(lowerWord)) {
      role = 'noun';
    } else if (this.adjectives.has(lowerWord)) {
      role = 'adjective';
    }

    // 타입 힌트 조회
    const typeHint = this.typeHints.get(lowerWord);

    // 도메인 힌트 조회
    const domainHint = this.domainHints.get(lowerWord);

    // 신뢰도 계산
    let confidence = 0.5;
    if (this.typeHints.has(lowerWord)) {
      confidence = 0.95;
    } else if (this.domainHints.has(lowerWord)) {
      confidence = 0.85;
    } else if (role !== 'unknown') {
      confidence = 0.7;
    }

    return {
      word: lowerWord,
      role,
      typeHint,
      domainHint,
      confidence,
    };
  }

  /**
   * 파싱된 단어들로부터 의도 추론
   */
  public inferIntentFromWords(words: string[]): IntentInference | null {
    if (words.length === 0) {
      return null;
    }

    const lowerWords = words.map(w => w.toLowerCase());

    // Verb + Noun 패턴 매칭
    for (let i = 0; i < lowerWords.length - 1; i++) {
      const verb = lowerWords[i];
      const noun = lowerWords[i + 1];

      const key = `${verb}:${noun}`;
      if (this.intentPatterns.has(key)) {
        return this.intentPatterns.get(key) || null;
      }
    }

    // 단일 단어 의도 추론
    const firstWord = lowerWords[0];
    const semantics = this.analyzeWordSemantics(firstWord);

    if (semantics.domainHint) {
      return {
        intent: `${firstWord} 작업`,
        domain: semantics.domainHint,
        confidence: 0.6,
        reasoning: [`${firstWord} 단어에서 도메인 추론`],
      };
    }

    return null;
  }

  /**
   * 이름 파싱 (종합)
   */
  public parseName(identifier: string, isFunction: boolean = true): NameParts {
    const words = this.extractWords(identifier);

    // Verb와 Noun 분리
    let verbPhrase: string | undefined;
    let nounPhrase: string | undefined;

    if (words.length > 0) {
      const firstWordSemantics = this.analyzeWordSemantics(words[0]);
      if (firstWordSemantics.role === 'verb') {
        verbPhrase = words[0];
        if (words.length > 1) {
          nounPhrase = words.slice(1).join('_');
        }
      }
    }

    return {
      original: identifier,
      words,
      isFunction,
      isVariable: !isFunction,
      verbPhrase,
      nounPhrase,
    };
  }

  /**
   * 이름으로부터 타입 힌트 얻기
   */
  public getTypeHintFromName(parts: NameParts): {
    type: string;
    confidence: number;
  } | null {
    for (const word of parts.words) {
      const semantics = this.analyzeWordSemantics(word);
      if (semantics.typeHint) {
        return {
          type: semantics.typeHint,
          confidence: semantics.confidence,
        };
      }
    }

    return null;
  }
}
