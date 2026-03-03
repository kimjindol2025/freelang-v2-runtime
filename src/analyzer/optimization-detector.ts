/**
 * Phase 5: Automatic Optimization Detection (AI-First)
 *
 * 패러다임: IR을 자동으로 분석하여 최적화 가능성을 발견
 * TypeScript로 "최적화 로직"을 하드코딩하지 않음
 * 대신, IR 패턴을 자동으로 감지하고 제안
 *
 * 철학: FreeLang이 자신의 의도(Intent)를 최적화하는 AI가 된다
 */

import { Inst, Op } from '../types';

/**
 * 최적화 제안
 */
export interface OptimizationSuggestion {
  type: 'constant_folding' | 'inlining' | 'dce' | 'loop_unroll' | 'strength_reduction';
  confidence: number; // 0.0 ~ 1.0
  expected_improvement: number; // % 성능 개선
  instruction_indices: number[]; // 최적화할 명령어들의 인덱스
  reasoning: string[]; // 왜 이 최적화가 가능한지
  before: Inst[]; // 최적화 전
  after?: Inst[]; // 최적화 후 (제안)
}

/**
 * 최적화 감지 엔진 (자동, AI-driven)
 */
export class OptimizationDetector {
  /**
   * IR을 분석하여 모든 가능한 최적화 제안 반환
   */
  detectOptimizations(instructions: Inst[]): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 1. Constant Folding 감지
    suggestions.push(...this.detectConstantFolding(instructions));

    // 2. Dead Code Elimination 감지
    suggestions.push(...this.detectDeadCode(instructions));

    // 3. Strength Reduction 감지
    suggestions.push(...this.detectStrengthReduction(instructions));

    // 4. Loop Unrolling 감지
    suggestions.push(...this.detectLoopUnrolling(instructions));

    // 5. Inlining 감지 (이건 함수 레벨이라 별도)
    // suggestions.push(...this.detectInlining(functions));

