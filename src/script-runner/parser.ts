// FreeLang v4 — Parser (SPEC_05 구현)
// RD(문) + Pratt(식) 하이브리드

import { Token, TokenType } from "./lexer";
import {
  Program, Stmt, Expr, TypeAnnotation, Pattern, MatchArm, Param, StructField, FnParam,
} from "./ast";

// ============================================================
// ParseError
// ============================================================

export type ParseError = {
  message: string;
  line: number;
  col: number;
};

// ============================================================
// Binding Power (SPEC_05 Q4)
// ============================================================

const BP_ASSIGN = 10;
const BP_OR = 20;
const BP_AND = 30;
const BP_EQUALITY = 40;
const BP_COMPARISON = 50;
const BP_ADDITIVE = 60;
const BP_MULTIPLICATIVE = 70;
const BP_UNARY = 90;
const BP_POSTFIX = 100;

function infixBP(type: TokenType): number {
  switch (type) {
    // EQ는 Pratt에서 처리하지 않음 → ExprStmt에서 할당으로 처리
    case TokenType.OR: return BP_OR;
    case TokenType.AND: return BP_AND;
    case TokenType.EQEQ:
    case TokenType.NEQ: return BP_EQUALITY;
    case TokenType.LT:
    case TokenType.GT:
    case TokenType.LTEQ:
    case TokenType.GTEQ: return BP_COMPARISON;
    case TokenType.PLUS:
    case TokenType.MINUS: return BP_ADDITIVE;
    case TokenType.STAR:
    case TokenType.SLASH:
    case TokenType.PERCENT: return BP_MULTIPLICATIVE;
    case TokenType.LPAREN:
    case TokenType.LBRACKET:
    case TokenType.DOT:
    case TokenType.QUESTION: return BP_POSTFIX;
    default: return 0;
  }
}

// ============================================================
// Parser
// ============================================================

