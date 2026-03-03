/**
 * FreeLang v2 - Meta Learner (Task 4.3)
 * 학습 메타데이터 생성 및 학습 효율성 분석
 * 어떤 패턴이 어떻게 개선되고 있는지 추적
 */

import { FeedbackEntry } from '../feedback/feedback-types';
import { PatternUpdate, PatternStats } from './pattern-updater';
import { ConfidenceMetrics, ConfidenceAdjustment } from './confidence-updater';

export interface LearningMetadata {
  operation: string;
  learningRate: number; // 개선 속도 (0-1)
  convergenceScore: number; // 수렴 정도 (0-1)
  stabilityScore: number; // 안정성 (0-1)
  improvementTrend: 'increasing' | 'decreasing' | 'stable';
  keywordEvolution: {
    added: string[];
    removed: string[];
    totalCount: number;
  };
  confidenceEvolution: {
    startValue: number;
    endValue: number;
    trend: 'up' | 'down' | 'stable';
  };
  predictedAccuracy: number;
  estimatedTimeToMastery: number; // 에포크 단위
  recommendations: string[];
  timestamp: number;
}

export interface LearningSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  feedbackCount: number;
  operationsLearned: string[];
  totalImprovement: number; // 0-1
  status: 'active' | 'completed';
}

export class MetaLearner {
  private learningHistory: Map<string, LearningMetadata[]> = new Map();
  private learningSessions: LearningSession[] = [];
  private currentSession: LearningSession | null = null;

  /**
   * 학습 세션 시작
   */
  startSession(sessionId: string): void {
    this.currentSession = {
      sessionId,
      startTime: Date.now(),
      feedbackCount: 0,
      operationsLearned: [],
      totalImprovement: 0,
      status: 'active',
    };
  }

  /**
   * 학습 메타데이터 생성
   *
   * 알고리즘:
   * 1. 패턴 업데이트와 신뢰도 변화 분석
   * 2. 학습 속도(learning rate) 계산
   * 3. 수렴도(convergence) 평가
   * 4. 안정성(stability) 평가
   * 5. 개선 추이 판단
   * 6. 마스터리까지의 예상 시간 계산
   *
   * @param operation Operation 이름
   * @param patternUpdates 패턴 업데이트 목록
   * @param confidenceMetrics 신뢰도 메트릭
   * @param patternStats 패턴 통계
   * @returns 학습 메타데이터
   */
  generateLearningMetadata(
    operation: string,
    patternUpdates: PatternUpdate[],
    confidenceMetrics: ConfidenceMetrics[],
    patternStats: PatternStats
  ): LearningMetadata {
    // 1. 학습 속도 계산
    const learningRate = this._calculateLearningRate(
      patternUpdates,
      patternStats
    );

    // 2. 수렴도 계산
    const convergenceScore = this._calculateConvergence(
      confidenceMetrics,
      patternStats
    );

    // 3. 안정성 계산
    const stabilityScore = this._calculateStability(
      confidenceMetrics,
      patternStats
    );

    // 4. 개선 추이
    const improvementTrend = this._analyzeImprovement(
      patternUpdates,
      patternStats
    );

    // 5. 키워드 진화
    const keywordEvolution = this._analyzeKeywordEvolution(patternUpdates);

    // 6. 신뢰도 진화
    const confidenceEvolution = this._analyzeConfidenceEvolution(
      confidenceMetrics
    );

    // 7. 예측 정확도
    const predictedAccuracy = this._predictAccuracy(
      patternStats,
      learningRate
    );

    // 8. 마스터리 추정 시간
    const estimatedTimeToMastery = this._estimateTimeToMastery(
      patternStats,
      learningRate
    );

    // 9. 권장사항
    const recommendations = this._generateRecommendations(
      operation,
      patternStats,
      learningRate,
      convergenceScore
    );

    const metadata: LearningMetadata = {
      operation,
      learningRate,
      convergenceScore,
      stabilityScore,
      improvementTrend,
      keywordEvolution,
      confidenceEvolution,
      predictedAccuracy,
      estimatedTimeToMastery,
      recommendations,
      timestamp: Date.now(),
    };

    this._recordMetadata(operation, metadata);
    if (this.currentSession && !this.currentSession.operationsLearned.includes(operation)) {
      this.currentSession.operationsLearned.push(operation);
    }

    return metadata;
  }

