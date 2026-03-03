/**
 * FreeLang v2 - 피드백 저장소
 * 피드백 저장, 조회, 통계 계산
 */

import { FeedbackEntry, Session, FeedbackStats, ConfidenceTrend } from './feedback-types';

/**
 * 피드백 저장소 (in-memory + JSON)
 * 프로덕션은 SQLite 권장
 */
export class FeedbackStorage {
  private feedbacks: Map<string, FeedbackEntry>;
  private sessions: Map<string, Session>;

  constructor() {
    this.feedbacks = new Map();
    this.sessions = new Map();
  }

  /**
   * 피드백 저장
   *
   * @param feedback 피드백 항목
   * @returns 저장 성공 여부
   */
  saveFeedback(feedback: FeedbackEntry): boolean {
    try {
      this.feedbacks.set(feedback.id, feedback);

      // 세션 업데이트
      if (!this.sessions.has(feedback.sessionId)) {
        this.sessions.set(feedback.sessionId, {
          id: feedback.sessionId,
          startTime: feedback.timestamp,
          feedbackCount: 0,
          tags: [],
        });
      }

      const session = this.sessions.get(feedback.sessionId)!;
      session.feedbackCount++;
      if (feedback.metadata.tags) {
        session.tags = [...new Set([...session.tags, ...feedback.metadata.tags])];
      }

      return true;
    } catch (error) {
      console.error('피드백 저장 실패:', error);
      return false;
    }
  }

  /**
   * 피드백 조회 (ID)
   */
  getFeedback(id: string): FeedbackEntry | null {
    return this.feedbacks.get(id) || null;
  }

  /**
   * 세션별 피드백 조회
   */
  getFeedbackBySession(sessionId: string): FeedbackEntry[] {
    return Array.from(this.feedbacks.values()).filter(
      f => f.sessionId === sessionId
    );
  }

  /**
   * Operation별 피드백 조회
   */
  getFeedbackByOperation(operation: string): FeedbackEntry[] {
    return Array.from(this.feedbacks.values()).filter(
      f => f.proposal.operation === operation
    );
  }

  /**
   * 액션별 피드백 조회
   */
  getFeedbackByAction(
    action: 'approve' | 'modify' | 'reject' | 'suggest'
  ): FeedbackEntry[] {
    return Array.from(this.feedbacks.values()).filter(
      f => f.userFeedback.action === action
    );
  }

  /**
   * 전체 통계 계산
   */
  calculateStats(): FeedbackStats {
    const feedbacks = Array.from(this.feedbacks.values());

    const stats: FeedbackStats = {
      totalFeedback: feedbacks.length,
      approved: 0,
      modified: 0,
      rejected: 0,
      averageAccuracy: 0,
      operationStats: {},
    };

    if (feedbacks.length === 0) {
      return stats;
    }

    // 액션별 계산
    let totalAccuracy = 0;

    feedbacks.forEach(fb => {
      switch (fb.userFeedback.action) {
        case 'approve':
          stats.approved++;
          break;
        case 'modify':
          stats.modified++;
          break;
        case 'reject':
          stats.rejected++;
          break;
      }

      totalAccuracy += fb.analysis.accuracy;

      // Operation별 통계
      const op = fb.proposal.operation;
      if (!stats.operationStats[op]) {
        stats.operationStats[op] = {
          count: 0,
          approvalRate: 0,
          averageAccuracy: 0,
        };
      }

      const opStats = stats.operationStats[op];
      opStats.count++;
      opStats.averageAccuracy = (opStats.averageAccuracy * (opStats.count - 1) +
        fb.analysis.accuracy) / opStats.count;

      if (fb.userFeedback.action === 'approve') {
        opStats.approvalRate = (opStats.approvalRate * (opStats.count - 1) + 1) / opStats.count;
      }
    });

    stats.averageAccuracy = totalAccuracy / feedbacks.length;

    return stats;
  }

