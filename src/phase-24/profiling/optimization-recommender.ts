/**
 * Phase 24.1: Optimization Recommender
 * Analyzes performance data and provides optimization suggestions
 *
 * Features:
 * - Hotspot analysis
 * - Memory leak detection
 * - Cache analysis
 * - Concurrency recommendations
 */

export type RecommendationType =
  | 'HOTSPOT'
  | 'MEMORY_LEAK'
  | 'CACHE_MISS'
  | 'SERIALIZATION'
  | 'CONCURRENCY'
  | 'ALGORITHM'
  | 'DATABASE';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Recommendation {
  type: RecommendationType;
  severity: SeverityLevel;
  title: string;
  description: string;
  function_name?: string;
  estimated_improvement: number; // percent improvement
  implementation_effort: string; // LOW, MEDIUM, HIGH
  code_example?: string;
}

export interface PerformanceIssue {
  type: string;
  value: number;
  threshold: number;
  status: 'OK' | 'WARNING' | 'CRITICAL';
}

/**
 * Optimization Recommender
 * Provides optimization recommendations
 */
export class OptimizationRecommender {
  private hotspot_threshold: number = 0.1; // 10% of total time
  private memory_growth_threshold: number = 20; // 20% growth
  private cache_hit_threshold: number = 0.8; // 80% hit rate
  private recommendations: Recommendation[] = [];

  constructor() {}

  /**
   * Analyze hotspots
   */
  analyzeHotspots(function_profiles: Record<string, any>[]): Recommendation[] {
    const recs: Recommendation[] = [];
    const total_time = function_profiles.reduce((sum, p) => sum + (p.total_time_ms || 0), 0);

    for (const profile of function_profiles) {
      const ratio = (profile.total_time_ms || 0) / total_time;

      if (ratio > this.hotspot_threshold) {
        const severity = ratio > 0.3 ? 'CRITICAL' : ratio > 0.2 ? 'HIGH' : 'MEDIUM';

        recs.push({
          type: 'HOTSPOT',
          severity: severity as SeverityLevel,
          title: `Hotspot detected: ${profile.name}`,
          description: `Function '${profile.name}' consumes ${(ratio * 100).toFixed(1)}% of total execution time`,
          function_name: profile.name,
          estimated_improvement: Math.min(ratio * 50, 40), // Up to 40% improvement
          implementation_effort: 'MEDIUM',
          code_example: `// Consider:\n// - Caching results\n// - Using faster algorithm\n// - Parallelizing`,
        });
      }
    }

    return recs;
  }

  /**
   * Analyze memory usage
   */
  analyzeMemory(memory_stats: Record<string, any>): Recommendation[] {
    const recs: Recommendation[] = [];

    // Check for leaks
    if (memory_stats.potential_leaks && memory_stats.potential_leaks.length > 0) {
      for (const leak of memory_stats.potential_leaks) {
        recs.push({
          type: 'MEMORY_LEAK',
          severity: leak.growth_rate > 50 ? 'CRITICAL' : 'HIGH',
          title: `Potential memory leak: ${leak.type}`,
          description: `Type '${leak.type}' is growing at ${leak.growth_rate.toFixed(1)}% per GC cycle`,
          estimated_improvement: 30,
          implementation_effort: 'MEDIUM',
          code_example: `// Check for:\n// - Unclosed resources\n// - Circular references\n// - Event listener cleanup`,
        });
      }
    }

    // Check heap usage
    if (memory_stats.current_usage && memory_stats.current_usage.total_size > 100 * 1024 * 1024) {
      recs.push({
        type: 'MEMORY_LEAK',
        severity: 'HIGH',
        title: 'High heap usage detected',
        description: `Current heap usage is ${(memory_stats.current_usage.total_size / (1024 * 1024)).toFixed(1)}MB`,
        estimated_improvement: 20,
        implementation_effort: 'HIGH',
        code_example: `// Consider:\n// - Using object pools\n// - Reducing data structures\n// - Streaming large data`,
      });
    }

    return recs;
  }

  /**
   * Analyze concurrency
   */
  analyzeConcurrency(function_profiles: Record<string, any>[]): Recommendation[] {
    const recs: Recommendation[] = [];

    // Find long-running functions that could be parallelized
    const long_running = function_profiles.filter((p) => (p.total_time_ms || 0) > 1000);

    for (const profile of long_running) {
      if (profile.call_count > 1 && profile.total_time_ms / profile.call_count > 100) {
        recs.push({
          type: 'CONCURRENCY',
          severity: 'MEDIUM',
          title: `Parallelization opportunity: ${profile.name}`,
          description: `Function '${profile.name}' is called ${profile.call_count} times and takes significant time per call`,
          function_name: profile.name,
          estimated_improvement: 50, // Potential 50% improvement with 2-core parallelization
          implementation_effort: 'HIGH',
          code_example: `// Consider:\n// - Using thread pools\n// - Async/await patterns\n// - Work queues`,
        });
      }
    }

    return recs;
  }