  /**
   * 학습 속도 계산
   */
  private _calculateLearningRate(
    patternUpdates: PatternUpdate[],
    patternStats: PatternStats
  ): number {
    if (patternUpdates.length === 0) {
      return 0;
    }

    // 최근 업데이트의 신뢰도 부스트 평균
    const recentUpdates = patternUpdates.slice(-5);
    const avgBoost = recentUpdates.reduce((sum, u) => sum + u.confidenceBoost, 0) /
      recentUpdates.length;

    // 승인율과의 조합
    const approvalInfluence = patternStats.approvalRate;

    // 학습 속도: 0-1 범위
    return Math.min(1, Math.max(0, (avgBoost + approvalInfluence) / 2));
  }

  /**
   * 수렴도 계산
   */
  private _calculateConvergence(
    confidenceMetrics: ConfidenceMetrics[],
    patternStats: PatternStats
  ): number {
    if (confidenceMetrics.length < 2) {
      return 0.5;
    }

    // 신뢰도의 표준편차 (낮을수록 수렴함)
    const confidences = confidenceMetrics.map((m) => m.adjustedConfidence);
    const mean = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const variance = confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) /
      confidences.length;
    const stdDev = Math.sqrt(variance);

    // 낮은 표준편차 = 높은 수렴도
    return Math.max(0, 1 - stdDev);
  }

  /**
   * 안정성 계산
   */
  private _calculateStability(
    confidenceMetrics: ConfidenceMetrics[],
    patternStats: PatternStats
  ): number {
    if (confidenceMetrics.length < 2) {
      return 0.5;
    }

    // 최근 메트릭의 변동성
    const recentMetrics = confidenceMetrics.slice(-5);
    const adjustments = recentMetrics.map((m) => Math.abs(m.adjustmentFactor));
    const avgAdjustment = adjustments.reduce((a, b) => a + b, 0) / adjustments.length;

    // 낮은 변동 = 높은 안정성
    const stabilityFromVariation = 1 - avgAdjustment;

    // 승인율의 일관성
    const rateConsistency = 1 - Math.abs(patternStats.approvalRate - patternStats.avgAccuracy);

    return (stabilityFromVariation + rateConsistency) / 2;
  }

  /**
   * 개선 추이 분석
   */
  private _analyzeImprovement(
    patternUpdates: PatternUpdate[],
    patternStats: PatternStats
  ): 'increasing' | 'decreasing' | 'stable' {
    if (patternUpdates.length < 2) {
      return 'stable';
    }

    const recent = patternUpdates.slice(-3);
    const boosts = recent.map((u) => u.confidenceBoost);
    const avgBoost = boosts.reduce((a, b) => a + b, 0) / boosts.length;

    if (avgBoost > 0.05) {
      return 'increasing';
    } else if (avgBoost < -0.05) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * 키워드 진화 분석
   */
  private _analyzeKeywordEvolution(patternUpdates: PatternUpdate[]): {
    added: string[];
    removed: string[];
    totalCount: number;
  } {
    const allAdded = new Set<string>();
    const allRemoved = new Set<string>();

    patternUpdates.forEach((u) => {
      u.newKeywords.forEach((kw) => allAdded.add(kw));
      u.removedKeywords.forEach((kw) => allRemoved.add(kw));
    });

    return {
      added: Array.from(allAdded),
      removed: Array.from(allRemoved),
      totalCount: patternUpdates.length,
    };
  }

  /**
   * 신뢰도 진화 분석
   */
  private _analyzeConfidenceEvolution(
    confidenceMetrics: ConfidenceMetrics[]
  ): {
    startValue: number;
    endValue: number;
    trend: 'up' | 'down' | 'stable';
  } {
    if (confidenceMetrics.length === 0) {
      return { startValue: 0, endValue: 0, trend: 'stable' };
    }

    const startValue = confidenceMetrics[0].baseConfidence;
    const endValue =
      confidenceMetrics[confidenceMetrics.length - 1].adjustedConfidence;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (endValue > startValue + 0.05) {
      trend = 'up';
    } else if (endValue < startValue - 0.05) {
      trend = 'down';
    }

    return { startValue, endValue, trend };
  }

  /**
   * 예측 정확도
   */
  private _predictAccuracy(
    patternStats: PatternStats,
    learningRate: number
  ): number {
    // 현재 정확도에 학습율을 고려한 향상도 추가
    const improvementPotential = Math.min(0.2, learningRate * 0.1);
    return Math.min(1, patternStats.avgAccuracy + improvementPotential);
  }

  /**
   * 마스터리까지의 예상 시간 계산
   */
  private _estimateTimeToMastery(
    patternStats: PatternStats,
    learningRate: number
  ): number {
    if (patternStats.approvalRate > 0.9) {
      return 0; // 이미 마스터
    }

    const targetApprovalRate = 0.95;
    const approvalGap = targetApprovalRate - patternStats.approvalRate;

    if (learningRate === 0) {
      return Infinity; // 진전 없음
    }

    // 현재 속도로 목표에 도달하는데 필요한 에포크
    const estimatedEpochs = Math.ceil(
      (approvalGap / learningRate) * 10
    );

    return Math.max(1, estimatedEpochs);
  }

  /**
   * 권장사항 생성
   */
  private _generateRecommendations(
    operation: string,
    patternStats: PatternStats,
    learningRate: number,
    convergenceScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (learningRate < 0.2) {
      recommendations.push(
        `${operation}: 학습 속도가 느림 → 패턴 DB 재검토 추천`
      );
    }

    if (convergenceScore < 0.5) {
      recommendations.push(
        `${operation}: 수렴도가 낮음 → 신뢰도 기준값 조정 필요`
      );
    }

    if (patternStats.rejectionRate > 0.3) {
      recommendations.push(
        `${operation}: 거부율이 높음 → 키워드 재구성 추천`
      );
    }

    if (learningRate > 0.6 && convergenceScore > 0.7) {
      recommendations.push(
        `${operation}: 학습이 순조로움 → 현재 설정 유지`
      );
    }

    return recommendations;
  }

  /**
   * 메타데이터 기록
   */
  private _recordMetadata(operation: string, metadata: LearningMetadata): void {
    if (!this.learningHistory.has(operation)) {
      this.learningHistory.set(operation, []);
    }
    this.learningHistory.get(operation)!.push(metadata);
  }

  /**
   * 학습 세션 종료
   */
  endSession(): void {
    if (this.currentSession) {
      this.currentSession.endTime = Date.now();
      this.currentSession.status = 'completed';
      this.learningSessions.push(this.currentSession);
      this.currentSession = null;
    }
  }

  /**
   * 학습 메타데이터 조회
   */
  getLearningMetadata(operation?: string): LearningMetadata[] {
    if (operation) {
      return this.learningHistory.get(operation) || [];
    }

    const all: LearningMetadata[] = [];
    this.learningHistory.forEach((metadata) => {
      all.push(...metadata);
    });
    return all;
  }

  /**
   * 학습 세션 조회
   */
  getLearningSessions(): LearningSession[] {
    return [...this.learningSessions];
  }

  /**
   * 전체 학습 진행률
   */
  getOverallProgress(): number {
    const allMetadata = this.getLearningMetadata();
    if (allMetadata.length === 0) {
      return 0;
    }

    const avgConvergence = allMetadata.reduce((sum, m) => sum + m.convergenceScore, 0) /
      allMetadata.length;
    return avgConvergence;
  }

  /**
   * 학습 리포트 생성
   */
  generateReport(): string {
    let report = '\n';
    report += '╔════════════════════════════════════════════════════╗\n';
    report += '║            🧠 Meta Learner Report                  ║\n';
    report += '╚════════════════════════════════════════════════════╝\n\n';

    report += `전체 학습 진행률: ${(this.getOverallProgress() * 100).toFixed(1)}%\n\n`;

    report += '📚 학습 세션:\n';
    report += `  총 세션: ${this.learningSessions.length}\n`;
    if (this.currentSession) {
      report += `  현재 세션: ${this.currentSession.operationsLearned.length}개 학습 중\n`;
    }
    report += '\n';

    report += '🎯 Operation별 학습 현황:\n';
    for (const [op, metadata] of Array.from(this.learningHistory.entries()).slice(-5)) {
      const latest = metadata[metadata.length - 1];
      report += `  ${op}:\n`;
      report += `    - 학습 속도: ${(latest.learningRate * 100).toFixed(1)}%\n`;
      report += `    - 수렴도: ${(latest.convergenceScore * 100).toFixed(1)}%\n`;
      report += `    - 예상 정확도: ${(latest.predictedAccuracy * 100).toFixed(1)}%\n`;
    }

    return report;
  }
}
