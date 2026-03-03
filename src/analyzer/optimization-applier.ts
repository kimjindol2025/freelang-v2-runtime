/**
 * Phase 5 Step 2: AI Decision Engine for Optimization Application
 *
 * 철학: 각 최적화 제안에 대해 AI가 자동으로 "적용"을 결정
 * - 신뢰도 + 예상 이득 + 학습 경험을 종합 고려
 * - 부작용이 있을 수 있는 최적화는 신중하게
 * - 학습 데이터를 활용한 적응형 결정
 */

import { Inst, Op } from '../types';
import { OptimizationSuggestion } from './optimization-detector';
import { PatternEntry } from '../types';

/**
 * 최적화 적용 결정 결과
 */
export interface OptimizationDecision {
  suggestion: OptimizationSuggestion;
  shouldApply: boolean; // AI가 결정한 "적용 여부"
  confidence: number; // 이 결정에 대한 AI의 확신도 (0.0~1.0)
  reasoning: string[]; // 왜 이런 결정을 했는가?
  riskLevel: 'safe' | 'moderate' | 'risky'; // 위험 수준
}

/**
 * 최적화 적용 결정 엔진 (AI-Driven)
 */
export class OptimizationApplier {
  /**
   * 제안된 최적화에 대해 "적용할지" 결정
   *
   * 결정 요소:
   * 1. Suggestion confidence (제안의 신뢰도)
   * 2. Expected improvement (예상 성능 개선)
   * 3. Risk level (부작용 위험도)
   * 4. Learning history (과거 학습 데이터)
   * 5. Code complexity (코드 복잡도 변화)
   */
  decide(
    suggestion: OptimizationSuggestion,
    learningHistory?: PatternEntry[]
  ): OptimizationDecision {
    const reasoning: string[] = [];
    let decisionScore = 0; // 0.0 ~ 1.0, 높을수록 "적용하기"

    // ========== Factor 1: Suggestion Confidence ==========
    // 원본 제안의 신뢰도
    const confidenceFactor = suggestion.confidence;
    decisionScore += confidenceFactor * 0.35; // 35% 가중치

    reasoning.push(`1. Suggestion confidence: ${(confidenceFactor * 100).toFixed(0)}%`);

    // ========== Factor 2: Expected Improvement ==========
    // 예상 성능 개선도
    // 0-5%: 낮음, 5-15%: 중간, 15%+: 높음
    let improvementFactor = 0;
    if (suggestion.expected_improvement >= 15) {
      improvementFactor = 1.0;
      reasoning.push(
        `2. Expected improvement: HIGH (${suggestion.expected_improvement}%) → Strong signal to apply`
      );
    } else if (suggestion.expected_improvement >= 5) {
      improvementFactor = 0.7;
      reasoning.push(
        `2. Expected improvement: MEDIUM (${suggestion.expected_improvement}%) → Reasonable benefit`
      );
    } else {
      improvementFactor = 0.4;
      reasoning.push(
        `2. Expected improvement: LOW (${suggestion.expected_improvement}%) → Marginal benefit`
      );
    }
    decisionScore += improvementFactor * 0.25; // 25% 가중치

    // ========== Factor 3: Risk Level ==========
    // 최적화 타입별 위험도
    let riskFactor = 1.0;
    let riskLevel: 'safe' | 'moderate' | 'risky' = 'safe';

    switch (suggestion.type) {
      case 'constant_folding':
        // 상수 계산은 매우 안전 (0/0은 이미 필터됨)
        riskFactor = 1.0;
        riskLevel = 'safe';
        reasoning.push('3. Risk level: SAFE (constant folding has no side effects)');
        break;

      case 'dce':
        // DCE도 안전 (사용되지 않는 변수만 제거)
        riskFactor = 0.95;
        riskLevel = 'safe';
        reasoning.push('3. Risk level: SAFE (DCE only removes unused code)');
        break;

      case 'strength_reduction':
        // Strength reduction은 적당한 위험도
        // 비트 시프트는 안전하지만, 특수한 경우 문제 가능
        riskFactor = 0.8;
        riskLevel = 'moderate';
        reasoning.push('3. Risk level: MODERATE (strength reduction requires target verification)');
        break;

      case 'loop_unroll':
        // 루프 언롤링은 코드 크기 증가 위험
        riskFactor = 0.65;
        riskLevel = 'risky';
        reasoning.push('3. Risk level: RISKY (loop unroll may cause code bloat)');
        break;

      default:
        riskFactor = 0.7;
        riskLevel = 'moderate';
    }

    decisionScore += riskFactor * 0.15; // 15% 가중치

    // ========== Factor 4: Learning History ==========
    // 과거 학습 데이터에서 이 타입의 최적화가 성공적이었는가?
    let learningFactor = 0.5; // 기본값: 중립

    if (learningHistory && learningHistory.length > 0) {
      // 같은 타입의 최적화 성공률 계산
      const similarPatterns = learningHistory.filter(p =>
        this.isSimilarOptimizationType(suggestion.type, p)
      );

      if (similarPatterns.length > 0) {
        const successRate = similarPatterns.filter(p => p.success_count > p.fail_count).length /
          similarPatterns.length;
        learningFactor = successRate;

        reasoning.push(
          `4. Learning history: ${(successRate * 100).toFixed(0)}% success rate from ${similarPatterns.length} similar patterns`
        );
      } else {
        reasoning.push('4. Learning history: No similar patterns found (neutral score)');
      }
    } else {
      reasoning.push('4. Learning history: No history available (neutral score)');
    }

    decisionScore += learningFactor * 0.15; // 15% 가중치

    // ========== Factor 5: Code Complexity ==========
    // 최적화 전후 코드 복잡도 변화
    let complexityFactor = 0.5;
    const beforeSize = suggestion.before.length;
    const afterSize = suggestion.after?.length || 0;
    const complexityReduction = beforeSize - afterSize;

    if (complexityReduction > 0) {
      // 코드가 단순해짐 = 좋음
      complexityFactor = Math.min(1.0, 0.5 + complexityReduction * 0.1);
      reasoning.push(
        `5. Code complexity: SIMPLIFIED (${beforeSize} → ${afterSize} instructions, saves ${complexityReduction})`
      );
    } else if (complexityReduction === 0) {
      // 코드 크기 변화 없음
      complexityFactor = 0.5;
      reasoning.push('5. Code complexity: NEUTRAL (no change in code size)');
    } else {
      // 코드가 복잡해짐 = 주의
      complexityFactor = Math.max(0.0, 0.5 + complexityReduction * 0.1);
      reasoning.push(
        `5. Code complexity: INFLATED (${beforeSize} → ${afterSize} instructions, adds ${-complexityReduction})`
      );
    }

    decisionScore += complexityFactor * 0.1; // 10% 가중치

    // ========== Final Decision ==========
    // 최종 점수를 기반으로 결정
    // Threshold: 0.6 (60% 이상이면 "적용")
    const threshold = 0.6;
    const shouldApply = decisionScore >= threshold;

    if (shouldApply) {
      reasoning.push(`\n✅ DECISION: APPLY (score: ${decisionScore.toFixed(3)})`);
    } else {
      reasoning.push(`\n❌ DECISION: SKIP (score: ${decisionScore.toFixed(3)}, threshold: ${threshold})`);
    }

    return {
      suggestion,
      shouldApply,
      confidence: decisionScore,
      reasoning,
      riskLevel,
    };
  }

