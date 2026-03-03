/**
 * FreeLang v2 - Learning Engine (Task 4.4)
 * 통합 학습 엔진: PatternUpdater + ConfidenceUpdater + MetaLearner
 * 피드백 기반 자동 학습 및 개선 시스템
 */

import { FeedbackEntry, FeedbackStats } from '../feedback/feedback-types';
import { FeedbackStorage } from '../feedback/feedback-storage';
import { PatternUpdater, PatternUpdate, PatternStats } from './pattern-updater';
import {
  ConfidenceUpdater,
  ConfidenceMetrics,
  ConfidenceAdjustment,
} from './confidence-updater';
import { MetaLearner, LearningMetadata, LearningSession } from './meta-learner';

// Helper type conversion
function convertToPatternStats(operation: string, opStats: FeedbackStats['operationStats'][string] | undefined, currentTime: number): PatternStats {
  if (!opStats) {
    return {
      operation,
      totalFeedback: 0,
      approvalRate: 0,
      rejectionRate: 0,
      modificationRate: 0,
      avgAccuracy: 0,
      lastUpdated: currentTime,
    };
  }

  return {
    operation,
    totalFeedback: opStats.count,
    approvalRate: opStats.approvalRate,
    rejectionRate: Math.max(0, 1 - opStats.approvalRate),
    modificationRate: 0,
    avgAccuracy: opStats.averageAccuracy,
    lastUpdated: currentTime,
  };
}

export interface LearningEpoch {
  epochNumber: number;
  timestamp: number;
  feedbackProcessed: number;
  patternUpdates: PatternUpdate[];
  confidenceAdjustments: ConfidenceAdjustment[];
  learningMetadata: LearningMetadata[];
  overallProgress: number;
}

export interface LearningReport {
  totalEpochs: number;
  currentEpoch: number;
  overallProgress: number;
  operationsImproved: string[];
  operationsNeedingWork: string[];
  keyLearnings: string[];
  nextActions: string[];
  timestamp: number;
}

export class LearningEngine {
  private patternUpdater: PatternUpdater;
  private confidenceUpdater: ConfidenceUpdater;
  private metaLearner: MetaLearner;
  private feedbackStorage: FeedbackStorage;

  private epochHistory: LearningEpoch[] = [];
  private currentEpoch: number = 0;
  private isLearning: boolean = false;

  constructor(feedbackStorage: FeedbackStorage) {
    this.feedbackStorage = feedbackStorage;
    this.patternUpdater = new PatternUpdater();
    this.confidenceUpdater = new ConfidenceUpdater();
    this.metaLearner = new MetaLearner();
  }

  /**
   * 학습 에포크 실행
   *
   * 파이프라인:
   * 1. 피드백 수집
   * 2. 패턴 업데이트
   * 3. 신뢰도 재계산
   * 4. 학습 메타데이터 생성
   * 5. 결과 기록
   *
   * @returns 현재 에포크 데이터
   */
  async runLearningEpoch(): Promise<LearningEpoch> {
    if (this.isLearning) {
      throw new Error('Learning epoch already in progress');
    }

    this.isLearning = true;
    this.currentEpoch++;

    try {
      const epochData: LearningEpoch = {
        epochNumber: this.currentEpoch,
        timestamp: Date.now(),
        feedbackProcessed: 0,
        patternUpdates: [],
        confidenceAdjustments: [],
        learningMetadata: [],
        overallProgress: 0,
      };

      // 1. 피드백 수집
      const feedbacks = this.feedbackStorage.exportFeedbacks();
      const stats = this.feedbackStorage.calculateStats();

      epochData.feedbackProcessed = feedbacks.length;

      if (feedbacks.length === 0) {
        this.epochHistory.push(epochData);
        return epochData;
      }

      // 2. 패턴 업데이트
      const patternUpdates = this.patternUpdater.updatePatterns(feedbacks);
      epochData.patternUpdates = patternUpdates;

      // 3. 신뢰도 재계산
      const confidenceAdjustments: ConfidenceAdjustment[] = [];
      for (const [operation, opFeedbacks] of this._groupFeedbacksByOp(
        feedbacks
      ).entries()) {
        const opStats = this._getOperationStats(operation, stats);
        const metrics = this.confidenceUpdater.updateConfidenceWeights(
          opFeedbacks,
          opStats
        );

        // 신뢰도 조정이 있으면 기록
        if (metrics.length > 0) {
          confidenceAdjustments.push(
            ...this.confidenceUpdater.getAdjustmentHistory().slice(-5)
          );
        }
      }
      epochData.confidenceAdjustments = confidenceAdjustments;

      // 4. 학습 메타데이터 생성
      const learningMetadata: LearningMetadata[] = [];
      for (const [operation, opFeedbacks] of this._groupFeedbacksByOp(
        feedbacks
      ).entries()) {
        const opStatsData = stats.operationStats[operation];
        const patternStats = convertToPatternStats(operation, opStatsData, Date.now());

        const opUpdates = patternUpdates.filter(
          (u) => u.operation === operation
        );
        const opMetrics = this.confidenceUpdater.getConfidenceMetrics(
          operation
        );

        if (opUpdates.length > 0 || opMetrics.length > 0) {
          const metadata = this.metaLearner.generateLearningMetadata(
            operation,
            opUpdates,
            opMetrics,
            patternStats
          );
          learningMetadata.push(metadata);
        }
      }
      epochData.learningMetadata = learningMetadata;

      // 5. 전체 진행률 계산
      epochData.overallProgress = this.metaLearner.getOverallProgress();

      // 6. 히스토리 기록
      this.epochHistory.push(epochData);

      return epochData;
    } finally {
      this.isLearning = false;
    }
  }

