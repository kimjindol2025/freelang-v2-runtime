/**
 * Phase 11: Confidence Reporter
 *
 * Generates comprehensive reports on confidence adjustments
 * and pattern statistics for Phase 11 validation.
 */

import { AdjustedPattern, ConfidenceComparisonReport } from './dynamic-confidence-adjuster';
import { IntentPattern } from '../phase-10/unified-pattern-database';
import { AggregatedStats, CategoryStats } from './feedback-analyzer';

/**
 * Per-pattern report
 */
export interface PatternReport {
  patternId: string;
  patternName: string;
  category: string;
  originalConfidence: number;
  adjustedConfidence: number;
  confidenceChange: number;
  changePercent: number;

  feedbackMetrics?: {
    usageCount: number;
    approvalRate: number;
    rejectionRate: number;
    averageAccuracy: number;
  };
}

/**
 * Category-level report
 */
export interface CategoryReport {
  category: string;
  patternCount: number;
  patternsWithFeedback: number;
  averageConfidenceBefore: number;
  averageConfidenceAfter: number;
  averageConfidenceChange: number;
  improvedPatterns: number;
  degradedPatterns: number;
}

/**
 * Complete report
 */
export interface ConfidenceReport {
  reportDate: string;
  totalPatterns: number;
  patternsAdjusted: number;
  patternsUnadjusted: number;

  comparison: ConfidenceComparisonReport;
  categoryReports: CategoryReport[];
  topImprovements: PatternReport[];
  topDegradations: PatternReport[];
  patterns: PatternReport[];

  summary: {
    overallAvgChange: number;
    overallAvgChangePercent: number;
    highConfidenceGain: number;
    trends: string[];
  };
}

/**
 * Confidence Reporter
 */
export class ConfidenceReporter {
  /**
   * Generate comprehensive confidence report
   */
  generateReport(
    originalPatterns: IntentPattern[],
    adjustedPatterns: AdjustedPattern[],
    comparisonReport: ConfidenceComparisonReport,
    aggregatedStats: AggregatedStats
  ): ConfidenceReport {
    // Create pattern reports
    const patternReports = this.createPatternReports(adjustedPatterns, aggregatedStats);

    // Sort by confidence change
    const sorted = [...patternReports].sort((a, b) => b.confidenceChange - a.confidenceChange);
    const topImprovements = sorted.slice(0, 10);
    const topDegradations = sorted.reverse().slice(0, 10);

    // Create category reports
    const categoryReports = this.createCategoryReports(adjustedPatterns, aggregatedStats);

    // Calculate summary
    const summary = this.calculateSummary(adjustedPatterns, comparisonReport);

    return {
      reportDate: new Date().toISOString(),
      totalPatterns: originalPatterns.length,
      patternsAdjusted: patternReports.filter(p => p.confidenceChange !== 0).length,
      patternsUnadjusted: patternReports.filter(p => p.confidenceChange === 0).length,
      comparison: comparisonReport,
      categoryReports,
      topImprovements,
      topDegradations,
      patterns: patternReports,
      summary,
    };
  }

  /**
   * Create per-pattern reports
   */
  private createPatternReports(
    adjustedPatterns: AdjustedPattern[],
    aggregatedStats: AggregatedStats
  ): PatternReport[] {
    return adjustedPatterns.map(pattern => {
      const metrics = aggregatedStats.metrics.get(pattern.id);
      const changePercent = pattern.originalConfidence > 0
        ? ((pattern.adjustedConfidence - pattern.originalConfidence) / pattern.originalConfidence) * 100
        : 0;

      return {
        patternId: pattern.id,
        patternName: pattern.name,
        category: pattern.category,
        originalConfidence: pattern.originalConfidence,
        adjustedConfidence: pattern.adjustedConfidence,
        confidenceChange: pattern.confidenceChange,
        changePercent,

        feedbackMetrics: metrics ? {
          usageCount: metrics.usageCount,
          approvalRate: metrics.approvalRate,
          rejectionRate: metrics.rejectionRate,
          averageAccuracy: metrics.averageAccuracy,
        } : undefined,
      };
    });
  }

