/**
 * Phase 9: Memory Monitoring
 *
 * 메모리 관리:
 * - memoryUsage() 추적
 * - 메모리 리포트
 * - GC 통계
 * - 메모리 경고
 * - 성능 프로파일링
 */

import * as os from 'os';

/**
 * 메모리 사용량
 */
export interface MemoryUsage {
  rss: number; // Resident Set Size (bytes)
  heapTotal: number; // Total heap size (bytes)
  heapUsed: number; // Used heap size (bytes)
  external: number; // External memory (bytes)
  arrayBuffers: number; // ArrayBuffer memory (bytes)
}

/**
 * 메모리 리포트
 */
export interface MemoryReport {
  timestamp: Date;
  process: MemoryUsage;
  system: {
    totalMemory: number;
    freeMemory: number;
    usedMemory: number;
  };
  percentages: {
    heapUsagePercent: number;
    systemUsagePercent: number;
  };
}

/**
 * 메모리 스냅샷
 */
export interface MemorySnapshot {
  timestamp: Date;
  heapUsed: number;
  rss: number;
}

/**
 * 메모리 모니터
 */
export class MemoryMonitor {
  private snapshots: MemorySnapshot[] = [];
  private warnings: Array<{ timestamp: Date; message: string; severity: 'warn' | 'error' }> = [];
  private thresholds = {
    heapUsagePercent: 90, // 경고 임계값
    heapGrowthMB: 100, // 증가량 임계값
  };

  /**
   * 현재 메모리 사용량
   */
  static getMemoryUsage(): MemoryUsage {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers || 0,
    };
  }

  /**
   * 시스템 메모리
   */
  static getSystemMemory(): { totalMemory: number; freeMemory: number } {
    return {
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
    };
  }

  /**
   * 메모리 리포트 (상세)
   */
  static getReport(): MemoryReport {
    const processMemory = this.getMemoryUsage();
    const systemMemory = this.getSystemMemory();
    const usedMemory = systemMemory.totalMemory - systemMemory.freeMemory;

    const heapUsagePercent = (processMemory.heapUsed / processMemory.heapTotal) * 100;
    const systemUsagePercent = (usedMemory / systemMemory.totalMemory) * 100;

    return {
      timestamp: new Date(),
      process: processMemory,
      system: {
        totalMemory: systemMemory.totalMemory,
        freeMemory: systemMemory.freeMemory,
        usedMemory,
      },
      percentages: {
        heapUsagePercent,
        systemUsagePercent,
      },
    };
  }

  /**
   * 메모리를 읽기 쉬운 형식으로 변환
   */
  static formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 스냅샷 기록
   */
  recordSnapshot(): void {
    const memory = MemoryMonitor.getMemoryUsage();
    this.snapshots.push({
      timestamp: new Date(),
      heapUsed: memory.heapUsed,
      rss: memory.rss,
    });

    // 최근 1000개만 유지
    if (this.snapshots.length > 1000) {
      this.snapshots.shift();
    }

    // 경고 확인
    this.checkThresholds();
  }

  /**
   * 임계값 확인
   */
  private checkThresholds(): void {
    const report = MemoryMonitor.getReport();

    if (report.percentages.heapUsagePercent > this.thresholds.heapUsagePercent) {
      this.warnings.push({
        timestamp: new Date(),
        message: `Heap usage at ${report.percentages.heapUsagePercent.toFixed(1)}%`,
        severity: 'warn',
      });
    }

    if (this.snapshots.length > 1) {
      const recent = this.snapshots[this.snapshots.length - 1];
      const previous = this.snapshots[this.snapshots.length - 2];
      const growthMB = (recent.heapUsed - previous.heapUsed) / (1024 * 1024);

      if (growthMB > this.thresholds.heapGrowthMB) {
        this.warnings.push({
          timestamp: new Date(),
          message: `Heap growth ${growthMB.toFixed(2)} MB`,
          severity: 'warn',
        });
      }
    }
  }

  /**
   * 메모리 증가 추이
   */
  getMemoryTrend(): {
    startTime: Date;
    endTime: Date;
    startHeap: number;
    endHeap: number;
    growthMB: number;
    growthPercent: number;
    duration: number;
  } | null {
    if (this.snapshots.length < 2) return null;

    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];

    const growthBytes = last.heapUsed - first.heapUsed;
    const growthMB = growthBytes / (1024 * 1024);
    const growthPercent = (growthBytes / first.heapUsed) * 100;

    return {
      startTime: first.timestamp,
      endTime: last.timestamp,
      startHeap: first.heapUsed,
      endHeap: last.heapUsed,
      growthMB,
      growthPercent,
      duration: last.timestamp.getTime() - first.timestamp.getTime(),
    };
  }

  /**
   * 경고 목록
   */
  getWarnings(): Array<{ timestamp: Date; message: string; severity: 'warn' | 'error' }> {
    return this.warnings;
  }

  /**
   * 경고 초기화
   */
  clearWarnings(): void {
    this.warnings = [];
  }

  /**
   * 스냅샷 초기화
   */
  clearSnapshots(): void {
    this.snapshots = [];
  }

  /**
   * 임계값 설정
   */
  setThreshold(type: 'heapUsagePercent' | 'heapGrowthMB', value: number): void {
    this.thresholds[type] = value;
  }
}

