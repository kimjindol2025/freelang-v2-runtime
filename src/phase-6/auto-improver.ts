/**
 * Phase 6.2 Week 4: AutoImprover
 *
 * 자동 코드 개선:
 * - 패턴 기반 개선 제안
 * - 성능 최적화 제안
 * - 신뢰도 기반 순위 매김
 * - 학습 강화
 */

import { LearningEngine, LearnedPattern } from './learning-engine';
import { ErrorAnalyzer } from './error-analyzer';
import { PerformanceAnalyzer, PerformanceAnalysis } from './performance-analyzer';
import { ExecutionResult } from './smart-repl';

/**
 * 개선 제안
 */
export interface ImprovementSuggestion {
  id: string;
  type: 'performance' | 'reliability' | 'pattern' | 'safety';
  title: string;
  description: string;
  suggestedCode: string;
  confidence: number;  // 0-1
  expectedImprovement: {
    time?: number;      // 예상 시간 단축 (%)
    memory?: number;    // 예상 메모리 감소 (%)
    reliability?: number;  // 예상 신뢰도 개선 (%)
  };
  reasoning: string;
}

/**
 * 개선 결과
 */
export interface ImprovementResult {
  originalCode: string;
  suggestedCode: string;
  suggestion: ImprovementSuggestion;
  estimatedGain: number;  // 0-1, 전체 개선도
}

/**
 * AutoImprover: 자동 코드 개선
 */
export class AutoImprover {
  private learningEngine: LearningEngine;
  private errorAnalyzer: ErrorAnalyzer;
  private performanceAnalyzer: PerformanceAnalyzer;
  private improvementHistory: ImprovementResult[] = [];

  constructor(
    learningEngine?: LearningEngine,
    errorAnalyzer?: ErrorAnalyzer,
    performanceAnalyzer?: PerformanceAnalyzer
  ) {
    this.learningEngine = learningEngine || new LearningEngine();
    this.errorAnalyzer = errorAnalyzer || new ErrorAnalyzer();
    this.performanceAnalyzer = performanceAnalyzer || new PerformanceAnalyzer();
  }

