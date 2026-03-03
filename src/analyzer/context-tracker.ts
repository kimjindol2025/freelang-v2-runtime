/**
 * Phase 3 Stage 2: Context Tracker
 *
 * 깊은 컨텍스트 추적 시스템
 * - 스코프 체인 (전역 → 함수 → 블록)
 * - 의존성 그래프 (변수 간 관계)
 * - 타입 불확실성 추적 (union types)
 * - 신뢰도 강화
 *
 * 목표: Stage 1 기초 + 신뢰도 향상 (0.5 → 0.75)
 */

/**
 * 스코프 수준
 */
export enum ScopeLevel {
  GLOBAL = 'global',
  FUNCTION = 'function',
  BLOCK = 'block',
  LOOP = 'loop',
  CONDITIONAL = 'conditional',
}

/**
 * 단일 스코프의 변수 정보
 */
export interface ScopeVariable {
  name: string;
  types: Set<string>;        // 가능한 모든 타입
  primaryType: string;       // 주로 사용되는 타입
  confidence: number;        // 현재 신뢰도
  lastAssignmentLine?: number;
  isParameter?: boolean;     // 입력 파라미터인가
  isReassigned?: boolean;    // 재할당되었는가
}

/**
 * 단일 스코프
 */
export interface Scope {
  level: ScopeLevel;
  name: string;              // 함수명, 블록명 등
  variables: Map<string, ScopeVariable>;
  parent?: Scope;
  children: Scope[];
  startLine?: number;
  endLine?: number;
}

/**
 * 변수 간 의존성 정보
 */
export interface Dependency {
  from: string;              // 의존 변수 (y는 x에 의존)
  to: string;                // 피의존 변수
  type: 'assignment' | 'operation' | 'method' | 'parameter';
  confidence: number;
  line: number;
}

/**
 * 타입 불확실성 추적
 */
export interface TypeUncertainty {
  variable: string;
  possibleTypes: Map<string, number>; // 타입 → 확률
  source: 'conditional' | 'parameter' | 'method';
  resolutionLine?: number;
}

/**
 * Context Tracker - 스코프, 의존성, 불확실성 관리
 */
export class ContextTracker {
  private scopeChain: Scope[] = [];
  private globalScope: Scope;
  private dependencyGraph: Map<string, Dependency[]> = new Map();
  private typeUncertainties: TypeUncertainty[] = [];

  constructor() {
    this.globalScope = {
      level: ScopeLevel.GLOBAL,
      name: 'global',
      variables: new Map(),
      children: [],
    };
    this.scopeChain = [this.globalScope];
  }

  /**
   * 새 스코프 시작
   * if/for/function 블록 진입
   */
  public pushScope(level: ScopeLevel, name: string): Scope {
    const parentScope = this.scopeChain[this.scopeChain.length - 1];
    const newScope: Scope = {
      level,
      name,
      variables: new Map(),
      parent: parentScope,
      children: [],
    };

    parentScope.children.push(newScope);
    this.scopeChain.push(newScope);
    return newScope;
  }

  /**
   * 스코프 종료
   */
  public popScope(): Scope {
    if (this.scopeChain.length <= 1) {
      throw new Error('Cannot pop global scope');
    }
    return this.scopeChain.pop()!;
  }

  /**
   * 현재 스코프 얻기
   */
  public getCurrentScope(): Scope {
    return this.scopeChain[this.scopeChain.length - 1];
  }

