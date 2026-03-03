/**
 * Phase 6.2 Week 3: PerformanceAnalyzer
 *
 * 실행 성능 분석:
 * - 실행 시간 추적
 * - 메모리 사용 분석
 * - 병목 지점 감지
 * - 최적화 제안
 */

import { ExecutionResult } from './smart-repl';

/**
 * 성능 메트릭
 */
export interface PerformanceMetric {
  timestamp: number;
  code: string;
  executionTime: number;
  memory: number;
  type: string;
  success: boolean;
}

/**
 * 병목 지점
 */
export interface Bottleneck {
  type: 'time' | 'memory' | 'both';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestion: string;
}

/**
 * 성능 분석 결과
 */
export interface PerformanceAnalysis {
  totalExecutions: number;
  averageTime: number;
  maxTime: number;
  minTime: number;
  averageMemory: number;
  maxMemory: number;
  successRate: number;
  bottlenecks: Bottleneck[];
  trends: {
    timeGrowth: number;  // ms per execution
    memoryGrowth: number;  // bytes per execution
  };
  recommendations: string[];
}

/**
 * PerformanceAnalyzer: 실행 성능 분석
 */
export class PerformanceAnalyzer {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 1000;  // 최근 1000개만 저장

  constructor() {
    this.metrics = [];
  }

  /**
   * 메트릭 기록
   */
  recordMetric(result: ExecutionResult, code: string): void {
    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      code,
      executionTime: result.executionTime,
      memory: result.memory,
      type: result.type,
      success: result.success,
    };

    this.metrics.push(metric);

    // 최대 개수 초과 시 오래된 데이터 제거
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * 성능 분석
   */
  analyze(): PerformanceAnalysis {
    if (this.metrics.length === 0) {
      return this.createEmptyAnalysis();
    }

    // 기본 통계
    const times = this.metrics.map((m) => m.executionTime);
    const memories = this.metrics.map((m) => m.memory);
    const successes = this.metrics.filter((m) => m.success).length;

    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    const averageMemory = memories.reduce((a, b) => a + b, 0) / memories.length;
    const maxMemory = Math.max(...memories);
    const successRate = (successes / this.metrics.length) * 100;

    // 병목 지점 감지
    const bottlenecks = this.detectBottlenecks(
      times,
      memories,
      averageTime,
      averageMemory
    );

    // 추세 분석
    const trends = this.analyzeTrends();

    // 최적화 제안
    const recommendations = this.generateRecommendations(
      averageTime,
      averageMemory,
      successRate,
      bottlenecks
    );

    return {
      totalExecutions: this.metrics.length,
      averageTime,
      maxTime,
      minTime,
      averageMemory,
      maxMemory,
      successRate,
      bottlenecks,
      trends,
      recommendations,
    };
  }

  /**
   * 병목 지점 감지
   */
  private detectBottlenecks(
    times: number[],
    memories: number[],
    avgTime: number,
    avgMemory: number
  ): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // 시간 병목
    const maxTime = Math.max(...times);
    if (maxTime > avgTime * 3) {
      bottlenecks.push({
        type: 'time',
        severity: 'high',
        description: `Execution time spike: ${maxTime.toFixed(2)}ms (${(maxTime / avgTime).toFixed(1)}x average)`,
        suggestion: 'Consider optimizing recursive calls or large array operations',
      });
    }

    // 메모리 병목
    const maxMemory = Math.max(...memories);
    if (maxMemory > avgMemory * 3) {
      bottlenecks.push({
        type: 'memory',
        severity: 'high',
        description: `Memory spike: ${maxMemory}B (${(maxMemory / avgMemory).toFixed(1)}x average)`,
        suggestion: 'Reduce array allocations or optimize data structures',
      });
    }

    // 일관성 문제
    const timeVariance = this.calculateVariance(times);
    if (timeVariance > avgTime) {
      bottlenecks.push({
        type: 'time',
        severity: 'medium',
        description: `High variance in execution time (std dev: ${Math.sqrt(timeVariance).toFixed(2)}ms)`,
        suggestion: 'Performance is inconsistent; check for garbage collection or system load effects',
      });
    }

