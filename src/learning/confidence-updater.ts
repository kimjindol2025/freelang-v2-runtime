/**
 * FreeLang v2 - Confidence Updater (Task 4.2)
 * Intent 신뢰도 점수 동적 재계산
 * 피드백 기반 confidence 가중치 최적화
 */

import { FeedbackEntry, FeedbackStats } from '../feedback/feedback-types';
import { CONFIDENCE_WEIGHTS } from '../engine/intent-patterns';

export interface ConfidenceMetrics {
  operation: string;
  baseConfidence: number;
  adjustedConfidence: number;
  patternMatchWeight: number;
  typeInferenceWeight: number;
  intentClarityWeight: number;
  similarityWeight: number;
  adjustmentFactor: number;
  timestamp: number;
}

export interface ConfidenceAdjustment {
  operation: string;
  oldWeights: typeof CONFIDENCE_WEIGHTS;
  newWeights: typeof CONFIDENCE_WEIGHTS;
  deltaWeights: Record<string, number>;
  rationale: string;
  timestamp: number;
}

export class ConfidenceUpdater {
  private confidenceMetrics: Map<string, ConfidenceMetrics[]> = new Map();
  private adjustmentHistory: ConfidenceAdjustment[] = [];
  private currentWeights = { ...CONFIDENCE_WEIGHTS };

  /**
   * 피드백을 기반으로 신뢰도 가중치 업데이트
   *
   * 알고리즘:
   * 1. Operation별 신뢰도 통계 계산
   * 2. 정확도 vs 신뢰도 상관관계 분석
   * 3. 가중치 조정 (역학 기반)
   * 4. 조정 결과 히스토리에 기록
   *
   * @param feedbacks 수집된 피드백
   * @param stats 피드백 통계
   * @returns 조정된 신뢰도 메트릭
   */
  updateConfidenceWeights(
    feedbacks: FeedbackEntry[],
    stats: FeedbackStats
  ): ConfidenceMetrics[] {
    const metrics: ConfidenceMetrics[] = [];

    if (feedbacks.length === 0) {
      return metrics;
    }

    // 1. Operation별 분석
    const operationGroups = this._groupByOperation(feedbacks);

    for (const [operation, opFeedbacks] of operationGroups.entries()) {
      // 2. 신뢰도 메트릭 계산
      const metric = this._calculateMetrics(
        operation,
        opFeedbacks
      );
      metrics.push(metric);

      // 3. 가중치 조정 필요 여부 판단
      const shouldAdjust = this._shouldAdjustWeights(opFeedbacks);
      if (shouldAdjust) {
        const adjustment = this._adjustWeights(operation, opFeedbacks);
        this.adjustmentHistory.push(adjustment);
        this._recordMetrics(operation, metric);
      }
    }

    return metrics;
  }

  /**
   * Operation별 피드백 그룹화
   */
  private _groupByOperation(
    feedbacks: FeedbackEntry[]
  ): Map<string, FeedbackEntry[]> {
    const grouped = new Map<string, FeedbackEntry[]>();

    feedbacks.forEach((fb) => {
      const op = fb.proposal.operation;
      if (!grouped.has(op)) {
        grouped.set(op, []);
      }
      grouped.get(op)!.push(fb);
    });

    return grouped;
  }

  /**
   * 신뢰도 메트릭 계산
   */
  private _calculateMetrics(
    operation: string,
    feedbacks: FeedbackEntry[]
  ): ConfidenceMetrics {
    let totalConfidence = 0;
    let totalAccuracy = 0;
    let approvalCount = 0;

    feedbacks.forEach((fb) => {
      totalConfidence += fb.proposal.confidence;
      totalAccuracy += fb.analysis.accuracy;
      if (fb.userFeedback.action === 'approve') {
        approvalCount++;
      }
    });

    const baseConfidence = totalConfidence / feedbacks.length;
    const avgAccuracy = totalAccuracy / feedbacks.length;
    const approvalRate = approvalCount / feedbacks.length;

    // 신뢰도 조정 계수 계산 (정확도와의 상관도)
    const adjustmentFactor = this._calculateAdjustmentFactor(
      baseConfidence,
      avgAccuracy,
      approvalRate
    );

    const adjustedConfidence = Math.min(
      1,
      Math.max(0, baseConfidence + adjustmentFactor)
    );

    return {
      operation,
      baseConfidence,
      adjustedConfidence,
      patternMatchWeight: this.currentWeights.patternMatch,
      typeInferenceWeight: this.currentWeights.typeInference,
      intentClarityWeight: this.currentWeights.intentClarity,
      similarityWeight: this.currentWeights.similarity,
      adjustmentFactor,
      timestamp: Date.now(),
    };
  }

  /**
   * 신뢰도 조정 계수 계산
   */
  private _calculateAdjustmentFactor(
    confidence: number,
    accuracy: number,
    approvalRate: number
  ): number {
    const discrepancy = Math.abs(confidence - accuracy);

    if (discrepancy < 0.1) {
      // 신뢰도와 정확도가 일치하면 조정 불필요
      return 0;
    }

    if (confidence > accuracy) {
      // 신뢰도가 높지만 정확도가 낮음 → 페널티
      return -discrepancy * 0.5;
    } else {
      // 신뢰도가 낮지만 정확도가 높음 → 부스트
      return discrepancy * 0.3;
    }
  }

