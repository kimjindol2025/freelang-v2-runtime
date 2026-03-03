/**
 * FreeLang v2 Phase 5 - Minimal Parser
 *
 * .free 파일 형식의 함수 선언만 파싱
 *
 * Phase 5 Task 1: One-line format (줄바꿈 생략)
 * Phase 5 Task 2: Type omission (타입 추론)
 * Phase 5 Task 3: Colon optional (콜론 제거 가능) ← NEW
 *
 * 지원 형식:
 *   [@minimal]                              <- optional decorator
 *   fn <name>
 *   input [: ] <type>                       <- 콜론 선택적
 *   output [: ] <type>                      <- 콜론 선택적
 *   [intent [: ] "<string>"]                <- 콜론 선택적
 *
 * 예시 (Task 3):
 *   @minimal
 *   fn sum
 *   input: array<number>
 *   output: number
 *   intent: "배열 합산"
 *
 *   fn sum
 *   input array<number>
 *   output number
 *   intent "배열 합산"
 *
 *   fn sum input array<number> output number intent "배열 합산"
 */
import { Token, TokenType } from '../lexer/token';
import { TokenBuffer } from '../lexer/lexer';
import {
  MinimalFunctionAST,
  ParseError,
  Expression,
  Pattern,
  MatchExpression,
  MatchArm,
  IdentifierExpression,
  LiteralExpression,
  BinaryOpExpression,
  CallExpression,
  ArrayExpression,
  LambdaExpression,  // Phase 3 Step 3: Lambda expressions
  LiteralPattern,
  VariablePattern,
  WildcardPattern,
  StructPattern,
  ArrayPattern,
  Statement,
  ExpressionStatement,
  VariableDeclaration,
  IfStatement,
  ForStatement,
  ForOfStatement,  // Phase 2: for...of loop support
  WhileStatement,
  ReturnStatement,
  BlockStatement,
  Parameter,  // Phase 3 Step 3: Lambda parameters
  ImportStatement,  // Phase 4 Step 2: Module System
  ImportSpecifier,  // Phase 4 Step 2: Module System
  ExportStatement,  // Phase 4 Step 2: Module System
  FunctionStatement  // Phase 4 Step 2: Function exports
} from './ast';

/**
 * Minimal Parser - .free 파일 형식만 파싱
 */
export class Parser {
  private tokens: TokenBuffer;

  constructor(tokens: TokenBuffer) {
    this.tokens = tokens;
  }

  /**
   * 현재 토큰 반환
   */
  private current(): Token {
    return this.tokens.current();
  }

  /**
   * 다음 토큰 반환
   */
  private peek(offset: number = 1): Token {
    return this.tokens.peek(offset);
  }

  /**
   * 다음 토큰으로 이동
   */
  private advance(): Token {
    return this.tokens.advance();
  }

  /**
   * 현재 토큰의 타입 확인
   */
  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  /**
   * 예상 토큰 확인 및 진행
   */
  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  /**
   * 예상 토큰 확인, 없으면 에러
   */
  private expect(type: TokenType, message?: string): Token {
    if (!this.check(type)) {
      const token = this.current();
      throw new ParseError(
        token.line,
        token.column,
        message || `Expected ${type}, got ${token.type}`
      );
    }
    const token = this.current();
    this.advance();
    return token;
  }

  /**
   * Phase 5 Stage 3: Detect function structure
   *
   * Heuristic: Current IDENT followed by input/output types → function
   * Used when 'fn' keyword is omitted
   *
   * Uses lookahead (peek) instead of backtracking since TokenBuffer
   * doesn't support seeking. Pattern detection:
   *   - IDENT (current, name)
   *   - INPUT or type-like IDENT (peek 1)
   *
   * Examples:
   *   - sum input array<number> → true (name + INPUT keyword)
   *   - calculate array number → true (name + type patterns)
   *   - process do { ... } → false (body immediately after name)
   */
  private detectFunctionStructure(): boolean {
    // Must start with IDENT (function name)
    if (!this.check(TokenType.IDENT)) {
      return false;
    }

    // Look ahead to see if this looks like a function signature
    const nextToken = this.peek(1);

    // Pattern 1: IDENT INPUT ... → definitely a function
    if (nextToken.type === TokenType.INPUT) {
      return true;
    }

    // Pattern 2: IDENT OUTPUT ... → possibly function (edge case)
    if (nextToken.type === TokenType.OUTPUT) {
      return true;
    }

    // Pattern 3: IDENT + type-like IDENT
    // Common type names that indicate function signature
    if (nextToken.type === TokenType.IDENT) {
      const nextVal = nextToken.value.toLowerCase();
      const typePatterns = [
        'array',
        'number',
        'string',
        'boolean',
        'bool',
        'int',
        'float',
        'any',
        'unknown'
      ];

      // Check if it looks like a type
      if (typePatterns.some(t => nextVal === t || nextVal.startsWith(t + '<'))) {
        return true;
      }
    }

    // Pattern 4: IDENT LBRACKET ... (array syntax [type])
    if (nextToken.type === TokenType.LBRACKET) {
      return true;
    }

    // Otherwise, doesn't look like a function signature
    return false;
  }

