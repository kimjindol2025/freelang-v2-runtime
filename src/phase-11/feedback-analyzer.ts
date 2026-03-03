/**
 * Phase 11: Feedback Analyzer
 *
 * Maps feedback entries (from Phase 8) to Intent patterns (from Phase 10)
 * and generates usage metrics for confidence adjustment.
 */

import { FeedbackEntry, FeedbackStats } from '../feedback/feedback-types';
import { IntentPattern } from '../phase-10/unified-pattern-database';

/**
 * Usage metrics for a single pattern
 */
export interface PatternUsageMetrics {
  patternId: string;
  patternName: string;
  usageCount: number;
  approvedCount: number;
  modifiedCount: number;
  rejectedCount: number;
  suggestedCount: number;

  // Calculated metrics
  approvalRate: number;       // approved / total
  modificationRate: number;   // modified / total
  rejectionRate: number;      // rejected / total
  averageAccuracy: number;    // 0.0-1.0

  // Statistics
  firstUsed?: number;         // timestamp
  lastUsed?: number;          // timestamp
  sessionCount: number;       // unique sessions
  avgAccuracyPerSession: number;
}

/**
 * Aggregated statistics for all patterns
 */
export interface AggregatedStats {
  totalFeedbackEntries: number;
  totalPatterns: number;
  patternsWithFeedback: number;
  patternsWithoutFeedback: number;

  approvalRate: number;
  modificationRate: number;
  rejectionRate: number;

  metrics: Map<string, PatternUsageMetrics>;
  categoryStats: Map<string, CategoryStats>;
}

/**
 * Per-category statistics
 */
export interface CategoryStats {
  category: string;
  patternCount: number;
  feedbackCount: number;
  approvalRate: number;
  averageAccuracy: number;
}

/**
 * Feedback Analyzer
 *
 * Maps feedback entries to patterns and calculates usage metrics
 */
export class FeedbackAnalyzer {
  private patterns: Map<string, IntentPattern>;
  private uniquePatterns: Map<string, IntentPattern>; // Track unique patterns by ID
  private feedbackByPattern: Map<string, FeedbackEntry[]>;

  constructor(allPatterns: IntentPattern[]) {
    // Index patterns by name and aliases for quick lookup
    this.patterns = new Map();
    this.uniquePatterns = new Map();

    for (const pattern of allPatterns) {
      this.patterns.set(pattern.name, pattern);
      this.uniquePatterns.set(pattern.id, pattern);

      // Also index by aliases for flexible matching
      for (const alias of pattern.aliases) {
        this.patterns.set(alias.toLowerCase(), pattern);
      }
    }

    this.feedbackByPattern = new Map();
  }

  /**
   * Analyze feedback and map to patterns
   */
  analyzeFeedback(feedbackEntries: FeedbackEntry[]): AggregatedStats {
    // Reset state
    this.feedbackByPattern.clear();

    // Group feedback by pattern
    for (const entry of feedbackEntries) {
      const patternName = this.mapOperationToPattern(entry.proposal.operation);

      if (patternName) {
        if (!this.feedbackByPattern.has(patternName)) {
          this.feedbackByPattern.set(patternName, []);
        }
        this.feedbackByPattern.get(patternName)!.push(entry);
      }
    }

    // Calculate metrics for each pattern
    const metrics = new Map<string, PatternUsageMetrics>();

    for (const [patternName, feedback] of this.feedbackByPattern) {
      const pattern = this.patterns.get(patternName);
      if (pattern) {
        metrics.set(pattern.id, this.calculateMetrics(pattern, feedback));
      }
    }

    // Calculate category stats
    const categoryStats = this.calculateCategoryStats(metrics);

    // Return aggregated statistics
    return {
      totalFeedbackEntries: feedbackEntries.length,
      totalPatterns: this.uniquePatterns.size,
      patternsWithFeedback: metrics.size,
      patternsWithoutFeedback: this.uniquePatterns.size - metrics.size,
      approvalRate: this.calculateOverallApprovalRate(metrics),
      modificationRate: this.calculateOverallModificationRate(metrics),
      rejectionRate: this.calculateOverallRejectionRate(metrics),
      metrics,
      categoryStats,
    };
  }

  /**
   * Map operation name to pattern name
   * Examples: "sum" → "sum", "add_all" → "sum", "total" → "sum"
   */
  private mapOperationToPattern(operation: string): string | null {
    const normalized = operation.toLowerCase();

    // Direct match
    if (this.patterns.has(normalized)) {
      return normalized;
    }

    // Check aliases
    for (const [alias, pattern] of this.patterns) {
      if (alias.includes(normalized) || normalized.includes(alias)) {
        return pattern.name;
      }
    }

    return null;
  }

