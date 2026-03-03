/**
 * Phase 7: Auto-completion Database
 *
 * AI가 쉽게 쓸 수 있는 자동완성 제안
 * - 기본 20개 패턴 (sum, avg, max, min, filter, sort, etc)
 * - 확장 10개 패턴 (학습 기반)
 * - 신뢰도 추적 (사용 횟수, 승인율)
 * - 순위 알고리즘 (빈도 + 신뢰도 + 사용성)
 */

export interface AutocompleteItem {
  id: string;                    // "sum", "filter", etc
  type: 'function' | 'operator' | 'keyword';
  category: string;              // "aggregation", "data-processing", etc
  pattern: string;               // "fn sum input: ... output: ..."
  description: string;           // "배열 합산"
  examples: string[];            // ["배열 합산", "total", "sum all"]
  signature: string;             // "array<number> -> number"

  // 신뢰도 추적
  confidence: number;            // 초기: 0.70 (기본), 학습으로 증가
  usage_count: number;           // 사용 횟수
  approval_rate: number;         // 승인율 (0-1)

  // 학습 데이터
  last_used: Date | null;        // 마지막 사용 시간
  created_at: Date;
  updated_at: Date;
}

export interface AutocompleteQuery {
  prefix: string;                // "su", "fi", etc
  context?: string;              // 선택적: "array" "filter" 등
  limit?: number;                // 최대 결과 수 (기본 10)
}

export interface AutocompleteResult {
  items: AutocompleteItem[];
  total: number;
  execution_time_ms: number;
}

export class AutocompleteDB {
  private items: Map<string, AutocompleteItem> = new Map();

  constructor() {
    this.initializeBasePatterns();
  }

