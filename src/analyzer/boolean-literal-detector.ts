/**
 * Phase 3.5 Task 1: Boolean Literal Detector
 * 
 * 목표: `return true/false` 리터럴 정확히 감지
 * - 함수 body에서 boolean 리터럴 추출
 * - 신뢰도 0.95 (정확한 리터럴)
 * - Case-insensitive 처리 (TRUE/FALSE도 인식)
 */

import { MinimalFunctionAST } from '../parser/ast';

/**
 * Boolean 리터럴 정보
 */
export interface BooleanLiteral {
  value: boolean;           // true or false
  confidence: number;       // 0.95 (정확한 리터럴)
  location: 'return';       // 위치 (return만 현재 지원)
  lineNumber?: number;      // 옵션: 라인 번호
}

/**
 * 함수별 Boolean 정보
 */
export interface FunctionBooleanInfo {
  functionName: string;
  hasBooleanReturn: boolean;        // boolean 리터럴 감지 여부
  booleanLiterals: BooleanLiteral[]; // 감지된 boolean 리터럴들
  inferredType: string;              // 'boolean' or 'unknown'
  confidence: number;                // 종합 신뢰도
}

/**
 * BooleanLiteralDetector
 * 
 * 함수 body에서 `return true/false` 리터럴을 감지합니다.
 */
export class BooleanLiteralDetector {
  private detectedBooleans: Map<string, FunctionBooleanInfo> = new Map();

  /**
   * Step 1: Boolean 리터럴 감지
   * 
   * 패턴: /\breturn\s+(true|false)\b/gi
   * - \b: 단어 경계
   * - return: 'return' 키워드
   * - \s+: 공백
   * - (true|false): 'true' 또는 'false'
   * - \b: 단어 경계 (True/FALSE 제외하기 위해 소문자만)
   */
  private detectBooleanLiteralsInFunction(fn: MinimalFunctionAST): FunctionBooleanInfo {
    const fnName = fn.fnName;
    const body = fn.body || '';

    // return true/false 패턴 찾기
    const pattern = /\breturn\s+(true|false)\b/gi;
    const matches = Array.from(body.matchAll(pattern));

    const booleanLiterals: BooleanLiteral[] = [];

    // 모든 매치 처리
    for (const match of matches) {
      const value = match[1].toLowerCase() === 'true';
      booleanLiterals.push({
        value,
        confidence: 0.95, // 정확한 리터럴
        location: 'return',
      });
    }

    // 함수별 정보 생성
    const hasBooleanReturn = booleanLiterals.length > 0;
    const inferredType = hasBooleanReturn ? 'boolean' : 'unknown';
    const confidence = hasBooleanReturn ? 0.95 : 0.0;

    return {
      functionName: fnName,
      hasBooleanReturn,
      booleanLiterals,
      inferredType,
      confidence,
    };
  }

  /**
   * 최종 빌드: 모든 함수 분석
   */
  build(functions: MinimalFunctionAST[]): Map<string, FunctionBooleanInfo> {
    this.detectedBooleans.clear();

    for (const fn of functions) {
      const info = this.detectBooleanLiteralsInFunction(fn);
      this.detectedBooleans.set(fn.fnName, info);
    }

    return this.detectedBooleans;
  }

  /**
   * 특정 함수의 Boolean 정보 조회
   */
  getFunctionBooleanInfo(fnName: string): FunctionBooleanInfo | null {
    return this.detectedBooleans.get(fnName) || null;
  }

  /**
   * Boolean을 반환하는 함수들만 조회
   */
  getBooleanReturningFunctions(): FunctionBooleanInfo[] {
    return Array.from(this.detectedBooleans.values()).filter((info) => info.hasBooleanReturn);
  }

  /**
   * 모든 함수의 Boolean 정보
   */
  getAllFunctionBooleanInfo(): FunctionBooleanInfo[] {
    return Array.from(this.detectedBooleans.values());
  }

  /**
   * Boolean 감지율 계산
   * 
   * @returns Boolean을 반환하는 함수 비율 (0.0~1.0)
   */
  getBooleanDetectionRate(): number {
    if (this.detectedBooleans.size === 0) return 0.0;

    const booleanFunctions = this.getBooleanReturningFunctions().length;
    return booleanFunctions / this.detectedBooleans.size;
  }
}
