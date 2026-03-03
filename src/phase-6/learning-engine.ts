/**
 * Phase 6.2 Week 4: LearningEngine
 *
 * AI 자율학습 엔진:
 * - 패턴 자동 추출
 * - 성능 데이터 분석
 * - 유사도 기반 추천
 * - 신뢰도 계산
 */

import { ExecutionResult } from './smart-repl';
import { PerformanceAnalysis } from './performance-analyzer';

/**
 * 학습된 패턴
 */
export interface LearnedPattern {
  id: string;
  code: string;
  keywords: string[];
  executionCount: number;
  successRate: number;
  averageTime: number;
  averageMemory: number;
  confidence: number;  // 0-1
  timestamp: number;
}

/**
 * 패턴 유사도
 */
export interface PatternSimilarity {
  patternId: string;
  code: string;
  similarity: number;  // 0-1
  reason: string;
}

/**
 * 학습 통계
 */
export interface LearningStats {
  totalPatterns: number;
  totalExecutions: number;
  averageSuccessRate: number;
  topPatterns: LearnedPattern[];
  learningTrend: number;  // 신뢰도 개선율
  lastUpdated: number;
}

/**
 * LearningEngine: 실행 패턴 자동 학습
 */
export class LearningEngine {
  private patterns: Map<string, LearnedPattern> = new Map();
  private executionHistory: Array<{
    code: string;
    result: ExecutionResult;
    timestamp: number;
  }> = [];
  private readonly maxPatterns = 500;
  private readonly maxHistory = 10000;

  constructor() {
    this.patterns = new Map();
    this.executionHistory = [];
  }

  /**
   * 실행 결과로부터 패턴 학습
   */
  learn(code: string, result: ExecutionResult): LearnedPattern {
    const patternId = this.generatePatternId(code);
    const keywords = this.extractKeywords(code);

    let pattern = this.patterns.get(patternId);

    if (pattern) {
      // 기존 패턴 업데이트
      pattern.executionCount++;
      pattern.successRate =
        (pattern.successRate * (pattern.executionCount - 1) +
          (result.success ? 1 : 0)) /
        pattern.executionCount;
      pattern.averageTime =
        (pattern.averageTime * (pattern.executionCount - 1) +
          result.executionTime) /
        pattern.executionCount;
      pattern.averageMemory =
        (pattern.averageMemory * (pattern.executionCount - 1) +
          result.memory) /
        pattern.executionCount;
      pattern.confidence = Math.min(
        1,
        pattern.successRate * (1 + Math.log(pattern.executionCount) / 10)
      );
      pattern.timestamp = Date.now();
    } else {
      // 새 패턴 생성
      pattern = {
        id: patternId,
        code,
        keywords,
        executionCount: 1,
        successRate: result.success ? 1 : 0,
        averageTime: result.executionTime,
        averageMemory: result.memory,
        confidence: result.success ? 0.5 : 0.1,
        timestamp: Date.now(),
      };
      this.patterns.set(patternId, pattern);
    }

    // 히스토리 기록
    this.executionHistory.push({
      code,
      result,
      timestamp: Date.now(),
    });

    // 최대 크기 초과 시 제거
    if (this.executionHistory.length > this.maxHistory) {
      this.executionHistory.shift();
    }
    if (this.patterns.size > this.maxPatterns) {
      this.removeLowestConfidencePattern();
    }

    return pattern;
  }

  /**
   * 코드 유사도 계산
   */
  calculateSimilarity(code1: string, code2: string): number {
    const tokens1 = new Set(this.tokenize(code1));
    const tokens2 = new Set(this.tokenize(code2));

    const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
  }

