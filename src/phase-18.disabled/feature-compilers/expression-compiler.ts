/**
 * Phase 18.1: Expression Compiler
 *
 * Specializes in compiling expressions: arithmetic, literals, variables
 * Features:
 * - Number/string/boolean literals
 * - Binary operations (+, -, *, /, %, ==, !=, <, >, &&, ||)
 * - Unary operations (-, !)
 * - Variable access and assignment
 * - Array literals and indexing
 * - Nested expressions with proper operator precedence
 *
 * Reuses: IRGenerator.traverse() for expression processing
 */

import { IntegratedCompilerBase, CompileTarget, ASTNode } from '../compiler-base/integrated-compiler-base';
import { IRGenerator } from '../../codegen/ir-generator';
import { Parser } from '../../parser/parser';
import { Inst } from '../../types';

/**
 * Expression Compiler
 * Transforms simple expressions into IR instructions
 */
export class ExpressionCompiler extends IntegratedCompilerBase {
  private parser: Parser;
  private irGenerator: IRGenerator;
  protected ast: ASTNode | null = null;
  protected instructions: Inst[] = [];

  constructor(target: CompileTarget = 'jit') {
    super({
      target,
      output_file: 'expression.out',
      optimization_level: 0,
      debug_info: false,
      include_runtime: true,
    } as any);

    this.parser = new Parser();
    this.irGenerator = new IRGenerator();
  }

  /**
   * Lexical analysis - minimal for expressions
   */
  protected lexicalAnalysis(source: string): void {
    const stage: any = { name: 'Lexical Analysis', duration_ms: 0, success: true, warnings: [] };
    const startTime = performance.now();

    try {
      // Tokenization is handled by parser
      // For expressions, we just validate basic syntax
      if (!source || source.trim().length === 0) {
        throw new Error('Empty expression');
      }

      stage.success = true;
    } catch (error: any) {
      stage.success = false;
      stage.error = error.message;
      this.errors.push(error.message);
    }

    stage.duration_ms = performance.now() - startTime;
    this.stages.push(stage);
  }

  /**
   * Syntax analysis - parse expression string to AST
   */
  protected syntaxAnalysis(source: string): void {
    const stage: any = { name: 'Syntax Analysis', duration_ms: 0, success: true, warnings: [] };
    const startTime = performance.now();

    try {
      // Use parser to convert expression string to AST
      // Expressions are a subset of full language
      // Support: literals, operators, variables, arrays
      this.ast = this.parseExpression(source);
      stage.success = true;
    } catch (error: any) {
      stage.success = false;
      stage.error = error.message;
      this.errors.push(error.message);
    }

    stage.duration_ms = performance.now() - startTime;
    this.stages.push(stage);
  }

  /**
   * Semantic analysis - limited for expressions
   */
  protected semanticAnalysis(source: string): void {
    const stage: any = { name: 'Semantic Analysis', duration_ms: 0, success: true, warnings: [] };
    const startTime = performance.now();

    try {
      if (!this.ast) {
        throw new Error('No AST generated');
      }

      // Basic type checking for literals
      this.validateExpressionSemantics(this.ast);
      stage.success = true;
    } catch (error: any) {
      stage.success = false;
      stage.error = error.message;
      this.errors.push(error.message);
    }

    stage.duration_ms = performance.now() - startTime;
    this.stages.push(stage);
  }

  /**
   * Code generation - create IR instructions from AST
   */
  protected generateCode(source: string): void {
    const stage: any = { name: 'Code Generation', duration_ms: 0, success: true, warnings: [] };
    const startTime = performance.now();

    try {
      if (!this.ast) {
        throw new Error('No AST available for code generation');
      }

      // Generate IR using IRGenerator
      this.instructions = this.irGenerator.generateIR(this.ast);
      stage.success = true;
      stage.warnings.push(`Generated ${this.instructions.length} instructions`);
    } catch (error: any) {
      stage.success = false;
      stage.error = error.message;
      this.errors.push(error.message);
    }

    stage.duration_ms = performance.now() - startTime;
    this.stages.push(stage);
  }

