/**
 * Phase 6.2 Week 5: Integration
 *
 * 전체 자율학습 시스템 통합:
 * - 모든 Week 2-4 컴포넌트 연결
 * - 통합 파이프라인 구성
 * - 자동 학습 루프 실행
 * - E2E 검증
 */

import { SmartREPL, ExecutionResult } from './smart-repl';
import { IntentParser, RecognizedIntent } from './intent-parser';
import { PartialExecutor, PartialExecutionResult } from './partial-executor';
import { PerformanceAnalyzer } from './performance-analyzer';
import { LearningEngine, LearnedPattern } from './learning-engine';
import { ErrorAnalyzer, ErrorPattern } from './error-analyzer';
import { AutoImprover, ImprovementSuggestion } from './auto-improver';
import { Dashboard, DashboardMetrics } from './dashboard';

/**
 * 통합 파이프라인 결과
 */
export interface IntegrationResult {
  input: string;
  intentRecognition: RecognizedIntent;
  execution: ExecutionResult;
  partialExecution: PartialExecutionResult | null;
  patternLearned: LearnedPattern;
  errorAnalysis: ErrorPattern | null;
  suggestions: ImprovementSuggestion[];
  processingTime: number;
}

/**
 * 통합 통계
 */
export interface IntegrationStats {
  totalRuns: number;
  successRate: number;
  patternCount: number;
  errorCount: number;
  improvementGain: number;
  overallHealthScore: number;
  averageProcessingTime: number;
}

/**
 * Integration: 전체 자율학습 시스템
 */
export class Integration {
  private repl: SmartREPL;
  private intentParser: IntentParser;
  private partialExecutor: PartialExecutor;
  private performanceAnalyzer: PerformanceAnalyzer;
  private learningEngine: LearningEngine;
  private errorAnalyzer: ErrorAnalyzer;
  private autoImprover: AutoImprover;
  private dashboard: Dashboard;
  private results: IntegrationResult[] = [];
  private readonly maxResults = 10000;

  constructor() {
    this.repl = new SmartREPL();
    this.intentParser = new IntentParser();
    this.partialExecutor = new PartialExecutor(this.repl, this.intentParser);
    this.performanceAnalyzer = new PerformanceAnalyzer();
    this.learningEngine = new LearningEngine();
    this.errorAnalyzer = new ErrorAnalyzer();
    this.autoImprover = new AutoImprover(
      this.learningEngine,
      this.errorAnalyzer,
      this.performanceAnalyzer
    );
    this.dashboard = new Dashboard(
      this.learningEngine,
      this.errorAnalyzer,
      this.autoImprover,
      this.performanceAnalyzer
    );
    this.results = [];
  }

  /**
   * 통합 파이프라인 실행
   */
  execute(input: string): IntegrationResult {
    const startTime = performance.now();

    // Step 1: Intent Recognition (자연어 해석)
    const intentRecognition = this.intentParser.parse(input);

    // Step 2: Code Execution (즉시 실행)
    const code = intentRecognition.code;
    const execution = this.repl.execute(code);

    // Step 3: Partial Execution (부분 실행 시뮬레이션)
    let partialExecution: PartialExecutionResult | null = null;
    if (input.includes('???') || input.includes('...')) {
      partialExecution = this.partialExecutor.execute(input);
    }

    // Step 4: Performance Analysis (성능 분석)
    this.performanceAnalyzer.recordMetric(execution, code);

    // Step 5: Pattern Learning (패턴 학습)
    const patternLearned = this.learningEngine.learn(code, execution);

    // Step 6: Error Analysis (오류 분석)
    const errorAnalysis = this.errorAnalyzer.analyzeError(code, execution);

    // Step 7: Auto Improvement (자동 개선)
    const suggestions = this.autoImprover.suggest(code);

    const processingTime = performance.now() - startTime;

    const result: IntegrationResult = {
      input,
      intentRecognition,
      execution,
      partialExecution,
      patternLearned,
      errorAnalysis,
      suggestions,
      processingTime,
    };

    this.results.push(result);

    if (this.results.length > this.maxResults) {
      this.results.shift();
    }

    return result;
  }

  /**
   * 통합 통계 계산
   */
  getStats(): IntegrationStats {
    if (this.results.length === 0) {
      return {
        totalRuns: 0,
        successRate: 0,
        patternCount: 0,
        errorCount: 0,
        improvementGain: 0,
        overallHealthScore: 0,
        averageProcessingTime: 0,
      };
    }

    const successCount = this.results.filter(
      (r) => r.execution.success
    ).length;
    const successRate = (successCount / this.results.length) * 100;

    const learningStats = this.learningEngine.getStats();
    const errorStats = this.errorAnalyzer.getStats();
    const improvementGain = this.autoImprover.getCumulativeGain();

    const avgProcessingTime =
      this.results.reduce((sum, r) => sum + r.processingTime, 0) /
      this.results.length;

    // Dashboard에서 건강도 점수 계산
    const performanceAnalysis = this.performanceAnalyzer.analyze();
    const healthScore = this.dashboard.calculateHealthScore(
      learningStats,
      errorStats,
      performanceAnalysis,
      improvementGain
    );

    return {
      totalRuns: this.results.length,
      successRate,
      patternCount: learningStats.totalPatterns,
      errorCount: errorStats.totalErrors,
      improvementGain,
      overallHealthScore: healthScore,
      averageProcessingTime: avgProcessingTime,
    };
  }

