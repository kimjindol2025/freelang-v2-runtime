/**
 * FreeLang v2 - Pattern Updater (Task 4.1)
 * Intent 패턴 DB 동적 업데이트
 * 피드백 기반 패턴 개선 및 새로운 패턴 학습
 */

import { FeedbackEntry } from '../feedback/feedback-types';
import {
  INTENT_PATTERNS,
  IntentPattern,
  PATTERN_IDS,
} from '../engine/intent-patterns';

export interface PatternUpdate {
  operation: string;
  newKeywords: string[];
  removedKeywords: string[];
  confidenceBoost: number;
  timestamp: number;
  feedbackCount: number;
}

export interface PatternStats {
  operation: string;
  totalFeedback: number;
  approvalRate: number;
  rejectionRate: number;
  modificationRate: number;
  avgAccuracy: number;
  lastUpdated: number;
  approvedCount?: number;
  rejectedCount?: number;
  modifiedCount?: number;
}

export class PatternUpdater {
  private patternHistory: Map<string, PatternUpdate[]> = new Map();
  patternStats: Map<string, PatternStats> = new Map();  // Made public for compatibility methods
  instanceVariationCounts: Map<string, Map<string, number>> = new Map();  // Instance-level variation tracking (public for prototype methods)

  /**
   * 피드백을 기반으로 패턴 업데이트
   *
   * 알고리즘:
   * 1. Operation별 피드백 통계 계산
   * 2. 키워드 추가/제거 결정
   * 3. 신뢰도 부스트 계산
   * 4. 패턴 히스토리에 기록
   *
   * @param feedbacks 수집된 피드백 배열
   * @returns 업데이트된 패턴 목록
   */
  updatePatterns(feedbacks: FeedbackEntry[]): PatternUpdate[] {
    const updates: PatternUpdate[] = [];

    if (feedbacks.length === 0) {
      return updates;
    }

    // 1. Operation별 그룹화
    const feedbacksByOp = this._groupByOperation(feedbacks);

    // 2. 각 Operation별 분석 및 업데이트
    for (const [operation, opFeedbacks] of feedbacksByOp.entries()) {
      const stats = this._calculateStats(operation, opFeedbacks);
      this.patternStats.set(operation, stats);

      // 3. 업데이트 결정
      const update = this._decidePatternUpdate(
        operation,
        opFeedbacks,
        stats
      );

      if (update) {
        updates.push(update);
        this._recordUpdate(operation, update);
      }
    }

    return updates;
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
   * Operation별 통계 계산
   */
  private _calculateStats(
    operation: string,
    feedbacks: FeedbackEntry[]
  ): PatternStats {
    let approvalCount = 0;
    let rejectionCount = 0;
    let modificationCount = 0;
    let totalAccuracy = 0;

    feedbacks.forEach((fb) => {
      switch (fb.userFeedback.action) {
        case 'approve':
          approvalCount++;
          break;
        case 'reject':
          rejectionCount++;
          break;
        case 'modify':
          modificationCount++;
          break;
      }
      totalAccuracy += fb.analysis.accuracy;
    });

    const total = feedbacks.length;

    return {
      operation,
      totalFeedback: total,
      approvalRate: approvalCount / total,
      rejectionRate: rejectionCount / total,
      modificationRate: modificationCount / total,
      avgAccuracy: totalAccuracy / total,
      lastUpdated: Date.now(),
    };
  }

  /**
   * 패턴 업데이트 결정
   */
  private _decidePatternUpdate(
    operation: string,
    feedbacks: FeedbackEntry[],
    stats: PatternStats
  ): PatternUpdate | null {
    const pattern = INTENT_PATTERNS[operation];
    if (!pattern) {
      return null;
    }

    const newKeywords: string[] = [];
    const removedKeywords: string[] = [];
    let confidenceBoost = 0;

    // 1. 거부된 피드백에서 키워드 추출 (제거 후보)
    const rejectedFeedbacks = feedbacks.filter(
      (fb) => fb.userFeedback.action === 'reject'
    );

    if (rejectedFeedbacks.length > 0) {
      // 거부율이 높으면 일부 키워드 제거 고려
      if (stats.rejectionRate > 0.3) {
        // 가장 덜 사용되는 키워드 제거
        const leastUsed = this._findLeastUsedKeywords(
          feedbacks,
          pattern.keywords,
          Math.ceil(pattern.keywords.length * 0.1)
        );
        removedKeywords.push(...leastUsed);
      }
    }

    // 2. 수정된 피드백에서 새로운 키워드 추출
    const modifiedFeedbacks = feedbacks.filter(
      (fb) => fb.userFeedback.action === 'modify'
    );

    if (modifiedFeedbacks.length > 0) {
      // 수정 메시지에서 새로운 키워드 추출
      const extractedKeywords = this._extractKeywordsFromFeedback(
        modifiedFeedbacks
      );
      newKeywords.push(
        ...extractedKeywords.filter(
          (kw) => !pattern.keywords.includes(kw) && kw.length > 1
        )
      );
    }

    // 3. 신뢰도 부스트 계산
    if (stats.approvalRate > 0.8) {
      confidenceBoost = 0.15; // 매우 좋음
    } else if (stats.approvalRate > 0.6) {
      confidenceBoost = 0.1; // 좋음
    } else if (stats.approvalRate < 0.3) {
      confidenceBoost = -0.1; // 나쁨 (페널티)
    }

    // 4. 업데이트 필요 여부 판단
    if (newKeywords.length === 0 && removedKeywords.length === 0 &&
        confidenceBoost === 0) {
      return null;
    }

    return {
      operation,
      newKeywords,
      removedKeywords,
      confidenceBoost,
      timestamp: Date.now(),
      feedbackCount: feedbacks.length,
    };
  }

  /**
   * 가장 덜 사용된 키워드 찾기
   */
  private _findLeastUsedKeywords(
    feedbacks: FeedbackEntry[],
    keywords: string[],
    count: number
  ): string[] {
    const keywordUsage = new Map<string, number>();

    keywords.forEach((kw) => {
      keywordUsage.set(kw, 0);
    });

    feedbacks.forEach((fb) => {
      keywords.forEach((kw) => {
        if (fb.metadata.tags?.includes(kw)) {
          keywordUsage.set(kw, (keywordUsage.get(kw) || 0) + 1);
        }
      });
    });

    return Array.from(keywordUsage.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, count)
      .map(([kw]) => kw);
  }

  /**
   * 피드백 메시지에서 키워드 추출
   */
  private _extractKeywordsFromFeedback(
    feedbacks: FeedbackEntry[]
  ): string[] {
    const keywords: string[] = [];
    const seenKeywords = new Set<string>();

    feedbacks.forEach((fb) => {
      if (fb.userFeedback.message) {
        // 길이 2 이상의 연속 단어 추출
        const words = fb.userFeedback.message
          .split(/[\s,!?\.]+/)
          .filter((w) => w.length >= 2);

        words.forEach((word) => {
          if (!seenKeywords.has(word)) {
            keywords.push(word);
            seenKeywords.add(word);
          }
        });
      }
    });

    return keywords;
  }

  /**
   * 업데이트 히스토리 기록
   */
  private _recordUpdate(operation: string, update: PatternUpdate): void {
    if (!this.patternHistory.has(operation)) {
      this.patternHistory.set(operation, []);
    }
    this.patternHistory.get(operation)!.push(update);
  }

  /**
   * 패턴 통계 조회
   */
  getPatternStats(operation?: string): PatternStats[] {
    if (operation) {
      const stat = this.patternStats.get(operation);
      return stat ? [stat] : [];
    }
    return Array.from(this.patternStats.values());
  }

  /**
   * 패턴 업데이트 히스토리 조회
   */
  getUpdateHistory(operation?: string): PatternUpdate[] {
    if (operation) {
      return this.patternHistory.get(operation) || [];
    }

    const allUpdates: PatternUpdate[] = [];
    this.patternHistory.forEach((updates) => {
      allUpdates.push(...updates);
    });
    return allUpdates;
  }

  /**
   * 호환성: 패턴 초기화 (이전 API)
   */
  initializePattern(pattern: any): void {
    const operation = pattern.id || pattern.operation || pattern.fnName;
    if (operation) {
      this.patternStats.set(operation, {
        operation,
        totalFeedback: 0,
        approvalRate: 0.5,
        rejectionRate: 0,
        modificationRate: 0,
        avgAccuracy: 0.5,
        lastUpdated: Date.now(),
      });
    }
  }

  /**
   * 호환성: 승인 기록 (이전 API)
   */
  recordApproval(operation: string, keyword?: string): void {
    const stats = this.patternStats.get(operation);
    if (!stats) {
      this.patternStats.set(operation, {
        operation,
        totalFeedback: 1,
        approvalRate: 0.9,
        rejectionRate: 0,
        modificationRate: 0,
        avgAccuracy: 0.9,
        lastUpdated: Date.now(),
      });
    } else {
      stats.approvalRate = Math.min(1, stats.approvalRate + 0.05);
      stats.totalFeedback++;
    }
  }

  /**
   * 호환성: 거부 기록 (이전 API)
   */
  recordRejection(operation: string): void {
    const stats = this.patternStats.get(operation);
    if (!stats) {
      this.patternStats.set(operation, {
        operation,
        totalFeedback: 1,
        approvalRate: 0,
        rejectionRate: 0.9,
        modificationRate: 0,
        avgAccuracy: 0.1,
        lastUpdated: Date.now(),
      });
    } else {
      stats.rejectionRate = Math.min(1, stats.rejectionRate + 0.1);
      stats.totalFeedback++;
    }
  }

  /**
   * 호환성: 수정 기록 (이전 API)
   */
  recordModification(operation: string, modification: any): void {
    const stats = this.patternStats.get(operation);
    if (!stats) {
      this.patternStats.set(operation, {
        operation,
        totalFeedback: 1,
        approvalRate: 0,
        rejectionRate: 0,
        modificationRate: 0.8,
        avgAccuracy: 0.5,
        lastUpdated: Date.now(),
      });
    } else {
      stats.modificationRate = Math.min(1, stats.modificationRate + 0.05);
      stats.totalFeedback++;
    }
  }

  /**
   * 호환성: 개선 필요 패턴 (Phase 7 API - 객체 배열 반환)
   */
  getNeedsImprovement(threshold: number = 0.7): any[] {
    // Phase 7 호환: {id: string}[] 형태 반환
    return this.getOperationsNeedingImprovement(threshold).map((id) => ({ id }));
  }

  /**
   * 호환성: 신뢰도 추이 (이전 API)
   * Dashboard/Phase 8 호환: avg_confidence 필드 포함
   */
  getTrend(operation: string, days: number): Array<any> {
    const stats = this.patternStats.get(operation);
    if (!stats) return [];
    return [
      {
        date: new Date().toISOString().split('T')[0],
        interactions: stats.totalFeedback,
        avg_confidence: stats.approvalRate,  // Dashboard가 기대하는 필드명
        confidence: stats.approvalRate,      // Phase 7이 기대하는 필드명
      },
    ];
  }

  /**
   * 호환성: 인기 변형 (이전 API)
   */
  getPopularVariations(operation: string, count: number): Array<{ text: string; count: number }> {
    const counts = this.instanceVariationCounts.get(operation);
    if (!counts || counts.size === 0) return [];
    return Array.from(counts.entries())
      .map(([text, cnt]) => ({ text, count: cnt }))
      .sort((a, b) => b.count - a.count)
      .slice(0, count);
  }

  /**
   * 호환성: 학습 점수 (이전 API)
   */
  getLearningScore(operation: string): number {
    const stats = this.patternStats.get(operation);
    return stats ? stats.approvalRate : 0;
  }

  /**
   * 호환성: 패턴 조회 (이전 API)
   */
  get(operation: string): any {
    const stats = this.patternStats.get(operation);
    if (!stats) return null;
    return {
      id: operation,
      original: {
        confidence: stats.approvalRate,
      },
      total_interactions: stats.totalFeedback,
      last_feedback: stats.lastUpdated,
    };
  }

  /**
   * 호환성: 모든 패턴 조회 (이전 API)
   */
  getAll(): any[] {
    return Array.from(this.patternStats.values()).map((stats) => ({
      id: stats.operation,
      original: {
        confidence: stats.approvalRate,
      },
      total_interactions: stats.totalFeedback,
    }));
  }

  /**
   * 호환성: 패턴 통계 (이전 API)
   */
  getStats(operation: string): any {
    const stats = this.patternStats.get(operation);
    if (!stats) return null;

    // Legacy format for Phase 7 compatibility
    return {
      id: operation,
      total_interactions: stats.totalFeedback,
      approved: Math.round(stats.totalFeedback * stats.approvalRate),
      rejected: Math.round(stats.totalFeedback * stats.rejectionRate),
      modified: Math.round(stats.totalFeedback * stats.modificationRate),
      approval_rate: stats.approvalRate,
      rejection_rate: stats.rejectionRate,
      modification_rate: stats.modificationRate,
      confidence: stats.approvalRate,
      last_updated: stats.lastUpdated,
    };
  }

  /**
   * 호환성: 모든 패턴 통계 (이전 API)
   */
  getAllStats(): any[] {
    return Array.from(this.patternStats.values())
      .map(stats => ({
        id: stats.operation,
        total_interactions: stats.totalFeedback,
        approved: stats.approvedCount || 0,
        rejected: stats.rejectedCount || 0,
        modified: stats.modifiedCount || 0,
        approval_rate: stats.approvalRate,
        rejection_rate: stats.rejectionRate,
        modification_rate: stats.modificationRate,
        confidence: stats.approvalRate,
        last_updated: stats.lastUpdated,
      }))
      .sort((a, b) => b.total_interactions - a.total_interactions); // Sort by interaction count descending
  }

  /**
   * 개선이 필요한 Operation 식별
   */
  getOperationsNeedingImprovement(
    approvalThreshold: number = 0.6
  ): string[] {
    return Array.from(this.patternStats.entries())
      .filter(([_, stats]) => stats.approvalRate < approvalThreshold)
      .map(([op, _]) => op);
  }

  /**
   * 패턴 성능 요약
   */
  generateSummary(): string {
    let summary = '\n';
    summary += '╔════════════════════════════════════════════════════╗\n';
    summary += '║         📚 Pattern Updater Summary                 ║\n';
    summary += '╚════════════════════════════════════════════════════╝\n\n';

    summary += `총 패턴: ${this.patternStats.size}\n`;
    summary += `업데이트 기록: ${this.patternHistory.size} operations\n\n`;

    summary += '🔧 패턴 상태:\n';
    for (const [op, stats] of this.patternStats.entries()) {
      const status =
        stats.approvalRate > 0.8
          ? '✅'
          : stats.approvalRate > 0.6
            ? '⚠️ '
            : '❌';

      summary += `  ${status} ${op}: ${(stats.approvalRate * 100).toFixed(1)}% 승인`;
      summary += ` (${stats.totalFeedback}개 피드백)\n`;
    }

    summary += '\n📈 개선 영역:\n';
    const needsImprovement = this.getOperationsNeedingImprovement();
    if (needsImprovement.length === 0) {
      summary += '  모든 패턴이 양호합니다 ✨\n';
    } else {
      needsImprovement.forEach((op) => {
        const stats = this.patternStats.get(op)!;
        summary += `  • ${op}: ${(stats.approvalRate * 100).toFixed(1)}% 승인\n`;
      });
    }

    return summary;
  }
}

// ============================================================================
// 호환성 확장: Phase 7 테스트 지원 (기존 API)
// ============================================================================

// Phase 7에서 기대하는 패턴 포맷
interface LegacyPattern {
  id: string;
  original: {
    description: string;
    confidence: number;
  };
  feedback: {
    approved: number;
    rejected: number;
    modified: number;
  };
  variations: Array<{ text: string; count: number }>;
}

// 내부 패턴 저장소 (호환성)
const legacyPatterns = new Map<string, LegacyPattern>();
const variationCounts = new Map<string, Map<string, number>>();

/**
 * 호환성: 패턴 조회 (Phase 7 API)
 */
PatternUpdater.prototype.get = function(operation: string): any {
  const legacy = legacyPatterns.get(operation);
  if (!legacy) return null;

  // Merge with patternStats for complete data
  const stats = this.patternStats.get(operation);

  // Merge variations from initial setup and from instanceVariationCounts
  const variationMap = this.instanceVariationCounts.get(operation) || new Map();
  const mergedVariations = legacy.variations.map(v => ({
    text: v.text,
    count: variationMap.get(v.text) || v.count,
  }));

  // Add new variations that weren't in initial setup
  for (const [text, count] of variationMap) {
    if (!mergedVariations.some(v => v.text === text)) {
      mergedVariations.push({ text, count });
    }
  }

  return {
    id: legacy.id,
    original: legacy.original,
    feedback: legacy.feedback,
    variations: mergedVariations,
    total_interactions: stats ? stats.totalFeedback : 0,
    last_feedback: stats ? stats.lastUpdated : null,
  };
};

/**
 * 호환성: 패턴 초기화 (Phase 7 API)
 */
PatternUpdater.prototype.initializePattern = function(pattern: any): void {
  const operation = pattern.id || pattern.operation || pattern.fnName;
  if (!operation) return;

  const variations = (pattern.examples || []).map((text: string) => ({
    text,
    count: 0,
  }));

  legacyPatterns.set(operation, {
    id: operation,
    original: {
      description: pattern.description || pattern.pattern || '',
      confidence: pattern.confidence || 0.5,
    },
    feedback: {
      approved: 0,
      rejected: 0,
      modified: 0,
    },
    variations,
  });

  // 호환성: 통계에도 초기화
  const stats = this.patternStats.get(operation);
  if (!stats) {
    this.patternStats.set(operation, {
      operation,
      totalFeedback: 0,
      approvalRate: pattern.confidence || 0.5,
      rejectionRate: 0,
      modificationRate: 0,
      avgAccuracy: pattern.confidence || 0.5,
      lastUpdated: Date.now(),
      approvedCount: 0,
      rejectedCount: 0,
      modifiedCount: 0,
    });
  }
};

/**
 * 호환성: 승인 기록 (Phase 7 API)
 */
PatternUpdater.prototype.recordApproval = function(
  operation: string,
  keyword?: string
): void {
  // 호환성 패턴 업데이트
  let pattern = legacyPatterns.get(operation);
  if (!pattern) {
    pattern = {
      id: operation,
      original: { description: '', confidence: 0.5 },
      feedback: { approved: 0, rejected: 0, modified: 0 },
      variations: [],
    };
    legacyPatterns.set(operation, pattern);
  }
  pattern.feedback.approved++;
  pattern.original.confidence = Math.min(0.98, pattern.original.confidence + 0.02);

  // 변형 카운트
  if (keyword) {
    if (!this.instanceVariationCounts.has(operation)) {
      this.instanceVariationCounts.set(operation, new Map());
    }
    const counts = this.instanceVariationCounts.get(operation)!;
    counts.set(keyword, (counts.get(keyword) || 0) + 1);
  }

  // 기본 PatternUpdater 통계도 업데이트
  const stats = this.patternStats.get(operation);
  if (!stats) {
    this.patternStats.set(operation, {
      operation,
      totalFeedback: 1,
      approvalRate: 1.0,
      rejectionRate: 0,
      modificationRate: 0,
      avgAccuracy: 1.0,
      lastUpdated: Date.now(),
      approvedCount: 1,
      rejectedCount: 0,
      modifiedCount: 0,
    });
  } else {
    stats.approvedCount = (stats.approvedCount || 0) + 1;
    stats.totalFeedback++;
    // Recalculate rates based on counts
    const total = stats.approvedCount + (stats.rejectedCount || 0) + (stats.modifiedCount || 0);
    stats.approvalRate = total > 0 ? stats.approvedCount / total : 1.0;
    stats.rejectionRate = total > 0 ? (stats.rejectedCount || 0) / total : 0;
    stats.modificationRate = total > 0 ? (stats.modifiedCount || 0) / total : 0;
    stats.lastUpdated = Date.now();
  }
};

/**
 * 호환성: 거부 기록 (Phase 7 API)
 */
PatternUpdater.prototype.recordRejection = function(operation: string): void {
  let pattern = legacyPatterns.get(operation);
  if (!pattern) {
    pattern = {
      id: operation,
      original: { description: '', confidence: 0.5 },
      feedback: { approved: 0, rejected: 0, modified: 0 },
      variations: [],
    };
    legacyPatterns.set(operation, pattern);
  }
  pattern.feedback.rejected++;
  // Decrease confidence on rejection (5%)
  pattern.original.confidence = Math.max(0.5, pattern.original.confidence * 0.95);

  const stats = this.patternStats.get(operation);
  if (!stats) {
    this.patternStats.set(operation, {
      operation,
      totalFeedback: 1,
      approvalRate: 0,
      rejectionRate: 1.0,
      modificationRate: 0,
      avgAccuracy: 0,
      lastUpdated: Date.now(),
      approvedCount: 0,
      rejectedCount: 1,
      modifiedCount: 0,
    });
  } else {
    stats.rejectedCount = (stats.rejectedCount || 0) + 1;
    stats.totalFeedback++;
    // Recalculate rates based on counts
    const total = (stats.approvedCount || 0) + stats.rejectedCount + (stats.modifiedCount || 0);
    stats.approvalRate = total > 0 ? (stats.approvedCount || 0) / total : 0;
    stats.rejectionRate = total > 0 ? stats.rejectedCount / total : 1.0;
    stats.modificationRate = total > 0 ? (stats.modifiedCount || 0) / total : 0;
    stats.lastUpdated = Date.now();
  }
};

/**
 * 호환성: 수정 기록 (Phase 7 API)
 */
PatternUpdater.prototype.recordModification = function(
  operation: string,
  modification: any
): void {
  let pattern = legacyPatterns.get(operation);
  if (!pattern) {
    pattern = {
      id: operation,
      original: { description: '', confidence: 0.5 },
      feedback: { approved: 0, rejected: 0, modified: 0 },
      variations: [],
    };
    legacyPatterns.set(operation, pattern);
  }
  pattern.feedback.modified++;

  // Update description if provided in modification
  if (modification && modification.description) {
    pattern.original.description = modification.description;
  }

  // Add examples/variations if provided
  if (modification && modification.examples && Array.isArray(modification.examples)) {
    for (const example of modification.examples) {
      if (!pattern.variations.some(v => v.text === example)) {
        pattern.variations.push({ text: example, count: 0 });
      }
    }
  } else if (modification && modification.example) {
    // Backward compatibility for singular 'example'
    if (!pattern.variations.some(v => v.text === modification.example)) {
      pattern.variations.push({ text: modification.example, count: 0 });
    }
  }

  // Decrease confidence on modification (2%)
  pattern.original.confidence = Math.max(0.5, pattern.original.confidence * 0.98);

  const stats = this.patternStats.get(operation);
  if (!stats) {
    this.patternStats.set(operation, {
      operation,
      totalFeedback: 1,
      approvalRate: 0,
      rejectionRate: 0,
      modificationRate: 1.0,
      avgAccuracy: 0.5,
      lastUpdated: Date.now(),
      approvedCount: 0,
      rejectedCount: 0,
      modifiedCount: 1,
    });
  } else {
    stats.modifiedCount = (stats.modifiedCount || 0) + 1;
    stats.totalFeedback++;
    // Recalculate rates based on counts
    const total = (stats.approvedCount || 0) + (stats.rejectedCount || 0) + stats.modifiedCount;
    stats.approvalRate = total > 0 ? (stats.approvedCount || 0) / total : 0;
    stats.rejectionRate = total > 0 ? (stats.rejectedCount || 0) / total : 0;
    stats.modificationRate = total > 0 ? stats.modifiedCount / total : 1.0;
    stats.lastUpdated = Date.now();
  }
};

// 싱글톤 인스턴스
export const patternUpdater = new PatternUpdater();
