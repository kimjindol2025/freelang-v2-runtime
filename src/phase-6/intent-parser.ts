/**
 * Phase 6.2 Week 2: IntentParser
 *
 * 자연어 의도를 FreeLang 코드로 변환
 * - "배열 합산" → sum = fold(arr, +)
 * - "큰 숫자만" → filter(arr, x > threshold)
 * - "2배로" → map(arr, x * 2)
 */

/**
 * 인식된 의도
 */
export interface RecognizedIntent {
  intent: string;
  confidence: number;      // 0.0-1.0
  code: string;
  explanation: string;
}

/**
 * IntentParser: 자연어 → FreeLang 코드 (학습 기능 포함)
 */
export class IntentParser {
  private patterns: Map<string, { code: string; keywords: string[] }> = new Map();
  private patternWeights: Map<string, number> = new Map();
  private successCount: Map<string, number> = new Map();
  private totalAttempts: Map<string, number> = new Map();

  constructor() {
    this.initializePatterns();
    this.initializeWeights();
  }

  /**
   * 가중치 초기화 (학습 메커니즘)
   */
  private initializeWeights(): void {
    for (const patternId of this.patterns.keys()) {
      this.patternWeights.set(patternId, 1.0); // 기본 가중치
      this.successCount.set(patternId, 0);
      this.totalAttempts.set(patternId, 0);
    }
  }

  /**
   * 의도 인식 성공 기록 (학습)
   */
  recordSuccess(intentId: string): void {
    if (this.patterns.has(intentId)) {
      const current = this.successCount.get(intentId) || 0;
      const total = this.totalAttempts.get(intentId) || 0;

      this.successCount.set(intentId, current + 1);
      this.totalAttempts.set(intentId, total + 1);

      // 성공률에 따라 가중치 업데이트
      const successRate = (current + 1) / (total + 1);
      const newWeight = Math.min(2.0, 1.0 + successRate * 0.5);
      this.patternWeights.set(intentId, newWeight);
    }
  }

  /**
   * 의도 인식 실패 기록 (학습)
   */
  recordFailure(intentId: string): void {
    if (this.patterns.has(intentId)) {
      const total = this.totalAttempts.get(intentId) || 0;
      this.totalAttempts.set(intentId, total + 1);

      // 실패하면 가중치 감소
      const current = this.successCount.get(intentId) || 0;
      const successRate = current / (total + 1);
      const newWeight = Math.max(0.5, 1.0 + (successRate - 0.5) * 0.3);
      this.patternWeights.set(intentId, newWeight);
    }
  }

  /**
   * 학습 통계 조회
   */
  getLearningStats(): Map<string, { successRate: number; weight: number; attempts: number }> {
    const stats = new Map();
    for (const [patternId, _] of this.patterns) {
      const total = this.totalAttempts.get(patternId) || 0;
      const success = this.successCount.get(patternId) || 0;
      const successRate = total > 0 ? success / total : 0;
      const weight = this.patternWeights.get(patternId) || 1.0;

      stats.set(patternId, { successRate, weight, attempts: total });
    }
    return stats;
  }

