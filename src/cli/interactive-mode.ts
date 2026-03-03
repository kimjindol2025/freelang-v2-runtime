/**
 * FreeLang v2 - Interactive CLI Mode (Task 3.4)
 * Interactive feedback loop for header generation and validation
 * Continuous iteration with user choice handling
 */

import * as readline from 'readline';
import { HeaderGenerator, HeaderProposal } from '../engine/header-generator';
import { HeaderValidator } from '../engine/header-validator';
import { FeedbackCollector } from '../feedback/feedback-collector';
import { FeedbackStorage } from '../feedback/feedback-storage';
import { FeedbackAnalyzer } from '../feedback/feedback-analyzer';
import { IntentMatcher } from '../engine/intent-matcher';
import { TextNormalizer } from '../engine/text-normalizer';

export interface InteractiveSession {
  sessionId: string;
  startTime: number;
  totalIterations: number;
  successCount: number;
  feedbacks: number;
  lastStats?: any;
}

export class InteractiveMode {
  private rl: readline.Interface;
  private collector: FeedbackCollector;
  private storage: FeedbackStorage;
  private analyzer: FeedbackAnalyzer;
  private session: InteractiveSession;
  private running: boolean = false;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.collector = new FeedbackCollector();
    this.storage = new FeedbackStorage();
    this.analyzer = new FeedbackAnalyzer(this.storage);

