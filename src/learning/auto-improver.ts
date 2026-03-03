// @ts-nocheck
/**
 * Phase 8.2: Auto-Improvement Loop Engine
 *
 * 매일 밤 자동 실행: 피드백 → 패턴 분석 → DB 업데이트 → 모델 재학습
 */

import { feedbackCollector, UserFeedback } from '../feedback/collector';
import { PatternUpdater, patternUpdater } from './pattern-updater';
import { autocompleteDB, AutocompleteDB } from '../engine/autocomplete-db';

export interface ImproveMetrics {
  total_feedbacks: number;
  approved_count: number;
  rejected_count: number;
  modified_count: number;
  improved_patterns: string[];
  avg_confidence_before: number;
  avg_confidence_after: number;
  improvement_percentage: number;
}

export interface ImproveReport {
  timestamp: Date;
  session_id: string;
  metrics: ImproveMetrics;
  patterns_updated: Map<string, number>; // pattern_id -> confidence change
  status: 'success' | 'failed' | 'partial';
  error?: string;
}

export interface ABTest {
  id: string;
  pattern_id: string;
  variant_a: { confidence: number; approval_rate: number };
  variant_b: { confidence: number; approval_rate: number };
  winner?: 'A' | 'B';
  confidence_threshold?: number;
}

export class AutoImprover {
  private patternUpdater: PatternUpdater;
  private autocompleteDB: AutocompleteDB;
  private history: ImproveReport[] = [];
  private abTests: Map<string, ABTest> = new Map();
  private lastImproveTime: Date | null = null;
  private improvementThreshold: number = 0.7; // 70% 승인율 미만이면 개선 대상

  constructor(
    pu?: PatternUpdater,
    adb?: AutocompleteDB
  ) {
    this.patternUpdater = pu || patternUpdater;
    this.autocompleteDB = adb || autocompleteDB;
  }