  /**
   * 파일 전체 파싱 (탑 레벨)
   *
   * Phase 5 Stage 3: Support optional 'fn' keyword
   * - If 'fn' present: use traditional parsing
   * - If 'fn' absent but structure matches: parse as function
   * - Otherwise: error
   */
  public parse(): MinimalFunctionAST {
    // Skip leading decorators or comments
    let decorator: string | undefined;

    // Check for @minimal decorator
    if (this.check(TokenType.AT)) {
      this.advance();
      if (this.check(TokenType.IDENT) && this.current().value === 'minimal') {
        decorator = 'minimal';
        this.advance();
      }
    }

    // Phase 5 Stage 3: Optional fn keyword
    if (this.check(TokenType.FN)) {
      // Traditional: fn keyword present
      this.advance();
    } else {
      // New: fn keyword absent - verify function structure
      if (!this.detectFunctionStructure()) {
        throw new ParseError(
          this.current().line,
          this.current().column,
          'Expected "fn" keyword or valid function structure (name + types)'
        );
      }
    }

    // Parse function name
    const nameToken = this.expect(TokenType.IDENT, 'Expected function name');
    const fnName = nameToken.value;

    // Phase 5 Stage 3: Parse input type with optional keyword
    // Support both:
    //   - input: type or input type (keyword present)
    //   - type (keyword absent, positional)
    let inputType: string;
    if (this.check(TokenType.INPUT)) {
      // Traditional: input keyword present
      this.advance();
      this.match(TokenType.COLON); // Colon optional (Phase 5 Task 3)
      inputType = this.parseOptionalType();
    } else {
      // New: input keyword absent, parse type directly
      inputType = this.parseOptionalType();
    }

    // Phase 5 Stage 3: Parse output type with optional keyword
    // Support both:
    //   - output: type or output type (keyword present)
    //   - type (keyword absent, positional)
    let outputType: string;
    if (this.check(TokenType.OUTPUT)) {
      // Traditional: output keyword present
      this.advance();
      this.match(TokenType.COLON); // Colon optional (Phase 5 Task 3)
      outputType = this.parseOptionalType();
    } else {
      // New: output keyword absent, parse type directly
      outputType = this.parseOptionalType();
    }

    // Parse optional intent
    let intent: string | undefined;
    if (this.check(TokenType.INTENT)) {
      this.advance();
      // Phase 5 Task 3: Colon optional
      this.match(TokenType.COLON);
      if (this.check(TokenType.STRING)) {
        intent = this.current().value;
        this.advance();
      } else if (this.check(TokenType.IDENT)) {
        // 문자열 없이 identifier로 나올 수도 있음
        intent = this.current().value;
        this.advance();
      }
    }

    // Phase 5 Task 4: Parse optional function body
    let body: string | undefined;
    if (this.check(TokenType.LBRACE)) {
      body = this.parseBody();
    }

    // Expect EOF (또는 선택적 - 기존 형식도 지원)
    if (this.check(TokenType.EOF)) {
      this.advance();
    }

    return {
      decorator: decorator as 'minimal' | undefined,
      fnName,
      inputType,
      outputType,
      intent,
      body
    };
  }

  /**
   * Phase 5 Task 4: 함수 본체 파싱
   *
   * 형식: { ... }
   *
   * 동작:
   *   1. LBRACE 만남 ({)
   *   2. 중괄호 깊이를 추적하며 토큰 수집
   *   3. RBRACE 만남 (})
   *   4. 본체 내용을 문자열로 반환
   *
   * 예시:
   *   { let x = 0; for i in 0..10 { x += i; } return x; }
   */
  private parseBody(): string {
    this.expect(TokenType.LBRACE, 'Expected "{"');

    const bodyTokens: string[] = [];
    let braceDepth = 1; // Opening brace이미 소비했으므로 1부터 시작

    while (braceDepth > 0 && !this.check(TokenType.EOF)) {
      if (this.check(TokenType.LBRACE)) {
        braceDepth++;
        bodyTokens.push('{');
        this.advance();
      } else if (this.check(TokenType.RBRACE)) {
        braceDepth--;
        if (braceDepth > 0) {
          bodyTokens.push('}');
        }
        this.advance();
      } else {
        // 모든 토큰을 문자열로 수집
        const token = this.current();
        bodyTokens.push(token.value || token.type);
        this.advance();
      }
    }

    if (braceDepth !== 0) {
      throw new ParseError(
        this.current().line,
        this.current().column,
        'Unclosed brace in function body'
      );
    }

    return bodyTokens.join(' ').trim();
  }

