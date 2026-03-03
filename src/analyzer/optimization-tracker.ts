/**
 * Phase 5 Step 3: Optimization Learning Tracker
 *
 * 철학: 최적화 적용 결과를 측정하고 학습 데이터로 축적
 * - Before/After 성능 비교
 * - 의사결정 정확도 평가
 * - 다음 라운드 학습 데이터로 활용
 */

import { Inst, VMResult } from '../types';
import { OptimizationDecision } from './optimization-applier';
import { VM } from '../vm';

/**
 * 최적화 실행 결과
 */
export interface OptimizationResult {
  decision: OptimizationDecision;
  before: {
    cycles: number;
    ms: number;
    value: unknown;
  };
  after: {
    cycles: number;
    ms: number;
    value: unknown;
  };
  effectiveness: {
    cycles_reduced: number; // 음수 = 느려짐
    cycles_improvement_pct: number; // 0.0~1.0
    time_reduced: number; // ms
    time_improvement_pct: number; // 0.0~1.0
    correctness: boolean; // 결과가 같은가?
    was_effective: boolean; // 전체적으로 개선되었는가?
  };
}

/**
 * 최적화 추적 엔진
 */
export class OptimizationTracker {
  private vm: VM;
  private results: OptimizationResult[] = [];

  constructor() {
    this.vm = new VM();
  }

  /**
   * 최적화 전후 성능 비교
   */
  measure(
    decision: OptimizationDecision,
    beforeIR: Inst[],
    afterIR: Inst[]
  ): OptimizationResult {
    // Before: 최적화 전 실행
    const beforeResult = this.vm.run(beforeIR);

    // After: 최적화 후 실행
    const afterResult = this.vm.run(afterIR);

    // 효율성 계산
    const cyclesReduced = beforeResult.cycles - afterResult.cycles;
    const cyclesImprovement = beforeResult.cycles > 0
      ? cyclesReduced / beforeResult.cycles
      : 0;

    const timeReduced = beforeResult.ms - afterResult.ms;
    const timeImprovement = beforeResult.ms > 0
      ? timeReduced / beforeResult.ms
      : 0;

    // 정확성 확인 (결과가 동일한가)
    const correctness = this.valuesEqual(beforeResult.value, afterResult.value);

    // 전체 효율성 평가
    // 1. 결과가 동일해야 함
    // 2. 사이클이 감소했어야 함
    // 3. 시간이 감소했어야 함
    const wasEffective = correctness && cyclesReduced > 0 && timeReduced > 0;

    const result: OptimizationResult = {
      decision,
      before: {
        cycles: beforeResult.cycles,
        ms: beforeResult.ms,
        value: beforeResult.value,
      },
      after: {
        cycles: afterResult.cycles,
        ms: afterResult.ms,
        value: afterResult.value,
      },
      effectiveness: {
        cycles_reduced: cyclesReduced,
        cycles_improvement_pct: cyclesImprovement,
        time_reduced: timeReduced,
        time_improvement_pct: timeImprovement,
        correctness,
        was_effective: wasEffective,
      },
    };

    this.results.push(result);
    return result;
  }

  /**
   * 여러 최적화 결과 측정
   */
  measureAll(
    decisions: OptimizationDecision[],
    beforeIR: Inst[],
    afterIR: Inst[]
  ): OptimizationResult[] {
    return decisions.map(decision => this.measure(decision, beforeIR, afterIR));
  }

  /**
   * 결과 분석: 어떤 최적화가 실제로 도움이 되었는가?
   */
  analyzeEffectiveness(): {
    total_optimizations: number;
    effective_count: number;
    ineffective_count: number;
    avg_cycles_improvement: number;
    avg_time_improvement: number;
    correctness_rate: number;
    most_effective: OptimizationResult | null;
    least_effective: OptimizationResult | null;
  } {
    if (this.results.length === 0) {
      return {
        total_optimizations: 0,
        effective_count: 0,
        ineffective_count: 0,
        avg_cycles_improvement: 0,
        avg_time_improvement: 0,
        correctness_rate: 0,
        most_effective: null,
        least_effective: null,
      };
    }

    const effective = this.results.filter(r => r.effectiveness.was_effective);
    const avgCycles = this.results.reduce((sum, r) => sum + r.effectiveness.cycles_improvement_pct, 0) / this.results.length;
    const avgTime = this.results.reduce((sum, r) => sum + r.effectiveness.time_improvement_pct, 0) / this.results.length;
    const correctRate = this.results.filter(r => r.effectiveness.correctness).length / this.results.length;

    // 가장 효과 좋은 것과 나쁜 것
    const sorted = [...this.results].sort(
      (a, b) => (b.effectiveness.cycles_improvement_pct + b.effectiveness.time_improvement_pct) -
                 (a.effectiveness.cycles_improvement_pct + a.effectiveness.time_improvement_pct)
    );

    return {
      total_optimizations: this.results.length,
      effective_count: effective.length,
      ineffective_count: this.results.length - effective.length,
      avg_cycles_improvement: avgCycles,
      avg_time_improvement: avgTime,
      correctness_rate: correctRate,
      most_effective: sorted[0] || null,
      least_effective: sorted[this.results.length - 1] || null,
    };
  }

