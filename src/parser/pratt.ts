/**
 * FreeLang Pratt Parser
 *
 * Recursive descent parser with operator precedence handling.
 * Replaces regex-based parsing with proper expression parsing.
 *
 * Features:
 * - Binary operators (+, -, *, /, %, ==, !=, <, >, <=, >=)
 * - Unary operators (-, !)
 * - Function calls
 * - Member access (.)
 * - Array literals
 * - Parenthesized expressions
 */

import { Expression, LiteralExpression, BinaryOpExpression, CallExpression, ArrayExpression, MemberExpression, IdentifierExpression } from './ast';

/**
 * Token types
 */
export enum TokenType {
  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  TRUE = 'TRUE',
  FALSE = 'FALSE',

  // Identifiers and Keywords
  IDENTIFIER = 'IDENTIFIER',

  // Operators
  PLUS = 'PLUS',           // +
  MINUS = 'MINUS',         // -
  STAR = 'STAR',           // *
  SLASH = 'SLASH',         // /
  PERCENT = 'PERCENT',     // %
  EQ = 'EQ',               // ==
  NEQ = 'NEQ',             // !=
  LT = 'LT',               // <
  GT = 'GT',               // >
  LTE = 'LTE',             // <=
  GTE = 'GTE',             // >=
  ASSIGN = 'ASSIGN',       // =
  AND = 'AND',             // &&
  OR = 'OR',               // ||
  NOT = 'NOT',             // !

  // Delimiters
  LPAREN = 'LPAREN',       // (
  RPAREN = 'RPAREN',       // )
  LBRACKET = 'LBRACKET',   // [
  RBRACKET = 'RBRACKET',   // ]
  LBRACE = 'LBRACE',       // {
  RBRACE = 'RBRACE',       // }
  COMMA = 'COMMA',         // ,
  DOT = 'DOT',             // .
  COLON = 'COLON',         // :
  SEMICOLON = 'SEMICOLON', // ;

  // Special
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string | number | boolean;
  line: number;
  column: number;
}

/**
 * Tokenizer - converts source code to tokens
 */
export class Tokenizer {
  private source: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  private current(): string {
    return this.source[this.pos] || '';
  }

  private peek(offset = 1): string {
    return this.source[this.pos + offset] || '';
  }

