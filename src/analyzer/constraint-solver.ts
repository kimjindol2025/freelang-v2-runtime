/**
 * ════════════════════════════════════════════════════════════════════
 * Constraint Solver Engine
 *
 * Where Clause, Trait Bounds, Unification을 통한 제약 해결
 * ════════════════════════════════════════════════════════════════════
 */

import { MinimalFunctionAST } from '../parser/ast';

/**
 * Type Constraint 정의
 */
export interface TypeConstraint {
  id: string;
  type: 'equality' | 'subtype' | 'trait_bound' | 'where_clause';
  left: string;                    // "T"
  right: string;                   // "number"
  operator: '==' | '<:' | ':' | 'where';
  confidence: number;
  source: string;
  violated: boolean;
}

/**
 * Unification 결과
 */
export interface UnificationResult {
  success: boolean;
  substitution: Map<string, string>;  // T → number
  confidence: number;
  reasoning: string[];
}

/**
 * Constraint Solver 결과
 */
export interface ConstraintSolverResult {
  constraints: TypeConstraint[];
  unifications: UnificationResult[];
  satisfied: number;               // 만족된 제약 수
  violated: number;                // 위반된 제약 수
  satisfactionRate: number;        // 0.0-1.0
  reasoning: string[];
}

/**
 * Constraint Solver Engine
 */
export class ConstraintSolverEngine {
  /**
   * 메인 빌드 메서드
   */
  build(functions: MinimalFunctionAST[]): ConstraintSolverResult {
    const result: ConstraintSolverResult = {
      constraints: [],
      unifications: [],
      satisfied: 0,
      violated: 0,
      satisfactionRate: 0,
      reasoning: []
    };

    // Step 1: 제약 수집
    this.collectConstraints(functions, result);

    // Step 2: Unification 시도
    this.unifyConstraints(result);

    // Step 3: Trait Bounds 검증
    this.validateTraitBounds(functions, result);

    // Step 4: Where Clause 처리
    this.processWhereClauses(functions, result);

    // Step 5: 만족도 계산
    this.calculateSatisfaction(result);

    return result;
  }

  /**
   * 제약 수집
   */
  private collectConstraints(functions: MinimalFunctionAST[], result: ConstraintSolverResult): void {
    for (const fn of functions) {
      // inputType → outputType 제약
      if (fn.inputType && fn.outputType && fn.inputType !== 'null' && fn.outputType !== 'null') {
        const constraint: TypeConstraint = {
          id: `${fn.fnName}_io`,
          type: 'equality',
          left: fn.inputType,
          right: fn.outputType,
          operator: '==',
          confidence: 0.75,
          source: `Function ${fn.fnName} signature`,
          violated: fn.inputType !== fn.outputType
        };
        result.constraints.push(constraint);

        if (!constraint.violated) {
          result.satisfied++;
        } else {
          result.violated++;
        }
      }

      // Generic constraints (T extends X)
      if (fn.body) {
        const extendsPattern = /(\w+)\s+extends\s+(\w+(?:<[\w,\s]+>)?)/g;
        let match;
        while ((match = extendsPattern.exec(fn.body)) !== null) {
          const constraint: TypeConstraint = {
            id: `${fn.fnName}_${match[1]}_subtype`,
            type: 'subtype',
            left: match[1],
            right: match[2],
            operator: '<:',
            confidence: 0.90,
            source: `Type parameter constraint in ${fn.fnName}`,
            violated: false
          };
          result.constraints.push(constraint);
          result.satisfied++;
        }
      }
    }

    result.reasoning.push(`Collected ${result.constraints.length} constraints`);
  }

  /**
   * Unification 알고리즘
   */
  private unifyConstraints(result: ConstraintSolverResult): void {
    const substitution = new Map<string, string>();
    const unifiedConstraints = new Set<string>();

    for (const constraint of result.constraints) {
      if (constraint.type === 'equality') {
        // T == number → 대입 T → number
        if (this.isTypeVariable(constraint.left) && !this.isTypeVariable(constraint.right)) {
          substitution.set(constraint.left, constraint.right);
          unifiedConstraints.add(constraint.id);
          constraint.violated = false;

          result.reasoning.push(
            `Unified: ${constraint.left} = ${constraint.right} (confidence: ${constraint.confidence})`
          );
        } else if (!this.isTypeVariable(constraint.left) && this.isTypeVariable(constraint.right)) {
          // number == T → T = number
          substitution.set(constraint.right, constraint.left);
          unifiedConstraints.add(constraint.id);
          constraint.violated = false;
        } else if (constraint.left === constraint.right) {
          // Same type
          unifiedConstraints.add(constraint.id);
          constraint.violated = false;
        } else if (this.isTypeVariable(constraint.left) && this.isTypeVariable(constraint.right)) {
          // T == U → T = U
          substitution.set(constraint.left, constraint.right);
          unifiedConstraints.add(constraint.id);
          constraint.violated = false;
        } else {
          // Incompatible
          constraint.violated = true;
        }
      }
    }

    // 대입 적용
    this.applySubstitution(substitution, result);

    if (substitution.size > 0) {
      result.unifications.push({
        success: true,
        substitution,
        confidence: 0.85,
        reasoning: [`Unified ${substitution.size} type variables`]
      });
    }
  }

