// FreeLang v2 - Intent Pattern Database
// Machine-readable patterns for header generation
// (No human-facing keywords - just operation definitions)

/**
 * Global Directive Types (통일된 3가지)
 * - speed: 성능 우선 (SIMD 힌트, 빠른 알고리즘)
 * - memory: 메모리 효율 (스택 할당, 제약된 환경)
 * - safety: 안전성 우선 (검사 포함, 에러 처리)
 */
export type Directive = 'speed' | 'memory' | 'safety';

export interface OpPattern {
  op: string;           // operation name: "sum", "avg", "max", etc
  input: string;        // "array<number>"
  output: string;       // "number" or "array<number>"
  reason: string;       // business rationale (machine readable)
  directive: Directive; // optimization hint (speed | memory | safety)
  complexity: string;   // O(n), O(n^2), etc
}

export const patterns: Record<string, OpPattern> = {
  sum: {
    op: 'sum',
    input: 'array<number>',
    output: 'number',
    reason: 'statistical_operation',
    directive: 'memory',
    complexity: 'O(n)',
  },
  average: {
    op: 'average',
    input: 'array<number>',
    output: 'number',
    reason: 'data_analysis',
    directive: 'speed',
    complexity: 'O(n)',
  },
  max: {
    op: 'max',
    input: 'array<number>',
    output: 'number',
    reason: 'optimization_problem',
    directive: 'speed',
    complexity: 'O(n)',
  },
  min: {
    op: 'min',
    input: 'array<number>',
    output: 'number',
    reason: 'search_algorithm',
    directive: 'speed',
    complexity: 'O(n)',
  },
  filter: {
    op: 'filter',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'data_preprocessing',
    directive: 'memory',
    complexity: 'O(n)',
  },
  sort: {
    op: 'sort',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'sorting_algorithm',
    directive: 'speed',
    complexity: 'O(n*log(n))',
  },
  reverse: {
    op: 'reverse',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'array_manipulation',
    directive: 'memory',
    complexity: 'O(n)',
  },
  count: {
    op: 'count',
    input: 'array<number>',
    output: 'number',
    reason: 'cardinality_measure',
    directive: 'speed',
    complexity: 'O(1)',
  },
  length: {
    op: 'length',
    input: 'array<number>',
    output: 'number',
    reason: 'size_measurement',
    directive: 'speed',
    complexity: 'O(1)',
  },
  find: {
    op: 'find',
    input: 'array<number>',
    output: 'number',
    reason: 'search_operation',
    directive: 'speed',
    complexity: 'O(n)',
  },
  contains: {
    op: 'contains',
    input: 'array<number>',
    output: 'boolean',
    reason: 'membership_test',
    directive: 'speed',
    complexity: 'O(n)',
  },
  map: {
    op: 'map',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'element_transformation',
    directive: 'memory',
    complexity: 'O(n)',
  },
  unique: {
    op: 'unique',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'deduplication',
    directive: 'speed',
    complexity: 'O(n)',
  },
  flatten: {
    op: 'flatten',
    input: 'array<array<number>>',
    output: 'array<number>',
    reason: 'dimension_reduction',
    directive: 'memory',
    complexity: 'O(n)',
  },
};

// Keyword matching (normalized, no human language)
export const keywordToOp: Record<string, string> = {
  // sum variants
  'sum': 'sum',
  'add': 'sum',
  'total': 'sum',
  '+': 'sum',

  // average
  'avg': 'average',
  'average': 'average',
  'mean': 'average',
  '~': 'average',

  // max
  'max': 'max',
  'maximum': 'max',
  'highest': 'max',

  // min
  'min': 'min',
  'minimum': 'min',
  'lowest': 'min',

  // filter
  'filter': 'filter',
  'where': 'filter',
  'select': 'filter',

  // sort
  'sort': 'sort',
  'sorted': 'sort',
  'order': 'sort',

  // reverse
  'reverse': 'reverse',
  'reversed': 'reverse',

  // count
  'count': 'count',
  'size': 'count',
  'len': 'length',
  'length': 'length',

  // find
  'find': 'find',
  'search': 'find',
  'locate': 'find',

  // contains
  'contains': 'contains',
  'has': 'contains',
  'include': 'contains',

  // map
  'map': 'map',
  'transform': 'map',
  'convert': 'map',

  // unique
  'unique': 'unique',
  'distinct': 'unique',
  'dedupe': 'unique',

  // flatten
  'flatten': 'flatten',
  'flat': 'flatten',
  'merge': 'flatten',

  // HTTP operations (Phase 13)
  'http_get': 'http_get',
  'http_post': 'http_post',
  'http_json_get': 'http_json_get',
  'http_json_post': 'http_json_post',
  'http_head': 'http_head',
  'http_patch': 'http_patch',

  // Phase 13 Week 3: Advanced HTTP
  'http_batch': 'http_batch',
  'batch': 'http_batch',
  'parallel': 'http_batch',
  'concurrent': 'http_batch',
  'http_get_with_retry': 'http_get_with_retry',
  'retry': 'http_get_with_retry',
  'resilient': 'http_get_with_retry',
};