  /**
   * 가중치 조정 필요 여부 판단
   */
  private _shouldAdjustWeights(feedbacks: FeedbackEntry[]): boolean {
    if (feedbacks.length < 5) {
      return false; // 최소 5개 이상의 피드백 필요
    }

    let approvalCount = 0;
    let rejectionCount = 0;

    feedbacks.forEach((fb) => {
      if (fb.userFeedback.action === 'approve') {
        approvalCount++;
      } else if (fb.userFeedback.action === 'reject') {
        rejectionCount++;
      }
    });

    const approvalRate = approvalCount / feedbacks.length;
    const rejectionRate = rejectionCount / feedbacks.length;

    // 승인율이 극단적으로 높거나 낮으면 조정
    return approvalRate > 0.8 || rejectionRate > 0.3;
  }

  /**
   * 가중치 조정
   */
  private _adjustWeights(
    operation: string,
    feedbacks: FeedbackEntry[]
  ): ConfidenceAdjustment {
    const oldWeights = { ...this.currentWeights };
    const newWeights = { ...this.currentWeights };

    // 피드백 분석
    let strongPatternMatches = 0;
    let typeAccuracies = 0;
    let clarityScores = 0;

    feedbacks.forEach((fb) => {
      if (fb.userFeedback.action === 'approve') {
        strongPatternMatches++;
        typeAccuracies += 0.8;
        clarityScores += 0.9;
      } else if (fb.userFeedback.action === 'reject') {
        strongPatternMatches -= 0.3;
        typeAccuracies -= 0.5;
        clarityScores -= 0.4;
      }
    });

    const normalizer = feedbacks.length;

    // 가중치 재계산
    newWeights.patternMatch = Math.min(
      0.5,
      Math.max(0.2, 0.4 + strongPatternMatches / normalizer * 0.1)
    );
    newWeights.typeInference = Math.min(
      0.4,
      Math.max(0.1, 0.3 + typeAccuracies / normalizer * 0.1)
    );
    newWeights.intentClarity = Math.min(
      0.3,
      Math.max(0.1, 0.2 + clarityScores / normalizer * 0.1)
    );

    // similarity는 정규화
    const total =
      newWeights.patternMatch +
      newWeights.typeInference +
      newWeights.intentClarity;
    newWeights.similarity = 1 - total;

    this.currentWeights = newWeights;

    // 델타 계산
    const deltaWeights = {
      patternMatch: newWeights.patternMatch - oldWeights.patternMatch,
      typeInference: newWeights.typeInference - oldWeights.typeInference,
      intentClarity: newWeights.intentClarity - oldWeights.intentClarity,
      similarity: newWeights.similarity - oldWeights.similarity,
    };

    // 근거 생성
    const rationale = this._generateRationale(operation, feedbacks);

    return {
      operation,
      oldWeights,
      newWeights,
      deltaWeights,
      rationale,
      timestamp: Date.now(),
    };
  }

  /**
   * 근거 생성
   */
  private _generateRationale(
    operation: string,
    feedbacks: FeedbackEntry[]
  ): string {
    let approvalCount = 0;
    let rejectionCount = 0;

    feedbacks.forEach((fb) => {
      if (fb.userFeedback.action === 'approve') {
        approvalCount++;
      } else if (fb.userFeedback.action === 'reject') {
        rejectionCount++;
      }
    });

    if (approvalCount > rejectionCount) {
      return `${operation}: 높은 승인율(${approvalCount}/${feedbacks.length}) → 패턴 매칭 가중치 증가`;
    } else {
      return `${operation}: 높은 거부율(${rejectionCount}/${feedbacks.length}) → 신뢰도 기준값 재조정`;
    }
  }

  /**
   * 메트릭 기록
   */
  private _recordMetrics(operation: string, metric: ConfidenceMetrics): void {
    if (!this.confidenceMetrics.has(operation)) {
      this.confidenceMetrics.set(operation, []);
    }
    this.confidenceMetrics.get(operation)!.push(metric);
  }

  /**
   * 현재 가중치 조회
   */
  getCurrentWeights(): typeof CONFIDENCE_WEIGHTS {
    return { ...this.currentWeights };
  }

  /**
   * 신뢰도 메트릭 조회
   */
  getConfidenceMetrics(operation?: string): ConfidenceMetrics[] {
    if (operation) {
      return this.confidenceMetrics.get(operation) || [];
    }

    const all: ConfidenceMetrics[] = [];
    this.confidenceMetrics.forEach((metrics) => {
      all.push(...metrics);
    });
    return all;
  }

  /**
   * 조정 히스토리 조회
   */
  getAdjustmentHistory(): ConfidenceAdjustment[] {
    return [...this.adjustmentHistory];
  }

  /**
   * 신뢰도 보고서 생성
   */
  generateReport(): string {
    let report = '\n';
    report += '╔════════════════════════════════════════════════════╗\n';
    report += '║       📊 Confidence Updater Report                 ║\n';
    report += '╚════════════════════════════════════════════════════╝\n\n';

    report += '⚖️ 현재 가중치:\n';
    report += `  패턴 매칭: ${(this.currentWeights.patternMatch * 100).toFixed(1)}%\n`;
    report += `  타입 추론: ${(this.currentWeights.typeInference * 100).toFixed(1)}%\n`;
    report += `  명확성: ${(this.currentWeights.intentClarity * 100).toFixed(1)}%\n`;
    report += `  유사도: ${(this.currentWeights.similarity * 100).toFixed(1)}%\n\n`;

    report += '📈 조정 이력:\n';
    if (this.adjustmentHistory.length === 0) {
      report += '  조정 없음\n';
    } else {
      this.adjustmentHistory.slice(-5).forEach((adj) => {
        report += `  • ${adj.operation}: ${adj.rationale}\n`;
      });
    }

    return report;
  }
}
