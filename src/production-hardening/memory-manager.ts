/**
 * 메모리 관리자
 * - 메모리 사용량 모니터링
 * - GC 강제 실행
 * - 메모리 누수 감지
 */

import * as os from 'os';

export interface MemoryMetrics {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  usagePercent: number;
  trend: 'stable' | 'increasing' | 'decreasing';
}

export class MemoryManager {
  private samples: MemoryMetrics[] = [];
  private maxSamples = 1440; // 24시간 (분단위)
  private gcThreshold = 0.8; // 80%
  private warningThreshold = 0.7;

  /**
   * 메모리 메트릭 수집
   */
  collect(): MemoryMetrics {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();

    const metrics: MemoryMetrics = {
      timestamp: Date.now(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
      usagePercent: mem.heapUsed / mem.heapTotal,
      trend: this._calculateTrend()
    };

    this.samples.push(metrics);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    // 자동 GC
    if (metrics.usagePercent > this.gcThreshold) {
      this._forceGC();
    }

    return metrics;
  }

  /**
   * 강제 GC 실행
   */
  private _forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * 추세 계산
   */
  private _calculateTrend(): 'stable' | 'increasing' | 'decreasing' {
    if (this.samples.length < 3) return 'stable';

    const recent = this.samples.slice(-3);
    const avg1 = recent[0].heapUsed;
    const avg2 = recent[2].heapUsed;

    const diff = ((avg2 - avg1) / avg1) * 100;
    if (diff > 10) return 'increasing';
    if (diff < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * 메모리 누수 감지
   */
  detectLeak(): boolean {
    if (this.samples.length < 10) return false;

    const recent = this.samples.slice(-10);
    let increasing = 0;

    for (let i = 1; i < recent.length; i++) {
      if (recent[i].heapUsed > recent[i - 1].heapUsed) {
        increasing++;
      }
    }

    return increasing > 8; // 8/10 증가 추세
  }

  /**
   * 통계
   */
  getStats(): any {
    const latest = this.samples[this.samples.length - 1];
    return {
      current: latest ? {
        heapUsedMB: (latest.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: (latest.heapTotal / 1024 / 1024).toFixed(2),
        usagePercent: (latest.usagePercent * 100).toFixed(1),
        trend: latest.trend
      } : null,
      leak: this.detectLeak(),
      avgUsage: this._getAverageUsage()
    };
  }

  /**
   * 평균 사용량
   */
  private _getAverageUsage(): number {
    if (this.samples.length === 0) return 0;
    const sum = this.samples.reduce((a, b) => a + b.heapUsed, 0);
    return sum / this.samples.length;
  }
}

export default MemoryManager;
