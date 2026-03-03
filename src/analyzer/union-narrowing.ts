/**
 * ════════════════════════════════════════════════════════════════════
 * Union Narrowing Engine
 *
 * Union Type 생성, Type Guard 감지, Control Flow Narrowing
 * ════════════════════════════════════════════════════════════════════
 */

/**
 * Type Guard 정의
 */
export interface TypeGuard {
  type: 'typeof' | 'instanceof' | 'null_check' | 'comparison';
  expression: string;
  narrowsTo: string;
  confidence: number;
}

/**
 * Union Type 정보
 */
export interface UnionTypeInfo {
  name: string;
  unionType: string;              // "number | string | null"
  possibleTypes: string[];        // ["number", "string", "null"]
  narrowedType?: string;          // Type guard 후 narrowed type
  confidence: number;             // 0.0-1.0
  source: 'declaration' | 'control_flow' | 'type_guard';
  guards: TypeGuard[];
  reasoning: string[];
}

/**
 * Control Flow Path
 */
export interface ControlFlowPath {
  path: string;
  variables: Map<string, string>;
  confidence: number;
}

/**
 * Union Narrowing 결과
 */
export interface UnionNarrowingResult {
  variables: Map<string, UnionTypeInfo>;
  controlFlowPaths: ControlFlowPath[];
  narrowingSuccess: number;       // 0.0-1.0
  reasoning: string[];
}

/**
 * Union Narrowing Engine
 */
export class UnionNarrowingEngine {
  /**
   * 메인 빌드 메서드
   */
  build(code: string): UnionNarrowingResult {
    const result: UnionNarrowingResult = {
      variables: new Map(),
      controlFlowPaths: [],
      narrowingSuccess: 0,
      reasoning: []
    };

    // Step 1: Union Type 감지
    this.detectUnionTypes(code, result);

    // Step 2: Type Guards 감지
    this.detectTypeGuards(code, result);

    // Step 3: Control Flow 분석
    this.analyzeControlFlow(code, result);

    // Step 4: Narrowing 성공률 계산
    this.calculateNarrowingSuccess(result);

    return result;
  }

  /**
   * Union Type 감지
   */
  private detectUnionTypes(code: string, result: UnionNarrowingResult): void {
    // 패턴: 여러 번의 할당으로 union type 감지
    const assignmentPattern = /let\s+(\w+)\s*=\s*([^;\n]+);?/g;
    let match;
    const varAssignments = new Map<string, string[]>();

    while ((match = assignmentPattern.exec(code)) !== null) {
      const varName = match[1];
      const value = match[2].trim();

      if (!varAssignments.has(varName)) {
        varAssignments.set(varName, []);
      }
      varAssignments.get(varName)!.push(value);
    }

    // 여러 타입의 값이 할당된 변수는 union type
    for (const [varName, values] of varAssignments.entries()) {
      if (values.length > 1) {
        const types = new Set<string>();
        for (const val of values) {
          const type = this.inferTypeFromValue(val);
          if (type) types.add(type);
        }

        if (types.size > 1) {
          const unionType = Array.from(types).join(' | ');
          result.variables.set(varName, {
            name: varName,
            unionType,
            possibleTypes: Array.from(types),
            confidence: 0.85,
            source: 'declaration',
            guards: [],
            reasoning: [`Variable "${varName}" has multiple assignment types: ${unionType}`]
          });
          result.reasoning.push(`Union type detected: ${varName} = ${unionType}`);
        }
      }
    }
  }

