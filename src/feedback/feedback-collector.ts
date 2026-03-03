/**
 * FreeLang v2 - 피드백 수집기
 * 사용자 또는 AI로부터 헤더 제안에 대한 피드백 수집
 */

import { HeaderProposal } from '../engine/header-generator';
import { FeedbackEntry, FeedbackResult, Session } from './feedback-types';

/**
 * 피드백 수집기
 */
export class FeedbackCollector {
  private sessionId: string;
  private sessionStart: number;

  constructor() {
    this.sessionId = this._generateSessionId();
    this.sessionStart = Date.now();
  }

  /**
   * 헤더 제안에 대한 피드백 수집
   *
   * @param proposal 평가할 헤더 제안
   * @param userAction 사용자/AI의 액션 (approve, modify, reject, suggest)
   * @param message 선택적 메시지 (수정 내용 등)
   * @returns 피드백 항목
   */
  collectFeedback(
    proposal: HeaderProposal,
    userAction: 'approve' | 'modify' | 'reject' | 'suggest',
    message?: string
  ): FeedbackEntry {
    const feedbackId = this._generateFeedbackId();

    // 정확도 계산 (피드백 액션 기반)
    const accuracy = this._calculateAccuracy(userAction, proposal.confidence);

    // Reasoning 생성
    const reasoning = this._generateReasoning(userAction, proposal);

    const feedback: FeedbackEntry = {
      id: feedbackId,
      timestamp: Date.now(),
      sessionId: this.sessionId,

      proposal: {
        operation: proposal.operation,
        header: proposal.header,
        confidence: proposal.confidence,
      },

      userFeedback: {
        action: userAction,
        message,
        modifiedHeader: userAction === 'modify' ? message : undefined,
      },

      analysis: {
        accuracy,
        reasoning,
      },

      metadata: {
        tags: [proposal.operation, userAction],
      },
    };

    return feedback;
  }

  /**
   * AI 피드백 형식 생성
   * 대화형 CLI에서 보여줄 포맷
   *
   * @param proposal 헤더 제안
   * @returns 포맷팅된 문자열
   */
  formatProposalForReview(proposal: HeaderProposal): string {
    const confidenceBar = this._drawConfidenceBar(proposal.confidence);

    let formatted = '\n';
    formatted += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    formatted += '✨ 자동 생성된 헤더\n';
    formatted += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    // 헤더 코드
    formatted += '📝 헤더:\n';
    formatted += `${proposal.header}\n\n`;

    // 이유
    formatted += '💡 이유:\n';
    formatted += `  ${proposal.reason}\n\n`;

    // Directive
    formatted += '⚙️  지시사항:\n';
    formatted += `  ${proposal.directive}\n\n`;

    // 신뢰도
    formatted += '📊 신뢰도:\n';
    formatted += `  ${confidenceBar} ${(proposal.confidence * 100).toFixed(0)}%\n\n`;

    // 선택지
    formatted += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    formatted += '[1] ✅ 승인   [2] ✏️ 수정   [3] 🔄 재제안   [4] ❌ 취소\n';
    formatted += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    return formatted;
  }

  /**
   * 피드백 액션 해석
   * 숫자 입력 → 액션으로 변환
   *
   * @param choice 사용자 선택 (1~4 또는 액션)
   * @returns 피드백 액션
   */
  parseUserChoice(
    choice: string | number
  ): 'approve' | 'modify' | 'suggest' | 'reject' | null {
    const input = String(choice).trim().toLowerCase();

    // 숫자 입력
    if (input === '1') return 'approve';
    if (input === '2') return 'modify';
    if (input === '3') return 'suggest';
    if (input === '4') return 'reject';

    // 직접 입력
    if (['approve', 'ok', 'yes', 'y'].includes(input)) return 'approve';
    if (['modify', 'edit', 'change', 'm'].includes(input)) return 'modify';
    if (['suggest', 'regenerate', 'again', 'r'].includes(input)) return 'suggest';
    if (['reject', 'no', 'cancel', 'n'].includes(input)) return 'reject';

    return null;
  }

  /**
   * 정확도 계산
   * @private
   */
  private _calculateAccuracy(
    action: string,
    confidence: number
  ): number {
    // 승인 → 신뢰도 기반 정확도 높음
    if (action === 'approve') {
      return Math.min(confidence + 0.1, 1); // 보너스 +0.1
    }

    // 수정 → 신뢰도가 낮음을 의미
    if (action === 'modify') {
      return Math.max(confidence * 0.7, 0.3);
    }

    // 거부 → 완전히 틀림
    if (action === 'reject') {
      return 0.1;
    }

    // 재제안 → 다시 시도 필요
    if (action === 'suggest') {
      return confidence * 0.5;
    }

    return confidence;
  }

  /**
   * Reasoning 생성
   * @private
   */
  private _generateReasoning(action: string, proposal: HeaderProposal): string {
    switch (action) {
      case 'approve':
        return `제안이 정확히 ${proposal.operation}를 인식했습니다. ` +
               `신뢰도 ${(proposal.confidence * 100).toFixed(0)}%로 충분합니다.`;

      case 'modify':
        return `제안이 부분적으로 맞지만, 조정이 필요합니다. ` +
               `신뢰도를 낮추고 학습합니다.`;

      case 'reject':
        return `제안이 완전히 틀렸습니다. ` +
               `다른 패턴으로 다시 시도해야 합니다.`;

      case 'suggest':
        return `신뢰도가 낮으므로 다른 제안을 생성합니다. ` +
               `대체 패턴들을 평가합니다.`;

      default:
        return '알 수 없는 액션입니다.';
    }
  }

  /**
   * 신뢰도 막대 그리기
   * @private
   */
  private _drawConfidenceBar(confidence: number): string {
    const length = 20;
    const filled = Math.round(confidence * length);
    const empty = length - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);

    // 색상 코드 (터미널)
    if (confidence > 0.8) return `[🟢 ${bar}]`;
    if (confidence > 0.6) return `[🟡 ${bar}]`;
    return `[🔴 ${bar}]`;
  }

  /**
   * 세션 정보 반환
   */
  getSession(): Session {
    return {
      id: this.sessionId,
      startTime: this.sessionStart,
      feedbackCount: 0, // FeedbackStorage에서 관리
      tags: [],
    };
  }

  /**
   * 호환성: 세션 ID 조회 (이전 API)
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 호환성: 세션별 피드백 조회 (이전 API)
   * 참고: FeedbackCollector는 세션별로 피드백을 관리하지 않으므로, 빈 배열 반환
   */
  getFeedbacksBySession(sessionId: string): any[] {
    // Week 4에서는 FeedbackStorage에서 관리
    // 호환성을 위해 빈 배열 반환
    return [];
  }

  /**
   * 호환성: 세션별 통계 (이전 API)
   */
  getStatsBySession(sessionId: string): any {
    return {
      total: 0,
      approved: 0,
      rejected: 0,
      modified: 0,
    };
  }

  /**
   * 세션 ID 생성
   * @private
   */
  private _generateSessionId(): string {
    return `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * 피드백 ID 생성
   * @private
   */
  private _generateFeedbackId(): string {
    return `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
