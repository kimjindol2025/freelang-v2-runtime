/**
 * Phase 14.3: Function Inlining (함수 인라인화)
 * 기반: LLVM llvm/lib/Transforms/IPO/Inliner.cpp
 *
 * 함수 호출 오버헤드를 제거하기 위해 함수 본체를 호출부에 복사
 * 예: add(1, 2) → 1 + 2 (함수 호출 제거)
 *
 * 성능 향상: 루프 내 작은 함수 호출이 많을 때 5-10배
 */

import { Inst, Op } from '../types';

export interface FreeLangFunction {
  name: string;
  args: string[];
  instrs: Inst[];
  isRecursive?: boolean;
}

export interface FunctionCall {
  callerIdx: number;
  calleeIdx: number;
  callArgs: any[];
  inLoop: boolean;
  loopDepth: number;
}

export interface InliningResult {
  optimized: Inst[];
  inlined: number;
}

/**
 * 함수의 명령어 개수 계산 (inline cost)
 */
export function estimateCodeSize(funcs: Map<string, FreeLangFunction>, funcName: string): number {
  const func = funcs.get(funcName);
  if (!func) return Infinity;
  return func.instrs.length;
}

/**
 * 호출 빈도 추정
 */
export function estimateCallFrequency(loopDepth: number, inLoop: boolean): number {
  if (inLoop) {
    return 100 * (loopDepth + 1); // 루프는 최소 100번
  }
  return loopDepth;
}

/**
 * 함수를 인라인할 것인지 판별 (핵심 휴리스틱)
 */
export function shouldInline(
  codeSize: number,
  callFreq: number,
  isRecursive: boolean,
  inLoop: boolean,
  loopDepth: number = 1
): boolean {
  // Rule 1: 함수 크기 제한 (기본: 225)
  if (codeSize > 225) {
    return false;
  }

  // Rule 2: 재귀 함수는 인라인 안 함
  if (isRecursive) {
    return false;
  }

  // Rule 3: 호출 빈도가 높으면 무조건 인라인
  if (callFreq > 100) {
    return true;
  }

  // Rule 4: 루프 내 호출이면 가중치 증가
  if (inLoop) {
    const threshold = 225 / (loopDepth + 1);
    if (codeSize < threshold) {
      return true;
    }
  }

  // Rule 5: 작은 함수는 거의 항상 인라인
  if (codeSize < 50) {
    return true;
  }

  return false;
}

/**
 * 실제로 함수를 인라인하는 작업
 */
export function inlineFunction(
  callInstrIdx: number,
  callerInstrs: Inst[],
  calleeInstrs: Inst[],
  callArgs: any[]
): Inst[] {
  const result: Inst[] = [];

  // 호출 전까지 명령어 복사
  for (let i = 0; i < callInstrIdx; i++) {
    result.push(callerInstrs[i]);
  }

  // Callee 명령어 복사 (return 제외)
  for (const instr of calleeInstrs) {
    if (instr.op !== Op.RET) {
      result.push(instr);
    }
  }

  // 호출 후 명령어 복사
  for (let i = callInstrIdx + 1; i < callerInstrs.length; i++) {
    result.push(callerInstrs[i]);
  }

  return result;
}

/**
 * 인라인 최적화 실행
 */
export function runInlining(
  instrs: Inst[],
  funcs: Map<string, FreeLangFunction>,
  calls: Array<{
    callIdx: number;
    calleeIdx: number;
    callArgs: any[];
    inLoop: boolean;
    loopDepth: number;
  }>
): InliningResult {
  let optimized = [...instrs];
  let inlined = 0;

  // 역순으로 처리 (인덱스 변경 방지)
  for (let i = calls.length - 1; i >= 0; i--) {
    const call = calls[i];
    const callInstr = optimized[call.callIdx];

    if (callInstr.op !== Op.CALL) {
      continue;
    }

    // 함수 정보 추출
    const funcName = callInstr.arg as string;
    const func = funcs.get(funcName);

    if (!func) {
      continue; // 함수를 찾을 수 없으면 건너뛰기
    }

    const codeSize = estimateCodeSize(funcs, funcName);
    const isRecursive = func.isRecursive || false;
    const calleeInstrs = func.instrs;

    // 인라인 여부 판별
    const callFreq = estimateCallFrequency(call.loopDepth, call.inLoop);
    if (shouldInline(codeSize, callFreq, isRecursive, call.inLoop, call.loopDepth)) {
      // 실제로 인라인
      optimized = inlineFunction(call.callIdx, optimized, calleeInstrs, call.callArgs);
      inlined++;
    }
  }

  return {
    optimized,
    inlined,
  };
}
