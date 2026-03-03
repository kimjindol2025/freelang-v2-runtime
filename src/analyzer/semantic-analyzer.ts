/**
 * Phase 3 Stage 1: Semantic Analyzer
 *
 * AST 기반 의미 분석 엔진
 * - 변수 생명주기 추적
 * - 메서드 호출 분석
 * - 제어 흐름 분석
 * - 타입 제약 조건 수집
 *
 * 목표: 키워드 매칭 (15%) → AST 의미 분석 (75%)
 */

import {
  Expression,
  Statement,
  VariableDeclaration,
  ForStatement,
  IfStatement,
  CallExpression,
  BinaryOpExpression,
  MemberExpression,
  IdentifierExpression,
  ArrayExpression,
  LiteralExpression,
} from '../parser/ast';

/**
 * 변수의 타입 정보
 */
export interface VariableInfo {
  name: string;
  inferredType: string;
  confidence: number;        // 0.0-1.0
  assignments: Assignment[]; // 모든 할당 추적
  usages: Usage[];           // 모든 사용 추적
  source: 'explicit' | 'assignment' | 'method' | 'operation' | 'context';
  reasoning: string[];
}

/**
 * 변수 할당 정보
 */
export interface Assignment {
  line: number;
  value?: Expression;
  inferredType?: string;
  confidence: number;
}

/**
 * 변수 사용 정보
 */
export interface Usage {
  line: number;
  context: 'arithmetic' | 'method' | 'member' | 'argument' | 'iteration';
  relatedVars?: string[];
  inferredType?: string;
}

/**
 * 함수 시그니처 (추론됨)
 */
export interface FunctionSignature {
  name: string;
  inputs: Map<string, VariableInfo>;
  outputs: VariableInfo;
  variables: Map<string, VariableInfo>;
  confidence: number;
  reasoning: string[];
}

/**
 * Type Constraint (타입 제약)
 */
export interface TypeConstraint {
  vars: string[];
  constraint: 'numeric' | 'array' | 'object' | 'string' | 'bool';
  confidence: number;
  source: string;
}

/**
 * Semantic Analyzer - 의미 분석 엔진
 */
export class SemanticAnalyzer {
  private variables: Map<string, VariableInfo> = new Map();
  private constraints: TypeConstraint[] = [];
  private typeInferences: Map<string, string> = new Map();

  /**
   * 변수 생명주기 분석
   * 각 변수의 할당 → 사용 → 범위 종료까지 추적
   */
  public analyzeVariableLifecycle(code: string): Map<string, VariableInfo> {
    this.variables.clear();
    this.constraints = [];

    // 라인별로 처리
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // 변수 할당 감지
      const assignMatch = line.match(/(\w+)\s*=\s*(.+)/);
      if (assignMatch) {
        const varName = assignMatch[1];
        const value = assignMatch[2];
        this.recordAssignment(varName, value, lineNum);
      }

      // for-in 루프 감지
      const forMatch = line.match(/for\s+(\w+)\s+in\s+(\w+)/);
      if (forMatch) {
        const loopVar = forMatch[1];
        const iterable = forMatch[2];
        this.recordLoopVariable(loopVar, iterable, lineNum);
      }

      // 메서드 호출 감지
      const methodMatch = line.match(/(\w+)\.(\w+)(\()?/);
      if (methodMatch) {
        const obj = methodMatch[1];
        const method = methodMatch[2];
        this.recordMethodCall(obj, method, lineNum);
      }
    }

    return this.variables;
  }

  /**
   * 변수 할당 기록
   */
  private recordAssignment(name: string, value: string, line: number): void {
    if (!this.variables.has(name)) {
      this.variables.set(name, {
        name,
        inferredType: 'unknown',
        confidence: 0,
        assignments: [],
        usages: [],
        source: 'assignment',
        reasoning: [],
      });
    }

    const varInfo = this.variables.get(name)!;
    const inferredType = this.inferTypeFromValue(value);

    varInfo.assignments.push({
      line,
      inferredType,
      confidence: this.calculateConfidence(inferredType, value),
    });

    // 타입 업데이트 (첫 할당이면 강하게, 이후는 약하게)
    if (varInfo.assignments.length === 1) {
      varInfo.inferredType = inferredType;
      varInfo.confidence = this.calculateConfidence(inferredType, value);
    } else if (varInfo.inferredType === 'unknown' || varInfo.inferredType === inferredType) {
      varInfo.inferredType = inferredType;
      varInfo.confidence = Math.max(varInfo.confidence, 0.5);
    } else {
      // 타입 충돌: union type으로 변경
      varInfo.inferredType = `${varInfo.inferredType} | ${inferredType}`;
      varInfo.confidence = Math.min(varInfo.confidence, 0.5); // 신뢰도 낮춤
    }

    varInfo.reasoning.push(`할당: ${value} (${inferredType})`);
  }