  /**
   * 패턴 초기화
   */
  private initializePatterns(): void {
    // 배열 합산
    this.patterns.set('sum-array', {
      code: 'result = sum(arr)',
      keywords: ['합산', 'sum', '더하기', 'add all', 'total'],
    });

    // 배열 길이
    this.patterns.set('array-length', {
      code: 'result = len(arr)',
      keywords: ['길이', 'length', 'size', '개수', 'count'],
    });

    // 필터링 - 큰 숫자
    this.patterns.set('filter-large', {
      code: 'result = arr | filter(x > threshold)',
      keywords: ['큰', 'large', 'greater', 'more', '초과', 'above'],
    });

    // 필터링 - 작은 숫자
    this.patterns.set('filter-small', {
      code: 'result = arr | filter(x < threshold)',
      keywords: ['작은', 'small', 'less', 'below', '미만', 'under'],
    });

    // 매핑 - 2배
    this.patterns.set('map-double', {
      code: 'result = arr | map(x * 2)',
      keywords: ['2배', 'double', '두배', '곱하기 2'],
    });

    // 매핑 - 제곱
    this.patterns.set('map-square', {
      code: 'result = arr | map(x * x)',
      keywords: ['제곱', 'square', 'x²', 'x*x'],
    });

    // 매핑 - 제곱근
    this.patterns.set('map-sqrt', {
      code: 'result = arr | map(sqrt(x))',
      keywords: ['제곱근', 'sqrt', 'square root', '루트'],
    });

    // 필터 + 합산
    this.patterns.set('filter-sum', {
      code: 'result = arr | filter(x > threshold) | sum',
      keywords: ['큰', '더하기', '합', '필터', 'larger', 'sum'],
    });

    // 홀수 필터
    this.patterns.set('filter-odd', {
      code: 'result = arr | filter(x % 2 == 1)',
      keywords: ['홀수', 'odd', '나머지 1'],
    });

    // 짝수 필터
    this.patterns.set('filter-even', {
      code: 'result = arr | filter(x % 2 == 0)',
      keywords: ['짝수', 'even', '나머지 0'],
    });

    // 최댓값
    this.patterns.set('find-max', {
      code: 'result = max(arr)',
      keywords: ['최대', 'maximum', 'max', '가장 큰'],
    });

    // 최솟값
    this.patterns.set('find-min', {
      code: 'result = min(arr)',
      keywords: ['최소', 'minimum', 'min', '가장 작은'],
    });

    // 평균
    this.patterns.set('find-average', {
      code: 'result = sum(arr) / len(arr)',
      keywords: ['평균', 'average', 'mean', '평균값'],
    });

    // 범위 생성
    this.patterns.set('create-range', {
      code: 'result = range(start, end)',
      keywords: ['범위', 'range', '부터', '까지'],
    });

    // 정렬
    this.patterns.set('sort-array', {
      code: 'result = arr | sort',
      keywords: ['정렬', 'sort', '순서', 'ordered'],
    });

    // 역정렬
    this.patterns.set('sort-reverse', {
      code: 'result = arr | sort | reverse',
      keywords: ['역정렬', 'reverse', '내림차순', 'descending'],
    });

    // 고유 값
    this.patterns.set('unique', {
      code: 'result = arr | unique',
      keywords: ['고유', 'unique', '중복 제거', 'distinct'],
    });

    // 문자열 길이
    this.patterns.set('string-length', {
      code: 'result = len(str)',
      keywords: ['문자열 길이', 'string length', '글자 수'],
    });

    // 대문자
    this.patterns.set('string-uppercase', {
      code: 'result = str | toUpperCase',
      keywords: ['대문자', 'uppercase', 'UPPER', '대문'],
    });

    // 소문자
    this.patterns.set('string-lowercase', {
      code: 'result = str | toLowerCase',
      keywords: ['소문자', 'lowercase', 'lower', '소문'],
    });

    // ==================== 재귀 패턴 ====================
    // 팩토리얼
    this.patterns.set('factorial', {
      code: 'fn factorial(n) = n <= 1 ? 1 : n * factorial(n - 1); result = factorial(num)',
      keywords: ['팩토리얼', 'factorial', '!'],
    });

    // 피보나치
    this.patterns.set('fibonacci', {
      code: 'fn fib(n) = n <= 1 ? n : fib(n-1) + fib(n-2); result = fib(num)',
      keywords: ['피보나치', 'fibonacci', 'fib'],
    });

    // 누적합
    this.patterns.set('cumulative-sum', {
      code: 'result = arr | fold(0, (acc, x) => acc + x)',
      keywords: ['누적합', 'cumulative', '누적'],
    });

    // 깊이 우선 탐색
    this.patterns.set('tree-traverse', {
      code: 'fn traverse(node) = { print(node.value); node.children.map(traverse) }',
      keywords: ['트리', 'tree', '순회', 'traverse', 'dfs'],
    });

    // 피크 찾기
    this.patterns.set('find-peak', {
      code: 'result = arr | reduce(arr[0], (max, x) => x > max ? x : max)',
      keywords: ['피크', 'peak', '최고', '정점'],
    });

    // 트리 깊이
    this.patterns.set('tree-depth', {
      code: 'fn depth(node) = node == null ? 0 : 1 + max(depth(node.left), depth(node.right)); result = depth(root)',
      keywords: ['깊이', 'depth', '높이', 'height'],
    });

    // 모든 요소 합산 (재귀)
    this.patterns.set('recursive-sum', {
      code: 'fn recSum(arr, i) = i >= len(arr) ? 0 : arr[i] + recSum(arr, i+1); result = recSum(arr, 0)',
      keywords: ['재귀합산', 'recursive sum', '재귀', '반복적합산', 'recsum'],
    });

    // ==================== 구조체/객체 패턴 ====================
    // 객체 생성
    this.patterns.set('create-object', {
      code: 'result = {name: "value", age: 25, active: true}',
      keywords: ['객체', 'object', 'struct', '구조체'],
    });

    // 객체 필드 접근
    this.patterns.set('access-field', {
      code: 'result = obj.field',
      keywords: ['접근', 'access', '.', '필드', 'field'],
    });

    // 객체 매핑
    this.patterns.set('object-map', {
      code: 'result = {name: obj.name, age: obj.age + 1}',
      keywords: ['매핑', 'map', '변환', 'transform'],
    });

    // 중첩 객체
    this.patterns.set('nested-object', {
      code: 'result = {user: {name: "John", address: {city: "Seoul"}}, metadata: {created: true}}',
      keywords: ['중첩', 'nested', '객체', 'object', '계층', 'hierarchy'],
    });
  }

