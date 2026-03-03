/**
 * Phase 6.2: FeedbackCollector
 *
 * 모든 패턴 사용을 기록하고 통계를 제공합니다.
 * Self-Evolution 정신 구현: 매 실행마다 학습 데이터 수집
 */

/**
 * 개별 피드백 레코드
 * 한 번의 패턴 사용 = 1개 레코드
 */
export interface FeedbackRecord {
  patternId: string;              // "sum", "map", "filter" 등
  timestamp: number;              // Date.now()
  context: string;                // "array_analysis", "string_processing" 등
  success: boolean;               // 올바르게 사용되었는가?
  confidence: number;             // 0.0 ~ 1.0 (확실도)
  executionTime: number;          // 실행 시간 (ms)
  memoryUsed: number;             // 메모리 사용 (bytes)
  input?: string;                 // 입력 타입
  output?: string;                // 출력 타입
  errorMessage?: string;          // 실패 시 에러 메시지
}

/**
 * 패턴의 누적 통계
 */
export interface PatternStats {
  patternId: string;
  totalUses: number;
  successUses: number;
  failureUses: number;
  successRate: number;            // 0.0 ~ 1.0
  avgExecutionTime: number;       // ms
  minExecutionTime: number;       // ms
  maxExecutionTime: number;       // ms
  avgMemoryUsed: number;          // bytes
  trend: 'increasing' | 'stable' | 'decreasing';
  lastUsed: number;               // timestamp
  contextFrequency: Map<string, number>;
  relatedPatterns: string[];
  commonErrors: string[];
}

/**
 * FeedbackCollector: 패턴 사용 기록 수집 및 통계
 */
export class FeedbackCollector {
  private records: FeedbackRecord[] = [];
  private statsCache: Map<string, PatternStats> = new Map();
  private lastAnalysisTime: number = 0;
  private analysisInterval: number = 60000; // 1분마다 분석

  private overallStatsCache: {
    totalRecords: number;
    totalPatterns: number;
    overallSuccessRate: number;
    averageExecutionTime: number;
    averageMemoryUsed: number;
    mostUsedPattern: string;
    leastSuccessfulPattern: string;
  } | null = null;
  private lastOverallStatsTime: number = 0;
  private cacheValidityMs: number = 1000; // 1초 캐시 유효기간

  constructor() {
    // 초기화
    this.records = [];
    this.statsCache = new Map();
  }

  /**
   * 패턴 사용 기록
   */
  recordPatternUsage(
    patternId: string,
    context: string,
    success: boolean,
    executionTime: number,
    memoryUsed: number,
    input?: string,
    output?: string,
    errorMessage?: string
  ): FeedbackRecord {
    const record: FeedbackRecord = {
      patternId,
      timestamp: Date.now(),
      context,
      success,
      confidence: success ? 0.95 : 0.3,
      executionTime,
      memoryUsed,
      input,
      output,
      errorMessage
    };

    this.records.push(record);

    // 캐시 무효화
    this.statsCache.delete(patternId);
    this.overallStatsCache = null;  // 전체 통계 캐시도 무효화

    return record;
  }

