/**
 * Phase 8.1: Feedback Collection Interface
 *
 * 사용자 피드백 수집 → 저장 → 통계
 */

import { HeaderProposal } from '../core/types';

export interface UserFeedback {
  id: string;                       // 자동 생성된 ID
  input: string;                    // "배열 합산"
  generated: HeaderProposal;        // 생성된 제안
  user_action: 'approve' | 'modify' | 'reject';
  modification?: {
    fn?: string;
    input?: string;
    output?: string;
    directive?: string;
  };
  timestamp: Date;
  session_id: string;
}

export interface FeedbackStats {
  total: number;
  approved: number;
  rejected: number;
  modified: number;
  approval_rate: number;
}

export class FeedbackCollector {
  private feedbacks: Map<string, UserFeedback> = new Map();
  private sessionId: string = this.generateSessionId();

  /**
   * 피드백 기록
   */
  recordFeedback(
    input: string,
    generated: HeaderProposal,
    action: 'approve' | 'modify' | 'reject',
    modification?: {
      fn?: string;
      input?: string;
      output?: string;
      directive?: string;
    }
  ): string {
    const id = this.generateFeedbackId();
    const feedback: UserFeedback = {
      id,
      input,
      generated,
      user_action: action,
      modification,
      timestamp: new Date(),
      session_id: this.sessionId,
    };

    this.feedbacks.set(id, feedback);
    return id;
  }

  /**
   * 피드백 조회
   */
  getFeedback(id: string): UserFeedback | null {
    return this.feedbacks.get(id) || null;
  }

  /**
   * 모든 피드백 조회
   */
  getAllFeedbacks(): UserFeedback[] {
    return Array.from(this.feedbacks.values());
  }

  /**
   * 세션별 피드백 조회
   */
  getFeedbacksBySession(sessionId: string): UserFeedback[] {
    return Array.from(this.feedbacks.values()).filter(
      f => f.session_id === sessionId
    );
  }

  /**
   * 피드백 통계
   */
  getStats(): FeedbackStats {
    const feedbacks = Array.from(this.feedbacks.values());
    const total = feedbacks.length;

    if (total === 0) {
      return {
        total: 0,
        approved: 0,
        rejected: 0,
        modified: 0,
        approval_rate: 0,
      };
    }

    const approved = feedbacks.filter(f => f.user_action === 'approve').length;
    const rejected = feedbacks.filter(f => f.user_action === 'reject').length;
    const modified = feedbacks.filter(f => f.user_action === 'modify').length;

    return {
      total,
      approved,
      rejected,
      modified,
      approval_rate: approved / total,
    };
  }

  /**
   * 세션별 통계
   */
  getStatsBySession(sessionId: string): FeedbackStats {
    const feedbacks = this.getFeedbacksBySession(sessionId);
    const total = feedbacks.length;

    if (total === 0) {
      return {
        total: 0,
        approved: 0,
        rejected: 0,
        modified: 0,
        approval_rate: 0,
      };
    }

    const approved = feedbacks.filter(f => f.user_action === 'approve').length;
    const rejected = feedbacks.filter(f => f.user_action === 'reject').length;
    const modified = feedbacks.filter(f => f.user_action === 'modify').length;

    return {
      total,
      approved,
      rejected,
      modified,
      approval_rate: approved / total,
    };
  }

  /**
   * 수정된 제안 가져오기
   */
  getModifiedProposal(feedbackId: string): HeaderProposal | null {
    const feedback = this.feedbacks.get(feedbackId);
    if (!feedback || feedback.user_action !== 'modify' || !feedback.modification) {
      return null;
    }

    return {
      ...feedback.generated,
      fnName: feedback.modification.fn || feedback.generated.fnName,
      inputType: feedback.modification.input || feedback.generated.inputType,
      outputType: feedback.modification.output || feedback.generated.outputType,
      directive: feedback.modification.directive || feedback.generated.directive,
    };
  }

  /**
   * 현재 세션 ID 반환
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 세션 초기화 (새 세션 시작)
   */
  newSession(): string {
    this.sessionId = this.generateSessionId();
    return this.sessionId;
  }

  /**
   * 피드백 ID 생성
   */
  private generateFeedbackId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 세션 ID 생성
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 피드백 초기화 (테스트용)
   */
  clear(): void {
    this.feedbacks.clear();
    this.sessionId = this.generateSessionId();
  }
}

// 싱글톤 인스턴스
export const feedbackCollector = new FeedbackCollector();
