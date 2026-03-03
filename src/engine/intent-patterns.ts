/**
 * FreeLang v2 - 의도 패턴 데이터베이스
 * AI의 자연어 입력을 자동 헤더로 변환하는 기반
 *
 * 패턴 6가지 + 신뢰도 가중치 정의
 */

export interface IntentPattern {
  id: string;
  keywords: string[];           // 한글 + 영문 키워드
  inputType: string;           // 입력 타입
  outputType: string;          // 출력 타입
  defaultReason: string;       // 기본 처리 이유
  defaultDirective: string;    // 기본 처리 지시
  priority: number;            // 우선순위 (1=높음)
}

/**
 * 기본 의도 패턴 6가지
 * 각 패턴은 자동 헤더 생성 시 매칭 기준이 됨
 */
export const INTENT_PATTERNS: Record<string, IntentPattern> = {
  sum: {
    id: 'sum',
    keywords: ['합산', '더하기', 'sum', 'addition', '합', '누적'],
    inputType: 'array<number>',
    outputType: 'number',
    defaultReason: '통계 연산의 기초 - 배열 모든 값의 합 계산',
    defaultDirective: '메모리 효율성 우선, O(n) 복잡도 유지',
    priority: 1,
  },

  average: {
    id: 'average',
    keywords: ['평균', 'avg', 'average', '평균값', 'mean'],
    inputType: 'array<number>',
    outputType: 'number',
    defaultReason: '중앙 경향값 계산 - 데이터 분석의 핵심',
    defaultDirective: '부동소수점 정밀도 유지, 0 나누기 처리',
    priority: 1,
  },

  max: {
    id: 'max',
    keywords: ['최대', 'max', '최댓값', '최대값', 'maximum'],
    inputType: 'array<number>',
    outputType: 'number',
    defaultReason: '극값 찾기 - 상한선 확인 필수',
    defaultDirective: '초기값 설정 신중히, 타입 오버플로우 주의',
    priority: 1,
  },

  min: {
    id: 'min',
    keywords: ['최소', 'min', '최솟값', '최소값', 'minimum'],
    inputType: 'array<number>',
    outputType: 'number',
    defaultReason: '극값 찾기 - 하한선 확인 필수',
    defaultDirective: '초기값 설정 신중히, 타입 언더플로우 주의',
    priority: 1,
  },

  filter: {
    id: 'filter',
    keywords: ['필터', 'filter', '조건', '선택', '추출'],
    inputType: 'array<T>',
    outputType: 'array<T>',
    defaultReason: '데이터 선별 - 조건에 맞는 항목만 추출',
    defaultDirective: '조건식 명확히, 순서 보존, 메모리 증분 가능',
    priority: 1,
  },

  sort: {
    id: 'sort',
    keywords: ['정렬', 'sort', '순서', '크기순', 'order'],
    inputType: 'array<number|string>',
    outputType: 'array<number|string>',
    defaultReason: '순서 정렬 - 데이터 조직화의 기초',
    defaultDirective: 'O(n log n) 복잡도 권장, 안정성 정렬 필요',
    priority: 1,
  },
};

/**
 * 신뢰도 계산 가중치
 * matchIntent()에서 최종 신뢰도 = 각 요소 × 가중치의 합
 */
export const CONFIDENCE_WEIGHTS = {
  patternMatch: 0.4,      // 키워드 정확 매칭 비중 (40%)
  typeInference: 0.3,     // 입출력 타입 추론 정확도 (30%)
  intentClarity: 0.2,     // 의도 명확성 점수 (20%)
  similarity: 0.1,        // 유사도 기반 매칭 (10%)
};

/**
 * 패턴 ID 목록 (빠른 조회용)
 */
export const PATTERN_IDS = Object.keys(INTENT_PATTERNS) as Array<keyof typeof INTENT_PATTERNS>;

/**
 * 패턴 개수
 */
export const PATTERN_COUNT = PATTERN_IDS.length;
