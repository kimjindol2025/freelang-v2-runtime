/**
 * FreeLang v2 - 피드백 분석기
 * 피드백 패턴 분석, 신뢰도 추이, 개선 영역 식별
 */

import { FeedbackEntry, FeedbackStats } from './feedback-types';
import { FeedbackStorage } from './feedback-storage';

/**
 * 피드백 분석 결과
 */
export interface AnalysisResult {
  insights: string[];
  improvementAreas: ImprovementArea[];
  operationHealthScore: { [operation: string]: number };
  recommendations: string[];
}

/**
 * 개선 영역
 */
export interface ImprovementArea {
  operation: string;
  currentApprovalRate: number;
  issue: string;
  suggestedAction: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * 피드백 분석기
 */
export class FeedbackAnalyzer {
  constructor(private storage: FeedbackStorage) {}

  /**
   * 전체 피드백 분석
   */
  analyze(): AnalysisResult {
    const stats = this.storage.calculateStats();
    const insights = this._generateInsights(stats);
    const improvementAreas = this._identifyImprovementAreas(stats);
    const operationHealthScore = this._calculateOperationHealth(stats);
    const recommendations = this._generateRecommendations(
      improvementAreas,
      stats
    );

    return {
      insights,
      improvementAreas,
      operationHealthScore,
      recommendations,
    };
  }

  /**
   * Insights 생성
   * @private
   */
  private _generateInsights(stats: FeedbackStats): string[] {
    const insights: string[] = [];

    // 1. 전체 성공률
    const successRate = (stats.approved / stats.totalFeedback) * 100;
    if (successRate > 80) {
      insights.push(`✨ 뛰어난 성공률: ${successRate.toFixed(1)}%`);
    } else if (successRate > 60) {
      insights.push(`👍 양호한 성공률: ${successRate.toFixed(1)}%`);
    } else {
      insights.push(`⚠️ 개선 필요: 성공률 ${successRate.toFixed(1)}%`);
    }

    // 2. 평균 정확도
    const accuracy = stats.averageAccuracy * 100;
    insights.push(`📊 평균 정확도: ${accuracy.toFixed(1)}%`);

    // 3. 가장 안정적인 operation
    const mostApproved = this.storage.getMostApprovedOperation();
    if (mostApproved) {
      const approvalRate = stats.operationStats[mostApproved].approvalRate * 100;
      insights.push(
        `🏆 가장 안정적: ${mostApproved} (${approvalRate.toFixed(1)}% 승인)`
      );
    }

    // 4. 개선 필요한 operation 개수
    const needsImprovement = this.storage.getNeedsImprovementOperations();
    if (needsImprovement.length > 0) {
      insights.push(`🔧 개선 필요: ${needsImprovement.join(', ')}`);
    }

    return insights;
  }

  /**
   * 개선 영역 식별
   * @private
   */
  private _identifyImprovementAreas(stats: FeedbackStats): ImprovementArea[] {
    const areas: ImprovementArea[] = [];

    Object.entries(stats.operationStats).forEach(([operation, stat]) => {
      if (stat.approvalRate < 0.8) {
        // 승인율 80% 미만
        let issue = '';
        let suggestedAction = '';
        let priority: 'high' | 'medium' | 'low' = 'medium';

        if (stat.approvalRate < 0.5) {
          issue = `심각: 승인율 ${(stat.approvalRate * 100).toFixed(0)}% - 절반 이상이 거부됨`;
          suggestedAction = '패턴 DB 재검토 및 키워드 강화 필요';
          priority = 'high';
        } else if (stat.approvalRate < 0.65) {
          issue = `주의: 승인율 ${(stat.approvalRate * 100).toFixed(0)}% - 개선 필요`;
          suggestedAction = '사용자 피드백 분석 및 휴리스틱 조정';
          priority = 'medium';
        } else {
          issue = `양호: 승인율 ${(stat.approvalRate * 100).toFixed(0)}% - 점진적 개선`;
          suggestedAction = '신뢰도 보정 값 미세 조정';
          priority = 'low';
        }

        areas.push({
          operation,
          currentApprovalRate: stat.approvalRate,
          issue,
          suggestedAction,
          priority,
        });
      }
    });

    // 우선순위 정렬
    return areas.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Operation 건강도 점수 계산
   * @private
   */
  private _calculateOperationHealth(
    stats: FeedbackStats
  ): { [operation: string]: number } {
    const scores: { [operation: string]: number } = {};

    Object.entries(stats.operationStats).forEach(([operation, stat]) => {
      // 점수 계산: 승인율(50%) + 정확도(50%)
      const approvalScore = stat.approvalRate * 50;
      const accuracyScore = stat.averageAccuracy * 50;

      scores[operation] = Math.round(approvalScore + accuracyScore);
    });

    return scores;
  }

  /**
   * 권장사항 생성
   * @private
   */
  private _generateRecommendations(
    improvementAreas: ImprovementArea[],
    stats: FeedbackStats
  ): string[] {
    const recommendations: string[] = [];

    // 1. 높은 우선순위 개선 권고
    const highPriority = improvementAreas.filter(a => a.priority === 'high');
    if (highPriority.length > 0) {
      recommendations.push(
        `🔴 긴급: ${highPriority.map(a => a.operation).join(', ')}의 패턴 분석 필요`
      );
    }

    // 2. 일반적인 권고
    if (stats.approved < stats.modified) {
      recommendations.push(
        '💡 tip: 사용자 수정 사항을 분석하여 패턴 DB 개선 고려'
      );
    }

    if (stats.rejected > stats.approved * 0.2) {
      recommendations.push(
        '⚙️ 신뢰도 임계값 재검토 필요 (현재 임계값이 너무 낮을 수 있음)'
      );
    }

    if (stats.totalFeedback < 10) {
      recommendations.push(
        '📈 더 많은 피드백 수집 필요 (현재 샘플이 적어 정확한 분석 어려움)'
      );
    }

    // 3. 운영 권고
    if (stats.averageAccuracy > 0.85) {
      recommendations.push(
        '✨ 현재 수준 유지: 시스템이 잘 작동하고 있습니다'
      );
    }

    return recommendations;
  }

  /**
   * 분석 리포트 생성 (상세)
   */
  generateDetailedReport(): string {
    const analysis = this.analyze();
    const stats = this.storage.calculateStats();

    let report = '\n';
    report += '╔════════════════════════════════════════════════════╗\n';
    report += '║           🔬 상세 피드백 분석 리포트               ║\n';
    report += '╚════════════════════════════════════════════════════╝\n\n';

    // Insights
    report += '💡 인사이트:\n';
    analysis.insights.forEach(insight => {
      report += `  ${insight}\n`;
    });
    report += '\n';

    // Operation 건강도
    report += '❤️‍🩹 Operation 건강도:\n';
    Object.entries(analysis.operationHealthScore).forEach(([op, score]) => {
      const bar = '█'.repeat(Math.round(score / 5)) +
                  '░'.repeat(20 - Math.round(score / 5));
      report += `  ${op}: [${bar}] ${score}/100\n`;
    });
    report += '\n';

    // 개선 영역
    if (analysis.improvementAreas.length > 0) {
      report += '🔧 개선 필요 영역:\n';
      analysis.improvementAreas.forEach(area => {
        report += `  • ${area.operation} (${area.priority})\n`;
        report += `    - 현황: ${area.issue}\n`;
        report += `    - 조치: ${area.suggestedAction}\n`;
      });
      report += '\n';
    }

    // 권장사항
    report += '📋 권장사항:\n';
    analysis.recommendations.forEach(rec => {
      report += `  ${rec}\n`;
    });

    return report;
  }
}
