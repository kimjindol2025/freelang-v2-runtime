/**
 * FreeLang AST: Async/Await Support
 *
 * Async function declarations and await expressions
 */

/**
 * Async function parameter
 */
export interface AsyncFunctionParameter {
  name: string;
  type: string;  // Type annotation
  optional?: boolean;
  default?: any;
}

/**
 * Async function declaration
 * @example
 * async fn fetchData(url: string): Promise<string> {
 *   let response = await fetch(url)
 *   return response.text()
 * }
 */
export interface AsyncFunctionDeclaration {
  type: 'async-function-decl';
  name: string;
  params: AsyncFunctionParameter[];
  returnType: AsyncReturnType;
  body: BlockStatement;
  typeParams?: string[];
  isExport?: boolean;
}

/**
 * Async function return type (automatically Promise<T>)
 */
export interface AsyncReturnType {
  isPromise: true;
  elementType: string;  // The T in Promise<T>
  rawType?: string;     // Original return type annotation
}

/**
 * Await expression
 * @example
 * let user = await fetchUser(123)
 * let result = await promise
 */
export interface AwaitExpression {
  type: 'await-expression';
  argument: Expression;
  inAsync: boolean;  // Validation flag
}

/**
 * Promise type annotation
 * @example
 * Promise<string>
 * Promise<number>
 */
export interface PromiseTypeAnnotation {
  type: 'promise-type';
  elementType: string;
  isOptional?: boolean;
}

/**
 * Block statement (shared with sync functions)
 */
export interface BlockStatement {
  type: 'block-statement';
  statements: Statement[];
}

/**
 * Base Statement type
 */
export interface Statement {
  type: string;
  [key: string]: any;
}

/**
 * Base Expression type
 */
export interface Expression {
  type: string;
  [key: string]: any;
}

/**
 * Async function context tracker
 * Used during type checking to ensure await is used correctly
 */
export interface AsyncContext {
  isAsyncFunction: boolean;
  functionName: string;
  returnType: AsyncReturnType | null;
}

/**
 * Promise-related type info
 */
export interface PromiseTypeInfo {
  isPromise: true;
  elementType: string;
  isGeneric: boolean;
}

/**
 * Helper function to create async function declaration
 */
export function createAsyncFunction(
  name: string,
  params: AsyncFunctionParameter[],
  elementType: string,
  body: BlockStatement,
  typeParams?: string[]
): AsyncFunctionDeclaration {
  return {
    type: 'async-function-decl',
    name,
    params,
    returnType: {
      isPromise: true,
      elementType
    },
    body,
    typeParams,
    isExport: false
  };
}

/**
 * Helper function to create await expression
 */
export function createAwaitExpression(argument: Expression): AwaitExpression {
  return {
    type: 'await-expression',
    argument,
    inAsync: false  // Will be validated during type checking
  };
}

/**
 * Helper function to create Promise type
 */
export function createPromiseType(elementType: string): PromiseTypeAnnotation {
  return {
    type: 'promise-type',
    elementType,
    isOptional: false
  };
}

/**
 * Check if a type annotation is a Promise type
 */
export function isPromiseType(typeStr: string): boolean {
  return typeStr.startsWith('Promise<') && typeStr.endsWith('>');
}

/**
 * Extract element type from Promise<T>
 */
export function extractPromiseElementType(typeStr: string): string {
  if (!isPromiseType(typeStr)) {
    throw new Error(`Invalid Promise type: ${typeStr}`);
  }
  return typeStr.slice(8, -1);  // Remove 'Promise<' and '>'
}

/**
 * Wrap a type in Promise
 */
export function wrapInPromise(elementType: string): string {
  return `Promise<${elementType}>`;
}
