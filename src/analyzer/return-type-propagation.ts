/**
 * Phase 3.4: Return Type Propagation
 *
 * 함수의 반환값 타입을 추적하고 도메인을 식별
 * - 각 함수의 반환값이 정말 선언된 타입과 일치하는가?
 * - 반환값이 어떤 도메인에 속하는가? (finance, web, etc)
 * - 반환값이 어떻게 다른 함수로 흐르는가?
 *
 * 기초: CallGraphBuilder + DataFlowGraphBuilder
 * 확장: 반환값 타입 검증 + 도메인 추론
 */

import { MinimalFunctionAST } from '../parser/ast';
import { CallGraphBuilder, CallGraph } from './call-graph-builder';
import { DataFlowGraphBuilder, DataFlowGraph, FunctionSignature } from './dataflow-graph';
import { BooleanLiteralDetector } from './boolean-literal-detector';
import { FunctionCallReturnInference } from './function-call-return-inference';
import { ConditionalExpressionAnalyzer } from './conditional-expression-analyzer';

/**
 * 반환값 타입 정보
 */
export interface ReturnTypeInfo {
  functionName: string;
  declaredType: string;           // 함수 선언시 outputType
  inferredType: string;            // 코드 분석으로 추론된 타입
  domain: string;                  // 도메인 (finance, web, etc)
  confidence: number;              // 0.0-1.0 (추론 신뢰도)
  mismatch: boolean;               // declaredType과 inferredType 불일치?
  reasonings: string[];            // 추론 근거
}

/**
 * 도메인 키워드 매핑
 */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  finance: ['price', 'tax', 'amount', 'balance', 'fee', 'rate', 'cost', 'currency'],
  web: ['url', 'email', 'html', 'html', 'dom', 'href', 'cookie', 'session'],
  crypto: ['hash', 'signature', 'key', 'cipher', 'token', 'nonce', 'salt'],
  'data-science': ['vector', 'matrix', 'tensor', 'array', 'mean', 'variance', 'distribution'],
  iot: ['sensor', 'device', 'signal', 'frequency', 'sensor', 'actuator', 'threshold'],
};

/**
 * 기본 타입 추론 규칙
 */
const TYPE_INFERENCE_PATTERNS: Record<string, RegExp> = {
  number: /\d+(\.\d+)?|\+|-|\*|\/|Math\.|parseInt|parseFloat|length/,
  string: /".*?"|'.*?'|\.length|\.substring|\.toUpperCase|\.toLowerCase/,
  boolean: /===|!==|>|<|&&|\|\|/,
  array: /\[.*?\]|\[|\]|\.push|\.pop|\.map|\.filter|\.reduce/,
  object: /\{.*?\}|\.[\w]+|new /,
};

/**
 * ReturnTypePropagationEngine
 */
export class ReturnTypePropagationEngine {
  private returnTypes: Map<string, ReturnTypeInfo> = new Map();
  private callGraph: CallGraph | null = null;
  private dataFlowGraph: DataFlowGraph | null = null;

  /**
   * Step 1: 함수 선언 타입 수집
   */
  private collectDeclaredTypes(functions: MinimalFunctionAST[]): void {
    for (const fn of functions) {
      const info: ReturnTypeInfo = {
        functionName: fn.fnName,
        declaredType: fn.outputType || 'unknown',
        inferredType: 'unknown',
        domain: 'unknown',
        confidence: 0.0,
        mismatch: false,
        reasonings: [],
      };
      this.returnTypes.set(fn.fnName, info);
    }
  }

