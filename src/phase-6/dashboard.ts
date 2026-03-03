/**
 * Phase 6.2 Week 5: Dashboard
 *
 * 학습 진행도 시각화:
 * - 패턴 학습 통계
 * - 오류 분석 통계
 * - 개선 추세 시각화
 * - 실시간 메트릭
 */

import { LearningEngine, LearningStats } from './learning-engine';
import { ErrorAnalyzer, ErrorStats } from './error-analyzer';
import { AutoImprover } from './auto-improver';
import { PerformanceAnalyzer, PerformanceAnalysis } from './performance-analyzer';

/**
 * 대시보드 메트릭
 */
export interface DashboardMetrics {
  timestamp: number;
  learningStats: LearningStats;
  errorStats: ErrorStats;
  performanceAnalysis: PerformanceAnalysis;
  improvementGain: number;
  overallHealthScore: number;  // 0-100
}

/**
 * 건강도 점수
 */
export interface HealthScore {
  learning: number;    // 0-100: 패턴 학습 건강도
  reliability: number; // 0-100: 신뢰도 / 안정성
  performance: number; // 0-100: 성능 건강도
  overall: number;     // 0-100: 종합 점수
}

/**
 * 추세 데이터
 */
export interface TrendData {
  timestamp: number[];
  successRate: number[];
  averageTime: number[];
  patternCount: number[];
  errorCount: number[];
  improvementGain: number[];
}

/**
 * Dashboard: 학습 진행도 시각화
 */
export class Dashboard {
  private learningEngine: LearningEngine;
  private errorAnalyzer: ErrorAnalyzer;
  private autoImprover: AutoImprover;
  private performanceAnalyzer: PerformanceAnalyzer;
  private metrics: DashboardMetrics[] = [];
  private readonly maxMetrics = 1000;

  constructor(
    learningEngine: LearningEngine,
    errorAnalyzer: ErrorAnalyzer,
    autoImprover: AutoImprover,
    performanceAnalyzer: PerformanceAnalyzer
  ) {
    this.learningEngine = learningEngine;
    this.errorAnalyzer = errorAnalyzer;
    this.autoImprover = autoImprover;
    this.performanceAnalyzer = performanceAnalyzer;
    this.metrics = [];
  }

  /**
   * 메트릭 수집
   */
  collectMetrics(): DashboardMetrics {
    const learningStats = this.learningEngine.getStats();
    const errorStats = this.errorAnalyzer.getStats();
    const performanceAnalysis = this.performanceAnalyzer.analyze();
    const improvementGain = this.autoImprover.getCumulativeGain();

    const metric: DashboardMetrics = {
      timestamp: Date.now(),
      learningStats,
      errorStats,
      performanceAnalysis,
      improvementGain,
      overallHealthScore: this.calculateHealthScore(
        learningStats,
        errorStats,
        performanceAnalysis,
        improvementGain
      ),
    };

    this.metrics.push(metric);

    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    return metric;
  }

  /**
   * 건강도 점수 계산
   */
  calculateHealthScore(
    learningStats: LearningStats,
    errorStats: ErrorStats,
    performanceAnalysis: PerformanceAnalysis,
    improvementGain: number
  ): number {
    const score: HealthScore = this.calculateDetailedHealthScore(
      learningStats,
      errorStats,
      performanceAnalysis,
      improvementGain
    );

    return score.overall;
  }

  /**
   * 상세 건강도 점수
   */
  calculateDetailedHealthScore(
    learningStats: LearningStats,
    errorStats: ErrorStats,
    performanceAnalysis: PerformanceAnalysis,
    improvementGain: number
  ): HealthScore {
    // 학습 건강도 (패턴 수, 성공률, 학습 추세)
    const learningScore = Math.min(
      100,
      (learningStats.totalPatterns / 10) * 10 +
        (learningStats.averageSuccessRate * 50) +
        Math.max(0, learningStats.learningTrend * 20)
    );

    // 신뢰도 점수 (성공률, 오류 감소율)
    const reliabilityScore = Math.min(
      100,
      (errorStats.successRate / 100) * 70 +
        (1 + errorStats.errorTrend) * 30
    );

    // 성능 점수 (실행 시간, 메모리, 병목)
    const performanceScore = Math.min(
      100,
      100 - Math.min(50, performanceAnalysis.bottlenecks.length * 15) -
        Math.max(0, (performanceAnalysis.trends.timeGrowth / 100) * 30)
    );

    // 종합 점수
    const overall =
      (learningScore * 0.3 +
        reliabilityScore * 0.4 +
        performanceScore * 0.2 +
        improvementGain * 100 * 0.1) /
      1.0;

    return {
      learning: Math.max(0, learningScore),
      reliability: Math.max(0, reliabilityScore),
      performance: Math.max(0, performanceScore),
      overall: Math.max(0, Math.min(100, overall)),
    };
  }

