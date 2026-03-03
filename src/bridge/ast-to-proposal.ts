/**
 * FreeLang v2 Phase 5 - AST to HeaderProposal Bridge
 *
 * MinimalFunctionAST (.free 파일) → HeaderProposal (파이프라인 입력)
 *
 * 역할: Phase 5 (v1 파서)와 Phase 1-4 (AI 파이프라인) 연결
 */
import { MinimalFunctionAST } from '../parser/ast';
import { HeaderProposal } from '../engine/auto-header';
import { Directive } from '../engine/patterns';
import { analyzeBody } from '../analyzer/body-analysis';

/**
 * AST 파싱 신뢰도 (명시적 선언이므로 매우 높음)
 * - 0.98: v1 파서로 완벽하게 구문 분석된 명시적 선언 (explicit 타입)
 * - 0.833: 타입이 생략되어 intent에서 추론된 경우 (0.98 * 0.85)
 * (자유형 텍스트 기반 추론이므로 약간의 불확실성 있음)
 */
const AST_CONFIDENCE_EXPLICIT = 0.98;    // 명시적 타입
const TYPE_INFERENCE_PENALTY = 0.85;     // 타입 추론 페널티 (× 0.85)
const AST_CONFIDENCE_INFERRED = AST_CONFIDENCE_EXPLICIT * TYPE_INFERENCE_PENALTY; // 0.833

/**
 * AST를 HeaderProposal로 변환
 *
 * .free 파일의 명시적 선언을 HeaderProposal 형식으로 변환합니다.
 * 신뢰도는 타입 명시 여부에 따라 결정됩니다:
 * - 타입 명시: 0.98 (높음)
 * - 타입 생략 (추론): 0.833 (중간)
 */
export function astToProposal(ast: MinimalFunctionAST): HeaderProposal {
  // 타입이 생략된 경우 신뢰도 감소
  const isInputInferred = !ast.inputType;
  const isOutputInferred = !ast.outputType;

  // 신뢰도 계산:
  // - 타입이 모두 명시: 0.98
  // - 타입이 생략되어 추론됨: 0.833
  const confidence = (isInputInferred || isOutputInferred)
    ? AST_CONFIDENCE_INFERRED
    : AST_CONFIDENCE_EXPLICIT;

  // matched_op 추론: intent에서 동작 키워드 찾기
  const matched_op = inferOperation(ast.intent || '', ast.fnName);

  // 이유 생성 (intent 또는 함수명 기반)
  const reason = ast.intent || `${ast.fnName} operation`;

  // Phase 5 Task 2: 타입 생략 시 intent에서 추론
  const inputType = ast.inputType || inferTypeFromIntent(ast.intent || '', 'input');
  const outputType = ast.outputType || inferTypeFromIntent(ast.intent || '', 'output');

  // Phase 5 Task 4.3: 지시어 (directive) 동적 결정
  // intent 기반 directive 먼저 추론
  let directive = inferDirective(ast.intent || '');
  let directiveConfidence = 1.0; // 기본값: body 없을 때는 intent만 사용

  // body가 있으면 패턴 분석으로 directive 재검토
  if (ast.body) {
    const bodyAnalysis = analyzeBody(ast.body);

    // body 분석 신뢰도가 충분히 높으면 body 제안 사용
    // (body 분석이 코드 실제 패턴을 보므로 더 정확함)
    if (bodyAnalysis.confidence > 0.75) {
      directive = bodyAnalysis.suggestedDirective;
      directiveConfidence = bodyAnalysis.confidence;
    }
    // body 신뢰도가 중간(0.6-0.75) 수준이면 두 directive 비교
    else if (bodyAnalysis.confidence >= 0.6 && bodyAnalysis.confidence <= 0.75) {
      // intent와 body가 일치하면 신뢰도 상승
      if (bodyAnalysis.suggestedDirective === directive) {
        directiveConfidence = Math.min(1.0, (0.7 + bodyAnalysis.confidence) / 2);
      }
      // intent와 body가 불일치하면 intent 유지 (보수적 접근)
      // body 신뢰도가 낮으므로 intent 우선
      else {
        directiveConfidence = 0.7; // intent 기반만 사용
      }
    } else {
      // body 신뢰도가 낮으면 intent만 신뢰
      directiveConfidence = 0.7;
    }
  }

  // 복잡도 추론 (의도에서 또는 기본값)
  const complexity = inferComplexity(ast.intent || '');

  // 최종 신뢰도: 타입 신뢰도 × directive 신뢰도
  // - 타입이 명시되지 않거나 directive가 불명확하면 최종 신뢰도 낮아짐
  const finalConfidence = confidence * directiveConfidence;

  return {
    fn: ast.fnName,
    input: inputType,
    output: outputType,
    reason,
    directive,
    complexity,
    confidence: finalConfidence,
    matched_op
  };
}


