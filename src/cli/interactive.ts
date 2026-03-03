// @ts-nocheck
/**
 * Phase 9.1: Enhanced Interactive CLI Mode
 *
 * 대화형 모드: 명령 처리, 자동완성, 히스토리
 */

import { autocompleteDB } from '../engine/autocomplete-db';
import { feedbackCollector } from '../feedback/collector';
import { patternUpdater } from '../learning/pattern-updater';
import { dashboard } from '../dashboard/dashboard';

export interface CLICommand {
  action: 'approve' | 'reject' | 'modify' | 'help' | 'history' | 'stats' | 'quit';
  input?: string;
  modification?: Record<string, string>;
}

export class InteractiveMode {
  private history: string[] = [];
  private maxHistorySize: number = 100;
  private currentInput: string = '';
  private suggestions: string[] = [];

  /**
   * 명령 파싱
   */
  parseCommand(input: string): CLICommand {
    const trimmed = input.trim().toLowerCase();

    if (trimmed === 'quit' || trimmed === 'exit' || trimmed === 'q') {
      return { action: 'quit' };
    }

    if (trimmed === 'help' || trimmed === '?') {
      return { action: 'help' };
    }

    if (trimmed === 'history') {
      return { action: 'history' };
    }

    if (trimmed === 'stats') {
      return { action: 'stats' };
    }

    if (trimmed === 'approve' || trimmed === 'a' || trimmed === 'yes') {
      return { action: 'approve' };
    }

    if (trimmed === 'reject' || trimmed === 'r' || trimmed === 'no') {
      return { action: 'reject' };
    }

    if (trimmed.startsWith('modify') || trimmed.startsWith('m ')) {
      const parts = trimmed.split(' ');
      return {
        action: 'modify',
        modification: this.parseModification(parts.slice(1).join(' ')),
      };
    }

    // 기본: 새 입력
    return { action: 'approve', input: input };
  }

  /**
   * 수정 내용 파싱
   */
  private parseModification(input: string): Record<string, string> {
    const modification: Record<string, string> = {};

    // "fn:newname input:array output:number" 형식 파싱
    const parts = input.split(' ');
    for (const part of parts) {
      if (part.includes(':')) {
        const [key, value] = part.split(':');
        modification[key.trim()] = value.trim();
      }
    }

    return modification;
  }

  /**
   * 자동완성 제안
   */
  getAutocompletesuggestions(prefix: string): string[] {
    if (!prefix || prefix.length < 1) {
      return [];
    }

    const result = autocompleteDB.search({ prefix, limit: 10 });
    return result.items.map(item => item.id);
  }

  /**
   * 자동완성 표시
   */
  showAutocompleteSuggestions(input: string): void {
    const suggestions = this.getAutocompletesuggestions(input);
    this.suggestions = suggestions;
  }

  /**
   * 히스토리 기록
   */
  recordHistory(command: string): void {
    if (command.trim()) {
      this.history.push(command);
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      }
    }
  }

  /**
   * 히스토리 조회
   */
  getHistory(limit: number = 10): string[] {
    return this.history.slice(-limit);
  }

  /**
   * 히스토리 클리어
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * 도움말 표시
   */
  showHelp(): string {
    return `
📚 FreeLang v2 CLI - 도움말

명령어:
  [A]      - 제안 승인 (approve)
  [R]      - 제안 거부 (reject)
  [M]      - 제안 수정 (modify fn:name input:type output:type)
  [?]      - 도움말 표시
  history  - 최근 명령어 표시
  stats    - 학습 통계 표시
  quit     - 종료

예시:
  > 배열 합산
  > A           # 승인
  > M fn:sumAll # 함수명 수정
  > R           # 거부

자동완성:
  Tab 키: 다음 제안으로 이동
  Enter: 현재 제안 선택
    `;
  }

  /**
   * 통계 표시
   */
  showStats(): string {
    const stats = dashboard.getStats();
    const progress = dashboard.getLearningProgress();

    return `
📊 학습 통계

패턴:
  • 전체: ${stats.total_patterns}개
  • 평균 신뢰도: ${(stats.avg_confidence * 100).toFixed(0)}%
  • 평균 승인율: ${(stats.avg_approval_rate * 100).toFixed(0)}%

피드백:
  • 총 기록: ${stats.total_feedbacks}개

학습:
  • 완료: ${progress.improved_patterns}/${progress.total_patterns} (${progress.progress_percentage.toFixed(1)}%)
    `;
  }

  /**
   * 히스토리 표시
   */
  showHistory(): string {
    const hist = this.getHistory(10);
    if (hist.length === 0) {
      return '📋 히스토리가 없습니다.';
    }

    const lines = hist.map((cmd, i) => `  ${i + 1}. ${cmd}`);
    return `📋 최근 명령어:\n${lines.join('\n')}`;
  }

  /**
   * 제안 표시 (포맷팅)
   */
  formatProposal(
    input: string,
    fnName: string,
    confidence: number,
    reason: string
  ): string {
    const confidenceBar = this.createProgressBar(confidence, 20);
    const confidencePercent = (confidence * 100).toFixed(0);

    return `
🤖 AI 제안:
  입력: "${input}"
  함수: fn ${fnName}()
  신뢰도: [${confidenceBar}] ${confidencePercent}%
  이유: ${reason}

선택: [A]ppove [R]eject [M]odify [?]Help [Q]uit
    `;
  }

  /**
   * 진행 바 생성
   */
  private createProgressBar(ratio: number, width: number): string {
    const filled = Math.round(ratio * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * 프롬프트 표시
   */
  showPrompt(): string {
    return '\n❯ 입력하세요: ';
  }

  /**
   * 피드백 기록
   */
  recordFeedback(
    input: string,
    fnName: string,
    action: 'approve' | 'reject' | 'modify',
    modification?: Record<string, string>
  ): boolean {
    try {
      // HeaderProposal 구성
      const proposal = {
        header: `fn ${fnName}()`,
        fnName,
        inputType: 'unknown',
        outputType: 'unknown',
        reason: 'cli-input',
        directive: '@basic',
        confidence: 0.75,
        alternatives: [],
        matchedPattern: fnName,
      };

      // 피드백 기록
      feedbackCollector.recordFeedback(input, proposal, action, modification);

      // 패턴 업데이트 (선택적)
      if (action === 'approve') {
        patternUpdater.recordApproval(fnName);
      } else if (action === 'reject') {
        patternUpdater.recordRejection(fnName);
      } else if (action === 'modify') {
        patternUpdater.recordModification(fnName, {});
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 초기화 (테스트용)
   */
  clear(): void {
    this.history = [];
    this.currentInput = '';
    this.suggestions = [];
  }
}

// 싱글톤 인스턴스
export const interactiveMode = new InteractiveMode();
