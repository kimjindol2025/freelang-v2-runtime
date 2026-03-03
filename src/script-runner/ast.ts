// FreeLang v4 — AST 노드 정의

// ============================================================
// 타입 표기 (Type Annotations)
// ============================================================

export type TypeAnnotation =
  | { kind: "i32" }
  | { kind: "i64" }
  | { kind: "f64" }
  | { kind: "bool" }
  | { kind: "string" }
  | { kind: "void" }
  | { kind: "any" }
  | { kind: "array"; element: TypeAnnotation }
  | { kind: "channel"; element: TypeAnnotation }
  | { kind: "option"; element: TypeAnnotation }
  | { kind: "result"; ok: TypeAnnotation; err: TypeAnnotation }
  | { kind: "struct_ref"; name: string }
  | { kind: "fn"; params: TypeAnnotation[]; returnType: TypeAnnotation };

// ============================================================
// 패턴 (Match Patterns) — SPEC_05 Q8: 7종
// ============================================================

export type Pattern =
  | { kind: "ident"; name: string }         // x → 바인딩
  | { kind: "literal"; value: Expr }         // 42, "hello", true
  | { kind: "ok"; inner: Pattern }           // Ok(v)
  | { kind: "err"; inner: Pattern }          // Err(e)
  | { kind: "some"; inner: Pattern }         // Some(v)
  | { kind: "none" }                         // None
  | { kind: "wildcard" };                    // _

export type MatchArm = {
  pattern: Pattern;
  body: Expr;
};

// ============================================================
// 식 (Expressions) — 값을 만든다
// ============================================================

export type FnParam = {
  name: string;
  type?: TypeAnnotation;
};

export type Expr =
  | { kind: "int_lit"; value: number; line: number; col: number }
  | { kind: "float_lit"; value: number; line: number; col: number }
  | { kind: "string_lit"; value: string; line: number; col: number }
  | { kind: "bool_lit"; value: boolean; line: number; col: number }
  | { kind: "ident"; name: string; line: number; col: number }
  | { kind: "binary"; op: string; left: Expr; right: Expr; line: number; col: number }
  | { kind: "unary"; op: string; operand: Expr; line: number; col: number }
  | { kind: "call"; callee: Expr; args: Expr[]; line: number; col: number }
  | { kind: "index"; object: Expr; index: Expr; line: number; col: number }
  | { kind: "field_access"; object: Expr; field: string; line: number; col: number }
  | { kind: "assign"; target: Expr; value: Expr; line: number; col: number }
  | { kind: "try"; operand: Expr; line: number; col: number }
  | { kind: "if_expr"; condition: Expr; then: Expr[]; else_: Expr[]; line: number; col: number }
  | { kind: "match_expr"; subject: Expr; arms: MatchArm[]; line: number; col: number }
  | { kind: "array_lit"; elements: Expr[]; line: number; col: number }
  | { kind: "struct_lit"; structName: string; fields: { name: string; value: Expr }[]; line: number; col: number }
  | { kind: "fn_lit"; params: FnParam[]; returnType?: TypeAnnotation; body: Expr; line: number; col: number }
  | { kind: "block_expr"; stmts: Stmt[]; expr: Expr | null; line: number; col: number };

// ============================================================
// 문 (Statements) — 값을 만들지 않는다
// ============================================================

export type Param = {
  name: string;
  type: TypeAnnotation;
};

export type StructField = {
  name: string;
  type: TypeAnnotation;
};

export type Stmt =
  | { kind: "var_decl"; name: string; mutable: boolean; type: TypeAnnotation | null; init: Expr; line: number; col: number }
  | { kind: "fn_decl"; name: string; params: Param[]; returnType: TypeAnnotation; body: Stmt[]; line: number; col: number }
  | { kind: "struct_decl"; name: string; fields: StructField[]; line: number; col: number }
  | { kind: "class_decl"; name: string; fields: StructField[]; line: number; col: number }
  | { kind: "use_decl"; module: string; alias: string; line: number; col: number }
  | { kind: "if_stmt"; condition: Expr; then: Stmt[]; else_: Stmt[] | null; line: number; col: number }
  | { kind: "match_stmt"; subject: Expr; arms: MatchArm[]; line: number; col: number }
  | { kind: "for_stmt"; variable: string; iterable: Expr; body: Stmt[]; line: number; col: number }
  | { kind: "for_of_stmt"; variable: string; iterable: Expr; body: Stmt[]; line: number; col: number }
  | { kind: "while_stmt"; condition: Expr; body: Stmt[]; line: number; col: number }
  | { kind: "break_stmt"; line: number; col: number }
  | { kind: "continue_stmt"; line: number; col: number }
  | { kind: "spawn_stmt"; body: Stmt[]; line: number; col: number }
  | { kind: "return_stmt"; value: Expr | null; line: number; col: number }
  | { kind: "expr_stmt"; expr: Expr; line: number; col: number };

// ============================================================
// 프로그램 (최상위)
// ============================================================

export type Program = {
  stmts: Stmt[];
};