  /**
   * 의도 파싱 (자연어 → 코드)
   */
  parse(naturalLanguage: string): RecognizedIntent {
    const input = naturalLanguage.toLowerCase().trim();

    // 공백 제거 및 특수문자 정규화
    const normalized = input.replace(/[.,!?;:()]/g, '');

    // 각 패턴과 유사도 계산
    const matches: Array<{
      intentId: string;
      code: string;
      confidence: number;
    }> = [];

    for (const [intentId, pattern] of this.patterns) {
      const confidence = this.calculateSimilarity(normalized, pattern.keywords);

      if (confidence > 0) {
        matches.push({
          intentId,
          code: pattern.code,
          confidence,
        });
      }
    }

    // 가중치를 신뢰도에 적용 (학습 기반)
    const weightedMatches = matches.map(match => ({
      ...match,
      originalConfidence: match.confidence,
      confidence: match.confidence * (this.patternWeights.get(match.intentId) || 1.0),
    }));

    // 가장 높은 신뢰도의 매칭 찾기
    if (weightedMatches.length === 0) {
      return {
        intent: 'unknown',
        confidence: 0,
        code: '# 의도를 인식하지 못했습니다',
        explanation: `입력: "${naturalLanguage}" - 인식된 의도가 없습니다`,
      };
    }

    weightedMatches.sort((a, b) => b.confidence - a.confidence);
    const best = weightedMatches[0];

    // 신뢰도 정규화 (0.0-1.0)
    const normalizedConfidence = Math.min(1.0, best.confidence);

    return {
      intent: best.intentId,
      confidence: normalizedConfidence,
      code: best.code,
      explanation: `의도 인식: ${best.intentId} (신뢰도: ${(normalizedConfidence * 100).toFixed(1)}%, 가중치: ${(this.patternWeights.get(best.intentId) || 1.0).toFixed(2)})`,
    };
  }

  /**
   * 자연어와 키워드의 유사도 계산
   */
  private calculateSimilarity(input: string, keywords: string[]): number {
    const inputTokens = new Set(input.split(/\s+/));

    let matchCount = 0;
    for (const keyword of keywords) {
      const keywordTokens = new Set(keyword.split(/\s+/));

      // 키워드 토큰이 입력에 포함되어 있는지 확인
      for (const token of keywordTokens) {
        if (inputTokens.has(token)) {
          matchCount += 1;
        }
      }
    }

    // 신뢰도: 일치한 키워드 개수 / 전체 키워드 개수
    // 추가 가중치: 더 많은 토큰이 일치할수록 높음
    if (matchCount === 0) return 0;

    const baseConfidence = matchCount / Math.max(inputTokens.size, keywords.length);
    const weightedConfidence = Math.min(1.0, baseConfidence * 1.2);

    return weightedConfidence;
  }

  /**
   * 여러 의도 인식 (상위 N개)
   */
  parseTopN(naturalLanguage: string, n: number = 3): RecognizedIntent[] {
    const input = naturalLanguage.toLowerCase().trim();
    const normalized = input.replace(/[.,!?;:()]/g, '');

    const matches: Array<{
      intentId: string;
      code: string;
      confidence: number;
    }> = [];

    for (const [intentId, pattern] of this.patterns) {
      const confidence = this.calculateSimilarity(normalized, pattern.keywords);

      if (confidence > 0) {
        matches.push({
          intentId,
          code: pattern.code,
          confidence,
        });
      }
    }

    matches.sort((a, b) => b.confidence - a.confidence);

    return matches.slice(0, n).map((match) => ({
      intent: match.intentId,
      confidence: match.confidence,
      code: match.code,
      explanation: `의도: ${match.intentId} (신뢰도: ${(match.confidence * 100).toFixed(1)}%)`,
    }));
  }

  /**
   * 새로운 패턴 추가
   */
  addPattern(
    intentId: string,
    code: string,
    keywords: string[]
  ): void {
    this.patterns.set(intentId, { code, keywords });
  }

  /**
   * 패턴 목록 조회
   */
  listPatterns(): Array<{ id: string; code: string; keywords: string[] }> {
    return Array.from(this.patterns.entries()).map(([id, { code, keywords }]) => ({
      id,
      code,
      keywords,
    }));
  }

  /**
   * 사용 가능한 키워드 조회
   */
  getKeywordsForIntent(intentId: string): string[] {
    return this.patterns.get(intentId)?.keywords ?? [];
  }
}

/**
 * 글로벌 인스턴스
 */
export const globalIntentParser = new IntentParser();