  /**
   * 최적화 타입별 성공률
   */
  successRateByType(): Record<string, { successful: number; total: number; rate: number }> {
    const byType: Record<string, { successful: number; total: number }> = {};

    for (const result of this.results) {
      const type = result.decision.suggestion.type;
      if (!byType[type]) {
        byType[type] = { successful: 0, total: 0 };
      }
      byType[type].total++;
      if (result.effectiveness.was_effective) {
        byType[type].successful++;
      }
    }

    const output: Record<string, { successful: number; total: number; rate: number }> = {};
    for (const [type, counts] of Object.entries(byType)) {
      output[type] = {
        ...counts,
        rate: counts.total > 0 ? counts.successful / counts.total : 0,
      };
    }

    return output;
  }

  /**
   * 학습 데이터 생성 (Learner.record()에 사용)
   */
  toLearningData(): Array<{
    optimization_type: string;
    was_effective: boolean;
    cycles_improvement_pct: number;
    time_improvement_pct: number;
    decision_confidence: number;
    actual_correctness: boolean;
  }> {
    return this.results.map(r => ({
      optimization_type: r.decision.suggestion.type,
      was_effective: r.effectiveness.was_effective,
      cycles_improvement_pct: r.effectiveness.cycles_improvement_pct,
      time_improvement_pct: r.effectiveness.time_improvement_pct,
      decision_confidence: r.decision.confidence,
      actual_correctness: r.effectiveness.correctness,
    }));
  }

  /**
   * 결과 요약
   */
  summarize(): string {
    const analysis = this.analyzeEffectiveness();
    const byType = this.successRateByType();

    let summary = '🎯 Optimization Learning Summary\n';
    summary += `   Total optimizations: ${analysis.total_optimizations}\n`;
    summary += `   Effective: ${analysis.effective_count}\n`;
    summary += `   Ineffective: ${analysis.ineffective_count}\n`;
    summary += `   Correctness rate: ${(analysis.correctness_rate * 100).toFixed(1)}%\n\n`;

    summary += `Performance Improvements:\n`;
    summary += `   Avg cycles improvement: ${(analysis.avg_cycles_improvement * 100).toFixed(1)}%\n`;
    summary += `   Avg time improvement: ${(analysis.avg_time_improvement * 100).toFixed(1)}%\n\n`;

    if (Object.keys(byType).length > 0) {
      summary += `Success rate by type:\n`;
      for (const [type, stats] of Object.entries(byType)) {
        summary += `   ${type}: ${stats.successful}/${stats.total} (${(stats.rate * 100).toFixed(0)}%)\n`;
      }
    }

    if (analysis.most_effective) {
      summary += `\nMost effective: ${analysis.most_effective.decision.suggestion.type} `;
      summary += `(${(analysis.most_effective.effectiveness.cycles_improvement_pct * 100).toFixed(1)}% cycles, `;
      summary += `${(analysis.most_effective.effectiveness.time_improvement_pct * 100).toFixed(1)}% time)\n`;
    }

    return summary;
  }

  /**
   * 두 값이 같은가?
   */
  private valuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((v, i) => v === b[i]);
    }
    return false;
  }

  /**
   * 모든 결과 반환
   */
  getResults(): OptimizationResult[] {
    return [...this.results];
  }

  /**
   * 결과 초기화
   */
  reset(): void {
    this.results = [];
  }
}

/**
 * 편의 함수
 */
export function trackOptimization(
  decision: OptimizationDecision,
  beforeIR: Inst[],
  afterIR: Inst[]
): OptimizationResult {
  const tracker = new OptimizationTracker();
  return tracker.measure(decision, beforeIR, afterIR);
}
