/**
 * FreeLang v2 - 완전한 헤더 생성 파이프라인
 * Intent Match → 자동 헤더 생성
 *
 * 파이프라인:
 * [IntentMatch] → [TypeInference] → [ReasonInference]
 *              → [DirectiveDecider] → [HeaderBuilder]
 *              → [HeaderProposal]
 */

import { INTENT_PATTERNS, IntentPattern } from './intent-patterns';

/**
 * 최종 헤더 제안 포맷
 */
export interface HeaderProposal {
  operation: string;                    // sum, avg, max, filter, sort
  inputType: string;                    // array<number>
  outputType: string;                   // number | array<number>
  reason: string;                       // 처리 이유
  directive: string;                    // 처리 지시사항
  confidence: number;                   // 전체 신뢰도 (0~1)
  header: string;                       // 생성된 헤더 코드
  metadata: {
    typeConfidence: number;             // 타입 추론 신뢰도
    reasonSource: string;               // default | inferred
    directiveSource: string;            // pattern | heuristic
  };
}

/**
 * 헤더 생성기 (완전한 파이프라인)
 */
export class HeaderGenerator {
  /**
   * IntentMatch에서 최종 HeaderProposal 생성
   *
   * @param operation 패턴 ID (sum, avg, max, min, filter, sort)
   * @param intentConfidence 의도 분석 신뢰도 (0~1)
   * @returns 최종 헤더 제안
   */
  static generateHeader(
    operation: string,
    intentConfidence: number
  ): HeaderProposal | null {
    // 패턴 확인
    if (!INTENT_PATTERNS[operation]) {
      return null;
    }

    const pattern = INTENT_PATTERNS[operation];

    // Step 1: 타입 추론
    const typeInfo = this._inferTypes(operation);

    // Step 2: Reason 추론
    const reason = this._inferReason(operation);

    // Step 3: Directive 결정
    const directive = this._decideDirective(operation, typeInfo);

    // Step 4: 헤더 빌드
    const header = this._buildHeader(
      operation,
      typeInfo.inputType,
      typeInfo.outputType,
      reason,
      directive
    );

    // Step 5: 최종 신뢰도 계산
    const confidence = Math.min(
      intentConfidence * 0.7 + typeInfo.confidence * 0.3,
      1
    );

    return {
      operation,
      inputType: typeInfo.inputType,
      outputType: typeInfo.outputType,
      reason,
      directive,
      confidence,
      header,
      metadata: {
        typeConfidence: typeInfo.confidence,
        reasonSource: pattern.defaultReason ? 'default' : 'inferred',
        directiveSource: 'pattern',
      },
    };
  }

  /**
   * Step 1: 타입 추론
   * @private
   */
  private static _inferTypes(
    operation: string
  ): {
    inputType: string;
    outputType: string;
    confidence: number;
  } {
    // 규칙: 패턴의 inputType/outputType 사용 + 신뢰도 높음
    const pattern = INTENT_PATTERNS[operation];
    return {
      inputType: pattern.inputType,
      outputType: pattern.outputType,
      confidence: 0.95, // 타입 정보는 패턴에서 정확함
    };
  }

  /**
   * Step 2: Reason 추론
   * DB의 defaultReason 또는 휴리스틱으로 생성
   * @private
   */
  private static _inferReason(operation: string): string {
    const pattern = INTENT_PATTERNS[operation];
    return pattern.defaultReason || '자동 코드 생성';
  }

  /**
   * Step 3: Directive 결정
   * 규칙 기반 Directive 결정
   * @private
   */
  private static _decideDirective(
    operation: string,
    typeInfo: { inputType: string; outputType: string }
  ): string {
    const pattern = INTENT_PATTERNS[operation];

    // 패턴의 기본 Directive 우선 사용
    if (pattern.defaultDirective) {
      return pattern.defaultDirective;
    }

    // 휴리스틱 기반 선택
    // - sum/avg: "메모리 효율성 우선" (O(1) 추가 메모리)
    // - filter: "속도 우선" (단일 패스 필수)
    // - sort: "안정성 우선" (정렬 안정성 중요)
    // - max/min: "메모리 효율성 우선"

    switch (operation) {
      case 'sum':
      case 'average':
      case 'max':
      case 'min':
        return '메모리 효율성 우선, O(n) 복잡도 유지';

      case 'filter':
        return '속도 우선, 단일 패스 처리';

      case 'sort':
        return '안정성 우선, 안정 정렬 알고리즘';

      default:
        return '안정성 우선';
    }
  }

  /**
   * Step 4: 헤더 빌드
   * FreeLang 헤더 문법으로 출력
   * @private
   */
  private static _buildHeader(
    operation: string,
    inputType: string,
    outputType: string,
    reason: string,
    directive: string
  ): string {
    // FreeLang v2 헤더 문법:
    // fn <name>: <input> → <output>
    //   ~ "<reason>"
    //   directive: "<directive>"

    return (
      `fn ${operation}: ${inputType} → ${outputType}\n` +
      `  ~ "${reason}"\n` +
      `  directive: "${directive}"`
    );
  }

  /**
   * 편의 함수: 여러 제안 생성 (alternatives 포함)
   *
   * @param operation 주 패턴
   * @param alternatives 대체 패턴들
   * @param intentConfidence 의도 신뢰도
   * @returns 주 제안 + 대체 제안들
   */
  static generateHeaderAlternatives(
    operation: string,
    alternatives: string[],
    intentConfidence: number
  ): {
    primary: HeaderProposal | null;
    suggestions: HeaderProposal[];
  } {
    const primary = this.generateHeader(operation, intentConfidence);

    // 신뢰도 감소하며 alternatives 생성
    const suggestions = alternatives
      .slice(0, 3)
      .map((alt, idx) => {
        const confidence = Math.max(0, intentConfidence - (idx + 1) * 0.15);
        return this.generateHeader(alt, confidence);
      })
      .filter((h): h is HeaderProposal => h !== null);

    return {
      primary,
      suggestions,
    };
  }

  /**
   * 헤더 문자열 파싱 (검증용)
   * "fn sum: array<number> → number" 형식을 HeaderProposal로 파싱
   *
   * @param headerString 헤더 문자열
   * @returns 파싱된 정보 또는 null (파싱 실패)
   */
  static parseHeader(headerString: string): Partial<HeaderProposal> | null {
    // 정규식: fn <operation>: <input> → <output>
    const match = headerString.match(
      /fn\s+(\w+):\s*(\S+)\s*→\s*(\S+)/
    );

    if (!match) {
      return null;
    }

    return {
      operation: match[1],
      inputType: match[2],
      outputType: match[3],
    };
  }
}