  /**
   * 루프 변수 기록 (for-in)
   * for item in arr → item의 타입은 arr의 element 타입
   */
  private recordLoopVariable(loopVar: string, iterable: string, line: number): void {
    if (!this.variables.has(loopVar)) {
      this.variables.set(loopVar, {
        name: loopVar,
        inferredType: 'unknown',
        confidence: 0.7,
        assignments: [],
        usages: [],
        source: 'context',
        reasoning: [],
      });
    }

    const varInfo = this.variables.get(loopVar)!;
    varInfo.reasoning.push(`루프 변수: for ${loopVar} in ${iterable}`);

    // iterable도 array 타입으로 표시
    if (!this.variables.has(iterable)) {
      this.variables.set(iterable, {
        name: iterable,
        inferredType: 'array',
        confidence: 0.8,
        assignments: [],
        usages: [],
        source: 'context',
        reasoning: [],
      });
    }

    const iterableInfo = this.variables.get(iterable)!;
    iterableInfo.inferredType = 'array';
    iterableInfo.confidence = Math.max(iterableInfo.confidence, 0.8);
    iterableInfo.reasoning.push(`iterable (for 루프에서 사용됨)`);
  }

  /**
   * 메서드 호출 기록
   * obj.push() → obj: array
   * obj.length → obj: array or string
   * obj.method() → obj: object
   */
  private recordMethodCall(objName: string, method: string, line: number): void {
    if (!this.variables.has(objName)) {
      this.variables.set(objName, {
        name: objName,
        inferredType: 'unknown',
        confidence: 0,
        assignments: [],
        usages: [],
        source: 'method',
        reasoning: [],
      });
    }

    const varInfo = this.variables.get(objName)!;
    const methodType = this.inferTypeFromMethod(method);

    varInfo.usages.push({
      line,
      context: 'method',
      inferredType: methodType || undefined,
    });

    // 메서드로부터 타입 추론
    if (methodType) {
      varInfo.inferredType = methodType;
      varInfo.confidence = 0.85;
      varInfo.source = 'method';
      varInfo.reasoning.push(`메서드: .${method}() → ${methodType}`);
    }
  }