  /**
   * Create category-level reports
   */
  private createCategoryReports(
    adjustedPatterns: AdjustedPattern[],
    aggregatedStats: AggregatedStats
  ): CategoryReport[] {
    const categories = new Map<string, {
      before: number[];
      after: number[];
      improved: number;
      degraded: number;
      withFeedback: number;
    }>();

    // Group by category
    for (const pattern of adjustedPatterns) {
      if (!categories.has(pattern.category)) {
        categories.set(pattern.category, {
          before: [],
          after: [],
          improved: 0,
          degraded: 0,
          withFeedback: 0,
        });
      }

      const cat = categories.get(pattern.category)!;
      cat.before.push(pattern.originalConfidence);
      cat.after.push(pattern.adjustedConfidence);

      if (pattern.confidenceChange > 0) cat.improved++;
      if (pattern.confidenceChange < 0) cat.degraded++;

      if (pattern.adjustmentFactors.finalAdjustment !== 0) {
        cat.withFeedback++;
      }
    }

    // Create reports
    const reports: CategoryReport[] = [];

    for (const [categoryName, data] of categories) {
      const avgBefore = data.before.length > 0
        ? data.before.reduce((a, b) => a + b) / data.before.length
        : 0;
      const avgAfter = data.after.length > 0
        ? data.after.reduce((a, b) => a + b) / data.after.length
        : 0;

      reports.push({
        category: categoryName,
        patternCount: data.before.length,
        patternsWithFeedback: data.withFeedback,
        averageConfidenceBefore: avgBefore,
        averageConfidenceAfter: avgAfter,
        averageConfidenceChange: avgAfter - avgBefore,
        improvedPatterns: data.improved,
        degradedPatterns: data.degraded,
      });
    }

    // Sort by average change (descending)
    return reports.sort((a, b) => b.averageConfidenceChange - a.averageConfidenceChange);
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    adjustedPatterns: AdjustedPattern[],
    comparisonReport: ConfidenceComparisonReport
  ): {
    overallAvgChange: number;
    overallAvgChangePercent: number;
    highConfidenceGain: number;
    trends: string[];
  } {
    const avgChange = adjustedPatterns.length > 0
      ? adjustedPatterns.reduce((sum, p) => sum + p.confidenceChange, 0) / adjustedPatterns.length
      : 0;

    const avgChangePercent = adjustedPatterns.length > 0
      ? (avgChange / (adjustedPatterns.reduce((sum, p) => sum + p.originalConfidence, 0) / adjustedPatterns.length)) * 100
      : 0;

    const highConfidenceGain = comparisonReport.highConfidenceChange;

    // Identify trends
    const trends: string[] = [];

    if (avgChange > 0.01) {
      trends.push(`✅ Overall confidence improved by ${(avgChange * 100).toFixed(2)}%`);
    } else if (avgChange < -0.01) {
      trends.push(`⚠️ Overall confidence decreased by ${(Math.abs(avgChange) * 100).toFixed(2)}%`);
    } else {
      trends.push('📊 Overall confidence remained stable');
    }

    if (highConfidenceGain > 0) {
      trends.push(`✅ ${highConfidenceGain} more patterns reached high confidence (≥0.85)`);
    } else if (highConfidenceGain < 0) {
      trends.push(`⚠️ ${Math.abs(highConfidenceGain)} patterns dropped below high confidence`);
    }

    const improvedCount = adjustedPatterns.filter(p => p.confidenceChange > 0).length;
    const degradedCount = adjustedPatterns.filter(p => p.confidenceChange < 0).length;
    const unchangedCount = adjustedPatterns.filter(p => p.confidenceChange === 0).length;

    const improvedPercent = (improvedCount / adjustedPatterns.length) * 100;
    const degradedPercent = (degradedCount / adjustedPatterns.length) * 100;

    trends.push(`📈 ${improvedCount} patterns improved (${improvedPercent.toFixed(1)}%)`);
    trends.push(`📉 ${degradedCount} patterns declined (${degradedPercent.toFixed(1)}%)`);
    trends.push(`➡️ ${unchangedCount} patterns unchanged`);

    return {
      overallAvgChange: avgChange,
      overallAvgChangePercent: avgChangePercent,
      highConfidenceGain,
      trends,
    };
  }

  /**
   * Generate markdown report for display
   */
  generateMarkdownReport(report: ConfidenceReport): string {
    const lines: string[] = [];

    lines.push('# Phase 11: Dynamic Confidence System Report');
    lines.push('');
    lines.push(`**Report Generated**: ${report.reportDate}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total Patterns**: ${report.totalPatterns}`);
    lines.push(`- **Patterns Adjusted**: ${report.patternsAdjusted}`);
    lines.push(`- **Patterns Unadjusted**: ${report.patternsUnadjusted}`);
    lines.push('');

    // Key Metrics
    lines.push('## Key Metrics');
    lines.push('');
    lines.push(`- **Average Confidence Before**: ${(report.comparison.averageConfidenceBefore * 100).toFixed(2)}%`);
    lines.push(`- **Average Confidence After**: ${(report.comparison.averageConfidenceAfter * 100).toFixed(2)}%`);
    lines.push(`- **Overall Change**: ${(report.comparison.averageConfidenceChange * 100).toFixed(2)}% (${report.summary.overallAvgChangePercent.toFixed(2)}% relative)`);
    lines.push(`- **High Confidence Patterns**: ${report.comparison.highConfidenceBefore} → ${report.comparison.highConfidenceAfter}`);
    lines.push('');

    // Trends
    lines.push('## Trends');
    lines.push('');
    for (const trend of report.summary.trends) {
      lines.push(`- ${trend}`);
    }
    lines.push('');

    // Top Improvements
    lines.push('## Top 10 Improvements');
    lines.push('');
    for (let i = 0; i < Math.min(10, report.topImprovements.length); i++) {
      const p = report.topImprovements[i];
      lines.push(`${i + 1}. **${p.patternName}** (${p.category})`);
      lines.push(`   - ${(p.originalConfidence * 100).toFixed(2)}% → ${(p.adjustedConfidence * 100).toFixed(2)}% (+${(p.confidenceChange * 100).toFixed(2)}%)`);
    }
    lines.push('');

    // Category Summary
    lines.push('## Category Summary');
    lines.push('');
    for (const cat of report.categoryReports) {
      lines.push(`### ${cat.category.toUpperCase()}`);
      lines.push(`- Patterns: ${cat.patternCount} (${cat.patternsWithFeedback} with feedback)`);
      lines.push(`- Avg Confidence: ${(cat.averageConfidenceBefore * 100).toFixed(2)}% → ${(cat.averageConfidenceAfter * 100).toFixed(2)}%`);
      lines.push(`- Improved: ${cat.improvedPatterns}, Degraded: ${cat.degradedPatterns}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}

export default ConfidenceReporter;
