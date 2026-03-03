/**
 * Confidence Calculator
 *
 * 신뢰도 계산의 모든 로직을 중앙화
 * - 상수 정의
 * - 가중치 기반 계산
 * - 정규화
 * - 다중 소스 통합
 */

/**
 * 신뢰도 계산 상수 (중앙화)
 */
export const CONFIDENCE_CONSTANTS = {
  // 기본값
  DEFAULT_CONFIDENCE: 0.5,
  MIN_CONFIDENCE: 0.0,
  MAX_CONFIDENCE: 0.95,

  // 분석기별 기본 신뢰도
  EXPLICIT_TAG_CONFIDENCE: 0.95,           // // finance: 태그
  PREDICATE_CONFIDENCE: 0.95,              // isValid, hasError 등
  KEYWORD_BASE_CONFIDENCE: 0.70,           // 키워드 매칭 시작

  // 명시적/암시적 매칭
  EXACT_MATCH_CONFIDENCE: 0.95,            // 정확 매칭
  KEYWORD_MATCH_CONFIDENCE: 0.70,          // 키워드 기반
  PARTIAL_MATCH_PENALTY: 0.8,              // 부분 매칭 패널티

  // 포맷/형식
  FORMAT_BASE_CONFIDENCE: 0.80,            // 포맷 감지
  FORMAT_INCREMENT_PER_MATCH: 0.05,        // 매칭당 증가

  // 범위/제약
  RANGE_CONFIDENCE: 0.80,                  // 범위 정보

  // 신뢰도 증가
  KEYWORD_INCREMENT_PER_MATCH: 0.1,        // 키워드 개수당 증가
  CONFIDENCE_BOOST_FOR_MULTI_SOURCES: 0.05, // 다중 소스

  // 가중치 (합계 100%)
  WEIGHTS: {
    FUNCTION_NAME: 0.25,      // 함수명 분석
    VARIABLE_NAME: 0.25,      // 변수명 분석
    COMMENT: 0.15,            // 주석 분석
    SEMANTIC: 0.25,           // 시맨틱 분석
    CONTEXT: 0.10             // 컨텍스트
  },

  // 함수 시그니처 가중치 세분화
  SIGNATURE_WEIGHTS: {
    NAME: 0.25,
    COMMENT: 0.15,
    SEMANTIC: 0.25,
    CONTEXT: 0.35             // 함수 레벨에서는 컨텍스트 중요
  },

  // 변수별 가중치 세분화
  VARIABLE_WEIGHTS: {
    NAME: 0.25,
    COMMENT: 0.15,
    SEMANTIC: 0.30,           // 변수 레벨에서는 시맨틱 중요
    CONTEXT: 0.30
  },

  // 최종 신뢰도 합성
  SIGNATURE_WEIGHT_IN_OVERALL: 0.4,        // 함수 시그니처 40%
  VARIABLE_WEIGHT_IN_OVERALL: 0.6,         // 변수 평균 60%
};

/**
 * 신뢰도 계산 유틸리티
 */
export class ConfidenceCalculator {
  /**
   * 가중치 기반 신뢰도 계산
   * @param items 신뢰도 항목 배열
   * @param normalize 정규화 여부 (기본: true)
   */
  static calculateWeighted(
    items: Array<{ confidence: number; weight: number }>,
    normalize: boolean = true
  ): number {
    let totalConfidence = 0;
    let totalWeight = 0;

    for (const item of items) {
      if (item.confidence > 0) {
        totalConfidence += item.confidence * item.weight;
        totalWeight += item.weight;
      }
    }

    if (totalWeight === 0) {
      return CONFIDENCE_CONSTANTS.DEFAULT_CONFIDENCE;
    }

    const result = totalConfidence / totalWeight;
    return normalize ? this.normalize(result) : result;
  }

  /**
   * 신뢰도 정규화 (0.0 ~ MAX_CONFIDENCE)
   */
  static normalize(confidence: number): number {
    return Math.min(
      CONFIDENCE_CONSTANTS.MAX_CONFIDENCE,
      Math.max(CONFIDENCE_CONSTANTS.MIN_CONFIDENCE, confidence)
    );
  }

  /**
   * 키워드 매칭 신뢰도 계산
   * @param matchCount 매칭된 키워드 개수
   * @param totalCount 전체 키워드 수
   */
  static calculateKeywordConfidence(
    matchCount: number,
    totalCount?: number
  ): number {
    const baseConfidence = CONFIDENCE_CONSTANTS.KEYWORD_BASE_CONFIDENCE;
    const increment = Math.min(
      matchCount * CONFIDENCE_CONSTANTS.KEYWORD_INCREMENT_PER_MATCH,
      0.25 // 최대 25% 증가
    );
    const result = baseConfidence + increment;
    return this.normalize(result);
  }

