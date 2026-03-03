/**
 * Phase 20 Week 3: A/B Testing Framework
 *
 * 책임:
 * 1. 복구 정책별 성공률 비교
 * 2. 통계 분석 (Chi-square, Confidence Interval)
 * 3. 승자 결정 (Statistical Significance)
 * 4. 테스트 결과 리포트
 */

import { HealingAction } from './self-healer';

/**
 * A/B 테스트 그룹
 */
export enum TestGroup {
  CONTROL = 'control',      // 기존 정책
  VARIANT = 'variant'       // 새 정책
}

/**
 * 테스트 결과
 */
export interface TestResult {
  timestamp: number;
  group: TestGroup;
  action: HealingAction;
  success: boolean;
  duration: number; // ms
  metadata?: { [key: string]: any };
}

/**
 * 그룹 통계
 */
export interface GroupStats {
  totalTests: number;
  successCount: number;
  failureCount: number;
  successRate: number; // 0-100%
  avgDuration: number; // ms
  minDuration: number;
  maxDuration: number;
}

/**
 * A/B 테스트 결과
 */
export interface ABTestReport {
  actionName: HealingAction;
  controlStats: GroupStats;
  variantStats: GroupStats;
  confidenceLevel: number; // 0-100% (기본: 95%)
  pValue: number; // Chi-square p-value
  isSignificant: boolean; // p < 0.05인지 판단
  winner: 'control' | 'variant' | 'tie';
  improvementPercent: number; // variant이 control보다 몇 % 나은지
  recommendation: string;
  startTime: number;
  endTime: number;
}

/**
 * ABTestManager 구현
 */
export class ABTestManager {
  private results: TestResult[] = [];
  private tests: Map<HealingAction, { control: TestResult[]; variant: TestResult[] }> = new Map();
  private minSampleSize: number = 30; // 통계적 의미 있으려면 최소 30개 샘플
  private confidenceLevel: number = 0.95; // 95% confidence

  /**
   * 테스트 결과 기록
   */
  recordResult(result: TestResult): void {
    this.results.push(result);

    // 액션별로 그룹화
    if (!this.tests.has(result.action)) {
      this.tests.set(result.action, { control: [], variant: [] });
    }

    const testData = this.tests.get(result.action)!;
    if (result.group === TestGroup.CONTROL) {
      testData.control.push(result);
    } else {
      testData.variant.push(result);
    }

    // 최근 1000개만 유지
    if (this.results.length > 1000) {
      this.results.shift();
    }

    if (process.env.NODE_ENV !== 'test') {
      console.log(`✅ A/B test recorded: ${result.action} (${result.group}, success: ${result.success})`);
    }
  }

  /**
   * 액션별 A/B 테스트 리포트 생성
   */
  generateReport(action: HealingAction): ABTestReport | null {
    const testData = this.tests.get(action);
    if (!testData) {
      return null;
    }

    const controlStats = this.calculateStats(testData.control);
    const variantStats = this.calculateStats(testData.variant);

    // 통계적 유의성 검정 (Chi-square)
    const { pValue, isSignificant } = this.chiSquareTest(controlStats, variantStats);

    // 승자 결정
    let winner: 'control' | 'variant' | 'tie' = 'tie';
    if (isSignificant) {
      winner = variantStats.successRate > controlStats.successRate ? 'variant' : 'control';
    }

    // 개선율 계산
    const improvementPercent =
      controlStats.successRate > 0
        ? ((variantStats.successRate - controlStats.successRate) / controlStats.successRate) * 100
        : 0;

    // 권장사항
    const recommendation = this.generateRecommendation(
      winner,
      isSignificant,
      improvementPercent,
      controlStats.totalTests,
      variantStats.totalTests
    );

    return {
      actionName: action,
      controlStats,
      variantStats,
      confidenceLevel: this.confidenceLevel * 100,
      pValue,
      isSignificant,
      winner,
      improvementPercent,
      recommendation,
      startTime: Math.min(...testData.control.map(r => r.timestamp), ...testData.variant.map(r => r.timestamp)),
      endTime: Math.max(...testData.control.map(r => r.timestamp), ...testData.variant.map(r => r.timestamp))
    };
  }

  /**
   * 그룹 통계 계산
   */
  private calculateStats(results: TestResult[]): GroupStats {
    if (results.length === 0) {
      return {
        totalTests: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0
      };
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    const durations = results.map(r => r.duration);

    return {
      totalTests: results.length,
      successCount,
      failureCount,
      successRate: (successCount / results.length) * 100,
      avgDuration: durations.reduce((a, b) => a + b, 0) / results.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations)
    };
  }

