/**
 * Phase 3.4: Data Flow Graph
 *
 * 함수 간 데이터 흐름을 추적하는 directed graph
 * - 변수가 어느 함수에서 정의되는가?
 * - 변수가 어느 함수로 전달되는가? (파라미터)
 * - 변수가 어디서 사용되는가?
 *
 * 기초: CallGraphBuilder
 * 확장: 변수 + 타입 정보 추가
 */

import { MinimalFunctionAST } from '../parser/ast';
import { CallGraphBuilder, CallGraph, FunctionCall } from './call-graph-builder';

/**
 * 변수의 생명주기 정보
 */
export interface VariableFlow {
  name: string;
  type: string;                    // 추론된 타입
  definedInFunction: string;       // 정의된 함수
  usedInFunctions: string[];       // 사용된 함수들
  passedAsParameter: {
    fromFunction: string;
    toFunction: string;
  }[];                             // 파라미터 전달 관계
  confidence: number;              // 0.0-1.0
}

/**
 * 함수 입출력 정보
 */
export interface FunctionSignature {
  name: string;
  parameters: VariableFlow[];
  returnType: string;
  returnValue?: VariableFlow;
  localVariables: VariableFlow[];
  usedGlobals: string[];           // 함수에서 사용하는 외부 변수
}

/**
 * 전체 DataFlow 그래프
 */
export interface DataFlowGraph {
  functions: Map<string, FunctionSignature>;
  variables: Map<string, VariableFlow>;
  callGraph: CallGraph;
  dataFlows: DataFlow[];           // 변수 흐름 엣지
}

/**
 * 데이터 흐름 엣지 (변수가 함수 A에서 B로 어떻게 흐르는가)
 */
export interface DataFlow {
  variable: string;
  fromFunction: string;
  toFunction: string;
  flowType: 'parameter' | 'return' | 'global' | 'nested';
  confidence: number;
}

/**
 * DataFlowGraphBuilder
 */
export class DataFlowGraphBuilder {
  private functions: Map<string, FunctionSignature> = new Map();
  private variables: Map<string, VariableFlow> = new Map();
  private dataFlows: DataFlow[] = [];
  private callGraph: CallGraph | null = null;