    this.session = {
      sessionId: this.collector.getSession().id,
      startTime: Date.now(),
      totalIterations: 0,
      successCount: 0,
      feedbacks: 0,
      lastStats: null,
    };
  }

  /**
   * Main interactive loop
   */
  async start(): Promise<void> {
    this.running = true;
    this._printWelcome();

    while (this.running) {
      const userInput = await this._prompt('\n📝 헤더 설명 (또는 "exit"): ');

      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
        this._printGoodbye();
        break;
      }

      if (userInput.toLowerCase() === 'stats') {
        this._printStats();
        continue;
      }

      if (userInput.toLowerCase() === 'help') {
        this._printHelp();
        continue;
      }

      // Process intent
      const normalizedTokens = TextNormalizer.normalize(userInput);
      const intentMatch = IntentMatcher.matchIntent(normalizedTokens);
      if (!intentMatch) {
        console.log('❌ Intent를 인식할 수 없습니다. 예: "합산 함수", "필터링", "정렬"');
        continue;
      }

      this.session.totalIterations++;

      // Generate header
      const proposal = HeaderGenerator.generateHeader(
        intentMatch.operation,
        intentMatch.confidence
      );

      if (!proposal) {
        console.log('❌ 헤더 생성에 실패했습니다.');
        continue;
      }

      // Validate header
      const validation = HeaderValidator.validate(proposal);
      if (!validation.valid) {
        console.log('\n⚠️  헤더 검증 실패:');
        console.log(`점수: ${(validation.score * 100).toFixed(1)}%`);
        validation.errors.forEach((err) => {
          console.log(`  - [${err.type}] ${err.message}`);
        });
        continue;
      }

      // Display proposal for review
      this._printProposal(proposal, intentMatch);

      // Get user feedback
      const action = await this._getUserChoice();
      if (!action) {
        console.log('❌ 유효하지 않은 선택입니다.');
        continue;
      }

      let message: string | undefined;
      if (action === 'modify') {
        message = await this._prompt('수정 사항을 입력하세요: ');
      } else if (action === 'suggest') {
        message = await this._prompt('재제안 내용을 입력하세요: ');
      }

      // Collect feedback
      const feedback = this.collector.collectFeedback(proposal, action, message);
      this.storage.saveFeedback(feedback);
      this.session.feedbacks++;

      // Provide feedback
      this._printFeedbackReceived(action, feedback);

      // Show real-time stats
      const stats = this.storage.calculateStats();
      if (stats.totalFeedback % 5 === 0) {
        this._printProgressStats(stats);
      }
    }

    this.rl.close();
  }

  /**
   * Display formatted proposal with 4 choices
   */
  private _printProposal(proposal: HeaderProposal, intentMatch: any): void {
    console.log('\n' + this.collector.formatProposalForReview(proposal));
  }

  /**
   * Get user choice interactively
   */
  private async _getUserChoice(): Promise<
    'approve' | 'modify' | 'suggest' | 'reject' | null
  > {
    const choice = await this._prompt('선택 (1-4): ');
    return this.collector.parseUserChoice(choice);
  }

  /**
   * Print feedback received confirmation
   */
  private _printFeedbackReceived(
    action: 'approve' | 'modify' | 'suggest' | 'reject',
    feedback: any
  ): void {
    const actionLabel = {
      approve: '✅ 승인됨',
      modify: '✏️  수정됨',
      suggest: '🔄 재제안됨',
      reject: '❌ 거부됨',
    };

    console.log(
      `\n${actionLabel[action]} (ID: ${feedback.id.substring(0, 8)}...)`
    );
    console.log(`정확도: ${(feedback.analysis.accuracy * 100).toFixed(1)}%`);
  }

  /**
   * Print real-time statistics
   */
  private _printProgressStats(stats: any): void {
    const approvalRate = (
      (stats.approved / stats.totalFeedback) *
      100
    ).toFixed(1);
    const accuracy = (stats.averageAccuracy * 100).toFixed(1);

    console.log('\n📊 현재 통계:');
    console.log(`  총 피드백: ${stats.totalFeedback}`);
    console.log(`  승인율: ${approvalRate}%`);
    console.log(`  평균 정확도: ${accuracy}%`);

    if (stats.totalFeedback >= 10) {
      const analysis = this.analyzer.analyze();
      if (analysis.insights.length > 0) {
        console.log('\n💡 인사이트:');
        analysis.insights.slice(0, 2).forEach((insight) => {
          console.log(`  ${insight}`);
        });
      }
    }
  }

  /**
   * Print session statistics
   */
  private _printStats(): void {
    const stats = this.storage.calculateStats();
    const elapsed = ((Date.now() - this.session.startTime) / 1000 / 60).toFixed(
      1
    );

    console.log('\n═══════════════════════════════════════════════════');
    console.log('📈 세션 통계');
    console.log('═══════════════════════════════════════════════════');
    console.log(`세션 ID: ${this.session.sessionId}`);
    console.log(`경과 시간: ${elapsed}분`);
    console.log(`총 반복: ${this.session.totalIterations}`);
    console.log(`총 피드백: ${stats.totalFeedback}`);
    console.log(
      `승인: ${stats.approved} (${((stats.approved / stats.totalFeedback) * 100).toFixed(1)}%)`
    );
    console.log(
      `수정: ${stats.modified} (${((stats.modified / stats.totalFeedback) * 100).toFixed(1)}%)`
    );
    console.log(
      `거부: ${stats.rejected} (${((stats.rejected / stats.totalFeedback) * 100).toFixed(1)}%)`
    );
    console.log(`평균 정확도: ${(stats.averageAccuracy * 100).toFixed(1)}%`);

    // Operation stats
    if (Object.keys(stats.operationStats).length > 0) {
      console.log('\n📊 Operation별 통계:');
      Object.entries(stats.operationStats).forEach(([op, stat]: any) => {
        console.log(`  ${op}:`);
        console.log(`    - 개수: ${stat.count}`);
        console.log(
          `    - 승인율: ${(stat.approvalRate * 100).toFixed(1)}%`
        );
      });
    }

    console.log('═══════════════════════════════════════════════════\n');
  }

  /**
   * Print welcome message
   */
  private _printWelcome(): void {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║       🚀 FreeLang v2 - Interactive Mode            ║');
    console.log('║       AI-First Header Generation & Feedback        ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    console.log(
      '💡 팁: "stats"으로 통계 보기, "help"으로 도움말, "exit"으로 종료\n'
    );
  }

  /**
   * Print help message
   */
  private _printHelp(): void {
    console.log('\n📖 사용법:');
    console.log('  - 헤더 설명 입력: "배열 더하기", "필터링 함수" 등');
    console.log('  - 제안된 헤더에 대해 선택:');
    console.log('    [1] ✅ 승인   - 제안이 맞습니다');
    console.log('    [2] ✏️ 수정   - 수정이 필요합니다');
    console.log('    [3] 🔄 재제안 - 다시 시도해주세요');
    console.log('    [4] ❌ 취소   - 완전히 틀렸습니다');
    console.log('  - stats: 현재 세션 통계 보기');
    console.log('  - exit: 프로그램 종료\n');
  }

  /**
   * Print goodbye message
   */
  private _printGoodbye(): void {
    const stats = this.storage.calculateStats();
    const elapsed = ((Date.now() - this.session.startTime) / 1000 / 60).toFixed(
      1
    );

    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║          👋 FreeLang Interactive 종료              ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    console.log('📊 최종 통계:');
    console.log(`  세션 시간: ${elapsed}분`);
    console.log(`  총 반복: ${this.session.totalIterations}`);
    console.log(`  총 피드백: ${stats.totalFeedback}`);
    console.log(`  평균 정확도: ${(stats.averageAccuracy * 100).toFixed(1)}%`);
    console.log(`  승인율: ${((stats.approved / stats.totalFeedback) * 100).toFixed(1)}%\n`);

    // Final analysis
    if (stats.totalFeedback >= 5) {
      const analysis = this.analyzer.analyze();
      console.log('💡 최종 분석:');
      analysis.insights.forEach((insight) => {
        console.log(`  ${insight}`);
      });
    }

    console.log('\n감사합니다!\n');
  }

  /**
   * Prompts user for input
   */
  private _prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  /**
   * Get current session data
   */
  getSession(): InteractiveSession {
    return this.session;
  }

  /**
   * Export session data
   */
  exportSession(): any {
    return {
      session: this.session,
      feedbacks: this.storage.exportFeedbacks(),
      stats: this.storage.calculateStats(),
      analysis: this.analyzer.analyze(),
    };
  }
}