  /**
   * 코드 개선 제안 생성
   */
  suggest(code: string): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];

    // 1. 패턴 기반 제안
    const patternSuggestions = this.suggestFromPatterns(code);
    suggestions.push(...patternSuggestions);

    // 2. 신뢰도 기반 제안
    const reliabilitySuggestions = this.suggestForReliability(code);
    suggestions.push(...reliabilitySuggestions);

    // 3. 성능 기반 제안
    const performanceSuggestions = this.suggestForPerformance(code);
    suggestions.push(...performanceSuggestions);

    // 신뢰도 순으로 정렬
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions;
  }

  /**
   * 패턴 기반 제안 (내부)
   */
  private suggestFromPatterns(code: string): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];
    const recommendations = this.learningEngine.recommendImprovement(code);

    for (const rec of recommendations) {
      suggestions.push({
        id: `pattern-${rec.pattern.id}`,
        type: 'pattern',
        title: `패턴 매칭: ${rec.pattern.id}`,
        description: rec.improvement,
        suggestedCode: rec.pattern.code,
        confidence: rec.pattern.confidence,
        expectedImprovement: {
          time: (1 - rec.pattern.averageTime / 10) * 100,
          reliability: rec.pattern.successRate * 100,
        },
        reasoning: `신뢰도 ${(rec.pattern.confidence * 100).toFixed(1)}%, 성공률 ${(rec.pattern.successRate * 100).toFixed(1)}%인 패턴과 유사`,
      });
    }

    return suggestions;
  }

  /**
   * 신뢰도 기반 제안 (내부)
   */
  private suggestForReliability(code: string): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];
    const errorStats = this.errorAnalyzer.getStats();

    if (errorStats.mostCommonError && errorStats.mostCommonError.confidence > 0.5) {
      const advice = this.errorAnalyzer.getAvoidanceAdvice(
        errorStats.mostCommonError.type
      );

      suggestions.push({
        id: `reliability-${Date.now()}`,
        type: 'reliability',
        title: `오류 회피: ${errorStats.mostCommonError.type}`,
        description: `가장 흔한 오류 패턴: ${errorStats.mostCommonError.description}`,
        suggestedCode: this.generateSafetyWrapper(code),
        confidence: errorStats.mostCommonError.confidence,
        expectedImprovement: {
          reliability: Math.min(100, (1 - errorStats.mostCommonError.confidence) * 100),
        },
        reasoning: `${errorStats.totalErrors}번 발생한 오류 패턴을 기반으로 안전성 개선 제안`,
      });

      // 회피 전략
      if (advice.length > 0) {
        suggestions.push({
          id: `strategy-${Date.now()}`,
          type: 'safety',
          title: '회피 전략',
          description: advice.join(' | '),
          suggestedCode: code,  // 원본 코드에 주석 추가 버전
          confidence: 0.7,
          expectedImprovement: {
            reliability: 20,
          },
          reasoning: `${errorStats.mostCommonError.type} 오류 회피 전략`,
        });
      }
    }

    return suggestions;
  }

  /**
   * 성능 기반 제안 (내부)
   */
  private suggestForPerformance(code: string): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];
    const perfAnalysis = this.performanceAnalyzer.analyze();

    if (perfAnalysis.bottlenecks.length > 0) {
      const bottleneck = perfAnalysis.bottlenecks[0];

      suggestions.push({
        id: `performance-${Date.now()}`,
        type: 'performance',
        title: `성능 최적화: ${bottleneck.type}`,
        description: bottleneck.description,
        suggestedCode: this.generateOptimizedCode(code, bottleneck.type),
        confidence: Math.max(0.6, 1 - perfAnalysis.bottlenecks.length / 10),
        expectedImprovement: {
          time:
            bottleneck.type === 'time'
              ? Math.min(50, perfAnalysis.bottlenecks.length * 10)
              : 0,
          memory:
            bottleneck.type === 'memory'
              ? Math.min(50, perfAnalysis.bottlenecks.length * 10)
              : 0,
        },
        reasoning: bottleneck.suggestion,
      });
    }

    return suggestions;
  }

  /**
   * 안전성 래퍼 생성 (내부)
   */
  private generateSafetyWrapper(code: string): string {
    return `// Safety-wrapped version
try {
  ${code.split('\n').join('\n  ')}
} catch (error) {
  console.error('Error:', error);
  return null;
}`;
  }

  /**
   * 최적화된 코드 생성 (내부)
   */
  private generateOptimizedCode(code: string, bottleneckType: string): string {
    if (bottleneckType === 'memory') {
      return `// Memory-optimized version (use iterators instead of arrays)
${code.replace(/\[.*?\]/g, 'iterator(...)')}`;
    } else if (bottleneckType === 'time') {
      return `// Time-optimized version (consider caching)
const cache = new Map();
${code}`;
    }
    return code;
  }

  /**
   * 개선 제안 적용 (시뮬레이션)
   */
  applySuggestion(
    originalCode: string,
    suggestion: ImprovementSuggestion
  ): ImprovementResult {
    const result: ImprovementResult = {
      originalCode,
      suggestedCode: suggestion.suggestedCode,
      suggestion,
      estimatedGain: this.calculateEstimatedGain(suggestion),
    };

    this.improvementHistory.push(result);
    return result;
  }

  /**
   * 예상 개선도 계산
   */
  private calculateEstimatedGain(suggestion: ImprovementSuggestion): number {
    let gain = 0;

    if (suggestion.expectedImprovement.time) {
      gain += suggestion.expectedImprovement.time / 100;
    }
    if (suggestion.expectedImprovement.memory) {
      gain += suggestion.expectedImprovement.memory / 100;
    }
    if (suggestion.expectedImprovement.reliability) {
      gain += suggestion.expectedImprovement.reliability / 100;
    }

    return Math.min(1, gain * suggestion.confidence);
  }

  /**
   * 개선 히스토리
   */
  getHistory(limit: number = 100): ImprovementResult[] {
    return this.improvementHistory.slice(-limit);
  }

  /**
   * 누적 개선도
   */
  getCumulativeGain(): number {
    if (this.improvementHistory.length === 0) return 0;

    const totalGain = this.improvementHistory.reduce(
      (sum, result) => sum + result.estimatedGain,
      0
    );
    return Math.min(1, totalGain / this.improvementHistory.length);
  }

  /**
   * 개선 리포트
   */
  generateReport(): string {
    const cumulativeGain = this.getCumulativeGain();
    const learningStats = this.learningEngine.getStats();
    const errorStats = this.errorAnalyzer.getStats();

    return `
╔════════════════════════════════════════════════════════════╗
║        Auto-Improvement Report                             ║
╚════════════════════════════════════════════════════════════╝

📈 Overall Improvement
  Cumulative Gain: ${(cumulativeGain * 100).toFixed(1)}%
  Suggestions Applied: ${this.improvementHistory.length}

🎓 Learning Statistics
  Learned Patterns: ${learningStats.totalPatterns}
  Total Executions: ${learningStats.totalExecutions}
  Avg Success Rate: ${(learningStats.averageSuccessRate * 100).toFixed(1)}%
  Learning Trend: ${(learningStats.learningTrend * 100).toFixed(1)}%

🛡️  Error Analysis
  Total Errors: ${errorStats.totalErrors}
  Unique Types: ${errorStats.uniqueErrorTypes}
  Success Rate: ${errorStats.successRate.toFixed(1)}%
  Error Reduction: ${(errorStats.errorTrend * 100).toFixed(1)}%

🏆 Top Improvements
${this.improvementHistory
  .slice(-3)
  .map((result) => `  - ${result.suggestion.title}: ${(result.estimatedGain * 100).toFixed(1)}%`)
  .join('\n')}
    `.trim();
  }

  /**
   * 초기화
   */
  reset(): void {
    this.improvementHistory = [];
  }
}

/**
 * 글로벌 인스턴스
 */
export const globalAutoImprover = new AutoImprover();
