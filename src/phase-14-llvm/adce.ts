/**
 * Phase 14.2: ADCE (Aggressive Dead Code Elimination)
 * 기반: LLVM llvm/lib/Transforms/Scalar/ADCE.cpp
 *
 * 사용되지 않는 명령어를 제거하는 최적화
 */

import { Inst, Op } from '../types';

export interface ADCEResult {
  optimized: Inst[];
  removed: number;
  liveSet: Set<number>;
}

/**
 * 명령어가 항상 live인지 판별
 * - side effect가 있거나 terminator인 명령어
 */
export function isAlwaysLive(op: Op): boolean {
  const sideEffectOps = [
    Op.STORE,
    Op.CALL,
    Op.RET,
    Op.JMP,
    Op.JMP_IF,
    Op.JMP_NOT,
    Op.HALT,
  ];

  return sideEffectOps.includes(op);
}

/**
 * 명령어가 terminator인지 확인
 */
export function isTerminator(op: Op): boolean {
  const terminators = [Op.RET, Op.JMP, Op.JMP_IF, Op.JMP_NOT, Op.HALT];
  return terminators.includes(op);
}

/**
 * ADCE 메인 알고리즘 (스택 기반 VM용 단순화 버전)
 *
 * Phase 1: 항상 live인 명령어를 worklist에 추가
 * Phase 2: 스택 기반 VM의 특성을 고려한 역추적
 *
 * 스택 기반 VM에서는 모든 PUSH가 실제로 소비되기 전까지 필요하므로,
 * 결과를 소비하는 명령어 이전의 모든 명령어를 live로 표시
 */
export function aggressiveDCE(instrs: Inst[]): Set<number> {
  const liveSet = new Set<number>();

  // Phase 1: 항상 live인 명령어 찾기 (역순 스캔)
  let stackDepth = 0;
  for (let i = instrs.length - 1; i >= 0; i--) {
    const inst = instrs[i];

    // 항상 live인 명령어
    if (isAlwaysLive(inst.op) || isTerminator(inst.op)) {
      liveSet.add(i);
      continue;
    }

    // 스택 소비/생산 추적
    if (inst.op === Op.PUSH) {
      if (stackDepth > 0) {
        liveSet.add(i);
        stackDepth--;
      }
      // else: 미사용 PUSH, 제거 대상
    } else if (inst.op === Op.POP) {
      stackDepth++;
      liveSet.add(i); // POP은 항상 필요 (부작용)
    } else {
      // 다른 명령어: 일반적으로 하나 이상의 스택 값 소비
      // 보수적으로 필요한 것으로 표시
      liveSet.add(i);
    }
  }

  return liveSet;
}

/**
 * Dead 명령어 제거
 */
export function removeDeadInstructions(
  instrs: Inst[],
  liveSet: Set<number>
): { optimized: Inst[]; removed: number } {
  const optimized: Inst[] = [];
  let removed = 0;

  for (let i = 0; i < instrs.length; i++) {
    if (liveSet.has(i)) {
      optimized.push(instrs[i]);
    } else {
      removed++;
    }
  }

  return { optimized, removed };
}

/**
 * ADCE 패스 실행
 */
export function runADCE(instrs: Inst[]): ADCEResult {
  const liveSet = aggressiveDCE(instrs);
  const { optimized, removed } = removeDeadInstructions(instrs, liveSet);

  return {
    optimized,
    removed,
    liveSet,
  };
}
