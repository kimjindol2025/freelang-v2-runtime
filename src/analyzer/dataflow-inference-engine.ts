/**
 * Phase 3.4: DataFlow Inference Engine
 *
 * 4개 분석기의 통합 오케스트레이터
 * - CallGraphBuilder: 함수 간 호출 관계
 * - DataFlowGraphBuilder: 데이터 흐름
 * - ReturnTypePropagationEngine: 반환값 타입
 * - ParameterConstraintsEngine: 파라미터 제약
 *
 * 목표: 함수 간 데이터 흐름의 완전한 이해
 * 입력: MinimalFunctionAST[]
 * 출력: 통합 분석 결과 + 정확도 점수
 */

import { MinimalFunctionAST } from '../parser/ast';
import { CallGraphBuilder, CallGraph } from './call-graph-builder';
import { DataFlowGraphBuilder, DataFlowGraph, FunctionSignature } from './dataflow-graph';
import { ReturnTypePropagationEngine, ReturnTypeInfo } from './return-type-propagation';
import { ParameterConstraintsEngine, FunctionParametersInfo } from './parameter-constraints';
import { ConstraintSolverEngine, ConstraintSolverResult } from './constraint-solver';
import { TraitEngine, TraitEngineResult } from './trait-engine';

/**
 * 통합 분석 결과
 */
export interface IntegratedAnalysis {
  callGraph: CallGraph;
  dataFlowGraph: DataFlowGraph;
  returnTypes: Map<string, ReturnTypeInfo>;
  parameterConstraints: Map<string, FunctionParametersInfo>;
  functionScores: FunctionAnalysisScore[];
  overallAccuracy: number;
  reasonings: string[];
}

/**
 * 함수별 분석 점수
 */
export interface FunctionAnalysisScore {
  functionName: string;
  callGraphConfidence: number;      // 호출 관계 신뢰도
  dataFlowConfidence: number;       // 데이터 흐름 신뢰도
  returnTypeConfidence: number;     // 반환값 타입 신뢰도
  parameterConfidence: number;      // 파라미터 신뢰도
  overallScore: number;             // 종합 점수
  domain: string;                   // 주 도메인
  issues: string[];                 // 발견된 문제점
}

/**
 * DataFlowInferenceEngine
 *
 * 4단계:
 *   1. CallGraphBuilder: 함수 호출 그래프 생성
 *   2. DataFlowGraphBuilder: 데이터 흐름 분석
 *   3. ReturnTypePropagationEngine: 반환값 타입 추론
 *   4. ParameterConstraintsEngine: 파라미터 제약 검증
 *   5. 통합 점수화: 모든 분석 결과 병합
 */
export class DataFlowInferenceEngine {
  private callGraphBuilder: CallGraphBuilder | null = null;
  private dataFlowGraphBuilder: DataFlowGraphBuilder | null = null;
  private returnTypeEngine: ReturnTypePropagationEngine | null = null;
  private parameterEngine: ParameterConstraintsEngine | null = null;

  // Advanced type system engines (Phase 4)
  private constraintSolver: ConstraintSolverEngine | null = null;
  private traitEngine: TraitEngine | null = null;

  /**
   * Step 1: CallGraph 생성
   */
  private buildCallGraph(functions: MinimalFunctionAST[]): CallGraph {
    this.callGraphBuilder = new CallGraphBuilder();
    return this.callGraphBuilder.build(functions);
  }

  /**
   * Step 2: DataFlow 분석
   */
  private buildDataFlowGraph(
    functions: MinimalFunctionAST[],
    callGraph: CallGraph
  ): DataFlowGraph {
    this.dataFlowGraphBuilder = new DataFlowGraphBuilder();
    return this.dataFlowGraphBuilder.build(functions);
  }

  /**
   * Step 3: 반환값 타입 추론
   */
  private propagateReturnTypes(
    functions: MinimalFunctionAST[],
    callGraph: CallGraph,
    dataFlowGraph: DataFlowGraph
  ): Map<string, ReturnTypeInfo> {
    this.returnTypeEngine = new ReturnTypePropagationEngine();
    return this.returnTypeEngine.build(functions, callGraph, dataFlowGraph);
  }

  /**
   * Step 4: 파라미터 제약 검증
   */
  private validateParameterConstraints(
    functions: MinimalFunctionAST[]
  ): Map<string, FunctionParametersInfo> {
    this.parameterEngine = new ParameterConstraintsEngine();
    return this.parameterEngine.build(functions);
  }