  /**
   * Analyze algorithms
   */
  analyzeAlgorithms(function_profiles: Record<string, any>[]): Recommendation[] {
    const recs: Recommendation[] = [];

    // Detect potentially inefficient algorithms by call patterns
    for (const profile of function_profiles) {
      // Functions with high call count and high total time
      if ((profile.call_count || 0) > 1000 && (profile.total_time_ms || 0) > 100) {
        const avg_per_call = (profile.total_time_ms || 0) / (profile.call_count || 1);

        if (avg_per_call > 10) {
          recs.push({
            type: 'ALGORITHM',
            severity: 'HIGH',
            title: `Inefficient algorithm: ${profile.name}`,
            description: `Function '${profile.name}' is called frequently (${profile.call_count} times) with high per-call time (${avg_per_call.toFixed(2)}ms)`,
            function_name: profile.name,
            estimated_improvement: 40,
            implementation_effort: 'HIGH',
            code_example: `// Consider:\n// - Using more efficient algorithm (e.g., binary search instead of linear)\n// - Caching intermediate results\n// - Precomputing values`,
          });
        }
      }
    }

    return recs;
  }

  /**
   * Get recommendations
   */
  getRecommendations(data: Record<string, any>): Recommendation[] {
    const recs: Recommendation[] = [];

    // Analyze different aspects
    if (data.function_profiles) {
      recs.push(...this.analyzeHotspots(data.function_profiles));
      recs.push(...this.analyzeConcurrency(data.function_profiles));
      recs.push(...this.analyzeAlgorithms(data.function_profiles));
    }

    if (data.memory_stats) {
      recs.push(...this.analyzeMemory(data.memory_stats));
    }

    // Sort by severity
    const severity_order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    recs.sort((a, b) => severity_order[a.severity] - severity_order[b.severity]);

    this.recommendations = recs;
    return recs;
  }

  /**
   * Get top recommendations
   */
  getTopRecommendations(limit: number = 5): Recommendation[] {
    return this.recommendations
      .sort((a, b) => b.estimated_improvement - a.estimated_improvement)
      .slice(0, limit);
  }

  /**
   * Generate report
   */
  generateReport(): string {
    let report = '# Performance Optimization Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += '## Recommendations Summary\n';
    report += `Total recommendations: ${this.recommendations.length}\n\n`;

    const by_severity = {
      CRITICAL: this.recommendations.filter((r) => r.severity === 'CRITICAL').length,
      HIGH: this.recommendations.filter((r) => r.severity === 'HIGH').length,
      MEDIUM: this.recommendations.filter((r) => r.severity === 'MEDIUM').length,
      LOW: this.recommendations.filter((r) => r.severity === 'LOW').length,
    };

    report += `- Critical: ${by_severity.CRITICAL}\n`;
    report += `- High: ${by_severity.HIGH}\n`;
    report += `- Medium: ${by_severity.MEDIUM}\n`;
    report += `- Low: ${by_severity.LOW}\n\n`;

    report += '## Detailed Recommendations\n\n';

    for (const rec of this.recommendations.slice(0, 10)) {
      report += `### ${rec.title}\n`;
      report += `**Severity:** ${rec.severity}\n`;
      report += `**Type:** ${rec.type}\n`;
      report += `**Estimated Improvement:** ${rec.estimated_improvement}%\n`;
      report += `**Effort:** ${rec.implementation_effort}\n`;
      report += `\n${rec.description}\n`;

      if (rec.code_example) {
        report += `\n\`\`\`\n${rec.code_example}\n\`\`\`\n`;
      }

      report += '\n---\n\n';
    }

    return report;
  }

  /**
   * Export recommendations
   */
  exportJSON() {
    return {
      timestamp: Date.now(),
      recommendations: this.recommendations,
      summary: {
        total: this.recommendations.length,
        by_severity: {
          CRITICAL: this.recommendations.filter((r) => r.severity === 'CRITICAL').length,
          HIGH: this.recommendations.filter((r) => r.severity === 'HIGH').length,
          MEDIUM: this.recommendations.filter((r) => r.severity === 'MEDIUM').length,
          LOW: this.recommendations.filter((r) => r.severity === 'LOW').length,
        },
        by_type: Object.fromEntries(
          Array.from(
            new Set(this.recommendations.map((r) => r.type)).values()
          ).map((type) => [
            type,
            this.recommendations.filter((r) => r.type === type).length,
          ])
        ),
      },
    };
  }

  /**
   * Reset
   */
  reset(): void {
    this.recommendations = [];
  }
}

export default { OptimizationRecommender };