  /**
   * 특정 패턴의 통계
   */
  getUsageStats(patternId: string): PatternStats | null {
    // 캐시 확인
    if (this.statsCache.has(patternId)) {
      return this.statsCache.get(patternId)!;
    }

    const filtered = this.records.filter(r => r.patternId === patternId);
    if (filtered.length === 0) return null;

    const successes = filtered.filter(r => r.success).length;
    const executionTimes = filtered.map(r => r.executionTime).sort((a, b) => a - b);
    const contexts = new Map<string, number>();

    filtered.forEach(r => {
      contexts.set(r.context, (contexts.get(r.context) || 0) + 1);
    });

    // 추세 계산 (최근 5개 vs 이전)
    const recentSuccess = filtered.slice(-5).filter(r => r.success).length;
    const recentRate = recentSuccess / Math.min(5, filtered.length);
    const overallRate = successes / filtered.length;
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';

    if (recentRate > overallRate + 0.1) trend = 'increasing';
    else if (recentRate < overallRate - 0.1) trend = 'decreasing';

    // 관련 패턴 찾기 (같은 시간대에 사용된 패턴)
    const relatedPatterns = this.findRelatedPatterns(patternId, filtered);

    // 공통 에러 찾기
    const commonErrors = this.findCommonErrors(filtered);

    const stats: PatternStats = {
      patternId,
      totalUses: filtered.length,
      successUses: successes,
      failureUses: filtered.length - successes,
      successRate: successes / filtered.length,
      avgExecutionTime: filtered.reduce((sum, r) => sum + r.executionTime, 0) / filtered.length,
      minExecutionTime: executionTimes[0],
      maxExecutionTime: executionTimes[executionTimes.length - 1],
      avgMemoryUsed: filtered.reduce((sum, r) => sum + r.memoryUsed, 0) / filtered.length,
      trend,
      lastUsed: filtered[filtered.length - 1].timestamp,
      contextFrequency: contexts,
      relatedPatterns,
      commonErrors
    };

    this.statsCache.set(patternId, stats);
    return stats;
  }