  /**
   * Type Guard 감지
   */
  private detectTypeGuards(code: string, result: UnionNarrowingResult): void {
    // typeof check
    const typeofPattern = /typeof\s+(\w+)\s*===?\s*['"](number|string|boolean|object|undefined)['"]/g;
    let match;

    while ((match = typeofPattern.exec(code)) !== null) {
      const varName = match[1];
      const guardType = match[2];

      if (result.variables.has(varName)) {
        const info = result.variables.get(varName)!;
        info.guards.push({
          type: 'typeof',
          expression: match[0],
          narrowsTo: guardType,
          confidence: 0.90
        });
        result.reasoning.push(`Type guard found: typeof ${varName} === '${guardType}'`);
      }
    }

    // null check
    const nullCheckPattern = /(\w+)\s*!==?\s*null/g;
    const assignedVars = new Set<string>();
    result.variables.forEach((_, name) => assignedVars.add(name));

    while ((match = nullCheckPattern.exec(code)) !== null) {
      const varName = match[1];
      if (assignedVars.has(varName)) {
        if (result.variables.has(varName)) {
          const info = result.variables.get(varName)!;
          info.guards.push({
            type: 'null_check',
            expression: match[0],
            narrowsTo: 'non-null',
            confidence: 0.85
          });
        }
      }
    }
  }

  /**
   * Control Flow 분석
   */
  private analyzeControlFlow(code: string, result: UnionNarrowingResult): void {
    // if/else 패턴 분석
    const ifPattern = /if\s*\([^)]+\)\s*\{([^}]*)\}/g;
    let match;

    while ((match = ifPattern.exec(code)) !== null) {
      const ifBody = match[1];

      // if 블록 내 변수 사용 추적
      for (const [varName, info] of result.variables.entries()) {
        if (ifBody.includes(varName) && info.guards.length > 0) {
          // Guard에서 narrowsTo로 지정된 타입으로 narrowing
          const primaryGuard = info.guards[0];
          if (primaryGuard.narrowsTo && primaryGuard.narrowsTo !== 'non-null') {
            info.narrowedType = primaryGuard.narrowsTo;
            result.reasoning.push(
              `Control flow narrowing: ${varName} narrowed to ${primaryGuard.narrowsTo} in if block`
            );
          }
        }
      }
    }
  }

  /**
   * Narrowing 성공률 계산
   */
  private calculateNarrowingSuccess(result: UnionNarrowingResult): void {
    if (result.variables.size === 0) {
      result.narrowingSuccess = 0;
      return;
    }

    let narrowedCount = 0;
    for (const info of result.variables.values()) {
      if (info.narrowedType) narrowedCount++;
    }

    result.narrowingSuccess = narrowedCount / result.variables.size;
    result.reasoning.push(
      `Narrowing success: ${narrowedCount}/${result.variables.size} = ${(result.narrowingSuccess * 100).toFixed(1)}%`
    );
  }

  /**
   * 값에서 타입 추론
   */
  private inferTypeFromValue(value: string): string | null {
    value = value.trim();

    // 숫자
    if (/^\d+(\.\d+)?$/.test(value)) return 'number';

    // 문자열
    if (/^["'].*["']$/.test(value)) return 'string';

    // boolean
    if (value === 'true' || value === 'false') return 'boolean';

    // null/undefined
    if (value === 'null') return 'null';
    if (value === 'undefined') return 'undefined';

    // 배열
    if (value.startsWith('[')) return 'array';

    // 객체
    if (value.startsWith('{')) return 'object';

    return null;
  }

  /**
   * 특정 변수의 narrowed type 조회
   */
  getNarrowedType(result: UnionNarrowingResult, varName: string): string | null {
    const info = result.variables.get(varName);
    if (!info) return null;
    return info.narrowedType || info.unionType || null;
  }

  /**
   * 특정 변수의 union type 조회
   */
  getUnionType(result: UnionNarrowingResult, varName: string): string | null {
    const info = result.variables.get(varName);
    return info?.unionType || null;
  }

  /**
   * 모든 변수 조회
   */
  getAllVariables(result: UnionNarrowingResult): UnionTypeInfo[] {
    return Array.from(result.variables.values());
  }

  /**
   * 특정 타입 가드 조회
   */
  getGuards(result: UnionNarrowingResult, varName: string): TypeGuard[] {
    const info = result.variables.get(varName);
    return info?.guards || [];
  }
}