  /**
   * 변수 선언/할당 (현재 스코프에서)
   * 부모 스코프의 변수도 찾아서 재할당 처리
   */
  public declareOrAssignVariable(
    name: string,
    type: string,
    isParameter: boolean = false,
    line?: number
  ): void {
    const scope = this.getCurrentScope();
    let varInfo = scope.variables.get(name);

    // 현재 스코프에 없으면 부모 스코프에서 찾기 (재할당 체크)
    if (!varInfo) {
      varInfo = this.lookupVariable(name) || undefined;
    }

    if (varInfo) {
      // 재할당: 기존 변수에 새 타입 추가
      const oldType = varInfo.primaryType;

      if (oldType !== type && oldType !== 'unknown' && type !== 'unknown') {
        // 타입이 다르면 불확실성 추적
        this.trackTypeUncertainty(name, oldType, type, 'conditional', line);
        varInfo.isReassigned = true;
      }

      varInfo.types.add(type);
      varInfo.primaryType = type;
      varInfo.lastAssignmentLine = line;
      varInfo.confidence = this.calculateConfidenceForReassignment(varInfo);
    } else {
      // 새 선언: 현재 스코프에만 생성
      scope.variables.set(name, {
        name,
        types: new Set([type]),
        primaryType: type,
        confidence: isParameter ? 0.95 : 0.85,
        lastAssignmentLine: line,
        isParameter,
        isReassigned: false,
      });
    }
  }

  /**
   * 변수 조회 (현재 스코프 + 상위 스코프)
   */
  public lookupVariable(name: string): ScopeVariable | null {
    // 현재 스코프부터 역순으로 탐색
    for (let i = this.scopeChain.length - 1; i >= 0; i--) {
      const scope = this.scopeChain[i];
      if (scope.variables.has(name)) {
        return scope.variables.get(name)!;
      }
    }
    return null;
  }

  /**
   * 의존성 기록
   * y = x + 5 → y depends on x
   */
  public recordDependency(
    fromVar: string,
    toVar: string,
    depType: 'assignment' | 'operation' | 'method' | 'parameter',
    line: number,
    confidence: number = 0.8
  ): void {
    if (!this.dependencyGraph.has(fromVar)) {
      this.dependencyGraph.set(fromVar, []);
    }

    this.dependencyGraph.get(fromVar)!.push({
      from: fromVar,
      to: toVar,
      type: depType,
      confidence,
      line,
    });
  }

  /**
   * 변수의 의존성 조회
   */
  public getDependencies(variable: string): Dependency[] {
    return this.dependencyGraph.get(variable) || [];
  }

  /**
   * 변수에 영향을 주는 모든 변수 (전이적)
   * x = 10
   * y = x + 5
   * z = y * 2
   * → z의 영향: [y, x]
   */
  public getTransitiveDependencies(variable: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const traverse = (current: string): void => {
      if (visited.has(current)) return;
      visited.add(current);

      const deps = this.getDependencies(current);
      for (const dep of deps) {
        result.push(dep.to);
        traverse(dep.to);
      }
    };

    traverse(variable);
    return result;
  }

  /**
   * 타입 불확실성 추적
   * if (cond) x = 10
   * else x = "hello"
   * → x: number | string
   */
  private trackTypeUncertainty(
    variable: string,
    type1: string,
    type2: string,
    source: 'conditional' | 'parameter' | 'method',
    line?: number
  ): void {
    // 기존 불확실성 찾기
    let uncertainty = this.typeUncertainties.find(u => u.variable === variable);

    if (!uncertainty) {
      uncertainty = {
        variable,
        possibleTypes: new Map(),
        source,
      };
      this.typeUncertainties.push(uncertainty);
    } else {
      // 기존 불확실성의 source를 최신 context로 업데이트
      uncertainty.source = source;
    }

    // 타입 추가
    uncertainty.possibleTypes.set(type1, 0.5);
    uncertainty.possibleTypes.set(type2, 0.5);
  }

  /**
   * 변수의 타입 불확실성 조회
   */
  public getTypeUncertainty(variable: string): TypeUncertainty | null {
    return this.typeUncertainties.find(u => u.variable === variable) || null;
  }

  /**
   * 재할당된 변수의 신뢰도 계산
   */
  private calculateConfidenceForReassignment(varInfo: ScopeVariable): number {
    if (varInfo.types.size === 1) {
      // 단일 타입: 신뢰도 유지
      return varInfo.confidence;
    }

    if (varInfo.types.size === 2) {
      // 이중 타입: 신뢰도 50% 감소
      return Math.max(0.3, varInfo.confidence - 0.3);
    }

    // 3개 이상: 신뢰도 더 감소
    return Math.max(0.2, varInfo.confidence - 0.5);
  }

