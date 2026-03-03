/**
 * Phase 3.4: Parameter Constraints
 *
 * 함수 파라미터의 타입 제약과 도메인 강제
 * - 파라미터는 어떤 도메인에서만 받아야 하는가?
 * - 파라미터 타입이 함수 내에서 어떻게 사용되는가?
 * - 파라미터가 다른 함수로 전달될 때 타입 호환성이 유지되는가?
 *
 * 기초: CallGraphBuilder + DataFlowGraphBuilder + ReturnTypePropagationEngine
 * 확장: 파라미터 검증 + 도메인 제약 + 타입 호환성
 */

import { MinimalFunctionAST } from '../parser/ast';

/**
 * 파라미터 정보
 */
export interface ParameterInfo {
  name: string;
  type: string;                   // 선언된 타입
  domain: string;                 // 도메인 (finance, web, etc)
  isRequired: boolean;             // 필수 파라미터인가?
  constraints: ParameterConstraint[];
  confidence: number;              // 0.0-1.0
  usage: ParameterUsage[];
}

/**
 * 파라미터 제약 조건
 */
export interface ParameterConstraint {
  type: 'domain' | 'type' | 'range' | 'format' | 'custom';
  description: string;
  strictness: 'low' | 'medium' | 'high';  // 얼마나 엄격한가?
  violated: boolean;                      // 제약이 위반되었는가?
}

/**
 * 파라미터 사용 정보
 */
export interface ParameterUsage {
  location: 'arithmetic' | 'string' | 'function_arg' | 'comparison' | 'property_access';
  count: number;
  relatedFunction?: string;  // 전달되는 함수명
}

/**
 * 함수의 파라미터 정보 모음
 */
export interface FunctionParametersInfo {
  functionName: string;
  parameters: ParameterInfo[];
  totalConstraints: number;
  violatedConstraints: number;
  overallConfidence: number;
}

/**
 * 도메인별 파라미터 타입 기대값
 */
const DOMAIN_TYPE_EXPECTATIONS: Record<string, string[]> = {
  finance: ['number', 'decimal', 'currency', 'integer', 'float'],
  web: ['string', 'url', 'email', 'html', 'integer'],
  crypto: ['string', 'hash', 'binary', 'hex'],
  'data-science': ['array', 'number', 'vector', 'matrix', 'tensor'],
  iot: ['number', 'float', 'integer', 'boolean', 'signal'],
};

/**
 * 파라미터 사용 패턴 인식
 */