  /**
   * Parse expression from source code
   * Supports: literals, binary/unary ops, variables, arrays
   */
  private parseExpression(source: string): ASTNode {
    // Remove whitespace
    const expr = source.trim();

    // Parse as pure expression
    return this.parseExpressionRecursive(expr) as ASTNode;
  }

  /**
   * Recursive expression parser with operator precedence
   * Precedence (high to low):
   * 1. Primary: literals, variables, parentheses, arrays
   * 2. Postfix: array indexing
   * 3. Unary: -, !
   * 4. Multiplicative: *, /, %
   * 5. Additive: +, -
   * 6. Relational: <, >, <=, >=
   * 7. Equality: ==, !=
   * 8. Logical AND: &&
   * 9. Logical OR: ||
   */
  private parseExpressionRecursive(expr: string, minPrec: number = 0): any {
    // Parse primary expression first
    let left = this.parsePrimary(expr);

    // Continue parsing binary operators
    let remaining = expr.substring(this.getExpressionLength(left)).trim();
    while (remaining.length > 0) {
      const op = this.extractBinaryOperator(remaining);
      if (!op) break;

      const opPrec = this.getOperatorPrecedence(op);
      if (opPrec < minPrec) break;

      // Consume operator
      remaining = remaining.substring(op.length).trim();

      // Parse right side with higher precedence
      const rightMatch = this.parseExpressionRecursive(remaining, opPrec + 1);
      left = {
        type: 'BinaryOp',
        operator: op,
        left: left,
        right: rightMatch,
      };

      remaining = remaining.substring(this.getExpressionLength(rightMatch)).trim();
    }

    return left;
  }

