/**
 * Phase 12: Dashboard REST API Routes (Extended)
 * Includes Phase 11 Dynamic Confidence System integration
 */

import { dashboard } from '../../dashboard/dashboard';
import allPatterns from '../../phase-10/v1-v2-adjusted-patterns.json';

export const dashboardRoutes = {
  /**
   * GET /api/dashboard/stats
   * 전체 통계
   */
  getStats: () => {
    return dashboard.getStats();
  },

  /**
   * GET /api/dashboard/trends
   * 신뢰도 트렌드 (최근 7일)
   */
  getTrends: (days?: number) => {
    return dashboard.getTrends(days || 7);
  },

  /**
   * GET /api/dashboard/feedback-summary
   * 피드백 요약
   */
  getFeedbackSummary: (patternId?: string) => {
    return dashboard.getFeedbackSummary(patternId);
  },

  /**
   * GET /api/dashboard/pattern/:id
   * 패턴별 상세 정보
   */
  getPatternDetails: (patternId: string) => {
    return dashboard.getPatternDetails(patternId);
  },

  /**
   * GET /api/dashboard/learning-progress
   * 학습 진행률
   */
  getLearningProgress: () => {
    return dashboard.getLearningProgress();
  },

  /**
   * GET /api/dashboard/export/json
   * JSON 형식 내보내기
   */
  exportJSON: () => {
    return dashboard.exportToJSON();
  },

  /**
   * GET /api/dashboard/export/csv
   * CSV 형식 내보내기 (트렌드)
   */
  exportCSV: () => {
    return dashboard.exportTrendsToCSV();
  },

  /**
   * Phase 12: GET /api/dashboard/confidence-report
   * Complete Phase 11 confidence report
   */
  getConfidenceReport: () => {
    return dashboard.getConfidenceReport(allPatterns as any);
  },

  /**
   * Phase 12: GET /api/dashboard/categories
   * Category-level breakdown
   */
  getCategoryBreakdown: () => {
    return dashboard.getCategoryBreakdown(allPatterns as any);
  },

  /**
   * Phase 12: GET /api/dashboard/top-movers
   * Top improvements and degradations
   */
  getTopMovers: (limit?: number) => {
    return dashboard.getTopMovers(allPatterns as any, limit || 10);
  },

  /**
   * Phase 12: GET /api/dashboard/confidence-trends
   * Confidence trends over time
   */
  getConfidenceTrends: (days?: number) => {
    return dashboard.getConfidenceTrends(allPatterns as any, days || 7);
  },

  /**
   * Phase 12: GET /api/dashboard/pattern/:id/confidence
   * Confidence details for specific pattern
   */
  getPatternConfidence: (patternId: string) => {
    return dashboard.getPatternConfidence(allPatterns as any, patternId);
  },
};
