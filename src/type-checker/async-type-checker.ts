/**
 * FreeLang Type Checker Extension: Async/Await Support
 *
 * Type checking for async functions and await expressions
 */

import {
  AsyncFunctionDeclaration,
  AwaitExpression,
  AsyncContext,
  PromiseTypeInfo,
  isPromiseType,
  extractPromiseElementType,
  wrapInPromise
} from '../ast/async-await';

/**
 * Async/Await type checker
 */
export class AsyncTypeChecker {
  private asyncContextStack: AsyncContext[] = [];
  private symbolTable: Map<string, TypeInfo> = new Map();

  /**
   * Enter async context (when checking inside async function)
   */
  enterAsyncContext(functionName: string, returnType: string): void {
    this.asyncContextStack.push({
      isAsyncFunction: true,
      functionName,
      returnType: {
        isPromise: true,
        elementType: extractPromiseElementType(returnType)
      }
    });
  }

  /**
   * Exit async context
   */
  exitAsyncContext(): void {
    if (this.asyncContextStack.length > 0) {
      this.asyncContextStack.pop();
    }
  }

  /**
   * Check if currently in async context
   */
  isInAsyncContext(): boolean {
    return this.asyncContextStack.length > 0;
  }

  /**
   * Get current async context
   */
  getCurrentAsyncContext(): AsyncContext | null {
    if (this.asyncContextStack.length === 0) return null;
    return this.asyncContextStack[this.asyncContextStack.length - 1];
  }

  /**
   * Type check async function declaration
   */
  checkAsyncFunctionDeclaration(node: AsyncFunctionDeclaration): TypeInfo {
    // Register function signature
    const functionType: FunctionTypeInfo = {
      kind: 'function',
      paramTypes: node.params.map(p => ({
        name: p.name,
        type: p.type,
        optional: p.optional || false
      })),
      returnType: wrapInPromise(node.returnType.elementType),
      isAsync: true
    };

    this.symbolTable.set(node.name, functionType);

    // Enter async context for body checking
    this.enterAsyncContext(node.name, functionType.returnType);

    // Type check function parameters
    node.params.forEach(param => {
      this.validateType(param.type);
      this.symbolTable.set(param.name, {
        kind: 'variable',
        type: param.type,
        mutable: false
      } as VariableTypeInfo);
    });

    // Type check function body (simplified)
    this.checkBlockStatementTypes(node.body);

    // Exit async context
    this.exitAsyncContext();

    return functionType;
  }

  /**
   * Type check await expression
   */
  checkAwaitExpression(node: AwaitExpression): string {
    // Check if in async context
    if (!this.isInAsyncContext()) {
      throw new TypeCheckError(
        'await can only be used in async functions'
      );
    }

    // Get type of awaited expression
    const argumentType = this.checkExpressionType(node.argument);

    // Validate that expression is awaitable (Promise)
    if (!isPromiseType(argumentType)) {
      throw new TypeCheckError(
        `Cannot await non-Promise value of type '${argumentType}'. ` +
        `Expected Promise<T>.`
      );
    }

    // Extract and return the element type
    const elementType = extractPromiseElementType(argumentType);
    return elementType;
  }

  /**
   * Check expression type (simplified)
   */
  private checkExpressionType(expr: any): string {
    if (expr.type === 'identifier') {
      const symbolInfo = this.symbolTable.get(expr.name);
      if (!symbolInfo) {
        throw new TypeCheckError(`Unknown symbol: ${expr.name}`);
      }
      if (symbolInfo.kind === 'variable') {
        return (symbolInfo as VariableTypeInfo).type;
      }
      if (symbolInfo.kind === 'function') {
        return (symbolInfo as FunctionTypeInfo).returnType;
      }
    }

    if (expr.type === 'call-expression') {
      // Get function return type
      const funcType = this.symbolTable.get(expr.name);
      if (!funcType || funcType.kind !== 'function') {
        throw new TypeCheckError(`'${expr.name}' is not a function`);
      }
      return (funcType as FunctionTypeInfo).returnType;
    }

    if (expr.type === 'literal') {
      return this.inferLiteralType(expr.value);
    }

    return 'unknown';
  }

