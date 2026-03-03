/**
 * Phase 11: Dynamic Confidence Adjuster
 *
 * Adjusts Intent pattern confidence scores based on feedback metrics
 * from Phase 8 analysis via the FeedbackAnalyzer.
 */

import { IntentPattern } from '../phase-10/unified-pattern-database';
import { PatternUsageMetrics, AggregatedStats } from './feedback-analyzer';

/**
 * Pattern with adjusted confidence
 */
export interface AdjustedPattern extends IntentPattern {
  originalConfidence: number;
  adjustedConfidence: number;
  confidenceChange: number;
  adjustmentFactors: ConfidenceAdjustmentFactors;
}

/**
 * Breakdown of confidence adjustment factors
 */
export interface ConfidenceAdjustmentFactors {
  usageFactor: number;         // Based on usage frequency
  satisfactionFactor: number;  // Based on approval rate
  accuracyFactor: number;      // Based on average accuracy
  statisticalSignificance: number; // Confidence in the adjustment
  finalAdjustment: number;     // Combined adjustment
}

/**
 * Dynamic Confidence Adjuster
 *
 * Adjusts pattern confidence based on actual usage feedback.
 * Algorithm:
 *   adjustedConfidence = originalConfidence × (1 + finalAdjustment)
 *   where finalAdjustment combines multiple factors (capped at ±0.15)
 */
export class DynamicConfidenceAdjuster {
  // Configuration
  private minConfidence = 0.70;
  private maxConfidence = 0.99;
  private maxAdjustment = 0.15;  // Max ±15% adjustment
  private minFeedbackForAdjustment = 3; // Require at least 3 feedback entries

  constructor(config?: {
    minConfidence?: number;
    maxConfidence?: number;
    maxAdjustment?: number;
    minFeedbackForAdjustment?: number;
  }) {
    if (config?.minConfidence !== undefined) this.minConfidence = config.minConfidence;
    if (config?.maxConfidence !== undefined) this.maxConfidence = config.maxConfidence;
    if (config?.maxAdjustment !== undefined) this.maxAdjustment = config.maxAdjustment;
    if (config?.minFeedbackForAdjustment !== undefined) {
      this.minFeedbackForAdjustment = config.minFeedbackForAdjustment;
    }
  }

  /**
   * Adjust a single pattern's confidence
   */
  adjustPattern(
    pattern: IntentPattern,
    metrics: PatternUsageMetrics
  ): AdjustedPattern {
    const adjustmentFactors = this.calculateAdjustmentFactors(pattern, metrics);

    // Apply adjustment
    const adjustment = adjustmentFactors.finalAdjustment;
    const adjustedConfidence = this.normalizeConfidence(
      pattern.confidence * (1 + adjustment)
    );

    return {
      ...pattern,
      originalConfidence: pattern.confidence,
      adjustedConfidence,
      confidenceChange: adjustedConfidence - pattern.confidence,
      adjustmentFactors,
    };
  }

  /**
   * Adjust all patterns in a database
   */
  adjustAllPatterns(
    patterns: IntentPattern[],
    aggregatedStats: AggregatedStats
  ): AdjustedPattern[] {
    const adjusted: AdjustedPattern[] = [];

    for (const pattern of patterns) {
      const metrics = aggregatedStats.metrics.get(pattern.id);

      if (metrics && metrics.usageCount >= this.minFeedbackForAdjustment) {
        // Pattern has sufficient feedback - adjust it
        adjusted.push(this.adjustPattern(pattern, metrics));
      } else {
        // Pattern has insufficient feedback - keep original confidence
        adjusted.push({
          ...pattern,
          originalConfidence: pattern.confidence,
          adjustedConfidence: pattern.confidence,
          confidenceChange: 0,
          adjustmentFactors: {
            usageFactor: 0,
            satisfactionFactor: 0,
            accuracyFactor: 0,
            statisticalSignificance: 0,
            finalAdjustment: 0,
          },
        });
      }
    }

    return adjusted;
  }

  /**
   * Calculate adjustment factors for a pattern
   */
  private calculateAdjustmentFactors(
    pattern: IntentPattern,
    metrics: PatternUsageMetrics
  ): ConfidenceAdjustmentFactors {
    // Factor 1: Usage frequency (more usage = confidence boost, with diminishing returns)
    const usageFactor = this.calculateUsageFactor(metrics.usageCount);

    // Factor 2: User satisfaction (approval rate vs rejection rate)
    const satisfactionFactor = this.calculateSatisfactionFactor(metrics);

    // Factor 3: Average accuracy from feedback
    const accuracyFactor = this.calculateAccuracyFactor(metrics.averageAccuracy);

    // Factor 4: Statistical significance (confidence in the adjustment)
    const statisticalSignificance = this.calculateStatisticalSignificance(
      metrics.usageCount,
      metrics.sessionCount
    );

    // Combine factors with weighting
    const weights = {
      usage: 0.2,        // 20% weight
      satisfaction: 0.4, // 40% weight (most important)
      accuracy: 0.3,     // 30% weight
      significance: 0.1, // 10% weight (damping factor)
    };

    let finalAdjustment =
      usageFactor * weights.usage +
      satisfactionFactor * weights.satisfaction +
      accuracyFactor * weights.accuracy;

    // Dampen by statistical significance
    finalAdjustment *= (0.5 + statisticalSignificance * 0.5); // Range 0.5-1.0

    // Cap adjustment
    finalAdjustment = Math.max(-this.maxAdjustment, Math.min(this.maxAdjustment, finalAdjustment));

    return {
      usageFactor,
      satisfactionFactor,
      accuracyFactor,
      statisticalSignificance,
      finalAdjustment,
    };
  }