  /**
   * 스코프 정보 기반 신뢰도 강화
   * - 루프 내: 컨텍스트로부터 신뢰도 향상
   * - 조건문: 불확실성 증가
   */
  public enhanceConfidenceByContext(variable: string): number {
    const varInfo = this.lookupVariable(variable);
    if (!varInfo) return 0;

    let enhancedConfidence = varInfo.confidence;

    // 스코프별 신뢰도 조정
    const currentScope = this.getCurrentScope();

    if (currentScope.level === ScopeLevel.LOOP) {
      // 루프 내: 컨텍스트에서 나온 정보는 신뢰도 높음
      if (varInfo.isParameter) {
        enhancedConfidence = Math.min(1.0, enhancedConfidence + 0.1);
      }
    } else if (currentScope.level === ScopeLevel.CONDITIONAL) {
      // 조건문 내: 경로에 따라 불확실
      if (varInfo.isReassigned) {
        enhancedConfidence = Math.max(0.3, enhancedConfidence - 0.2);
      }
    }

    // 의존성에 따른 조정
    const deps = this.getTransitiveDependencies(variable);
    for (const depVar of deps) {
      const depInfo = this.lookupVariable(depVar);
      if (depInfo && depInfo.confidence < 0.6) {
        // 의존하는 변수의 신뢰도가 낮으면 현재 변수도 낮춤
        enhancedConfidence = Math.min(enhancedConfidence, depInfo.confidence);
      }
    }

    return enhancedConfidence;
  }

  /**
   * 변수들 간의 타입 제약 검증
   */
  public validateTypeConstraints(constraints: Array<{ vars: string[]; constraint: string }>): boolean {
    for (const constraint of constraints) {
      const vars = constraint.vars.map(v => this.lookupVariable(v));

      if (constraint.constraint === 'numeric') {
        // 모든 변수가 numeric이어야 함
        const nonNumeric = vars.filter(
          v => v && !['number', 'unknown'].includes(v.primaryType)
        );
        if (nonNumeric.length > 0) {
          // 경고: 타입 불일치
          return false;
        }
      }

      if (constraint.constraint === 'array') {
        // 변수가 array여야 함
        const nonArray = vars.filter(v => v && v.primaryType !== 'array');
        if (nonArray.length > 0) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * 스코프 체인 출력 (디버그)
   */
  public printScopeChain(): string {
    const lines: string[] = [];

    const printScope = (scope: Scope, indent: number): void => {
      const prefix = '  '.repeat(indent);
      lines.push(`${prefix}Scope: ${scope.level} (${scope.name})`);

      for (const [name, varInfo] of scope.variables) {
        lines.push(
          `${prefix}  ${name}: ${varInfo.primaryType} (confidence: ${(varInfo.confidence * 100).toFixed(0)}%)`
        );
        if (varInfo.types.size > 1) {
          lines.push(`${prefix}    possible: ${Array.from(varInfo.types).join(', ')}`);
        }
      }

      for (const child of scope.children) {
        printScope(child, indent + 1);
      }
    };

    printScope(this.globalScope, 0);
    return lines.join('\n');
  }

  /**
   * 의존성 그래프 출력 (디버그)
   */
  public printDependencyGraph(): string {
    const lines: string[] = [];
    lines.push('=== Dependency Graph ===\n');

    for (const [fromVar, deps] of this.dependencyGraph) {
      for (const dep of deps) {
        lines.push(`${fromVar} → ${dep.to} (${dep.type}, confidence: ${(dep.confidence * 100).toFixed(0)}%)`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 타입 불확실성 출력 (디버그)
   */
  public printTypeUncertainties(): string {
    const lines: string[] = [];
    lines.push('=== Type Uncertainties ===\n');

    for (const uncertainty of this.typeUncertainties) {
      const types = Array.from(uncertainty.possibleTypes.keys())
        .map(t => `${t} (${(uncertainty.possibleTypes.get(t)! * 100).toFixed(0)}%)`)
        .join(', ');
      lines.push(`${uncertainty.variable}: ${types}`);
    }

    return lines.join('\n');
  }
}

// Convenience function
export function createContextTracker(): ContextTracker {
  return new ContextTracker();
}
