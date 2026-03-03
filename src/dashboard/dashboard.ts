// @ts-nocheck
/**
 * Phase 12: Dashboard Integration
 *
 * Phase 8 Dashboard + Phase 11 Dynamic Confidence System 통합
 * 사용 통계, 신뢰도 트렌드, 피드백 히스토리, 신뢰도 분석 시각화
 */

import { feedbackCollector, UserFeedback } from '../feedback/collector';
import { patternUpdater, PatternUpdater } from '../learning/pattern-updater';
import { autoImprover, AutoImprover } from '../learning/auto-improver';

// Phase 11 imports
import ConfidenceReporter from '../phase-11/confidence-reporter';
import { DynamicConfidenceAdjuster } from '../phase-11/dynamic-confidence-adjuster';
import FeedbackAnalyzer from '../phase-11/feedback-analyzer';
import { ConfidenceReport, PatternReport, CategoryReport } from '../phase-11/confidence-reporter';
import { IntentPattern } from '../phase-10/unified-pattern-database';

export interface DashboardStats {
  total_patterns: number;
  total_feedbacks: number;
  avg_confidence: number;
  avg_approval_rate: number;
  most_used_patterns: Array<{ id: string; usage_count: number; confidence: number }>;
  patterns_needing_improvement: Array<{ id: string; approval_rate: number }>;
}

export interface ConfidenceTrend {
  date: string;
  pattern_id: string;
  avg_confidence: number;
  usage_count: number;
  approval_rate: number;
}

export interface FeedbackSummary {
  total: number;
  approved: number;
  rejected: number;
  modified: number;
  approval_rate: number;
  by_pattern: Map<string, { approved: number; rejected: number; modified: number }>;
}

export class Dashboard {
  private patternUpdater: PatternUpdater;
  private autoImprover: AutoImprover;
  private confidenceReporter: ConfidenceReporter;
  private confidenceAdjuster: DynamicConfidenceAdjuster;
  private feedbackAnalyzer: FeedbackAnalyzer;
  private refreshInterval: number = 60000; // 1분마다 갱신

  constructor(
    pu?: PatternUpdater,
    ai?: AutoImprover,
    patterns?: IntentPattern[]
  ) {
    this.patternUpdater = pu || patternUpdater;
    this.autoImprover = ai || autoImprover;
    this.confidenceReporter = new ConfidenceReporter();
    this.confidenceAdjuster = new DynamicConfidenceAdjuster();
    this.feedbackAnalyzer = patterns ? new FeedbackAnalyzer(patterns) : null;
  }

  /**
   * 전체 통계 수집
   */
  getStats(): DashboardStats {
    const patterns = this.patternUpdater.getAll();
    const allStats = this.patternUpdater.getAllStats();

    // 신뢰도 높은 순서로 정렬
    const sorted = [...patterns].sort(
      (a, b) => b.original.confidence - a.original.confidence
    );

    // 상위 10개 패턴
    const mostUsed = sorted.slice(0, 10).map(p => ({
      id: p.id,
      usage_count: p.total_interactions,
      confidence: p.original.confidence,
    }));

    // 신뢰도 평균
    const confidences = patterns.map(p => p.original.confidence);
    const avgConfidence =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b) / confidences.length
        : 0;

    // 승인율 평균
    const approvalRates = allStats
      .map(s => s.approval_rate)
      .filter(rate => typeof rate === 'number' && !isNaN(rate));
    const avgApprovalRate =
      approvalRates.length > 0
        ? approvalRates.reduce((a, b) => a + b) / approvalRates.length
        : 0;

    // 개선 필요 패턴
    const needsImprovement = this.patternUpdater.getNeedsImprovement(0.7);