/**
 * 동작 추론 (intent + fnName에서)
 *
 * intent가 있으면 거기서, 없으면 fnName에서 동작 추론
 */
function inferOperation(intent: string, fnName: string): string {
  // intent에서 핵심 동작어 찾기
  const intentLower = (intent || fnName).toLowerCase();

  // 키워드 매핑
  const keywords: Record<string, string[]> = {
    sum: ['합산', 'sum', 'add', 'total'],
    average: ['평균', 'average', 'avg', 'mean'],
    max: ['최대', 'max', 'maximum'],
    min: ['최소', 'min', 'minimum'],
    sort: ['정렬', 'sort'],
    reverse: ['역순', 'reverse', 'reverse'],
    filter: ['필터', 'filter', 'where'],
    map: ['변환', 'map', 'transform'],
    count: ['개수', 'count', 'length'],
    find: ['찾기', 'find', 'search'],
    flatten: ['평탄화', 'flatten'],
    unique: ['유일', 'unique', 'distinct']
  };

  // 각 동작에서 intent 키워드 검색
  for (const [op, opKeywords] of Object.entries(keywords)) {
    for (const keyword of opKeywords) {
      if (intentLower.includes(keyword)) {
        return op;
      }
    }
  }

  // 함수명이 동작명과 정확히 일치하면 사용
  if (intentLower in keywords) {
    return intentLower;
  }

  // 기본값: 함수명 사용
  return fnName;
}

/**
 * 지시어 추론 (intent에서 최적화 힌트 찾기)
 *
 * "배열 합산" → "memory" (기본값)
 * "빠른 정렬" → "speed"
 * "메모리 효율적 필터링" → "memory"
 * "안전한 검사" → "safety"
 */
function inferDirective(intent: string): Directive {
  const intentLower = intent.toLowerCase();

  if (
    intentLower.includes('빠른') ||
    intentLower.includes('fast') ||
    intentLower.includes('speed') ||
    intentLower.includes('quick')
  ) {
    return 'speed';
  }

  if (
    intentLower.includes('메모리') ||
    intentLower.includes('효율') ||
    intentLower.includes('memory') ||
    intentLower.includes('efficient')
  ) {
    return 'memory';
  }

  if (
    intentLower.includes('안전') ||
    intentLower.includes('검사') ||
    intentLower.includes('safe') ||
    intentLower.includes('check')
  ) {
    return 'safety';
  }

  // 기본값: memory (효율성 우선)
  return 'memory';
}

/**
 * 복잡도 추론
 */
function inferComplexity(intent: string): string {
  const intentLower = intent.toLowerCase();

  if (
    intentLower.includes('정렬') ||
    intentLower.includes('sort') ||
    intentLower.includes('merge')
  ) {
    return 'O(n log n)';
  }

  if (
    intentLower.includes('순회') ||
    intentLower.includes('반복') ||
    intentLower.includes('loop') ||
    intentLower.includes('iterate')
  ) {
    return 'O(n)';
  }

  if (
    intentLower.includes('이진') ||
    intentLower.includes('찾기') ||
    intentLower.includes('binary') ||
    intentLower.includes('search')
  ) {
    return 'O(log n)';
  }

  // 기본값
  return 'O(n)';
}

/**
 * Phase 5: Intent에서 타입 추론
 *
 * 타입이 생략된 경우 intent 문자열에서 타입을 추론합니다.
 * 예:
 *   - "배열 합산" + "input" → "array<number>"
 *   - "배열 합산" + "output" → "number"
 *   - "배열 문자열 필터" + "input" → "array<string>"
 *   - "배열 문자열 필터" + "output" → "array<string>"
 */