  /**
   * 전체 시스템 상태 조회
   */
  getSystemStatus(): object {
    const stats = this.getStats();
    const latestMetrics = this.dashboard.getLatestMetrics();

    return {
      stats,
      latestMetrics,
      componentStatus: {
        repl: 'active',
        intentParser: 'active',
        partialExecutor: 'active',
        performanceAnalyzer: 'tracking',
        learningEngine: 'learning',
        errorAnalyzer: 'analyzing',
        autoImprover: 'suggesting',
        dashboard: 'monitoring',
      },
    };
  }

  /**
   * 결과 히스토리 조회
   */
  getHistory(limit: number = 100): IntegrationResult[] {
    return this.results.slice(-limit);
  }

  /**
   * 대시보드 메트릭 수집
   */
  collectDashboardMetrics(): DashboardMetrics {
    return this.dashboard.collectMetrics();
  }

  /**
   * 대시보드 리포트 생성
   */
  generateDashboardReport(): string {
    return this.dashboard.generateReport();
  }

  /**
   * 성능 리포트 생성
   */
  generatePerformanceReport(): string {
    const stats = this.getStats();

    return `
╔════════════════════════════════════════════════════════════╗
║        Integrated System Performance Report                ║
╚════════════════════════════════════════════════════════════╝

📊 Overall Statistics
  Total Executions: ${stats.totalRuns}
  Success Rate: ${stats.successRate.toFixed(1)}%
  Average Processing Time: ${stats.averageProcessingTime.toFixed(3)}ms

🧠 Learning Progress
  Patterns Learned: ${stats.patternCount}
  Cumulative Improvement: ${(stats.improvementGain * 100).toFixed(1)}%

🛡️  Reliability
  Errors Detected: ${stats.errorCount}
  Overall Health Score: ${stats.overallHealthScore.toFixed(1)}/100

🚀 System Performance
  ${stats.averageProcessingTime < 100 ? '✅ Excellent' : stats.averageProcessingTime < 500 ? '⚠️ Good' : '❌ Needs Optimization'} processing speed

📈 Trend
  ${stats.successRate > 80 ? '📈 Improving' : stats.successRate > 50 ? '➡️ Stable' : '📉 Declining'}
    `.trim();
  }

  /**
   * E2E 테스트 실행
   */
  async runE2ETest(testCases: Array<{ input: string; expectedType?: string }>): Promise<
    Array<{
      input: string;
      passed: boolean;
      error?: string;
    }>
  > {
    const results: Array<{
      input: string;
      passed: boolean;
      error?: string;
    }> = [];

    for (const testCase of testCases) {
      try {
        const result = this.execute(testCase.input);

        const passed = result.execution.success;

        results.push({
          input: testCase.input,
          passed,
          error: passed ? undefined : result.execution.error,
        });
      } catch (error) {
        results.push({
          input: testCase.input,
          passed: false,
          error: String(error),
        });
      }
    }

    return results;
  }

  /**
   * 초기화
   */
  reset(): void {
    this.results = [];
    this.learningEngine.reset();
    this.errorAnalyzer.reset();
    this.autoImprover.reset();
    this.performanceAnalyzer.reset();
    this.dashboard.reset();
  }

  /**
   * 컴포넌트 접근 (테스트 및 고급 사용)
   */
  getComponents(): object {
    return {
      repl: this.repl,
      intentParser: this.intentParser,
      partialExecutor: this.partialExecutor,
      performanceAnalyzer: this.performanceAnalyzer,
      learningEngine: this.learningEngine,
      errorAnalyzer: this.errorAnalyzer,
      autoImprover: this.autoImprover,
      dashboard: this.dashboard,
    };
  }

  /**
   * 자동 학습 루프 시뮬레이션
   */
  simulateAutonomousLearning(iterations: number = 10): {
    iterations: number;
    finalStats: IntegrationStats;
    improvements: number;
  } {
    const testPatterns = [
      'sum([1, 2, 3])',
      'len([4, 5, 6])',
      '[1, 2, 3, 4, 5]',
      'sum([10, 20, 30])',
      'len([7, 8, 9])',
    ];

    let improvements = 0;
    const initialGain = this.autoImprover.getCumulativeGain();

    for (let i = 0; i < iterations; i++) {
      const pattern = testPatterns[i % testPatterns.length];
      this.execute(pattern);
    }

    const finalGain = this.autoImprover.getCumulativeGain();
    improvements = finalGain - initialGain;

    return {
      iterations,
      finalStats: this.getStats(),
      improvements,
    };
  }
}

/**
 * 글로벌 인스턴스
 */
export const globalIntegration = new Integration();
