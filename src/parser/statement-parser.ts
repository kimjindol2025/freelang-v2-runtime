/**
 * Phase 1 Task 1.1: Statement Parser with Optional Semicolons
 *
 * Parses general FreeLang statements without requiring semicolons.
 * Semicolons are optional - statements can be terminated by:
 * - Semicolon (;) - explicit terminator
 * - Newline - implicit terminator
 * - EOF - end of file
 * - Block start ({) - next statement block
 *
 * Supported statement types:
 * - Variable declaration: let x = 5; let x = 5 (both valid)
 * - Assignment: x = 10; x = 10
 * - If statement: if (x > 5) { ... } (block required)
 * - For loop: for i in 0..10 { ... }
 * - Function call: print(x); print(x)
 * - Return: return x; return x
 */

import { Token, TokenType } from '../lexer/token';
import { TokenBuffer } from '../lexer/lexer';
import { ParseError } from './ast';

export interface Statement {
  type: string; // 'let', 'assign', 'if', 'for', 'while', 'return', 'call', 'expr'
  line: number;
  text: string; // Raw statement text
  tokens: Token[]; // Tokens for this statement
}

export class StatementParser {
  private tokens: TokenBuffer;
  private statements: Statement[] = [];

  constructor(tokens: TokenBuffer) {
    this.tokens = tokens;
  }

  /**
   * Parse all statements in the token buffer
   */
  public parseStatements(): Statement[] {
    while (!this.check(TokenType.EOF)) {
      // Skip newlines
      if (this.match(TokenType.NEWLINE)) {
        continue;
      }

      const stmt = this.parseStatement();
      if (stmt) {
        this.statements.push(stmt);
      } else {
        // If parseStatement returns null, we must advance to prevent infinite loop
        this.advance();
      }
    }

    return this.statements;
  }

  /**
   * Parse a single statement
   * Returns null if no statement found or EOF reached
   */
  private parseStatement(): Statement | null {
    if (this.check(TokenType.EOF)) {
      return null;
    }

    const startLine = this.current().line;
    const startToken = this.current();

    // Consume statement until we hit a terminator
    const tokens: Token[] = [];

    while (
      !this.check(TokenType.EOF) &&
      !this.check(TokenType.NEWLINE) &&
      !this.check(TokenType.SEMICOLON) &&
      !this.isBlockStart()
    ) {
      tokens.push(this.current());
      this.advance();
    }

    if (tokens.length === 0) {
      return null;
    }

    // Consume the terminator (semicolon or newline)
    // but don't require it
    this.match(TokenType.SEMICOLON) || this.match(TokenType.NEWLINE);

    const text = tokens.map(t => t.value || t.type).join(' ');
    const type = this.getStatementType(startToken);

    return {
      type,
      line: startLine,
      text: text.trim(),
      tokens
    };
  }

  /**
   * Determine statement type from first token
   */
  private getStatementType(token: Token): string {
    switch (token.type) {
      case TokenType.LET:
      case TokenType.CONST:
        return 'declaration';
      case TokenType.IF:
        return 'if';
      case TokenType.FOR:
        return 'for';
      case TokenType.WHILE:
        return 'while';
      case TokenType.RETURN:
        return 'return';
      case TokenType.BREAK:
        return 'break';
      case TokenType.CONTINUE:
        return 'continue';
      default:
        return 'expr';
    }
  }

  /**
   * Check if we're at the start of a block
   */
  private isBlockStart(): boolean {
    return this.check(TokenType.LBRACE);
  }

  /**
   * Check current token type
   */
  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  /**
   * Consume current token if it matches type
   */
  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  /**
   * Get current token
   */
  private current(): Token {
    return this.tokens.current();
  }

  /**
   * Move to next token
   */
  private advance(): Token {
    return this.tokens.advance();
  }

  /**
   * Get statements parsed so far
   */
  public getStatements(): Statement[] {
    return [...this.statements];
  }
}
