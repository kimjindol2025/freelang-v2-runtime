/**
 * Phase 6.2 Week 3: PartialExecutor
 *
 * Incomplete code 실행:
 * - ??? 마커 전까지 실행
 * - ... 마커 전까지 실행
 * - 자동 stub 생성
 * - 중간 결과 반환
 */

import { SmartREPL, ExecutionResult } from './smart-repl';
import { IntentParser, RecognizedIntent } from './intent-parser';

/**
 * 스킵된 코드 정보
 */
export interface SkippedSection {
  startLine: number;
  endLine: number;
  marker: string;  // '???' or '...'
  content: string;
}

/**
 * 부분 실행 결과
 */
export interface PartialExecutionResult extends ExecutionResult {
  partial: true;
  skippedSections: SkippedSection[];
  executedLines: number;
  skippedLines: number;
  completionRate: number;  // 0-100
  generatedStubs: Map<string, string>;  // 변수 -> stub 코드
}

/**
 * PartialExecutor: 불완전한 코드 실행
 */
export class PartialExecutor {
  private repl: SmartREPL;
  private parser: IntentParser;

  constructor(repl?: SmartREPL, parser?: IntentParser) {
    this.repl = repl || new SmartREPL();
    this.parser = parser || new IntentParser();
  }

  /**
   * 부분 코드 실행
   */
  execute(code: string): PartialExecutionResult {
    const lines = code.split('\n');
    const skippedSections: SkippedSection[] = [];
    const generatedStubs = new Map<string, string>();

    let executedCode = '';
    let executedLines = 0;
    let skippedLines = 0;
    let currentSection = { start: 0, marker: '' };

    // 1. 코드 분할: 실행 부분과 스킵 부분
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('???')) {
        // ??? 마커 - 여기서 중단
        if (executedCode) {
          executedLines = i;
        }
        skippedSections.push({
          startLine: i,
          endLine: lines.length,
          marker: '???',
          content: lines.slice(i).join('\n'),
        });
        skippedLines = lines.length - i;
        break;
      }

      if (line.includes('...')) {
        // ... 마커 - 여기서 중단
        if (executedCode) {
          executedLines = i;
        }
        skippedSections.push({
          startLine: i,
          endLine: lines.length,
          marker: '...',
          content: lines.slice(i).join('\n'),
        });
        skippedLines = lines.length - i;
        break;
      }

      // 주석과 빈 줄 제외
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//')) {
        executedCode += line + '\n';
        executedLines++;
      }
    }

    // 2. 실행 코드가 없으면 처리
    if (!executedCode.trim()) {
      return this.createPartialResult(
        undefined,
        [],
        0,
        lines.length,
        generatedStubs
      );
    }

    // 3. 실행 코드 실행
    const result = this.repl.execute(executedCode.trim());

    // 4. 부분 실행 결과 생성
    return this.createPartialResult(
      result,
      skippedSections,
      executedLines,
      skippedLines,
      generatedStubs
    );
  }

  /**
   * 불완전한 코드 자동 완성 (스텁 생성)
   */
  generateStubs(skippedCode: string): Map<string, string> {
    const stubs = new Map<string, string>();

    // 변수 선언 감지
    const varPattern = /let\s+(\w+)\s*=/g;
    let match;

    while ((match = varPattern.exec(skippedCode)) !== null) {
      const varName = match[1];
      stubs.set(varName, `let ${varName} = null  // TODO: stub`);
    }

    // 함수 호출 감지
    const funcPattern = /(\w+)\s*\(/g;
    const funcMatches = new Set<string>();

    while ((match = funcPattern.exec(skippedCode)) !== null) {
      const funcName = match[1];
      if (!['if', 'for', 'while', 'let'].includes(funcName)) {
        funcMatches.add(funcName);
      }
    }

    // 함수 스텁 생성
    for (const funcName of funcMatches) {
      stubs.set(
        `${funcName}()`,
        `fn ${funcName}() { return null }  // TODO: implement`
      );
    }

    return stubs;
  }

  /**
   * 코드 구조 분석
   */
  analyzeStructure(code: string): {
    hasPartialMarker: boolean;
    markerType: string;
    executionPercentage: number;
    warnings: string[];
  } {
    const hasQuestion = code.includes('???');
    const hasEllipsis = code.includes('...');
    const hasPartialMarker = hasQuestion || hasEllipsis;

    const lines = code.split('\n');
    const executedLines = lines.findIndex(
      (l) => l.includes('???') || l.includes('...')
    );
    const executionPercentage =
      executedLines === -1
        ? 100
        : Math.round((executedLines / lines.length) * 100);

    const warnings: string[] = [];
    if (hasPartialMarker) {
      warnings.push(
        `⚠️ Partial code detected: ${hasQuestion ? '???' : '...'} marker found`
      );
    }

    return {
      hasPartialMarker,
      markerType: hasQuestion ? '???' : '...',
      executionPercentage,
      warnings,
    };
  }

  /**
   * 스킵된 섹션 요약
   */
  summarizeSkipped(skipped: SkippedSection[]): string {
    if (skipped.length === 0) return 'No skipped sections';

    return skipped
      .map(
        (s) =>
          `Lines ${s.startLine}-${s.endLine}: ${s.marker} marker\n${s.content.substring(0, 50)}...`
      )
      .join('\n');
  }

  /**
   * 부분 실행 결과 생성 (내부)
   */
  private createPartialResult(
    executionResult: ExecutionResult | undefined,
    skippedSections: SkippedSection[],
    executedLines: number,
    skippedLines: number,
    generatedStubs: Map<string, string>
  ): PartialExecutionResult {
    const totalLines = executedLines + skippedLines;
    const completionRate =
      totalLines > 0 ? Math.round((executedLines / totalLines) * 100) : 0;

    return {
      success: executionResult?.success ?? false,
      result: executionResult?.result,
      executionTime: executionResult?.executionTime ?? 0,
      memory: executionResult?.memory ?? 0,
      type: executionResult?.type ?? 'undefined',
      error: executionResult?.error,
      warnings: [
        ...(executionResult?.warnings ?? []),
        `⚠️ Partial execution: ${completionRate}% complete`,
      ],
      metadata: {
        linesExecuted: executedLines,
        statementsExecuted: executionResult?.metadata.statementsExecuted ?? 0,
        partial: true,
      },
      partial: true,
      skippedSections,
      executedLines,
      skippedLines,
      completionRate,
      generatedStubs,
    };
  }

  /**
   * 부분 코드 복구 (스텁 기반)
   */
  recoverWithStubs(code: string): {
    recovered: string;
    stubs: Map<string, string>;
    recoveryRate: number;
  } {
    const skippedStart = Math.max(
      code.indexOf('???'),
      code.indexOf('...')
    );

    if (skippedStart === -1) {
      // No partial marker
      return {
        recovered: code,
        stubs: new Map(),
        recoveryRate: 100,
      };
    }

    const skipped = code.substring(skippedStart);
    const stubs = this.generateStubs(skipped);
    const stubCount = stubs.size;

    // 스텁으로 부분 코드 대체
    let recovered = code.substring(0, skippedStart);
    for (const [key, stub] of stubs) {
      recovered += '\n' + stub;
    }

    // 회복률 = (stub으로 채운 변수/함수) / (필요한 변수/함수)
    const recoveryRate =
      stubCount > 0 ? Math.min(100, Math.round((stubCount / (stubCount + 1)) * 100)) : 0;

    return { recovered, stubs, recoveryRate };
  }
}

/**
 * 글로벌 인스턴스
 */
export const globalPartialExecutor = new PartialExecutor();