/**
 * 성능 프로파일러
 */
export class PerformanceProfiler {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number[]> = new Map();

  /**
   * 시작 마크
   */
  start(label: string): void {
    this.marks.set(label, performance.now());
  }

  /**
   * 종료 마크
   */
  end(label: string): number {
    const startTime = this.marks.get(label);
    if (!startTime) {
      console.warn(`No start mark for ${label}`);
      return 0;
    }

    const duration = performance.now() - startTime;

    if (!this.measures.has(label)) {
      this.measures.set(label, []);
    }
    this.measures.get(label)!.push(duration);

    this.marks.delete(label);
    return duration;
  }

  /**
   * 평균 시간
   */
  getAverage(label: string): number {
    const durations = this.measures.get(label) || [];
    if (durations.length === 0) return 0;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }

  /**
   * 통계
   */
  getStats(label: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    total: number;
  } | null {
    const durations = this.measures.get(label);
    if (!durations || durations.length === 0) return null;

    return {
      count: durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      total: durations.reduce((a, b) => a + b, 0),
    };
  }

  /**
   * 모든 통계
   */
  getAllStats(): Map<string, any> {
    const stats = new Map();
    for (const [label, durations] of this.measures.entries()) {
      stats.set(label, {
        count: durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
        total: durations.reduce((a, b) => a + b, 0),
      });
    }
    return stats;
  }
}

/**
 * 테스트 함수
 */
export function testMemoryMonitoring(): void {
  console.log('=== Memory Monitoring Tests ===\n');

  // 1. 메모리 사용량
  console.log('1️⃣ Memory Usage:');
  const usage = MemoryMonitor.getMemoryUsage();
  console.log(`   RSS: ${MemoryMonitor.formatBytes(usage.rss)}`);
  console.log(`   Heap Total: ${MemoryMonitor.formatBytes(usage.heapTotal)}`);
  console.log(`   Heap Used: ${MemoryMonitor.formatBytes(usage.heapUsed)}`);

  // 2. 시스템 메모리
  console.log('\n2️⃣ System Memory:');
  const systemMem = MemoryMonitor.getSystemMemory();
  console.log(`   Total: ${MemoryMonitor.formatBytes(systemMem.totalMemory)}`);
  console.log(`   Free: ${MemoryMonitor.formatBytes(systemMem.freeMemory)}`);

  // 3. 리포트
  console.log('\n3️⃣ Memory Report:');
  const report = MemoryMonitor.getReport();
  console.log(`   Heap Usage: ${report.percentages.heapUsagePercent.toFixed(1)}%`);
  console.log(`   System Usage: ${report.percentages.systemUsagePercent.toFixed(1)}%`);

  // 4. 모니터 (스냅샷 기록)
  console.log('\n4️⃣ Memory Monitor:');
  const monitor = new MemoryMonitor();
  monitor.recordSnapshot();
  console.log(`   ✅ Snapshot recorded`);

  // 메모리 할당 후 다시 기록
  const arr = new Array(10000).fill(0);
  monitor.recordSnapshot();
  console.log(`   ✅ Snapshot after allocation`);

  const trend = monitor.getMemoryTrend();
  if (trend) {
    console.log(`   Growth: ${trend.growthMB.toFixed(2)} MB (${trend.growthPercent.toFixed(1)}%)`);
  }

  // 5. 성능 프로파일러
  console.log('\n5️⃣ Performance Profiler:');
  const profiler = new PerformanceProfiler();

  profiler.start('task1');
  for (let i = 0; i < 1000000; i++) {
    Math.sqrt(i);
  }
  const duration1 = profiler.end('task1');
  console.log(`   Task1: ${duration1.toFixed(2)}ms`);

  profiler.start('task2');
  const arr2 = new Array(100000).fill(0).map((_, i) => i * 2);
  const duration2 = profiler.end('task2');
  console.log(`   Task2: ${duration2.toFixed(2)}ms`);

  const stats = profiler.getStats('task1');
  if (stats) {
    console.log(`   Task1 Stats: count=${stats.count}, avg=${stats.avg.toFixed(2)}ms`);
  }

  console.log('\n✅ All memory monitoring tests completed!');
}