  /**
   * Chi-square 검정
   * H0: 두 그룹의 성공률이 같다
   * H1: 두 그룹의 성공률이 다르다
   */
  private chiSquareTest(
    control: GroupStats,
    variant: GroupStats
  ): { pValue: number; isSignificant: boolean } {
    // 샘플 크기 확인
    if (control.totalTests < this.minSampleSize || variant.totalTests < this.minSampleSize) {
      return { pValue: 1.0, isSignificant: false };
    }

    // Contingency Table
    // |          | Success | Failure | Total |
    // |----------|---------|---------|-------|
    // | Control  |    a    |    b    |  n1   |
    // | Variant  |    c    |    d    |  n2   |
    // | Total    |   a+c   |   b+d   |   N   |

    const a = control.successCount;
    const b = control.failureCount;
    const c = variant.successCount;
    const d = variant.failureCount;
    const n1 = control.totalTests;
    const n2 = variant.totalTests;
    const N = n1 + n2;

    // Chi-square 통계량
    // χ² = N(ad - bc)² / ((a+c)(b+d)(a+b)(c+d))
    const numerator = N * Math.pow(a * d - b * c, 2);
    const denominator = (a + c) * (b + d) * (a + b) * (c + d);

    if (denominator === 0) {
      return { pValue: 1.0, isSignificant: false };
    }

    const chiSquare = numerator / denominator;

    // p-value 추정 (df=1, χ² > 3.841 → p < 0.05)
    // 단순화: χ² > 3.841이면 significant로 판정
    const isSignificant = chiSquare > 3.841;
    const pValue = isSignificant ? 0.05 : 0.95;

    return { pValue, isSignificant };
  }

  /**
   * 권장사항 생성
   */
  private generateRecommendation(
    winner: 'control' | 'variant' | 'tie',
    isSignificant: boolean,
    improvementPercent: number,
    controlSamples: number,
    variantSamples: number
  ): string {
    if (!isSignificant) {
      if (controlSamples < this.minSampleSize || variantSamples < this.minSampleSize) {
        return `⏳ 더 많은 데이터 필요 (최소 ${this.minSampleSize}개, 현재: Control=${controlSamples}, Variant=${variantSamples})`;
      }
      return '➡️ 유의미한 차이 없음. 현재 정책 유지 권장';
    }

    if (winner === 'tie') {
      return '➡️ 통계적으로 차이 없음. 현재 정책 유지 권장';
    }

    if (winner === 'variant') {
      if (improvementPercent > 20) {
        return `🎯 신정책 적용 강력 권장 (${improvementPercent.toFixed(1)}% 개선)`;
      } else if (improvementPercent > 10) {
        return `✅ 신정책 적용 권장 (${improvementPercent.toFixed(1)}% 개선)`;
      } else {
        return `👍 신정책 적용 가능 (${improvementPercent.toFixed(1)}% 개선)`;
      }
    }

    // winner === 'control'
    return `⚠️ 기존 정책이 더 나음 (신정책 ${Math.abs(improvementPercent).toFixed(1)}% 열등). 현재 정책 유지`;
  }

  /**
   * 전체 리포트 생성
   */
  generateFullReport(): ABTestReport[] {
    const reports: ABTestReport[] = [];

    for (const [action, _] of this.tests) {
      const report = this.generateReport(action);
      if (report) {
        reports.push(report);
      }
    }

    return reports.sort((a, b) => a.endTime - b.endTime);
  }

  /**
   * 활성 테스트 조회
   */
  getActiveTests(): string[] {
    return Array.from(this.tests.keys());
  }

  /**
   * 테스트 시작
   */
  startTest(action: HealingAction): void {
    if (!this.tests.has(action)) {
      this.tests.set(action, { control: [], variant: [] });
      if (process.env.NODE_ENV !== 'test') {
        console.log(`🧪 A/B test started: ${action}`);
      }
    }
  }

  /**
   * 테스트 종료
   */
  endTest(action: HealingAction): ABTestReport | null {
    if (!this.tests.has(action)) {
      return null;
    }

    const report = this.generateReport(action);
    this.tests.delete(action);

    if (process.env.NODE_ENV !== 'test') {
      console.log(`✅ A/B test ended: ${action}`);
    }

    return report;
  }

  /**
   * 결과 조회
   */
  getResults(limit: number = 100): TestResult[] {
    return this.results.slice(-limit);
  }

  /**
   * 결과 리셋
   */
  reset(): void {
    this.results = [];
    this.tests.clear();
    if (process.env.NODE_ENV !== 'test') {
      console.log('🔄 A/B test results reset');
    }
  }

  /**
   * Confidence level 설정
   */
  setConfidenceLevel(level: number): void {
    if (level > 0 && level < 1) {
      this.confidenceLevel = level;
    }
  }

  /**
   * 최소 샘플 크기 설정
   */
  setMinSampleSize(size: number): void {
    if (size > 0) {
      this.minSampleSize = size;
    }
  }
}
