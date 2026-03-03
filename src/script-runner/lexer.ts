// FreeLang v4 — Lexer (SPEC_04 구현)
// UTF-8 소스코드 → 토큰 배열

// ============================================================
// TokenType — 6 카테고리, ~50종
// ============================================================

export enum TokenType {
  // 키워드 (23)
  VAR = "VAR",
  LET = "LET",
  CONST = "CONST",
  FN = "FN",
  STRUCT = "STRUCT",
  CLASS = "CLASS",
  IF = "IF",
  ELSE = "ELSE",
  MATCH = "MATCH",
  FOR = "FOR",
  IN = "IN",
  OF = "OF",
  WHILE = "WHILE",
  BREAK = "BREAK",
  CONTINUE = "CONTINUE",
  RETURN = "RETURN",
  SPAWN = "SPAWN",
  USE = "USE",
  AS = "AS",
  NEW = "NEW",
  THIS = "THIS",
  TRUE = "TRUE",
  FALSE = "FALSE",

  // 타입 이름 (8)
  TYPE_I32 = "TYPE_I32",
  TYPE_I64 = "TYPE_I64",
  TYPE_F64 = "TYPE_F64",
  TYPE_BOOL = "TYPE_BOOL",
  TYPE_STRING = "TYPE_STRING",
  TYPE_VOID = "TYPE_VOID",
  TYPE_CHANNEL = "TYPE_CHANNEL",
  TYPE_ANY = "TYPE_ANY",

  // 리터럴 (3)
  INT_LIT = "INT_LIT",
  FLOAT_LIT = "FLOAT_LIT",
  STRING_LIT = "STRING_LIT",

  // 연산자/구두점 (26)
  PLUS = "PLUS",           // +
  MINUS = "MINUS",         // -
  STAR = "STAR",           // *
  SLASH = "SLASH",         // /
  PERCENT = "PERCENT",     // %
  EQ = "EQ",               // =
  EQEQ = "EQEQ",          // ==
  NEQ = "NEQ",             // !=
  LT = "LT",              // <
  GT = "GT",               // >
  LTEQ = "LTEQ",          // <=
  GTEQ = "GTEQ",          // >=
  AND = "AND",             // &&
  OR = "OR",               // ||
  NOT = "NOT",             // !
  QUESTION = "QUESTION",   // ?
  ARROW = "ARROW",         // =>
  RARROW = "RARROW",       // ->
  COLON = "COLON",         // :
  COMMA = "COMMA",         // ,
  DOT = "DOT",             // .
  LPAREN = "LPAREN",       // (
  RPAREN = "RPAREN",       // )
  LBRACKET = "LBRACKET",   // [
  RBRACKET = "RBRACKET",   // ]
  LBRACE = "LBRACE",       // {
  RBRACE = "RBRACE",       // }
  SEMICOLON = "SEMICOLON", // ;

  // 특수 (2) — NEWLINE 토큰 없음 (SPEC_04 Q7)
  IDENT = "IDENT",
  EOF = "EOF",
}

// ============================================================
// Token
// ============================================================

export type Token = {
  type: TokenType;
  lexeme: string;
  line: number;
  col: number;
};

// ============================================================
// LexError
// ============================================================

export type LexError = {
  message: string;
  line: number;
  col: number;
};

// ============================================================
// 키워드 테이블 (SPEC_04 Q4)
// ============================================================

const KEYWORDS: Map<string, TokenType> = new Map([
  // 키워드 (23)
  ["var", TokenType.VAR],
  ["let", TokenType.LET],
  ["const", TokenType.CONST],
  ["fn", TokenType.FN],
  ["struct", TokenType.STRUCT],
  ["class", TokenType.CLASS],
  ["if", TokenType.IF],
  ["else", TokenType.ELSE],
  ["match", TokenType.MATCH],
  ["for", TokenType.FOR],
  ["in", TokenType.IN],
  ["of", TokenType.OF],
  ["while", TokenType.WHILE],
  ["break", TokenType.BREAK],
  ["continue", TokenType.CONTINUE],
  ["return", TokenType.RETURN],
  ["spawn", TokenType.SPAWN],
  ["use", TokenType.USE],
  ["as", TokenType.AS],
  ["new", TokenType.NEW],
  ["this", TokenType.THIS],
  ["true", TokenType.TRUE],
  ["false", TokenType.FALSE],
  // 논리 연산자 키워드 (2) — && || 대신 사용 가능
  ["and", TokenType.AND],
  ["or", TokenType.OR],
  // 타입 이름 (8)
  ["i32", TokenType.TYPE_I32],
  ["i64", TokenType.TYPE_I64],
  ["f64", TokenType.TYPE_F64],
  ["bool", TokenType.TYPE_BOOL],
  ["string", TokenType.TYPE_STRING],
  ["void", TokenType.TYPE_VOID],
  ["channel", TokenType.TYPE_CHANNEL],
  ["any", TokenType.TYPE_ANY],
]);

