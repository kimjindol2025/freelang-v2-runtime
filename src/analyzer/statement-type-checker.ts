/**
 * Phase 2: Statement Type Checker
 * Validates type safety of statements including for...of loops
 * Manages scopes and variable bindings
 */

import { ForOfStatement } from '../parser/ast';
import { FunctionTypeChecker, TypeCheckResult } from './type-checker';

/**
 * Scope: Tracks variable types within a scope
 */
interface Scope {
  variables: Map<string, string>;  // variable name -> type
  parentScope?: Scope;
}

/**
 * StatementTypeChecker: Type check statements including for...of
 */
export class StatementTypeChecker {
  private functionTypeChecker: FunctionTypeChecker;
  private scopeStack: Scope[] = [];

  constructor() {
    this.functionTypeChecker = new FunctionTypeChecker();
    // Initialize with global scope
    this.pushScope();
  }

  /**
   * Type check a for...of statement
   * Validates array type, element type, and variable binding
   */
  checkForOfStatement(stmt: ForOfStatement): TypeCheckResult {
    // 1. Get iterable type from expression
    const iterableType = this.inferExpressionType(stmt.iterable);

    // 2. Validate using FunctionTypeChecker
    const validationResult = this.functionTypeChecker.checkForOfStatement(
      stmt.variable,
      iterableType
    );

    if (!validationResult.compatible) {
      return validationResult;
    }

    // 3. Extract element type
    const elementType = this.functionTypeChecker.extractElementType(iterableType);

    // 4. Enter new scope for loop body
    this.pushScope();

    // 5. Bind loop variable in new scope
    this.currentScope().variables.set(
      stmt.variable,
      stmt.variableType || elementType
    );

    // 6. Type check loop body statements
    const bodyResult = this.checkStatements(stmt.body.body);

    // 7. Exit loop scope
    this.popScope();

    if (!bodyResult.compatible) {
      return bodyResult;
    }

    // 8. Success: for...of is type-safe
    return {
      compatible: true,
      message: `for...of loop is type-safe, variable '${stmt.variable}' is ${elementType}`,
      details: {
        paramName: stmt.variable,
        expected: elementType,
        received: elementType
      }
    };
  }

  /**
   * Infer type of an expression
   * Simplified version - returns basic types
   * In full implementation, would handle all expression types
   */
  private inferExpressionType(expr: any): string {
    if (!expr) {
      return 'unknown';
    }

    // If it's an identifier, look up in scope
    if (expr.type === 'identifier') {
      const type = this.lookupVariable(expr.name);
      return type || 'unknown';
    }

    // Literal types
    if (expr.type === 'literal') {
      if (expr.dataType === 'number') return 'number';
      if (expr.dataType === 'string') return 'string';
      if (expr.dataType === 'bool') return 'bool';
      return 'unknown';
    }

    // Array literal
    if (expr.type === 'array') {
      if (expr.elements.length === 0) {
        return 'array<unknown>';
      }
      const elementType = this.inferExpressionType(expr.elements[0]);
      return `array<${elementType}>`;
    }

    // Member access: obj.prop
    if (expr.type === 'member') {
      // Simplified: assume property access returns unknown
      // Full implementation would resolve object type and property type
      return 'unknown';
    }

    // Function call
    if (expr.type === 'call') {
      // Simplified: assume function returns unknown
      // Full implementation would look up function return type
      return 'unknown';
    }

    return 'unknown';
  }

  /**
   * Type check multiple statements
   */
  private checkStatements(stmts: any[]): TypeCheckResult {
    if (!stmts) {
      return { compatible: true, message: 'Empty statement list' };
    }

    for (const stmt of stmts) {
      if (!stmt) continue;

      // For now, only check for...of statements
      // In full implementation, would check all statement types
      if (stmt.type === 'forOf') {
        const result = this.checkForOfStatement(stmt);
        if (!result.compatible) {
          return result;
        }
      }
    }

    return { compatible: true, message: 'All statements type-checked' };
  }

  /**
   * Lookup variable type in scope chain
   */
  private lookupVariable(name: string): string | undefined {
    let scope: Scope | undefined = this.currentScope();

    while (scope) {
      if (scope.variables.has(name)) {
        return scope.variables.get(name);
      }
      scope = scope.parentScope;
    }

    return undefined;
  }

  /**
   * Declare variable in current scope
   */
  declareVariable(name: string, type: string): void {
    this.currentScope().variables.set(name, type);
  }

  /**
   * Push new scope onto stack
   */
  private pushScope(): void {
    const newScope: Scope = {
      variables: new Map(),
      parentScope: this.scopeStack.length > 0
        ? this.scopeStack[this.scopeStack.length - 1]
        : undefined
    };
    this.scopeStack.push(newScope);
  }

  /**
   * Pop scope from stack
   */
  private popScope(): void {
    if (this.scopeStack.length > 1) {
      this.scopeStack.pop();
    }
  }

  /**
   * Get current scope
   */
  private currentScope(): Scope {
    return this.scopeStack[this.scopeStack.length - 1];
  }

  /**
   * Get current scope depth (for testing)
   */
  getScopeDepth(): number {
    return this.scopeStack.length;
  }

  /**
   * Get current scope variables (for testing)
   */
  getCurrentScopeVariables(): Record<string, string> {
    const scope = this.currentScope();
    const result: Record<string, string> = {};
    scope.variables.forEach((type, name) => {
      result[name] = type;
    });
    return result;
  }
}
