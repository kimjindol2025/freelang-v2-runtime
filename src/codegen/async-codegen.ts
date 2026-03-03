/**
 * FreeLang Code Generator Extension: Async/Await Support
 *
 * Generates TypeScript/JavaScript code for async/await
 */

import {
  AsyncFunctionDeclaration,
  AsyncFunctionParameter,
  AwaitExpression,
  extractPromiseElementType
} from '../ast/async-await';

/**
 * Async/Await code generator
 */
export class AsyncCodeGenerator {
  private indentation: number = 0;
  private indentStr: string = '  ';

  /**
   * Generate async function declaration
   * @example
   * async fn fetchData(url: string): Promise<string> { ... }
   * becomes:
   * async function fetchData(url: string): Promise<string> { ... }
   */
  generateAsyncFunction(node: AsyncFunctionDeclaration): string {
    const params = this.generateParameters(node.params);
    const returnType = this.generateReturnType(node);
    const body = this.generateFunctionBody(node.body);

    return `async function ${node.name}(${params}): ${returnType} ${body}`;
  }

  /**
   * Generate function parameters
   */
  private generateParameters(params: AsyncFunctionParameter[]): string {
    return params
      .map(param => {
        let paramStr = `${param.name}: ${param.type}`;
        if (param.default !== undefined) {
          paramStr += ` = ${JSON.stringify(param.default)}`;
        }
        return paramStr;
      })
      .join(', ');
  }

  /**
   * Generate return type annotation
   */
  private generateReturnType(node: AsyncFunctionDeclaration): string {
    const elementType = node.returnType.elementType;
    return `Promise<${elementType}>`;
  }

  /**
   * Generate function body
   */
  private generateFunctionBody(body: any): string {
    if (!body || !body.statements) {
      return '{}';
    }

    this.indentation++;
    const indent = this.getIndent();

    const statements = body.statements
      .map((stmt: any) => this.generateStatement(stmt))
      .filter((s: string) => s.length > 0)
      .join(`\n${indent}`);

    this.indentation--;

    return `{\n${indent}${statements}\n${this.getIndent()}}`;
  }

  /**
   * Generate statement
   */
  private generateStatement(stmt: any): string {
    if (!stmt || !stmt.type) return '';

    switch (stmt.type) {
      case 'variable-declaration':
        return this.generateVariableDeclaration(stmt);
      case 'return-statement':
        return this.generateReturnStatement(stmt);
      case 'if-statement':
        return this.generateIfStatement(stmt);
      case 'while-statement':
        return this.generateWhileStatement(stmt);
      case 'expression-statement':
        return this.generateExpressionStatement(stmt);
      default:
        return '';
    }
  }

  /**
   * Generate variable declaration
   */
  private generateVariableDeclaration(node: any): string {
    const value = node.value ? this.generateExpression(node.value) : '';
    const type = node.typeAnnotation ? `: ${node.typeAnnotation}` : '';
    return `let ${node.name}${type} = ${value};`;
  }

  /**
   * Generate return statement
   */
  private generateReturnStatement(node: any): string {
    if (!node.value) {
      return 'return;';
    }
    const expr = this.generateExpression(node.value);
    return `return ${expr};`;
  }

  /**
   * Generate if statement
   */
  private generateIfStatement(node: any): string {
    const condition = this.generateExpression(node.test);
    const consequent = this.generateFunctionBody(node.consequent);
    let result = `if (${condition}) ${consequent}`;

    if (node.alternate) {
      const alternate = this.generateFunctionBody(node.alternate);
      result += ` else ${alternate}`;
    }

    return result;
  }

  /**
   * Generate while statement
   */
  private generateWhileStatement(node: any): string {
    const condition = this.generateExpression(node.test);
    const body = this.generateFunctionBody(node.body);
    return `while (${condition}) ${body}`;
  }

  /**
   * Generate expression statement
   */
  private generateExpressionStatement(node: any): string {
    return `${this.generateExpression(node.expression)};`;
  }