  /**
   * Usage frequency factor: More usage = higher boost (logarithmic)
   * Range: -0.05 to +0.10
   */
  private calculateUsageFactor(usageCount: number): number {
    if (usageCount < 1) return 0;
    if (usageCount === 1) return -0.02; // Single usage slightly penalizes
    if (usageCount === 2) return 0;     // Two usages neutral
    if (usageCount <= 5) return 0.02;   // Few usages small boost
    if (usageCount <= 20) return 0.05;  // Moderate usage
    return 0.10;                        // Heavy usage max boost
  }

  /**
   * User satisfaction factor: (approval + suggestion) - rejection
   * Range: -0.10 to +0.10
   */
  private calculateSatisfactionFactor(metrics: PatternUsageMetrics): number {
    const positive = metrics.approvedCount + metrics.suggestedCount * 0.5;
    const negative = metrics.rejectedCount;
    const modified = metrics.modifiedCount * 0.2; // Modified is slightly negative

    const total = metrics.usageCount;
    if (total === 0) return 0;

    const netSatisfaction = (positive - negative - modified) / total;

    // Convert to adjustment range
    return Math.max(-0.10, Math.min(0.10, netSatisfaction * 0.15));
  }

  /**
   * Accuracy factor: Based on average accuracy from feedback
   * Range: -0.05 to +0.05
   */
  private calculateAccuracyFactor(averageAccuracy: number): number {
    // averageAccuracy ranges from 0 to 1
    // Convert to -0.05 to +0.05 range
    // 0.5 → 0 (neutral), 0 → -0.05, 1.0 → +0.05
    return (averageAccuracy - 0.5) * 0.1;
  }

  /**
   * Statistical significance: More feedback = higher confidence in adjustment
   * Also considers session diversity (different sessions = more representative)
   * Range: 0 to 1
   */
  private calculateStatisticalSignificance(
    usageCount: number,
    sessionCount: number
  ): number {
    // Require at least minFeedbackForAdjustment entries
    if (usageCount < this.minFeedbackForAdjustment) return 0;

    // Significance increases with usage, but with diminishing returns
    const usageSignificance = Math.min(1.0, Math.log(usageCount + 1) / Math.log(50));

    // Session diversity also matters (ideally spread across multiple sessions)
    const sessionsPerFeedback = sessionCount / Math.max(1, usageCount);
    const sessionSignificance = Math.min(1.0, sessionsPerFeedback);

    return (usageSignificance + sessionSignificance) / 2;
  }

  /**
   * Normalize confidence to valid range [minConfidence, maxConfidence]
   */
  private normalizeConfidence(value: number): number {
    return Math.max(this.minConfidence, Math.min(this.maxConfidence, value));
  }

  /**
   * Generate a report comparing original and adjusted confidences
   */
  generateComparisonReport(
    original: IntentPattern[],
    adjusted: AdjustedPattern[]
  ): ConfidenceComparisonReport {
    const improvements = adjusted.filter(a => a.confidenceChange > 0);
    const degradations = adjusted.filter(a => a.confidenceChange < 0);
    const unchanged = adjusted.filter(a => a.confidenceChange === 0);

    const avgOriginal =
      original.reduce((sum, p) => sum + p.confidence, 0) / original.length;
    const avgAdjusted =
      adjusted.reduce((sum, p) => sum + p.adjustedConfidence, 0) / adjusted.length;

    const highConfidenceBefore = original.filter(p => p.confidence >= 0.85).length;
    const highConfidenceAfter = adjusted.filter(p => p.adjustedConfidence >= 0.85).length;

    return {
      totalPatterns: adjusted.length,
      averageConfidenceBefore: avgOriginal,
      averageConfidenceAfter: avgAdjusted,
      averageConfidenceChange: avgAdjusted - avgOriginal,

      improvementsCount: improvements.length,
      improvementsAverage: improvements.length > 0
        ? improvements.reduce((sum, a) => sum + a.confidenceChange, 0) / improvements.length
        : 0,

      degradationsCount: degradations.length,
      degradationsAverage: degradations.length > 0
        ? degradations.reduce((sum, a) => sum + a.confidenceChange, 0) / degradations.length
        : 0,

      unchangedCount: unchanged.length,

      highConfidenceBefore,
      highConfidenceAfter,
      highConfidenceChange: highConfidenceAfter - highConfidenceBefore,
    };
  }
}

/**
 * Comparison report
 */
export interface ConfidenceComparisonReport {
  totalPatterns: number;
  averageConfidenceBefore: number;
  averageConfidenceAfter: number;
  averageConfidenceChange: number;

  improvementsCount: number;
  improvementsAverage: number;

  degradationsCount: number;
  degradationsAverage: number;

  unchangedCount: number;

  highConfidenceBefore: number;
  highConfidenceAfter: number;
  highConfidenceChange: number;
}

export default DynamicConfidenceAdjuster;