function inferTypeFromIntent(intent: string, position: 'input' | 'output'): string {
  const intentLower = (intent || '').toLowerCase();

  // 타입 힌트 키워드 매핑
  const isArrayOperation = (kw: string) =>
    intentLower.includes(kw) &&
    (intentLower.includes('배열') || intentLower.includes('array'));

  const isStringType = () =>
    intentLower.includes('문자열') ||
    intentLower.includes('string') ||
    intentLower.includes('text') ||
    intentLower.includes('str');

  const isNumberType = () =>
    intentLower.includes('숫자') ||
    intentLower.includes('number') ||
    intentLower.includes('num') ||
    intentLower.includes('count');

  // 연산 타입 검사
  const isSumLike = () =>
    intentLower.includes('합산') ||
    intentLower.includes('합') ||
    intentLower.includes('sum') ||
    intentLower.includes('add') ||
    intentLower.includes('total');

  const isAverageLike = () =>
    intentLower.includes('평균') ||
    intentLower.includes('average') ||
    intentLower.includes('avg') ||
    intentLower.includes('mean');

  const isMaxMinLike = () =>
    (intentLower.includes('최대') || intentLower.includes('max')) ||
    (intentLower.includes('최소') || intentLower.includes('min'));

  const isSortLike = () =>
    intentLower.includes('정렬') ||
    intentLower.includes('sort') ||
    intentLower.includes('reverse') ||
    intentLower.includes('역순');

  const isFilterLike = () =>
    intentLower.includes('필터') ||
    intentLower.includes('filter') ||
    intentLower.includes('where') ||
    intentLower.includes('검사') ||
    intentLower.includes('조건');

  const isMapLike = () =>
    intentLower.includes('변환') ||
    intentLower.includes('map') ||
    intentLower.includes('transform');

  const isCountLike = () =>
    intentLower.includes('개수') ||
    intentLower.includes('count') ||
    intentLower.includes('length');

  const isFlattenLike = () =>
    intentLower.includes('평탄화') ||
    intentLower.includes('flatten') ||
    intentLower.includes('merge');

  const isUniqueLike = () =>
    intentLower.includes('유일') ||
    intentLower.includes('unique') ||
    intentLower.includes('distinct');

  // Input 타입 추론
  if (position === 'input') {
    // 명시적 배열 언급이 없으면, 연산 특성으로 배열 여부 판단
    if (
      isSortLike() ||
      isFilterLike() ||
      isMapLike() ||
      isFlattenLike() ||
      isUniqueLike() ||
      isAverageLike() ||
      isSumLike() ||
      isMaxMinLike() ||
      isCountLike()
    ) {
      // 배열 연산이므로 input은 배열
      if (isStringType()) {
        return 'array<string>';
      }
      return 'array<number>'; // 기본값: 숫자 배열
    }

    // 일반적인 경우
    if (isStringType()) {
      return 'string';
    }
    if (isNumberType()) {
      return 'number';
    }

    // 기본값: 배열 (대부분의 연산이 배열을 받음)
    return 'array<number>';
  }

  // Output 타입 추론
  if (position === 'output') {
    // 단일 값을 반환하는 연산
    if (isSumLike() || isAverageLike() || isMaxMinLike() || isCountLike()) {
      return 'number';
    }

    // 배열을 반환하는 연산
    if (isSortLike() || isFilterLike() || isMapLike() || isFlattenLike() || isUniqueLike()) {
      if (isStringType()) {
        return 'array<string>';
      }
      return 'array<number>';
    }

    // find/search 같은 경우: 개별 원소를 반환
    if (intentLower.includes('찾기') || intentLower.includes('find') || intentLower.includes('search')) {
      if (isStringType()) {
        return 'string';
      }
      return 'number';
    }

    // 기본값: result (제네릭 타입)
    return 'result';
  }

  // 위치가 잘못된 경우
  return 'result';
}

/**
 * HeaderProposal을 인쇄 가능한 형식으로 변환 (디버깅)
 */
export function proposalToString(proposal: HeaderProposal): string {
  return `
Header: fn ${proposal.fn}: ${proposal.input} -> ${proposal.output}
Function: ${proposal.fn}
Input: ${proposal.input}
Output: ${proposal.output}
Reason: ${proposal.reason}
Directive: ${proposal.directive}
Complexity: ${proposal.complexity}
Confidence: ${proposal.confidence}%
Matched Op: ${proposal.matched_op}
  `.trim();
}