export class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private errors: ParseError[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): { program: Program; errors: ParseError[] } {
    const stmts: Stmt[] = [];
    while (!this.isAtEnd()) {
      try {
        stmts.push(this.parseStmt());
      } catch (e) {
        // 에러 복구: 다음 문 시작까지 건너뜀
        this.synchronize();
      }
    }
    return { program: { stmts }, errors: this.errors };
  }

  // ============================================================
  // 문 파싱 — Recursive Descent (SPEC_05 Q1)
  // ============================================================

  private parseStmt(): Stmt {
    const tok = this.peek();

    switch (tok.type) {
      case TokenType.VAR:
      case TokenType.LET:
      case TokenType.CONST:
        return this.parseVarDecl();
      case TokenType.FN:
        return this.parseFnDecl();
      case TokenType.STRUCT:
        return this.parseStructDecl();
      case TokenType.CLASS:
        return this.parseClassDecl();
      case TokenType.USE:
        return this.parseUseDecl();
      case TokenType.IF:
        return this.parseIfStmt();
      case TokenType.MATCH:
        return this.parseMatchStmt();
      case TokenType.FOR:
        return this.parseForStmt();
      case TokenType.WHILE:
        return this.parseWhileStmt();
      case TokenType.BREAK:
        return this.parseBreakStmt();
      case TokenType.CONTINUE:
        return this.parseContinueStmt();
      case TokenType.SPAWN:
        return this.parseSpawnStmt();
      case TokenType.RETURN:
        return this.parseReturnStmt();
      default:
        return this.parseExprStmt();
    }
  }

  // var/let/const 선언
  private parseVarDecl(): Stmt {
    const kw = this.advance(); // var/let/const
    const mutable = kw.type === TokenType.VAR;
    const name = this.expectIdent("variable name");
    let type: TypeAnnotation | null = null;

    if (this.check(TokenType.COLON)) {
      this.advance(); // :
      type = this.parseType();
    }

    this.expect(TokenType.EQ, "expected '=' in variable declaration");
    const init = this.parseExpr(0);
    this.match(TokenType.SEMICOLON); // optional semicolon

    return { kind: "var_decl", name, mutable, type, init, line: kw.line, col: kw.col };
  }

  // fn 선언
  private parseFnDecl(): Stmt {
    const kw = this.advance(); // fn
    const name = this.expectIdent("function name");
    this.expect(TokenType.LPAREN, "expected '(' after function name");

    const params: Param[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        const pName = this.expectIdent("parameter name");
        this.expect(TokenType.COLON, "expected ':' after parameter name");
        const pType = this.parseType();
        params.push({ name: pName, type: pType });
      } while (this.match(TokenType.COMMA));
    }
    this.expect(TokenType.RPAREN, "expected ')' after parameters");

    // 반환 타입 (필수 — SPEC_06: 함수 시그니처 명시) — : 또는 -> 허용
    if (this.check(TokenType.COLON)) this.advance();
    else this.expect(TokenType.RARROW, "expected ':' or '->' for return type");
    const returnType = this.parseType();

    this.expect(TokenType.LBRACE, "expected '{' for function body");
    const body = this.parseBlock();

    return { kind: "fn_decl", name, params, returnType, body, line: kw.line, col: kw.col };
  }

  // struct 선언
  private parseStructDecl(): Stmt {
    const kw = this.advance(); // struct
    const name = this.expectIdent("struct name");
    this.expect(TokenType.LBRACE, "expected '{' after struct name");

    const fields: StructField[] = [];
    if (!this.check(TokenType.RBRACE)) {
      do {
        const fieldName = this.expectIdent("field name");
        this.expect(TokenType.COLON, "expected ':' after field name");
        const fieldType = this.parseType();
        fields.push({ name: fieldName, type: fieldType });
      } while (this.match(TokenType.COMMA));
    }

    this.expect(TokenType.RBRACE, "expected '}' to close struct");

    return { kind: "struct_decl", name, fields, line: kw.line, col: kw.col };
  }

  // class 선언 (struct 필드만 추출, methods는 무시)
  private parseClassDecl(): Stmt {
    const kw = this.advance(); // class
    const name = this.expectIdent("class name");
    this.expect(TokenType.LBRACE, "expected '{' after class name");

    const fields: StructField[] = [];

    // 클래스 본문 파싱: 필드, new(), methods 구분
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      // new() 생성자는 무시
      if (this.check(TokenType.NEW)) {
        this.advance(); // new
        this.expect(TokenType.LPAREN, "expected '(' after new");
        while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
          this.advance(); // parameter 무시
        }
        this.expect(TokenType.RPAREN, "expected ')' after constructor params");
        this.expect(TokenType.LBRACE, "expected '{' for constructor body");
        // constructor body 무시
        let depth = 1;
        while (depth > 0 && !this.isAtEnd()) {
          if (this.check(TokenType.LBRACE)) depth++;
          else if (this.check(TokenType.RBRACE)) depth--;
          this.advance();
        }
        continue;
      }

      // fn methods는 무시
      if (this.check(TokenType.FN)) {
        this.advance(); // fn
        this.expectIdent("method name");
        this.expect(TokenType.LPAREN, "expected '(' after method name");
        while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
          this.advance(); // parameters 무시
        }
        this.expect(TokenType.RPAREN, "expected ')' after parameters");
        // return type
        if (this.check(TokenType.COLON) || this.check(TokenType.RARROW)) {
          this.advance();
          this.parseType(); // return type 무시
        }
        this.expect(TokenType.LBRACE, "expected '{' for method body");
        // method body 무시
        let depth = 1;
        while (depth > 0 && !this.isAtEnd()) {
          if (this.check(TokenType.LBRACE)) depth++;
          else if (this.check(TokenType.RBRACE)) depth--;
          this.advance();
        }
        continue;
      }

      // 필드 정의
      const fieldName = this.expectIdent("field name");
      this.expect(TokenType.COLON, "expected ':' after field name");
      const fieldType = this.parseType();
      fields.push({ name: fieldName, type: fieldType });

      // 선택적 쉼표
      this.match(TokenType.COMMA);
    }

    this.expect(TokenType.RBRACE, "expected '}' to close class");

    return { kind: "class_decl", name, fields, line: kw.line, col: kw.col };
  }

  // use 선언
  private parseUseDecl(): Stmt {
    const kw = this.advance(); // use
    const module = this.expectIdent("module name");
    this.expect(TokenType.AS, "expected 'as' after module name");
    const alias = this.expectIdent("alias name");
    this.expect(TokenType.SEMICOLON, "expected ';' after use declaration");
    return { kind: "use_decl", module, alias, line: kw.line, col: kw.col };
  }

  // if 문 (문 위치)
  private parseIfStmt(): Stmt {
    const kw = this.advance(); // if
    const condition = this.parseExpr(0);
    this.expect(TokenType.LBRACE, "expected '{' after if condition");
    const then = this.parseBlock();

    let else_: Stmt[] | null = null;
    if (this.match(TokenType.ELSE)) {
      if (this.check(TokenType.IF)) {
        // else if 체인
        else_ = [this.parseIfStmt()];
      } else {
        this.expect(TokenType.LBRACE, "expected '{' after else");
        else_ = this.parseBlock();
      }
    }

    return { kind: "if_stmt", condition, then, else_, line: kw.line, col: kw.col };
  }

  // match 문
  private parseMatchStmt(): Stmt {
    const kw = this.advance(); // match
    const subject = this.parseExpr(0);
    this.expect(TokenType.LBRACE, "expected '{' after match expression");
    const arms = this.parseMatchArms();
    this.expect(TokenType.RBRACE, "expected '}' to close match");

    return { kind: "match_stmt", subject, arms, line: kw.line, col: kw.col };
  }

  // for 문
  private parseForStmt(): Stmt {
    const kw = this.advance(); // for
    const variable = this.expectIdent("loop variable");

    // for...in or for...of
    const loopType = this.peek().type;
    if (loopType === TokenType.IN) {
      this.advance(); // in
      const iterable = this.parseExpr(0);
      this.expect(TokenType.LBRACE, "expected '{' after for...in");
      const body = this.parseBlock();
      return { kind: "for_stmt", variable, iterable, body, line: kw.line, col: kw.col };
    } else if (loopType === TokenType.OF) {
      this.advance(); // of
      const iterable = this.parseExpr(0);
      this.expect(TokenType.LBRACE, "expected '{' after for...of");
      const body = this.parseBlock();
      return { kind: "for_of_stmt", variable, iterable, body, line: kw.line, col: kw.col };
    } else {
      this.error("expected 'in' or 'of' after loop variable", this.peek());
      return { kind: "for_stmt", variable, iterable: { kind: "ident", name: "", line: kw.line, col: kw.col }, body: [], line: kw.line, col: kw.col };
    }
  }

  // while 문
  private parseWhileStmt(): Stmt {
    const kw = this.advance(); // while
    const condition = this.parseExpr(0);
    this.expect(TokenType.LBRACE, "expected '{' after while condition");
    const body = this.parseBlock();

    return { kind: "while_stmt", condition, body, line: kw.line, col: kw.col };
  }

  // break 문
  private parseBreakStmt(): Stmt {
    const kw = this.advance(); // break
    this.match(TokenType.SEMICOLON); // optional semicolon
    return { kind: "break_stmt", line: kw.line, col: kw.col };
  }

  // continue 문
  private parseContinueStmt(): Stmt {
    const kw = this.advance(); // continue
    this.match(TokenType.SEMICOLON); // optional semicolon
    return { kind: "continue_stmt", line: kw.line, col: kw.col };
  }

  // spawn 문
  private parseSpawnStmt(): Stmt {
    const kw = this.advance(); // spawn
    this.expect(TokenType.LBRACE, "expected '{' after spawn");
    const body = this.parseBlock();

    return { kind: "spawn_stmt", body, line: kw.line, col: kw.col };
  }

  // return 문
  private parseReturnStmt(): Stmt {
    const kw = this.advance(); // return

    // return 뒤에 식이 있는지 확인
    let value: Expr | null = null;
    if (!this.check(TokenType.RBRACE) && !this.isAtEnd() && !this.isStmtStart()) {
      value = this.parseExpr(0);
    }
    this.match(TokenType.SEMICOLON); // optional semicolon

    return { kind: "return_stmt", value, line: kw.line, col: kw.col };
  }

  // 식 문 (ExprStmt)
  private parseExprStmt(): Stmt {
    const tok = this.peek();
    const expr = this.parseExpr(0);

    // 할당 처리: expr = value
    if (this.check(TokenType.EQ)) {
      const eq = this.advance();
      const value = this.parseExpr(0);
      this.match(TokenType.SEMICOLON); // optional semicolon
      return {
        kind: "expr_stmt",
        expr: { kind: "assign", target: expr, value, line: eq.line, col: eq.col },
        line: tok.line,
        col: tok.col,
      };
    }

    this.match(TokenType.SEMICOLON); // optional semicolon
    return { kind: "expr_stmt", expr, line: tok.line, col: tok.col };
  }

  // ============================================================
  // 블록 파싱 ({ 이미 소비됨, } 소비함 )
  // ============================================================

  private parseBlock(): Stmt[] {
    const stmts: Stmt[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      try {
        stmts.push(this.parseStmt());
      } catch {
        this.synchronize();
      }
    }
    this.expect(TokenType.RBRACE, "expected '}'");
    return stmts;
  }

  // ============================================================
  // 식 파싱 — Pratt Parser (SPEC_05 Q3, Q4)
  // ============================================================

  private parseExpr(minBP: number): Expr {
    let left = this.nud();

    while (!this.isAtEnd()) {
      const tok = this.peek();

      // 구조체 리터럴: ident { field: value, ... }
      // BUT: 블록과 구조체 리터럴을 구분하기 위해, 다음 토큰이 statement keyword면 블록이다
      if (tok.type === TokenType.LBRACE && left.kind === "ident") {
        // Peek ahead to see if this is a block or struct literal
        // If the next token after LBRACE is a statement keyword, it's a block, not a struct literal
        const nextIdx = this.pos + 1;
        if (nextIdx < this.tokens.length) {
          const nextTok = this.tokens[nextIdx];
          // If the next token is a statement start keyword, this is a block, not a struct literal
          if (nextTok.type === TokenType.VAR || nextTok.type === TokenType.LET ||
              nextTok.type === TokenType.CONST || nextTok.type === TokenType.FN ||
              nextTok.type === TokenType.STRUCT || nextTok.type === TokenType.IF ||
              nextTok.type === TokenType.MATCH || nextTok.type === TokenType.FOR ||
              nextTok.type === TokenType.WHILE || nextTok.type === TokenType.BREAK ||
              nextTok.type === TokenType.CONTINUE || nextTok.type === TokenType.SPAWN ||
              nextTok.type === TokenType.RETURN) {
            // This is a block, not a struct literal
            break;
          }
        }

        this.advance(); // {
        const fields: { name: string; value: Expr }[] = [];
        if (!this.check(TokenType.RBRACE)) {
          do {
            const name = this.expectIdent("field name");
            this.expect(TokenType.COLON, "expected ':' after field name");
            const value = this.parseExpr(0);
            fields.push({ name, value });
          } while (this.match(TokenType.COMMA));
        }
        this.expect(TokenType.RBRACE, "expected '}'");
        left = { kind: "struct_lit", structName: left.name, fields, line: left.line, col: left.col };
        continue;
      }

      const bp = infixBP(tok.type);
      if (bp <= minBP) break;

      left = this.led(left, bp);
    }

    return left;
  }

  // nud — prefix 위치
  private nud(): Expr {
    const tok = this.peek();

    // 정수 리터럴
    if (tok.type === TokenType.INT_LIT) {
      this.advance();
      const raw = tok.lexeme.replace(/_/g, "");
      return { kind: "int_lit", value: parseInt(raw, 10), line: tok.line, col: tok.col };
    }

    // 부동소수점 리터럴
    if (tok.type === TokenType.FLOAT_LIT) {
      this.advance();
      const raw = tok.lexeme.replace(/_/g, "");
      return { kind: "float_lit", value: parseFloat(raw), line: tok.line, col: tok.col };
    }

    // 문자열 리터럴
    if (tok.type === TokenType.STRING_LIT) {
      this.advance();
      return { kind: "string_lit", value: tok.lexeme, line: tok.line, col: tok.col };
    }

    // 불리언 리터럴
    if (tok.type === TokenType.TRUE) {
      this.advance();
      return { kind: "bool_lit", value: true, line: tok.line, col: tok.col };
    }
    if (tok.type === TokenType.FALSE) {
      this.advance();
      return { kind: "bool_lit", value: false, line: tok.line, col: tok.col };
    }

    // 식별자 (channel도 식 위치에서는 함수 이름으로 사용)
    if (tok.type === TokenType.IDENT || tok.type === TokenType.TYPE_CHANNEL) {
      this.advance();
      return { kind: "ident", name: tok.lexeme, line: tok.line, col: tok.col };
    }

    // 단항 연산자: - !
    if (tok.type === TokenType.MINUS || tok.type === TokenType.NOT) {
      this.advance();
      const operand = this.parseExpr(BP_UNARY);
      return { kind: "unary", op: tok.lexeme, operand, line: tok.line, col: tok.col };
    }

    // 괄호 그룹: ( expr )
    if (tok.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseExpr(0);
      this.expect(TokenType.RPAREN, "expected ')'");
      return expr;
    }

    // 배열 리터럴: [ elem, ... ]
    if (tok.type === TokenType.LBRACKET) {
      return this.parseArrayLit();
    }

    // if 식 (식 위치)
    if (tok.type === TokenType.IF) {
      return this.parseIfExpr();
    }

    // match 식 (식 위치)
    if (tok.type === TokenType.MATCH) {
      return this.parseMatchExpr();
    }

    // 함수 리터럴 (람다): fn(x: i32) -> i32 { x + 1 }
    if (tok.type === TokenType.FN) {
      return this.parseFnLit();
    }

    this.error(`unexpected token: ${tok.lexeme}`, tok);
    this.advance();
    return { kind: "ident", name: "__error__", line: tok.line, col: tok.col };
  }

  // led — infix/postfix 위치
  private led(left: Expr, bp: number): Expr {
    const tok = this.peek();

    // 이항 연산자
    if (
      tok.type === TokenType.PLUS || tok.type === TokenType.MINUS ||
      tok.type === TokenType.STAR || tok.type === TokenType.SLASH ||
      tok.type === TokenType.PERCENT ||
      tok.type === TokenType.EQEQ || tok.type === TokenType.NEQ ||
      tok.type === TokenType.LT || tok.type === TokenType.GT ||
      tok.type === TokenType.LTEQ || tok.type === TokenType.GTEQ ||
      tok.type === TokenType.AND || tok.type === TokenType.OR
    ) {
      this.advance();
      const right = this.parseExpr(bp); // left-associative
      return { kind: "binary", op: tok.lexeme, left, right, line: tok.line, col: tok.col };
    }

    // 함수 호출: expr(args)
    if (tok.type === TokenType.LPAREN) {
      this.advance();
      const args: Expr[] = [];
      if (!this.check(TokenType.RPAREN)) {
        do {
          args.push(this.parseExpr(0));
        } while (this.match(TokenType.COMMA));
      }
      this.expect(TokenType.RPAREN, "expected ')' after arguments");
      return { kind: "call", callee: left, args, line: tok.line, col: tok.col };
    }

    // 인덱스: expr[index]
    if (tok.type === TokenType.LBRACKET) {
      this.advance();
      const index = this.parseExpr(0);
      this.expect(TokenType.RBRACKET, "expected ']'");
      return { kind: "index", object: left, index, line: tok.line, col: tok.col };
    }

    // 필드 접근: expr.field
    if (tok.type === TokenType.DOT) {
      this.advance();
      const field = this.expectIdent("field name");
      return { kind: "field_access", object: left, field, line: tok.line, col: tok.col };
    }

    // try 연산자: expr?
    if (tok.type === TokenType.QUESTION) {
      this.advance();
      return { kind: "try", operand: left, line: tok.line, col: tok.col };
    }

    // 할당은 ExprStmt에서 처리하므로 여기선 패스
    // EQ가 여기 오면 식 끝으로 처리
    this.error(`unexpected operator: ${tok.lexeme}`, tok);
    this.advance();
    return left;
  }

  // ============================================================
  // 복합 식 파싱
  // ============================================================

  // 배열 리터럴: [a, b, c]
  private parseArrayLit(): Expr {
    const tok = this.advance(); // [
    const elements: Expr[] = [];
    if (!this.check(TokenType.RBRACKET)) {
      do {
        elements.push(this.parseExpr(0));
      } while (this.match(TokenType.COMMA));
    }
    this.expect(TokenType.RBRACKET, "expected ']'");
    return { kind: "array_lit", elements, line: tok.line, col: tok.col };
  }

  // 구조체 리터럴: { name: expr, ... }
  // if 식 (식 위치, else 필수 — SPEC_06)
  private parseIfExpr(): Expr {
    const tok = this.advance(); // if
    const condition = this.parseExpr(0);
    this.expect(TokenType.LBRACE, "expected '{' after if condition");
    const then = this.parseBlockExprs();
    this.expect(TokenType.ELSE, "if expression requires else branch");
    this.expect(TokenType.LBRACE, "expected '{' after else");
    const else_ = this.parseBlockExprs();
    return { kind: "if_expr", condition, then, else_, line: tok.line, col: tok.col };
  }

  // match 식 (식 위치)
  private parseMatchExpr(): Expr {
    const tok = this.advance(); // match
    const subject = this.parseExpr(0);
    this.expect(TokenType.LBRACE, "expected '{' after match expression");
    const arms = this.parseMatchArms();
    this.expect(TokenType.RBRACE, "expected '}' to close match");
    return { kind: "match_expr", subject, arms, line: tok.line, col: tok.col };
  }

  // 블록 내 식 목록 (if/match 식의 body) → } 소비
  private parseBlockExprs(): Expr[] {
    const exprs: Expr[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      exprs.push(this.parseExpr(0));
    }
    this.expect(TokenType.RBRACE, "expected '}'");
    return exprs;
  }

  // ============================================================
  // match arms
  // ============================================================

  private parseMatchArms(): MatchArm[] {
    const arms: MatchArm[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const pattern = this.parsePattern();
      this.expect(TokenType.ARROW, "expected '=>' after pattern");

      let body: Expr;
      if (this.check(TokenType.LBRACE)) {
        // 블록 body
        const bTok = this.advance(); // {
        const stmts: Stmt[] = [];
        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
          stmts.push(this.parseStmt());
        }
        this.expect(TokenType.RBRACE, "expected '}'");
        // 블록의 마지막 문이 ExprStmt면 그 식이 반환값
        const lastExpr = stmts.length > 0 && stmts[stmts.length - 1].kind === "expr_stmt"
          ? (stmts[stmts.length - 1] as any).expr
          : null;
        body = { kind: "block_expr", stmts: stmts.slice(0, lastExpr ? -1 : stmts.length), expr: lastExpr, line: bTok.line, col: bTok.col };
      } else {
        body = this.parseExpr(0);
      }

      this.match(TokenType.COMMA); // trailing comma optional
      arms.push({ pattern, body });
    }
    return arms;
  }

  // 함수 리터럴: fn(x: i32, y: i32) -> i32 { x + y }
  private parseFnLit(): Expr {
    const kw = this.advance(); // fn
    this.expect(TokenType.LPAREN, "expected '(' after fn");

    const params: FnParam[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        const name = this.expectIdent("parameter name");
        let type: TypeAnnotation | undefined = undefined;
        if (this.match(TokenType.COLON)) {
          type = this.parseType();
        }
        params.push({ name, type });
      } while (this.match(TokenType.COMMA));
    }
    this.expect(TokenType.RPAREN, "expected ')' after parameters");

    let returnType: TypeAnnotation | undefined = undefined;
    if (this.match(TokenType.RARROW)) {
      returnType = this.parseType();
    }

    // body
    let body: Expr;
    if (this.check(TokenType.LBRACE)) {
      const bTok = this.advance(); // {
      const stmts: Stmt[] = [];
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        stmts.push(this.parseStmt());
      }
      this.expect(TokenType.RBRACE, "expected '}'");
      const lastExpr = stmts.length > 0 && stmts[stmts.length - 1].kind === "expr_stmt"
        ? (stmts[stmts.length - 1] as any).expr
        : null;
      body = { kind: "block_expr", stmts: stmts.slice(0, lastExpr ? -1 : stmts.length), expr: lastExpr, line: bTok.line, col: bTok.col };
    } else {
      body = this.parseExpr(0);
    }

    return { kind: "fn_lit", params, returnType, body, line: kw.line, col: kw.col };
  }

  // ============================================================
  // 패턴 파싱 (SPEC_05 Q8)
  // ============================================================

  private parsePattern(): Pattern {
    const tok = this.peek();

    // _ (wildcard)
    if (tok.type === TokenType.IDENT && tok.lexeme === "_") {
      this.advance();
      return { kind: "wildcard" };
    }

    // Ok(p), Err(p), Some(p), None
    if (tok.type === TokenType.IDENT) {
      if (tok.lexeme === "Ok" || tok.lexeme === "Err" || tok.lexeme === "Some") {
        this.advance();
        this.expect(TokenType.LPAREN, `expected '(' after ${tok.lexeme}`);
        const inner = this.parsePattern();
        this.expect(TokenType.RPAREN, "expected ')'");
        if (tok.lexeme === "Ok") return { kind: "ok", inner };
        if (tok.lexeme === "Err") return { kind: "err", inner };
        return { kind: "some", inner };
      }
      if (tok.lexeme === "None") {
        this.advance();
        return { kind: "none" };
      }
      // 일반 식별자 바인딩
      this.advance();
      return { kind: "ident", name: tok.lexeme };
    }

    // 리터럴 패턴
    if (tok.type === TokenType.INT_LIT || tok.type === TokenType.FLOAT_LIT ||
        tok.type === TokenType.STRING_LIT || tok.type === TokenType.TRUE ||
        tok.type === TokenType.FALSE) {
      const expr = this.nud();
      return { kind: "literal", value: expr };
    }

    // 단항 마이너스 (음수 리터럴 패턴)
    if (tok.type === TokenType.MINUS) {
      const expr = this.nud(); // unary minus
      return { kind: "literal", value: expr };
    }

    this.error("expected pattern", tok);
    this.advance();
    return { kind: "wildcard" };
  }

  // ============================================================
  // 타입 파싱
  // ============================================================

  private parseType(): TypeAnnotation {
    const tok = this.peek();

    // fn(T1, T2) -> R 함수 타입
    if (tok.type === TokenType.FN) {
      this.advance(); // fn
      this.expect(TokenType.LPAREN, "expected '(' after fn");

      const params: TypeAnnotation[] = [];
      if (!this.check(TokenType.RPAREN)) {
        do {
          params.push(this.parseType());
        } while (this.match(TokenType.COMMA));
      }

      this.expect(TokenType.RPAREN, "expected ')' after fn params");
      this.expect(TokenType.RARROW, "expected '->' in fn type");
      const returnType = this.parseType();

      return { kind: "fn", params, returnType };
    }

    switch (tok.type) {
      case TokenType.TYPE_I32: this.advance(); return { kind: "i32" };
      case TokenType.TYPE_I64: this.advance(); return { kind: "i64" };
      case TokenType.TYPE_F64: this.advance(); return { kind: "f64" };
      case TokenType.TYPE_BOOL: this.advance(); return { kind: "bool" };
      case TokenType.TYPE_STRING: this.advance(); return { kind: "string" };
      case TokenType.TYPE_VOID: this.advance(); return { kind: "void" };
      case TokenType.TYPE_ANY: this.advance(); return { kind: "any" };
      default:
        break;
    }

    // [T] → 배열
    if (tok.type === TokenType.LBRACKET) {
      this.advance();
      const element = this.parseType();
      this.expect(TokenType.RBRACKET, "expected ']' for array type");
      return { kind: "array", element };
    }

    // channel<T>
    if (tok.type === TokenType.TYPE_CHANNEL) {
      this.advance();
      this.expect(TokenType.LT, "expected '<' after channel");
      const element = this.parseType();
      this.expect(TokenType.GT, "expected '>' for channel type");
      return { kind: "channel", element };
    }

    // Option<T>
    if (tok.type === TokenType.IDENT && tok.lexeme === "Option") {
      this.advance();
      this.expect(TokenType.LT, "expected '<' after Option");
      const element = this.parseType();
      this.expect(TokenType.GT, "expected '>' for Option type");
      return { kind: "option", element };
    }

    // Result<T, E>
    if (tok.type === TokenType.IDENT && tok.lexeme === "Result") {
      this.advance();
      this.expect(TokenType.LT, "expected '<' after Result");
      const ok = this.parseType();
      this.expect(TokenType.COMMA, "expected ',' in Result<T, E>");
      const err = this.parseType();
      this.expect(TokenType.GT, "expected '>' for Result type");
      return { kind: "result", ok, err };
    }

    // Struct type reference (custom type name)
    if (tok.type === TokenType.IDENT) {
      const name = tok.lexeme;
      this.advance();
      return { kind: "struct_ref", name };
    }

    this.error(`expected type, got ${tok.lexeme}`, tok);
    this.advance();
    return { kind: "i32" }; // fallback
  }

  // ============================================================
  // 유틸리티
  // ============================================================

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const tok = this.tokens[this.pos];
    if (!this.isAtEnd()) this.pos++;
    return tok;
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    const tok = this.peek();
    this.error(`${message} (got ${tok.type}: "${tok.lexeme}")`, tok);
    throw new Error(message);
  }

  private expectIdent(context: string): string {
    const tok = this.peek();
    if (tok.type === TokenType.IDENT) {
      this.advance();
      return tok.lexeme;
    }
    this.error(`expected ${context} (got ${tok.type}: "${tok.lexeme}")`, tok);
    throw new Error(`expected ${context}`);
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private isStmtStart(): boolean {
    const t = this.peek().type;
    return t === TokenType.VAR || t === TokenType.LET || t === TokenType.CONST ||
           t === TokenType.FN || t === TokenType.STRUCT || t === TokenType.IF || t === TokenType.MATCH ||
           t === TokenType.FOR || t === TokenType.WHILE || t === TokenType.BREAK || t === TokenType.CONTINUE ||
           t === TokenType.SPAWN || t === TokenType.RETURN;
  }

  private error(message: string, tok: Token): void {
    this.errors.push({ message, line: tok.line, col: tok.col });
  }

  private synchronize(): void {
    while (!this.isAtEnd()) {
      if (this.isStmtStart()) return;
      if (this.check(TokenType.RBRACE)) {
        this.advance();
        return;
      }
      this.advance();
    }
  }
}