  /**
   * 대입 적용
   */
  private applySubstitution(
    substitution: Map<string, string>,
    result: ConstraintSolverResult
  ): void {
    for (const constraint of result.constraints) {
      if (substitution.has(constraint.left)) {
        constraint.left = substitution.get(constraint.left)!;
      }
      if (substitution.has(constraint.right)) {
        constraint.right = substitution.get(constraint.right)!;
      }
    }
  }

  /**
   * Type variable 판별
   */
  private isTypeVariable(type: string): boolean {
    return /^[A-Z]$/.test(type) || (/^[A-Z][a-zA-Z0-9]*$/.test(type) && !this.isBuiltinType(type));
  }

  /**
   * 내장 타입 판별
   */
  private isBuiltinType(type: string): boolean {
    const builtins = [
      'number', 'string', 'bool', 'boolean', 'array', 'object',
      'any', 'null', 'undefined', 'void'
    ];
    return builtins.includes(type.toLowerCase());
  }

  /**
   * Trait Bounds 검증
   */
  private validateTraitBounds(functions: MinimalFunctionAST[], result: ConstraintSolverResult): void {
    for (const fn of functions) {
      if (!fn.body) continue;

      // Trait bound: T: Trait
      const traitBoundPattern = /(\w+)\s*:\s*(\w+(?:<[\w,\s]+>)?)/g;
      let match;
      while ((match = traitBoundPattern.exec(fn.body)) !== null) {
        const typeParam = match[1];
        const trait = match[2];

        const constraint: TypeConstraint = {
          id: `${fn.fnName}_${typeParam}_trait`,
          type: 'trait_bound',
          left: typeParam,
          right: trait,
          operator: ':',
          confidence: 0.85,
          source: `Trait bound in ${fn.fnName}`,
          violated: false
        };
        result.constraints.push(constraint);
        result.satisfied++;
      }
    }
  }

  /**
   * Where Clause 처리
   */
  private processWhereClauses(functions: MinimalFunctionAST[], result: ConstraintSolverResult): void {
    for (const fn of functions) {
      if (!fn.body) continue;

      // where T: Trait, K: OtherTrait
      const wherePattern = /where\s+([^{]+)/g;
      let match;
      while ((match = wherePattern.exec(fn.body)) !== null) {
        const clauseStr = match[1];
        const clauses = clauseStr.split(',').map(c => c.trim());

        for (const clause of clauses) {
          const parts = clause.split(':').map(p => p.trim());
          if (parts.length === 2) {
            const constraint: TypeConstraint = {
              id: `${fn.fnName}_where_${parts[0]}`,
              type: 'where_clause',
              left: parts[0],
              right: parts[1],
              operator: 'where',
              confidence: 0.90,
              source: `Where clause in ${fn.fnName}`,
              violated: false
            };
            result.constraints.push(constraint);
            result.satisfied++;

            result.reasoning.push(`Where clause: ${parts[0]} : ${parts[1]}`);
          }
        }
      }
    }
  }

  /**
   * 만족도 계산
   */
  private calculateSatisfaction(result: ConstraintSolverResult): void {
    const total = result.constraints.length;
    if (total === 0) {
      result.satisfactionRate = 1.0;
      return;
    }

    result.satisfactionRate = result.satisfied / total;
    result.reasoning.push(
      `Satisfaction rate: ${(result.satisfactionRate * 100).toFixed(1)}% ` +
      `(${result.satisfied}/${total})`
    );
  }

  /**
   * 특정 제약 조회
   */
  getConstraint(result: ConstraintSolverResult, id: string): TypeConstraint | null {
    return result.constraints.find(c => c.id === id) || null;
  }

  /**
   * 위반된 제약 조회
   */
  getViolatedConstraints(result: ConstraintSolverResult): TypeConstraint[] {
    return result.constraints.filter(c => c.violated);
  }

  /**
   * 특정 타입 파라미터에 대한 제약 조회
   */
  getConstraintsFor(result: ConstraintSolverResult, typeParam: string): TypeConstraint[] {
    return result.constraints.filter(c => c.left === typeParam || c.right === typeParam);
  }

  /**
   * Trait bound 타입 조회
   */
  getTraitBounds(result: ConstraintSolverResult, typeParam: string): string[] {
    return result.constraints
      .filter(c => c.type === 'trait_bound' && c.left === typeParam)
      .map(c => c.right);
  }
}
