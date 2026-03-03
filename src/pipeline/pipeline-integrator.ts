/**
 * FreeLang Week 5 - Task 5.1: Pipeline Integrator
 *
 * Integrates all components from Weeks 1-4 into a unified pipeline:
 * Week 1 (Intent Engine) → Week 2 (Header Generation) →
 * Week 3 (Feedback Collection) → Week 4 (Learning Engine)
 */

import { TextNormalizer } from '../engine/text-normalizer';
import { IntentMatcher } from '../engine/intent-matcher';
import { HeaderGenerator, HeaderProposal } from '../engine/header-generator';
import { HeaderValidator } from '../engine/header-validator';
import { CGenerator } from '../codegen/c-generator';
import { FeedbackCollector } from '../feedback/feedback-collector';
import { FeedbackStorage } from '../feedback/feedback-storage';
import { FeedbackAnalyzer } from '../feedback/feedback-analyzer';
import { PatternUpdater } from '../learning/pattern-updater';
import { ConfidenceUpdater } from '../learning/confidence-updater';
import { MetaLearner } from '../learning/meta-learner';
import { LearningEngine } from '../learning/learning-engine';

export interface PipelineInput {
  userInput: string;
  testData?: number[];
  sessionId?: string;
}

export interface PipelineOutput {
  success: boolean;
  operation: string;
  header: HeaderProposal | null;
  cCode: string | null;
  confidence: number;
  timestamp: number;
  metadata: {
    intentTokens: string[];
    headerValid: boolean;
    headerScore: number;
    estimatedAccuracy: number;
  };
}

export interface PipelineStats {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  avgConfidence: number;
  avgAccuracy: number;
  operationCounts: Map<string, number>;
  lastProcessed: Date | null;
}

export class PipelineIntegrator {
  // Week 1: Intent Engine
  private textNormalizer: TextNormalizer;
  private intentMatcher: IntentMatcher;

  // Week 2: Header Generation & Code
  private headerGenerator: HeaderGenerator;
  private headerValidator: HeaderValidator;
  private cGenerator: CGenerator;

  // Week 3: Feedback System
  private feedbackCollector: FeedbackCollector;
  private feedbackStorage: FeedbackStorage;
  private feedbackAnalyzer: FeedbackAnalyzer;

  // Week 4: Learning Engine
  private patternUpdater: PatternUpdater;
  private confidenceUpdater: ConfidenceUpdater;
  private metaLearner: MetaLearner;
  private learningEngine: LearningEngine;

  // Pipeline state
  private processHistory: PipelineOutput[] = [];
  private sessionId: string;

  constructor() {
    // Initialize Week 1 components (TextNormalizer, IntentMatcher are static utilities)
    this.textNormalizer = new TextNormalizer();
    this.intentMatcher = new IntentMatcher();

    // Initialize Week 2 components
    this.headerGenerator = new HeaderGenerator();
    this.headerValidator = new HeaderValidator();
    this.cGenerator = new CGenerator();

    // Initialize Week 3 components
    this.feedbackCollector = new FeedbackCollector();
    this.feedbackStorage = new FeedbackStorage();
    this.feedbackAnalyzer = new FeedbackAnalyzer(this.feedbackStorage);

    // Initialize Week 4 components
    this.patternUpdater = new PatternUpdater();
    this.confidenceUpdater = new ConfidenceUpdater();
    this.metaLearner = new MetaLearner();
    this.learningEngine = new LearningEngine(this.feedbackStorage);

    // Generate session ID
    this.sessionId = `session-${Date.now()}`;
  }