  /**
   * Calculate usage metrics for a pattern based on its feedback
   */
  private calculateMetrics(
    pattern: IntentPattern,
    feedback: FeedbackEntry[]
  ): PatternUsageMetrics {
    const approved = feedback.filter(f => f.userFeedback.action === 'approve').length;
    const modified = feedback.filter(f => f.userFeedback.action === 'modify').length;
    const rejected = feedback.filter(f => f.userFeedback.action === 'reject').length;
    const suggested = feedback.filter(f => f.userFeedback.action === 'suggest').length;

    const total = feedback.length;
    const accuracies = feedback.map(f => f.analysis.accuracy);
    const averageAccuracy = total > 0
      ? accuracies.reduce((a, b) => a + b, 0) / total
      : 0;

    // Calculate per-session metrics
    const sessions = new Set(feedback.map(f => f.sessionId));
    const sessionAccuracies: Map<string, number[]> = new Map();

    for (const entry of feedback) {
      if (!sessionAccuracies.has(entry.sessionId)) {
        sessionAccuracies.set(entry.sessionId, []);
      }
      sessionAccuracies.get(entry.sessionId)!.push(entry.analysis.accuracy);
    }

    const avgAccuracyPerSession = Array.from(sessionAccuracies.values())
      .map(accs => accs.reduce((a, b) => a + b, 0) / accs.length)
      .reduce((a, b) => a + b, 0) / sessions.size;

    // Get timestamps
    const timestamps = feedback.map(f => f.timestamp).sort((a, b) => a - b);

    return {
      patternId: pattern.id,
      patternName: pattern.name,
      usageCount: total,
      approvedCount: approved,
      modifiedCount: modified,
      rejectedCount: rejected,
      suggestedCount: suggested,

      approvalRate: total > 0 ? approved / total : 0,
      modificationRate: total > 0 ? modified / total : 0,
      rejectionRate: total > 0 ? rejected / total : 0,
      averageAccuracy,

      firstUsed: timestamps.length > 0 ? timestamps[0] : undefined,
      lastUsed: timestamps.length > 0 ? timestamps[timestamps.length - 1] : undefined,
      sessionCount: sessions.size,
      avgAccuracyPerSession,
    };
  }

  /**
   * Calculate statistics by category
   */
  private calculateCategoryStats(
    metrics: Map<string, PatternUsageMetrics>
  ): Map<string, CategoryStats> {
    const stats = new Map<string, CategoryStats>();

    for (const [patternId, metric] of metrics) {
      const pattern = Array.from(this.patterns.values()).find(p => p.id === patternId);
      if (!pattern) continue;

      const category = pattern.category;
      if (!stats.has(category)) {
        // Count total patterns in category
        const patternsInCategory = Array.from(this.patterns.values())
          .filter(p => p.category === category).length;

        stats.set(category, {
          category,
          patternCount: patternsInCategory,
          feedbackCount: 0,
          approvalRate: 0,
          averageAccuracy: 0,
        });
      }

      const cat = stats.get(category)!;
      cat.feedbackCount += metric.usageCount;
    }

    // Calculate averages
    for (const [category, stat] of stats) {
      const patternsInCategory = Array.from(metrics.values())
        .filter(m => {
          const p = Array.from(this.patterns.values()).find(x => x.id === m.patternId);
          return p && p.category === category;
        });

      if (patternsInCategory.length > 0) {
        const avgApproval = patternsInCategory
          .reduce((sum, m) => sum + m.approvalRate, 0) / patternsInCategory.length;
        const avgAccuracy = patternsInCategory
          .reduce((sum, m) => sum + m.averageAccuracy, 0) / patternsInCategory.length;

        stat.approvalRate = avgApproval;
        stat.averageAccuracy = avgAccuracy;
      }
    }

    return stats;
  }

  /**
   * Calculate overall approval rate across all patterns
   */
  private calculateOverallApprovalRate(metrics: Map<string, PatternUsageMetrics>): number {
    let totalApproved = 0;
    let totalUsage = 0;

    for (const metric of metrics.values()) {
      totalApproved += metric.approvedCount;
      totalUsage += metric.usageCount;
    }

    return totalUsage > 0 ? totalApproved / totalUsage : 0;
  }

  /**
   * Calculate overall modification rate
   */
  private calculateOverallModificationRate(metrics: Map<string, PatternUsageMetrics>): number {
    let totalModified = 0;
    let totalUsage = 0;

    for (const metric of metrics.values()) {
      totalModified += metric.modifiedCount;
      totalUsage += metric.usageCount;
    }

    return totalUsage > 0 ? totalModified / totalUsage : 0;
  }

  /**
   * Calculate overall rejection rate
   */
  private calculateOverallRejectionRate(metrics: Map<string, PatternUsageMetrics>): number {
    let totalRejected = 0;
    let totalUsage = 0;

    for (const metric of metrics.values()) {
      totalRejected += metric.rejectedCount;
      totalUsage += metric.usageCount;
    }

    return totalUsage > 0 ? totalRejected / totalUsage : 0;
  }

  /**
   * Get metrics for a specific pattern
   */
  getMetricsForPattern(patternId: string): PatternUsageMetrics | undefined {
    for (const metric of this.feedbackByPattern.values()) {
      // This is incorrect, need to fix
    }
    return undefined;
  }

  /**
   * Get patterns that have no feedback (candidates for investigation)
   */
  getPatternsWithoutFeedback(): IntentPattern[] {
    const patternsWithFeedback = new Set(
      Array.from(this.feedbackByPattern.keys()).map(name => {
        const pattern = this.patterns.get(name);
        return pattern ? pattern.id : null;
      })
    );
    patternsWithFeedback.delete(null);

    return Array.from(this.uniquePatterns.values()).filter(p => !patternsWithFeedback.has(p.id));
  }
}

export default FeedbackAnalyzer;