  /**
   * 여러 제안에 대해 모두 결정
   */
  decideAll(
    suggestions: OptimizationSuggestion[],
    learningHistory?: PatternEntry[]
  ): OptimizationDecision[] {
    return suggestions.map(s => this.decide(s, learningHistory));
  }

  /**
   * 결정 결과를 바탕으로 실제로 최적화 적용
   */
  applyOptimizations(
    instructions: Inst[],
    decisions: OptimizationDecision[]
  ): {
    optimized: Inst[];
    applied: OptimizationDecision[];
    skipped: OptimizationDecision[];
  } {
    const applied: OptimizationDecision[] = [];
    const skipped: OptimizationDecision[] = [];

    // 적용할 최적화들만 필터링
    const toApply = decisions.filter(d => {
      if (d.shouldApply) {
        applied.push(d);
        return true;
      } else {
        skipped.push(d);
        return false;
      }
    });

    // 실제 적용 (간단한 구현: 제안의 after로 대체)
    let optimized = [...instructions];

    for (const decision of toApply) {
      const { suggestion } = decision;
      const indices = suggestion.instruction_indices;

      if (indices.length > 0) {
        // 인덱스 역순으로 처리 (뒤부터 지워야 인덱스가 흐트러지지 않음)
        const sortedIndices = [...indices].sort((a, b) => b - a);

        // 기존 명령어 제거
        for (const idx of sortedIndices) {
          optimized.splice(idx, 1);
        }

        // 새 명령어 삽입 (첫 번째 위치에)
        if (suggestion.after && suggestion.after.length > 0) {
          const firstIdx = Math.min(...indices);
          optimized.splice(firstIdx, 0, ...suggestion.after);
        }
      }
    }

    return {
      optimized,
      applied,
      skipped,
    };
  }

  /**
   * 최적화 타입이 비슷한지 판정 (학습 히스토리 비교용)
   */
  private isSimilarOptimizationType(
    type1: OptimizationSuggestion['type'],
    pattern: PatternEntry
  ): boolean {
    // 간단한 구현: 동일하면 true
    // 실제론 pattern.body_hash를 분석해서 더 정교하게 비교 가능
    return pattern.fn === type1;
  }

  /**
   * 결정 요약
   */
  summarize(decisions: OptimizationDecision[]): string {
    const applied = decisions.filter(d => d.shouldApply);
    const skipped = decisions.filter(d => !d.shouldApply);

    let summary = `🤖 AI Decision Summary:\n`;
    summary += `   Total suggestions: ${decisions.length}\n`;
    summary += `   ✅ Will apply: ${applied.length}\n`;
    summary += `   ❌ Will skip: ${skipped.length}\n\n`;

    if (applied.length > 0) {
      summary += `Applied optimizations:\n`;
      applied.forEach((d, idx) => {
        summary += `  ${idx + 1}. ${d.suggestion.type} (confidence: ${(d.confidence * 100).toFixed(0)}%)\n`;
      });
    }

    if (skipped.length > 0) {
      summary += `\nSkipped optimizations:\n`;
      skipped.forEach((d, idx) => {
        summary += `  ${idx + 1}. ${d.suggestion.type} (score: ${(d.confidence * 100).toFixed(0)}%, below threshold)\n`;
      });
    }

    return summary;
  }
}

/**
 * 편의 함수
 */
export function applyOptimizations(
  instructions: Inst[],
  suggestions: OptimizationSuggestion[],
  learningHistory?: PatternEntry[]
): {
  optimized: Inst[];
  decisions: OptimizationDecision[];
  summary: string;
} {
  const applier = new OptimizationApplier();
  const decisions = applier.decideAll(suggestions, learningHistory);
  const { optimized } = applier.applyOptimizations(instructions, decisions);
  const summary = applier.summarize(decisions);

  return { optimized, decisions, summary };
}