  /**
   * Infer literal type
   */
  private inferLiteralType(value: any): string {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
  }

  /**
   * Check block statement types
   */
  private checkBlockStatementTypes(block: any): void {
    if (block.statements) {
      block.statements.forEach((stmt: any) => {
        this.checkStatementType(stmt);
      });
    }
  }

  /**
   * Check statement type
   */
  private checkStatementType(stmt: any): void {
    if (stmt.type === 'variable-declaration') {
      const varType = stmt.typeAnnotation || this.inferExpressionType(stmt.value);
      this.symbolTable.set(stmt.name, {
        kind: 'variable',
        type: varType,
        mutable: true
      } as VariableTypeInfo);
    }

    if (stmt.type === 'return-statement') {
      if (stmt.value) {
        const returnType = this.checkExpressionType(stmt.value);
        const context = this.getCurrentAsyncContext();
        if (context) {
          this.validateTypeAssignment(
            returnType,
            context.returnType!.elementType
          );
        }
      }
    }

    if (stmt.type === 'if-statement') {
      this.checkBlockStatementTypes(stmt.consequent);
      if (stmt.alternate) {
        this.checkBlockStatementTypes(stmt.alternate);
      }
    }
  }

  /**
   * Validate type assignment
   */
  private validateTypeAssignment(fromType: string, toType: string): void {
    if (fromType === toType) return;
    if (fromType === 'any') return;
    if (toType === 'any') return;

    throw new TypeCheckError(
      `Type '${fromType}' is not assignable to type '${toType}'`
    );
  }

  /**
   * Infer expression type
   */
  private inferExpressionType(expr: any): string {
    return this.checkExpressionType(expr);
  }

  /**
   * Validate type exists
   */
  private validateType(typeStr: string): void {
    // Basic types
    const basicTypes = ['string', 'number', 'boolean', 'any', 'void'];
    if (basicTypes.includes(typeStr)) return;

    // Promise types
    if (isPromiseType(typeStr)) return;

    // Custom types (would check against defined types)
    // For now, assume custom types are valid
  }

  /**
   * Check if type is Promise
   */
  isPromiseType(typeStr: string): boolean {
    return isPromiseType(typeStr);
  }

  /**
   * Extract Promise element type
   */
  getPromiseElementType(promiseType: string): string {
    return extractPromiseElementType(promiseType);
  }

  /**
   * Validate async function return type
   */
  validateAsyncReturnType(declaredType: string, actualType: string): void {
    const elementType = this.getPromiseElementType(declaredType);
    this.validateTypeAssignment(actualType, elementType);
  }
}

/**
 * Type information stored in symbol table
 */
export interface TypeInfo {
  kind: 'variable' | 'function' | 'type';
}

/**
 * Variable type information
 */
export interface VariableTypeInfo extends TypeInfo {
  kind: 'variable';
  type: string;
  mutable: boolean;
}

/**
 * Function type information
 */
export interface FunctionTypeInfo extends TypeInfo {
  kind: 'function';
  paramTypes: ParameterTypeInfo[];
  returnType: string;
  isAsync: boolean;
}

/**
 * Parameter type information
 */
export interface ParameterTypeInfo {
  name: string;
  type: string;
  optional: boolean;
}

/**
 * Type check error
 */
export class TypeCheckError extends Error {
  constructor(message: string) {
    super(`Type Error: ${message}`);
  }
}

/**
 * Helper function to validate Promise type
 */
export function validatePromiseType(typeStr: string): boolean {
  try {
    if (!isPromiseType(typeStr)) {
      return false;
    }
    extractPromiseElementType(typeStr);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper function to create Promise type
 */
export function createPromiseType(elementType: string): string {
  return wrapInPromise(elementType);
}

/**
 * Helper function to resolve Promise await
 */
export function resolveAwaitType(promiseType: string): string {
  if (!isPromiseType(promiseType)) {
    throw new TypeCheckError(`Cannot await non-Promise type: ${promiseType}`);
  }
  return extractPromiseElementType(promiseType);
}