  /**
   * 자동 개선 실행 (메인 파이프라인)
   */
  async improve(): Promise<ImproveReport> {
    const startTime = new Date();
    const sessionId = feedbackCollector.getSessionId();

    try {
      // 1️⃣ 피드백 수집
      const feedbacks = feedbackCollector.getFeedbacksBySession(sessionId);
      if (feedbacks.length === 0) {
        return this.createReport('partial', sessionId, [], {
          total_feedbacks: 0,
          approved_count: 0,
          rejected_count: 0,
          modified_count: 0,
          improved_patterns: [],
          avg_confidence_before: 0,
          avg_confidence_after: 0,
          improvement_percentage: 0,
        });
      }

      // 2️⃣ 개선 대상 패턴 분석
      const improvablePatterns = this.analyzePatterns(feedbacks);
      const confidentBefore = this.calculateAvgConfidence(
        improvablePatterns.map(p => p.id)
      );

      // 3️⃣ 패턴 업데이트
      const updatedPatterns = new Map<string, number>();
      for (const pattern of improvablePatterns) {
        const before = this.patternUpdater.get(pattern.id)?.original.confidence || 0;

        // 수정 피드백 적용
        const modifications = feedbacks.filter(
          f => f.user_action === 'modify' &&
               f.generated.fnName === pattern.id
        );

        for (const mod of modifications) {
          this.patternUpdater.recordModification(pattern.id, {});
        }

        const after = this.patternUpdater.get(pattern.id)?.original.confidence || before;
        updatedPatterns.set(pattern.id, after - before);
      }

      // 4️⃣ 자동완성 DB 동기화
      this.syncAutocompleteDB(improvablePatterns);

      // 5️⃣ 메트릭 계산
      // Week 4에서는 feedbacks를 이미 가지고 있으므로, 직접 계산
      const totalFeedbacks = feedbacks.length;
      const approvedCount = feedbacks.filter(f => f.user_action === 'approve').length;
      const rejectedCount = feedbacks.filter(f => f.user_action === 'reject').length;
      const modifiedCount = feedbacks.filter(f => f.user_action === 'modify').length;

      const confidenceAfter = this.calculateAvgConfidence(
        improvablePatterns.map(p => p.id)
      );
      const improvementPct =
        confidentBefore > 0
          ? ((confidenceAfter - confidentBefore) / confidentBefore) * 100
          : 0;

      const metrics: ImproveMetrics = {
        total_feedbacks: totalFeedbacks,
        approved_count: approvedCount,
        rejected_count: rejectedCount,
        modified_count: modifiedCount,
        improved_patterns: improvablePatterns.map(p => p.id),
        avg_confidence_before: confidentBefore,
        avg_confidence_after: confidenceAfter,
        improvement_percentage: improvementPct,
      };

      const report = this.createReport('success', sessionId, feedbacks, metrics);
      report.patterns_updated = updatedPatterns;
      this.history.push(report);
      this.lastImproveTime = startTime;

      return report;
    } catch (error) {
      const report: ImproveReport = {
        timestamp: new Date(),
        session_id: sessionId,
        metrics: {
          total_feedbacks: 0,
          approved_count: 0,
          rejected_count: 0,
          modified_count: 0,
          improved_patterns: [],
          avg_confidence_before: 0,
          avg_confidence_after: 0,
          improvement_percentage: 0,
        },
        patterns_updated: new Map(),
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
      this.history.push(report);
      return report;
    }
  }

  /**
   * 개선 대상 패턴 분석
   */
  private analyzePatterns(feedbacks: UserFeedback[]) {
    const patterns = this.patternUpdater.getAll();
    const needsImprovement = this.patternUpdater.getNeedsImprovement(
      this.improvementThreshold
    );

    // getNeedsImprovement()는 문자열 배열 반환
    const needsSet = new Set(needsImprovement);
    return patterns.filter(p => needsSet.has(p.id));
  }

  /**
   * 평균 신뢰도 계산
   */
  private calculateAvgConfidence(patternIds: string[]): number {
    if (patternIds.length === 0) return 0;

    const confidences = patternIds
      .map(id => this.patternUpdater.get(id)?.original.confidence || 0)
      .filter(c => c > 0);

    if (confidences.length === 0) return 0;
    return confidences.reduce((a, b) => a + b) / confidences.length;
  }

  /**
   * 자동완성 DB 동기화
   */
  private syncAutocompleteDB(patterns: any[]): void {
    for (const pattern of patterns) {
      const stats = this.patternUpdater.getStats(pattern.id);
      if (stats) {
        // 자동완성 DB의 신뢰도 업데이트
        const item = this.autocompleteDB.search({ prefix: pattern.id });
        if (item.items.length > 0) {
          item.items[0].confidence = stats.current_confidence;
          item.items[0].approval_rate = stats.approval_rate;
          item.items[0].usage_count = stats.total_interactions;
          item.items[0].last_used = stats.last_feedback;
        }
      }
    }
  }

  /**
   * A/B 테스트 생성
   */
  createABTest(patternId: string): ABTest {
    const testId = `ab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const stats = this.patternUpdater.getStats(patternId);

    if (!stats) {
      throw new Error(`Pattern ${patternId} not found`);
    }

    const test: ABTest = {
      id: testId,
      pattern_id: patternId,
      variant_a: {
        confidence: stats.current_confidence,
        approval_rate: stats.approval_rate,
      },
      variant_b: {
        confidence: stats.current_confidence * 1.05, // 5% 개선 시뮬레이션
        approval_rate: Math.min(1, stats.approval_rate + 0.05),
      },
    };

    this.abTests.set(testId, test);
    return test;
  }

  /**
   * A/B 테스트 승자 결정
   */
  decideABTestWinner(testId: string): 'A' | 'B' {
    const test = this.abTests.get(testId);
    if (!test) {
      throw new Error(`A/B test ${testId} not found`);
    }

    const scoreA = (test.variant_a.confidence + test.variant_a.approval_rate) / 2;
    const scoreB = (test.variant_b.confidence + test.variant_b.approval_rate) / 2;

    const winner = scoreB > scoreA ? 'B' : 'A';
    test.winner = winner;

    return winner;
  }

  /**
   * A/B 테스트 결과 적용
   */
  applyABTestResult(testId: string): void {
    const test = this.abTests.get(testId);
    if (!test || !test.winner) {
      throw new Error(`Invalid A/B test ${testId}`);
    }

    if (test.winner === 'B') {
      const pattern = this.patternUpdater.get(test.pattern_id);
      if (pattern) {
        pattern.original.confidence = test.variant_b.confidence;
      }
    }
  }

  /**
   * 개선 히스토리 조회
   */
  getHistory(): ImproveReport[] {
    return [...this.history];
  }

  /**
   * 최근 개선 리포트
   */
  getLastReport(): ImproveReport | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  /**
   * 마지막 개선 시간
   */
  getLastImproveTime(): Date | null {
    return this.lastImproveTime;
  }

  /**
   * 다음 예정 개선 시간 (매일 밤 자정)
   */
  getNextImproveTime(): Date {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  /**
   * 개선 필요 여부 체크 (마지막 개선 후 24시간)
   */
  shouldImprove(): boolean {
    if (!this.lastImproveTime) return true;
    const now = new Date();
    const diff = now.getTime() - this.lastImproveTime.getTime();
    return diff > 24 * 60 * 60 * 1000; // 24시간 이상 경과
  }

  /**
   * 리포트 생성 헬퍼
   */
  private createReport(
    status: 'success' | 'failed' | 'partial',
    sessionId: string,
    feedbacks: UserFeedback[],
    metrics: ImproveMetrics
  ): ImproveReport {
    return {
      timestamp: new Date(),
      session_id: sessionId,
      metrics,
      patterns_updated: new Map(),
      status,
    };
  }

  /**
   * 초기화 (테스트용)
   */
  clear(): void {
    this.history = [];
    this.abTests.clear();
    this.lastImproveTime = null;
  }
}

// 싱글톤 인스턴스
export const autoImprover = new AutoImprover();