  /**
   * 유사한 패턴 찾기
   */
  findSimilarPatterns(code: string, limit: number = 5): PatternSimilarity[] {
    const similarities: PatternSimilarity[] = [];

    for (const [, pattern] of this.patterns) {
      const similarity = this.calculateSimilarity(code, pattern.code);

      if (similarity > 0) {
        similarities.push({
          patternId: pattern.id,
          code: pattern.code,
          similarity,
          reason: this.generateSimilarityReason(code, pattern.code, similarity),
        });
      }
    }

    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, limit);
  }

  /**
   * 패턴 기반 추천
   */
  recommendImprovement(
    code: string
  ): {
    pattern: LearnedPattern;
    improvement: string;
    confidenceGain: number;
  }[] {
    const similar = this.findSimilarPatterns(code, 3);
    const recommendations: {
      pattern: LearnedPattern;
      improvement: string;
      confidenceGain: number;
    }[] = [];

    for (const sim of similar) {
      const pattern = this.patterns.get(sim.patternId);
      if (!pattern) continue;

      const currentCode = code;
      const betterCode = pattern.code;

      recommendations.push({
        pattern,
        improvement: `패턴: ${betterCode}\n신뢰도: ${(pattern.confidence * 100).toFixed(1)}%\n성공률: ${(pattern.successRate * 100).toFixed(1)}%`,
        confidenceGain: pattern.confidence - 0.5,
      });
    }

    recommendations.sort((a, b) => b.confidenceGain - a.confidenceGain);
    return recommendations;
  }

  /**
   * 학습 통계
   */
  getStats(): LearningStats {
    const patterns = Array.from(this.patterns.values());

    if (patterns.length === 0) {
      return {
        totalPatterns: 0,
        totalExecutions: 0,
        averageSuccessRate: 0,
        topPatterns: [],
        learningTrend: 0,
        lastUpdated: 0,
      };
    }

    const totalExecutions = patterns.reduce((sum, p) => sum + p.executionCount, 0);
    const avgSuccessRate =
      patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length;

    // 상위 5개 패턴
    const topPatterns = [...patterns]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    // 학습 추세: 최근과 과거 신뢰도 비교
    const recentPatterns = patterns.filter(
      (p) => Date.now() - p.timestamp < 3600000
    ); // 1시간 이내
    const oldPatterns = patterns.filter(
      (p) => Date.now() - p.timestamp >= 3600000
    );

    const recentAvgConf =
      recentPatterns.length > 0
        ? recentPatterns.reduce((sum, p) => sum + p.confidence, 0) /
          recentPatterns.length
        : 0;
    const oldAvgConf =
      oldPatterns.length > 0
        ? oldPatterns.reduce((sum, p) => sum + p.confidence, 0) /
          oldPatterns.length
        : 0;

    const learningTrend = recentAvgConf - oldAvgConf;

    return {
      totalPatterns: patterns.length,
      totalExecutions,
      averageSuccessRate: avgSuccessRate,
      topPatterns,
      learningTrend,
      lastUpdated: Date.now(),
    };
  }

  /**
   * 패턴 추출 (내부)
   */
  private extractKeywords(code: string): string[] {
    const tokens = this.tokenize(code);
    return [...new Set(tokens)].slice(0, 10);
  }

  /**
   * 토큰화 (내부)
   */
  private tokenize(code: string): string[] {
    return code
      .toLowerCase()
      .split(/[\s\(\)\[\]\{\},;:=+\-*/]/)
      .filter((token) => token.length > 0);
  }

  /**
   * 패턴 ID 생성 (내부)
   */
  private generatePatternId(code: string): string {
    const tokens = this.tokenize(code).slice(0, 5);
    return tokens.join('-') || `pattern-${Date.now()}`;
  }

  /**
   * 유사성 이유 생성 (내부)
   */
  private generateSimilarityReason(
    code1: string,
    code2: string,
    similarity: number
  ): string {
    if (similarity > 0.8) return '거의 동일한 패턴';
    if (similarity > 0.6) return '유사한 구조';
    if (similarity > 0.4) return '관련 패턴';
    return '약간의 관련성';
  }

  /**
   * 최저 신뢰도 패턴 제거 (내부)
   */
  private removeLowestConfidencePattern(): void {
    let lowestId: string | null = null;
    let lowestConfidence = 1;

    for (const [id, pattern] of this.patterns) {
      if (pattern.confidence < lowestConfidence) {
        lowestConfidence = pattern.confidence;
        lowestId = id;
      }
    }

    if (lowestId) {
      this.patterns.delete(lowestId);
    }
  }

  /**
   * 패턴 목록
   */
  listPatterns(): LearnedPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * 패턴 초기화
   */
  reset(): void {
    this.patterns.clear();
    this.executionHistory = [];
  }

  /**
   * 히스토리 조회
   */
  getHistory(limit: number = 100): Array<{
    code: string;
    result: ExecutionResult;
    timestamp: number;
  }> {
    return this.executionHistory.slice(-limit);
  }

  /**
   * 패턴별 성공률 추이
   */
  getSuccessRateTrend(patternId: string): number[] {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return [];

    return this.executionHistory
      .filter((h) => this.generatePatternId(h.code) === patternId)
      .map((h) => (h.result.success ? 1 : 0));
  }
}

/**
 * 글로벌 인스턴스
 */
export const globalLearningEngine = new LearningEngine();