  private advance(): void {
    if (this.source[this.pos] === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    this.pos++;
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.current())) {
      this.advance();
    }
  }

  private skipComments(): void {
    if (this.current() === '/' && this.peek() === '/') {
      while (this.current() !== '\n' && this.current() !== '') {
        this.advance();
      }
    } else if (this.current() === '/' && this.peek() === '*') {
      this.advance(); // /
      this.advance(); // *
      while (!(this.current() === '*' && this.peek() === '/')) {
        if (this.current() === '') break;
        this.advance();
      }
      this.advance(); // *
      this.advance(); // /
    }
  }

  private readNumber(): number {
    let num = '';
    while (/[0-9.]/.test(this.current())) {
      num += this.current();
      this.advance();
    }
    return parseFloat(num);
  }

  private readString(quote: string): string {
    this.advance(); // Opening quote
    let str = '';
    while (this.current() !== quote && this.current() !== '') {
      if (this.current() === '\\') {
        this.advance();
        const escaped = this.current();
        switch (escaped) {
          case 'n': str += '\n'; break;
          case 't': str += '\t'; break;
          case 'r': str += '\r'; break;
          case '"': str += '"'; break;
          case "'": str += "'"; break;
          case '\\': str += '\\'; break;
          default: str += escaped;
        }
        this.advance();
      } else {
        str += this.current();
        this.advance();
      }
    }
    this.advance(); // Closing quote
    return str;
  }

  private readIdentifier(): string {
    let ident = '';
    while (/[a-zA-Z0-9_]/.test(this.current())) {
      ident += this.current();
      this.advance();
    }
    return ident;
  }

  private addToken(type: TokenType, value: string | number | boolean): void {
    this.tokens.push({
      type,
      value,
      line: this.line,
      column: this.column - String(value).length,
    });
  }

  tokenize(): Token[] {
    while (this.current() !== '') {
      this.skipWhitespace();
      this.skipComments();
      this.skipWhitespace();

      if (this.current() === '') break;

      const line = this.line;
      const column = this.column;

      // Numbers
      if (/[0-9]/.test(this.current())) {
        const num = this.readNumber();
        this.addToken(TokenType.NUMBER, num);
        continue;
      }

      // Strings
      if (this.current() === '"' || this.current() === "'") {
        const quote = this.current();
        const str = this.readString(quote);
        this.addToken(TokenType.STRING, str);
        continue;
      }

      // Identifiers and keywords
      if (/[a-zA-Z_]/.test(this.current())) {
        const ident = this.readIdentifier();
        switch (ident) {
          case 'true':
            this.addToken(TokenType.TRUE, true);
            break;
          case 'false':
            this.addToken(TokenType.FALSE, false);
            break;
          default:
            this.addToken(TokenType.IDENTIFIER, ident);
        }
        continue;
      }

      // Two-character operators
      const twoChar = this.current() + this.peek();
      switch (twoChar) {
        case '==':
          this.addToken(TokenType.EQ, '==');
          this.advance();
          this.advance();
          continue;
        case '!=':
          this.addToken(TokenType.NEQ, '!=');
          this.advance();
          this.advance();
          continue;
        case '<=':
          this.addToken(TokenType.LTE, '<=');
          this.advance();
          this.advance();
          continue;
        case '>=':
          this.addToken(TokenType.GTE, '>=');
          this.advance();
          this.advance();
          continue;
        case '&&':
          this.addToken(TokenType.AND, '&&');
          this.advance();
          this.advance();
          continue;
        case '||':
          this.addToken(TokenType.OR, '||');
          this.advance();
          this.advance();
          continue;
      }

      // Single-character tokens
      const char = this.current();
      switch (char) {
        case '+':
          this.addToken(TokenType.PLUS, '+');
          this.advance();
          break;
        case '-':
          this.addToken(TokenType.MINUS, '-');
          this.advance();
          break;
        case '*':
          this.addToken(TokenType.STAR, '*');
          this.advance();
          break;
        case '/':
          this.addToken(TokenType.SLASH, '/');
          this.advance();
          break;
        case '%':
          this.addToken(TokenType.PERCENT, '%');
          this.advance();
          break;
        case '=':
          this.addToken(TokenType.ASSIGN, '=');
          this.advance();
          break;
        case '!':
          this.addToken(TokenType.NOT, '!');
          this.advance();
          break;
        case '<':
          this.addToken(TokenType.LT, '<');
          this.advance();
          break;
        case '>':
          this.addToken(TokenType.GT, '>');
          this.advance();
          break;
        case '(':
          this.addToken(TokenType.LPAREN, '(');
          this.advance();
          break;
        case ')':
          this.addToken(TokenType.RPAREN, ')');
          this.advance();
          break;
        case '[':
          this.addToken(TokenType.LBRACKET, '[');
          this.advance();
          break;
        case ']':
          this.addToken(TokenType.RBRACKET, ']');
          this.advance();
          break;
        case '{':
          this.addToken(TokenType.LBRACE, '{');
          this.advance();
          break;
        case '}':
          this.addToken(TokenType.RBRACE, '}');
          this.advance();
          break;
        case ',':
          this.addToken(TokenType.COMMA, ',');
          this.advance();
          break;
        case '.':
          this.addToken(TokenType.DOT, '.');
          this.advance();
          break;
        case ':':
          this.addToken(TokenType.COLON, ':');
          this.advance();
          break;
        case ';':
          this.addToken(TokenType.SEMICOLON, ';');
          this.advance();
          break;
        default:
          throw new Error(`Unexpected character: '${char}' at ${line}:${column}`);
      }
    }

    this.addToken(TokenType.EOF, '');
    return this.tokens;
  }
}

/**
 * Pratt Parser - handles operator precedence and associativity
 */