  /**
   * Operation별로 피드백 그룹화
   */
  private _groupFeedbacksByOp(
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
   * Operation별 통계 추출
   */
  private _getOperationStats(
    operation: string,
    globalStats: FeedbackStats
  ): FeedbackStats {
    // 전체 통계에서 operation별 통계 추출
    const opStats = globalStats.operationStats[operation];

    return {
      totalFeedback: opStats?.count || 0,
      approved: Math.round((opStats?.approvalRate || 0) * (opStats?.count || 0)),
      modified: 0,
      rejected: 0,
      averageAccuracy: opStats?.averageAccuracy || 0,
      operationStats: {},
    };
  }

  /**
   * 학습 세션 시작
   */
  startLearningSession(sessionId: string): void {
    this.metaLearner.startSession(sessionId);
  }

  /**
   * 학습 세션 종료
   */
  endLearningSession(): void {
    this.metaLearner.endSession();
  }

  /**
   * 자동 학습 루프
   * 주기적으로 실행되어야 함 (타이머 기반)
   */
  async autoLearn(maxEpochs: number = 10): Promise<LearningEpoch[]> {
    const results: LearningEpoch[] = [];

    for (let i = 0; i < maxEpochs; i++) {
      const epoch = await this.runLearningEpoch();
      results.push(epoch);

      // 수렴 조건 확인
      if (epoch.overallProgress > 0.95) {
        break; // 충분히 수렴했으면 중단
      }

      // 피드백이 없으면 중단
      if (epoch.feedbackProcessed === 0) {
        break;
      }
    }

    return results;
  }

  /**
   * 에포크 히스토리 조회
   */
  getEpochHistory(): LearningEpoch[] {
    return [...this.epochHistory];
  }

  /**
   * 현재 학습 진행 상태
   */
  getCurrentStatus(): {
    currentEpoch: number;
    overallProgress: number;
    operationsLearned: number;
    estimatedCompletionEpoch: number;
  } {
    const latestEpoch = this.epochHistory[this.epochHistory.length - 1];

    return {
      currentEpoch: this.currentEpoch,
      overallProgress: latestEpoch?.overallProgress || 0,
      operationsLearned: latestEpoch?.learningMetadata.length || 0,
      estimatedCompletionEpoch: Math.ceil(this.currentEpoch / 0.9), // 90% 수렴 기준
    };
  }

  /**
   * 전체 학습 리포트 생성
   */
  generateLearningReport(): LearningReport {
    const status = this.getCurrentStatus();

    // 개선된 operation 식별
    const allMetadata = this.metaLearner.getLearningMetadata();
    const improved = allMetadata
      .filter((m) => m.improvementTrend === 'increasing')
      .map((m) => m.operation);

    // 개선 필요한 operation
    const needingWork = this.patternUpdater
      .getOperationsNeedingImprovement()
      .slice(0, 3);

    // 주요 학습 사항
    const keyLearnings: string[] = [];
    allMetadata.forEach((m) => {
      if (m.learningRate > 0.7) {
        keyLearnings.push(`${m.operation}: 빠른 학습 (${(m.learningRate * 100).toFixed(0)}%)`);
      }
    });

    // 다음 액션
    const nextActions: string[] = [];
    if (status.overallProgress < 0.7) {
      nextActions.push('더 많은 피드백 수집 필요');
    }
    if (needingWork.length > 0) {
      nextActions.push(`${needingWork[0]} 패턴 재검토`);
    }

    return {
      totalEpochs: this.currentEpoch,
      currentEpoch: status.currentEpoch,
      overallProgress: status.overallProgress,
      operationsImproved: [...new Set(improved)],
      operationsNeedingWork: needingWork,
      keyLearnings,
      nextActions,
      timestamp: Date.now(),
    };
  }

  /**
   * 상세 학습 리포트
   */
  generateDetailedReport(): string {
    let report = '\n';
    report += '╔════════════════════════════════════════════════════╗\n';
    report += '║         🧠 Learning Engine Detailed Report         ║\n';
    report += '╚════════════════════════════════════════════════════╝\n\n';

    const learningReport = this.generateLearningReport();

    report += `📊 학습 진행:\n`;
    report += `  총 에포크: ${learningReport.totalEpochs}\n`;
    report += `  전체 진행률: ${(learningReport.overallProgress * 100).toFixed(1)}%\n\n`;

    report += `✅ 개선된 Operation:\n`;
    if (learningReport.operationsImproved.length === 0) {
      report += `  아직 없음\n`;
    } else {
      learningReport.operationsImproved.forEach((op) => {
        report += `  • ${op}\n`;
      });
    }
    report += '\n';

    report += `⚠️  개선 필요 Operation:\n`;
    if (learningReport.operationsNeedingWork.length === 0) {
      report += `  모두 양호\n`;
    } else {
      learningReport.operationsNeedingWork.forEach((op) => {
        report += `  • ${op}\n`;
      });
    }
    report += '\n';

    report += `📈 주요 학습 사항:\n`;
    learningReport.keyLearnings.forEach((learning) => {
      report += `  • ${learning}\n`;
    });

    report += `\n🎯 다음 액션:\n`;
    learningReport.nextActions.forEach((action) => {
      report += `  • ${action}\n`;
    });

    return report;
  }
}