  /**
   * Step 2: 반환값 타입 추론 (코드 분석)
   *
   * 정규식 기반:
   *   - return 숫자: number
   *   - return "문자": string
   *   - return [배열]: array
   *   - return { 객체 }: object
   *   - return 함수호출(): 호출된 함수의 반환값 타입
   */
  private inferReturnTypes(functions: MinimalFunctionAST[]): void {
    for (const fn of functions) {
      if (!fn.body) continue;

      const info = this.returnTypes.get(fn.fnName)!;

      // return 문 추출
      const returnPattern = /return\s+(.+?)(?:\n|$)/;
      const returnMatch = returnPattern.exec(fn.body);

      if (returnMatch) {
        const returnValue = returnMatch[1].trim();
        info.reasonings.push(`Return: ${returnValue}`);

        let inferredType = 'unknown';
        let confidence = 0.5;

        // 숫자 반환
        if (/^\d+(\.\d+)?$/.test(returnValue)) {
          inferredType = 'number';
          confidence = 0.95;
          info.reasonings.push('Literal number detected');
        }
        // Boolean 리터럴 반환 (Phase 3.5 추가)
        else if (/^(true|false)$/i.test(returnValue)) {
          inferredType = 'boolean';
          confidence = 0.95;
          info.reasonings.push('Boolean literal detected');
        }
        // 문자 반환
        else if (/^["'].*["']$/.test(returnValue)) {
          inferredType = 'string';
          confidence = 0.95;
          info.reasonings.push('Literal string detected');
        }
        // 배열 반환
        else if (/^\[/.test(returnValue)) {
          inferredType = 'array';
          confidence = 0.9;
          info.reasonings.push('Array literal detected');
        }
        // 객체 반환
        else if (/^\{/.test(returnValue)) {
          inferredType = 'object';
          confidence = 0.9;
          info.reasonings.push('Object literal detected');
        }
        // 함수 호출 반환
        else if (/\w+\s*\(/.test(returnValue)) {
          // 함수명 추출
          const funcNameMatch = /(\w+)\s*\(/.exec(returnValue);
          if (funcNameMatch) {
            const calledFunc = funcNameMatch[1];
            const calledFuncType = this.returnTypes.get(calledFunc);
            if (calledFuncType) {
              inferredType = calledFuncType.declaredType;
              confidence = 0.85;
              info.reasonings.push(`Function call: ${calledFunc}() returns ${inferredType}`);
            }
          }
        }
        // 변수 반환 (타입 체크)
        else if (/^[a-zA-Z_]\w*$/.test(returnValue)) {
          // 변수명만 있음 - 타입 불확실
          confidence = 0.6;
          info.reasonings.push(`Variable return: ${returnValue} (type uncertain)`);
        }

        info.inferredType = inferredType;
        info.confidence = Math.min(confidence, 1.0);
      } else {
        // return 문이 없으면 null 추론
        info.inferredType = 'null';
        info.confidence = 0.8;
        info.reasonings.push('No return statement found');
      }
    }
  }

  /**
   * Step 3: 도메인 추론 (반환값 이름 기반)
   *
   * 함수명 + 반환값 변수명으로 도메인 결정
   * 예: calculateTax() returns tax → finance 도메인
   */
  private inferDomains(functions: MinimalFunctionAST[]): void {
    for (const fn of functions) {
      const info = this.returnTypes.get(fn.fnName)!;

      // 함수명과 반환값 변수명에서 도메인 키워드 추출
      const nameContext = `${fn.fnName}`.toLowerCase();

      let detectedDomain = 'unknown';
      let domainConfidence = 0.0;

      // 각 도메인 키워드로 매칭
      for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
        for (const keyword of keywords) {
          if (nameContext.includes(keyword)) {
            detectedDomain = domain;
            domainConfidence = 0.85;
            info.reasonings.push(`Domain keyword: "${keyword}" → ${domain}`);
            break;
          }
        }
        if (detectedDomain !== 'unknown') break;
      }

      // 반환 타입에서도 도메인 추론
      if (info.inferredType === 'array' && nameContext.includes('vector')) {
        detectedDomain = 'data-science';
        domainConfidence = 0.9;
        info.reasonings.push('Vector + array → data-science domain');
      }

      info.domain = detectedDomain;
      info.confidence = Math.max(info.confidence, domainConfidence);
    }
  }

  /**
   * Step 4: 타입 불일치 검사
   *
   * declaredType과 inferredType이 호환 가능한가?
   */
  private checkTypeMismatch(functions: MinimalFunctionAST[]): void {
    for (const fn of functions) {
      const info = this.returnTypes.get(fn.fnName)!;

      // 타입 호환성 체크
      const mismatch = this.isTypeIncompatible(
        info.declaredType,
        info.inferredType
      );

      info.mismatch = mismatch;

      if (mismatch) {
        info.reasonings.push(
          `⚠️ Type mismatch: declared "${info.declaredType}" vs inferred "${info.inferredType}"`
        );
        info.confidence = Math.max(0.3, info.confidence - 0.2);
      }
    }
  }

  /**
   * 두 타입이 호환되는가?
   */
  private isTypeIncompatible(declared: string, inferred: string): boolean {
    // unknown 타입은 모두 호환
    if (declared === 'unknown' || inferred === 'unknown') return false;

    // 동일 타입
    if (declared === inferred) return false;

    // 기본 타입 호환성 (느슨한 검사)
    const numberTypes = ['number', 'integer', 'float', 'decimal'];
    const stringTypes = ['string', 'text', 'char'];
    const arrayTypes = ['array', 'list', 'vector'];

    if (numberTypes.includes(declared) && numberTypes.includes(inferred)) {
      return false;
    }
    if (stringTypes.includes(declared) && stringTypes.includes(inferred)) {
      return false;
    }
    if (arrayTypes.includes(declared) && arrayTypes.includes(inferred)) {
      return false;
    }

    // 다른 타입이면 불호환
    return true;
  }

  /**
   * Step 5: 최종 빌드 (모든 단계 통합)
   */
  build(
    functions: MinimalFunctionAST[],
    callGraph?: CallGraph,
    dataFlowGraph?: DataFlowGraph
  ): Map<string, ReturnTypeInfo> {
    // 선택사항: 외부 그래프 통합
    if (callGraph) this.callGraph = callGraph;
    if (dataFlowGraph) this.dataFlowGraph = dataFlowGraph;

    // Step 1: 선언 타입 수집
    this.collectDeclaredTypes(functions);

    // Step 2: 반환값 타입 추론
    this.inferReturnTypes(functions);

    // Step 3: 도메인 추론
    this.inferDomains(functions);

    // Step 4: 타입 불일치 검사
    this.checkTypeMismatch(functions);

    return this.returnTypes;
  }

  /**
   * 특정 함수의 반환값 타입 조회
   */
  getReturnType(fnName: string): ReturnTypeInfo | null {
    return this.returnTypes.get(fnName) || null;
  }

  /**
   * 모든 반환값 타입 조회
   */
  getAllReturnTypes(): ReturnTypeInfo[] {
    return Array.from(this.returnTypes.values());
  }

  /**
   * 특정 도메인의 함수들 조회
   */
  getFunctionsByDomain(domain: string): ReturnTypeInfo[] {
    return Array.from(this.returnTypes.values()).filter(
      (info) => info.domain === domain
    );
  }

  /**
   * 타입 불일치 함수 조회
   */
  getMismatchedFunctions(): ReturnTypeInfo[] {
    return Array.from(this.returnTypes.values()).filter(
      (info) => info.mismatch
    );
  }

  /**
   * 신뢰도 높은 함수 조회 (> threshold)
   */
  getHighConfidenceFunctions(threshold: number = 0.8): ReturnTypeInfo[] {
    return Array.from(this.returnTypes.values()).filter(
      (info) => info.confidence >= threshold
    );
  }
}