  /**
   * 기본 30개 패턴 초기화
   */
  private initializeBasePatterns(): void {
    const patterns: AutocompleteItem[] = [
      // 집계 (Aggregation) - 5개
      {
        id: 'sum',
        type: 'function',
        category: 'aggregation',
        pattern: 'fn sum input: array<number> output: number intent: "배열 합산"',
        description: '배열 합산',
        examples: ['배열 합산', 'total', 'sum all', '합계'],
        signature: 'array<number> -> number',
        confidence: 0.95,
        usage_count: 0,
        approval_rate: 0.95,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'average',
        type: 'function',
        category: 'aggregation',
        pattern: 'fn average input: array<number> output: number intent: "배열 평균"',
        description: '배열 평균',
        examples: ['배열 평균', 'mean', 'avg', '평균'],
        signature: 'array<number> -> number',
        confidence: 0.92,
        usage_count: 0,
        approval_rate: 0.92,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'max',
        type: 'function',
        category: 'aggregation',
        pattern: 'fn max input: array<number> output: number intent: "최댓값"',
        description: '최댓값',
        examples: ['최댓값', 'maximum', 'largest', '최대'],
        signature: 'array<number> -> number',
        confidence: 0.93,
        usage_count: 0,
        approval_rate: 0.93,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'min',
        type: 'function',
        category: 'aggregation',
        pattern: 'fn min input: array<number> output: number intent: "최솟값"',
        description: '최솟값',
        examples: ['최솟값', 'minimum', 'smallest', '최소'],
        signature: 'array<number> -> number',
        confidence: 0.93,
        usage_count: 0,
        approval_rate: 0.93,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'count',
        type: 'function',
        category: 'aggregation',
        pattern: 'fn count input: array<number> output: number intent: "개수 세기"',
        description: '개수 세기',
        examples: ['개수', 'length', 'size', '길이'],
        signature: 'array<number> -> number',
        confidence: 0.94,
        usage_count: 0,
        approval_rate: 0.94,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },

      // 필터링 (Filtering) - 5개
      {
        id: 'filter',
        type: 'function',
        category: 'filtering',
        pattern: 'fn filter input: array<number> output: array<number> intent: "필터링"',
        description: '조건으로 필터링',
        examples: ['필터링', 'select', '조건', 'where'],
        signature: 'array<number> -> array<number>',
        confidence: 0.85,
        usage_count: 0,
        approval_rate: 0.85,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'unique',
        type: 'function',
        category: 'filtering',
        pattern: 'fn unique input: array<number> output: array<number> intent: "중복 제거"',
        description: '중복 제거',
        examples: ['중복 제거', 'distinct', 'remove duplicates', '유니크'],
        signature: 'array<number> -> array<number>',
        confidence: 0.80,
        usage_count: 0,
        approval_rate: 0.80,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'find',
        type: 'function',
        category: 'filtering',
        pattern: 'fn find input: array<number> output: number intent: "찾기"',
        description: '조건 만족하는 첫 요소',
        examples: ['찾기', 'search', 'locate', '검색'],
        signature: 'array<number> -> number',
        confidence: 0.80,
        usage_count: 0,
        approval_rate: 0.80,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'contains',
        type: 'function',
        category: 'filtering',
        pattern: 'fn contains input: array<number> output: boolean intent: "포함 여부"',
        description: '값 포함 여부',
        examples: ['포함', 'includes', 'has', 'exists'],
        signature: 'array<number> -> boolean',
        confidence: 0.85,
        usage_count: 0,
        approval_rate: 0.85,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'slice',
        type: 'function',
        category: 'filtering',
        pattern: 'fn slice input: array<number> output: array<number> intent: "슬라이싱"',
        description: '부분 추출',
        examples: ['슬라이싱', 'substring', 'subset', '부분'],
        signature: 'array<number> -> array<number>',
        confidence: 0.80,
        usage_count: 0,
        approval_rate: 0.80,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },

      // 변환 (Transformation) - 5개
      {
        id: 'map',
        type: 'function',
        category: 'transformation',
        pattern: 'fn map input: array<number> output: array<number> intent: "매핑"',
        description: '각 요소 변환',
        examples: ['변환', 'transform', 'apply', '매핑'],
        signature: 'array<number> -> array<number>',
        confidence: 0.85,
        usage_count: 0,
        approval_rate: 0.85,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'sort',
        type: 'function',
        category: 'transformation',
        pattern: 'fn sort input: array<number> output: array<number> intent: "정렬"',
        description: '정렬',
        examples: ['정렬', 'order', 'arrange', 'sort'],
        signature: 'array<number> -> array<number>',
        confidence: 0.92,
        usage_count: 0,
        approval_rate: 0.92,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'reverse',
        type: 'function',
        category: 'transformation',
        pattern: 'fn reverse input: array<number> output: array<number> intent: "역순"',
        description: '역순 정렬',
        examples: ['역순', 'reverse', 'backward', '뒤집기'],
        signature: 'array<number> -> array<number>',
        confidence: 0.90,
        usage_count: 0,
        approval_rate: 0.90,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'flatten',
        type: 'function',
        category: 'transformation',
        pattern: 'fn flatten input: array<array<number>> output: array<number> intent: "펼치기"',
        description: '다차원 배열 펼치기',
        examples: ['펼치기', 'flatten', 'unwrap', '평탄화'],
        signature: 'array<array<number>> -> array<number>',
        confidence: 0.75,
        usage_count: 0,
        approval_rate: 0.75,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'join',
        type: 'function',
        category: 'transformation',
        pattern: 'fn join input: array<number> output: string intent: "결합"',
        description: '배열 결합',
        examples: ['결합', 'concat', 'combine', 'merge'],
        signature: 'array<number> -> string',
        confidence: 0.80,
        usage_count: 0,
        approval_rate: 0.80,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },

      // 고급 (Advanced) - 5개
      {
        id: 'reduce',
        type: 'function',
        category: 'advanced',
        pattern: 'fn reduce input: array<number> output: number intent: "누적"',
        description: '누적 계산',
        examples: ['누적', 'reduce', 'fold', 'accumulate'],
        signature: 'array<number> -> number',
        confidence: 0.75,
        usage_count: 0,
        approval_rate: 0.75,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'forEach',
        type: 'function',
        category: 'advanced',
        pattern: 'fn forEach input: array<number> output: void intent: "반복"',
        description: '각 요소 반복',
        examples: ['반복', 'iterate', 'loop', 'forEach'],
        signature: 'array<number> -> void',
        confidence: 0.80,
        usage_count: 0,
        approval_rate: 0.80,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'some',
        type: 'function',
        category: 'advanced',
        pattern: 'fn some input: array<number> output: boolean intent: "존재 여부"',
        description: '조건 만족하는 요소 존재 여부',
        examples: ['존재', 'any', 'some', '포함 여부'],
        signature: 'array<number> -> boolean',
        confidence: 0.78,
        usage_count: 0,
        approval_rate: 0.78,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'every',
        type: 'function',
        category: 'advanced',
        pattern: 'fn every input: array<number> output: boolean intent: "모두 만족"',
        description: '모든 요소 조건 만족 여부',
        examples: ['모두', 'all', 'every', '전체 만족'],
        signature: 'array<number> -> boolean',
        confidence: 0.78,
        usage_count: 0,
        approval_rate: 0.78,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'zip',
        type: 'function',
        category: 'advanced',
        pattern: 'fn zip input: array<number> output: array<number> intent: "병합"',
        description: '배열 병합',
        examples: ['병합', 'zip', 'combine', 'pair'],
        signature: 'array<number> -> array<number>',
        confidence: 0.70,
        usage_count: 0,
        approval_rate: 0.70,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },

      // 확장 (Extensions) - 10개
      {
        id: 'head',
        type: 'function',
        category: 'filtering',
        pattern: 'fn head input: array<number> output: number intent: "첫 요소"',
        description: '첫 요소 추출',
        examples: ['첫', 'first', 'head', 'front'],
        signature: 'array<number> -> number',
        confidence: 0.75,
        usage_count: 0,
        approval_rate: 0.75,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'tail',
        type: 'function',
        category: 'filtering',
        pattern: 'fn tail input: array<number> output: array<number> intent: "마지막 제외"',
        description: '마지막 요소 제외',
        examples: ['마지막 제외', 'tail', 'rest', 'without last'],
        signature: 'array<number> -> array<number>',
        confidence: 0.70,
        usage_count: 0,
        approval_rate: 0.70,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'take',
        type: 'function',
        category: 'filtering',
        pattern: 'fn take input: array<number> output: array<number> intent: "앞 N개"',
        description: '앞 N개 추출',
        examples: ['처음 N개', 'take', 'first N', '처음'],
        signature: 'array<number> -> array<number>',
        confidence: 0.72,
        usage_count: 0,
        approval_rate: 0.72,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'drop',
        type: 'function',
        category: 'filtering',
        pattern: 'fn drop input: array<number> output: array<number> intent: "앞 N개 제외"',
        description: '앞 N개 제외',
        examples: ['건너뛰기', 'skip', 'drop', 'ignore first'],
        signature: 'array<number> -> array<number>',
        confidence: 0.70,
        usage_count: 0,
        approval_rate: 0.70,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'chunk',
        type: 'function',
        category: 'transformation',
        pattern: 'fn chunk input: array<number> output: array<array<number>> intent: "분할"',
        description: '배열 분할',
        examples: ['분할', 'chunk', 'batch', 'partition'],
        signature: 'array<number> -> array<array<number>>',
        confidence: 0.68,
        usage_count: 0,
        approval_rate: 0.68,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'compact',
        type: 'function',
        category: 'filtering',
        pattern: 'fn compact input: array<number> output: array<number> intent: "공백 제거"',
        description: '0/null/undefined 제거',
        examples: ['공백 제거', 'compact', 'remove empty', '정리'],
        signature: 'array<number> -> array<number>',
        confidence: 0.70,
        usage_count: 0,
        approval_rate: 0.70,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'difference',
        type: 'function',
        category: 'aggregation',
        pattern: 'fn difference input: array<number> output: array<number> intent: "차집합"',
        description: '차집합 계산',
        examples: ['차집합', 'difference', 'except', '제외'],
        signature: 'array<number> -> array<number>',
        confidence: 0.65,
        usage_count: 0,
        approval_rate: 0.65,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'intersection',
        type: 'function',
        category: 'aggregation',
        pattern: 'fn intersection input: array<number> output: array<number> intent: "교집합"',
        description: '교집합 계산',
        examples: ['교집합', 'intersection', 'common', '공통'],
        signature: 'array<number> -> array<number>',
        confidence: 0.65,
        usage_count: 0,
        approval_rate: 0.65,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'union',
        type: 'function',
        category: 'aggregation',
        pattern: 'fn union input: array<number> output: array<number> intent: "합집합"',
        description: '합집합 계산',
        examples: ['합집합', 'union', 'combine all', '모두'],
        signature: 'array<number> -> array<number>',
        confidence: 0.65,
        usage_count: 0,
        approval_rate: 0.65,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 'shuffle',
        type: 'function',
        category: 'transformation',
        pattern: 'fn shuffle input: array<number> output: array<number> intent: "무작위 순서"',
        description: '무작위 순서 변경',
        examples: ['섞기', 'shuffle', 'random', '무작위'],
        signature: 'array<number> -> array<number>',
        confidence: 0.68,
        usage_count: 0,
        approval_rate: 0.68,
        last_used: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    patterns.forEach(p => this.items.set(p.id, p));
  }

  /**
   * 자동완성 검색
   */
  search(query: AutocompleteQuery): AutocompleteResult {
    const t0 = performance.now();
    const { prefix, context, limit = 10 } = query;

    // 1. 프리픽스 매칭
    const matches = Array.from(this.items.values())
      .filter(item => {
        const matches =
          item.id.startsWith(prefix) ||
          item.description.startsWith(prefix) ||
          item.examples.some(ex => ex.startsWith(prefix));

        if (!matches) return false;
        if (context && !item.category.includes(context)) return false;
        return true;
      });

    // 2. 순위 정렬 (신뢰도 + 사용 횟수 + 최근 사용)
    const sorted = matches.sort((a, b) => {
      const scoreA = a.confidence * (1 + Math.log(a.usage_count + 1)) *
                     (a.last_used ? 1.2 : 1.0);
      const scoreB = b.confidence * (1 + Math.log(b.usage_count + 1)) *
                     (b.last_used ? 1.2 : 1.0);
      return scoreB - scoreA;
    });

    // 3. 결과 제한
    const items = sorted.slice(0, limit);

    return {
      items,
      total: matches.length,
      execution_time_ms: performance.now() - t0,
    };
  }

  /**
   * 사용 기록 업데이트 (학습)
   */
  recordUsage(id: string, approved: boolean): void {
    const item = this.items.get(id);
    if (!item) return;

    item.usage_count++;
    item.last_used = new Date();
    item.updated_at = new Date();

    if (approved) {
      // 승인: 신뢰도 증가 (최대 0.98)
      item.confidence = Math.min(0.98, item.confidence * 1.02);
      item.approval_rate =
        (item.approval_rate * (item.usage_count - 1) + 1) / item.usage_count;
    } else {
      // 거부: 신뢰도 감소 (최소 0.50)
      item.confidence = Math.max(0.50, item.confidence * 0.95);
      item.approval_rate =
        (item.approval_rate * (item.usage_count - 1)) / item.usage_count;
    }
  }

  /**
   * 모든 패턴 조회
   */
  getAll(): AutocompleteItem[] {
    return Array.from(this.items.values());
  }

  /**
   * 카테고리별 조회
   */
  getByCategory(category: string): AutocompleteItem[] {
    return Array.from(this.items.values())
      .filter(item => item.category === category);
  }

  /**
   * 신뢰도 상위 N개
   */
  getTopN(n: number): AutocompleteItem[] {
    return Array.from(this.items.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, n);
  }

  /**
   * 통계
   */
  getStats() {
    const items = Array.from(this.items.values());
    const totalUsage = items.reduce((sum, item) => sum + item.usage_count, 0);
    const avgConfidence = items.reduce((sum, item) => sum + item.confidence, 0) / items.length;
    const avgApprovalRate = items.reduce((sum, item) => sum + item.approval_rate, 0) / items.length;

    return {
      total_patterns: items.length,
      total_usage: totalUsage,
      avg_confidence: avgConfidence,
      avg_approval_rate: avgApprovalRate,
      categories: [...new Set(items.map(i => i.category))],
    };
  }
}

// 싱글톤 인스턴스
export const autocompleteDB = new AutocompleteDB();