// Option, Result, Ok, Err, Some, None은 키워드가 아님 → IDENT

// ============================================================
// Lexer
// ============================================================

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private col: number = 1;
  private tokens: Token[] = [];
  private errors: LexError[] = [];

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): { tokens: Token[]; errors: LexError[] } {
    while (!this.isAtEnd()) {
      this.scanToken();
    }
    this.tokens.push({ type: TokenType.EOF, lexeme: "", line: this.line, col: this.col });
    return { tokens: this.tokens, errors: this.errors };
  }

  private scanToken(): void {
    const ch = this.peek();

    // 공백 건너뜀 (스펙: ' ', '\t', '\r')
    if (ch === " " || ch === "\t" || ch === "\r") {
      this.advance();
      return;
    }

    // 줄바꿈 — 토큰 생성 안 함, 줄 번호만 추적 (SPEC_04 Q7)
    if (ch === "\n") {
      this.advance();
      this.line++;
      this.col = 1;
      return;
    }

    // # 주석 (FreeLang 고유)
    if (ch === "#") {
      this.skipHashComment();
      return;
    }

    // 주석 또는 SLASH (SPEC_04 Q8)
    if (ch === "/") {
      if (this.peekNext() === "/") {
        this.skipLineComment();
        return;
      }
      if (this.peekNext() === "*") {
        this.addError("block comments not supported, use //");
        this.advance(); // /
        this.advance(); // *
        return;
      }
      this.addToken(TokenType.SLASH, "/");
      this.advance();
      return;
    }

    // 식별자 또는 키워드 (SPEC_04 Q4)
    if (this.isAlpha(ch)) {
      this.scanIdentOrKeyword();
      return;
    }

    // 숫자 리터럴 (SPEC_04 Q5)
    if (this.isDigit(ch)) {
      this.scanNumber();
      return;
    }

    // 문자열 리터럴 (SPEC_04 Q6)
    if (ch === '"') {
      this.scanString();
      return;
    }

    // 2글자 연산자 먼저 확인 (최장 일치, SPEC_04 Q3)
    const startLine = this.line;
    const startCol = this.col;

    if (ch === "=" && this.peekNext() === "=") {
      this.advance(); this.advance();
      this.tokens.push({ type: TokenType.EQEQ, lexeme: "==", line: startLine, col: startCol });
      return;
    }
    if (ch === "=" && this.peekNext() === ">") {
      this.advance(); this.advance();
      this.tokens.push({ type: TokenType.ARROW, lexeme: "=>", line: startLine, col: startCol });
      return;
    }
    if (ch === "-" && this.peekNext() === ">") {
      this.advance(); this.advance();
      this.tokens.push({ type: TokenType.RARROW, lexeme: "->", line: startLine, col: startCol });
      return;
    }
    if (ch === "!" && this.peekNext() === "=") {
      this.advance(); this.advance();
      this.tokens.push({ type: TokenType.NEQ, lexeme: "!=", line: startLine, col: startCol });
      return;
    }
    if (ch === "<" && this.peekNext() === "=") {
      this.advance(); this.advance();
      this.tokens.push({ type: TokenType.LTEQ, lexeme: "<=", line: startLine, col: startCol });
      return;
    }
    if (ch === ">" && this.peekNext() === "=") {
      this.advance(); this.advance();
      this.tokens.push({ type: TokenType.GTEQ, lexeme: ">=", line: startLine, col: startCol });
      return;
    }
    if (ch === "&" && this.peekNext() === "&") {
      this.advance(); this.advance();
      this.tokens.push({ type: TokenType.AND, lexeme: "&&", line: startLine, col: startCol });
      return;
    }
    if (ch === "|" && this.peekNext() === "|") {
      this.advance(); this.advance();
      this.tokens.push({ type: TokenType.OR, lexeme: "||", line: startLine, col: startCol });
      return;
    }

    // 1글자 연산자/구두점
    const singleCharTokens: Record<string, TokenType> = {
      "+": TokenType.PLUS,
      "-": TokenType.MINUS,
      "*": TokenType.STAR,
      "%": TokenType.PERCENT,
      "=": TokenType.EQ,
      "<": TokenType.LT,
      ">": TokenType.GT,
      "!": TokenType.NOT,
      "?": TokenType.QUESTION,
      ":": TokenType.COLON,
      ",": TokenType.COMMA,
      ".": TokenType.DOT,
      ";": TokenType.SEMICOLON,
      "(": TokenType.LPAREN,
      ")": TokenType.RPAREN,
      "[": TokenType.LBRACKET,
      "]": TokenType.RBRACKET,
      "{": TokenType.LBRACE,
      "}": TokenType.RBRACE,
    };

    const tokenType = singleCharTokens[ch];
    if (tokenType !== undefined) {
      this.addToken(tokenType, ch);
      this.advance();
      return;
    }

    // 알 수 없는 문자
    this.addError(`unexpected character: ${ch}`);
    this.advance();
  }

  // --------------------------------------------------------
  // 식별자/키워드 스캔 (SPEC_04 Q4)
  // --------------------------------------------------------

  private scanIdentOrKeyword(): void {
    const startCol = this.col;
    const start = this.pos;

    while (!this.isAtEnd() && this.isAlphaNum(this.peek())) {
      this.advance();
    }

    const text = this.source.slice(start, this.pos);
    const type = KEYWORDS.get(text) ?? TokenType.IDENT;
    this.tokens.push({ type, lexeme: text, line: this.line, col: startCol });
  }

  // --------------------------------------------------------
  // 숫자 스캔 (SPEC_04 Q5)
  // --------------------------------------------------------

  private scanNumber(): void {
    const startCol = this.col;
    const start = this.pos;
    let isFloat = false;

    // 정수부: [0-9][0-9_]*
    this.consumeDigits();

    // 소수점 확인: '.' 다음이 숫자면 FLOAT_LIT
    if (!this.isAtEnd() && this.peek() === "." && this.isDigit(this.peekNext() ?? "")) {
      isFloat = true;
      this.advance(); // '.' 소비
      this.consumeDigits();
    }

    const text = this.source.slice(start, this.pos);

    // 밑줄 유효성 검사
    if (text.endsWith("_")) {
      this.errors.push({ message: "trailing underscore in number", line: this.line, col: startCol });
      return;
    }
    if (text.includes("__")) {
      this.errors.push({ message: "consecutive underscores in number", line: this.line, col: startCol });
      return;
    }

    const type = isFloat ? TokenType.FLOAT_LIT : TokenType.INT_LIT;
    this.tokens.push({ type, lexeme: text, line: this.line, col: startCol });
  }

  private consumeDigits(): void {
    while (!this.isAtEnd() && (this.isDigit(this.peek()) || this.peek() === "_")) {
      this.advance();
    }
  }

  // --------------------------------------------------------
  // 문자열 스캔 (SPEC_04 Q6)
  // --------------------------------------------------------

  private scanString(): void {
    const startLine = this.line;
    const startCol = this.col;
    this.advance(); // 여는 '"' 소비

    let value = "";

    while (!this.isAtEnd() && this.peek() !== '"') {
      const ch = this.peek();

      // 줄바꿈 불허
      if (ch === "\n") {
        this.errors.push({
          message: "newline in string literal, use \\n",
          line: this.line,
          col: this.col,
        });
        return;
      }

      // 이스케이프 시퀀스
      if (ch === "\\") {
        this.advance(); // '\' 소비
        if (this.isAtEnd()) {
          this.errors.push({ message: "unterminated string literal", line: startLine, col: startCol });
          return;
        }
        const esc = this.peek();
        switch (esc) {
          case "n": value += "\n"; break;
          case "t": value += "\t"; break;
          case "r": value += "\r"; break;
          case "\\": value += "\\"; break;
          case '"': value += '"'; break;
          case "0": value += "\0"; break;
          default:
            this.errors.push({
              message: `unknown escape sequence: \\${esc}`,
              line: this.line,
              col: this.col - 1,
            });
            value += esc;
        }
        this.advance();
        continue;
      }

      value += ch;
      this.advance();
    }

    if (this.isAtEnd()) {
      this.errors.push({ message: "unterminated string literal", line: startLine, col: startCol });
      return;
    }

    this.advance(); // 닫는 '"' 소비

    const lexeme = this.source.slice(this.source.indexOf('"', this.pos - value.length - 2 < 0 ? 0 : 0), this.pos);
    this.tokens.push({ type: TokenType.STRING_LIT, lexeme: value, line: startLine, col: startCol });
  }

  // --------------------------------------------------------
  // 주석 스캔 (SPEC_04 Q8)
  // --------------------------------------------------------

  private skipLineComment(): void {
    this.advance(); // 첫 번째 '/'
    this.advance(); // 두 번째 '/'
    while (!this.isAtEnd() && this.peek() !== "\n") {
      this.advance();
    }
    // '\n'은 소비하지 않음 — scanToken에서 줄 번호 처리
  }

  // # 주석 스캔 (FreeLang)
  private skipHashComment(): void {
    this.advance(); // '#' 소비
    while (!this.isAtEnd() && this.peek() !== "\n") {
      this.advance();
    }
    // '\n'은 소비하지 않음 — scanToken에서 줄 번호 처리
  }

  // --------------------------------------------------------
  // 유틸리티
  // --------------------------------------------------------

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private peek(): string {
    return this.source[this.pos];
  }

  private peekNext(): string | undefined {
    return this.pos + 1 < this.source.length ? this.source[this.pos + 1] : undefined;
  }

  private advance(): void {
    if (!this.isAtEnd()) {
      this.pos++;
      this.col++;
    }
  }

  private isAlpha(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isAlphaNum(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }

  private addToken(type: TokenType, lexeme: string): void {
    this.tokens.push({ type, lexeme, line: this.line, col: this.col });
  }

  private addError(message: string): void {
    this.errors.push({ message, line: this.line, col: this.col });
  }
}
