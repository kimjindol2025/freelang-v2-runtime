/**
 * Phase 3.5 Task 3: Conditional Expression Analyzer
 * 
 * 목표: if/while 조건식에서 boolean 타입 힌트 추출
 * - Pattern 1: if (condition) → condition은 boolean
 * - Pattern 2: while (loop_condition) → loop_condition은 boolean
 * - Pattern 3: return condition ? a : b → condition은 boolean
 * - Heuristics: 비교연산, boolean 함수, 논리 연산
 */

import { MinimalFunctionAST } from '../parser/ast';

/**
 * 조건식 정보
 */
export interface ConditionalExpression {
  type: 'if' | 'while' | 'ternary';  // 조건식 타입
  expression: string;                  // 조건식 텍스트
  confidence: number;                  // 신뢰도
  hasComparison: boolean;              // 비교 연산자 있는가?
  hasLogicalOp: boolean;               // 논리 연산 있는가?
  hasFunctionCall: boolean;            // 함수 호출 있는가?
}

/**
 * 함수별 조건식 정보
 */
export interface FunctionConditionalInfo {
  functionName: string;
  hasConditionals: boolean;              // 조건식이 있는가?
  conditionalExpressions: ConditionalExpression[]; // 감지된 조건식들
  inferredBooleanVariables: Set<string>; // boolean으로 추론되는 변수들
  confidence: number;                    // 종합 신뢰도
}

/**
 * ConditionalExpressionAnalyzer
 * 
 * if/while/ternary 조건식에서 boolean 타입 힌트를 추출합니다.
 */
export class ConditionalExpressionAnalyzer {
  private conditionalInfos: Map<string, FunctionConditionalInfo> = new Map();

  /**
   * 비교 연산자 패턴
   */
  private comparisonPattern = /[><=!]+|==|!=|<=|>=/;

  /**
   * 논리 연산 패턴
   */
  private logicalOpPattern = /&&|\|\||!/;

  /**
   * 함수 호출 패턴
   */
  private functionCallPattern = /\w+\s*\(/;

  /**
   * Step 1: 조건식 감지
   * 
   * if (condition) { ... }
   * while (condition) { ... }
   * return condition ? a : b
   */
  private detectConditionalExpressions(fn: MinimalFunctionAST): FunctionConditionalInfo {
    const fnName = fn.fnName;
    const body = fn.body || '';

    const conditionalExpressions: ConditionalExpression[] = [];
    const booleanVariables = new Set<string>();

    // Pattern 1: if (...) 감지
    const ifPattern = /if\s*\(\s*([^)]+)\s*\)/g;
    let match;

    while ((match = ifPattern.exec(body)) !== null) {
      const condition = match[1].trim();
      const conditional = this.analyzeConditionalExpression(condition, 'if');
      conditionalExpressions.push(conditional);

      // 변수명 추출 (단순한 경우: x, isValid, 등)
      const simpleVarPattern = /^(\w+)$/;
      const simpleMatch = condition.match(simpleVarPattern);
      if (simpleMatch) {
        booleanVariables.add(simpleMatch[1]);
      }
    }

    // Pattern 2: while (...) 감지
    const whilePattern = /while\s*\(\s*([^)]+)\s*\)/g;
    while ((match = whilePattern.exec(body)) !== null) {
      const condition = match[1].trim();
      const conditional = this.analyzeConditionalExpression(condition, 'while');
      conditionalExpressions.push(conditional);

      // 변수명 추출
      const simpleVarPattern = /^(\w+)$/;
      const simpleMatch = condition.match(simpleVarPattern);
      if (simpleMatch) {
        booleanVariables.add(simpleMatch[1]);
      }
    }

