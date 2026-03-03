/**
 * FreeLang v2 Phase 5 - Minimal AST
 *
 * .free 파일 형식만 지원하는 축소된 AST
 *
 * 예시:
 *   @minimal
 *   fn sum
 *   input: array<number>
 *   output: number
 *   intent: "배열 합산"
 */

/**
 * Minimal Function AST
 *
 * .free 파일의 함수 선언을 나타내는 최소 구조
 *
 * Phase 5 Tasks:
 *   Task 1-3: 헤더만 (decorator, fnName, types, intent)
 *   Task 4: 본체 지원 (body 필드)
 */
export interface MinimalFunctionAST {
  // 선언 타입
  decorator?: 'minimal'; // @minimal 있으면 'minimal'

  // 함수 정보
  fnName: string;        // 함수명
  inputType: string;     // 입력 타입 (예: "array<number>")
  outputType: string;    // 출력 타입 (예: "number")

  // 의도 및 설명
  intent?: string;       // 의도 (예: "배열 합산")
  reason?: string;       // 추가 설명 (선택사항)

  // Phase 5 Task 4: 함수 본체 (선택사항)
  body?: string;         // 함수 본체 코드 (예: "return arr.reduce(...)")

  // 원본 정보
  source?: {
    line: number;
    column: number;
  };
}

/**
 * Parse error
 */
export class ParseError extends Error {
  constructor(
    public line: number,
    public column: number,
    message: string
  ) {
    super(`[${line}:${column}] ${message}`);
    this.name = 'ParseError';
  }
}

/**
 * Phase 2: Full AST Support
 * Task 2.1-2.3에서 필요한 완전한 AST 타입들
 */

// 표현식 (Expression)
export type Expression =
  | LiteralExpression
  | IdentifierExpression
  | BinaryOpExpression
  | CallExpression
  | ArrayExpression
  | MemberExpression
  | MatchExpression
  | LambdaExpression;

export interface LiteralExpression {
  type: 'literal';
  value: string | number | boolean;
  dataType: 'number' | 'string' | 'bool';
}

export interface IdentifierExpression {
  type: 'identifier';
  name: string;
}

export interface BinaryOpExpression {
  type: 'binary';
  operator: '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '>' | '<' | '>=' | '<=';
  left: Expression;
  right: Expression;
}

export interface CallExpression {
  type: 'call';
  callee: string;
  arguments: Expression[];
}

export interface ArrayExpression {
  type: 'array';
  elements: Expression[];
}

export interface MemberExpression {
  type: 'member';
  object: Expression;
  property: string;
}

/**
 * Phase 3 Step 3: Lambda Expression (Functions & Closures)
 * Supports anonymous functions with parameter types and closure capture
 */
export interface LambdaExpression {
  type: 'lambda';
  params: Parameter[];        // Parameter definitions
  paramTypes?: string[];      // Optional type annotations for params
  body: Expression;           // Lambda body expression
  returnType?: string;        // Optional return type annotation
  capturedVars?: string[];    // Variables captured from enclosing scope
}

/**
 * Phase 4 Step 1: Module System - Import/Export Support
 * Enables multi-file projects with type-safe imports and exports
 */

// Import specifier (what to import)
export interface ImportSpecifier {
  name: string;               // Original export name in source module
  alias?: string;             // Renamed as (optional)
}

// Import statement
export interface ImportStatement {
  type: 'import';
  imports: ImportSpecifier[];  // Named imports
  from: string;                // Module path (relative or absolute)
  isNamespace?: boolean;       // import * as name
  namespace?: string;          // Namespace name if isNamespace
}

// Export statement
export interface ExportStatement {
  type: 'export';
  declaration: FunctionStatement | VariableDeclaration;  // What to export
}

// Module (top-level container for a .fl file)
export interface Module {
  path: string;                // File path or module name
  imports: ImportStatement[];  // Import statements at top
  exports: ExportStatement[];  // Export statements
  statements: Statement[];     // Other statements (functions, variables, etc.)
}

/**
 * Phase 15: Pattern Matching
 * Rust 스타일의 match 표현식 지원
 */

// Pattern 타입 (5가지 패턴)
export type Pattern =
  | LiteralPattern
  | VariablePattern
  | WildcardPattern
  | StructPattern
  | ArrayPattern;

export interface LiteralPattern {
  type: 'literal';
  value: string | number | boolean;
}

export interface VariablePattern {
  type: 'variable';
  name: string;
}

export interface WildcardPattern {
  type: 'wildcard';
}

export interface StructPattern {
  type: 'struct';
  fields: Record<string, Pattern>;
}

export interface ArrayPattern {
  type: 'array';
  elements: Pattern[];
}

// Match arm (패턴 → 표현식)
export interface MatchArm {
  pattern: Pattern;
  guard?: Expression;  // if 조건 (선택사항)
  body: Expression;
}

// Match 표현식
export interface MatchExpression {
  type: 'match';
  scrutinee: Expression;  // 매칭할 값
  arms: MatchArm[];
}

// 문장 (Statement)
export type Statement =
  | ExpressionStatement
  | VariableDeclaration
  | IfStatement
  | ForStatement
  | ForOfStatement  // Phase 2: for...of loop support
  | WhileStatement
  | ReturnStatement
  | BlockStatement
  | ImportStatement  // Phase 4: Module System
  | ExportStatement; // Phase 4: Module System

export interface ExpressionStatement {
  type: 'expression';
  expression: Expression;
}

export interface VariableDeclaration {
  type: 'variable';
  name: string;
  varType?: string;
  value?: Expression;
  mutable?: boolean;  // Phase 16: let vs let mut
}

export interface IfStatement {
  type: 'if';
  condition: Expression;
  consequent: BlockStatement;
  alternate?: BlockStatement;
}

export interface ForStatement {
  type: 'for';
  variable: string;
  iterable: Expression;
  body: BlockStatement;
}

export interface ForOfStatement {
  type: 'forOf';  // Distinguish from 'for' (range-based)
  variable: string;
  variableType?: string;  // Phase 2: Optional type annotation
  iterable: Expression;
  body: BlockStatement;
  isLet?: boolean;  // Track if 'let' keyword was used
}

export interface WhileStatement {
  type: 'while';
  condition: Expression;
  body: BlockStatement;
}

export interface ReturnStatement {
  type: 'return';
  argument?: Expression;
}

export interface BlockStatement {
  type: 'block';
  body: Statement[];
}

// 함수 (FunctionStatement)
export interface FunctionStatement {
  type: 'function';
  name: string;
  params: Parameter[];
  returnType?: string;
  body: BlockStatement;
  intent?: string;
  source?: {
    line: number;
    column: number;
  };
}

export interface Parameter {
  name: string;
  paramType?: string;
}
