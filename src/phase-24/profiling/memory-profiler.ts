/**
 * Phase 24.1: Memory Profiler
 * Tracks memory allocation and detects leaks
 *
 * Features:
 * - Heap snapshot creation
 * - Allocation tracking
 * - Memory leak detection
 * - GC statistics
 */

export interface MemoryAllocation {
  id: string;
  size: number;
  type: string;
  timestamp: number;
  stack_trace?: string;
}

export interface HeapSnapshot {
  timestamp: number;
  total_size: number;
  object_count: number;
  allocations: MemoryAllocation[];
  gc_stats: GCStatistics;
}

export interface GCStatistics {
  collections_run: number;
  total_freed: number;
  last_collection_time: number;
  avg_collection_time: number;
}

export interface LeakCandidate {
  type: string;
  size: number;
  count: number;
  growth_rate: number; // Percent growth per collection
}

/**
 * Memory Profiler
 * Tracks memory usage and detects leaks
 */
export class MemoryProfiler {
  private allocations: Map<string, MemoryAllocation> = new Map();
  private snapshots: HeapSnapshot[] = [];
  private gc_stats: GCStatistics = {
    collections_run: 0,
    total_freed: 0,
    last_collection_time: 0,
    avg_collection_time: 0,
  };
  private allocation_counter: number = 0;
  private tracking_enabled: boolean = false;

  constructor() {}

  /**
   * Enable tracking
   */
  enableTracking(): void {
    this.tracking_enabled = true;
  }

  /**
   * Disable tracking
   */
  disableTracking(): void {
    this.tracking_enabled = false;
  }

  /**
   * Record allocation
   */
  recordAllocation(size: number, type: string, stack_trace?: string): string {
    if (!this.tracking_enabled) return '';

    const id = `alloc-${this.allocation_counter++}`;
    const allocation: MemoryAllocation = {
      id,
      size,
      type,
      timestamp: Date.now(),
      stack_trace,
    };

    this.allocations.set(id, allocation);
    return id;
  }

  /**
   * Record deallocation
   */
  recordDeallocation(id: string): void {
    this.allocations.delete(id);
  }

  /**
   * Create heap snapshot
   */
  createSnapshot(): HeapSnapshot {
    const allocations = Array.from(this.allocations.values());
    const total_size = allocations.reduce((sum, a) => sum + a.size, 0);

    const snapshot: HeapSnapshot = {
      timestamp: Date.now(),
      total_size,
      object_count: allocations.length,
      allocations,
      gc_stats: { ...this.gc_stats },
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Get current memory usage
   */
  getCurrentUsage() {
    const allocations = Array.from(this.allocations.values());
    const total_size = allocations.reduce((sum, a) => sum + a.size, 0);

    return {
      total_size,
      object_count: allocations.length,
      allocations_by_type: this.groupByType(allocations),
    };
  }

  /**
   * Detect memory leaks
   */
  detectLeaks(threshold_growth: number = 20): LeakCandidate[] {
    if (this.snapshots.length < 2) return [];

    const leaks: LeakCandidate[] = [];
    const latest = this.snapshots[this.snapshots.length - 1];
    const previous = this.snapshots[Math.max(0, this.snapshots.length - 2)];

    const type_sizes_latest = this.groupByType(latest.allocations);
    const type_sizes_previous = this.groupByType(previous.allocations);

    for (const [type, size_latest] of Object.entries(type_sizes_latest)) {
      const size_previous = type_sizes_previous[type] || 0;
      const growth = ((size_latest - size_previous) / Math.max(size_previous, 1)) * 100;

      if (growth >= threshold_growth) {
        leaks.push({
          type,
          size: size_latest,
          count: latest.allocations.filter((a) => a.type === type).length,
          growth_rate: growth,
        });
      }
    }

    return leaks.sort((a, b) => b.growth_rate - a.growth_rate);
  }

  /**
   * Simulate garbage collection
   */
  simulateGarbageCollection(): number {
    const start_time = performance.now();

    // Mark unreachable allocations
    const reachable = new Set<string>();
    const to_visit = Array.from(this.allocations.keys()).slice(0, Math.ceil(this.allocations.size * 0.8));

    for (const id of to_visit) {
      reachable.add(id);
    }

    // Sweep unreachable
    let freed = 0;
    for (const [id, alloc] of this.allocations.entries()) {
      if (!reachable.has(id)) {
        freed += alloc.size;
        this.allocations.delete(id);
      }
    }

    const collection_time = performance.now() - start_time;
    this.gc_stats.collections_run++;
    this.gc_stats.total_freed += freed;
    this.gc_stats.last_collection_time = collection_time;

    // Update average
    this.gc_stats.avg_collection_time =
      this.gc_stats.total_freed > 0
        ? this.gc_stats.total_freed / this.gc_stats.collections_run
        : 0;

    return freed;
  }

  /**
   * Get memory statistics
   */
  getStats() {
    const usage = this.getCurrentUsage();
    const leaks = this.detectLeaks();

    return {
      current_usage: usage,
      total_allocations: this.allocation_counter,
      snapshot_count: this.snapshots.length,
      gc_stats: this.gc_stats,
      potential_leaks: leaks,
    };
  }

  /**
   * Compare snapshots
   */
  compareSnapshots(index1: number, index2: number) {
    if (index1 >= this.snapshots.length || index2 >= this.snapshots.length) {
      return null;
    }

    const snap1 = this.snapshots[index1];
    const snap2 = this.snapshots[index2];

    const types1 = this.groupByType(snap1.allocations);
    const types2 = this.groupByType(snap2.allocations);

    const diff: Record<string, number> = {};

    for (const type of new Set([...Object.keys(types1), ...Object.keys(types2)])) {
      diff[type] = (types2[type] || 0) - (types1[type] || 0);
    }

    return {
      time_diff_ms: snap2.timestamp - snap1.timestamp,
      size_diff: snap2.total_size - snap1.total_size,
      object_count_diff: snap2.object_count - snap1.object_count,
      type_diffs: diff,
    };
  }

  /**
   * Export data
   */
  exportJSON() {
    return {
      timestamp: Date.now(),
      current_usage: this.getCurrentUsage(),
      snapshots: this.snapshots,
      gc_stats: this.gc_stats,
    };
  }

  /**
   * Reset profiler
   */
  reset(): void {
    this.allocations.clear();
    this.snapshots = [];
    this.gc_stats = {
      collections_run: 0,
      total_freed: 0,
      last_collection_time: 0,
      avg_collection_time: 0,
    };
    this.allocation_counter = 0;
  }

  /**
   * Private: Group allocations by type
   */
  private groupByType(allocations: MemoryAllocation[]): Record<string, number> {
    const result: Record<string, number> = {};

    for (const alloc of allocations) {
      result[alloc.type] = (result[alloc.type] || 0) + alloc.size;
    }

    return result;
  }
}

export default { MemoryProfiler };
