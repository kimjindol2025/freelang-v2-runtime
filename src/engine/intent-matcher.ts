/**
 * FreeLang v2 - 의도 매칭 엔진
 * 정규화된 토큰 → 의도 패턴 매칭 및 신뢰도 계산
 */

import {
  INTENT_PATTERNS,
  CONFIDENCE_WEIGHTS,
  PATTERN_IDS,
  IntentPattern,
} from './intent-patterns';
import { TextNormalizer } from './text-normalizer';

export interface IntentMatch {
  operation: string;           // 매칭된 패턴 ID (sum, avg, max, 등)
  confidence: number;          // 신뢰도 (0~1)
  alternatives: string[];      // 다른 가능한 패턴들
  details: {
    exactMatches: number;      // 정확 키워드 매칭 개수
    typeScore: number;         // 타입 유추 점수
    clarityScore: number;      // 의도 명확성
    similarityScore: number;   // 유사도 점수
  };
}

export class IntentMatcher {
  /**
   * 정규화된 토큰에서 의도를 매칭
   *
   * 알고리즘:
   * 1. 각 패턴별 신뢰도 계산
   * 2. 신뢰도 기준 정렬
   * 3. 상위 1개 선택 + 나머지는 alternatives
   *
   * @param tokens TextNormalizer.normalize()의 결과
   * @returns 매칭 결과 또는 null
   */
  static matchIntent(tokens: string[]): IntentMatch | null {
    if (tokens.length === 0) {
      return null;
    }

    // 각 패턴별 점수 계산
    const scores: Array<{
      patternId: string;
      confidence: number;
      details: IntentMatch['details'];
    }> = [];

    for (const patternId of PATTERN_IDS) {
      const pattern = INTENT_PATTERNS[patternId];
      const details = this._calculateDetails(tokens, pattern);
      const confidence = this._calculateConfidence(details);

      scores.push({
        patternId,
        confidence,
        details,
      });
    }

    // 신뢰도 기준 정렬
    scores.sort((a, b) => b.confidence - a.confidence);

    // 최고 신뢰도 패턴
    const topScore = scores[0];

    // 신뢰도 임계값 (30% 미만이면 null로 처리)
    if (topScore.confidence < 0.3) {
      return null;
    }

    // Alternatives (신뢰도 80% 이상이고 상위 3개)
    const alternatives = scores
      .slice(1, 4)
      .filter(s => s.confidence >= 0.3)
      .map(s => s.patternId);

    return {
      operation: topScore.patternId,
      confidence: topScore.confidence,
      alternatives,
      details: topScore.details,
    };
  }

  /**
   * 개별 패턴에 대한 점수 세부 계산
   * @private
   */
  private static _calculateDetails(
    tokens: string[],
    pattern: IntentPattern
  ): IntentMatch['details'] {
    // 1. 정확 키워드 매칭
    const exactMatches = TextNormalizer.countMatches(tokens, pattern.keywords);

    // 2. 타입 유추 점수 (더 관대하게)
    // array 관련 키워드가 있으면 가점
    const hasArrayKeyword = tokens.includes('배열') ||
                           tokens.includes('array') ||
                           tokens.includes('데이터') ||
                           tokens.includes('값');
    const typeScore = exactMatches > 0 ? 0.9 : (hasArrayKeyword ? 0.6 : 0.4);

    // 3. 의도 명확성 (매칭된 키워드가 있으면 충분함)
    const clarityScore = exactMatches > 0 ? Math.min(exactMatches * 0.3, 1) : 0.2;

    // 4. 유사도 기반 매칭 (정확하지 않은 키워드도 인식)
    let bestSimilarity = 0;
    for (const token of tokens) {
      for (const keyword of pattern.keywords) {
        const sim = TextNormalizer.similarity(token, keyword);
        if (sim > 0.7) {
          bestSimilarity = Math.max(bestSimilarity, sim);
        }
      }
    }
    const similarityScore = Math.min(bestSimilarity * 0.5, 0.5);

    return {
      exactMatches,
      typeScore,
      clarityScore,
      similarityScore,
    };
  }

  /**
   * 세부 점수에서 최종 신뢰도 계산
   * @private
   */
  private static _calculateConfidence(details: IntentMatch['details']): number {
    const confidence =
      details.typeScore * CONFIDENCE_WEIGHTS.typeInference +
      details.clarityScore * CONFIDENCE_WEIGHTS.intentClarity +
      details.similarityScore * CONFIDENCE_WEIGHTS.similarity;

    // Exact matches bonus (20% 추가 boost)
    const exactBonus = Math.min(details.exactMatches * 0.15, 0.2);

    return Math.min(confidence + exactBonus, 1);
  }

  /**
   * 여러 토큰 배열에서 패턴 ID만 추출
   * matchIntent의 간소 버전
   *
   * @param tokens 정규화된 토큰 배열
   * @returns 매칭된 패턴 ID 또는 null
   */
  static getOperation(tokens: string[]): string | null {
    const match = this.matchIntent(tokens);
    return match?.operation ?? null;
  }

  /**
   * 신뢰도만 추출
   * @param tokens 정규화된 토큰 배열
   * @returns 최고 신뢰도 (0~1) 또는 0
   */
  static getConfidence(tokens: string[]): number {
    const match = this.matchIntent(tokens);
    return match?.confidence ?? 0;
  }
}