  /**
   * Step 5: 함수별 점수화
   */
  private scoreAnalysis(
    functions: MinimalFunctionAST[],
    callGraph: CallGraph,
    dataFlowGraph: DataFlowGraph,
    returnTypes: Map<string, ReturnTypeInfo>,
    parameterConstraints: Map<string, FunctionParametersInfo>
  ): FunctionAnalysisScore[] {
    const scores: FunctionAnalysisScore[] = [];

    for (const fn of functions) {
      const fnName = fn.fnName;

      // CallGraph 신뢰도
      const callNode = callGraph.nodes.get(fnName);
      const callGraphConfidence = callNode ? 0.9 : 0.5;

      // DataFlow 신뢰도
      const dataFlowFn = dataFlowGraph.functions.get(fnName);
      const dataFlowConfidence = dataFlowFn ? 0.85 : 0.4;

      // ReturnType 신뢰도
      const returnTypeInfo = returnTypes.get(fnName);
      const returnTypeConfidence = returnTypeInfo?.confidence || 0.5;

      // Parameter 신뢰도
      const paramInfo = parameterConstraints.get(fnName);
      const parameterConfidence = paramInfo?.overallConfidence || 0.5;

      // 종합 점수 (가중 평균)
      const overallScore =
        (callGraphConfidence * 0.2 +
          dataFlowConfidence * 0.3 +
          returnTypeConfidence * 0.25 +
          parameterConfidence * 0.25) *
        100;

      // 도메인 결정
      let domain = 'unknown';
      if (returnTypeInfo && returnTypeInfo.domain !== 'unknown') {
        domain = returnTypeInfo.domain;
      } else if (paramInfo && paramInfo.parameters.length > 0) {
        domain = paramInfo.parameters[0].domain;
      }

      // 문제점 식별
      const issues: string[] = [];
      if (returnTypeInfo?.mismatch) {
        issues.push(`Type mismatch: ${returnTypeInfo.declaredType} vs ${returnTypeInfo.inferredType}`);
      }
      if (paramInfo && paramInfo.violatedConstraints > 0) {
        issues.push(`Parameter constraint violations: ${paramInfo.violatedConstraints}`);
      }
      if (callNode && callNode.callsTo.length === 0 && fn.fnName !== 'main') {
        issues.push('Function is not called by any other function (may be unused)');
      }

      scores.push({
        functionName: fnName,
        callGraphConfidence,
        dataFlowConfidence,
        returnTypeConfidence,
        parameterConfidence,
        overallScore,
        domain,
        issues,
      });
    }

    return scores;
  }

  /**
   * Step 6: 전체 정확도 계산
   */
  private calculateOverallAccuracy(scores: FunctionAnalysisScore[]): number {
    if (scores.length === 0) return 0.0;

    const avgScore = scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length;
    return Math.min(100, avgScore) / 100; // 0.0-1.0으로 정규화
  }

  /**
   * Step 7: 추론 근거 생성
   */
  private generateReasoning(
    functions: MinimalFunctionAST[],
    callGraph: CallGraph,
    returnTypes: Map<string, ReturnTypeInfo>,
    parameterConstraints: Map<string, FunctionParametersInfo>
  ): string[] {
    const reasonings: string[] = [];

    // 함수 개수
    reasonings.push(`Analysis: ${functions.length} functions`);

    // CallGraph 통계
    const totalEdges = callGraph.edges.length;
    const totalNodes = callGraph.nodes.size;
    reasonings.push(`Call graph: ${totalNodes} nodes, ${totalEdges} edges`);

    // 도메인 분포
    const domains = new Set(
      Array.from(returnTypes.values())
        .map((r) => r.domain)
        .filter((d) => d !== 'unknown')
    );
    if (domains.size > 0) {
      reasonings.push(`Domains detected: ${Array.from(domains).join(', ')}`);
    }

    // 타입 불일치
    const mismatches = Array.from(returnTypes.values()).filter((r) => r.mismatch);
    if (mismatches.length > 0) {
      reasonings.push(`Type mismatches detected: ${mismatches.length} functions`);
    }

    // 파라미터 제약 위반
    const violations = Array.from(parameterConstraints.values()).filter(
      (p) => p.violatedConstraints > 0
    );
    if (violations.length > 0) {
      reasonings.push(`Parameter constraint violations: ${violations.length} functions`);
    }

    // 미호출 함수
    const uncalledFunctions = Array.from(callGraph.nodes.values()).filter(
      (node) => node.isDefined && node.calledBy.length === 0
    );
    if (uncalledFunctions.length > 0) {
      reasonings.push(`Uncalled functions: ${uncalledFunctions.map((n) => n.name).join(', ')}`);
    }

    return reasonings;
  }