  /**
   * 상위 N개 패턴
   */
  getTopPatterns(limit: number = 10): PatternStats[] {
    const patternIds = new Set(this.records.map(r => r.patternId));
    const allStats: PatternStats[] = [];

    patternIds.forEach(id => {
      const stats = this.getUsageStats(id);
      if (stats) allStats.push(stats);
    });

    // 사용 빈도 + 성공률로 정렬
    return allStats
      .sort((a, b) => {
        const scoreA = a.totalUses * a.successRate;
        const scoreB = b.totalUses * b.successRate;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  /**
   * 실패한 패턴들
   */
  getFailedPatterns(threshold: number = 0.8): PatternStats[] {
    const patternIds = new Set(this.records.map(r => r.patternId));
    const failedPatterns: PatternStats[] = [];

    patternIds.forEach(id => {
      const stats = this.getUsageStats(id);
      if (stats && stats.successRate < threshold) {
        failedPatterns.push(stats);
      }
    });

    return failedPatterns.sort((a, b) => a.successRate - b.successRate);
  }

  /**
   * 느린 패턴들
   */
  getSlowPatterns(threshold: number = 10): PatternStats[] {
    const patternIds = new Set(this.records.map(r => r.patternId));
    const slowPatterns: PatternStats[] = [];

    patternIds.forEach(id => {
      const stats = this.getUsageStats(id);
      if (stats && stats.avgExecutionTime > threshold) {
        slowPatterns.push(stats);
      }
    });

    return slowPatterns.sort((a, b) => b.avgExecutionTime - a.avgExecutionTime);
  }

  /**
   * 최근 사용 기록
   */
  getRecentRecords(patternId?: string, limit: number = 100): FeedbackRecord[] {
    let filtered = this.records;

    if (patternId) {
      filtered = filtered.filter(r => r.patternId === patternId);
    }

    return filtered.slice(-limit).reverse();
  }

  /**
   * 시간 범위 내의 레코드
   */
  getRecordsByTimeRange(startTime: number, endTime: number): FeedbackRecord[] {
    return this.records.filter(r => r.timestamp >= startTime && r.timestamp <= endTime);
  }

  /**
   * 컨텍스트별 레코드
   */
  getRecordsByContext(context: string): FeedbackRecord[] {
    return this.records.filter(r => r.context === context);
  }

  /**
   * 패턴 체인 분석 (map → reduce 형태)
   */
  analyzePatternChains(maxTimeGap: number = 5000): Map<string, number> {
    const chains = new Map<string, number>();

    const sorted = [...this.records].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // 같은 컨텍스트이고 시간이 가까운 경우
      if (
        current.context === next.context &&
        next.timestamp - current.timestamp < maxTimeGap
      ) {
        const chain = `${current.patternId} → ${next.patternId}`;
        chains.set(chain, (chains.get(chain) || 0) + 1);
      }
    }

    return chains;
  }

  /**
   * 전체 통계
   */
  getOverallStats(): {
    totalRecords: number;
    totalPatterns: number;
    overallSuccessRate: number;
    averageExecutionTime: number;
    averageMemoryUsed: number;
    mostUsedPattern: string;
    leastSuccessfulPattern: string;
  } {
    // 캐시 확인: 1초 이내면 캐시된 결과 반환
    const now = Date.now();
    if (
      this.overallStatsCache !== null &&
      now - this.lastOverallStatsTime < this.cacheValidityMs
    ) {
      return this.overallStatsCache;
    }

    const totalRecords = this.records.length;
    if (totalRecords === 0) {
      const emptyStats = {
        totalRecords: 0,
        totalPatterns: 0,
        overallSuccessRate: 0,
        averageExecutionTime: 0,
        averageMemoryUsed: 0,
        mostUsedPattern: '',
        leastSuccessfulPattern: ''
      };
      this.overallStatsCache = emptyStats;
      this.lastOverallStatsTime = now;
      return emptyStats;
    }

    // 빠른 계산 (단순 수치들)
    const patternIds = new Set<string>();
    let totalExecutionTime = 0;
    let totalMemory = 0;
    let successes = 0;

    for (const record of this.records) {
      patternIds.add(record.patternId);
      totalExecutionTime += record.executionTime;
      totalMemory += record.memoryUsed;
      if (record.success) successes++;
    }

    // 패턴 통계는 필요한 것만 계산
    let mostUsedPattern = '';
    let leastSuccessfulPattern = '';
    let maxUses = -1;
    let minSuccessRate = 2; // 1.0보다 큼

    for (const patternId of patternIds) {
      const stats = this.getUsageStats(patternId);
      if (stats) {
        if (stats.totalUses > maxUses) {
          maxUses = stats.totalUses;
          mostUsedPattern = patternId;
        }
        if (stats.successRate < minSuccessRate) {
          minSuccessRate = stats.successRate;
          leastSuccessfulPattern = patternId;
        }
      }
    }

    const result = {
      totalRecords,
      totalPatterns: patternIds.size,
      overallSuccessRate: successes / totalRecords,
      averageExecutionTime: totalExecutionTime / totalRecords,
      averageMemoryUsed: totalMemory / totalRecords,
      mostUsedPattern,
      leastSuccessfulPattern
    };

    // 결과 캐싱
    this.overallStatsCache = result;
    this.lastOverallStatsTime = now;

    return result;
  }

  /**
   * 데이터 초기화
   */
  clear(): void {
    this.records = [];
    this.statsCache.clear();
    this.overallStatsCache = null;
  }

  /**
   * 레코드 개수
   */
  getRecordCount(): number {
    return this.records.length;
  }

  /**
   * 패턴 개수
   */
  getPatternCount(): number {
    return new Set(this.records.map(r => r.patternId)).size;
  }

  /**
   * 프라이빗: 관련 패턴 찾기
   */
  private findRelatedPatterns(patternId: string, records: FeedbackRecord[]): string[] {
    const related = new Map<string, number>();

    // 같은 시간대(5분)에 사용된 패턴들
    records.forEach(r => {
      const timeWindow = records.filter(
        x => Math.abs(x.timestamp - r.timestamp) < 5 * 60 * 1000 && x.patternId !== patternId
      );

      timeWindow.forEach(x => {
        related.set(x.patternId, (related.get(x.patternId) || 0) + 1);
      });
    });

    // 빈도순 정렬
    return Array.from(related.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(x => x[0]);
  }

  /**
   * 프라이빗: 공통 에러 찾기
   */
  private findCommonErrors(records: FeedbackRecord[]): string[] {
    const errors = new Map<string, number>();

    records
      .filter(r => !r.success && r.errorMessage)
      .forEach(r => {
        const msg = r.errorMessage!;
        errors.set(msg, (errors.get(msg) || 0) + 1);
      });

    return Array.from(errors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(x => x[0]);
  }
}

/**
 * 글로벌 인스턴스
 */
export const globalFeedbackCollector = new FeedbackCollector();