  /**
   * Generate expression
   */
  generateExpression(expr: any): string {
    if (!expr) return '';

    switch (expr.type) {
      case 'identifier':
        return expr.name;
      case 'literal':
        return this.generateLiteral(expr.value);
      case 'string':
        return `"${expr.value}"`;
      case 'call-expression':
        return this.generateCallExpression(expr);
      case 'binary-expression':
        return this.generateBinaryExpression(expr);
      case 'await-expression':
        return this.generateAwaitExpression(expr);
      case 'member-expression':
        return this.generateMemberExpression(expr);
      case 'array-literal':
        return this.generateArrayLiteral(expr);
      case 'object-literal':
        return this.generateObjectLiteral(expr);
      default:
        return '';
    }
  }

  /**
   * Generate literal value
   */
  private generateLiteral(value: any): string {
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (value === null) {
      return 'null';
    }
    if (value === undefined) {
      return 'undefined';
    }
    return String(value);
  }

  /**
   * Generate call expression
   */
  private generateCallExpression(expr: any): string {
    const func = expr.name || this.generateExpression(expr.callee);
    const args = expr.arguments
      ? expr.arguments.map((arg: any) => this.generateExpression(arg)).join(', ')
      : '';
    return `${func}(${args})`;
  }

  /**
   * Generate binary expression
   */
  private generateBinaryExpression(expr: any): string {
    const left = this.generateExpression(expr.left);
    const right = this.generateExpression(expr.right);
    return `${left} ${expr.operator} ${right}`;
  }

  /**
   * Generate await expression
   * @example
   * await fetch(url) becomes: await fetch(url)
   */
  generateAwaitExpression(expr: AwaitExpression): string {
    const argument = this.generateExpression(expr.argument);
    return `await ${argument}`;
  }

  /**
   * Generate member expression (e.g., obj.property)
   */
  private generateMemberExpression(expr: any): string {
    const object = this.generateExpression(expr.object);
    const property = expr.computed
      ? `[${this.generateExpression(expr.property)}]`
      : `.${expr.property}`;
    return `${object}${property}`;
  }

  /**
   * Generate array literal
   */
  private generateArrayLiteral(expr: any): string {
    const elements = expr.elements
      .map((el: any) => this.generateExpression(el))
      .join(', ');
    return `[${elements}]`;
  }

  /**
   * Generate object literal
   */
  private generateObjectLiteral(expr: any): string {
    const properties = Object.entries(expr.properties || {})
      .map(([key, value]: [string, any]) => {
        const valueStr = this.generateExpression(value);
        return `${key}: ${valueStr}`;
      })
      .join(', ');
    return `{ ${properties} }`;
  }

  /**
   * Get current indentation string
   */
  private getIndent(): string {
    return this.indentStr.repeat(this.indentation);
  }

  /**
   * Increase indentation
   */
  increaseIndent(): void {
    this.indentation++;
  }

  /**
   * Decrease indentation
   */
  decreaseIndent(): void {
    if (this.indentation > 0) {
      this.indentation--;
    }
  }

  /**
   * Reset indentation
   */
  resetIndent(): void {
    this.indentation = 0;
  }

  /**
   * Set indentation level
   */
  setIndentation(level: number): void {
    this.indentation = level;
  }
}

/**
 * Helper function to wrap expression in async
 */
export function wrapInAsync(code: string): string {
  return `(async () => {\n  ${code}\n})()`;
}

/**
 * Helper function to generate promise chain
 */
export function generatePromiseChain(...promises: string[]): string {
  if (promises.length === 0) return '';
  if (promises.length === 1) return promises[0];

  let chain = promises[0];
  for (let i = 1; i < promises.length; i++) {
    chain += `.then(() => ${promises[i]})`;
  }
  return chain;
}

/**
 * Helper function to generate Promise.all
 */
export function generatePromiseAll(promises: string[]): string {
  const promiseStr = `[${promises.join(', ')}]`;
  return `Promise.all(${promiseStr})`;
}

/**
 * Helper function to generate Promise.race
 */
export function generatePromiseRace(promises: string[]): string {
  const promiseStr = `[${promises.join(', ')}]`;
  return `Promise.race(${promiseStr})`;
}

/**
 * Helper function for try-catch in async
 */
export function generateAsyncTryCatch(
  tryBlock: string,
  catchBlock: string,
  finallyBlock?: string
): string {
  let code = `try {\n  ${tryBlock}\n} catch (error) {\n  ${catchBlock}\n}`;
  if (finallyBlock) {
    code += ` finally {\n  ${finallyBlock}\n}`;
  }
  return code;
}
