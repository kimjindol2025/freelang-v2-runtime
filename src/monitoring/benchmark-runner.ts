/**
 * Phase 20 Week 4: Performance Benchmarking System
 *
 * 책임:
 * 1. 시스템 성능 측정 (RPS, 지연시간, 메모리)
 * 2. 벤치마크 실행 및 데이터 수집
 * 3. 비교 분석 (이전 벤치마크와 비교)
 * 4. 성능 리포트 생성
 */

/**
 * 벤치마크 메트릭
 */
export interface BenchmarkMetrics {
  timestamp: number;
  duration: number; // 테스트 실행 시간 (초)

  // 처리량
  requestCount: number;
  successCount: number;
  failureCount: number;
  requestsPerSecond: number; // RPS

  // 지연시간 (ms)
  minLatency: number;
  maxLatency: number;
  avgLatency: number;
  p50Latency: number; // median
  p95Latency: number;
  p99Latency: number;

  // 메모리 (MB)
  startMemory: number;
  endMemory: number;
  peakMemory: number;
  avgMemory: number;

  // CPU
  cpuUsagePercent: number;

  // 안정성
  errorRate: number; // % (failures / total * 100)
  successRate: number; // % (successes / total * 100)
}

/**
 * 벤치마크 비교 결과
 */
export interface BenchmarkComparison {
  baseline: BenchmarkMetrics;
  current: BenchmarkMetrics;

  // 변화율 (%)
  rpsChange: number; // positive = improvement
  latencyChange: number; // negative = improvement
  memoryChange: number; // negative = improvement

  // 평가
  performanceRating: 'improved' | 'degraded' | 'stable';
  recommendation: string;
}

/**
 * BenchmarkRunner 구현
 */
export class BenchmarkRunner {
  private benchmarks: BenchmarkMetrics[] = [];
  private baseline: BenchmarkMetrics | null = null;
  private isRunning: boolean = false;