  /**
   * 값에서 타입 추론
   * 0, 10, -5 → number
   * "", "hello" → string
   * [], [1,2] → array
   * true, false → bool
   */
  private inferTypeFromValue(value: string): string {
    value = value.trim();

    // 배열 리터럴
    if (value === '[]' || value.match(/^\[.*\]$/)) {
      return 'array';
    }

    // 숫자
    if (value.match(/^-?\d+(\.\d+)?$/) || value.match(/^(0|[1-9]\d*)$/)) {
      return 'number';
    }

    // 문자열
    if (value.match(/^["'].*["']$/)) {
      return 'string';
    }

    // boolean
    if (value === 'true' || value === 'false') {
      return 'bool';
    }

    // 산술 연산 (x + y, sum + item)
    if (value.match(/^\w+\s*[\+\-\*\/]\s*.+/)) {
      return 'number'; // 산술 연산의 결과는 숫자
    }

    // 다른 변수
    if (this.variables.has(value)) {
      return this.variables.get(value)!.inferredType;
    }

    return 'unknown';
  }

  /**
   * 메서드에서 타입 추론
   * push, pop, shift, unshift → array
   * length → array or string
   * split, toUpperCase → string
   */
  private inferTypeFromMethod(method: string): string | null {
    const arrayMethods = ['push', 'pop', 'shift', 'unshift', 'slice', 'splice', 'map', 'filter', 'reduce'];
    const stringMethods = ['split', 'toUpperCase', 'toLowerCase', 'slice', 'substring', 'trim'];

    if (arrayMethods.includes(method)) {
      return 'array';
    }

    if (stringMethods.includes(method)) {
      return 'string';
    }

    if (method === 'length') {
      return 'array'; // length는 배열이나 문자열이 가짐
    }

    return null;
  }

  /**
   * 신뢰도 계산
   * - 명시적 타입: 0.95
   * - 리터럴 할당: 0.90
   * - 메서드 호출: 0.85
   * - 산술 연산: 0.80
   * - 컨텍스트 추론: 0.70
   */
  private calculateConfidence(inferredType: string, value: string): number {
    if (inferredType === 'unknown') {
      return 0.2;
    }

    // 리터럴 할당
    if (value.match(/^\[.*\]$/) || value.match(/^-?\d+(\.\d+)?$/) || value.match(/^["'].*["']$/) || value === 'true' || value === 'false') {
      return 0.95;
    }

    // 산술 연산
    if (value.match(/\+|-|\*|\//)) {
      return 0.80;
    }

    // 메서드 호출
    if (value.includes('.')) {
      return 0.85;
    }

    // 다른 변수
    return 0.70;
  }

  /**
   * 타입 제약 조건 수집
   * x + y → x, y are numeric
   * arr[i] → arr is array, i is numeric
   */
  public collectTypeConstraints(code: string): TypeConstraint[] {
    const constraints: TypeConstraint[] = [];

    // 산술 연산 감지
    const arithmeticPattern = /(\w+)\s*[\+\-\*\/]\s*(\w+)/g;
    let match;
    while ((match = arithmeticPattern.exec(code)) !== null) {
      constraints.push({
        vars: [match[1], match[2]],
        constraint: 'numeric',
        confidence: 0.80,
        source: `arithmetic: ${match[0]}`,
      });
    }

    // 배열 접근 감지
    const arrayAccessPattern = /(\w+)\[(\w+)\]/g;
    while ((match = arrayAccessPattern.exec(code)) !== null) {
      constraints.push({
        vars: [match[1]],
        constraint: 'array',
        confidence: 0.85,
        source: `array access: ${match[0]}`,
      });
      constraints.push({
        vars: [match[2]],
        constraint: 'numeric',
        confidence: 0.85,
        source: `array index: ${match[0]}`,
      });
    }

    return constraints;
  }

  /**
   * 함수 시그니처 추론
   */
  public inferFunctionSignature(
    functionName: string,
    code: string,
    declaredInputs?: Map<string, string>,
    declaredOutput?: string
  ): FunctionSignature {
    // 변수 생명주기 분석
    const varLifecycle = this.analyzeVariableLifecycle(code);

    // 타입 제약 수집
    const constraints = this.collectTypeConstraints(code);

    // 추론된 입력 변수
    const inferredInputs = new Map<string, VariableInfo>();
    for (const [varName, varInfo] of varLifecycle) {
      if (this.isInputVariable(varName, code)) {
        inferredInputs.set(varName, varInfo);
      }
    }

    // 추론된 출력 타입
    let outputType = declaredOutput || 'unknown';
    let outputConfidence = 0;

    if (declaredOutput) {
      outputConfidence = 0.95; // 명시적
    } else {
      const returnInfo = this.inferReturnType(code);
      if (returnInfo) {
        outputType = returnInfo.type;
        outputConfidence = returnInfo.confidence;
      }
    }

    // 전체 신뢰도 계산
    const inputConfidences = Array.from(inferredInputs.values()).map(v => v.confidence);
    const avgInputConfidence = inputConfidences.length > 0
      ? inputConfidences.reduce((a, b) => a + b, 0) / inputConfidences.length
      : 0;

    const totalConfidence = (avgInputConfidence * 0.5 + outputConfidence * 0.5);

    return {
      name: functionName,
      inputs: inferredInputs,
      outputs: {
        name: 'result',
        inferredType: outputType,
        confidence: outputConfidence,
        assignments: [],
        usages: [],
        source: declaredOutput ? 'explicit' : 'operation',
        reasoning: [`반환 타입: ${outputType}`],
      },
      variables: varLifecycle,
      confidence: totalConfidence,
      reasoning: [
        `입력 변수: ${Array.from(inferredInputs.keys()).join(', ')}`,
        `출력 타입: ${outputType}`,
        `평균 신뢰도: ${(totalConfidence * 100).toFixed(0)}%`,
      ],
    };
  }

  /**
   * 입력 변수 판단
   * for-in, 메서드 호출의 객체 등
   */
  private isInputVariable(varName: string, code: string): boolean {
    // for-in 루프에 사용됨
    if (code.includes(`in ${varName}`)) {
      return true;
    }

    // 첫 할당이 for-in 컨텍스트
    const varInfo = this.variables.get(varName);
    if (varInfo && varInfo.source === 'context' && varInfo.reasoning.some(r => r.includes('루프'))) {
      return false;
    }

    // 처음부터 사용되기만 함 (할당 없음)
    if (varInfo && varInfo.assignments.length === 0 && varInfo.usages.length > 0) {
      return true;
    }

    return false;
  }

  /**
   * 반환 타입 추론
   */
  private inferReturnType(code: string): { type: string; confidence: number } | null {
    const returnMatch = code.match(/return\s+(\w+)/);
    if (!returnMatch) {
      return null;
    }

    const returnVar = returnMatch[1];
    const varInfo = this.variables.get(returnVar);

    if (varInfo) {
      return {
        type: varInfo.inferredType,
        confidence: varInfo.confidence,
      };
    }

    return null;
  }

  /**
   * 디버그: 분석 결과 출력
   */
  public getAnalysisReport(): string {
    const lines: string[] = [];

    lines.push('=== Semantic Analysis Report ===\n');

    lines.push('Variables:');
    for (const [name, info] of this.variables) {
      lines.push(`  ${name}: ${info.inferredType} (Confidence: ${(info.confidence * 100).toFixed(0)}%)`);
      lines.push(`    source: ${info.source}`);
      lines.push(`    reasoning: ${info.reasoning.join('; ')}`);
      lines.push('');
    }

    lines.push('Type Constraints:');
    for (const constraint of this.constraints) {
      lines.push(`  ${constraint.vars.join(', ')} → ${constraint.constraint}`);
    }

    return lines.join('\n');
  }
}

// Convenience function
export function createSemanticAnalyzer(): SemanticAnalyzer {
  return new SemanticAnalyzer();
}