const USAGE_PATTERNS: Record<string, RegExp> = {
  arithmetic: /[\+\-\*\/\%]/,
  string: /\.\w+\(|\.length|\.substring|\.toUpperCase/,
  function_arg: /\(\s*\w+\s*\)/,
  comparison: /[\=\!\>\<\&\|]/,
  property_access: /\.\w+(?!\()/,
};

/**
 * ParameterConstraintsEngine
 */
export class ParameterConstraintsEngine {
  private functionParams: Map<string, FunctionParametersInfo> = new Map();

  /**
   * Step 1: 파라미터 정보 수집
   *
   * 함수의 inputType에서 파라미터 타입 추출
   */
  private collectParameters(functions: MinimalFunctionAST[]): void {
    for (const fn of functions) {
      const paramsInfo: FunctionParametersInfo = {
        functionName: fn.fnName,
        parameters: [],
        totalConstraints: 0,
        violatedConstraints: 0,
        overallConfidence: 0.0,
      };

      // 단순 경우: inputType이 파라미터 타입
      if (fn.inputType && fn.inputType !== 'null') {
        const param: ParameterInfo = {
          name: 'input',
          type: fn.inputType,
          domain: 'unknown',
          isRequired: true,
          constraints: [],
          confidence: 0.9,
          usage: [],
        };
        paramsInfo.parameters.push(param);
      }

      this.functionParams.set(fn.fnName, paramsInfo);
    }
  }

  /**
   * Step 2: 도메인 추론 (함수명 기반)
   *
   * 함수명에서 도메인을 추론하고, 파라미터에 적용
   */
  private inferDomains(functions: MinimalFunctionAST[]): void {
    // 도메인 키워드 미리 정의
    const domainKeywords = {
      finance: ['price', 'tax', 'amount', 'balance', 'fee', 'rate', 'cost', 'currency', 'calculate'],
      web: ['email', 'url', 'validate', 'html', 'dom', 'href', 'cookie', 'session'],
      crypto: ['hash', 'signature', 'key', 'cipher', 'token', 'nonce', 'salt', 'compute'],
      'data-science': ['vector', 'filter', 'matrix', 'tensor', 'array', 'mean', 'variance'],
      iot: ['sensor', 'device', 'signal', 'frequency', 'actuator', 'threshold', 'read'],
    };

    for (const fn of functions) {
      const fnNameLower = fn.fnName.toLowerCase();
      const paramsInfo = this.functionParams.get(fn.fnName);
      if (!paramsInfo) continue;

      // 함수명에서 도메인 키워드 찾기
      for (const [domain, keywords] of Object.entries(domainKeywords)) {
        for (const keyword of keywords) {
          if (fnNameLower.includes(keyword)) {
            // 모든 파라미터에 도메인 적용
            for (const param of paramsInfo.parameters) {
              param.domain = domain;
              param.confidence = Math.min(0.95, param.confidence + 0.1);
            }
            break;
          }
        }
        // 파라미터가 있고 도메인이 식별되었으면 중단
        if (paramsInfo.parameters.length > 0 && paramsInfo.parameters[0].domain !== 'unknown') {
          break;
        }
      }
    }
  }

  /**
   * Step 3: 파라미터 사용 분석
   *
   * 함수 본문에서 파라미터가 어떻게 사용되는가?
   */
  private analyzeUsage(functions: MinimalFunctionAST[]): void {
    for (const fn of functions) {
      if (!fn.body) continue;

      const paramsInfo = this.functionParams.get(fn.fnName);
      if (!paramsInfo) continue;

      // 각 파라미터의 사용 분석
      for (const param of paramsInfo.parameters) {
        const paramName = param.name;

        // 각 사용 패턴 확인
        for (const [locType, pattern] of Object.entries(USAGE_PATTERNS)) {
          const matches = fn.body.match(new RegExp(paramName + '.*?' + pattern.source, 'g'));
          if (matches && matches.length > 0) {
            const usage: ParameterUsage = {
              location: locType as any,
              count: matches.length,
            };
            param.usage.push(usage);
          }
        }
      }
    }
  }

  /**
   * Step 4: 타입 제약 생성
   *
   * 파라미터의 타입과 도메인에서 제약 조건 생성
   */
  private generateConstraints(functions: MinimalFunctionAST[]): void {
    for (const fn of functions) {
      const paramsInfo = this.functionParams.get(fn.fnName);
      if (!paramsInfo) continue;

      for (const param of paramsInfo.parameters) {
        // 도메인 제약
        if (param.domain !== 'unknown') {
          const expectedTypes = DOMAIN_TYPE_EXPECTATIONS[param.domain] || [];
          const constraint: ParameterConstraint = {
            type: 'domain',
            description: `Domain constraint: ${param.domain} expects types ${expectedTypes.join(', ')}`,
            strictness: 'high',
            violated: !expectedTypes.includes(param.type),
          };
          param.constraints.push(constraint);

          if (constraint.violated) {
            paramsInfo.violatedConstraints++;
          }
        }

        // 타입 제약 (기본 타입 체크)
        const validTypes = ['number', 'string', 'boolean', 'array', 'object', 'unknown'];
        const typeConstraint: ParameterConstraint = {
          type: 'type',
          description: `Type constraint: parameter type must be one of ${validTypes.join(', ')}`,
          strictness: 'medium',
          violated: !validTypes.includes(param.type) && !param.type.includes('<'),
        };
        param.constraints.push(typeConstraint);

        if (typeConstraint.violated) {
          paramsInfo.violatedConstraints++;
        }

        // 사용 기반 제약
        for (const usage of param.usage) {
          if (usage.location === 'arithmetic' && param.type !== 'number') {
            const usageConstraint: ParameterConstraint = {
              type: 'custom',
              description: `Usage constraint: parameter used in arithmetic, but type is ${param.type}`,
              strictness: 'high',
              violated: true,
            };
            param.constraints.push(usageConstraint);
            paramsInfo.violatedConstraints++;
          }
        }

        paramsInfo.totalConstraints += param.constraints.length;
      }

      // 전체 신뢰도 계산
      if (paramsInfo.totalConstraints > 0) {
        const satisfiedConstraints = paramsInfo.totalConstraints - paramsInfo.violatedConstraints;
        paramsInfo.overallConfidence = satisfiedConstraints / paramsInfo.totalConstraints;
      } else {
        paramsInfo.overallConfidence = 0.5; // 제약 없으면 중간 신뢰도
      }
    }
  }

  /**
   * 최종 빌드 (모든 단계 통합)
   */
  build(functions: MinimalFunctionAST[]): Map<string, FunctionParametersInfo> {
    // Step 1: 파라미터 수집
    this.collectParameters(functions);

    // Step 2: 도메인 추론
    this.inferDomains(functions);

    // Step 3: 사용 분석
    this.analyzeUsage(functions);

    // Step 4: 제약 생성
    this.generateConstraints(functions);

    return this.functionParams;
  }

  /**
   * 특정 함수의 파라미터 정보 조회
   */
  getFunctionParameters(fnName: string): FunctionParametersInfo | null {
    return this.functionParams.get(fnName) || null;
  }

  /**
   * 제약이 위반된 함수들
   */
  getViolatedFunctions(): FunctionParametersInfo[] {
    return Array.from(this.functionParams.values()).filter(
      (info) => info.violatedConstraints > 0
    );
  }

  /**
   * 특정 도메인의 파라미터 검증
   */
  validateParameterDomain(fnName: string, paramName: string, type: string): boolean {
    const fnInfo = this.functionParams.get(fnName);
    if (!fnInfo) return false;

    const param = fnInfo.parameters.find((p) => p.name === paramName);
    if (!param) return false;

    if (param.domain === 'unknown') return true;

    const expectedTypes = DOMAIN_TYPE_EXPECTATIONS[param.domain] || [];
    return expectedTypes.includes(type);
  }

  /**
   * 신뢰도 높은 함수 조회
   */
  getHighConfidenceFunctions(threshold: number = 0.8): FunctionParametersInfo[] {
    return Array.from(this.functionParams.values()).filter(
      (info) => info.overallConfidence >= threshold
    );
  }

  /**
   * 모든 함수의 파라미터 정보 조회
   */
  getAllFunctionParameters(): FunctionParametersInfo[] {
    return Array.from(this.functionParams.values());
  }
}