export class PrattParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: '', line: 0, column: 0 };
  }

  private peek(offset = 1): Token {
    return this.tokens[this.pos + offset] || { type: TokenType.EOF, value: '', line: 0, column: 0 };
  }

  private advance(): Token {
    const token = this.current();
    if (this.current().type !== TokenType.EOF) {
      this.pos++;
    }
    return token;
  }

  private expect(type: TokenType): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new Error(`Expected ${type}, got ${token.type}`);
    }
    return this.advance();
  }

  /**
   * Get precedence of binary operator
   */
  private getPrecedence(type: TokenType): number {
    switch (type) {
      case TokenType.OR:
        return 1;
      case TokenType.AND:
        return 2;
      case TokenType.EQ:
      case TokenType.NEQ:
        return 3;
      case TokenType.LT:
      case TokenType.GT:
      case TokenType.LTE:
      case TokenType.GTE:
        return 4;
      case TokenType.PLUS:
      case TokenType.MINUS:
        return 5;
      case TokenType.STAR:
      case TokenType.SLASH:
      case TokenType.PERCENT:
        return 6;
      case TokenType.DOT:
        return 7;
      case TokenType.LPAREN:
      case TokenType.LBRACKET:
        return 8;
      default:
        return 0;
    }
  }

  /**
   * Parse primary expression (literal, identifier, parenthesized expression)
   */
  private parsePrimary(): Expression {
    const token = this.current();

    // Literals
    if (token.type === TokenType.NUMBER) {
      this.advance();
      return {
        type: 'literal',
        value: token.value as number,
        dataType: 'number',
      } as LiteralExpression;
    }

    if (token.type === TokenType.STRING) {
      this.advance();
      return {
        type: 'literal',
        value: token.value as string,
        dataType: 'string',
      } as LiteralExpression;
    }

    if (token.type === TokenType.TRUE || token.type === TokenType.FALSE) {
      this.advance();
      return {
        type: 'literal',
        value: token.value as boolean,
        dataType: 'bool',
      } as LiteralExpression;
    }

    // Identifier
    if (token.type === TokenType.IDENTIFIER) {
      const name = token.value as string;
      this.advance();
      return {
        type: 'identifier',
        name,
      } as IdentifierExpression;
    }

    // Parenthesized expression
    if (token.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseExpression(0);
      this.expect(TokenType.RPAREN);
      return expr;
    }

    // Array literal
    if (token.type === TokenType.LBRACKET) {
      this.advance();
      const elements: Expression[] = [];
      while (this.current().type !== TokenType.RBRACKET && this.current().type !== TokenType.EOF) {
        elements.push(this.parseExpression(0));
        if (this.current().type === TokenType.COMMA) {
          this.advance();
        } else {
          break;
        }
      }
      this.expect(TokenType.RBRACKET);
      return {
        type: 'array',
        elements,
      } as ArrayExpression;
    }

    // Unary operators - represented as function calls
    if (token.type === TokenType.NOT) {
      this.advance();
      const right = this.parsePrimary();
      return {
        type: 'call',
        callee: '__not__',
        arguments: [right],
      } as CallExpression;
    }

    if (token.type === TokenType.MINUS) {
      this.advance();
      const right = this.parsePrimary();
      return {
        type: 'call',
        callee: '__negate__',
        arguments: [right],
      } as CallExpression;
    }

    throw new Error(`Unexpected token: ${token.type}`);
  }

  /**
   * Parse postfix operations (function calls, member access, array indexing)
   */
  private parsePostfix(expr: Expression): Expression {
    while (true) {
      const token = this.current();

      // Function call
      if (token.type === TokenType.LPAREN) {
        this.advance();
        const args: Expression[] = [];
        while (this.current().type !== TokenType.RPAREN && this.current().type !== TokenType.EOF) {
          args.push(this.parseExpression(0));
          if (this.current().type === TokenType.COMMA) {
            this.advance();
          } else {
            break;
          }
        }
        this.expect(TokenType.RPAREN);

        // Get function name from expression
        let funcName = '';
        if (expr.type === 'identifier') {
          funcName = (expr as IdentifierExpression).name;
        } else {
          throw new Error('Invalid function call');
        }

        expr = {
          type: 'call',
          callee: funcName,
          arguments: args,
        } as CallExpression;
        continue;
      }

      // Member access
      if (token.type === TokenType.DOT) {
        this.advance();
        const property = this.expect(TokenType.IDENTIFIER).value as string;
        expr = {
          type: 'member',
          object: expr,
          property,
        } as MemberExpression;
        continue;
      }

      // Array indexing
      if (token.type === TokenType.LBRACKET) {
        this.advance();
        const index = this.parseExpression(0);
        this.expect(TokenType.RBRACKET);
        expr = {
          type: 'call',
          callee: '__index__',
          arguments: [expr, index],
        } as CallExpression; // Using call to represent array indexing
        continue;
      }

      break;
    }

    return expr;
  }

  /**
   * Parse expression with operator precedence
   */
  parseExpression(minPrecedence = 0): Expression {
    let left = this.parsePrimary();
    left = this.parsePostfix(left);

    while (this.getPrecedence(this.current().type) > minPrecedence) {
      const op = this.current();

      if (
        op.type !== TokenType.PLUS &&
        op.type !== TokenType.MINUS &&
        op.type !== TokenType.STAR &&
        op.type !== TokenType.SLASH &&
        op.type !== TokenType.PERCENT &&
        op.type !== TokenType.EQ &&
        op.type !== TokenType.NEQ &&
        op.type !== TokenType.LT &&
        op.type !== TokenType.GT &&
        op.type !== TokenType.LTE &&
        op.type !== TokenType.GTE &&
        op.type !== TokenType.AND &&
        op.type !== TokenType.OR
      ) {
        break;
      }

      this.advance();

      const precedence = this.getPrecedence(op.type);
      const right = this.parseExpression(precedence + 1);

      const operator = op.value as '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '>' | '<' | '>=' | '<=';
      left = {
        type: 'binary',
        operator,
        left,
        right,
      } as BinaryOpExpression;

      left = this.parsePostfix(left);
    }

    return left;
  }
}

/**
 * Parse a FreeLang expression from source code
 */
export function parseFreeLangExpression(source: string): Expression {
  const tokenizer = new Tokenizer(source);
  const tokens = tokenizer.tokenize();
  const parser = new PrattParser(tokens);
  return parser.parseExpression();
}