  /**
   * 추세 데이터 추출
   */
  extractTrends(limit: number = 100): TrendData {
    const recentMetrics = this.metrics.slice(-limit);

    const trends: TrendData = {
      timestamp: [],
      successRate: [],
      averageTime: [],
      patternCount: [],
      errorCount: [],
      improvementGain: [],
    };

    for (const metric of recentMetrics) {
      trends.timestamp.push(metric.timestamp);
      trends.successRate.push(metric.errorStats.successRate);
      trends.averageTime.push(metric.performanceAnalysis.averageTime);
      trends.patternCount.push(metric.learningStats.totalPatterns);
      trends.errorCount.push(metric.errorStats.totalErrors);
      trends.improvementGain.push(metric.improvementGain);
    }

    return trends;
  }

  /**
   * 최신 메트릭 조회
   */
  getLatestMetrics(): DashboardMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * 메트릭 히스토리 조회
   */
  getMetricsHistory(limit: number = 100): DashboardMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * 리포트 생성 (텍스트)
   */
  generateReport(): string {
    const latest = this.getLatestMetrics();

    if (!latest) {
      return '메트릭이 없습니다.';
    }

    const healthScore = this.calculateDetailedHealthScore(
      latest.learningStats,
      latest.errorStats,
      latest.performanceAnalysis,
      latest.improvementGain
    );

    return `
╔════════════════════════════════════════════════════════════╗
║          AI Learning Dashboard Report                      ║
╚════════════════════════════════════════════════════════════╝

📊 Overall Health Score
  ├─ Learning: ${healthScore.learning.toFixed(1)}/100
  ├─ Reliability: ${healthScore.reliability.toFixed(1)}/100
  ├─ Performance: ${healthScore.performance.toFixed(1)}/100
  └─ Overall: ${healthScore.overall.toFixed(1)}/100

🧠 Learning Statistics
  Patterns Learned: ${latest.learningStats.totalPatterns}
  Total Executions: ${latest.learningStats.totalExecutions}
  Avg Success Rate: ${(latest.learningStats.averageSuccessRate * 100).toFixed(1)}%
  Learning Trend: ${(latest.learningStats.learningTrend * 100).toFixed(1)}%

🛡️  Reliability Analysis
  Success Rate: ${latest.errorStats.successRate.toFixed(1)}%
  Total Errors: ${latest.errorStats.totalErrors}
  Error Reduction: ${(latest.errorStats.errorTrend * 100).toFixed(1)}%

⚡ Performance Metrics
  Avg Execution Time: ${latest.performanceAnalysis.averageTime.toFixed(3)}ms
  Max Memory: ${latest.performanceAnalysis.maxMemory}B
  Bottlenecks Detected: ${latest.performanceAnalysis.bottlenecks.length}

🎯 Improvement Tracking
  Cumulative Gain: ${(latest.improvementGain * 100).toFixed(1)}%
  Suggestions Applied: (tracked by AutoImprover)

📈 Top Patterns (by Confidence)
${latest.learningStats.topPatterns
  .slice(0, 3)
  .map(
    (p) =>
      `  ${p.id}: ${(p.confidence * 100).toFixed(1)}% confidence, ${(p.successRate * 100).toFixed(1)}% success`
  )
  .join('\n')}

⏱️  Status
  Last Updated: ${new Date(latest.timestamp).toLocaleString()}
    `.trim();
  }

  /**
   * JSON 리포트 생성
   */
  generateJsonReport(): object {
    const latest = this.getLatestMetrics();

    if (!latest) {
      return { error: 'No metrics available' };
    }

    const healthScore = this.calculateDetailedHealthScore(
      latest.learningStats,
      latest.errorStats,
      latest.performanceAnalysis,
      latest.improvementGain
    );

    return {
      timestamp: latest.timestamp,
      healthScore,
      learning: latest.learningStats,
      reliability: latest.errorStats,
      performance: latest.performanceAnalysis,
      improvement: {
        cumulativeGain: latest.improvementGain,
      },
    };
  }