  /**
   * 벤치마크 실행 시뮬레이션
   * 실제 구현에서는 HTTP 클라이언트(wrk 등)를 사용
   */
  async runBenchmark(
    durationSeconds: number = 30,
    requestsPerSecond: number = 1000
  ): Promise<BenchmarkMetrics> {
    if (this.isRunning) {
      throw new Error('Benchmark already running');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;

    try {
      // 벤치마크 데이터 시뮬레이션
      const metrics = this.simulateBenchmark(durationSeconds, requestsPerSecond);
      metrics.timestamp = Date.now();
      metrics.startMemory = startMemory;
      metrics.endMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      this.benchmarks.push(metrics);

      // 첫 벤치마크를 baseline으로 설정
      if (!this.baseline) {
        this.baseline = metrics;
        if (process.env.NODE_ENV !== 'test') {
          console.log('📊 Baseline benchmark set');
        }
      }

      if (process.env.NODE_ENV !== 'test') {
        console.log(`✅ Benchmark completed: ${metrics.requestsPerSecond.toFixed(0)} RPS, ${metrics.avgLatency.toFixed(2)}ms latency`);
      }

      return metrics;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 벤치마크 시뮬레이션 (테스트용)
   */
  private simulateBenchmark(durationSeconds: number, targetRps: number): BenchmarkMetrics {
    const requestCount = durationSeconds * targetRps;
    const latencies: number[] = [];

    // 지연시간 시뮬레이션 (로그 정규분포)
    for (let i = 0; i < requestCount; i++) {
      // 평균 10ms, 표준편차 5ms의 정규분포
      const latency = Math.max(1, 10 + (Math.random() + Math.random() + Math.random() - 1.5) * 5);
      latencies.push(latency);
    }

    latencies.sort((a, b) => a - b);
    const successCount = Math.floor(requestCount * 0.99); // 99% 성공률
    const failureCount = requestCount - successCount;

    const p50Index = Math.floor(latencies.length * 0.5);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    const avgMemory = (process.memoryUsage().heapUsed / 1024 / 1024) * (0.95 + Math.random() * 0.1);
    const peakMemory = avgMemory * (1 + Math.random() * 0.2);

    return {
      timestamp: Date.now(),
      duration: durationSeconds,
      requestCount,
      successCount,
      failureCount,
      requestsPerSecond: requestCount / durationSeconds,
      minLatency: latencies[0],
      maxLatency: latencies[latencies.length - 1],
      avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50Latency: latencies[p50Index],
      p95Latency: latencies[p95Index],
      p99Latency: latencies[p99Index],
      startMemory: avgMemory * 0.95,
      endMemory: avgMemory,
      peakMemory,
      avgMemory,
      cpuUsagePercent: 30 + Math.random() * 40, // 30~70%
      errorRate: (failureCount / requestCount) * 100,
      successRate: (successCount / requestCount) * 100
    };
  }

  /**
   * 현재 벤치마크와 baseline 비교
   */
  compareWithBaseline(current?: BenchmarkMetrics): BenchmarkComparison | null {
    if (!this.baseline) {
      return null;
    }

    const currentMetrics = current || (this.benchmarks.length > 0 ? this.benchmarks[this.benchmarks.length - 1] : null);
    if (!currentMetrics) {
      return null;
    }

    // 변화율 계산 (%)
    const rpsChange = ((currentMetrics.requestsPerSecond - this.baseline.requestsPerSecond) / this.baseline.requestsPerSecond) * 100;
    const latencyChange = ((currentMetrics.avgLatency - this.baseline.avgLatency) / this.baseline.avgLatency) * 100;
    const memoryChange = ((currentMetrics.avgMemory - this.baseline.avgMemory) / this.baseline.avgMemory) * 100;

    // 성능 평가
    let performanceRating: 'improved' | 'degraded' | 'stable';
    if (rpsChange > 5 && latencyChange < -5) {
      performanceRating = 'improved';
    } else if (rpsChange < -5 || latencyChange > 5) {
      performanceRating = 'degraded';
    } else {
      performanceRating = 'stable';
    }

    const recommendation = this.generateRecommendation(performanceRating, rpsChange, latencyChange, memoryChange);

    return {
      baseline: this.baseline,
      current: currentMetrics,
      rpsChange,
      latencyChange,
      memoryChange,
      performanceRating,
      recommendation
    };
  }

  /**
   * 권장사항 생성
   */
  private generateRecommendation(
    rating: 'improved' | 'degraded' | 'stable',
    rpsChange: number,
    latencyChange: number,
    memoryChange: number
  ): string {
    const parts: string[] = [];

    if (rating === 'improved') {
      parts.push('🎉 성능 개선 감지!');
      if (rpsChange > 0) {
        parts.push(`RPS +${rpsChange.toFixed(1)}%`);
      }
      if (latencyChange < 0) {
        parts.push(`Latency ${latencyChange.toFixed(1)}%`);
      }
      if (memoryChange < 0) {
        parts.push(`Memory ${memoryChange.toFixed(1)}%`);
      }
    } else if (rating === 'degraded') {
      parts.push('⚠️ 성능 저하 감지!');
      if (rpsChange < 0) {
        parts.push(`RPS ${rpsChange.toFixed(1)}%`);
      }
      if (latencyChange > 0) {
        parts.push(`Latency +${latencyChange.toFixed(1)}%`);
      }
      if (memoryChange > 0) {
        parts.push(`Memory +${memoryChange.toFixed(1)}%`);
      }
      parts.push('최근 변경사항을 검토하세요.');
    } else {
      parts.push('➡️ 성능 안정');
      parts.push(`RPS: ${rpsChange > 0 ? '+' : ''}${rpsChange.toFixed(1)}%`);
      parts.push(`Latency: ${latencyChange > 0 ? '+' : ''}${latencyChange.toFixed(1)}%`);
    }

    return parts.join(' | ');
  }

  /**
   * 벤치마크 기록 조회
   */
  getResults(limit: number = 50): BenchmarkMetrics[] {
    return this.benchmarks.slice(-limit);
  }

  /**
   * Baseline 설정
   */
  setBaseline(metrics: BenchmarkMetrics): void {
    this.baseline = metrics;
    if (process.env.NODE_ENV !== 'test') {
      console.log('📊 Baseline updated');
    }
  }

  /**
   * Baseline 조회
   */
  getBaseline(): BenchmarkMetrics | null {
    return this.baseline;
  }

  /**
   * 결과 리셋
   */
  reset(): void {
    this.benchmarks = [];
    this.baseline = null;
    if (process.env.NODE_ENV !== 'test') {
      console.log('🔄 Benchmark results reset');
    }
  }

  /**
   * 최근 N개 벤치마크의 평균 성능
   */
  getAveragePerformance(count: number = 5): BenchmarkMetrics | null {
    if (this.benchmarks.length === 0) {
      return null;
    }

    const recent = this.benchmarks.slice(-count);
    const avgMetrics: BenchmarkMetrics = {
      timestamp: Date.now(),
      duration: recent.reduce((a, m) => a + m.duration, 0) / recent.length,
      requestCount: recent.reduce((a, m) => a + m.requestCount, 0) / recent.length,
      successCount: recent.reduce((a, m) => a + m.successCount, 0) / recent.length,
      failureCount: recent.reduce((a, m) => a + m.failureCount, 0) / recent.length,
      requestsPerSecond: recent.reduce((a, m) => a + m.requestsPerSecond, 0) / recent.length,
      minLatency: recent.reduce((a, m) => a + m.minLatency, 0) / recent.length,
      maxLatency: recent.reduce((a, m) => a + m.maxLatency, 0) / recent.length,
      avgLatency: recent.reduce((a, m) => a + m.avgLatency, 0) / recent.length,
      p50Latency: recent.reduce((a, m) => a + m.p50Latency, 0) / recent.length,
      p95Latency: recent.reduce((a, m) => a + m.p95Latency, 0) / recent.length,
      p99Latency: recent.reduce((a, m) => a + m.p99Latency, 0) / recent.length,
      startMemory: recent.reduce((a, m) => a + m.startMemory, 0) / recent.length,
      endMemory: recent.reduce((a, m) => a + m.endMemory, 0) / recent.length,
      peakMemory: recent.reduce((a, m) => a + m.peakMemory, 0) / recent.length,
      avgMemory: recent.reduce((a, m) => a + m.avgMemory, 0) / recent.length,
      cpuUsagePercent: recent.reduce((a, m) => a + m.cpuUsagePercent, 0) / recent.length,
      errorRate: recent.reduce((a, m) => a + m.errorRate, 0) / recent.length,
      successRate: recent.reduce((a, m) => a + m.successRate, 0) / recent.length
    };

    return avgMetrics;
  }

  /**
   * 성능 트렌드 분석
   */
  analyzeTrend(count: number = 10): {
    rpsImproving: boolean;
    latencyImproving: boolean;
    memoryImproving: boolean;
  } {
    if (this.benchmarks.length < 2) {
      return {
        rpsImproving: false,
        latencyImproving: false,
        memoryImproving: false
      };
    }

    const recent = this.benchmarks.slice(-Math.min(count, this.benchmarks.length));

    // 선형 회귀로 트렌드 판단
    const first = recent[0];
    const last = recent[recent.length - 1];

    return {
      rpsImproving: last.requestsPerSecond > first.requestsPerSecond,
      latencyImproving: last.avgLatency < first.avgLatency,
      memoryImproving: last.avgMemory < first.avgMemory
    };
  }
}