    return bottlenecks;
  }

  /**
   * 추세 분석
   */
  private analyzeTrends(): { timeGrowth: number; memoryGrowth: number } {
    if (this.metrics.length < 2) {
      return { timeGrowth: 0, memoryGrowth: 0 };
    }

    const firstHalf = this.metrics.slice(0, Math.floor(this.metrics.length / 2));
    const secondHalf = this.metrics.slice(Math.floor(this.metrics.length / 2));

    const firstAvgTime =
      firstHalf.reduce((a, m) => a + m.executionTime, 0) / firstHalf.length;
    const secondAvgTime =
      secondHalf.reduce((a, m) => a + m.executionTime, 0) / secondHalf.length;

    const firstAvgMemory =
      firstHalf.reduce((a, m) => a + m.memory, 0) / firstHalf.length;
    const secondAvgMemory =
      secondHalf.reduce((a, m) => a + m.memory, 0) / secondHalf.length;

    return {
      timeGrowth: secondAvgTime - firstAvgTime,
      memoryGrowth: secondAvgMemory - firstAvgMemory,
    };
  }

  /**
   * 최적화 제안 생성
   */
  private generateRecommendations(
    avgTime: number,
    avgMemory: number,
    successRate: number,
    bottlenecks: Bottleneck[]
  ): string[] {
    const recommendations: string[] = [];

    // 시간 최적화
    if (avgTime > 10) {
      recommendations.push('💡 Consider caching results for repeated operations');
    }

    // 메모리 최적화
    if (avgMemory > 1024) {
      recommendations.push('💡 Use iterators instead of creating full arrays');
    }

    // 안정성
    if (successRate < 95) {
      recommendations.push(
        `⚠️ Success rate is ${successRate.toFixed(1)}%; review error patterns`
      );
    }

    // 병목 기반 제안
    for (const bottleneck of bottlenecks) {
      recommendations.push(`🔍 ${bottleneck.suggestion}`);
    }

    // 기본 제안
    if (recommendations.length === 0) {
      recommendations.push('✅ Performance is good');
    }

    return recommendations;
  }

  /**
   * 분산 계산
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return variance;
  }

  /**
   * 공백 분석 결과 생성
   */
  private createEmptyAnalysis(): PerformanceAnalysis {
    return {
      totalExecutions: 0,
      averageTime: 0,
      maxTime: 0,
      minTime: 0,
      averageMemory: 0,
      maxMemory: 0,
      successRate: 0,
      bottlenecks: [],
      trends: { timeGrowth: 0, memoryGrowth: 0 },
      recommendations: ['No data available yet'],
    };
  }

  /**
   * 코드별 성능 비교
   */
  compareByCodePattern(pattern: string): {
    matchingExecutions: number;
    averageTime: number;
    averageMemory: number;
  } {
    const matching = this.metrics.filter((m) =>
      m.code.includes(pattern)
    );

    if (matching.length === 0) {
      return {
        matchingExecutions: 0,
        averageTime: 0,
        averageMemory: 0,
      };
    }

    const avgTime =
      matching.reduce((a, m) => a + m.executionTime, 0) / matching.length;
    const avgMemory =
      matching.reduce((a, m) => a + m.memory, 0) / matching.length;

    return {
      matchingExecutions: matching.length,
      averageTime: avgTime,
      averageMemory: avgMemory,
    };
  }

  /**
   * 최악의 경우 코드 찾기
   */
  findWorstCase(): { code: string; time: number; memory: number } | null {
    if (this.metrics.length === 0) return null;

    const worst = this.metrics.reduce((worst, current) => {
      const currentScore = current.executionTime + current.memory / 1000;
      const worstScore = worst.executionTime + worst.memory / 1000;
      return currentScore > worstScore ? current : worst;
    });

    return {
      code: worst.code,
      time: worst.executionTime,
      memory: worst.memory,
    };
  }

  /**
   * 메트릭 초기화
   */
  reset(): void {
    this.metrics = [];
  }

  /**
   * 메트릭 내보내기
   */
  export(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * 성능 리포트 생성 (텍스트)
   */
  generateReport(): string {
    const analysis = this.analyze();

    return `
╔════════════════════════════════════════════════════════════╗
║          Performance Analysis Report                       ║
╚════════════════════════════════════════════════════════════╝

📊 Summary
  Total Executions: ${analysis.totalExecutions}
  Success Rate: ${analysis.successRate.toFixed(1)}%

⏱️  Execution Time
  Average: ${analysis.averageTime.toFixed(3)}ms
  Min: ${analysis.minTime.toFixed(3)}ms
  Max: ${analysis.maxTime.toFixed(3)}ms

💾 Memory Usage
  Average: ${analysis.averageMemory}B
  Max: ${analysis.maxMemory}B

📈 Trends
  Time Growth: ${analysis.trends.timeGrowth > 0 ? '+' : ''}${analysis.trends.timeGrowth.toFixed(3)}ms
  Memory Growth: ${analysis.trends.memoryGrowth > 0 ? '+' : ''}${Math.round(analysis.trends.memoryGrowth)}B

⚠️  Bottlenecks (${analysis.bottlenecks.length})
${analysis.bottlenecks
  .map((b) => `  [${b.severity.toUpperCase()}] ${b.description}\n    → ${b.suggestion}`)
  .join('\n')}

💡 Recommendations
${analysis.recommendations.map((r) => `  ${r}`).join('\n')}
    `.trim();
  }
}

/**
 * 글로벌 인스턴스
 */
export const globalPerformanceAnalyzer = new PerformanceAnalyzer();
