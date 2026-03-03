/**
 * Phase 24.1: Benchmark Runner
 * Runs performance benchmarks and compares results
 *
 * Features:
 * - Function benchmarking
 * - Performance regression detection
 * - Statistical analysis
 * - Comparison reports
 */

export interface BenchmarkConfig {
  name: string;
  iterations: number;
  warmup_iterations?: number;
  timeout_ms?: number;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  total_time_ms: number;
  avg_time_ms: number;
  min_time_ms: number;
  max_time_ms: number;
  median_time_ms: number;
  std_dev_ms: number;
  throughput: number; // ops/sec
  timestamp: number;
}

export interface BenchmarkComparison {
  baseline: BenchmarkResult;
  current: BenchmarkResult;
  time_diff_percent: number;
  regression_detected: boolean;
  regression_threshold: number;
}

/**
 * Benchmark Runner
 * Executes and analyzes benchmarks
 */
export class BenchmarkRunner {
  private results: Map<string, BenchmarkResult[]> = new Map();
  private configs: Map<string, BenchmarkConfig> = new Map();

  constructor() {}

  /**
   * Register benchmark
   */
  registerBenchmark(config: BenchmarkConfig): void {
    this.configs.set(config.name, config);
    if (!this.results.has(config.name)) {
      this.results.set(config.name, []);
    }
  }

  /**
   * Run benchmark
   */
  async run(name: string, fn: () => Promise<void>): Promise<BenchmarkResult> {
    const config = this.configs.get(name);
    if (!config) {
      throw new Error(`Benchmark '${name}' not registered`);
    }

    // Warmup
    const warmup = config.warmup_iterations || 3;
    for (let i = 0; i < warmup; i++) {
      await fn();
    }

    // Actual benchmark
    const times: number[] = [];

    for (let i = 0; i < config.iterations; i++) {
      const start = performance.now();
      await fn();
      const duration = performance.now() - start;
      times.push(duration);
    }

    const result = this.calculateStats(name, config.iterations, times);
    const results_list = this.results.get(name) || [];
    results_list.push(result);
    this.results.set(name, results_list);

    return result;
  }

  /**
   * Run synchronous benchmark
   */
  runSync(name: string, fn: () => void): BenchmarkResult {
    const config = this.configs.get(name);
    if (!config) {
      throw new Error(`Benchmark '${name}' not registered`);
    }

    // Warmup
    const warmup = config.warmup_iterations || 3;
    for (let i = 0; i < warmup; i++) {
      fn();
    }

    // Actual benchmark
    const times: number[] = [];

    for (let i = 0; i < config.iterations; i++) {
      const start = performance.now();
      fn();
      const duration = performance.now() - start;
      times.push(duration);
    }

    const result = this.calculateStats(name, config.iterations, times);
    const results_list = this.results.get(name) || [];
    results_list.push(result);
    this.results.set(name, results_list);

    return result;
  }

  /**
   * Compare benchmarks
   */
  compare(name: string, baseline_index: number = -2, current_index: number = -1, threshold: number = 10): BenchmarkComparison | null {
    const results_list = this.results.get(name);
    if (!results_list || results_list.length < 2) {
      return null;
    }

    const baseline_idx = baseline_index < 0 ? results_list.length + baseline_index : baseline_index;
    const current_idx = current_index < 0 ? results_list.length + current_index : current_index;

    if (baseline_idx < 0 || current_idx < 0 || baseline_idx >= results_list.length || current_idx >= results_list.length) {
      return null;
    }

    const baseline = results_list[baseline_idx];
    const current = results_list[current_idx];

    const time_diff_percent = ((current.avg_time_ms - baseline.avg_time_ms) / baseline.avg_time_ms) * 100;
    const regression_detected = time_diff_percent > threshold;

    return {
      baseline,
      current,
      time_diff_percent,
      regression_detected,
      regression_threshold: threshold,
    };
  }

  /**
   * Get benchmark result
   */
  getResult(name: string, index: number = -1): BenchmarkResult | undefined {
    const results_list = this.results.get(name);
    if (!results_list) return undefined;

    const idx = index < 0 ? results_list.length + index : index;
    return idx >= 0 && idx < results_list.length ? results_list[idx] : undefined;
  }

  /**
   * Get all results for benchmark
   */
  getAllResults(name: string): BenchmarkResult[] {
    return this.results.get(name) || [];
  }

  /**
   * Get summary
   */
  getSummary() {
    const summary: Record<string, any> = {};

    for (const [name, results_list] of this.results.entries()) {
      if (results_list.length === 0) continue;

      const latest = results_list[results_list.length - 1];
      summary[name] = {
        latest,
        runs: results_list.length,
        best: results_list.reduce((min, r) => (r.avg_time_ms < min.avg_time_ms ? r : min)),
        worst: results_list.reduce((max, r) => (r.avg_time_ms > max.avg_time_ms ? r : max)),
      };
    }

    return summary;
  }

  /**
   * Detect regressions
   */
  detectRegressions(threshold: number = 10): BenchmarkComparison[] {
    const regressions: BenchmarkComparison[] = [];

    for (const name of this.results.keys()) {
      const comparison = this.compare(name, -2, -1, threshold);
      if (comparison && comparison.regression_detected) {
        regressions.push(comparison);
      }
    }

    return regressions;
  }

  /**
   * Export results
   */
  exportJSON() {
    const data: Record<string, any> = {};

    for (const [name, results_list] of this.results.entries()) {
      data[name] = results_list;
    }

    return {
      timestamp: Date.now(),
      benchmarks: data,
      summary: this.getSummary(),
    };
  }

  /**
   * Reset
   */
  reset(): void {
    this.results.clear();
    this.configs.clear();
  }

  /**
   * Private: Calculate statistics
   */
  private calculateStats(name: string, iterations: number, times: number[]): BenchmarkResult {
    const sorted = [...times].sort((a, b) => a - b);
    const total_time = times.reduce((sum, t) => sum + t, 0);
    const avg = total_time / iterations;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];

    // Calculate standard deviation
    const variance = times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / iterations;
    const std_dev = Math.sqrt(variance);

    // Throughput (operations per second)
    const throughput = (iterations / total_time) * 1000;

    return {
      name,
      iterations,
      total_time_ms: total_time,
      avg_time_ms: avg,
      min_time_ms: min,
      max_time_ms: max,
      median_time_ms: median,
      std_dev_ms: std_dev,
      throughput,
      timestamp: Date.now(),
    };
  }
}

export default { BenchmarkRunner };