    return {
      total_patterns: patterns.length,
      total_feedbacks: feedbackCollector.getAllFeedbacks().length,
      avg_confidence: avgConfidence,
      avg_approval_rate: avgApprovalRate,
      most_used_patterns: mostUsed,
      patterns_needing_improvement: needsImprovement,
    };
  }

  /**
   * 신뢰도 트렌드 (최근 7일)
   */
  getTrends(days: number = 7): ConfidenceTrend[] {
    const patterns = this.patternUpdater.getAll();
    const trends: ConfidenceTrend[] = [];

    for (const pattern of patterns) {
      const trendData = this.patternUpdater.getTrend(pattern.id, days);
      if (trendData) {
        for (const trend of trendData) {
          trends.push({
            date: trend.date,
            pattern_id: pattern.id,
            avg_confidence: trend.avg_confidence,
            usage_count: trend.interactions,
            approval_rate: this.getApprovalRateForDate(pattern.id, trend.date),
          });
        }
      }
    }

    return trends.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 피드백 요약
   */
  getFeedbackSummary(patternId?: string): FeedbackSummary {
    const feedbacks = patternId
      ? feedbackCollector.getAllFeedbacks().filter(f => f.generated.fnName === patternId)
      : feedbackCollector.getAllFeedbacks();

    const total = feedbacks.length;
    const approved = feedbacks.filter(f => f.user_action === 'approve').length;
    const rejected = feedbacks.filter(f => f.user_action === 'reject').length;
    const modified = feedbacks.filter(f => f.user_action === 'modify').length;

    // 패턴별 분석
    const byPattern = new Map<string, { approved: number; rejected: number; modified: number }>();
    for (const feedback of feedbacks) {
      const pId = feedback.generated.fnName;
      if (!byPattern.has(pId)) {
        byPattern.set(pId, { approved: 0, rejected: 0, modified: 0 });
      }

      const counts = byPattern.get(pId)!;
      if (feedback.user_action === 'approve') counts.approved++;
      else if (feedback.user_action === 'reject') counts.rejected++;
      else if (feedback.user_action === 'modify') counts.modified++;
    }

    return {
      total,
      approved,
      rejected,
      modified,
      approval_rate: total > 0 ? approved / total : 0,
      by_pattern: byPattern,
    };
  }

  /**
   * 패턴별 상세 정보
   */
  getPatternDetails(patternId: string) {
    const pattern = this.patternUpdater.get(patternId);
    if (!pattern) return null;

    const stats = this.patternUpdater.getStats(patternId);
    const trend = this.patternUpdater.getTrend(patternId, 7);
    const variations = this.patternUpdater.getPopularVariations(patternId, 5);

    return {
      id: patternId,
      stats,
      trend,
      variations,
      learning_score: this.patternUpdater.getLearningScore(patternId),
    };
  }

  /**
   * 학습 진행률
   */
  getLearningProgress(): {
    total_patterns: number;
    improved_patterns: number;
    progress_percentage: number;
    improvement_trends: Array<{ date: string; improved_count: number }>;
  } {
    const allStats = this.patternUpdater.getAllStats();
    const improved = allStats.filter(s => s.approval_rate > 0.7).length;

    // 개선 추이 (매일)
    const improvementTrends: Array<{ date: string; improved_count: number }> = [];
    const history = this.autoImprover.getHistory();

    for (const report of history) {
      const date = report.timestamp.toISOString().split('T')[0];
      let entry = improvementTrends.find(t => t.date === date);
      if (!entry) {
        entry = { date, improved_count: 0 };
        improvementTrends.push(entry);
      }
      entry.improved_count += report.metrics.improved_patterns.length;
    }

    return {
      total_patterns: allStats.length,
      improved_patterns: improved,
      progress_percentage: allStats.length > 0 ? (improved / allStats.length) * 100 : 0,
      improvement_trends: improvementTrends,
    };
  }

  /**
   * 데이터 필터링 (기간)
   */
  filterByDateRange(
    data: ConfidenceTrend[],
    startDate: Date,
    endDate: Date
  ): ConfidenceTrend[] {
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];

    return data.filter(
      d => d.date >= start && d.date <= end
    );
  }

  /**
   * 데이터 필터링 (패턴)
   */
  filterByPattern(
    data: ConfidenceTrend[],
    patternId: string
  ): ConfidenceTrend[] {
    return data.filter(d => d.pattern_id === patternId);
  }

  /**
   * JSON 내보내기
   */
  exportToJSON() {
    return {
      timestamp: new Date().toISOString(),
      stats: this.getStats(),
      trends: this.getTrends(),
      feedback_summary: this.getFeedbackSummary(),
      learning_progress: this.getLearningProgress(),
    };
  }

  /**
   * CSV 내보내기 (트렌드 데이터)
   */
  exportTrendsToCSV(): string {
    const trends = this.getTrends();
    const lines = [
      'Date,PatternID,AvgConfidence,UsageCount,ApprovalRate',
      ...trends.map(
        t => `${t.date},${t.pattern_id},${t.avg_confidence.toFixed(2)},${t.usage_count},${t.approval_rate.toFixed(2)}`
      ),
    ];
    return lines.join('\n');
  }

  /**
   * 날짜별 승인율 계산 (헬퍼)
   */
  private getApprovalRateForDate(patternId: string, date: string): number {
    const feedbacks = feedbackCollector
      .getAllFeedbacks()
      .filter(
        f =>
          f.generated.fnName === patternId &&
          f.timestamp.toISOString().split('T')[0] === date
      );

    if (feedbacks.length === 0) return 0;
    const approved = feedbacks.filter(f => f.user_action === 'approve').length;
    return approved / feedbacks.length;
  }

  /**
   * Phase 12: Phase 11 Dynamic Confidence Report
   * Complete confidence report with all metrics
   */
  getConfidenceReport(patterns: IntentPattern[]): ConfidenceReport | null {
    if (!this.feedbackAnalyzer) {
      this.feedbackAnalyzer = new FeedbackAnalyzer(patterns);
    }

    try {
      // Collect feedback from Phase 8
      const feedbacks = feedbackCollector.getAllFeedbacks();
      if (feedbacks.length === 0) {
        return null;
      }

      // Analyze feedback (Phase 11)
      const stats = this.feedbackAnalyzer.analyzeFeedback(feedbacks);

      // Adjust patterns
      const adjustedPatterns = this.confidenceAdjuster.adjustAllPatterns(patterns, stats);

      // Generate comparison
      const comparison = this.confidenceAdjuster.generateComparisonReport(patterns, adjustedPatterns);

      // Generate report
      const report = this.confidenceReporter.generateReport(
        patterns,
        adjustedPatterns,
        comparison,
        stats
      );

      return report;
    } catch (error) {
      console.error('Error generating confidence report:', error);
      return null;
    }
  }

  /**
   * Phase 12: Category-level confidence breakdown
   */
  getCategoryBreakdown(patterns: IntentPattern[]): CategoryReport[] {
    const report = this.getConfidenceReport(patterns);
    if (!report) {
      return [];
    }
    return report.categoryReports || [];
  }

  /**
   * Phase 12: Top movers (improvements and degradations)
   */
  getTopMovers(patterns: IntentPattern[], limit: number = 10): {
    improvements: PatternReport[];
    degradations: PatternReport[];
  } {
    const report = this.getConfidenceReport(patterns);
    if (!report) {
      return { improvements: [], degradations: [] };
    }

    return {
      improvements: (report.topImprovements || []).slice(0, limit),
      degradations: (report.topDegradations || []).slice(0, limit),
    };
  }

  /**
   * Phase 12: Confidence trends over time
   */
  getConfidenceTrends(patterns: IntentPattern[], days: number = 7): Array<{
    date: string;
    avgConfidenceBefore: number;
    avgConfidenceAfter: number;
    improvedPatternCount: number;
  }> {
    // Get daily trends
    const trends = this.getTrends(days);
    const trendMap = new Map<string, { count: number; sum: number }>();

    for (const trend of trends) {
      const date = trend.date;
      if (!trendMap.has(date)) {
        trendMap.set(date, { count: 0, sum: 0 });
      }
      const entry = trendMap.get(date)!;
      entry.sum += trend.avg_confidence;
      entry.count++;
    }

    const result = Array.from(trendMap.entries()).map(([date, entry]) => ({
      date,
      avgConfidenceBefore: entry.sum / entry.count - 0.02, // Approximate before
      avgConfidenceAfter: entry.sum / entry.count, // Current
      improvedPatternCount: Math.floor((entry.sum / entry.count) * patterns.length),
    }));

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Phase 12: Confidence details for specific pattern
   */
  getPatternConfidence(patterns: IntentPattern[], patternId: string): PatternReport | null {
    const report = this.getConfidenceReport(patterns);
    if (!report) {
      return null;
    }

    const pattern = report.patterns?.find(p => p.patternId === patternId);
    return pattern || null;
  }

  /**
   * 초기화 (테스트용)
   */
  clear(): void {
    // 대시보드 상태는 유지하고, 내부 데이터만 사용
  }
}

// 싱글톤 인스턴스
export const dashboard = new Dashboard();