  /**
   * Main pipeline: Process user input through all stages
   */
  process(input: PipelineInput): PipelineOutput {
    const startTime = Date.now();

    try {
      // Override session ID if provided
      if (input.sessionId) {
        this.sessionId = input.sessionId;
      }

      // ========== STAGE 1: Intent Recognition (Week 1) ==========
      const tokens = TextNormalizer.normalize(input.userInput);
      const intentMatch = IntentMatcher.matchIntent(tokens);

      if (!intentMatch) {
        return {
          success: false,
          operation: 'unknown',
          header: null,
          cCode: null,
          confidence: 0,
          timestamp: startTime,
          metadata: {
            intentTokens: tokens,
            headerValid: false,
            headerScore: 0,
            estimatedAccuracy: 0,
          },
        };
      }

      // ========== STAGE 2: Header Generation (Week 2) ==========
      const headerProposal = HeaderGenerator.generateHeader(
        intentMatch.operation,
        intentMatch.confidence
      );

      if (!headerProposal) {
        return {
          success: false,
          operation: intentMatch.operation,
          header: null,
          cCode: null,
          confidence: 0,
          timestamp: startTime,
          metadata: {
            intentTokens: tokens,
            headerValid: false,
            headerScore: 0,
            estimatedAccuracy: 0,
          },
        };
      }

      // ========== STAGE 3: Header Validation (Week 2) ==========
      const validationResult = HeaderValidator.validate(headerProposal);
      const isValid = validationResult.valid;

      // ========== STAGE 4: C Code Generation (Week 2) ==========
      const generatedCode = CGenerator.generateCode(headerProposal);
      const cCode = generatedCode?.cCode || '';

      // ========== STAGE 5: Feedback Recording (Week 3) ==========
      // Auto-record proposal for later feedback collection
      const feedback = this.feedbackCollector.collectFeedback(
        headerProposal,
        'approve'
      );
      this.feedbackStorage.saveFeedback(feedback);

      // Create output
      const output: PipelineOutput = {
        success: true,
        operation: headerProposal.operation,
        header: headerProposal,
        cCode: cCode,
        confidence: headerProposal.confidence,
        timestamp: startTime,
        metadata: {
          intentTokens: tokens,
          headerValid: isValid,
          headerScore: headerProposal.confidence,
          estimatedAccuracy: this.estimateAccuracy(headerProposal),
        },
      };

      // Store in history
      this.processHistory.push(output);

      return output;
    } catch (error) {
      return {
        success: false,
        operation: 'error',
        header: null,
        cCode: null,
        confidence: 0,
        timestamp: startTime,
        metadata: {
          intentTokens: [],
          headerValid: false,
          headerScore: 0,
          estimatedAccuracy: 0,
        },
      };
    }
  }

  /**
   * Collect user feedback on proposed header
   */
  collectFeedback(
    header: HeaderProposal,
    action: 'approve' | 'reject' | 'modify' | 'suggest',
    message?: string
  ): void {
    const feedback = this.feedbackCollector.collectFeedback(header, action, message);
    this.feedbackStorage.saveFeedback(feedback);
  }

  /**
   * Run learning epoch using Week 4 Learning Engine
   */
  async runLearningEpoch(): Promise<any> {
    // Get feedbacks by session - aggregate from storage
    const feedbacks = this.feedbackStorage.getFeedbackBySession(this.sessionId);

    // Update patterns from feedback
    const patternUpdates = this.patternUpdater.updatePatterns(feedbacks);

    // Update confidence weights
    const stats = this.feedbackStorage.calculateStats();
    const confidenceMetrics = this.confidenceUpdater.updateConfidenceWeights(
      feedbacks,
      stats
    );

    // Generate learning metadata for each operation
    if (feedbacks.length > 0 && Object.keys(stats.operationStats).length > 0) {
      const firstOperation = Object.keys(stats.operationStats)[0];
      const firstOpStats = stats.operationStats[firstOperation];
      const learningMetadata = this.metaLearner.generateLearningMetadata(
        firstOperation,
        patternUpdates,
        confidenceMetrics,
        {
          operation: firstOperation,
          totalFeedback: firstOpStats.count,
          approvalRate: firstOpStats.approvalRate,
          rejectionRate: 0,
          modificationRate: 0,
          avgAccuracy: firstOpStats.averageAccuracy,
          lastUpdated: Date.now(),
        }
      );
    }

    // Run full learning epoch
    return await this.learningEngine.runLearningEpoch();
  }

  /**
   * Get comprehensive pipeline statistics
   */
  getStats(): PipelineStats {
    const stats = this.feedbackStorage.calculateStats();
    const weights = this.confidenceUpdater.getCurrentWeights();

    const operationCounts = new Map<string, number>();
    for (const [op, opStats] of Object.entries(stats.operationStats)) {
      operationCounts.set(op, opStats.count);
    }

    const successCount = this.processHistory.filter((p) => p.success).length;
    const failureCount = this.processHistory.filter((p) => !p.success).length;

    const avgConfidence =
      this.processHistory.length > 0
        ? this.processHistory.reduce((sum, p) => sum + p.confidence, 0) /
          this.processHistory.length
        : 0;

    const avgAccuracy =
      this.processHistory.length > 0
        ? this.processHistory.reduce((sum, p) => sum + p.metadata.estimatedAccuracy, 0) /
          this.processHistory.length
        : 0;

    return {
      totalProcessed: this.processHistory.length,
      successCount,
      failureCount,
      avgConfidence,
      avgAccuracy,
      operationCounts,
      lastProcessed: this.processHistory.length > 0 ? new Date() : null,
    };
  }

