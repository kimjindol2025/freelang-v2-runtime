/**
 * Phase 9.1 → Phase 18: Batch Mode CLI + VM Execution
 *
 * 배치 모드: 파일 입력, 결과 저장
 * + Phase 18: IR 생성 및 VM 실행
 */

import { interactiveMode } from './interactive';
import { dashboard } from '../dashboard/dashboard';
import { IRGenerator } from '../codegen/ir-generator';
import { VM } from '../vm';
import { Parser } from '../parser/parser';

export interface BatchResult {
  input: string;
  fnName: string;
  confidence: number;
  action: 'approve' | 'reject' | 'modify';
  success: boolean;
  timestamp: Date;
  // Phase 18: VM execution results
  executionResult?: number | null;
  executionTime?: number; // ms
}

export class BatchMode {
  private results: BatchResult[] = [];

  /**
   * 파일에서 입력 읽기
   */
  async readInputFile(filepath: string): Promise<string[]> {
    try {
      const fs = require('fs');
      const content = fs.readFileSync(filepath, 'utf-8');
      return content
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line && !line.startsWith('#'));
    } catch (error) {
      throw new Error(`파일 읽기 실패: ${filepath}`);
    }
  }

  /**
   * 배치 처리
   */
  async processBatch(inputs: string[]): Promise<BatchResult[]> {
    this.results = [];

    for (const input of inputs) {
      if (!input.trim()) continue;

      const result = this.processInput(input);
      this.results.push(result);
    }

    return this.results;
  }

  /**
   * Phase 18: VM 기반 코드 실행 + 분석
   */
  private processInput(input: string): BatchResult {
    try {
      const fnName = 'execute';
      let executionResult: number | null = null;
      let executionTime = 0;
      let success = false;

      // Phase 18 Day 1: 시뮬레이션된 AST 생성
      // 실제로는 Parser를 사용하여 AST 생성
      const ast = this.simpleParseArithmetic(input);

      if (ast) {
        // IR 생성
        const gen = new IRGenerator();
        const ir = gen.generateIR(ast);

        // VM 실행
        const vm = new VM();
        const start = performance.now();
        const result = vm.run(ir);
        executionTime = performance.now() - start;

        if (result.ok) {
          executionResult = result.value as number;
          success = true;
        }
      }

      return {
        input,
        fnName,
        confidence: success ? 0.95 : 0.0,
        action: success ? 'approve' : 'reject',
        success,
        timestamp: new Date(),
        executionResult,
        executionTime,
      };
    } catch (error) {
      return {
        input,
        fnName: 'error',
        confidence: 0,
        action: 'reject',
        success: false,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Phase 18 Day 1: 간단한 산술식 파싱
   * 실제로는 Parser를 사용해야 함
   */
  private simpleParseArithmetic(input: string): any | null {
    input = input.trim();

    // 숫자 + 연산자 + 숫자 형태 감지
    const match = input.match(/^(\d+)\s*([\+\-\*\/\%])\s*(\d+)$/);
    if (match) {
      const [_, left, op, right] = match;
      return {
        type: 'BinaryOp',
        operator: op,
        left: { type: 'NumberLiteral', value: parseInt(left) },
        right: { type: 'NumberLiteral', value: parseInt(right) }
      };
    }

    // 단일 숫자
    if (/^\d+$/.test(input)) {
      return {
        type: 'NumberLiteral',
        value: parseInt(input)
      };
    }

    return null;
  }

  /**
   * 결과 저장
   */
  async saveResults(filepath: string): Promise<boolean> {
    try {
      const fs = require('fs');
      const content = this.exportAsJSON();
      fs.writeFileSync(filepath, content);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 결과를 JSON 형식으로 내보내기
   */
  exportAsJSON(): string {
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        total: this.results.length,
        successful: this.results.filter(r => r.success).length,
        results: this.results,
      },
      null,
      2
    );
  }

  /**
   * 결과를 CSV 형식으로 내보내기
   */
  exportAsCSV(): string {
    const headers = ['Input', 'FunctionName', 'Confidence', 'Action', 'Success', 'Timestamp'];
    const rows = this.results.map(r => [
      `"${r.input}"`,
      r.fnName,
      r.confidence.toFixed(2),
      r.action,
      r.success ? 'Yes' : 'No',
      r.timestamp.toISOString(),
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * 결과 요약
   */
  summarize(): string {
    const total = this.results.length;
    const successful = this.results.filter(r => r.success).length;
    const approved = this.results.filter(r => r.action === 'approve').length;
    const rejected = this.results.filter(r => r.action === 'reject').length;
    const modified = this.results.filter(r => r.action === 'modify').length;

    return `
📊 배치 처리 결과

총계:
  • 처리됨: ${total}개
  • 성공: ${successful}개 (${total > 0 ? ((successful / total) * 100).toFixed(0) : 0}%)
  • 실패: ${total - successful}개

액션:
  • 승인: ${approved}개
  • 거부: ${rejected}개
  • 수정: ${modified}개

평균 신뢰도: ${
      this.results.length > 0
        ? (
            this.results.reduce((sum, r) => sum + r.confidence, 0) /
            this.results.length
          ).toFixed(2)
        : '0.00'
    }
    `;
  }

  /**
   * 초기화 (테스트용)
   */
  clear(): void {
    this.results = [];
  }
}

// 싱글톤 인스턴스
export const batchMode = new BatchMode();
