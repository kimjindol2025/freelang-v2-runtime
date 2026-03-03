/**
 * Phase 14.1: Constant Folding (상수식 최적화)
 * 기반: LLVM llvm/lib/Analysis/ConstantFolding.cpp
 *
 * 컴파일 타임에 상수식을 미리 계산하는 최적화
 * 예: 2 + 3 → 5 (런타임 계산 제거)
 */

import { Inst, Op } from '../types';

export interface ConstantFoldingResult {
  optimized: Inst[];
  folded: number;
  replacements: Map<number, number | string | boolean>;
}

/**
 * 값이 상수인지 확인
 */
export function isConstant(val: any): boolean {
  return (
    typeof val === 'number' ||
    typeof val === 'boolean' ||
    typeof val === 'string'
  );
}

/**
 * 정수 연산 폴딩
 */
export function foldIntegerBinop(
  op: Op,
  lhs: number,
  rhs: number
): number | null {
  try {
    switch (op) {
      case Op.ADD:
        return lhs + rhs;
      case Op.SUB:
        return lhs - rhs;
      case Op.MUL:
        return lhs * rhs;
      case Op.DIV:
        return rhs !== 0 ? Math.floor(lhs / rhs) : null;
      case Op.MOD:
        return rhs !== 0 ? lhs % rhs : null;
      case Op.AND:
        return lhs & rhs;
      case Op.OR:
        return lhs | rhs;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * 부동소수점 연산 폴딩
 */
export function foldFloatBinop(
  op: Op,
  lhs: number,
  rhs: number
): number | null {
  try {
    switch (op) {
      case Op.ADD:
        return lhs + rhs;
      case Op.SUB:
        return lhs - rhs;
      case Op.MUL:
        return lhs * rhs;
      case Op.DIV:
        return rhs !== 0 ? lhs / rhs : null;
      case Op.MOD:
        return lhs % rhs;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * 비교 연산 폴딩
 */
export function foldComparison(
  op: Op,
  lhs: number,
  rhs: number
): boolean | null {
  try {
    switch (op) {
      case Op.EQ:
        return lhs === rhs;
      case Op.NEQ:
        return lhs !== rhs;
      case Op.LT:
        return lhs < rhs;
      case Op.LTE:
        return lhs <= rhs;
      case Op.GT:
        return lhs > rhs;
      case Op.GTE:
        return lhs >= rhs;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * 개별 명령어 상수 폴딩
 */
export function foldInstruction(
  inst: Inst,
  operandMap: Map<number, any>
): number | string | boolean | null {
  // 모든 arg가 상수인지 확인
  if (inst.arg === undefined || typeof inst.arg !== 'number') {
    return null;
  }

  const value = operandMap.get(inst.arg);
  if (!isConstant(value)) {
    return null;
  }

  // 명령어에 따라 폴딩
  if (typeof value === 'number') {
    if (inst.op === Op.NEG) {
      return -value;
    }
  }

  return null;
}

/**
 * 상수 폴딩 패스 실행
 */
export function runConstantFolding(
  instrs: Inst[]
): ConstantFoldingResult {
  const optimized: Inst[] = [];
  const replacements = new Map<number, any>();
  let folded = 0;

  // 명령어를 순회하면서 상수 폴딩 시도
  for (let i = 0; i < instrs.length; i++) {
    const inst = instrs[i];

    // 이미 폴딩된 명령어는 스킵
    if (replacements.has(i)) {
      continue;
    }

    // 이항 연산 폴딩
    if (
      inst.op === Op.ADD ||
      inst.op === Op.SUB ||
      inst.op === Op.MUL ||
      inst.op === Op.DIV ||
      inst.op === Op.MOD ||
      inst.op === Op.AND ||
      inst.op === Op.OR
    ) {
      // 스택 기반이므로 이전 두 명령어 확인
      if (i >= 2) {
        const prev1 = instrs[i - 1];
        const prev2 = instrs[i - 2];

        if (
          prev1.op === Op.PUSH &&
          prev2.op === Op.PUSH &&
          typeof prev1.arg === 'number' &&
          typeof prev2.arg === 'number'
        ) {
          const result = foldIntegerBinop(inst.op, prev2.arg, prev1.arg);
          if (result !== null) {
            // 이전 두 PUSH와 현재 연산을 상수 하나로 변환
            replacements.set(i - 2, result);
            replacements.set(i - 1, null); // 제거
            replacements.set(i, null); // 제거
            folded += 2; // 2개 명령어 제거
          }
        }
      }
    }

    // 폴딩되지 않은 명령어는 유지
    if (!replacements.has(i)) {
      optimized.push(inst);
    }
  }

  return {
    optimized,
    folded,
    replacements,
  };
}