  /**
   * Operation별 신뢰도 추이 분석
   */
  getConfidenceTrend(operation: string): ConfidenceTrend | null {
    const feedbacks = this.getFeedbackByOperation(operation)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (feedbacks.length === 0) {
      return null;
    }

    const timePoints = feedbacks.map(f => f.timestamp);
    const confidences = feedbacks.map(f => f.proposal.confidence);

    // 추이 판단
    const firstHalf = confidences.slice(0, Math.floor(confidences.length / 2));
    const secondHalf = confidences.slice(Math.floor(confidences.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (secondAvg > firstAvg + 0.05) trend = 'increasing';
    if (secondAvg < firstAvg - 0.05) trend = 'decreasing';

    return {
      operation,
      timePoints,
      confidences,
      trend,
    };
  }

  /**
   * 가장 승인이 많이 된 operation
   */
  getMostApprovedOperation(): string | null {
    const stats = this.calculateStats();
    const operations = Object.entries(stats.operationStats);

    if (operations.length === 0) return null;

    let maxOp = operations[0][0];
    let maxRate = operations[0][1].approvalRate;

    for (const [op, stat] of operations) {
      if (stat.approvalRate > maxRate) {
        maxOp = op;
        maxRate = stat.approvalRate;
      }
    }

    return maxOp;
  }

  /**
   * 개선이 필요한 operation
   */
  getNeedsImprovementOperations(): string[] {
    const stats = this.calculateStats();
    return Object.entries(stats.operationStats)
      .filter(([_, stat]) => stat.approvalRate < 0.7) // 승인율 70% 미만
      .map(([op, _]) => op);
  }

  /**
   * 피드백 전체 개수
   */
  getTotalFeedbackCount(): number {
    return this.feedbacks.size;
  }

  /**
   * 세션 개수
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 저장된 모든 피드백 (export용)
   */
  exportFeedbacks(): FeedbackEntry[] {
    return Array.from(this.feedbacks.values());
  }

  /**
   * JSON으로 저장 (파일 I/O는 외부에서)
   */
  toJSON() {
    return {
      feedbacks: Array.from(this.feedbacks.values()),
      sessions: Array.from(this.sessions.values()),
      timestamp: Date.now(),
    };
  }

  /**
   * JSON에서 로드
   */
  fromJSON(data: any) {
    if (data.feedbacks) {
      data.feedbacks.forEach((fb: FeedbackEntry) => {
        this.feedbacks.set(fb.id, fb);
      });
    }

    if (data.sessions) {
      data.sessions.forEach((session: Session) => {
        this.sessions.set(session.id, session);
      });
    }
  }

  /**
   * 저장소 초기화 (테스트용)
   */
  clear() {
    this.feedbacks.clear();
    this.sessions.clear();
  }

  /**
   * 통계 요약 리포트
   */
  generateReport(): string {
    const stats = this.calculateStats();

    let report = '\n';
    report += '╔════════════════════════════════════════════════════╗\n';
    report += '║          📊 피드백 통계 리포트                      ║\n';
    report += '╚════════════════════════════════════════════════════╝\n\n';

    report += `총 피드백: ${stats.totalFeedback}\n`;
    report += `  ✅ 승인: ${stats.approved} (${((stats.approved / stats.totalFeedback) * 100).toFixed(1)}%)\n`;
    report += `  ✏️  수정: ${stats.modified} (${((stats.modified / stats.totalFeedback) * 100).toFixed(1)}%)\n`;
    report += `  ❌ 거부: ${stats.rejected} (${((stats.rejected / stats.totalFeedback) * 100).toFixed(1)}%)\n\n`;

    report += `평균 정확도: ${(stats.averageAccuracy * 100).toFixed(1)}%\n\n`;

    report += '📈 Operation별 통계:\n';
    Object.entries(stats.operationStats).forEach(([op, stat]) => {
      report += `  ${op}:\n`;
      report += `    - 개수: ${stat.count}\n`;
      report += `    - 승인율: ${(stat.approvalRate * 100).toFixed(1)}%\n`;
      report += `    - 정확도: ${(stat.averageAccuracy * 100).toFixed(1)}%\n`;
    });

    return report;
  }
}
