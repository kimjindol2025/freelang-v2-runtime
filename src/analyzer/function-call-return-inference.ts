/**
 * Phase 3.5 Task 2: Function Call Return Inference
 * 
 * 목표: 함수 호출 반환값 기반 타입 추론 강화
 * - `return verify()` 패턴에서 verify()의 반환타입 추론
 * - CallGraph 연계: 호출된 함수의 반환타입 조회
 * - 신뢰도: 0.80 (함수 호출을 통한 간접 추론)
 */

import { MinimalFunctionAST } from '../parser/ast';
import { CallGraph } from './call-graph-builder';

/**
 * 함수 호출 반환값 정보
 */
export interface FunctionCallReturn {
  calledFunction: string;     // 호출되는 함수명 (예: verify)
  inferredType: string;       // 추론된 타입
  confidence: number;         // 신뢰도 (0.80)
  isTransitive: boolean;      // CallGraph를 통한 간접 추론인가?
}

/**
 * 함수별 호출 반환값 정보
 */
export interface FunctionCallReturnInfo {
  functionName: string;
  hasCallReturn: boolean;                  // 함수 호출 반환이 있는가?
  callReturns: FunctionCallReturn[];       // 감지된 함수 호출들
  inferredType: string;                    // 최종 추론 타입
  confidence: number;                      // 종합 신뢰도
}

/**
 * FunctionCallReturnInference
 * 
 * 함수 호출을 통한 반환값 타입 추론
 */
export class FunctionCallReturnInference {
  private callReturnInfos: Map<string, FunctionCallReturnInfo> = new Map();

  /**
   * Step 1: 함수 호출 반환값 감지
   * 
   * 패턴: /\breturn\s+(\w+)\s*\(/
   * - return: 'return' 키워드
   * - (\w+): 함수명 캡처
   * - \s*\(: 열린 괄호
   */
  private detectCallReturns(
    fn: MinimalFunctionAST,
    allFunctions: MinimalFunctionAST[]
  ): FunctionCallReturnInfo {
    const fnName = fn.fnName;
    const body = fn.body || '';

    // return function() 패턴 찾기
    const pattern = /\breturn\s+(\w+)\s*\(/g;
    const matches = Array.from(body.matchAll(pattern));

    const callReturns: FunctionCallReturn[] = [];
    const functionMap = new Map(allFunctions.map((f) => [f.fnName, f]));

    // 각 함수 호출 분석
    for (const match of matches) {
      const calledFnName = match[1];
      const calledFn = functionMap.get(calledFnName);

      if (calledFn) {
        // 호출된 함수를 찾았을 때, 그 반환타입 사용
        callReturns.push({
          calledFunction: calledFnName,
          inferredType: calledFn.outputType || 'unknown',
          confidence: 0.80, // 함수 호출을 통한 간접 추론
          isTransitive: true,
        });
      } else {
        // 호출된 함수를 모르면 unknown
        callReturns.push({
          calledFunction: calledFnName,
          inferredType: 'unknown',
          confidence: 0.50, // 낮은 신뢰도
          isTransitive: false,
        });
      }
    }

    // 함수별 정보 생성
    const hasCallReturn = callReturns.length > 0;
    let inferredType = 'unknown';
    let confidence = 0.0;

    if (hasCallReturn) {
      // 첫 번째 호출된 함수 사용
      inferredType = callReturns[0].inferredType;
      confidence = callReturns[0].confidence; // 0.80 (정의됨) 또는 0.50 (미정의)
    }

    return {
      functionName: fnName,
      hasCallReturn,
      callReturns,
      inferredType,
      confidence,
    };
  }

  /**
   * 최종 빌드: 모든 함수 분석
   */
  build(functions: MinimalFunctionAST[]): Map<string, FunctionCallReturnInfo> {
    this.callReturnInfos.clear();

    for (const fn of functions) {
      const info = this.detectCallReturns(fn, functions);
      this.callReturnInfos.set(fn.fnName, info);
    }

    return this.callReturnInfos;
  }

  /**
   * 특정 함수의 호출 반환값 정보 조회
   */
  getFunctionCallReturnInfo(fnName: string): FunctionCallReturnInfo | null {
    return this.callReturnInfos.get(fnName) || null;
  }

  /**
   * 함수 호출을 반환하는 함수들만 조회
   */
  getCallReturningFunctions(): FunctionCallReturnInfo[] {
    return Array.from(this.callReturnInfos.values()).filter((info) => info.hasCallReturn);
  }

  /**
   * 모든 함수의 호출 반환값 정보
   */
  getAllFunctionCallReturnInfo(): FunctionCallReturnInfo[] {
    return Array.from(this.callReturnInfos.values());
  }

  /**
   * 호출 반환값 감지율
   */
  getCallReturnDetectionRate(): number {
    if (this.callReturnInfos.size === 0) return 0.0;

    const callReturningFuncs = this.getCallReturningFunctions().length;
    return callReturningFuncs / this.callReturnInfos.size;
  }

  /**
   * 신뢰도 >= threshold인 함수들
   */
  getHighConfidenceCallReturns(threshold: number = 0.75): FunctionCallReturnInfo[] {
    return Array.from(this.callReturnInfos.values()).filter((info) => info.confidence >= threshold);
  }
}