  /**
   * Generate comprehensive pipeline report
   */
  generateReport(): string {
    const stats = this.getStats();
    const feedbackStats = this.feedbackStorage.calculateStats();
    const learningMetadata = this.metaLearner.getLearningMetadata();
    const weights = this.confidenceUpdater.getCurrentWeights();

    let report = `\n=== FreeLang Pipeline Integration Report ===\n\n`;

    // Summary
    report += `📊 Pipeline Summary\n`;
    report += `  • Total Processed: ${stats.totalProcessed}\n`;
    report += `  • Successful: ${stats.successCount} (${((stats.successCount / Math.max(1, stats.totalProcessed)) * 100).toFixed(1)}%)\n`;
    report += `  • Failed: ${stats.failureCount}\n`;
    report += `  • Avg Confidence: ${(stats.avgConfidence * 100).toFixed(1)}%\n`;
    report += `  • Avg Accuracy: ${(stats.avgAccuracy * 100).toFixed(1)}%\n\n`;

    // Operation Distribution
    report += `🔧 Operation Distribution\n`;
    for (const [op, count] of stats.operationCounts) {
      report += `  • ${op}: ${count} times\n`;
    }
    report += `\n`;

    // Feedback Analysis (Week 3)
    report += `💬 Feedback Analysis\n`;
    report += `  • Total Feedbacks: ${feedbackStats.totalFeedback}\n`;
    report += `  • Approved: ${feedbackStats.approved} (${((feedbackStats.approved / Math.max(1, feedbackStats.totalFeedback)) * 100).toFixed(1)}%)\n`;
    report += `  • Rejected: ${feedbackStats.rejected} (${((feedbackStats.rejected / Math.max(1, feedbackStats.totalFeedback)) * 100).toFixed(1)}%)\n`;
    report += `  • Modified: ${feedbackStats.modified} (${((feedbackStats.modified / Math.max(1, feedbackStats.totalFeedback)) * 100).toFixed(1)}%)\n\n`;

    // Confidence Weights (Week 4)
    report += `⚖️ Confidence Weights\n`;
    report += `  • Pattern Match: ${(weights.patternMatch * 100).toFixed(1)}%\n`;
    report += `  • Type Inference: ${(weights.typeInference * 100).toFixed(1)}%\n`;
    report += `  • Intent Clarity: ${(weights.intentClarity * 100).toFixed(1)}%\n`;
    report += `  • Similarity: ${(weights.similarity * 100).toFixed(1)}%\n\n`;

    // Learning Progress (Week 4)
    report += `📈 Learning Progress\n`;
    const overallProgress = this.metaLearner.getOverallProgress();
    report += `  • Overall Progress: ${(overallProgress * 100).toFixed(1)}%\n`;
    report += `  • Sessions: ${learningMetadata.length}\n`;
    report += `\n`;

    report += `=== End of Report ===\n`;
    return report;
  }

  /**
   * Get all process history
   */
  getHistory(): PipelineOutput[] {
    return [...this.processHistory];
  }

  /**
   * Clear pipeline state (for testing)
   */
  clear(): void {
    this.processHistory = [];
    this.sessionId = `session-${Date.now()}`;
  }

  /**
   * Estimate accuracy based on header confidence and validation
   */
  private estimateAccuracy(header: HeaderProposal): number {
    // Combine confidence with directive-based heuristics
    const confidenceFactor = header.confidence;
    const directiveFactor = this.getDirectiveAccuracy(header.directive);
    return (confidenceFactor + directiveFactor) / 2;
  }

  /**
   * Get accuracy estimate based on directive
   */
  private getDirectiveAccuracy(directive: string): number {
    const accuracyMap: { [key: string]: number } = {
      '@basic': 0.75,
      '@optimized': 0.85,
      '@experimental': 0.6,
      '@adaptive': 0.8,
    };
    return accuracyMap[directive] || 0.7;
  }
}
