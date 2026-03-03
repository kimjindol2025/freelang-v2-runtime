/**
 * FreeLang v2 - Batch Mode (Task 3.5)
 * Process multiple header generation requests at once
 * Non-interactive mode for automation and testing
 */

import { HeaderGenerator, HeaderProposal } from '../engine/header-generator';
import { HeaderValidator } from '../engine/header-validator';
import { FeedbackCollector } from '../feedback/feedback-collector';
import { FeedbackStorage } from '../feedback/feedback-storage';
import { FeedbackAnalyzer } from '../feedback/feedback-analyzer';
import { IntentMatcher } from '../engine/intent-matcher';
import { TextNormalizer } from '../engine/text-normalizer';

export interface BatchRequest {
  id: string;
  input: string;
  expectedOperation?: string;
  userAction?: 'approve' | 'modify' | 'reject' | 'suggest';
  feedback?: string;
}

export interface BatchResult {
  requestId: string;
  input: string;
  operation: string;
  confidence: number;
  headerValid: boolean;
  headerScore: number;
  feedbackCollected: boolean;
  accuracy: number;
  error?: string;
}

export interface BatchReport {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  validationPassCount: number;
  averageConfidence: number;
  averageAccuracy: number;
  results: BatchResult[];
  stats: any;
  analysis: any;
}

export class BatchMode {
  private storage: FeedbackStorage;
  private analyzer: FeedbackAnalyzer;
  private results: BatchResult[] = [];

  constructor() {
    this.storage = new FeedbackStorage();
    this.analyzer = new FeedbackAnalyzer(this.storage);
  }

  /**
   * Process batch requests
   */
  async processBatch(requests: BatchRequest[]): Promise<BatchReport> {
    this.results = [];

    for (const request of requests) {
      const result = await this._processRequest(request);
      this.results.push(result);
    }

    return this._generateReport();
  }

