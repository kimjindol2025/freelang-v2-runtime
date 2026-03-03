/**
 * Phase 19: Health Checker (시스템 건강 상태 모니터링)
 *
 * 책임:
 * 1. CPU, Memory, Error Rate, Response Time 모니터링
 * 2. 임계값 기반 경고 생성
 * 3. Worker 상태 추적
 * 4. 시계열 데이터 수집
 */

import * as os from 'os';

/**
 * 건강 상태
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  CRITICAL = 'critical'
}

/**
 * 건강 지표
 */
export interface HealthMetrics {
  timestamp: number;
  status: HealthStatus;

  // CPU
  cpuUsage: number; // %
  cpuTrend: 'stable' | 'increasing' | 'decreasing';

  // Memory
  memoryUsageMB: number;
  memoryUsagePercent: number;
  memoryTrend: 'stable' | 'increasing' | 'decreasing';

  // Performance
  avgResponseTime: number; // ms
  p95ResponseTime: number; // ms
  errorRate: number; // %

  // Worker Status
  totalWorkers: number;
  healthyWorkers: number;
  unhealthyWorkers: number;

  // Throughput
  requestsPerSecond: number;
  errorsPerSecond: number;
}

/**
 * 임계값 설정
 */
export interface HealthThresholds {
  // CPU
  cpuWarning: number; // % (기본: 70)
  cpuCritical: number; // % (기본: 90)

  // Memory
  memoryWarning: number; // MB (기본: 800)
  memoryCritical: number; // MB (기본: 1000)

  // Error Rate
  errorRateWarning: number; // % (기본: 2)
  errorRateCritical: number; // % (기본: 5)

  // Response Time
  responseTimeWarning: number; // ms (기본: 2000)
  responseTimeCritical: number; // ms (기본: 5000)

  // Worker
  minHealthyWorkers: number; // (기본: 6/8)
}

/**
 * 건강 체크 결과
 */
export interface HealthCheckResult {
  metrics: HealthMetrics;
  alerts: HealthAlert[];
  recommendations: string[];
}

/**
 * 경고
 */
export interface HealthAlert {
  timestamp: number;
  severity: 'warning' | 'critical';
  component: string; // cpu, memory, error_rate, response_time, worker
  message: string;
  value: number;
  threshold: number;
}

/**
 * HealthChecker 구현
 */
export class HealthChecker {
  private thresholds: Required<HealthThresholds>;
  private metrics: HealthMetrics[] = [];
  private lastMetrics: HealthMetrics | null = null;
  private startTime: number = Date.now();
  private requestCount: number = 0;
  private errorCount: number = 0;
  private responseTimes: number[] = [];
  private workerStates: Map<number, { healthy: boolean; errors: number }> = new Map();

  constructor(thresholds: Partial<HealthThresholds> = {}) {
    this.thresholds = {
      cpuWarning: 70,
      cpuCritical: 90,
      memoryWarning: 800,
      memoryCritical: 1000,
      errorRateWarning: 2,
      errorRateCritical: 5,
      responseTimeWarning: 2000,
      responseTimeCritical: 5000,
      minHealthyWorkers: 6,
      ...thresholds
    };
  }

  /**
   * Worker 상태 업데이트
   */
  updateWorkerStatus(workerId: number, healthy: boolean, errorCount: number = 0): void {
    this.workerStates.set(workerId, { healthy, errors: errorCount });
  }

  /**
   * 요청 기록
   */
  recordRequest(responseTime: number, success: boolean = true): void {
    this.requestCount++;
    this.responseTimes.push(responseTime);

    // 최근 1000개 응답시간만 유지
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }

    if (!success) {
      this.errorCount++;
    }
  }

  /**
   * 건강 체크 수행
   */
  check(): HealthCheckResult {
    const metrics = this.collectMetrics();
    const alerts = this.detectAlerts(metrics);
    const recommendations = this.generateRecommendations(alerts, metrics);

    this.metrics.push(metrics);
    this.lastMetrics = metrics;

    // 최근 100개 메트릭만 유지
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }

    return { metrics, alerts, recommendations };
  }

  /**
   * 메트릭 수집
   */
  private collectMetrics(): HealthMetrics {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // CPU 사용률 계산
    const cpuUsage = this.calculateCpuUsage();

    // CPU 트렌드
    const cpuTrend = this.calculateTrend('cpu', cpuUsage);

    // 메모리 트렌드
    const memoryTrend = this.calculateTrend('memory', usedMemory / 1024 / 1024);

    // Worker 상태
    const workerStats = this.getWorkerStats();

    // 응답 시간
    const avgResponseTime = this.getAverageResponseTime();
    const p95ResponseTime = this.getPercentileResponseTime(95);

    // 에러율
    const errorRate = this.getErrorRate();
    const rps = this.getRequestsPerSecond();
    const eps = this.getErrorsPerSecond();

    const metrics: HealthMetrics = {
      timestamp: Date.now(),
      status: HealthStatus.HEALTHY, // 나중에 업데이트
      cpuUsage: Math.round(cpuUsage * 100) / 100,
      cpuTrend,
      memoryUsageMB: Math.round(usedMemory / 1024 / 1024),
      memoryUsagePercent: Math.round((usedMemory / totalMemory) * 10000) / 100,
      memoryTrend,
      avgResponseTime: Math.round(avgResponseTime),
      p95ResponseTime: Math.round(p95ResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      totalWorkers: workerStats.total,
      healthyWorkers: workerStats.healthy,
      unhealthyWorkers: workerStats.total - workerStats.healthy,
      requestsPerSecond: Math.round(rps * 100) / 100,
      errorsPerSecond: Math.round(eps * 100) / 100
    };

    // 상태 결정
    metrics.status = this.determineStatus(metrics);

    return metrics;
  }

  /**
   * CPU 사용률 계산
   */
  private calculateCpuUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    }

    const idle = totalIdle / cpus.length;
    const tick = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / tick);

    return Math.max(0, Math.min(100, usage));
  }

  /**
   * 트렌드 계산
   */
  private calculateTrend(
    metric: 'cpu' | 'memory',
    currentValue: number
  ): 'stable' | 'increasing' | 'decreasing' {
    if (!this.lastMetrics) {
      return 'stable';
    }

    const lastValue = metric === 'cpu'
      ? this.lastMetrics.cpuUsage
      : this.lastMetrics.memoryUsageMB;

    const change = currentValue - lastValue;
    const threshold = metric === 'cpu' ? 5 : 50; // CPU: 5%, Memory: 50MB

    if (Math.abs(change) < threshold) {
      return 'stable';
    }

    return change > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Worker 상태
   */
  private getWorkerStats(): { total: number; healthy: number } {
    let healthy = 0;
    for (const [, state] of this.workerStates) {
      if (state.healthy) {
        healthy++;
      }
    }

    return {
      total: this.workerStates.size,
      healthy
    };
  }

  /**
   * 평균 응답시간
   */
  private getAverageResponseTime(): number {
    if (this.responseTimes.length === 0) {
      return 0;
    }

    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    return sum / this.responseTimes.length;
  }

  /**
   * 백분위 응답시간
   */
  private getPercentileResponseTime(percentile: number): number {
    if (this.responseTimes.length === 0) {
      return 0;
    }

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;

    return sorted[Math.max(0, index)];
  }

  /**
   * 에러율
   */
  private getErrorRate(): number {
    if (this.requestCount === 0) {
      return 0;
    }

    return (this.errorCount / this.requestCount) * 100;
  }

  /**
   * 초당 요청 수
   */
  private getRequestsPerSecond(): number {
    const uptime = (Date.now() - this.startTime) / 1000;
    if (uptime === 0) {
      return 0;
    }

    return this.requestCount / uptime;
  }

  /**
   * 초당 에러 수
   */
  private getErrorsPerSecond(): number {
    const uptime = (Date.now() - this.startTime) / 1000;
    if (uptime === 0) {
      return 0;
    }

    return this.errorCount / uptime;
  }

  /**
   * 상태 결정
   */
  private determineStatus(metrics: HealthMetrics): HealthStatus {
    if (metrics.cpuUsage >= this.thresholds.cpuCritical ||
        metrics.memoryUsageMB >= this.thresholds.memoryCritical ||
        metrics.errorRate >= this.thresholds.errorRateCritical ||
        metrics.p95ResponseTime >= this.thresholds.responseTimeCritical ||
        metrics.healthyWorkers < 2) {
      return HealthStatus.CRITICAL;
    }

    if (metrics.cpuUsage >= this.thresholds.cpuWarning ||
        metrics.memoryUsageMB >= this.thresholds.memoryWarning ||
        metrics.errorRate >= this.thresholds.errorRateWarning ||
        metrics.p95ResponseTime >= this.thresholds.responseTimeWarning ||
        metrics.healthyWorkers < this.thresholds.minHealthyWorkers) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }

  /**
   * 경고 감지
   */
  private detectAlerts(metrics: HealthMetrics): HealthAlert[] {
    const alerts: HealthAlert[] = [];

    // CPU 경고
    if (metrics.cpuUsage >= this.thresholds.cpuCritical) {
      alerts.push({
        timestamp: metrics.timestamp,
        severity: 'critical',
        component: 'cpu',
        message: `CPU 임계값 초과: ${metrics.cpuUsage}%`,
        value: metrics.cpuUsage,
        threshold: this.thresholds.cpuCritical
      });
    } else if (metrics.cpuUsage >= this.thresholds.cpuWarning) {
      alerts.push({
        timestamp: metrics.timestamp,
        severity: 'warning',
        component: 'cpu',
        message: `CPU 경고: ${metrics.cpuUsage}%`,
        value: metrics.cpuUsage,
        threshold: this.thresholds.cpuWarning
      });
    }

    // Memory 경고
    if (metrics.memoryUsageMB >= this.thresholds.memoryCritical) {
      alerts.push({
        timestamp: metrics.timestamp,
        severity: 'critical',
        component: 'memory',
        message: `메모리 임계값 초과: ${metrics.memoryUsageMB}MB`,
        value: metrics.memoryUsageMB,
        threshold: this.thresholds.memoryCritical
      });
    } else if (metrics.memoryUsageMB >= this.thresholds.memoryWarning) {
      alerts.push({
        timestamp: metrics.timestamp,
        severity: 'warning',
        component: 'memory',
        message: `메모리 경고: ${metrics.memoryUsageMB}MB`,
        value: metrics.memoryUsageMB,
        threshold: this.thresholds.memoryWarning
      });
    }

    // Error Rate 경고
    if (metrics.errorRate >= this.thresholds.errorRateCritical) {
      alerts.push({
        timestamp: metrics.timestamp,
        severity: 'critical',
        component: 'error_rate',
        message: `에러율 임계값 초과: ${metrics.errorRate}%`,
        value: metrics.errorRate,
        threshold: this.thresholds.errorRateCritical
      });
    } else if (metrics.errorRate >= this.thresholds.errorRateWarning) {
      alerts.push({
        timestamp: metrics.timestamp,
        severity: 'warning',
        component: 'error_rate',
        message: `에러율 경고: ${metrics.errorRate}%`,
        value: metrics.errorRate,
        threshold: this.thresholds.errorRateWarning
      });
    }

    // Response Time 경고
    if (metrics.p95ResponseTime >= this.thresholds.responseTimeCritical) {
      alerts.push({
        timestamp: metrics.timestamp,
        severity: 'critical',
        component: 'response_time',
        message: `응답 시간 임계값 초과: ${metrics.p95ResponseTime}ms`,
        value: metrics.p95ResponseTime,
        threshold: this.thresholds.responseTimeCritical
      });
    } else if (metrics.p95ResponseTime >= this.thresholds.responseTimeWarning) {
      alerts.push({
        timestamp: metrics.timestamp,
        severity: 'warning',
        component: 'response_time',
        message: `응답 시간 경고: ${metrics.p95ResponseTime}ms`,
        value: metrics.p95ResponseTime,
        threshold: this.thresholds.responseTimeWarning
      });
    }

    // Worker 경고
    if (metrics.healthyWorkers < 2) {
      alerts.push({
        timestamp: metrics.timestamp,
        severity: 'critical',
        component: 'worker',
        message: `건강한 Worker 부족: ${metrics.healthyWorkers}/${metrics.totalWorkers}`,
        value: metrics.healthyWorkers,
        threshold: 2
      });
    } else if (metrics.healthyWorkers < this.thresholds.minHealthyWorkers) {
      alerts.push({
        timestamp: metrics.timestamp,
        severity: 'warning',
        component: 'worker',
        message: `건강한 Worker 부족: ${metrics.healthyWorkers}/${metrics.totalWorkers}`,
        value: metrics.healthyWorkers,
        threshold: this.thresholds.minHealthyWorkers
      });
    }

    return alerts;
  }

  /**
   * 권장사항 생성
   */
  private generateRecommendations(alerts: HealthAlert[], metrics: HealthMetrics): string[] {
    const recommendations: string[] = [];

    for (const alert of alerts) {
      switch (alert.component) {
        case 'cpu':
          if (alert.severity === 'critical') {
            recommendations.push('🔴 CPU 사용률이 매우 높습니다. Worker 추가 또는 요청 분산을 검토하세요.');
          } else {
            recommendations.push('🟡 CPU 사용률이 높아지고 있습니다. 리소스 모니터링을 강화하세요.');
          }
          break;

        case 'memory':
          if (alert.severity === 'critical') {
            recommendations.push('🔴 메모리 부족입니다. 가비지 컬렉션 또는 캐시 정리를 수행하세요.');
          } else {
            recommendations.push('🟡 메모리 사용량이 증가하고 있습니다. 메모리 누수를 점검하세요.');
          }
          break;

        case 'error_rate':
          if (alert.severity === 'critical') {
            recommendations.push('🔴 에러율이 높습니다. 로그를 확인하고 문제를 파악하세요.');
          } else {
            recommendations.push('🟡 에러율이 증가하고 있습니다. 시스템 상태를 모니터링하세요.');
          }
          break;

        case 'response_time':
          if (alert.severity === 'critical') {
            recommendations.push('🔴 응답 시간이 매우 깁니다. 데이터베이스 또는 외부 API 호출을 확인하세요.');
          } else {
            recommendations.push('🟡 응답 시간이 증가하고 있습니다. 성능 최적화를 검토하세요.');
          }
          break;

        case 'worker':
          recommendations.push('🔴 건강한 Worker가 부족합니다. Worker 자동 재시작을 확인하세요.');
          break;
      }
    }

    // 추가 권장사항
    if (metrics.cpuTrend === 'increasing') {
      recommendations.push('📈 CPU 사용률이 계속 증가하는 추세입니다.');
    }

    if (metrics.memoryTrend === 'increasing') {
      recommendations.push('📈 메모리 사용량이 계속 증가하는 추세입니다. 메모리 누수 가능성을 확인하세요.');
    }

    return recommendations;
  }

  /**
   * 메트릭 히스토리 조회
   */
  getMetricHistory(limit: number = 100): HealthMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * 현재 메트릭 조회
   */
  getCurrentMetrics(): HealthMetrics | null {
    return this.lastMetrics;
  }

  /**
   * 통계 리셋
   */
  reset(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimes = [];
    this.startTime = Date.now();
  }
}