  /**
   * Phase 15: 표현식 파싱
   *
   * 기본 표현식들:
   *   - match 표현식
   *   - 리터럴 (숫자, 문자열, 불린)
   *   - 식별자
   *   - 함수 호출
   *   - 배열
   *   - 이항 연산
   */
  public parseExpression(): Expression {
    // match 표현식 확인
    if (this.check(TokenType.MATCH)) {
      return this.parseMatch();
    }

    // 기본 표현식 + 이항 연산
    return this.parseComparison();
  }

  /**
   * 이항 연산 파싱 (우선순위 순서)
   * 1. Comparison (==, !=, <, >, <=, >=)
   * 2. Additive (+, -)
   * 3. Multiplicative (*, /, %)
   */
  private parseComparison(): Expression {
    let left = this.parseAdditive();

    // 비교 연산자 처리 (==, !=, <, >, <=, >=)
    while (
      this.check(TokenType.EQ) ||
      this.check(TokenType.NE) ||
      this.check(TokenType.LT) ||
      this.check(TokenType.GT) ||
      this.check(TokenType.LE) ||
      this.check(TokenType.GE)
    ) {
      let operator: '==' | '!=' | '>' | '<' | '>=' | '<=' = '==';

      if (this.check(TokenType.EQ)) operator = '==';
      else if (this.check(TokenType.NE)) operator = '!=';
      else if (this.check(TokenType.LT)) operator = '<';
      else if (this.check(TokenType.GT)) operator = '>';
      else if (this.check(TokenType.LE)) operator = '<=';
      else if (this.check(TokenType.GE)) operator = '>=';

      this.advance();
      const right = this.parseAdditive();

      left = {
        type: 'binary',
        operator,
        left,
        right
      } as BinaryOpExpression;
    }

    return left;
  }

  /**
   * 덧셈/뺄셈 파싱 (+, -)
   */
  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();

    while (this.check(TokenType.PLUS) || this.check(TokenType.MINUS)) {
      let operator: '+' | '-' = '+';

      if (this.check(TokenType.PLUS)) operator = '+';
      else if (this.check(TokenType.MINUS)) operator = '-';

      this.advance();
      const right = this.parseMultiplicative();

      left = {
        type: 'binary',
        operator,
        left,
        right
      } as BinaryOpExpression;
    }

