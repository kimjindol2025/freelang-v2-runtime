/**
 * Phase 2 Task 2.1: Partial Parser
 *
 * Parses incomplete/malformed code by:
 * - Skipping syntax errors
 * - Recovering from missing tokens
 * - Generating Partial AST with error markers
 *
 * Example:
 * ```
 * fn process(data
 *   result = data.map(
 *   result
 * ```
 * → Partial AST with recovery points
 */

export interface PartialToken {
  type: string;
  value: string;
  line: number;
  column: number;
  isError?: boolean;
}

export interface PartialASTNode {
  type: string;
  name?: string;
  children?: PartialASTNode[];
  tokens?: PartialToken[];
  isComplete: boolean;
  errorMarkers?: {
    line: number;
    column: number;
    message: string;
  }[];
}

export class PartialParser {
  private tokens: PartialToken[] = [];
  private pos: number = 0;
  private errors: Array<{ line: number; column: number; message: string }> = [];

  /**
   * Parse code with error recovery
   */
  public parse(tokens: PartialToken[]): PartialASTNode {
    this.tokens = tokens;
    this.pos = 0;
    this.errors = [];

    return this.parseProgram();
  }

  /**
   * Parse program (root level)
   */
  private parseProgram(): PartialASTNode {
    const children: PartialASTNode[] = [];
    let hasErrors = false;

    while (!this.isAtEnd()) {
      try {
        const node = this.parseTopLevel();
        if (node) {
          children.push(node);
          if (!node.isComplete) {
            hasErrors = true;
          }
          // Merge error markers from children
          if (node.errorMarkers && node.errorMarkers.length > 0) {
            this.errors.push(...node.errorMarkers);
            hasErrors = true;
          }
        }
      } catch (error) {
        // Error recovery: skip to next statement
        hasErrors = true;
        this.recover();
      }
    }

    return {
      type: 'PROGRAM',
      children,
      isComplete: !hasErrors && this.errors.length === 0,
      errorMarkers: this.errors,
    };
  }

  /**
   * Parse top-level statement (function, constant, etc.)
   */
  private parseTopLevel(): PartialASTNode | null {
    if (this.match('fn')) {
      return this.parseFunctionDef();
    } else if (this.match('const')) {
      return this.parseConstDef();
    } else if (this.match('type')) {
      return this.parseTypeDef();
    }
    // Skip unknown token
    this.advance();
    return null;
  }

  /**
   * Parse function definition with error recovery
   *
   * Partial syntax:
   * fn name(params)    ← params can be incomplete
   *   body            ← body can be incomplete
   */
  private parseFunctionDef(): PartialASTNode {
    const start = this.pos;
    const tokens: PartialToken[] = [];

    // fn keyword
    tokens.push(this.previous());

    // Function name
    let name = 'anonymous';
    if (this.check('IDENT')) {
      name = this.advance().value;
      tokens.push(this.previous());
    } else {
      this.addError('Expected function name');
    }

    // Parameters
    const params = this.parseParameters();
    tokens.push(...params.tokens || []);

    // Body
    let isComplete = true;
    const bodyNode = this.parseBody();
    if (!bodyNode.isComplete) {
      isComplete = false;
    }
    tokens.push(...(bodyNode.tokens || []));

    return {
      type: 'FUNCTION_DEF',
      name,
      children: [params, bodyNode],
      tokens,
      isComplete,
      errorMarkers: this.errors,
    };
  }

  /**
   * Parse function parameters with error recovery
   *
   * Syntax:
   * (x, y)      ← complete
   * (x, y       ← missing closing paren
   * (x,         ← missing parameter name
   */
  private parseParameters(): PartialASTNode {
    const tokens: PartialToken[] = [];
    const params: string[] = [];

    if (this.match('LPAREN')) {
      tokens.push(this.previous());

      // Parse parameters until ) or EOF
      while (!this.check('RPAREN') && !this.isAtEnd()) {
        if (this.check('IDENT')) {
          params.push(this.advance().value);
          tokens.push(this.previous());

          if (this.match('COMMA')) {
            tokens.push(this.previous());
          }
        } else {
          this.addError('Expected parameter name');
          this.advance();
        }
      }

      // Closing paren (may be missing)
      if (this.match('RPAREN')) {
        tokens.push(this.previous());
      } else {
        this.addError('Expected ) to close parameters');
      }
    }

    return {
      type: 'PARAMETERS',
      tokens,
      isComplete: this.check('RPAREN') || this.isAtEnd(),
      children: params.map(p => ({
        type: 'PARAM',
        name: p,
        isComplete: true,
      })),
    };
  }