  /**
   * HTML 대시보드 생성
   */
  generateHtmlDashboard(): string {
    const latest = this.getLatestMetrics();
    const trends = this.extractTrends(50);

    if (!latest) {
      return '<h1>No metrics available</h1>';
    }

    const healthScore = this.calculateDetailedHealthScore(
      latest.learningStats,
      latest.errorStats,
      latest.performanceAnalysis,
      latest.improvementGain
    );

    return `
<!DOCTYPE html>
<html>
<head>
  <title>AI Learning Dashboard</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .card { border: 1px solid #ddd; padding: 20px; margin: 10px 0; border-radius: 5px; }
    .metric { display: inline-block; margin: 10px 20px; }
    .score { font-size: 32px; font-weight: bold; }
    .trend-up { color: green; }
    .trend-down { color: red; }
    h2 { border-bottom: 2px solid #333; padding-bottom: 10px; }
  </style>
</head>
<body>
  <h1>🤖 AI Learning Dashboard</h1>

  <div class="card">
    <h2>📊 Health Score</h2>
    <div class="metric">
      <div>Learning</div>
      <div class="score">${healthScore.learning.toFixed(1)}</div>
    </div>
    <div class="metric">
      <div>Reliability</div>
      <div class="score">${healthScore.reliability.toFixed(1)}</div>
    </div>
    <div class="metric">
      <div>Performance</div>
      <div class="score">${healthScore.performance.toFixed(1)}</div>
    </div>
    <div class="metric">
      <div>Overall</div>
      <div class="score" style="color: ${healthScore.overall > 80 ? 'green' : healthScore.overall > 50 ? 'orange' : 'red'}">
        ${healthScore.overall.toFixed(1)}
      </div>
    </div>
  </div>

  <div class="card">
    <h2>🧠 Learning Statistics</h2>
    <p>Patterns Learned: <strong>${latest.learningStats.totalPatterns}</strong></p>
    <p>Total Executions: <strong>${latest.learningStats.totalExecutions}</strong></p>
    <p>Avg Success Rate: <strong>${(latest.learningStats.averageSuccessRate * 100).toFixed(1)}%</strong></p>
    <p class="${latest.learningStats.learningTrend > 0 ? 'trend-up' : 'trend-down'}">
      Learning Trend: ${(latest.learningStats.learningTrend * 100).toFixed(1)}%
    </p>
  </div>

  <div class="card">
    <h2>🛡️  Reliability</h2>
    <p>Success Rate: <strong>${latest.errorStats.successRate.toFixed(1)}%</strong></p>
    <p>Total Errors: <strong>${latest.errorStats.totalErrors}</strong></p>
    <p class="${latest.errorStats.errorTrend > 0 ? 'trend-up' : 'trend-down'}">
      Error Reduction: ${(latest.errorStats.errorTrend * 100).toFixed(1)}%
    </p>
  </div>

  <div class="card">
    <h2>⚡ Performance</h2>
    <p>Avg Execution Time: <strong>${latest.performanceAnalysis.averageTime.toFixed(3)}ms</strong></p>
    <p>Max Memory: <strong>${latest.performanceAnalysis.maxMemory}B</strong></p>
    <p>Bottlenecks: <strong>${latest.performanceAnalysis.bottlenecks.length}</strong></p>
  </div>

  <p style="color: #666; font-size: 12px;">
    Last Updated: ${new Date(latest.timestamp).toLocaleString()}
  </p>
</body>
</html>
    `.trim();
  }

  /**
   * 초기화
   */
  reset(): void {
    this.metrics = [];
  }

  /**
   * 메트릭 개수 조회
   */
  getMetricCount(): number {
    return this.metrics.length;
  }
}

/**
 * 글로벌 인스턴스 (Integration과 함께 생성)
 */
export let globalDashboard: Dashboard;

export function initializeDashboard(
  learningEngine: LearningEngine,
  errorAnalyzer: ErrorAnalyzer,
  autoImprover: AutoImprover,
  performanceAnalyzer: PerformanceAnalyzer
): Dashboard {
  globalDashboard = new Dashboard(
    learningEngine,
    errorAnalyzer,
    autoImprover,
    performanceAnalyzer
  );
  return globalDashboard;
}