  /**
   * Step 1: 함수 시그니처 추출
   *
   * 각 함수에서:
   *   - 파라미터 (입력)
   *   - 로컬 변수 (정의)
   *   - 반환값 (출력)
   *   - 글로벌 사용 (외부 변수)
   *
   * 정규식 기반:
   *   - fn fnName(param1, param2): 파라미터 추출
   *   - let varName: 로컬 변수 추출
   *   - return expr: 반환값 추출
   */
  private extractFunctionSignatures(functions: MinimalFunctionAST[]): void {
    for (const fn of functions) {
      const sig: FunctionSignature = {
        name: fn.fnName,
        parameters: [],
        returnType: fn.outputType || 'unknown',
        localVariables: [],
        usedGlobals: [],
      };

      // 파라미터 추출 (간단한 경우: inputType에서)
      if (fn.inputType && fn.inputType !== 'null') {
        const param: VariableFlow = {
          name: 'input',
          type: fn.inputType,
          definedInFunction: fn.fnName,
          usedInFunctions: [fn.fnName],
          passedAsParameter: [],
          confidence: 0.9,
        };
        sig.parameters.push(param);
      }

      // 로컬 변수 추출 (let pattern)
      if (fn.body) {
        const letPattern = /let\s+(\w+)(?:\s*:\s*(\w+))?/g;
        let match;
        while ((match = letPattern.exec(fn.body)) !== null) {
          const varName = match[1];
          const varType = match[2] || 'unknown';

          const variable: VariableFlow = {
            name: varName,
            type: varType,
            definedInFunction: fn.fnName,
            usedInFunctions: [fn.fnName],
            passedAsParameter: [],
            confidence: 0.85,
          };
          sig.localVariables.push(variable);
          this.variables.set(`${fn.fnName}.${varName}`, variable);
        }

        // 반환값 추출 (return pattern)
        const returnPattern = /return\s+(\w+)/;
        const returnMatch = returnPattern.exec(fn.body);
        if (returnMatch) {
          const returnVar: VariableFlow = {
            name: returnMatch[1],
            type: fn.outputType || 'unknown',
            definedInFunction: fn.fnName,
            usedInFunctions: [],
            passedAsParameter: [],
            confidence: 0.95,
          };
          sig.returnValue = returnVar;
        }

        // 사용되는 함수명으로 글로벌 참조 추측
        const callPattern = /(\w+)\s*\(/g;
        while ((match = callPattern.exec(fn.body)) !== null) {
          const calledFunc = match[1];
          // 예약어는 제외
          if (!['let', 'return', 'if', 'for', 'while'].includes(calledFunc)) {
            if (!sig.usedGlobals.includes(calledFunc)) {
              sig.usedGlobals.push(calledFunc);
            }
          }
        }
      }

      this.functions.set(fn.fnName, sig);
    }
  }

  /**
   * Step 2: CallGraph와 통합
   *
   * CallGraphBuilder의 결과를 가져와서
   * 함수 호출 시 파라미터 흐름 추적
   */
  private integrateCallGraph(
    functions: MinimalFunctionAST[],
    callGraph: CallGraph
  ): void {
    this.callGraph = callGraph;

    // 각 함수 호출에서 파라미터 흐름 결정
    for (const edge of callGraph.edges) {
      const { caller, callee } = edge;

      // caller의 반환값이 callee의 입력이 되는가?
      const callerSig = this.functions.get(caller);
      const calleeSig = this.functions.get(callee);

      if (callerSig && calleeSig && callerSig.returnValue) {
        // Return value → Parameter 흐름
        const flow: DataFlow = {
          variable: callerSig.returnValue.name,
          fromFunction: caller,
          toFunction: callee,
          flowType: 'parameter',
          confidence: 0.8,
        };
        this.dataFlows.push(flow);

        // 변수 업데이트
        const varKey = `${callee}.${callerSig.returnValue.name}`;
        if (!this.variables.has(varKey)) {
          this.variables.set(varKey, { ...callerSig.returnValue });
        } else {
          const existing = this.variables.get(varKey)!;
          if (!existing.usedInFunctions.includes(callee)) {
            existing.usedInFunctions.push(callee);
          }
        }
      }
    }
  }

  /**
   * Step 3: 변수 의존성 분석
   *
   * 변수 A가 변수 B에 의존하는가?
   * 예: result = foo(x) → result는 x에 의존
   */
  private analyzeVariableDependencies(functions: MinimalFunctionAST[]): void {
    for (const fn of functions) {
      if (!fn.body) continue;

      const sig = this.functions.get(fn.fnName)!;

      // 간단한 의존성: assignment pattern
      // varA = varB + varC 형태
      const assignPattern = /(\w+)\s*=\s*(\w+)\s*[+\-*/%]\s*(\w+)/g;
      let match;
      while ((match = assignPattern.exec(fn.body)) !== null) {
        const [, varA, varB, varC] = match;

        // varA는 varB와 varC에 의존
        const varAKey = `${fn.fnName}.${varA}`;
        const varBKey = `${fn.fnName}.${varB}`;
        const varCKey = `${fn.fnName}.${varC}`;

        // 각 변수 업데이트
        for (const key of [varBKey, varCKey]) {
          if (this.variables.has(key)) {
            const variable = this.variables.get(key)!;
            if (!variable.usedInFunctions.includes(fn.fnName)) {
              variable.usedInFunctions.push(fn.fnName);
            }
          }
        }
      }
    }
  }

  /**
   * 최종 DataFlow 그래프 생성
   */
  build(functions: MinimalFunctionAST[]): DataFlowGraph {
    // Step 1: 함수 시그니처 추출
    this.extractFunctionSignatures(functions);

    // Step 2: CallGraph 생성 및 통합
    const callGraphBuilder = new CallGraphBuilder();
    const callGraph = callGraphBuilder.build(functions);
    this.integrateCallGraph(functions, callGraph);

    // Step 3: 변수 의존성 분석
    this.analyzeVariableDependencies(functions);

    return {
      functions: this.functions,
      variables: this.variables,
      callGraph,
      dataFlows: this.dataFlows,
    };
  }

  /**
   * 특정 변수의 생명주기 추적
   */
  traceVariable(varName: string): VariableFlow | null {
    return this.variables.get(varName) || null;
  }

  /**
   * 함수의 모든 입출력 추적
   */
  getFunctionSignature(fnName: string): FunctionSignature | null {
    return this.functions.get(fnName) || null;
  }

  /**
   * 두 함수 간 데이터 흐름 존재 여부
   */
  hasDataFlow(fromFn: string, toFn: string): boolean {
    return this.dataFlows.some(
      (flow) => flow.fromFunction === fromFn && flow.toFunction === toFn
    );
  }

  /**
   * 함수가 사용하는 모든 변수의 출처 추적
   */
  traceVariableSources(fnName: string): Map<string, string[]> {
    const sources = new Map<string, string[]>();

    const sig = this.functions.get(fnName);
    if (!sig) return sources;

    // 파라미터의 출처
    for (const param of sig.parameters) {
      const relatedFlows = this.dataFlows.filter(
        (flow) => flow.toFunction === fnName && flow.variable === param.name
      );
      const sourceFlows = relatedFlows.map((f) => f.fromFunction);
      sources.set(param.name, sourceFlows);
    }

    return sources;
  }
}