  /**
   * Parse function body with error recovery
   *
   * Recovers from:
   * - Missing closing braces
   * - Incomplete statements
   * - Unmatched parentheses
   */
  private parseBody(): PartialASTNode {
    const tokens: PartialToken[] = [];
    const statements: PartialASTNode[] = [];
    let isComplete = true;

    // Expected indentation level or opening brace
    let braceCount = 0;
    if (this.match('LBRACE')) {
      tokens.push(this.previous());
      braceCount = 1;
    }

    // Parse statements until closing brace or EOF
    while (!this.isAtEnd() && braceCount >= 0) {
      // Check for closing brace
      if (this.check('RBRACE')) {
        if (braceCount > 0) {
          tokens.push(this.advance());
          braceCount--;
        } else {
          break;
        }
      }

      // Parse statement
      try {
        const stmt = this.parseStatement();
        if (stmt) {
          statements.push(stmt);
          tokens.push(...(stmt.tokens || []));
        }
      } catch (error) {
        // Statement parsing failed - recover
        isComplete = false;
        this.recoverToNextStatement();
      }

      if (this.isAtEnd()) {
        break;
      }
    }

    // If braces are unmatched
    if (braceCount > 0) {
      this.addError(`Expected ${braceCount} closing brace(s)`);
      isComplete = false;
    }

    return {
      type: 'BODY',
      children: statements,
      tokens,
      isComplete,
    };
  }

  /**
   * Parse single statement with error recovery
   *
   * Handles:
   * - Assignment: x = 5
   * - If statement: if condition
   * - For loop: for i in 0..10
   * - Function call: func()
   * - Return: return value
   */
  private parseStatement(): PartialASTNode | null {
    const tokens: PartialToken[] = [];

    // If statement
    if (this.match('IF')) {
      tokens.push(this.previous());
      const condition = this.parseExpression();
      tokens.push(...(condition.tokens || []));

      const body = this.parseBody();
      tokens.push(...(body.tokens || []));

      return {
        type: 'IF',
        children: [condition, body],
        tokens,
        isComplete: condition.isComplete && body.isComplete,
      };
    }

    // For loop
    if (this.match('FOR')) {
      tokens.push(this.previous());
      const varName = this.check('IDENT') ? this.advance().value : 'i';
      tokens.push(this.previous());

      if (this.match('IN')) {
        tokens.push(this.previous());
      }

      const range = this.parseExpression();
      tokens.push(...(range.tokens || []));

      const body = this.parseBody();
      tokens.push(...(body.tokens || []));

      return {
        type: 'FOR',
        name: varName,
        children: [range, body],
        tokens,
        isComplete: range.isComplete && body.isComplete,
      };
    }

    // Return statement
    if (this.match('RETURN')) {
      tokens.push(this.previous());
      const expr = this.parseExpression();
      tokens.push(...(expr.tokens || []));

      return {
        type: 'RETURN',
        children: [expr],
        tokens,
        isComplete: expr.isComplete,
      };
    }

    // Assignment or expression
    const expr = this.parseExpression();
    if (expr) {
      tokens.push(...(expr.tokens || []));
    }

    // Try to consume semicolon or newline
    if (this.match('SEMICOLON', 'NEWLINE')) {
      tokens.push(this.previous());
    }

    return expr
      ? {
          type: 'EXPR_STMT',
          children: [expr],
          tokens,
          isComplete: expr.isComplete,
        }
      : null;
  }

  /**
   * Parse expression with error recovery
   *
   * Handles:
   * - Variable: x
   * - Literal: 42, "hello"
   * - Binary operation: x + 5
   * - Function call: func(a, b)
   * - Incomplete: func(
   */
  private parseExpression(): PartialASTNode {
    const tokens: PartialToken[] = [];
    let isComplete = true;

    // Parse primary expression
    let expr = this.parsePrimary();
    if (expr) {
      tokens.push(...(expr.tokens || []));
      if (!expr.isComplete) {
        isComplete = false;
      }
    }

    // Parse postfix operations
    while (!this.isAtEnd()) {
      if (this.match('DOT')) {
        tokens.push(this.previous());

        // Method name
        if (this.check('IDENT')) {
          const method = this.advance().value;
          tokens.push(this.previous());

          // Method arguments (optional)
          if (this.check('LPAREN')) {
            const args = this.parseArguments();
            tokens.push(...(args.tokens || []));
            if (!args.isComplete) {
              isComplete = false;
            }
          }
        } else {
          this.addError('Expected method name after dot');
          isComplete = false;
        }
      } else if (this.match('LBRACKET')) {
        tokens.push(this.previous());
        const index = this.parseExpression();
        tokens.push(...(index.tokens || []));

        if (this.match('RBRACKET')) {
          tokens.push(this.previous());
        } else {
          this.addError('Expected ] to close array access');
          isComplete = false;
        }
      } else if (this.match('LPAREN') && expr) {
        // Function call
        tokens.push(this.previous());
        const args = this.parseArguments();
        tokens.push(...(args.tokens || []));

        if (this.match('RPAREN')) {
          tokens.push(this.previous());
        } else {
          this.addError('Expected ) to close function call');
          isComplete = false;
        }

        if (!args.isComplete) {
          isComplete = false;
        }
      } else if (this.match('PLUS', 'MINUS', 'STAR', 'SLASH')) {
        tokens.push(this.previous());
        const right = this.parsePrimary();
        if (right) {
          tokens.push(...(right.tokens || []));
          if (!right.isComplete) {
            isComplete = false;
          }
        }
      } else {
        break;
      }
    }

    return {
      type: 'EXPRESSION',
      tokens,
      isComplete,
    };
  }