    // Pattern 3: ternary (? :) 감지
    const ternaryPattern = /\(\s*([^?]+)\s*\?\s*[^:]+\s*:\s*[^)]+\s*\)/g;
    while ((match = ternaryPattern.exec(body)) !== null) {
      const condition = match[1].trim();
      const conditional = this.analyzeConditionalExpression(condition, 'ternary');
      conditionalExpressions.push(conditional);
    }

    // 함수별 정보 생성
    const hasConditionals = conditionalExpressions.length > 0;
    const confidence = hasConditionals ? this.calculateConfidence(conditionalExpressions) : 0.0;

    return {
      functionName: fnName,
      hasConditionals,
      conditionalExpressions,
      inferredBooleanVariables: booleanVariables,
      confidence,
    };
  }

  /**
   * Step 2: 조건식 분석
   * 
   * - 비교 연산: a > b, x == y → boolean
   * - 논리 연산: a && b, !c → boolean
   * - 함수 호출: isValid() → boolean
   */
  private analyzeConditionalExpression(
    expression: string,
    type: 'if' | 'while' | 'ternary'
  ): ConditionalExpression {
    const hasComparison = this.comparisonPattern.test(expression);
    const hasLogicalOp = this.logicalOpPattern.test(expression);
    const hasFunctionCall = this.functionCallPattern.test(expression);

    // 신뢰도 계산
    let confidence = 0.5; // 기본값

    if (hasComparison) confidence += 0.25; // 비교 연산자 있음
    if (hasLogicalOp) confidence += 0.15;  // 논리 연산 있음
    if (hasFunctionCall) confidence += 0.10; // 함수 호출 있음

    // 최대 0.95
    confidence = Math.min(0.95, confidence);

    return {
      type,
      expression,
      confidence,
      hasComparison,
      hasLogicalOp,
      hasFunctionCall,
    };
  }

  /**
   * Step 3: 신뢰도 계산
   */
  private calculateConfidence(expressions: ConditionalExpression[]): number {
    if (expressions.length === 0) return 0.0;

    const avgConfidence =
      expressions.reduce((sum, expr) => sum + expr.confidence, 0) / expressions.length;
    return Math.min(0.95, avgConfidence + 0.05); // 약간 부스트
  }

  /**
   * 최종 빌드: 모든 함수 분석
   */
  build(functions: MinimalFunctionAST[]): Map<string, FunctionConditionalInfo> {
    this.conditionalInfos.clear();

    for (const fn of functions) {
      const info = this.detectConditionalExpressions(fn);
      this.conditionalInfos.set(fn.fnName, info);
    }

    return this.conditionalInfos;
  }

  /**
   * 특정 함수의 조건식 정보 조회
   */
  getFunctionConditionalInfo(fnName: string): FunctionConditionalInfo | null {
    return this.conditionalInfos.get(fnName) || null;
  }

  /**
   * 조건식이 있는 함수들만 조회
   */
  getConditionalFunctions(): FunctionConditionalInfo[] {
    return Array.from(this.conditionalInfos.values()).filter((info) => info.hasConditionals);
  }

  /**
   * 모든 함수의 조건식 정보
   */
  getAllFunctionConditionalInfo(): FunctionConditionalInfo[] {
    return Array.from(this.conditionalInfos.values());
  }

  /**
   * 조건식 감지율
   */
  getConditionalDetectionRate(): number {
    if (this.conditionalInfos.size === 0) return 0.0;

    const conditionalFuncs = this.getConditionalFunctions().length;
    return conditionalFuncs / this.conditionalInfos.size;
  }

  /**
   * 추론된 boolean 변수들
   */
  getInferredBooleanVariables(fnName: string): Set<string> | null {
    const info = this.conditionalInfos.get(fnName);
    return info ? info.inferredBooleanVariables : null;
  }

  /**
   * 신뢰도 필터링
   */
  getHighConfidenceConditionals(threshold: number = 0.75): FunctionConditionalInfo[] {
    return Array.from(this.conditionalInfos.values()).filter((info) => info.confidence >= threshold);
  }

  /**
   * 특정 타입의 조건식 개수
   */
  getConditionalCountByType(fnName: string, type: 'if' | 'while' | 'ternary'): number {
    const info = this.conditionalInfos.get(fnName);
    if (!info) return 0;

    return info.conditionalExpressions.filter((expr) => expr.type === type).length;
  }
}
