/**
 * Memory Profiler
 * Monitors memory usage, detects leaks, and enforces limits
 */

export interface MemorySample {
  timestamp: string;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  trend?: 'stable' | 'increasing' | 'decreasing';
}

export interface MemoryAlert {
  type: 'HIGH_USAGE' | 'POSSIBLE_LEAK' | 'OOM_RISK';
  timestamp: string;
  heapUsed: number;
  threshold: number;
  recommendation: string;
}

export class MemoryProfiler {
  private samples: MemorySample[] = [];
  private alerts: MemoryAlert[] = [];
  private sampleInterval: NodeJS.Timeout | null = null;
  private heapWarningThreshold: number = 0.85; // 85% of heap limit
  private leakDetectionWindow: number = 10; // samples
  private maxMemoryMB: number = 512;

  /**
   * Start memory profiling
   */
  start(intervalMs: number = 5000): void {
    this.sampleInterval = setInterval(() => {
      this.collectSample();
    }, intervalMs);
  }

  /**
   * Stop memory profiling
   */
  stop(): void {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
    }
  }

  /**
   * Collect memory sample
   */
  private collectSample(): void {
    const memUsage = process.memoryUsage();

    const sample: MemorySample = {
      timestamp: new Date().toISOString(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
    };

    // Detect trend
    if (this.samples.length > 0) {
      const prev = this.samples[this.samples.length - 1];
      const diff = sample.heapUsed - prev.heapUsed;

      if (Math.abs(diff) < 1024 * 100) {
        // Less than 100KB difference
        sample.trend = 'stable';
      } else if (diff > 0) {
        sample.trend = 'increasing';
      } else {
        sample.trend = 'decreasing';
      }
    }

    this.samples.push(sample);

    // Check for alerts
    this.checkAlerts(sample);

    // Limit samples to last 1000
    if (this.samples.length > 1000) {
      this.samples.shift();
    }
  }

  /**
   * Check for memory alerts
   */
  private checkAlerts(sample: MemorySample): void {
    const heapLimitMB = this.maxMemoryMB;
    const heapUsedMB = sample.heapUsed / (1024 * 1024);
    const threshold = heapLimitMB * this.heapWarningThreshold;

    // Check high usage
    if (heapUsedMB > threshold) {
      this.alerts.push({
        type: 'HIGH_USAGE',
        timestamp: sample.timestamp,
        heapUsed: heapUsedMB,
        threshold,
        recommendation: 'Run garbage collection or increase heap size',
      });
    }

    // Check OOM risk
    if (heapUsedMB > heapLimitMB * 0.95) {
      this.alerts.push({
        type: 'OOM_RISK',
        timestamp: sample.timestamp,
        heapUsed: heapUsedMB,
        threshold: heapLimitMB,
        recommendation: 'Immediate action required to prevent OOM',
      });
    }

    // Check for possible leak
    if (this.samples.length > this.leakDetectionWindow) {
      const recent = this.samples.slice(-this.leakDetectionWindow);
      const isIncreasing = recent.every((s, i) => {
        if (i === 0) return true;
        return s.heapUsed > recent[i - 1].heapUsed;
      });

      if (isIncreasing) {
        this.alerts.push({
          type: 'POSSIBLE_LEAK',
          timestamp: sample.timestamp,
          heapUsed: heapUsedMB,
          threshold,
          recommendation: 'Investigate for memory leaks using heap snapshots',
        });
      }
    }
  }

  /**
   * Get memory report
   */
  getReport(): {
    current: MemorySample | null;
    average: MemorySample | null;
    peak: MemorySample | null;
    alerts: MemoryAlert[];
    samples: number;
  } {
    if (this.samples.length === 0) {
      return {
        current: null,
        average: null,
        peak: null,
        alerts: this.alerts,
        samples: 0,
      };
    }

    const current = this.samples[this.samples.length - 1];
    const peak = this.samples.reduce((max, s) =>
      s.heapUsed > max.heapUsed ? s : max
    );

    const avgHeap = this.samples.reduce((sum, s) => sum + s.heapUsed, 0) / this.samples.length;
    const avgRss = this.samples.reduce((sum, s) => sum + s.rss, 0) / this.samples.length;

    const average: MemorySample = {
      timestamp: 'AVERAGE',
      heapUsed: avgHeap,
      heapTotal: current.heapTotal,
      external: this.samples[0].external,
      rss: avgRss,
    };

    return {
      current,
      average,
      peak,
      alerts: this.alerts.slice(-10), // Last 10 alerts
      samples: this.samples.length,
    };
  }

  /**
   * Force garbage collection (requires --expose-gc flag)
   */
  forceGC(): void {
    if (global.gc) {
      global.gc();
    } else {
      console.warn('GC not available. Run with --expose-gc flag');
    }
  }

  /**
   * Set memory limit
   */
  setMemoryLimit(limitMB: number): void {
    this.maxMemoryMB = limitMB;
  }

  /**
   * Get memory trend (increasing/stable/decreasing)
   */
  getTrend(): 'increasing' | 'stable' | 'decreasing' | 'unknown' {
    if (this.samples.length < 5) return 'unknown';

    const recent = this.samples.slice(-5);
    const increasing = recent.filter((s) => s.trend === 'increasing').length;
    const stable = recent.filter((s) => s.trend === 'stable').length;

    if (increasing >= 3) return 'increasing';
    if (stable >= 3) return 'stable';
    return 'decreasing';
  }
}