  /**
   * Parse primary expression
   */
  private parsePrimary(): PartialASTNode | null {
    const tokens: PartialToken[] = [];

    if (this.check('IDENT')) {
      tokens.push(this.advance());
      return { type: 'IDENT', tokens, isComplete: true };
    }

    if (this.check('NUMBER')) {
      tokens.push(this.advance());
      return { type: 'NUMBER', tokens, isComplete: true };
    }

    if (this.check('STRING')) {
      tokens.push(this.advance());
      return { type: 'STRING', tokens, isComplete: true };
    }

    if (this.match('LPAREN')) {
      tokens.push(this.previous());
      const expr = this.parseExpression();
      tokens.push(...(expr.tokens || []));

      if (this.match('RPAREN')) {
        tokens.push(this.previous());
      } else {
        this.addError('Expected ) to close parenthesized expression');
      }

      return { type: 'PAREN_EXPR', children: [expr], tokens, isComplete: expr.isComplete };
    }

    return null;
  }

  /**
   * Parse function arguments with error recovery
   *
   * Handles:
   * - Complete: (a, b, c)
   * - Incomplete: (a, b
   * - Missing args: ()
   */
  private parseArguments(): PartialASTNode {
    const tokens: PartialToken[] = [];
    const args: PartialASTNode[] = [];
    let isComplete = true;

    while (!this.check('RPAREN') && !this.isAtEnd()) {
      const arg = this.parseExpression();
      if (arg) {
        args.push(arg);
        tokens.push(...(arg.tokens || []));

        if (!arg.isComplete) {
          isComplete = false;
        }
      }

      if (this.match('COMMA')) {
        tokens.push(this.previous());
      } else if (!this.check('RPAREN')) {
        break;
      }
    }

    // Closing paren may be missing
    if (!this.check('RPAREN')) {
      this.addError('Expected ) to close arguments');
      isComplete = false;
    }

    return {
      type: 'ARGUMENTS',
      children: args,
      tokens,
      isComplete,
    };
  }

  /**
   * Parse const definition
   */
  private parseConstDef(): PartialASTNode {
    const tokens: PartialToken[] = [];
    tokens.push(this.previous());

    const name = this.check('IDENT') ? this.advance().value : 'unnamed';
    tokens.push(this.previous());

    if (this.match('EQUALS')) {
      tokens.push(this.previous());
    }

    const value = this.parseExpression();
    tokens.push(...(value.tokens || []));

    return {
      type: 'CONST_DEF',
      name,
      children: [value],
      tokens,
      isComplete: value.isComplete,
    };
  }

  /**
   * Parse type definition
   */
  private parseTypeDef(): PartialASTNode {
    const tokens: PartialToken[] = [];
    tokens.push(this.previous());

    const name = this.check('IDENT') ? this.advance().value : 'unnamed';
    tokens.push(this.previous());

    return {
      type: 'TYPE_DEF',
      name,
      tokens,
      isComplete: false, // Type definitions incomplete for now
    };
  }

  // ============ Helper Methods ============

  private match(...types: string[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): PartialToken {
    if (!this.isAtEnd()) this.pos++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.pos >= this.tokens.length || this.peek().type === 'EOF';
  }

  private peek(): PartialToken {
    return this.tokens[this.pos] || { type: 'EOF', value: '', line: -1, column: -1 };
  }

  private previous(): PartialToken {
    return this.tokens[this.pos - 1];
  }

  private addError(message: string): void {
    const token = this.peek();
    this.errors.push({
      line: token.line,
      column: token.column,
      message,
    });
  }

  /**
   * Error recovery: skip to next statement boundary
   */
  private recover(): void {
    // Skip until we find a likely statement boundary
    while (!this.isAtEnd()) {
      const current = this.peek();

      if (
        current.type === 'NEWLINE' ||
        current.type === 'SEMICOLON' ||
        current.type === 'RBRACE'
      ) {
        return;
      }

      if (
        current.type === 'FN' ||
        current.type === 'IF' ||
        current.type === 'FOR' ||
        current.type === 'RETURN'
      ) {
        return;
      }

      this.advance();
    }
  }

  /**
   * Recover to next statement
   */
  private recoverToNextStatement(): void {
    while (!this.isAtEnd()) {
      if (this.match('SEMICOLON', 'NEWLINE')) {
        break;
      }
      this.advance();
    }
  }

  /**
   * Get parse errors
   */
  public getErrors(): Array<{ line: number; column: number; message: string }> {
    return this.errors;
  }

  /**
   * Get completion percentage
   */
  public getCompletionPercentage(): number {
    if (this.tokens.length === 0) return 100;
    const completedTokens = this.tokens.filter(t => !t.isError).length;
    return (completedTokens / this.tokens.length) * 100;
  }
}