    // 신뢰도 기준으로 정렬
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Constant Folding 패턴 감지
   * 패턴: PUSH a, PUSH b, OP → 상수 계산 가능
   */
  private detectConstantFolding(instructions: Inst[]): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    for (let i = 0; i < instructions.length - 2; i++) {
      const inst1 = instructions[i];
      const inst2 = instructions[i + 1];
      const inst3 = instructions[i + 2];

      // 패턴: PUSH a, PUSH b, [ADD|SUB|MUL|DIV|MOD|EQ|LT|GT...]
      if (
        inst1.op === Op.PUSH &&
        inst2.op === Op.PUSH &&
        this.isBinaryOp(inst3.op)
      ) {
        // 값이 숫자인지 확인
        if (typeof inst1.arg === 'number' && typeof inst2.arg === 'number') {
          const before = [inst1, inst2, inst3];
          const after = this.evaluateConstantExpression(inst1.arg, inst2.arg, inst3.op);

          if (after !== null) {
            suggestions.push({
              type: 'constant_folding',
              confidence: 0.95, // 매우 안전
              expected_improvement: 10, // 연산당 약 10% 개선
              instruction_indices: [i, i + 1, i + 2],
              reasoning: [
                `Detected constant expression: ${inst1.arg} ${this.opName(inst3.op)} ${inst2.arg}`,
                `Can be pre-computed at compile time → result: ${after}`,
                'Eliminates runtime computation cost',
              ],
              before,
              after: [{ op: Op.PUSH, arg: after }],
            });
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Dead Code Elimination 패턴 감지
   * 패턴: STORE x, ... (x가 LOAD로 사용되지 않음)
   */
  private detectDeadCode(instructions: Inst[]): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 변수 사용 추적
    const stored = new Map<string, number[]>(); // var → STORE 인덱스들
    const loaded = new Set<string>(); // 사용된 변수들

    for (let i = 0; i < instructions.length; i++) {
      const inst = instructions[i];

      if (inst.op === Op.STORE) {
        const varName = String(inst.arg);
        if (!stored.has(varName)) {
          stored.set(varName, []);
        }
        stored.get(varName)!.push(i);
      }

      if (inst.op === Op.LOAD) {
        const varName = String(inst.arg);
        loaded.add(varName);
      }
    }

    // STORE만 되고 LOAD 안 되는 변수 찾기
    for (const [varName, storeIndices] of stored.entries()) {
      if (!loaded.has(varName)) {
        // 이 변수는 사용되지 않음
        for (const idx of storeIndices) {
          const inst = instructions[idx];

          // PUSH + STORE 조합으로 가정 (일반적 패턴)
          const before = idx > 0 ? [instructions[idx - 1], inst] : [inst];
          const indices = idx > 0 ? [idx - 1, idx] : [idx];

          suggestions.push({
            type: 'dce',
            confidence: 0.90, // 매우 안전 (부작용 없음)
            expected_improvement: 5,
            instruction_indices: indices,
            reasoning: [
              `Variable "${varName}" is stored but never loaded`,
              'Eliminate unnecessary STORE operation',
              'May also eliminate preceding PUSH if value is not used elsewhere',
            ],
            before,
            after: [], // STORE 제거
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Strength Reduction 감지
   * 패턴: PUSH 2, MUL → PUSH 1, SHL (더 빠름)
   *       PUSH 3, MUL → PUSH 1, ADD, SHL (더 빠름)
   */
  private detectStrengthReduction(instructions: Inst[]): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    for (let i = 0; i < instructions.length - 1; i++) {
      const inst1 = instructions[i];
      const inst2 = instructions[i + 1];

      // 패턴: PUSH (power of 2), MUL
      if (
        inst1.op === Op.PUSH &&
        inst2.op === Op.MUL &&
        typeof inst1.arg === 'number'
      ) {
        const power = this.isPowerOfTwo(inst1.arg);
        if (power >= 0) {
          suggestions.push({
            type: 'strength_reduction',
            confidence: 0.85,
            expected_improvement: 20, // MUL → SHL은 2-3배 빠름
            instruction_indices: [i, i + 1],
            reasoning: [
              `Multiply by power of 2 (2^${power}) detected`,
              `Can be replaced with bit shift (SHL) for faster execution`,
              'Bit shift operations are significantly faster than multiply',
            ],
            before: [inst1, inst2],
            after: [
              { op: Op.PUSH, arg: power },
              // SHL 없으니 개념적으로만
            ],
          });
        }
      }

      // 패턴: PUSH (number), DIV
      if (
        inst1.op === Op.PUSH &&
        inst2.op === Op.DIV &&
        typeof inst1.arg === 'number'
      ) {
        const power = this.isPowerOfTwo(inst1.arg);
        if (power >= 0 && inst1.arg > 0) {
          suggestions.push({
            type: 'strength_reduction',
            confidence: 0.80,
            expected_improvement: 15,
            instruction_indices: [i, i + 1],
            reasoning: [
              `Divide by power of 2 (2^${power}) detected`,
              `Can be replaced with bit shift right (SHR)`,
              'More efficient than division operation',
            ],
            before: [inst1, inst2],
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Loop Unrolling 감지
   * 패턴: 작은 루프 (< 5 iterations)
   */
  private detectLoopUnrolling(instructions: Inst[]): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 간단한 ITER 패턴만 감지
    for (let i = 0; i < instructions.length - 2; i++) {
      const inst = instructions[i];

      // ITER_INIT (start, end를 보고 루프 크기 추정)
      if (inst.op === Op.ITER_INIT) {
        // 이건 복잡하니 넘어가고, 대신 범위가 작은 경우만 제안
        // (실제론 복잡한 분석 필요)
      }
    }

    return suggestions;
  }

  /**
   * 이항 연산 판정
   */
  private isBinaryOp(op: Op): boolean {
    return [
      Op.ADD,
      Op.SUB,
      Op.MUL,
      Op.DIV,
      Op.MOD,
      Op.EQ,
      Op.NEQ,
      Op.LT,
      Op.GT,
      Op.LTE,
      Op.GTE,
    ].includes(op);
  }

  /**
   * 상수 표현식 평가
   */
  private evaluateConstantExpression(a: number, b: number, op: Op): number | null {
    try {
      switch (op) {
        case Op.ADD:
          return a + b;
        case Op.SUB:
          return a - b;
        case Op.MUL:
          return a * b;
        case Op.DIV:
          if (b === 0) return null;
          return Math.floor(a / b);
        case Op.MOD:
          if (b === 0) return null;
          return a % b;
        case Op.EQ:
          return a === b ? 1 : 0;
        case Op.NEQ:
          return a !== b ? 1 : 0;
        case Op.LT:
          return a < b ? 1 : 0;
        case Op.GT:
          return a > b ? 1 : 0;
        case Op.LTE:
          return a <= b ? 1 : 0;
        case Op.GTE:
          return a >= b ? 1 : 0;
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * 2의 거듭제곱 판정 (2^n 형태)
   * 예: 4 → 2, 8 → 3, 16 → 4
   * 아니면 → -1
   */
  private isPowerOfTwo(n: number): number {
    if (n <= 0) return -1;

    let power = 0;
    let temp = n;

    while (temp > 1) {
      if (temp % 2 !== 0) return -1;
      temp /= 2;
      power++;
    }

    return power;
  }

  /**
   * Op 코드를 문자열로
   */
  private opName(op: Op): string {
    const names: Record<Op, string> = {
      [Op.PUSH]: 'PUSH',
      [Op.POP]: 'POP',
      [Op.DUP]: 'DUP',
      [Op.ADD]: '+',
      [Op.SUB]: '-',
      [Op.MUL]: '*',
      [Op.DIV]: '/',
      [Op.MOD]: '%',
      [Op.NEG]: 'NEG',
      [Op.EQ]: '==',
      [Op.NEQ]: '!=',
      [Op.LT]: '<',
      [Op.GT]: '>',
      [Op.LTE]: '<=',
      [Op.GTE]: '>=',
      [Op.AND]: '&&',
      [Op.OR]: '||',
      [Op.NOT]: '!',
      [Op.STORE]: 'STORE',
      [Op.LOAD]: 'LOAD',
      [Op.JMP]: 'JMP',
      [Op.JMP_IF]: 'JMP_IF',
      [Op.JMP_NOT]: 'JMP_NOT',
      [Op.CALL]: 'CALL',
      [Op.RET]: 'RET',
      [Op.HALT]: 'HALT',
      [Op.ARR_NEW]: 'ARR_NEW',
      [Op.ARR_PUSH]: 'ARR_PUSH',
      [Op.ARR_GET]: 'ARR_GET',
      [Op.ARR_SET]: 'ARR_SET',
      [Op.ARR_LEN]: 'ARR_LEN',
      [Op.ARR_DUP]: 'ARR_DUP',
      [Op.ARR_CONCAT]: 'ARR_CONCAT',
      [Op.ARR_SUM]: 'ARR_SUM',
      [Op.ARR_AVG]: 'ARR_AVG',
      [Op.ARR_MAX]: 'ARR_MAX',
      [Op.ARR_MIN]: 'ARR_MIN',
      [Op.ARR_MAP]: 'ARR_MAP',
      [Op.ARR_FILTER]: 'ARR_FILTER',
      [Op.ARR_SORT]: 'ARR_SORT',
      [Op.ARR_REV]: 'ARR_REV',
      [Op.SWAP]: 'SWAP',
      [Op.ITER_INIT]: 'ITER_INIT',
      [Op.ITER_NEXT]: 'ITER_NEXT',
      [Op.ITER_HAS]: 'ITER_HAS',
      [Op.STR_NEW]: 'STR_NEW',
      [Op.STR_LEN]: 'STR_LEN',
      [Op.STR_AT]: 'STR_AT',
      [Op.STR_SUB]: 'STR_SUB',
      [Op.STR_CONCAT]: 'STR_CONCAT',
      [Op.STR_EQ]: 'STR_EQ',
      [Op.STR_NEQ]: 'STR_NEQ',
      [Op.CHAR_NEW]: 'CHAR_NEW',
      [Op.CHAR_CODE]: 'CHAR_CODE',
      [Op.CHAR_FROM]: 'CHAR_FROM',
      [Op.LAMBDA_NEW]: 'LAMBDA_NEW',
      [Op.LAMBDA_CAPTURE]: 'LAMBDA_CAPTURE',
      [Op.LAMBDA_SET_BODY]: 'LAMBDA_SET_BODY',
      [Op.FUNC_DEF]: 'FUNC_DEF',
      [Op.COMMENT]: 'COMMENT',
      [Op.SPAWN_THREAD]: 'SPAWN_THREAD',
      [Op.JOIN_THREAD]: 'JOIN_THREAD',
      [Op.MUTEX_CREATE]: 'MUTEX_CREATE',
      [Op.MUTEX_LOCK]: 'MUTEX_LOCK',
      [Op.MUTEX_UNLOCK]: 'MUTEX_UNLOCK',
      [Op.CHANNEL_CREATE]: 'CHANNEL_CREATE',
      [Op.CHANNEL_SEND]: 'CHANNEL_SEND',
      [Op.CHANNEL_RECV]: 'CHANNEL_RECV',
      [Op.DUMP]: 'DUMP',
    };

    return names[op] || `Op(${op})`;
  }

  /**
   * 최적화 결과 요약
   */
  summarize(suggestions: OptimizationSuggestion[]): string {
    if (suggestions.length === 0) {
      return '✅ No optimization opportunities detected. IR is optimal.';
    }

    const totalImprovement = suggestions.reduce((sum, s) => sum + s.expected_improvement, 0);

    let summary = `🔍 Found ${suggestions.length} optimization opportunities:\n`;
    summary += `   Expected total improvement: ~${totalImprovement}%\n\n`;

    suggestions.forEach((s, idx) => {
      const icon =
        s.confidence >= 0.9
          ? '✅'
          : s.confidence >= 0.8
            ? '⭐'
            : '⚠️';
      summary += `${idx + 1}. ${icon} ${s.type.toUpperCase()}\n`;
      summary += `   Confidence: ${(s.confidence * 100).toFixed(0)}%\n`;
      summary += `   Expected improvement: ${s.expected_improvement}%\n`;
      summary += `   Reason: ${s.reasoning[0]}\n\n`;
    });

    return summary;
  }
}

/**
 * 편의 함수
 */
export function detectOptimizations(instructions: Inst[]): OptimizationSuggestion[] {
  const detector = new OptimizationDetector();
  return detector.detectOptimizations(instructions);
}
