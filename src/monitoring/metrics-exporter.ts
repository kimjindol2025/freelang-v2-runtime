/**
 * Phase 20 Week 1: Prometheus Metrics Exporter
 * 
 * 책임:
 * 1. Health Checker + Self Healer 메트릭 수집
 * 2. Prometheus 텍스트 포맷 변환
 * 3. 8개 핵심 메트릭 내보내기
 */

import { HealthChecker, HealthStatus } from './health-checker';
import { SelfHealer, HealingAction } from './self-healer';

/**
 * Prometheus 메트릭 구조
 */
export interface PrometheusMetrics {
  systemHealthStatus: number;      // HEALTHY=1, DEGRADED=2, UNHEALTHY=3, CRITICAL=4
  cpuUsage: number;                // 0-100%
  memoryUsageMb: number;           // MB
  errorRate: number;               // errors/sec
  responseTimeP95Ms: number;       // ms
  healingActionsTotal: number;     // counter
  workersHealthyCount: number;     // 0-8
  uptimeSeconds: number;           // seconds
}

/**
 * Prometheus 메트릭 내보내기
 */
export class MetricsExporter {
  private startTime: number = Date.now();
  private healingActionCounts: Map<HealingAction, number> = new Map();

  constructor(
    private healthChecker: HealthChecker,
    private selfHealer: SelfHealer
  ) {}

  /**
   * 메트릭 수집
   */
  collect(): PrometheusMetrics {
    const health = this.healthChecker.check();
    const stats = this.selfHealer.getStats();

    // 복구 액션 통계
    let totalHealingActions = 0;
    for (const stat of stats) {
      totalHealingActions += stat.executionCount;
    }

    return {
      systemHealthStatus: this.statusToNumber(health.metrics.status),
      cpuUsage: health.metrics.cpuUsage,
      memoryUsageMb: health.metrics.memoryUsageMB,
      errorRate: health.metrics.errorRate,
      responseTimeP95Ms: health.metrics.p95ResponseTime,
      healingActionsTotal: totalHealingActions,
      workersHealthyCount: health.metrics.healthyWorkers,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }

  /**
   * 상태를 숫자로 변환
   */
  private statusToNumber(status: HealthStatus): number {
    const statusMap: { [key in HealthStatus]: number } = {
      [HealthStatus.HEALTHY]: 1,
      [HealthStatus.DEGRADED]: 2,
      [HealthStatus.UNHEALTHY]: 3,
      [HealthStatus.CRITICAL]: 4
    };
    return statusMap[status];
  }

  /**
   * Prometheus 텍스트 포맷으로 변환
   */
  toPrometheusFormat(): string {
    const metrics = this.collect();
    const lines: string[] = [];

    // HELP 및 TYPE 선언 + 메트릭값
    lines.push('# HELP system_health_status System health status (1=healthy, 2=degraded, 3=unhealthy, 4=critical)');
    lines.push('# TYPE system_health_status gauge');
    lines.push(`system_health_status ${metrics.systemHealthStatus}`);
    lines.push('');

    lines.push('# HELP system_cpu_usage_percent CPU usage in percent');
    lines.push('# TYPE system_cpu_usage_percent gauge');
    lines.push(`system_cpu_usage_percent ${metrics.cpuUsage.toFixed(2)}`);
    lines.push('');

    lines.push('# HELP system_memory_usage_mb Memory usage in MB');
    lines.push('# TYPE system_memory_usage_mb gauge');
    lines.push(`system_memory_usage_mb ${metrics.memoryUsageMb}`);
    lines.push('');

    lines.push('# HELP system_error_rate_per_sec Error rate per second');
    lines.push('# TYPE system_error_rate_per_sec gauge');
    lines.push(`system_error_rate_per_sec ${metrics.errorRate.toFixed(2)}`);
    lines.push('');

    lines.push('# HELP system_response_time_p95_ms Response time P95 in milliseconds');
    lines.push('# TYPE system_response_time_p95_ms gauge');
    lines.push(`system_response_time_p95_ms ${metrics.responseTimeP95Ms}`);
    lines.push('');

    lines.push('# HELP healing_actions_executed_total Total healing actions executed');
    lines.push('# TYPE healing_actions_executed_total counter');
    lines.push(`healing_actions_executed_total ${metrics.healingActionsTotal}`);
    lines.push('');

    lines.push('# HELP workers_healthy_count Number of healthy workers');
    lines.push('# TYPE workers_healthy_count gauge');
    lines.push(`workers_healthy_count ${metrics.workersHealthyCount}`);
    lines.push('');

    lines.push('# HELP uptime_seconds System uptime in seconds');
    lines.push('# TYPE uptime_seconds counter');
    lines.push(`uptime_seconds ${metrics.uptimeSeconds}`);

    return lines.join('\n');
  }

  /**
   * 간단한 JSON 포맷
   */
  toJSON(): PrometheusMetrics {
    return this.collect();
  }

  /**
   * 상세 보고서
   */
  generateReport(): string {
    const metrics = this.collect();
    const health = this.healthChecker.check();

    const lines: string[] = [];
    lines.push('╔════════════════════════════════════════════════════════╗');
    lines.push('║         📊 Phase 20: Prometheus Metrics Report         ║');
    lines.push('╚════════════════════════════════════════════════════════╝\n');

    lines.push('📈 System Status');
    lines.push(`  Status: ${this.statusToString(health.metrics.status)}`);
    lines.push(`  Uptime: ${this.formatUptime(metrics.uptimeSeconds)}`);
    lines.push('');

    lines.push('💻 Resource Utilization');
    lines.push(`  CPU: ${metrics.cpuUsage.toFixed(1)}%`);
    lines.push(`  Memory: ${metrics.memoryUsageMb}MB`);
    lines.push('');

    lines.push('⚡ Performance');
    lines.push(`  Error Rate: ${metrics.errorRate.toFixed(2)}/sec`);
    lines.push(`  Response Time P95: ${metrics.responseTimeP95Ms}ms`);
    lines.push('');

    lines.push('🔧 Recovery');
    lines.push(`  Healing Actions: ${metrics.healingActionsTotal}`);
    lines.push(`  Healthy Workers: ${metrics.workersHealthyCount}/8`);

    return lines.join('\n');
  }

  /**
   * 상태 문자열 변환
   */
  private statusToString(status: HealthStatus): string {
    const map: { [key in HealthStatus]: string } = {
      [HealthStatus.HEALTHY]: '✅ HEALTHY',
      [HealthStatus.DEGRADED]: '🟡 DEGRADED',
      [HealthStatus.UNHEALTHY]: '🔴 UNHEALTHY',
      [HealthStatus.CRITICAL]: '⛔ CRITICAL'
    };
    return map[status];
  }

  /**
   * 가동시간 포맷
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
      return `${days}일 ${hours}시간`;
    } else if (hours > 0) {
      return `${hours}시간 ${mins}분`;
    } else if (mins > 0) {
      return `${mins}분 ${secs}초`;
    } else {
      return `${secs}초`;
    }
  }
}
