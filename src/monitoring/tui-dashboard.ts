/**
 * Phase 19: TUI Dashboard (텍스트 기반 실시간 대시보드)
 *
 * 책임:
 * 1. 실시간 시스템 상태 표시
 * 2. Health metrics 시각화
 * 3. 경고 표시
 * 4. 복구 이력 표시
 *
 * 간단한 콘솔 기반 구현 (ncurses 대신)
 */

import { HealthMetrics, HealthAlert, HealthStatus } from './health-checker';
import { HealingResult, HealingAction } from './self-healer';

/**
 * TUI 대시보드
 */
export class TUIDashboard {
  private startTime: number = Date.now();
  private lastUpdateTime: number = 0;

  /**
   * 전체 대시보드 렌더링
   */
  render(
    metrics: HealthMetrics | null,
    alerts: HealthAlert[],
    healingResults: HealingResult[],
    workerDetails: { [id: number]: { status: string; errors: number } } = {}
  ): void {
    // 화면 초기화 (실제 TUI는 curses 사용)
    if (process.stdout.isTTY) {
      console.clear();
    }

    // 헤더
    this.renderHeader();

    if (!metrics) {
      console.log('⏳ 데이터 수집 중...\n');
      return;
    }

    // 시스템 상태 (상단)
    this.renderSystemStatus(metrics);

    // 경고 (있으면)
    if (alerts.length > 0) {
      this.renderAlerts(alerts);
    }

    // Worker 상태
    this.renderWorkerStatus(metrics, workerDetails);

    // 최근 복구 이력
    if (healingResults.length > 0) {
      this.renderHealingHistory(healingResults.slice(-5));
    }

    // 푸터
    this.renderFooter();
  }

  /**
   * 헤더 렌더링
   */
  private renderHeader(): void {
    console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    🚀 Phase 19: Self-Healing Dashboard                        ║');
    console.log('║                           Real-time System Monitor                            ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');
  }

  /**
   * 시스템 상태 렌더링
   */
  private renderSystemStatus(metrics: HealthMetrics): void {
    const statusEmoji = this.getStatusEmoji(metrics.status);
    const statusColor = this.getStatusColor(metrics.status);

    console.log(`\n${statusEmoji} ${statusColor}시스템 상태: ${metrics.status.toUpperCase()}\x1b[0m\n`);

    // CPU
    console.log('📊 CPU');
    console.log(`   사용률: ${this.renderBar(metrics.cpuUsage, 100, 20)} ${metrics.cpuUsage.toFixed(1)}%`);
    console.log(`   추세: ${this.getTrendEmoji(metrics.cpuTrend)} ${metrics.cpuTrend}`);

    // Memory
    console.log('\n💾 메모리');
    console.log(`   사용: ${this.renderBar(metrics.memoryUsagePercent, 100, 20)} ${metrics.memoryUsageMB}MB (${metrics.memoryUsagePercent.toFixed(1)}%)`);
    console.log(`   추세: ${this.getTrendEmoji(metrics.memoryTrend)} ${metrics.memoryTrend}`);

    // Performance
    console.log('\n⚡ 성능');
    console.log(`   평균 응답: ${metrics.avgResponseTime}ms`);
    console.log(`   P95 응답: ${metrics.p95ResponseTime}ms`);
    console.log(`   에러율: ${metrics.errorRate.toFixed(2)}%`);

    // Throughput
    console.log('\n📈 처리량');
    console.log(`   요청/초: ${metrics.requestsPerSecond.toFixed(1)} req/s`);
    console.log(`   에러/초: ${metrics.errorsPerSecond.toFixed(2)} err/s`);

    // Worker Status
    console.log('\n🔧 Worker');
    const workerBar = this.renderBar(
      metrics.healthyWorkers,
      metrics.totalWorkers,
      10
    );
    console.log(`   상태: ${workerBar} ${metrics.healthyWorkers}/${metrics.totalWorkers}`);
  }

  /**
   * 경고 렌더링
   */
  private renderAlerts(alerts: HealthAlert[]): void {
    console.log('\n⚠️  경고 (최근 5개)\n');

    for (const alert of alerts.slice(-5)) {
      const icon = alert.severity === 'critical' ? '🔴' : '🟡';
      const timestamp = new Date(alert.timestamp).toLocaleTimeString('ko-KR');

      console.log(`${icon} [${timestamp}] ${alert.message}`);
      console.log(`   └─ 값: ${alert.value} / 임계값: ${alert.threshold}`);
    }
  }

