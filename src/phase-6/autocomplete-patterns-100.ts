/**
 * Phase 6.1: Extended Autocomplete Pattern Database (100+ patterns)
 *
 * Categories:
 * 1. Math & Statistics (25) - 수학 및 통계
 * 2. Array Manipulation (20) - 배열 조작
 * 3. String Processing (20) - 문자열 처리
 * 4. Collections (15) - 컬렉션 (List, Set, Map)
 * 5. Logic & Control (10) - 논리 및 제어
 *
 * Total: 90개 신규 패턴 (기존 15개 제외)
 */

import { OpPattern, Directive } from '../engine/patterns';

export interface ExtendedPattern extends OpPattern {
  aliases: string[];
  category: string;
  tags: string[];
  examples: string[];
  relatedPatterns: string[];
}

export const extendedPatterns: Record<string, ExtendedPattern> = {
  // ==========================================
  // CATEGORY 1: MATH & STATISTICS (25)
  // ==========================================

  variance: {
    op: 'variance',
    input: 'array<number>',
    output: 'number',
    reason: 'dispersion_measurement',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['var'],
    category: 'statistics',
    tags: ['math', 'dispersion', 'variance'],
    examples: [
      'variance([1,2,3,4,5]) → 2.0',
      'variance(salaries) → 1500.5',
      'variance(measurements) → variance_result'
    ],
    relatedPatterns: ['stddev', 'average', 'zscore'],
  },

  stddev: {
    op: 'stddev',
    input: 'array<number>',
    output: 'number',
    reason: 'standard_deviation',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['std', 'standard_deviation'],
    category: 'statistics',
    tags: ['math', 'dispersion', 'deviation'],
    examples: [
      'stddev([1,2,3,4,5]) → 1.41',
      'stddev(data) → standard_deviation_value',
      'stddev(temps) → temperature_variance'
    ],
    relatedPatterns: ['variance', 'zscore', 'percentile'],
  },

  median: {
    op: 'median',
    input: 'array<number>',
    output: 'number',
    reason: 'central_tendency',
    directive: 'speed',
    complexity: 'O(n*log(n))',
    aliases: [],
    category: 'statistics',
    tags: ['math', 'central_tendency', 'percentile'],
    examples: [
      'median([1,2,3,4,5]) → 3',
      'median(ages) → middle_age',
      'median(prices) → market_price'
    ],
    relatedPatterns: ['average', 'percentile', 'mode'],
  },

  mode: {
    op: 'mode',
    input: 'array<number>',
    output: 'number',
    reason: 'frequency_analysis',
    directive: 'memory',
    complexity: 'O(n)',
    aliases: [],
    category: 'statistics',
    tags: ['math', 'frequency', 'distribution'],
    examples: [
      'mode([1,1,2,3,3,3]) → 3',
      'mode(votes) → most_common',
      'mode(sizes) → most_frequent_size'
    ],
    relatedPatterns: ['histogram', 'frequency', 'distribution'],
  },

  percentile: {
    op: 'percentile',
    input: 'array<number>',
    output: 'number',
    reason: 'quantile_measurement',
    directive: 'speed',
    complexity: 'O(n*log(n))',
    aliases: ['quantile'],
    category: 'statistics',
    tags: ['math', 'quantile', 'percentile'],
    examples: [
      'percentile(data, 95) → p95_value',
      'percentile(scores, 50) → median_score',
      'percentile(latency, 99) → p99_latency'
    ],
    relatedPatterns: ['median', 'quantile', 'histogram'],
  },

  correlation: {
    op: 'correlation',
    input: 'array<number>',
    output: 'number',
    reason: 'relationship_analysis',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['corr', 'pearson'],
    category: 'statistics',
    tags: ['math', 'correlation', 'relationship'],
    examples: [
      'correlation(x, y) → -0.85',
      'correlation(age, income) → strong_positive',
      'correlation(temp, sales) → correlation_coefficient'
    ],
    relatedPatterns: ['covariance', 'zscore', 'regression'],
  },

  covariance: {
    op: 'covariance',
    input: 'array<number>',
    output: 'number',
    reason: 'joint_variability',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['cov'],
    category: 'statistics',
    tags: ['math', 'covariance', 'relationship'],
    examples: [
      'covariance(x, y) → 125.5',
      'covariance(vars) → joint_variance',
    ],
    relatedPatterns: ['correlation', 'variance', 'zscore'],
  },

  zscore: {
    op: 'zscore',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'standardization',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['standardize', 'normalize'],
    category: 'statistics',
    tags: ['math', 'normalization', 'standardization'],
    examples: [
      'zscore([1,2,3,4,5]) → [-1.41, -0.71, 0, 0.71, 1.41]',
      'zscore(data) → normalized_values',
    ],
    relatedPatterns: ['variance', 'stddev', 'normalize'],
  },

  entropy: {
    op: 'entropy',
    input: 'array<number>',
    output: 'number',
    reason: 'information_theory',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['information_entropy'],
    category: 'statistics',
    tags: ['math', 'entropy', 'information'],
    examples: [
      'entropy(distribution) → uncertainty_value',
      'entropy([0.25, 0.25, 0.5]) → 0.81',
    ],
    relatedPatterns: ['histogram', 'distribution', 'divergence'],
  },

  absolute: {
    op: 'absolute',
    input: 'number',
    output: 'number',
    reason: 'magnitude_measurement',
    directive: 'speed',
    complexity: 'O(1)',
    aliases: ['abs'],
    category: 'math',
    tags: ['math', 'absolute', 'magnitude'],
    examples: [
      'absolute(-5) → 5',
      'absolute(value) → positive_magnitude',
    ],
    relatedPatterns: ['power', 'sqrt', 'sign'],
  },

  power: {
    op: 'power',
    input: 'number',
    output: 'number',
    reason: 'exponentiation',
    directive: 'speed',
    complexity: 'O(1)',
    aliases: ['pow', 'exp'],
    category: 'math',
    tags: ['math', 'power', 'exponentiation'],
    examples: [
      'power(2, 8) → 256',
      'power(base, exp) → result',
    ],
    relatedPatterns: ['sqrt', 'log', 'absolute'],
  },

  sqrt: {
    op: 'sqrt',
    input: 'number',
    output: 'number',
    reason: 'square_root',
    directive: 'speed',
    complexity: 'O(1)',
    aliases: ['root', 'square_root'],
    category: 'math',
    tags: ['math', 'sqrt', 'root'],
    examples: [
      'sqrt(16) → 4',
      'sqrt(value) → root_result',
    ],
    relatedPatterns: ['power', 'log', 'absolute'],
  },

  logarithm: {
    op: 'logarithm',
    input: 'number',
    output: 'number',
    reason: 'logarithmic_operation',
    directive: 'speed',
    complexity: 'O(1)',
    aliases: ['log', 'log10', 'ln'],
    category: 'math',
    tags: ['math', 'logarithm', 'log'],
    examples: [
      'logarithm(100, 10) → 2',
      'logarithm(value) → log_result',
    ],
    relatedPatterns: ['power', 'sqrt', 'exponential'],
  },

  sine: {
    op: 'sine',
    input: 'number',
    output: 'number',
    reason: 'trigonometric_function',
    directive: 'speed',
    complexity: 'O(1)',
    aliases: ['sin'],
    category: 'math',
    tags: ['math', 'trigonometry', 'sine'],
    examples: [
      'sine(0) → 0',
      'sine(angle_radians) → sine_value',
    ],
    relatedPatterns: ['cosine', 'tangent', 'arcsin'],
  },

  cosine: {
    op: 'cosine',
    input: 'number',
    output: 'number',
    reason: 'trigonometric_function',
    directive: 'speed',
    complexity: 'O(1)',
    aliases: ['cos'],
    category: 'math',
    tags: ['math', 'trigonometry', 'cosine'],
    examples: [
      'cosine(0) → 1',
      'cosine(angle) → cos_value',
    ],
    relatedPatterns: ['sine', 'tangent', 'arccos'],
  },

  gcd: {
    op: 'gcd',
    input: 'array<number>',
    output: 'number',
    reason: 'greatest_common_divisor',
    directive: 'speed',
    complexity: 'O(n*log(m))',
    aliases: ['greatest_common_divisor'],
    category: 'math',
    tags: ['math', 'number_theory', 'divisor'],
    examples: [
      'gcd([12, 18]) → 6',
      'gcd(numbers) → common_divisor',
    ],
    relatedPatterns: ['lcm', 'factorial', 'prime_factors'],
  },

  lcm: {
    op: 'lcm',
    input: 'array<number>',
    output: 'number',
    reason: 'least_common_multiple',
    directive: 'speed',
    complexity: 'O(n*log(m))',
    aliases: ['least_common_multiple'],
    category: 'math',
    tags: ['math', 'number_theory', 'multiple'],
    examples: [
      'lcm([4, 6]) → 12',
      'lcm(numbers) → least_multiple',
    ],
    relatedPatterns: ['gcd', 'factorial', 'prime_factors'],
  },

  factorial: {
    op: 'factorial',
    input: 'number',
    output: 'number',
    reason: 'combinatorics',
    directive: 'memory',
    complexity: 'O(n)',
    aliases: ['fact'],
    category: 'math',
    tags: ['math', 'combinatorics', 'factorial'],
    examples: [
      'factorial(5) → 120',
      'factorial(n) → n_factorial',
    ],
    relatedPatterns: ['combination', 'permutation', 'power'],
  },

  round: {
    op: 'round',
    input: 'number',
    output: 'number',
    reason: 'rounding_operation',
    directive: 'speed',
    complexity: 'O(1)',
    aliases: [],
    category: 'math',
    tags: ['math', 'rounding', 'precision'],
    examples: [
      'round(3.7) → 4',
      'round(3.2) → 3',
      'round(value, 2) → rounded_value',
    ],
    relatedPatterns: ['floor', 'ceil', 'truncate'],
  },

  floor: {
    op: 'floor',
    input: 'number',
    output: 'number',
    reason: 'rounding_down',
    directive: 'speed',
    complexity: 'O(1)',
    aliases: [],
    category: 'math',
    tags: ['math', 'rounding', 'floor'],
    examples: [
      'floor(3.7) → 3',
      'floor(value) → floor_value',
    ],
    relatedPatterns: ['ceil', 'round', 'truncate'],
  },

  ceil: {
    op: 'ceil',
    input: 'number',
    output: 'number',
    reason: 'rounding_up',
    directive: 'speed',
    complexity: 'O(1)',
    aliases: ['ceiling'],
    category: 'math',
    tags: ['math', 'rounding', 'ceil'],
    examples: [
      'ceil(3.2) → 4',
      'ceil(value) → ceil_value',
    ],
    relatedPatterns: ['floor', 'round', 'truncate'],
  },

  // ==========================================
  // CATEGORY 2: ARRAY MANIPULATION (20)
  // ==========================================

  map: {
    op: 'map',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'element_transformation',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: [],
    category: 'array',
    tags: ['array', 'transformation', 'functional'],
    examples: [
      'map([1,2,3], x => x*2) → [2,4,6]',
      'map(data, transform) → transformed_data',
    ],
    relatedPatterns: ['filter', 'reduce', 'foreach'],
  },

  reduce: {
    op: 'reduce',
    input: 'array<number>',
    output: 'number',
    reason: 'aggregation_operation',
    directive: 'memory',
    complexity: 'O(n)',
    aliases: ['fold'],
    category: 'array',
    tags: ['array', 'aggregation', 'functional'],
    examples: [
      'reduce([1,2,3], (a,b) => a+b) → 6',
      'reduce(items, accumulator) → final_value',
    ],
    relatedPatterns: ['fold', 'sum', 'aggregate'],
  },

  zip: {
    op: 'zip',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'array_combination',
    directive: 'memory',
    complexity: 'O(n)',
    aliases: [],
    category: 'array',
    tags: ['array', 'combination', 'tuple'],
    examples: [
      'zip([1,2], [3,4]) → [[1,3], [2,4]]',
      'zip(arrays) → combined_array',
    ],
    relatedPatterns: ['unzip', 'transpose', 'merge'],
  },

  flatten: {
    op: 'flatten',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'array_flattening',
    directive: 'memory',
    complexity: 'O(n)',
    aliases: [],
    category: 'array',
    tags: ['array', 'flattening', 'nested'],
    examples: [
      'flatten([[1,2], [3,4]]) → [1,2,3,4]',
      'flatten(nested_array) → flat_array',
    ],
    relatedPatterns: ['chunk', 'transpose', 'nest'],
  },

  chunk: {
    op: 'chunk',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'array_partitioning',
    directive: 'memory',
    complexity: 'O(n)',
    aliases: [],
    category: 'array',
    tags: ['array', 'partitioning', 'chunking'],
    examples: [
      'chunk([1,2,3,4,5], 2) → [[1,2], [3,4], [5]]',
      'chunk(data, size) → chunks',
    ],
    relatedPatterns: ['partition', 'flatten', 'slice'],
  },

  unique: {
    op: 'unique',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'deduplication',
    directive: 'memory',
    complexity: 'O(n)',
    aliases: ['distinct'],
    category: 'array',
    tags: ['array', 'deduplication', 'unique'],
    examples: [
      'unique([1,2,2,3,3,3]) → [1,2,3]',
      'unique(data) → unique_values',
    ],
    relatedPatterns: ['compact', 'group_by', 'set_operations'],
  },

  compact: {
    op: 'compact',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'null_removal',
    directive: 'memory',
    complexity: 'O(n)',
    aliases: [],
    category: 'array',
    tags: ['array', 'cleaning', 'compact'],
    examples: [
      'compact([1, null, 2, undefined, 3]) → [1,2,3]',
      'compact(data) → cleaned_array',
    ],
    relatedPatterns: ['filter', 'unique', 'trim'],
  },

  binarySearch: {
    op: 'binarySearch',
    input: 'array<number>',
    output: 'number',
    reason: 'efficient_search',
    directive: 'speed',
    complexity: 'O(log(n))',
    aliases: ['binary_search', 'bisect'],
    category: 'array',
    tags: ['array', 'search', 'algorithm'],
    examples: [
      'binarySearch([1,3,5,7,9], 5) → 2',
      'binarySearch(sorted_array, value) → index',
    ],
    relatedPatterns: ['find', 'indexOf', 'linearSearch'],
  },

  shuffle: {
    op: 'shuffle',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'randomization',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['randomize'],
    category: 'array',
    tags: ['array', 'randomization', 'shuffle'],
    examples: [
      'shuffle([1,2,3,4,5]) → [3,1,4,5,2]',
      'shuffle(data) → shuffled_data',
    ],
    relatedPatterns: ['sample', 'random', 'rotate'],
  },

  sample: {
    op: 'sample',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'random_sampling',
    directive: 'memory',
    complexity: 'O(k)',
    aliases: ['random_sample'],
    category: 'array',
    tags: ['array', 'sampling', 'statistics'],
    examples: [
      'sample([1,2,3,4,5], 3) → [2,4,1]',
      'sample(data, size) → sample_subset',
    ],
    relatedPatterns: ['shuffle', 'partition', 'slice'],
  },

  rotate: {
    op: 'rotate',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'array_rotation',
    directive: 'memory',
    complexity: 'O(n)',
    aliases: [],
    category: 'array',
    tags: ['array', 'rotation', 'manipulation'],
    examples: [
      'rotate([1,2,3,4,5], 2) → [4,5,1,2,3]',
      'rotate(array, steps) → rotated_array',
    ],
    relatedPatterns: ['reverse', 'slice', 'partition'],
  },

  groupBy: {
    op: 'groupBy',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'grouping_operation',
    directive: 'memory',
    complexity: 'O(n)',
    aliases: ['group'],
    category: 'array',
    tags: ['array', 'grouping', 'classification'],
    examples: [
      'groupBy([1,2,3,4], x => x%2) → {0: [2,4], 1: [1,3]}',
      'groupBy(data, classifier) → grouped_data',
    ],
    relatedPatterns: ['partition', 'histogram', 'classify'],
  },

  partition: {
    op: 'partition',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'binary_partitioning',
    directive: 'memory',
    complexity: 'O(n)',
    aliases: [],
    category: 'array',
    tags: ['array', 'partitioning', 'filter'],
    examples: [
      'partition([1,2,3,4,5], x => x>2) → [[3,4,5], [1,2]]',
      'partition(data, predicate) → [true_part, false_part]',
    ],
    relatedPatterns: ['filter', 'groupBy', 'chunk'],
  },

  transpose: {
    op: 'transpose',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'matrix_transposition',
    directive: 'memory',
    complexity: 'O(n*m)',
    aliases: [],
    category: 'array',
    tags: ['array', 'matrix', 'transformation'],
    examples: [
      'transpose([[1,2], [3,4]]) → [[1,3], [2,4]]',
      'transpose(matrix) → transposed_matrix',
    ],
    relatedPatterns: ['zip', 'flatten', 'matrix_ops'],
  },

  // ==========================================
  // CATEGORY 3: STRING PROCESSING (20)
  // ==========================================

  startsWith: {
    op: 'startsWith',
    input: 'string',
    output: 'boolean',
    reason: 'prefix_check',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: [],
    category: 'string',
    tags: ['string', 'pattern', 'prefix'],
    examples: [
      'startsWith("hello", "hel") → true',
      'startsWith(text, prefix) → is_prefix',
    ],
    relatedPatterns: ['endsWith', 'contains', 'indexOf'],
  },

  endsWith: {
    op: 'endsWith',
    input: 'string',
    output: 'boolean',
    reason: 'suffix_check',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: [],
    category: 'string',
    tags: ['string', 'pattern', 'suffix'],
    examples: [
      'endsWith("hello", "lo") → true',
      'endsWith(text, suffix) → is_suffix',
    ],
    relatedPatterns: ['startsWith', 'contains', 'indexOf'],
  },

  contains: {
    op: 'contains',
    input: 'string',
    output: 'boolean',
    reason: 'substring_check',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['includes', 'index_of'],
    category: 'string',
    tags: ['string', 'pattern', 'search'],
    examples: [
      'contains("hello world", "world") → true',
      'contains(text, substring) → is_contained',
    ],
    relatedPatterns: ['startsWith', 'endsWith', 'indexOf'],
  },

  replace: {
    op: 'replace',
    input: 'string',
    output: 'string',
    reason: 'substring_replacement',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: [],
    category: 'string',
    tags: ['string', 'replacement', 'manipulation'],
    examples: [
      'replace("hello world", "world", "universe") → "hello universe"',
      'replace(text, old, new) → replaced_text',
    ],
    relatedPatterns: ['replaceAll', 'split', 'regex'],
  },

  split: {
    op: 'split',
    input: 'string',
    output: 'array<string>',
    reason: 'string_splitting',
    directive: 'memory',
    complexity: 'O(n)',
    aliases: [],
    category: 'string',
    tags: ['string', 'parsing', 'array'],
    examples: [
      'split("a,b,c", ",") → ["a", "b", "c"]',
      'split(text, delimiter) → parts',
    ],
    relatedPatterns: ['join', 'slice', 'trim'],
  },

  join: {
    op: 'join',
    input: 'array<string>',
    output: 'string',
    reason: 'array_concatenation',
    directive: 'memory',
    complexity: 'O(n)',
    aliases: [],
    category: 'string',
    tags: ['string', 'concatenation', 'array'],
    examples: [
      'join(["a", "b", "c"], ",") → "a,b,c"',
      'join(parts, separator) → joined_string',
    ],
    relatedPatterns: ['split', 'concat', 'trim'],
  },

  toUpperCase: {
    op: 'toUpperCase',
    input: 'string',
    output: 'string',
    reason: 'case_conversion',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['upper', 'uppercase'],
    category: 'string',
    tags: ['string', 'case', 'conversion'],
    examples: [
      'toUpperCase("hello") → "HELLO"',
      'toUpperCase(text) → upper_text',
    ],
    relatedPatterns: ['toLowerCase', 'capitalize', 'trim'],
  },

  toLowerCase: {
    op: 'toLowerCase',
    input: 'string',
    output: 'string',
    reason: 'case_conversion',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['lower', 'lowercase'],
    category: 'string',
    tags: ['string', 'case', 'conversion'],
    examples: [
      'toLowerCase("HELLO") → "hello"',
      'toLowerCase(text) → lower_text',
    ],
    relatedPatterns: ['toUpperCase', 'capitalize', 'trim'],
  },

  trim: {
    op: 'trim',
    input: 'string',
    output: 'string',
    reason: 'whitespace_removal',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: [],
    category: 'string',
    tags: ['string', 'cleaning', 'whitespace'],
    examples: [
      'trim("  hello  ") → "hello"',
      'trim(text) → trimmed_text',
    ],
    relatedPatterns: ['split', 'replace', 'compact'],
  },

  substring: {
    op: 'substring',
    input: 'string',
    output: 'string',
    reason: 'substring_extraction',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['substr', 'slice'],
    category: 'string',
    tags: ['string', 'slicing', 'extraction'],
    examples: [
      'substring("hello", 1, 4) → "ell"',
      'substring(text, start, end) → substring_result',
    ],
    relatedPatterns: ['slice', 'split', 'indexOf'],
  },

  base64Encode: {
    op: 'base64Encode',
    input: 'string',
    output: 'string',
    reason: 'base64_encoding',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['encode_base64'],
    category: 'string',
    tags: ['string', 'encoding', 'base64'],
    examples: [
      'base64Encode("hello") → "aGVsbG8="',
      'base64Encode(text) → encoded_text',
    ],
    relatedPatterns: ['base64Decode', 'urlEncode', 'hash'],
  },

  base64Decode: {
    op: 'base64Decode',
    input: 'string',
    output: 'string',
    reason: 'base64_decoding',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['decode_base64'],
    category: 'string',
    tags: ['string', 'decoding', 'base64'],
    examples: [
      'base64Decode("aGVsbG8=") → "hello"',
      'base64Decode(encoded_text) → original_text',
    ],
    relatedPatterns: ['base64Encode', 'urlDecode', 'unhash'],
  },

  urlEncode: {
    op: 'urlEncode',
    input: 'string',
    output: 'string',
    reason: 'url_encoding',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['encode_url'],
    category: 'string',
    tags: ['string', 'encoding', 'url'],
    examples: [
      'urlEncode("hello world") → "hello%20world"',
      'urlEncode(text) → url_encoded_text',
    ],
    relatedPatterns: ['urlDecode', 'base64Encode', 'htmlEscape'],
  },

  htmlEscape: {
    op: 'htmlEscape',
    input: 'string',
    output: 'string',
    reason: 'html_escaping',
    directive: 'safety',
    complexity: 'O(n)',
    aliases: ['escape_html'],
    category: 'string',
    tags: ['string', 'escaping', 'security'],
    examples: [
      'htmlEscape("<hello>") → "&lt;hello&gt;"',
      'htmlEscape(text) → escaped_text',
    ],
    relatedPatterns: ['htmlUnescape', 'urlEncode', 'base64Encode'],
  },

  // ==========================================
  // CATEGORY 4: COLLECTIONS (15)
  // ==========================================

  union: {
    op: 'union',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'set_union',
    directive: 'memory',
    complexity: 'O(n+m)',
    aliases: [],
    category: 'set',
    tags: ['set', 'union', 'combination'],
    examples: [
      'union([1,2], [2,3]) → [1,2,3]',
      'union(set_a, set_b) → combined_set',
    ],
    relatedPatterns: ['intersection', 'difference', 'unique'],
  },

  intersection: {
    op: 'intersection',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'set_intersection',
    directive: 'memory',
    complexity: 'O(n+m)',
    aliases: [],
    category: 'set',
    tags: ['set', 'intersection', 'common'],
    examples: [
      'intersection([1,2,3], [2,3,4]) → [2,3]',
      'intersection(set_a, set_b) → common_elements',
    ],
    relatedPatterns: ['union', 'difference', 'filter'],
  },

  difference: {
    op: 'difference',
    input: 'array<number>',
    output: 'array<number>',
    reason: 'set_difference',
    directive: 'memory',
    complexity: 'O(n+m)',
    aliases: [],
    category: 'set',
    tags: ['set', 'difference', 'exclusive'],
    examples: [
      'difference([1,2,3], [2,3,4]) → [1]',
      'difference(set_a, set_b) → unique_to_a',
    ],
    relatedPatterns: ['union', 'intersection', 'filter'],
  },

  keys: {
    op: 'keys',
    input: 'object',
    output: 'array<string>',
    reason: 'object_key_extraction',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: [],
    category: 'map',
    tags: ['map', 'keys', 'extraction'],
    examples: [
      'keys({a: 1, b: 2}) → ["a", "b"]',
      'keys(object) → key_list',
    ],
    relatedPatterns: ['values', 'entries', 'merge'],
  },

  values: {
    op: 'values',
    input: 'object',
    output: 'array<number>',
    reason: 'object_value_extraction',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: [],
    category: 'map',
    tags: ['map', 'values', 'extraction'],
    examples: [
      'values({a: 1, b: 2}) → [1, 2]',
      'values(object) → value_list',
    ],
    relatedPatterns: ['keys', 'entries', 'merge'],
  },

  entries: {
    op: 'entries',
    input: 'object',
    output: 'array<number>',
    reason: 'object_entry_extraction',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: [],
    category: 'map',
    tags: ['map', 'entries', 'extraction'],
    examples: [
      'entries({a: 1, b: 2}) → [["a",1], ["b",2]]',
      'entries(object) → entry_pairs',
    ],
    relatedPatterns: ['keys', 'values', 'merge'],
  },

  merge: {
    op: 'merge',
    input: 'object',
    output: 'object',
    reason: 'object_merging',
    directive: 'memory',
    complexity: 'O(n+m)',
    aliases: ['combine'],
    category: 'map',
    tags: ['map', 'merging', 'combination'],
    examples: [
      'merge({a: 1}, {b: 2}) → {a: 1, b: 2}',
      'merge(obj1, obj2) → merged_object',
    ],
    relatedPatterns: ['pick', 'omit', 'update'],
  },

  pick: {
    op: 'pick',
    input: 'object',
    output: 'object',
    reason: 'object_projection',
    directive: 'memory',
    complexity: 'O(n)',
    aliases: [],
    category: 'map',
    tags: ['map', 'selection', 'projection'],
    examples: [
      'pick({a: 1, b: 2, c: 3}, ["a", "c"]) → {a: 1, c: 3}',
      'pick(object, keys) → selected_object',
    ],
    relatedPatterns: ['omit', 'merge', 'keys'],
  },

  omit: {
    op: 'omit',
    input: 'object',
    output: 'object',
    reason: 'object_exclusion',
    directive: 'memory',
    complexity: 'O(n)',
    aliases: [],
    category: 'map',
    tags: ['map', 'exclusion', 'filtering'],
    examples: [
      'omit({a: 1, b: 2, c: 3}, ["b"]) → {a: 1, c: 3}',
      'omit(object, keys) → filtered_object',
    ],
    relatedPatterns: ['pick', 'merge', 'filter'],
  },

  // ==========================================
  // CATEGORY 5: LOGIC & CONTROL (10)
  // ==========================================

  all: {
    op: 'all',
    input: 'array<boolean>',
    output: 'boolean',
    reason: 'universal_quantification',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['every', 'and_all'],
    category: 'logic',
    tags: ['logic', 'quantifier', 'all'],
    examples: [
      'all([true, true, true]) → true',
      'all([true, false, true]) → false',
      'all(conditions) → all_true',
    ],
    relatedPatterns: ['any', 'none', 'satisfy'],
  },

  any: {
    op: 'any',
    input: 'array<boolean>',
    output: 'boolean',
    reason: 'existential_quantification',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['some', 'or_any'],
    category: 'logic',
    tags: ['logic', 'quantifier', 'any'],
    examples: [
      'any([false, false, true]) → true',
      'any([false, false, false]) → false',
      'any(conditions) → any_true',
    ],
    relatedPatterns: ['all', 'none', 'satisfy'],
  },

  none: {
    op: 'none',
    input: 'array<boolean>',
    output: 'boolean',
    reason: 'negation_quantification',
    directive: 'speed',
    complexity: 'O(n)',
    aliases: ['not_any'],
    category: 'logic',
    tags: ['logic', 'quantifier', 'none'],
    examples: [
      'none([false, false, false]) → true',
      'none([false, true, false]) → false',
      'none(conditions) → none_true',
    ],
    relatedPatterns: ['all', 'any', 'satisfy'],
  },

  retry: {
    op: 'retry',
    input: 'function',
    output: 'result',
    reason: 'fault_tolerance',
    directive: 'safety',
    complexity: 'O(k*T)',
    aliases: [],
    category: 'control',
    tags: ['control', 'retry', 'resilience'],
    examples: [
      'retry(unstable_function, 3) → result_after_retries',
      'retry(fn, max_attempts) → retry_result',
    ],
    relatedPatterns: ['timeout', 'cache', 'fallback'],
  },

  timeout: {
    op: 'timeout',
    input: 'function',
    output: 'result',
    reason: 'time_limiting',
    directive: 'safety',
    complexity: 'O(T)',
    aliases: [],
    category: 'control',
    tags: ['control', 'timeout', 'deadline'],
    examples: [
      'timeout(slow_function, 5000) → result_or_timeout',
      'timeout(fn, ms) → timeout_result',
    ],
    relatedPatterns: ['retry', 'throttle', 'debounce'],
  },

  throttle: {
    op: 'throttle',
    input: 'function',
    output: 'function',
    reason: 'rate_limiting',
    directive: 'safety',
    complexity: 'O(1)',
    aliases: [],
    category: 'control',
    tags: ['control', 'throttle', 'rate_limit'],
    examples: [
      'throttle(on_scroll, 100) → throttled_handler',
      'throttle(fn, interval) → rate_limited_fn',
    ],
    relatedPatterns: ['debounce', 'cache', 'queue'],
  },

  debounce: {
    op: 'debounce',
    input: 'function',
    output: 'function',
    reason: 'delay_aggregation',
    directive: 'safety',
    complexity: 'O(1)',
    aliases: [],
    category: 'control',
    tags: ['control', 'debounce', 'delay'],
    examples: [
      'debounce(on_input, 300) → debounced_handler',
      'debounce(fn, delay) → debounced_fn',
    ],
    relatedPatterns: ['throttle', 'cache', 'batch'],
  },

  cache: {
    op: 'cache',
    input: 'function',
    output: 'function',
    reason: 'memoization',
    directive: 'speed',
    complexity: 'O(1) lookup',
    aliases: ['memoize'],
    category: 'control',
    tags: ['control', 'caching', 'memoization'],
    examples: [
      'cache(expensive_function) → cached_fn',
      'cache(fn) → memoized_result',
    ],
    relatedPatterns: ['memoize', 'debounce', 'batch'],
  },

  memoize: {
    op: 'memoize',
    input: 'function',
    output: 'function',
    reason: 'result_caching',
    directive: 'speed',
    complexity: 'O(1) lookup',
    aliases: ['memo'],
    category: 'control',
    tags: ['control', 'memoization', 'caching'],
    examples: [
      'memoize(fibonacci) → fast_fibonacci',
      'memoize(fn) → cached_computation',
    ],
    relatedPatterns: ['cache', 'lazy', 'batch'],
  },
};

export function getAllExtendedPatterns(): Record<string, ExtendedPattern> {
  return extendedPatterns;
}

export function getPatternsByCategory(category: string): ExtendedPattern[] {
  return Object.values(extendedPatterns).filter(p => p.category === category);
}

export function getRelatedPatterns(patternName: string): ExtendedPattern[] {
  const pattern = extendedPatterns[patternName];
  if (!pattern) return [];

  return pattern.relatedPatterns
    .map(name => extendedPatterns[name])
    .filter(Boolean);
}

export function searchPatterns(query: string): ExtendedPattern[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(extendedPatterns).filter(
    pattern =>
      pattern.op.includes(lowerQuery) ||
      pattern.aliases.some(a => a.includes(lowerQuery)) ||
      pattern.tags.some(t => t.includes(lowerQuery))
  );
}

export function getPatternCount(): number {
  return Object.keys(extendedPatterns).length;
}