  /**
   * 최종 통합 분석 실행
   */
  build(functions: MinimalFunctionAST[]): IntegratedAnalysis {
    const reasonings: string[] = [];

    // Step 1: CallGraph
    reasonings.push('[1/7] Building call graph...');
    const callGraph = this.buildCallGraph(functions);

    // Step 2: DataFlow
    reasonings.push('[2/7] Analyzing data flow...');
    const dataFlowGraph = this.buildDataFlowGraph(functions, callGraph);

    // Step 3: ReturnType
    reasonings.push('[3/7] Propagating return types...');
    const returnTypes = this.propagateReturnTypes(functions, callGraph, dataFlowGraph);

    // Step 4: ParameterConstraints
    reasonings.push('[4/7] Validating parameter constraints...');
    const parameterConstraints = this.validateParameterConstraints(functions);

    // Step 5: Scoring
    reasonings.push('[5/7] Calculating function scores...');
    const functionScores = this.scoreAnalysis(
      functions,
      callGraph,
      dataFlowGraph,
      returnTypes,
      parameterConstraints
    );

    // Step 6: Overall Accuracy
    reasonings.push('[6/7] Computing overall accuracy...');
    const overallAccuracy = this.calculateOverallAccuracy(functionScores);

    // Step 7: Reasoning
    reasonings.push('[7/7] Generating reasoning...');
    const analysisReasoning = this.generateReasoning(
      functions,
      callGraph,
      returnTypes,
      parameterConstraints
    );
    reasonings.push(...analysisReasoning);

    return {
      callGraph,
      dataFlowGraph,
      returnTypes,
      parameterConstraints,
      functionScores,
      overallAccuracy,
      reasonings,
    };
  }

  /**
   * Phase 4 통합: 고급 타입 시스템 엔진들을 포함한 확장 분석
   *
   * Constraint Solver와 Trait Engine을 추가로 활성화
   */
  buildExtended(
    functions: MinimalFunctionAST[],
    options?: { enableConstraints?: boolean; enableTraits?: boolean }
  ): IntegratedAnalysis & { constraints?: ConstraintSolverResult; traits?: TraitEngineResult } {
    // 기본 분석 수행
    const baseAnalysis = this.build(functions);

    const result: any = baseAnalysis;

    // Constraint Solver 통합
    if (options?.enableConstraints) {
      this.constraintSolver = new ConstraintSolverEngine();
      const constraintResult = this.constraintSolver.build(functions);
      result.constraints = constraintResult;

      // 제약 만족도를 전체 정확도에 반영 (가중치 10%)
      const constraintWeight = 0.1;
      result.overallAccuracy = result.overallAccuracy * (1 - constraintWeight) +
                                constraintResult.satisfactionRate * constraintWeight;
      result.reasonings.push(
        `Constraint satisfaction: ${(constraintResult.satisfactionRate * 100).toFixed(1)}%`
      );
    }

    // Trait Engine 통합
    if (options?.enableTraits) {
      this.traitEngine = new TraitEngine();
      const traitResult = this.traitEngine.build(functions);
      result.traits = traitResult;

      // trait 완전성을 전체 정확도에 반영 (가중치 10%)
      const traitWeight = 0.1;
      result.overallAccuracy = result.overallAccuracy * (1 - traitWeight) +
                                traitResult.completeness * traitWeight;
      result.reasonings.push(
        `Trait completeness: ${(traitResult.completeness * 100).toFixed(1)}%`
      );
    }

    return result;
  }

  /**
   * 함수의 통합 분석 결과 조회
   */
  getFunctionScore(analysis: IntegratedAnalysis, fnName: string): FunctionAnalysisScore | null {
    return analysis.functionScores.find((s) => s.functionName === fnName) || null;
  }

  /**
   * 점수로 정렬된 함수들
   */
  getScoreSorted(analysis: IntegratedAnalysis): FunctionAnalysisScore[] {
    return analysis.functionScores.sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * 문제가 있는 함수들
   */
  getProblematicFunctions(analysis: IntegratedAnalysis): FunctionAnalysisScore[] {
    return analysis.functionScores.filter((s) => s.issues.length > 0);
  }

  /**
   * 신뢰도별 함수 필터링
   */
  getByConfidenceThreshold(
    analysis: IntegratedAnalysis,
    threshold: number = 0.75
  ): FunctionAnalysisScore[] {
    return analysis.functionScores.filter((s) => s.overallScore / 100 >= threshold);
  }
}