  /**
   * Worker 상태 렌더링
   */
  private renderWorkerStatus(
    metrics: HealthMetrics,
    workerDetails: { [id: number]: { status: string; errors: number } }
  ): void {
    console.log('\n👷 Worker 상세 정보\n');

    const workerCount = metrics.totalWorkers;
    for (let i = 0; i < workerCount; i++) {
      const detail = workerDetails[i];
      const statusEmoji = detail?.status === 'healthy' ? '✅' : '❌';
      const errors = detail?.errors || 0;

      console.log(`Worker ${i}: ${statusEmoji} ${detail?.status || 'unknown'} | 에러: ${errors}`);
    }
  }

  /**
   * 복구 이력 렌더링
   */
  private renderHealingHistory(results: HealingResult[]): void {
    console.log('\n🔧 복구 이력 (최근 5개)\n');

    for (const result of results) {
      const icon = result.success ? '✅' : '❌';
      const timestamp = new Date(result.timestamp).toLocaleTimeString('ko-KR');

      console.log(`${icon} [${timestamp}] ${this.actionName(result.action)} (${result.duration}ms)`);
      if (!result.success) {
        console.log(`   └─ ${result.message}`);
      }
    }
  }

  /**
   * 푸터 렌더링
   */
  private renderFooter(): void {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const uptimeStr = this.formatUptime(uptime);

    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log(`⏱️  가동시간: ${uptimeStr} | 💾 메모리 사용: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  }

  /**
   * 상태 이모지
   */
  private getStatusEmoji(status: HealthStatus): string {
    switch (status) {
      case HealthStatus.HEALTHY:
        return '✅';
      case HealthStatus.DEGRADED:
        return '🟡';
      case HealthStatus.UNHEALTHY:
        return '🔴';
      case HealthStatus.CRITICAL:
        return '⛔';
      default:
        return '❓';
    }
  }

  /**
   * 상태 색상 (ANSI)
   */
  private getStatusColor(status: HealthStatus): string {
    switch (status) {
      case HealthStatus.HEALTHY:
        return '\x1b[92m'; // Green
      case HealthStatus.DEGRADED:
        return '\x1b[93m'; // Yellow
      case HealthStatus.UNHEALTHY:
      case HealthStatus.CRITICAL:
        return '\x1b[91m'; // Red
      default:
        return '\x1b[0m';
    }
  }

  /**
   * 트렌드 이모지
   */
  private getTrendEmoji(trend: 'stable' | 'increasing' | 'decreasing'): string {
    switch (trend) {
      case 'stable':
        return '➡️';
      case 'increasing':
        return '📈';
      case 'decreasing':
        return '📉';
      default:
        return '❓';
    }
  }

  /**
   * 진행률 바 렌더링
   */
  private renderBar(current: number, max: number, width: number): string {
    const percentage = (current / max) * 100;
    const filled = Math.round((width * current) / max);

    let color = '\x1b[92m'; // Green
    if (percentage >= 80) {
      color = '\x1b[91m'; // Red
    } else if (percentage >= 60) {
      color = '\x1b[93m'; // Yellow
    }

    const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
    return `${color}[${bar}]\x1b[0m`;
  }

  /**
   * 액션명 변환
   */
  private actionName(action: HealingAction): string {
    const names: { [key in HealingAction]: string } = {
      [HealingAction.SCALE_OUT_WORKERS]: 'Worker 추가',
      [HealingAction.THROTTLE_REQUESTS]: '요청 제한',
      [HealingAction.CLEAR_CACHE]: '캐시 정리',
      [HealingAction.FORCE_GC]: 'GC 강제 실행',
      [HealingAction.CLEAR_BUFFERS]: '버퍼 정리',
      [HealingAction.RESTART_WORKER]: 'Worker 재시작',
      [HealingAction.CIRCUIT_BREAKER]: 'Circuit Breaker 활성화',
      [HealingAction.RETRY_LOGIC]: '재시도 로직',
      [HealingAction.ROLLBACK]: '롤백',
      [HealingAction.INCREASE_TIMEOUT]: '타임아웃 증가',
      [HealingAction.REDUCE_BATCH_SIZE]: '배치 크기 감소',
      [HealingAction.RESTART_UNHEALTHY]: '비정상 Worker 재시작',
      [HealingAction.REBUILD_CLUSTER]: '클러스터 재구축'
    };

    return names[action] || action;
  }

  /**
   * 가동시간 포맷
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
      return `${days}일 ${hours}시간`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${secs}초`;
    } else {
      return `${secs}초`;
    }
  }

  /**
   * 간단한 요약 (로그용)
   */
  renderSummary(metrics: HealthMetrics | null): string {
    if (!metrics) {
      return '[준비 중...]';
    }

    return `[${metrics.status.toUpperCase()}] CPU: ${metrics.cpuUsage.toFixed(1)}% | MEM: ${metrics.memoryUsageMB}MB | ERR: ${metrics.errorRate.toFixed(2)}% | Workers: ${metrics.healthyWorkers}/${metrics.totalWorkers}`;
  }
}