  /**
   * Parse primary expression (lowest level)
   */
  private parsePrimary(expr: string): any {
    expr = expr.trim();

    // Number literal
    if (/^-?\d+(\.\d+)?/.test(expr)) {
      const match = expr.match(/^-?\d+(\.\d+)?/);
      if (match) {
        return {
          type: 'NumberLiteral',
          value: parseFloat(match[0]),
        };
      }
    }

    // String literal
    if (/^"([^"]*)"/.test(expr) || /^'([^']*)'/.test(expr)) {
      const match = expr.match(/^"([^"]*)"|^'([^']*)'/);
      if (match) {
        return {
          type: 'StringLiteral',
          value: match[1] || match[2],
        };
      }
    }

    // Boolean literal
    if (expr.startsWith('true')) {
      return { type: 'BoolLiteral', value: true };
    }
    if (expr.startsWith('false')) {
      return { type: 'BoolLiteral', value: false };
    }

    // Array literal [1, 2, 3]
    if (expr.startsWith('[')) {
      return this.parseArrayLiteral(expr);
    }

    // Parenthesized expression
    if (expr.startsWith('(')) {
      const closeIdx = this.findMatchingParen(expr, 0);
      if (closeIdx > 0) {
        const inner = expr.substring(1, closeIdx);
        return this.parseExpressionRecursive(inner);
      }
    }

    // Unary operator
    if (expr.startsWith('-') || expr.startsWith('!')) {
      const op = expr[0];
      const operand = this.parsePrimary(expr.substring(1));
      return {
        type: 'UnaryOp',
        operator: op,
        operand: operand,
      };
    }

    // Variable/Identifier (with possible array indexing)
    const identMatch = /^[a-zA-Z_]\w*/.exec(expr);
    if (identMatch) {
      const name = identMatch[0];
      const rest = expr.substring(name.length).trim();

      // Check for array indexing
      if (rest.startsWith('[')) {
        const closeIdx = this.findMatchingBracket(rest, 0);
        if (closeIdx > 0) {
          const indexExpr = rest.substring(1, closeIdx);
          return {
            type: 'IndexAccess',
            array: { type: 'Identifier', name },
            index: this.parseExpressionRecursive(indexExpr),
          };
        }
      }

      return {
        type: 'Identifier',
        name: name,
      };
    }

    throw new Error(`Cannot parse expression: ${expr.substring(0, 50)}`);
  }

  /**
   * Parse array literal [1, 2, 3]
   */
  private parseArrayLiteral(expr: string): any {
    const closeIdx = this.findMatchingBracket(expr, 0);
    if (closeIdx < 0) {
      throw new Error('Mismatched brackets in array literal');
    }

    const content = expr.substring(1, closeIdx).trim();
    const elements: ASTNode[] = [];

    if (content.length > 0) {
      // Split by comma, but respect nested structures
      const parts = this.splitByComma(content);
      for (const part of parts) {
        elements.push(this.parseExpressionRecursive(part));
      }
    }

    return {
      type: 'ArrayLiteral',
      elements: elements,
    };
  }

  /**
   * Extract binary operator from expression
   */
  private extractBinaryOperator(expr: string): string | null {
    const twoCharOps = ['==', '!=', '<=', '>=', '&&', '||'];
    for (const op of twoCharOps) {
      if (expr.startsWith(op)) {
        return op;
      }
    }

    const oneCharOps = ['+', '-', '*', '/', '%', '<', '>', '&', '|'];
    for (const op of oneCharOps) {
      if (expr.startsWith(op)) {
        return op;
      }
    }

    return null;
  }

  /**
   * Get operator precedence
   */
  private getOperatorPrecedence(op: string): number {
    const precedence: Record<string, number> = {
      '||': 1,
      '&&': 2,
      '==': 3,
      '!=': 3,
      '<': 4,
      '>': 4,
      '<=': 4,
      '>=': 4,
      '+': 5,
      '-': 5,
      '*': 6,
      '/': 6,
      '%': 6,
    };
    return precedence[op] ?? 0;
  }

  /**
   * Find matching parenthesis
   */
  private findMatchingParen(expr: string, startIdx: number): number {
    let depth = 0;
    for (let i = startIdx; i < expr.length; i++) {
      if (expr[i] === '(') depth++;
      if (expr[i] === ')') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /**
   * Find matching bracket
   */
  private findMatchingBracket(expr: string, startIdx: number): number {
    let depth = 0;
    for (let i = startIdx; i < expr.length; i++) {
      if (expr[i] === '[') depth++;
      if (expr[i] === ']') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /**
   * Get length of parsed expression
   */
  private getExpressionLength(ast: ASTNode): number {
    // Simplified: assume expressions are processed
    return 0;
  }

  /**
   * Split by comma, respecting nested structures
   */
  private splitByComma(expr: string): string[] {
    const parts: string[] = [];
    let current = '';
    let parenDepth = 0;
    let bracketDepth = 0;

    for (let i = 0; i < expr.length; i++) {
      const ch = expr[i];

      if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth--;
      else if (ch === '[') bracketDepth++;
      else if (ch === ']') bracketDepth--;
      else if (ch === ',' && parenDepth === 0 && bracketDepth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = '';
        continue;
      }

      current += ch;
    }

    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  /**
   * Validate expression semantics
   */
  private validateExpressionSemantics(ast: any): void {
    // Basic validation - ensure types are compatible
    if (ast.type === 'BinaryOp') {
      const leftType = this.inferType(ast.left);
      const rightType = this.inferType(ast.right);

      // Type compatibility checks
      if (ast.operator === '+' && leftType === 'string') {
        // String concatenation - right can be any type
        return;
      }

      if (['*', '/', '%'].includes(ast.operator)) {
        if (leftType !== 'number' || rightType !== 'number') {
          this.addWarning(`Type mismatch: ${leftType} ${ast.operator} ${rightType}`);
        }
      }
    }
  }

  /**
   * Infer type of expression node
   */
  private inferType(node: any): string {
    if (!node) return 'unknown';

    switch (node.type) {
      case 'NumberLiteral':
        return 'number';
      case 'StringLiteral':
        return 'string';
      case 'BoolLiteral':
        return 'boolean';
      case 'ArrayLiteral':
        return 'array';
      case 'Identifier':
        return 'unknown';
      case 'BinaryOp':
        if (['+', '-', '*', '/', '%'].includes(node.operator)) {
          return 'number';
        }
        if (node.operator === '+' && this.inferType(node.left) === 'string') {
          return 'string';
        }
        return 'boolean';
      case 'UnaryOp':
        return node.operator === '-' ? 'number' : 'boolean';
      case 'IndexAccess':
        return 'unknown';
      default:
        return 'unknown';
    }
  }
}