    return left;
  }

  /**
   * 곱셈/나눗셈/나머지 파싱 (*, /, %)
   */
  private parseMultiplicative(): Expression {
    let left = this.parsePrimaryExpression();

    while (
      this.check(TokenType.STAR) ||
      this.check(TokenType.SLASH) ||
      this.check(TokenType.PERCENT)
    ) {
      let operator: '*' | '/' | '%' = '*';

      if (this.check(TokenType.STAR)) operator = '*';
      else if (this.check(TokenType.SLASH)) operator = '/';
      else if (this.check(TokenType.PERCENT)) operator = '%';

      this.advance();
      const right = this.parsePrimaryExpression();

      left = {
        type: 'binary',
        operator,
        left,
        right
      } as BinaryOpExpression;
    }

    return left;
  }

  /**
   * Phase 15: 기본 표현식 파싱
   * (리터럴, 식별자, 배열, 함수 호출)
   */
  private parsePrimaryExpression(): Expression {
    const token = this.current();

    // 리터럴 (숫자, 문자열, 불린)
    if (this.check(TokenType.NUMBER)) {
      const value = parseFloat(token.value);
      this.advance();
      return {
        type: 'literal',
        value,
        dataType: 'number'
      } as LiteralExpression;
    }

    if (this.check(TokenType.STRING)) {
      const value = token.value;
      this.advance();
      return {
        type: 'literal',
        value,
        dataType: 'string'
      } as LiteralExpression;
    }

    // 불린 리터럴
    if (this.check(TokenType.TRUE) || this.check(TokenType.FALSE)) {
      const value = this.check(TokenType.TRUE);
      this.advance();
      return {
        type: 'literal',
        value,
        dataType: 'bool'
      } as LiteralExpression;
    }

    // null 리터럴
    if (this.check(TokenType.NULL)) {
      this.advance();
      return {
        type: 'literal',
        value: null,
        dataType: 'string'  // 단순 표현용
      } as any;
    }

    // 배열 리터럴 [...]
    if (this.check(TokenType.LBRACKET)) {
      this.advance(); // [
      const elements: Expression[] = [];

      while (!this.check(TokenType.RBRACKET) && !this.check(TokenType.EOF)) {
        elements.push(this.parseExpression());
        if (this.check(TokenType.COMMA)) {
          this.advance();
        }
      }

      this.expect(TokenType.RBRACKET, 'Expected "]"');
      return {
        type: 'array',
        elements
      } as ArrayExpression;
    }

    // 식별자 또는 함수 호출
    if (this.check(TokenType.IDENT)) {
      const name = token.value;
      this.advance();

      // 함수 호출 (...)
      if (this.check(TokenType.LPAREN)) {
        this.advance(); // (
        const args: Expression[] = [];

        while (!this.check(TokenType.RPAREN) && !this.check(TokenType.EOF)) {
          args.push(this.parseExpression());
          if (this.check(TokenType.COMMA)) {
            this.advance();
          }
        }

        this.expect(TokenType.RPAREN, 'Expected ")"');
        return {
          type: 'call',
          callee: name,
          arguments: args
        } as CallExpression;
      }

      // 단순 식별자
      return {
        type: 'identifier',
        name
      } as IdentifierExpression;
    }

    // Phase 3 Step 3: Lambda Expression
    // Format: fn(param1: type1, param2: type2) -> returnType -> body
    // or: fn(param1, param2) -> body
    if (this.check(TokenType.FN)) {
      return this.parseLambda();
    }

    throw new ParseError(
      token.line,
      token.column,
      `Unexpected token in expression: ${token.type}`
    );
  }

  /**
   * Phase 3 Step 3: Parse lambda expression
   * Format: fn(param1: type1, param2: type2) -> returnType -> body
   * or: fn(param1, param2) -> body
   */
  private parseLambda(): LambdaExpression {
    this.expect(TokenType.FN, 'Expected "fn"');
    this.expect(TokenType.LPAREN, 'Expected "(" after "fn"');

    // Parse parameters
    const params: Parameter[] = [];
    const paramTypes: string[] = [];

    while (!this.check(TokenType.RPAREN) && !this.check(TokenType.EOF)) {
      const paramName = this.expect(TokenType.IDENT, 'Expected parameter name').value;

      let paramType: string | undefined;
      if (this.match(TokenType.COLON)) {
        // Type annotation present
        paramType = this.parseType();
        paramTypes.push(paramType);
      } else {
        paramTypes.push('unknown');
      }

      params.push({
        name: paramName,
        paramType
      });

      if (this.check(TokenType.COMMA)) {
        this.advance();
      }
    }

    this.expect(TokenType.RPAREN, 'Expected ")" after parameters');

    // Parse optional return type
    let returnType: string | undefined;
    if (this.match(TokenType.ARROW)) {
      // This could be return type or body
      // Try to parse as type first
      if (this.check(TokenType.IDENT) || this.check(TokenType.LBRACKET)) {
        const typeStart = this.current();
        try {
          const possibleType = this.parseType();

          // If we see another arrow after the type, it's a return type annotation
          if (this.check(TokenType.ARROW)) {
            returnType = possibleType;
            this.advance(); // consume second arrow
          } else {
            // It was the body expression, not a type - we'll parse it below
            // For now, treat the first arrow as function body indicator
          }
        } catch (e) {
          // Not a valid type, treat arrow as function body indicator
        }
      }
    }

    // Parse body expression (must be present)
    const body = this.parseExpression();

    return {
      type: 'lambda',
      params,
      paramTypes: paramTypes.length > 0 ? paramTypes : undefined,
      body,
      returnType,
      capturedVars: []  // Will be filled by type checker
    } as LambdaExpression;
  }

  /**
   * Parse type annotation
   * Handles: number, string, bool, array<T>, fn(T)->U, etc.
   */
  private parseType(): string {
    if (!this.check(TokenType.IDENT) && !this.check(TokenType.LBRACKET)) {
      throw new ParseError(
        this.current().line,
        this.current().column,
        'Expected type annotation'
      );
    }

    let type = '';

    if (this.check(TokenType.LBRACKET)) {
      // Array type: [type] or array<type>
      this.advance(); // [
      type = '[' + this.parseType() + ']';
      this.expect(TokenType.RBRACKET, 'Expected "]"');
      return type;
    }

    // Parse identifier part
    type = this.expect(TokenType.IDENT, 'Expected type').value;

    // Handle generics: type<T, U>
    if (this.check(TokenType.LT)) {
      this.advance(); // <
      type += '<';

      while (!this.check(TokenType.GT) && !this.check(TokenType.EOF)) {
        type += this.parseType();
        if (this.check(TokenType.COMMA)) {
          this.advance();
          type += ', ';
        }
      }

      this.expect(TokenType.GT, 'Expected ">"');
      type += '>';
    }

    return type;
  }

  /**
   * Phase 15: Match 표현식 파싱
   *
   * 형식:
   *   match <scrutinee> {
   *     | <pattern> [if <guard>] → <body>
   *     | <pattern> [if <guard>] → <body>
   *     ...
   *   }
   */
  private parseMatch(): MatchExpression {
    // consume 'match'
    this.expect(TokenType.MATCH, 'Expected "match"');

    // Parse scrutinee (매칭할 값)
    const scrutinee = this.parseExpression();

    // Expect {
    this.expect(TokenType.LBRACE, 'Expected "{"');

    const arms: MatchArm[] = [];

    // Parse match arms
    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      // Pipe 토큰 (| - BIT_OR로 토큰화됨)
      if (this.check(TokenType.BIT_OR)) {
        this.advance();
      }

      // Pattern 파싱
      const pattern = this.parsePattern();

      // Guard 파싱 (if 조건)
      let guard: Expression | undefined;
      if (this.check(TokenType.IF)) {
        this.advance();
        guard = this.parseExpression();
      }

      // Arrow (=> FAT_ARROW)
      if (this.check(TokenType.FAT_ARROW)) {
        this.advance();
      } else {
        throw new ParseError(
          this.current().line,
          this.current().column,
          'Expected "=>" in match arm'
        );
      }

      // Body 파싱
      const body = this.parseExpression();

      arms.push({ pattern, guard, body });

      // Optional comma
      if (this.check(TokenType.COMMA)) {
        this.advance();
      }
    }

    this.expect(TokenType.RBRACE, 'Expected "}"');

    return {
      type: 'match',
      scrutinee,
      arms
    };
  }

  /**
   * Phase 15: Pattern 파싱
   *
   * 지원하는 패턴:
   *   - 리터럴: 1, 2.5, "string", true
   *   - 와일드카드: _
   *   - 변수 바인딩: x, count, value
   *   - 구조체: {field1: pattern1, field2: pattern2}
   *   - 배열: [pattern1, pattern2, ...]
   */
  private parsePattern(): Pattern {
    const token = this.current();

    // 와일드카드 _
    if (this.check(TokenType.IDENT) && token.value === '_') {
      this.advance();
      return { type: 'wildcard' } as WildcardPattern;
    }

    // 리터럴
    if (this.check(TokenType.NUMBER)) {
      const value = parseFloat(token.value);
      this.advance();
      return {
        type: 'literal',
        value
      } as LiteralPattern;
    }

    if (this.check(TokenType.STRING)) {
      const value = token.value;
      this.advance();
      return {
        type: 'literal',
        value
      } as LiteralPattern;
    }

    // 불린 리터럴
    if (this.check(TokenType.TRUE) || this.check(TokenType.FALSE)) {
      const value = this.check(TokenType.TRUE);
      this.advance();
      return {
        type: 'literal',
        value
      } as LiteralPattern;
    }

    // 배열 패턴 [...]
    if (this.check(TokenType.LBRACKET)) {
      this.advance(); // [
      const elements: Pattern[] = [];

      while (!this.check(TokenType.RBRACKET) && !this.check(TokenType.EOF)) {
        elements.push(this.parsePattern());
        if (this.check(TokenType.COMMA)) {
          this.advance();
        }
      }

      this.expect(TokenType.RBRACKET, 'Expected "]"');
      return {
        type: 'array',
        elements
      } as ArrayPattern;
    }

    // 구조체 패턴 {...} 또는 변수 바인딩
    if (this.check(TokenType.LBRACE)) {
      this.advance(); // {

      const fields: Record<string, Pattern> = {};
      let isStruct = false;

      // 필드가 있는지 확인
      if (!this.check(TokenType.RBRACE)) {
        const firstToken = this.current();

        // field: pattern 형식 확인
        if (this.check(TokenType.IDENT) && this.peek(1).type === TokenType.COLON) {
          isStruct = true;

          while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
            const fieldName = this.expect(TokenType.IDENT, 'Expected field name').value;
            this.expect(TokenType.COLON, 'Expected ":"');
            const fieldPattern = this.parsePattern();
            fields[fieldName] = fieldPattern;

            if (this.check(TokenType.COMMA)) {
              this.advance();
            }
          }
        }
      }

      this.expect(TokenType.RBRACE, 'Expected "}"');

      if (isStruct) {
        return {
          type: 'struct',
          fields
        } as StructPattern;
      }
    }

    // 변수 바인딩 (식별자)
    if (this.check(TokenType.IDENT)) {
      const name = token.value;
      this.advance();
      return {
        type: 'variable',
        name
      } as VariablePattern;
    }

    throw new ParseError(
      token.line,
      token.column,
      `Unexpected token in pattern: ${token.type}`
    );
  }

  /**
   * Phase 16: Statement 파싱 (변수 선언, if, for 등)
   *
   * 지원하는 문장:
   *   - let 변수 선언
   *   - let mut 가변 변수 선언
   *   - if 조건문
   *   - for 반복문
   *   - while 반복문
   *   - return 반환문
   *   - 표현식 문장
   */
  public parseStatement(): Statement {
    // Phase 4 Step 2: import 문
    if (this.check(TokenType.IMPORT)) {
      return this.parseImportStatement();
    }

    // Phase 4 Step 2: export 문
    if (this.check(TokenType.EXPORT)) {
      return this.parseExportStatement();
    }

    // let 변수 선언
    if (this.check(TokenType.LET)) {
      return this.parseVariableDeclaration();
    }

    // if 문
    if (this.check(TokenType.IF)) {
      return this.parseIfStatement();
    }

    // for 문
    if (this.check(TokenType.FOR)) {
      return this.parseForStatement();
    }

    // while 문
    if (this.check(TokenType.WHILE)) {
      return this.parseWhileStatement();
    }

    // return 문
    if (this.check(TokenType.RETURN)) {
      return this.parseReturnStatement();
    }

    // 블록 문
    if (this.check(TokenType.LBRACE)) {
      return this.parseBlockStatement();
    }

    // 표현식 문장
    const expr = this.parseExpression();
    return {
      type: 'expression',
      expression: expr
    } as ExpressionStatement;
  }

  /**
   * Phase 16: 변수 선언 파싱
   *
   * 형식:
   *   let x = 10
   *   let mut y = 20
   *   let name: string = "Alice"
   *   let mut count: number = 0
   */
  private parseVariableDeclaration(): VariableDeclaration {
    this.expect(TokenType.LET, 'Expected "let"');

    // 가변성 검사 (let mut)
    let mutable = false;
    if (this.check(TokenType.MUT)) {
      mutable = true;
      this.advance();
    }

    // 변수 이름
    const nameToken = this.expect(TokenType.IDENT, 'Expected variable name');
    const name = nameToken.value;

    // 선택적 타입 어노테이션 (: type)
    let varType: string | undefined;
    if (this.check(TokenType.COLON)) {
      this.advance();
      varType = this.parseType();
    }

    // 선택적 초기값 (= value)
    let value: Expression | undefined;
    if (this.check(TokenType.ASSIGN)) {
      this.advance();
      value = this.parseExpression();
    }

    // 선택적 세미콜론
    this.match(TokenType.SEMICOLON);

    return {
      type: 'variable',
      name,
      varType,
      value,
      mutable
    };
  }

  /**
   * Phase 16: If 문 파싱
   */
  private parseIfStatement(): IfStatement {
    this.expect(TokenType.IF, 'Expected "if"');
    const condition = this.parseExpression();

    const consequent = this.parseBlockStatement();

    let alternate: BlockStatement | undefined;
    if (this.check(TokenType.ELSE)) {
      this.advance();
      alternate = this.parseBlockStatement();
    }

    return {
      type: 'if',
      condition,
      consequent,
      alternate
    };
  }

  /**
   * Phase 2: For/ForOf 문 파싱
   *
   * 지원 형식:
   *   - for i in range(10) { ... }           (전통적)
   *   - for i of array { ... }               (for...of)
   *   - for let i of array { ... }           (명시적 let)
   *   - for (let i of array) { ... }         (괄호 포함)
   *
   * 구현:
   *   - in 키워드: ForStatement (범위 반복)
   *   - of 키워드: ForOfStatement (배열 요소 반복)
   */
  private parseForStatement(): ForStatement | ForOfStatement {
    this.expect(TokenType.FOR, 'Expected "for"');

    // 선택적 괄호: for (
    const hasParens = this.match(TokenType.LPAREN);

    // 선택적 let 키워드: for [let] i
    const isLet = this.match(TokenType.LET);

    // 변수 이름: for i
    const variable = this.expect(TokenType.IDENT, 'Expected loop variable').value;

    // 선택적 타입 어노테이션: for i: array<string>
    let variableType: string | undefined;
    if (this.check(TokenType.COLON)) {
      this.advance();
      variableType = this.parseType();
    }

    // 구분: in vs of
    if (this.match(TokenType.IN)) {
      // Traditional for...in loop (range-based)
      const iterable = this.parseExpression();

      if (hasParens) {
        this.expect(TokenType.RPAREN, 'Expected ")"');
      }

      const body = this.parseBlockStatement();

      return {
        type: 'for',
        variable,
        iterable,
        body
      };
    } else if (this.match(TokenType.OF)) {
      // for...of loop (array iteration)
      const iterable = this.parseExpression();

      if (hasParens) {
        this.expect(TokenType.RPAREN, 'Expected ")"');
      }

      const body = this.parseBlockStatement();

      return {
        type: 'forOf',
        variable,
        variableType,
        iterable,
        body,
        isLet
      };
    } else {
      throw new ParseError(
        this.current().line,
        this.current().column,
        'Expected "in" or "of" in for statement'
      );
    }
  }

  /**
   * Phase 16: While 문 파싱
   */
  private parseWhileStatement(): WhileStatement {
    this.expect(TokenType.WHILE, 'Expected "while"');
    const condition = this.parseExpression();
    const body = this.parseBlockStatement();

    return {
      type: 'while',
      condition,
      body
    };
  }

  /**
   * Phase 16: Return 문 파싱
   */
  private parseReturnStatement(): ReturnStatement {
    this.expect(TokenType.RETURN, 'Expected "return"');

    let argument: Expression | undefined;
    if (!this.check(TokenType.SEMICOLON) && !this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      argument = this.parseExpression();
    }

    this.match(TokenType.SEMICOLON);

    return {
      type: 'return',
      argument
    };
  }

  /**
   * Phase 16: 블록 문 파싱 { ... }
   */
  private parseBlockStatement(): BlockStatement {
    this.expect(TokenType.LBRACE, 'Expected "{"');

    const body: Statement[] = [];
    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      body.push(this.parseStatement());
    }

    this.expect(TokenType.RBRACE, 'Expected "}"');

    return {
      type: 'block',
      body
    };
  }

  /**
   * 선택적 타입 파싱 (Phase 5)
   *
   * 타입을 생략할 수 있으며, 이 경우 intent에서 추론
   * 예:
   *   - input: array<number>    → "array<number>" 반환
   *   - input: array            → "array" 반환
   *   - input: result           → "result" 반환
   *   - input: (output 바로)    → "" 반환 (타입 생략)
   *   - input: (본체 바로)       → "" 반환 (Phase 5 Task 4)
   */
  private parseOptionalType(): string {
    // intent, output, 본체({), 또는 EOF를 만나면 타입 생략
    // Phase 5 Task 4: LBRACE는 함수 본체의 시작
    if (
      this.check(TokenType.INTENT) ||
      this.check(TokenType.OUTPUT) ||
      this.check(TokenType.INPUT) ||
      this.check(TokenType.LBRACE) ||
      this.check(TokenType.EOF)
    ) {
      return ''; // 타입 생략됨
    }

    // 타입이 있으면 파싱
    return this.parseType();
  }

  /**
   * 타입 파싱 (array<number>, number, string 등)
   *
   * 형식:
   *   - IDENT                     : number, string, bool, int
   *   - IDENT < TYPE >            : array<number>, map<string, number>
   *   - IDENT < TYPE , TYPE ... > : 제네릭 타입
   *   - IDENT < IDENT < TYPE > >  : nested generics (Phase 4.5+)
   *
   * Phase 4.5에서 TokenBuffer가 SHR >> 토큰을 2개 GT > 토큰으로 자동 분해하므로
   * nested generics (array<array<number>>) 완벽 지원 ✅
   */

  /**
   * Phase 4 Step 2: Import 문 파싱
   *
   * 형식:
   *   import { add, multiply } from "./math.fl"
   *   import { add as sum } from "./math.fl"
   *   import * as math from "./math.fl"
   *   import "./config.fl"
   */
  private parseImportStatement(): ImportStatement {
    this.expect(TokenType.IMPORT, 'Expected "import"');

    let imports: ImportSpecifier[] = [];
    let isNamespace = false;
    let namespace: string | undefined;

    // import * as name 형식
    if (this.check(TokenType.STAR)) {
      this.advance();  // * 소비
      this.expect(TokenType.AS, 'Expected "as" after "*"');
      namespace = this.expect(TokenType.IDENT, 'Expected namespace name').value;
      isNamespace = true;
    }
    // import { name1, name2, ... } 형식
    else if (this.check(TokenType.LBRACE)) {
      this.advance();  // { 소비

      while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
        // 임포트할 이름
        const nameToken = this.expect(TokenType.IDENT, 'Expected import name');
        const name = nameToken.value;

        let alias: string | undefined;

        // as로 별칭 제공
        if (this.check(TokenType.AS)) {
          this.advance();
          const aliasToken = this.expect(TokenType.IDENT, 'Expected alias name');
          alias = aliasToken.value;
        }

        imports.push({ name, alias });

        // 다음 항목이 있으면 쉼표 필요
        if (!this.check(TokenType.RBRACE)) {
          this.expect(TokenType.COMMA, 'Expected "," between imports');
        }
      }

      this.expect(TokenType.RBRACE, 'Expected "}"');
    }

    // from 키워드와 모듈 경로
    this.expect(TokenType.FROM, 'Expected "from"');
    const fromToken = this.expect(TokenType.STRING, 'Expected module path');
    const from = fromToken.value;

    return {
      type: 'import',
      imports,
      from,
      isNamespace,
      namespace
    };
  }

  /**
   * Phase 4 Step 2: Export 문 파싱
   *
   * 형식:
   *   export fn add(a: number, b: number) -> number { ... }
   *   export let PI = 3.14159
   *   export let VERSION = "1.0"
   */
  private parseExportStatement(): ExportStatement {
    this.expect(TokenType.EXPORT, 'Expected "export"');

    let declaration: FunctionStatement | VariableDeclaration;

    // export fn ... 형식
    if (this.check(TokenType.FN)) {
      this.advance();  // fn 소비

      // 함수 이름
      const nameToken = this.expect(TokenType.IDENT, 'Expected function name');
      const fnName = nameToken.value;

      // 매개변수 파싱
      this.expect(TokenType.LPAREN, 'Expected "("');
      const params = this.parseParameters();
      this.expect(TokenType.RPAREN, 'Expected ")"');

      // 반환 타입 (선택적)
      let returnType: string | undefined;
      if (this.check(TokenType.ARROW)) {
        this.advance();
        returnType = this.parseType();
      }

      // 함수 본체
      const body = this.parseBlockStatement();

      declaration = {
        type: 'function',
        name: fnName,
        params,
        returnType,
        body
      };
    }
    // export let ... 형식
    else if (this.check(TokenType.LET)) {
      this.advance();  // let 소비

      // 변수 이름
      const nameToken = this.expect(TokenType.IDENT, 'Expected variable name');
      const varName = nameToken.value;

      let varType: string | undefined;
      let value: Expression | undefined;

      // 타입 표기법 (선택적)
      if (this.check(TokenType.COLON)) {
        this.advance();
        varType = this.parseType();
      }

      // 초기값 (선택적)
      if (this.check(TokenType.ASSIGN)) {
        this.advance();
        value = this.parseExpression();
      }

      declaration = {
        type: 'variable',
        name: varName,
        varType,
        value
      };
    } else {
      throw new ParseError(
        this.current().line,
        this.current().column,
        'Expected function or variable declaration after "export"'
      );
    }

    return {
      type: 'export',
      declaration
    };
  }

  /**
   * Phase 3: 매개변수 파싱
   * 형식: (x, y: number, z: string)
   */
  private parseParameters(): Parameter[] {
    const params: Parameter[] = [];

    while (!this.check(TokenType.RPAREN) && !this.check(TokenType.EOF)) {
      const nameToken = this.expect(TokenType.IDENT, 'Expected parameter name');
      const name = nameToken.value;

      let paramType: string | undefined;

      // 타입 표기법 (선택적)
      if (this.check(TokenType.COLON)) {
        this.advance();
        paramType = this.parseType();
      }

      params.push({ name, paramType });

      // 다음 매개변수가 있으면 쉼표 필요
      if (!this.check(TokenType.RPAREN)) {
        this.expect(TokenType.COMMA, 'Expected "," between parameters');
      }
    }

    return params;
  }
}

/**
 * Parse wrapper - 편리한 파싱 진입점
 *
 * 사용법:
 *   const ast = parseMinimalFunction(tokenBuffer);
 */
export function parseMinimalFunction(tokens: TokenBuffer): MinimalFunctionAST {
  const parser = new Parser(tokens);
  return parser.parse();
}
