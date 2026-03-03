/**
 * FreeLang v2 - 피드백 타입 정의
 * 수집, 저장, 분석에 사용되는 데이터 구조
 */

import { HeaderProposal } from '../engine/header-generator';

/**
 * 피드백 항목
 */
export interface FeedbackEntry {
  id: string;                    // 고유 ID
  timestamp: number;             // Unix 타임스탐프
  sessionId: string;             // 세션 ID (여러 피드백을 묶음)

  proposal: {
    operation: string;           // sum, avg, max 등
    header: string;              // 원본 헤더 문자열
    confidence: number;          // 제안 신뢰도
  };

  userFeedback: {
    action: 'approve' | 'modify' | 'reject' | 'suggest'; // 사용자 선택
    message?: string;            // 수정/제안 내용
    modifiedHeader?: string;     // 사용자가 수정한 헤더
  };

  analysis: {
    accuracy: number;            // 0~1 (1 = 완벽)
    reasoning: string;           // 왜 이 피드백이 중요한가
  };

  metadata: {
    inputText?: string;          // 원본 사용자 입력
    session?: string;            // 세션 정보
    tags?: string[];             // 분류용 태그
  };
}

/**
 * 피드백 수집 결과
 */
export interface FeedbackResult {
  feedbackId: string;
  accepted: boolean;
  message: string;
}

/**
 * 세션 정보
 */
export interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  feedbackCount: number;
  tags: string[];
}

/**
 * 피드백 통계
 */
export interface FeedbackStats {
  totalFeedback: number;
  approved: number;
  modified: number;
  rejected: number;
  averageAccuracy: number;
  operationStats: {
    [operation: string]: {
      count: number;
      approvalRate: number;
      averageAccuracy: number;
    };
  };
}

/**
 * 신뢰도 추이
 */
export interface ConfidenceTrend {
  operation: string;
  timePoints: number[];           // 타임스탐프
  confidences: number[];          // 신뢰도 값 (0~1)
  trend: 'increasing' | 'decreasing' | 'stable';
}