  /**
   * Process single request
   */
  private async _processRequest(request: BatchRequest): Promise<BatchResult> {
    const result: BatchResult = {
      requestId: request.id,
      input: request.input,
      operation: '',
      confidence: 0,
      headerValid: false,
      headerScore: 0,
      feedbackCollected: false,
      accuracy: 0,
    };

    try {
      // Step 1: Intent matching
      const normalizedTokens = TextNormalizer.normalize(request.input);
      const intentMatch = IntentMatcher.matchIntent(normalizedTokens);
      if (!intentMatch) {
        result.error = 'Intent matching failed';
        return result;
      }

      result.operation = intentMatch.operation;
      result.confidence = intentMatch.confidence;

      // Validate expected operation if provided
      if (
        request.expectedOperation &&
        result.operation !== request.expectedOperation
      ) {
        result.error = `Expected operation: ${request.expectedOperation}, got: ${result.operation}`;
        // Continue anyway to collect metrics
      }

      // Step 2: Generate header
      const proposal = HeaderGenerator.generateHeader(
        result.operation,
        result.confidence
      );

      if (!proposal) {
        result.error = 'Header generation failed';
        return result;
      }

      // Step 3: Validate header
      const validation = HeaderValidator.validate(proposal);
      result.headerValid = validation.valid;
      result.headerScore = validation.score;

      if (!validation.valid) {
        result.error = `Header validation failed (score: ${validation.score})`;
        // Continue to collect feedback anyway
      }

      // Step 4: Collect feedback (if action provided)
      if (request.userAction) {
        const collector = new FeedbackCollector();
        const feedback = collector.collectFeedback(
          proposal,
          request.userAction,
          request.feedback
        );

        this.storage.saveFeedback(feedback);
        result.feedbackCollected = true;
        result.accuracy = feedback.analysis.accuracy;
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Generate batch report
   */
  private _generateReport(): BatchReport {
    const stats = this.storage.calculateStats();
    const analysis = this.analyzer.analyze();

    const successCount = this.results.filter((r) => !r.error).length;
    const failureCount = this.results.length - successCount;
    const validationPassCount = this.results.filter((r) => r.headerValid).length;

    const confidences = this.results.map((r) => r.confidence);
    const accuracies = this.results
      .filter((r) => r.feedbackCollected)
      .map((r) => r.accuracy);

    const averageConfidence =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0;

    const averageAccuracy =
      accuracies.length > 0
        ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length
        : 0;

    return {
      totalRequests: this.results.length,
      successCount,
      failureCount,
      validationPassCount,
      averageConfidence,
      averageAccuracy,
      results: this.results,
      stats,
      analysis,
    };
  }

  /**
   * Generate batch report text
   */
  generateReportText(report: BatchReport): string {
    let text = '\n';
    text += '╔════════════════════════════════════════════════════╗\n';
    text += '║           📋 FreeLang Batch Report                 ║\n';
    text += '╚════════════════════════════════════════════════════╝\n\n';

    // Summary
    text += '📊 요약:\n';
    text += `  총 요청: ${report.totalRequests}\n`;
    text += `  성공: ${report.successCount} (${((report.successCount / report.totalRequests) * 100).toFixed(1)}%)\n`;
    text += `  실패: ${report.failureCount}\n`;
    text += `  검증 통과: ${report.validationPassCount}/${report.totalRequests}\n\n`;

    // Metrics
    text += '📈 메트릭:\n';
    text += `  평균 신뢰도: ${(report.averageConfidence * 100).toFixed(1)}%\n`;
    text += `  평균 정확도: ${(report.averageAccuracy * 100).toFixed(1)}%\n\n`;

    // Results by operation
    if (Object.keys(report.stats.operationStats).length > 0) {
      text += '🔧 Operation별 분석:\n';
      Object.entries(report.stats.operationStats).forEach(([op, stat]: any) => {
        text += `  ${op}:\n`;
        text += `    - 개수: ${stat.count}\n`;
        text += `    - 승인율: ${(stat.approvalRate * 100).toFixed(1)}%\n`;
        text += `    - 정확도: ${(stat.averageAccuracy * 100).toFixed(1)}%\n`;
      });
      text += '\n';
    }

    // Insights
    if (report.analysis.insights.length > 0) {
      text += '💡 인사이트:\n';
      report.analysis.insights.forEach((insight: string) => {
        text += `  ${insight}\n`;
      });
      text += '\n';
    }

    // Improvement areas
    if (report.analysis.improvementAreas.length > 0) {
      text += '🔧 개선 필요 영역:\n';
      report.analysis.improvementAreas.forEach((area: any) => {
        text += `  • ${area.operation} (${area.priority})\n`;
        text += `    - ${area.issue}\n`;
        text += `    - ${area.suggestedAction}\n`;
      });
      text += '\n';
    }

    // Errors (if any)
    const errors = report.results.filter((r) => r.error);
    if (errors.length > 0) {
      text += '❌ 에러:\n';
      errors.forEach((result) => {
        text += `  [${result.requestId}] ${result.input}\n`;
        text += `    → ${result.error}\n`;
      });
      text += '\n';
    }

    text += '═══════════════════════════════════════════════════\n';

    return text;
  }

  /**
   * Get results as JSON
   */
  getResultsJSON(): any {
    return {
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        total: this.results.length,
        success: this.results.filter((r) => !r.error).length,
        failure: this.results.filter((r) => r.error).length,
      },
      stats: this.storage.calculateStats(),
    };
  }

  /**
   * Export to file
   */
  exportToFile(filename: string, format: 'json' | 'text'): void {
    const fs = require('fs');

    let content: string;
    if (format === 'json') {
      content = JSON.stringify(this.getResultsJSON(), null, 2);
    } else {
      const report = this._generateReport();
      content = this.generateReportText(report);
    }

    fs.writeFileSync(filename, content, 'utf-8');
    console.log(`✅ 결과 저장됨: ${filename}`);
  }

  /**
   * Get summary
   */
  getSummary(): {
    total: number;
    success: number;
    failure: number;
    successRate: string;
  } {
    const total = this.results.length;
    const success = this.results.filter((r) => !r.error).length;
    const failure = total - success;
    const successRate = ((success / total) * 100).toFixed(1);

    return { total, success, failure, successRate: `${successRate}%` };
  }
}