  /**
   * 포맷 매칭 신뢰도 계산
   * @param matchCount 매칭된 포맷 개수
   */
  static calculateFormatConfidence(matchCount: number): number {
    const increment = Math.min(
      matchCount * CONFIDENCE_CONSTANTS.FORMAT_INCREMENT_PER_MATCH,
      0.15 // 최대 15% 증가
    );
    const result = CONFIDENCE_CONSTANTS.FORMAT_BASE_CONFIDENCE + increment;
    return this.normalize(result);
  }

  /**
   * 부분 매칭 신뢰도 페널티 적용
   * @param baseConfidence 기본 신뢰도
   */
  static applyPartialMatchPenalty(baseConfidence: number): number {
    return this.normalize(baseConfidence * CONFIDENCE_CONSTANTS.PARTIAL_MATCH_PENALTY);
  }

  /**
   * 다중 소스 신뢰도 부스트
   * @param confidence 기본 신뢰도
   * @param sourceCount 소스 개수
   */
  static applyMultiSourceBoost(confidence: number, sourceCount: number): number {
    if (sourceCount < 2) return confidence;

    const boost = Math.min(
      (sourceCount - 1) * CONFIDENCE_CONSTANTS.CONFIDENCE_BOOST_FOR_MULTI_SOURCES,
      0.10 // 최대 10% 부스트
    );
    return this.normalize(confidence + boost);
  }

  /**
   * 함수 시그니처 신뢰도 계산
   * @param nameConfidence 함수명 신뢰도
   * @param commentConfidence 주석 신뢰도
   * @param semanticConfidence 시맨틱 신뢰도 (선택)
   */
  static calculateSignatureConfidence(
    nameConfidence: number,
    commentConfidence: number,
    semanticConfidence?: number
  ): number {
    const items = [
      { confidence: nameConfidence, weight: CONFIDENCE_CONSTANTS.SIGNATURE_WEIGHTS.NAME },
      { confidence: commentConfidence, weight: CONFIDENCE_CONSTANTS.SIGNATURE_WEIGHTS.COMMENT }
    ];

    if (semanticConfidence !== undefined) {
      items.push({
        confidence: semanticConfidence,
        weight: CONFIDENCE_CONSTANTS.SIGNATURE_WEIGHTS.SEMANTIC
      });
    }

    return this.calculateWeighted(items);
  }

  /**
   * 변수 신뢰도 계산
   * @param nameConfidence 변수명 신뢰도
   * @param commentConfidence 주석 신뢰도
   * @param semanticConfidence 시맨틱 신뢰도 (선택)
   */
  static calculateVariableConfidence(
    nameConfidence: number,
    commentConfidence: number,
    semanticConfidence?: number
  ): number {
    const items = [
      { confidence: nameConfidence, weight: CONFIDENCE_CONSTANTS.VARIABLE_WEIGHTS.NAME },
      { confidence: commentConfidence, weight: CONFIDENCE_CONSTANTS.VARIABLE_WEIGHTS.COMMENT }
    ];

    if (semanticConfidence !== undefined) {
      items.push({
        confidence: semanticConfidence,
        weight: CONFIDENCE_CONSTANTS.VARIABLE_WEIGHTS.SEMANTIC
      });
    }

    return this.calculateWeighted(items);
  }

  /**
   * 전체 신뢰도 계산 (함수 + 변수)
   * @param signatureConfidence 함수 시그니처 신뢰도
   * @param variableConfidences 변수 신뢰도 배열
   */
  static calculateOverallConfidence(
    signatureConfidence: number,
    variableConfidences: number[]
  ): number {
    if (variableConfidences.length === 0) {
      return signatureConfidence;
    }

    const avgVariableConfidence =
      variableConfidences.reduce((sum, c) => sum + c, 0) / variableConfidences.length;

    return this.calculateWeighted([
      { confidence: signatureConfidence, weight: CONFIDENCE_CONSTANTS.SIGNATURE_WEIGHT_IN_OVERALL },
      { confidence: avgVariableConfidence, weight: CONFIDENCE_CONSTANTS.VARIABLE_WEIGHT_IN_OVERALL }
    ]);
  }

  /**
   * 신뢰도가 충분한지 확인
   */
  static isHighConfidence(
    confidence: number,
    threshold: number = 0.75
  ): boolean {
    return confidence >= threshold;
  }

  /**
   * 충돌 심각도 판정
   */
  static determineConflictSeverity(
    confidence: number
  ): 'info' | 'warning' | 'error' {
    if (confidence < 0.3) return 'error';
    if (confidence < 0.6) return 'warning';
    return 'info';
  }

  /**
   * 신뢰도 비교 (음수: a < b, 0: a == b, 양수: a > b)
   */
  static compare(
    confidenceA: number,
    confidenceB: number,
    threshold: number = 0.05
  ): -1 | 0 | 1 {
    const diff = Math.abs(confidenceA - confidenceB);
    if (diff < threshold) return 0;
    return confidenceA < confidenceB ? -1 : 1;
  }
}
