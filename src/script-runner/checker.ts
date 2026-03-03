// FreeLang v4 — TypeChecker (SPEC_06, 07, 08 구현)
// 정적 타입 검사 + Move/Copy 추적 + 스코프 관리

import { Program, Stmt, Expr, TypeAnnotation, Pattern, MatchArm, Param } from "./ast";

// ============================================================
// 내부 타입 표현
// ============================================================

export type Type =
  | { kind: "i32" }
  | { kind: "i64" }
  | { kind: "f64" }
  | { kind: "bool" }
  | { kind: "string" }
  | { kind: "void" }
  | { kind: "any" }
  | { kind: "array"; element: Type }
  | { kind: "channel"; element: Type }
  | { kind: "option"; element: Type }
  | { kind: "result"; ok: Type; err: Type }
  | { kind: "struct"; fields: Map<string, Type> }
  | { kind: "fn"; params: Type[]; returnType: Type }
  | { kind: "unknown" };

// ============================================================
// CheckError — SPEC_06 Q9: 14종 에러
// ============================================================

export type CheckError = {
  message: string;
  line: number;
  col: number;
};

// ============================================================
// 변수 정보
// ============================================================

type VarInfo = {
  type: Type;
  mutable: boolean;
  moved: boolean;     // Move 타입이 이동됐는지 (SPEC_07)
  line: number;
  col: number;
};

// ============================================================
// 함수 정보
// ============================================================

type FnInfo = {
  params: { name: string; type: Type }[];
  returnType: Type;
};

// ============================================================
// 스코프 (SPEC_08: 3종 — global, function, block)
// ============================================================

class Scope {
  vars: Map<string, VarInfo> = new Map();
  parent: Scope | null;

  constructor(parent: Scope | null) {
    this.parent = parent;
  }

  define(name: string, info: VarInfo): void {
    this.vars.set(name, info);
  }

  lookup(name: string): VarInfo | null {
    const v = this.vars.get(name);
    if (v) return v;
    if (this.parent) return this.parent.lookup(name);
    return null;
  }
}

// ============================================================
// Copy vs Move (SPEC_07 Q2)
// ============================================================

function isCopyType(t: Type): boolean {
  switch (t.kind) {
    case "i32":
    case "i64":
    case "f64":
    case "bool":
    case "string":  // string은 immutable이므로 Copy (SPEC_06 Q8)
      return true;
    case "option":
      return isCopyType(t.element);
    case "result":
      return isCopyType(t.ok) && isCopyType(t.err);
    case "array":
    case "channel":
    case "struct":
    case "fn":
      return false; // Move 타입 (함수도 Move 타입)
    default:
      return true;
  }
}

// ============================================================
// 타입 동등 비교 (구조적 — SPEC_06 Q7)
// ============================================================

function typesEqual(a: Type, b: Type): boolean {
  // any 타입은 모든 타입과 같음
  if (a.kind === "any" || b.kind === "any") return true;
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "i32": case "i64": case "f64": case "bool": case "string": case "void": case "unknown":
      return true;
    case "array":
      return typesEqual(a.element, (b as any).element);
    case "channel":
      return typesEqual(a.element, (b as any).element);
    case "option":
      return typesEqual(a.element, (b as any).element);
    case "result":
      return typesEqual(a.ok, (b as any).ok) && typesEqual(a.err, (b as any).err);
    case "struct": {
      const bStruct = b as { kind: "struct"; fields: Map<string, Type> };
      if (a.fields.size !== bStruct.fields.size) return false;
      for (const [k, v] of a.fields) {
        const bv = bStruct.fields.get(k);
        if (!bv || !typesEqual(v, bv)) return false;
      }
      return true;
    }
    case "fn": {
      const bFn = b as { kind: "fn"; params: Type[]; returnType: Type };
      if (a.params.length !== bFn.params.length) return false;
      for (let i = 0; i < a.params.length; i++) {
        if (!typesEqual(a.params[i], bFn.params[i])) return false;
      }
      return typesEqual(a.returnType, bFn.returnType);
    }
    default:
      return false;
  }
}

function typeToString(t: Type): string {
  switch (t.kind) {
    case "i32": case "i64": case "f64": case "bool": case "string": case "void":
      return t.kind;
    case "array": return `[${typeToString(t.element)}]`;
    case "channel": return `channel<${typeToString(t.element)}>`;
    case "option": return `Option<${typeToString(t.element)}>`;
    case "result": return `Result<${typeToString(t.ok)}, ${typeToString(t.err)}>`;
    case "struct": {
      const fields = [...t.fields.entries()].map(([k, v]) => `${k}: ${typeToString(v)}`).join(", ");
      return `{ ${fields} }`;
    }
    case "fn": {
      const paramStr = t.params.map(typeToString).join(", ");
      return `fn(${paramStr}) -> ${typeToString(t.returnType)}`;
    }
    case "unknown": return "unknown";
  }
}

function annotationToType(a: TypeAnnotation, structDefs: Map<string, Type> = new Map()): Type {
  switch (a.kind) {
    case "i32": return { kind: "i32" };
    case "i64": return { kind: "i64" };
    case "f64": return { kind: "f64" };
    case "bool": return { kind: "bool" };
    case "string": return { kind: "string" };
    case "void": return { kind: "void" };
    case "any": return { kind: "any" };
    case "array": return { kind: "array", element: annotationToType(a.element, structDefs) };
    case "channel": return { kind: "channel", element: annotationToType(a.element, structDefs) };
    case "option": return { kind: "option", element: annotationToType(a.element, structDefs) };
    case "result": return { kind: "result", ok: annotationToType(a.ok, structDefs), err: annotationToType(a.err, structDefs) };
    case "struct_ref": {
      const structType = structDefs.get(a.name);
      return structType || { kind: "unknown" };
    }
    case "fn": {
      const params = a.params.map(p => annotationToType(p, structDefs));
      const returnType = annotationToType(a.returnType, structDefs);
      return { kind: "fn", params, returnType };
    }
  }
}

// ============================================================
// TypeChecker
// ============================================================

export class TypeChecker {
  private errors: CheckError[] = [];
  private functions: Map<string, FnInfo> = new Map();
  private structs: Map<string, Type> = new Map(); // struct 정의 저장소
  private scope: Scope;
  private currentReturnType: Type | null = null;

  constructor() {
    this.scope = new Scope(null); // global scope
  }

  check(program: Program): CheckError[] {
    // Pass 1: struct/class 정의 등록
    for (const stmt of program.stmts) {
      if (stmt.kind === "struct_decl") {
        this.registerStruct(stmt);
      } else if (stmt.kind === "class_decl") {
        // class를 struct로 간주
        this.registerStruct(stmt as any);
      }
    }

    // Pass 2: 함수 전방참조 등록 (SPEC_08 Q5)
    for (const stmt of program.stmts) {
      if (stmt.kind === "fn_decl") {
        this.registerFunction(stmt);
      }
    }

    // Pass 3: 본문 검사
    for (const stmt of program.stmts) {
      this.checkStmt(stmt);
    }

    return this.errors;
  }

  private registerFunction(stmt: Stmt & { kind: "fn_decl" }): void {
    const params = stmt.params.map((p) => ({
      name: p.name,
      type: annotationToType(p.type, this.structs),
    }));
    const returnType = annotationToType(stmt.returnType, this.structs);

    if (this.functions.has(stmt.name)) {
      this.error(`function '${stmt.name}' already declared`, stmt.line, stmt.col);
      return;
    }

    this.functions.set(stmt.name, { params, returnType });
  }

  private registerStruct(stmt: Stmt & { kind: "struct_decl" }): void {
    const fields = new Map<string, Type>();
    for (const field of stmt.fields) {
      const fieldType = annotationToType(field.type, this.structs);
      fields.set(field.name, fieldType);
    }

    if (this.structs.has(stmt.name)) {
      this.error(`struct '${stmt.name}' already declared`, stmt.line, stmt.col);
      return;
    }

    this.structs.set(stmt.name, { kind: "struct", fields });
  }

  // ============================================================
  // 문 검사
  // ============================================================

  private checkStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case "var_decl":
        return this.checkVarDecl(stmt);
      case "fn_decl":
        return this.checkFnDecl(stmt);
      case "struct_decl":
        return; // struct는 Pass 1에서 이미 등록됨
      case "class_decl":
        return; // class는 Pass 1에서 struct로 등록됨
      case "use_decl":
        return; // use 문은 무시 (타입 체크 단계에서 처리 안 함)
      case "if_stmt":
        return this.checkIfStmt(stmt);
      case "match_stmt":
        return this.checkMatchStmt(stmt);
      case "for_stmt":
        return this.checkForStmt(stmt);
      case "for_of_stmt":
        return this.checkForOfStmt(stmt);
      case "while_stmt":
        return this.checkWhileStmt(stmt);
      case "break_stmt":
        return this.checkBreakStmt(stmt);
      case "continue_stmt":
        return this.checkContinueStmt(stmt);
      case "spawn_stmt":
        return this.checkSpawnStmt(stmt);
      case "return_stmt":
        return this.checkReturnStmt(stmt);
      case "expr_stmt":
        return this.checkExprStmt(stmt);
    }
  }

  private checkVarDecl(stmt: Stmt & { kind: "var_decl" }): void {
    const initType = this.checkExpr(stmt.init);

    let declType: Type;
    if (stmt.type) {
      declType = annotationToType(stmt.type, this.structs);
      if (!typesEqual(declType, initType) && initType.kind !== "unknown") {
        this.error(
          `type mismatch: declared ${typeToString(declType)}, got ${typeToString(initType)}`,
          stmt.line, stmt.col,
        );
      }
    } else {
      // 타입 추론 (SPEC_06 Q3)
      declType = initType;
    }

    // void 변수 금지 (SPEC_06 Q9)
    if (declType.kind === "void") {
      this.error("cannot declare variable of type void", stmt.line, stmt.col);
      return;
    }

    // 스코프에 등록
    if (this.scope.vars.has(stmt.name)) {
      // 섀도잉 허용 (SPEC_08 Q4) — 같은 스코프에서도 재선언 가능
    }

    this.scope.define(stmt.name, {
      type: declType,
      mutable: stmt.mutable,
      moved: false,
      line: stmt.line,
      col: stmt.col,
    });
  }

  private checkFnDecl(stmt: Stmt & { kind: "fn_decl" }): void {
    const fnInfo = this.functions.get(stmt.name);
    if (!fnInfo) return;

    // 새 스코프
    const prevScope = this.scope;
    this.scope = new Scope(prevScope);

    const prevReturn = this.currentReturnType;
    this.currentReturnType = fnInfo.returnType;

    // 매개변수 등록
    for (const p of fnInfo.params) {
      this.scope.define(p.name, {
        type: p.type,
        mutable: false, // 매개변수는 immutable (SPEC_08)
        moved: false,
        line: stmt.line,
        col: stmt.col,
      });
    }

    // 본문 검사
    for (const s of stmt.body) {
      this.checkStmt(s);
    }

    this.currentReturnType = prevReturn;
    this.scope = prevScope;
  }

  private checkIfStmt(stmt: Stmt & { kind: "if_stmt" }): void {
    const condType = this.checkExpr(stmt.condition);
    if (condType.kind !== "bool" && condType.kind !== "unknown") {
      this.error(
        `if condition must be bool, got ${typeToString(condType)}`,
        stmt.line, stmt.col,
      );
    }

    // then 블록
    const prevScope = this.scope;
    this.scope = new Scope(prevScope);
    for (const s of stmt.then) this.checkStmt(s);
    this.scope = prevScope;

    // else 블록
    if (stmt.else_) {
      const prevScope2 = this.scope;
      this.scope = new Scope(prevScope2);
      for (const s of stmt.else_) this.checkStmt(s);
      this.scope = prevScope2;
    }
  }

  private checkMatchStmt(stmt: Stmt & { kind: "match_stmt" }): void {
    const subjectType = this.checkExpr(stmt.subject);
    for (const arm of stmt.arms) {
      this.checkMatchArm(arm, subjectType);
    }
  }

  private checkMatchArm(arm: MatchArm, subjectType: Type): void {
    const prevScope = this.scope;
    this.scope = new Scope(prevScope);

    this.checkPattern(arm.pattern, subjectType);
    this.checkExpr(arm.body);

    this.scope = prevScope;
  }

  private checkPattern(pattern: Pattern, expectedType: Type): void {
    switch (pattern.kind) {
      case "ident":
        // 바인딩 — 새 변수 생성
        this.scope.define(pattern.name, {
          type: expectedType,
          mutable: false,
          moved: false,
          line: 0, col: 0,
        });
        break;
      case "wildcard":
        break;
      case "none":
        if (expectedType.kind !== "option" && expectedType.kind !== "unknown") {
          this.error(`None pattern on non-Option type ${typeToString(expectedType)}`, 0, 0);
        }
        break;
      case "some":
        if (expectedType.kind === "option") {
          this.checkPattern(pattern.inner, expectedType.element);
        } else if (expectedType.kind !== "unknown") {
          this.error(`Some pattern on non-Option type ${typeToString(expectedType)}`, 0, 0);
        }
        break;
      case "ok":
        if (expectedType.kind === "result") {
          this.checkPattern(pattern.inner, expectedType.ok);
        } else if (expectedType.kind !== "unknown") {
          this.error(`Ok pattern on non-Result type ${typeToString(expectedType)}`, 0, 0);
        }
        break;
      case "err":
        if (expectedType.kind === "result") {
          this.checkPattern(pattern.inner, expectedType.err);
        } else if (expectedType.kind !== "unknown") {
          this.error(`Err pattern on non-Result type ${typeToString(expectedType)}`, 0, 0);
        }
        break;
      case "literal":
        // 리터럴 타입은 checkExpr에서 확인
        this.checkExpr(pattern.value);
        break;
    }
  }

  private checkForStmt(stmt: Stmt & { kind: "for_stmt" }): void {
    const iterType = this.checkExpr(stmt.iterable);

    // iterable은 array여야 함
    let elemType: Type = { kind: "unknown" };
    if (iterType.kind === "array") {
      elemType = iterType.element;
    } else if (iterType.kind !== "unknown") {
      this.error(`for...in requires array, got ${typeToString(iterType)}`, stmt.line, stmt.col);
    }

    // 루프 스코프
    const prevScope = this.scope;
    this.scope = new Scope(prevScope);

    // 루프 변수 (immutable — SPEC_08 Q6)
    this.scope.define(stmt.variable, {
      type: elemType,
      mutable: false,
      moved: false,
      line: stmt.line,
      col: stmt.col,
    });

    for (const s of stmt.body) this.checkStmt(s);
    this.scope = prevScope;
  }

  private checkForOfStmt(stmt: Stmt & { kind: "for_of_stmt" }): void {
    const iterType = this.checkExpr(stmt.iterable);

    // iterable은 array 또는 string이어야 함
    let elemType: Type = { kind: "unknown" };
    if (iterType.kind === "array") {
      elemType = iterType.element;
    } else if (iterType.kind === "string") {
      // 문자열을 순회하면 각 요소는 string (한 글자)
      elemType = { kind: "string" };
    } else if (iterType.kind !== "unknown") {
      this.error(`for...of requires array or string, got ${typeToString(iterType)}`, stmt.line, stmt.col);
    }

    // 루프 스코프
    const prevScope = this.scope;
    this.scope = new Scope(prevScope);

    // 루프 변수 (immutable — SPEC_08 Q6)
    this.scope.define(stmt.variable, {
      type: elemType,
      mutable: false,
      moved: false,
      line: stmt.line,
      col: stmt.col,
    });

    for (const s of stmt.body) this.checkStmt(s);
    this.scope = prevScope;
  }

  private checkWhileStmt(stmt: Stmt & { kind: "while_stmt" }): void {
    const condType = this.checkExpr(stmt.condition);

    // while 조건은 bool이어야 함
    if (condType.kind !== "bool" && condType.kind !== "unknown") {
      this.error(`while condition must be bool, got ${typeToString(condType)}`, stmt.line, stmt.col);
    }

    // 루프 스코프
    const prevScope = this.scope;
    this.scope = new Scope(prevScope);

    for (const s of stmt.body) this.checkStmt(s);
    this.scope = prevScope;
  }

  private checkBreakStmt(stmt: Stmt & { kind: "break_stmt" }): void {
    // break는 루프 내에서만 사용 가능 (현재는 미지원)
    // 나중에 구현할 수 있음
  }

  private checkContinueStmt(stmt: Stmt & { kind: "continue_stmt" }): void {
    // continue는 루프 내에서만 사용 가능 (현재는 미지원)
    // 나중에 구현할 수 있음
  }

  private checkSpawnStmt(stmt: Stmt & { kind: "spawn_stmt" }): void {
    // spawn은 독립 스코프 (SPEC_08 Q7)
    const prevScope = this.scope;
    this.scope = new Scope(null); // 부모 스코프 없음 — 독립

    // 내장 함수는 접근 가능하도록 함수 테이블은 유지
    for (const s of stmt.body) this.checkStmt(s);
    this.scope = prevScope;
  }

  private checkReturnStmt(stmt: Stmt & { kind: "return_stmt" }): void {
    if (!this.currentReturnType) {
      this.error("return outside function", stmt.line, stmt.col);
      return;
    }

    if (stmt.value) {
      const valType = this.checkExpr(stmt.value);
      if (!typesEqual(this.currentReturnType, valType) && valType.kind !== "unknown") {
        this.error(
          `return type mismatch: expected ${typeToString(this.currentReturnType)}, got ${typeToString(valType)}`,
          stmt.line, stmt.col,
        );
      }
    } else {
      // return; (void)
      if (this.currentReturnType.kind !== "void") {
        this.error(
          `return without value in non-void function (expected ${typeToString(this.currentReturnType)})`,
          stmt.line, stmt.col,
        );
      }
    }
  }

  private checkExprStmt(stmt: Stmt & { kind: "expr_stmt" }): void {
    this.checkExpr(stmt.expr);
  }

  // ============================================================
  // 식 검사 — 타입 반환
  // ============================================================

  checkExpr(expr: Expr): Type {
    switch (expr.kind) {
      case "int_lit": return { kind: "i32" };
      case "float_lit": return { kind: "f64" };
      case "string_lit": return { kind: "string" };
      case "bool_lit": return { kind: "bool" };

      case "ident":
        return this.checkIdent(expr);

      case "binary":
        return this.checkBinary(expr);

      case "unary":
        return this.checkUnary(expr);

      case "call":
        return this.checkCall(expr);

      case "index":
        return this.checkIndex(expr);

      case "field_access":
        return this.checkFieldAccess(expr);

      case "assign":
        return this.checkAssign(expr);

      case "try":
        return this.checkTry(expr);

      case "if_expr":
        return this.checkIfExpr(expr);

      case "match_expr":
        return this.checkMatchExpr(expr);

      case "array_lit":
        return this.checkArrayLit(expr);

      case "struct_lit":
        return this.checkStructLit(expr);

      case "fn_lit":
        return this.checkFnLit(expr);

      case "block_expr":
        return this.checkBlockExpr(expr);

      default:
        return { kind: "unknown" };
    }
  }

  private checkIdent(expr: Expr & { kind: "ident" }): Type {
    const info = this.scope.lookup(expr.name);
    if (!info) {
      // 내장 함수 확인
      if (this.isBuiltin(expr.name)) return { kind: "unknown" };
      // 함수 이름 확인
      if (this.functions.has(expr.name)) return { kind: "unknown" };

      this.error(`undefined variable: '${expr.name}'`, expr.line, expr.col);
      return { kind: "unknown" };
    }

    // Move 검사 (SPEC_07 Q4)
    if (info.moved) {
      this.error(`use of moved value: '${expr.name}'`, expr.line, expr.col);
      return info.type;
    }

    return info.type;
  }

  private checkBinary(expr: Expr & { kind: "binary" }): Type {
    const left = this.checkExpr(expr.left);
    const right = this.checkExpr(expr.right);

    // 비교 연산자 → bool
    if (["==", "!=", "<", ">", "<=", ">="].includes(expr.op)) {
      if (!typesEqual(left, right) && left.kind !== "unknown" && right.kind !== "unknown") {
        this.error(
          `cannot compare ${typeToString(left)} and ${typeToString(right)}`,
          expr.line, expr.col,
        );
      }
      return { kind: "bool" };
    }

    // 논리 연산자 → bool
    if (expr.op === "&&" || expr.op === "||") {
      if (left.kind !== "bool" && left.kind !== "unknown") {
        this.error(`'${expr.op}' requires bool, got ${typeToString(left)}`, expr.line, expr.col);
      }
      if (right.kind !== "bool" && right.kind !== "unknown") {
        this.error(`'${expr.op}' requires bool, got ${typeToString(right)}`, expr.line, expr.col);
      }
      return { kind: "bool" };
    }

    // 산술 연산자: + 는 문자열 연결도 가능
    if (expr.op === "+") {
      if (left.kind === "string" && right.kind === "string") return { kind: "string" };
    }

    // 산술: i32, i64, f64
    if (["+", "-", "*", "/", "%"].includes(expr.op)) {
      if (!typesEqual(left, right) && left.kind !== "unknown" && right.kind !== "unknown") {
        this.error(
          `type mismatch in '${expr.op}': ${typeToString(left)} and ${typeToString(right)}`,
          expr.line, expr.col,
        );
      }
      const numericTypes = ["i32", "i64", "f64"];
      if (!numericTypes.includes(left.kind) && left.kind !== "unknown") {
        this.error(`'${expr.op}' requires numeric type, got ${typeToString(left)}`, expr.line, expr.col);
      }
      return left.kind !== "unknown" ? left : right;
    }

    return { kind: "unknown" };
  }

  private checkUnary(expr: Expr & { kind: "unary" }): Type {
    const operand = this.checkExpr(expr.operand);

    if (expr.op === "-") {
      if (!["i32", "i64", "f64", "unknown"].includes(operand.kind)) {
        this.error(`unary '-' requires numeric type, got ${typeToString(operand)}`, expr.line, expr.col);
      }
      return operand;
    }

    if (expr.op === "!") {
      if (operand.kind !== "bool" && operand.kind !== "unknown") {
        this.error(`unary '!' requires bool, got ${typeToString(operand)}`, expr.line, expr.col);
      }
      return { kind: "bool" };
    }

    return { kind: "unknown" };
  }

  private checkCall(expr: Expr & { kind: "call" }): Type {
    // 내장 함수 처리
    if (expr.callee.kind === "ident") {
      const name = expr.callee.name;

      // 내장 함수 타입 (SPEC_10)
      const builtinType = this.getBuiltinReturnType(name, expr.args);
      if (builtinType) {
        for (const arg of expr.args) this.checkExpr(arg);
        return builtinType;
      }

      // 사용자 함수
      const fn = this.functions.get(name);
      if (fn) {
        if (expr.args.length !== fn.params.length) {
          this.error(
            `'${name}' expects ${fn.params.length} arguments, got ${expr.args.length}`,
            expr.line, expr.col,
          );
        }

        for (let i = 0; i < expr.args.length; i++) {
          const argType = this.checkExpr(expr.args[i]);
          if (i < fn.params.length) {
            if (!typesEqual(argType, fn.params[i].type) && argType.kind !== "unknown") {
              this.error(
                `argument ${i + 1} type mismatch: expected ${typeToString(fn.params[i].type)}, got ${typeToString(argType)}`,
                expr.line, expr.col,
              );
            }

            // Move semantics: 인자 전달 시 Move (SPEC_07 Q4)
            if (!isCopyType(argType) && expr.args[i].kind === "ident") {
              const varInfo = this.scope.lookup((expr.args[i] as any).name);
              if (varInfo) varInfo.moved = true;
            }
          }
        }

        return fn.returnType;
      }
    }

    // 함수 타입 변수 호출 (fn 타입 값)
    const calleeType = this.checkExpr(expr.callee);
    if (calleeType.kind === "fn") {
      // 함수 타입 인자 개수 검사
      if (expr.args.length !== calleeType.params.length) {
        this.error(
          `function expects ${calleeType.params.length} arguments, got ${expr.args.length}`,
          expr.line, expr.col,
        );
      }

      // 각 인자의 타입 검사
      for (let i = 0; i < expr.args.length; i++) {
        const argType = this.checkExpr(expr.args[i]);
        if (i < calleeType.params.length) {
          if (!typesEqual(argType, calleeType.params[i]) && argType.kind !== "unknown") {
            this.error(
              `argument ${i + 1} type mismatch: expected ${typeToString(calleeType.params[i])}, got ${typeToString(argType)}`,
              expr.line, expr.col,
            );
          }

          // Move semantics for function arguments
          if (!isCopyType(argType) && expr.args[i].kind === "ident") {
            const varInfo = this.scope.lookup((expr.args[i] as any).name);
            if (varInfo) varInfo.moved = true;
          }
        }
      }

      return calleeType.returnType;
    }

    // 메서드 호출 (field_access + call)
    if (expr.callee.kind === "field_access") {
      for (const arg of expr.args) this.checkExpr(arg);
      return { kind: "unknown" }; // 메서드 반환 타입은 정적으로 모름
    }

    // 알 수 없는 함수
    for (const arg of expr.args) this.checkExpr(arg);
    return { kind: "unknown" };
  }

  private checkIndex(expr: Expr & { kind: "index" }): Type {
    const objType = this.checkExpr(expr.object);
    const idxType = this.checkExpr(expr.index);

    if (idxType.kind !== "i32" && idxType.kind !== "unknown") {
      this.error(`array index must be i32, got ${typeToString(idxType)}`, expr.line, expr.col);
    }

    if (objType.kind === "array") return objType.element;
    if (objType.kind === "string") return { kind: "string" }; // char_at 대체
    if (objType.kind !== "unknown") {
      this.error(`cannot index into ${typeToString(objType)}`, expr.line, expr.col);
    }

    return { kind: "unknown" };
  }

  private checkFieldAccess(expr: Expr & { kind: "field_access" }): Type {
    const objType = this.checkExpr(expr.object);

    if (objType.kind === "struct") {
      const fieldType = objType.fields.get(expr.field);
      if (!fieldType) {
        this.error(`struct has no field '${expr.field}'`, expr.line, expr.col);
        return { kind: "unknown" };
      }
      return fieldType;
    }

    // 메서드 스타일 호출 (ch.recv 등) — unknown 반환
    if (objType.kind !== "unknown") {
      // 채널 메서드
      if (objType.kind === "channel") {
        if (expr.field === "recv" || expr.field === "send") return { kind: "unknown" };
      }
    }

    return { kind: "unknown" };
  }

  private checkAssign(expr: Expr & { kind: "assign" }): Type {
    const valType = this.checkExpr(expr.value);

    if (expr.target.kind === "ident") {
      const info = this.scope.lookup(expr.target.name);
      if (!info) {
        this.error(`undefined variable: '${expr.target.name}'`, expr.line, expr.col);
        return { kind: "void" };
      }
      if (!info.mutable) {
        this.error(`cannot assign to immutable variable '${expr.target.name}'`, expr.line, expr.col);
        return { kind: "void" };
      }
      if (!typesEqual(info.type, valType) && valType.kind !== "unknown") {
        this.error(
          `assignment type mismatch: ${typeToString(info.type)} = ${typeToString(valType)}`,
          expr.line, expr.col,
        );
      }

      // 재할당으로 Move 복구 (SPEC_07 Q7)
      info.moved = false;
    }

    if (expr.target.kind === "index") {
      this.checkExpr(expr.target);
    }

    if (expr.target.kind === "field_access") {
      const objType = this.checkExpr(expr.target.object);

      if (objType.kind === "struct") {
        const fieldType = objType.fields.get(expr.target.field);
        if (!fieldType) {
          this.error(`struct has no field '${expr.target.field}'`, expr.line, expr.col);
          return { kind: "void" };
        }

        if (!typesEqual(fieldType, valType) && valType.kind !== "unknown") {
          this.error(
            `field assignment type mismatch: expected ${typeToString(fieldType)}, got ${typeToString(valType)}`,
            expr.line, expr.col,
          );
        }
      } else if (objType.kind !== "unknown") {
        this.error(`cannot assign to field of ${typeToString(objType)}`, expr.line, expr.col);
      }
    }

    return { kind: "void" };
  }

  private checkTry(expr: Expr & { kind: "try" }): Type {
    const operandType = this.checkExpr(expr.operand);

    // ? 는 Result 또는 Option에만 사용 (SPEC_09 Q6)
    if (operandType.kind === "result") return operandType.ok;
    if (operandType.kind === "option") return operandType.element;
    if (operandType.kind !== "unknown") {
      this.error(`'?' requires Result or Option, got ${typeToString(operandType)}`, expr.line, expr.col);
    }

    return { kind: "unknown" };
  }

  private checkIfExpr(expr: Expr & { kind: "if_expr" }): Type {
    const condType = this.checkExpr(expr.condition);
    if (condType.kind !== "bool" && condType.kind !== "unknown") {
      this.error(`if condition must be bool, got ${typeToString(condType)}`, expr.line, expr.col);
    }

    // then/else 마지막 식의 타입이 일치해야 함 (SPEC_06)
    let thenType: Type = { kind: "void" };
    for (const e of expr.then) thenType = this.checkExpr(e);

    let elseType: Type = { kind: "void" };
    for (const e of expr.else_) elseType = this.checkExpr(e);

    if (!typesEqual(thenType, elseType) && thenType.kind !== "unknown" && elseType.kind !== "unknown") {
      this.error(
        `if expression branches have different types: ${typeToString(thenType)} vs ${typeToString(elseType)}`,
        expr.line, expr.col,
      );
    }

    return thenType;
  }

  private checkMatchExpr(expr: Expr & { kind: "match_expr" }): Type {
    const subjectType = this.checkExpr(expr.subject);
    let resultType: Type = { kind: "unknown" };

    for (const arm of expr.arms) {
      const prevScope = this.scope;
      this.scope = new Scope(prevScope);
      this.checkPattern(arm.pattern, subjectType);
      const armType = this.checkExpr(arm.body);
      this.scope = prevScope;

      if (resultType.kind === "unknown") {
        resultType = armType;
      } else if (!typesEqual(resultType, armType) && armType.kind !== "unknown") {
        this.error(
          `match arms have different types: ${typeToString(resultType)} vs ${typeToString(armType)}`,
          expr.line, expr.col,
        );
      }
    }

    return resultType;
  }

  private checkArrayLit(expr: Expr & { kind: "array_lit" }): Type {
    if (expr.elements.length === 0) return { kind: "array", element: { kind: "unknown" } };

    const firstType = this.checkExpr(expr.elements[0]);
    for (let i = 1; i < expr.elements.length; i++) {
      const elemType = this.checkExpr(expr.elements[i]);
      if (!typesEqual(firstType, elemType) && elemType.kind !== "unknown") {
        this.error(
          `array element type mismatch: expected ${typeToString(firstType)}, got ${typeToString(elemType)}`,
          expr.line, expr.col,
        );
      }
    }

    return { kind: "array", element: firstType };
  }

  private checkStructLit(expr: Expr & { kind: "struct_lit" }): Type {
    // struct 정의 확인
    const structDef = this.structs.get(expr.structName);
    if (!structDef || structDef.kind !== "struct") {
      this.error(`undefined struct: '${expr.structName}'`, expr.line, expr.col);
      return { kind: "unknown" };
    }

    // 필드 타입 확인
    const fields = new Map<string, Type>();
    for (const f of expr.fields) {
      const fType = this.checkExpr(f.value);
      const expectedType = structDef.fields.get(f.name);

      if (!expectedType) {
        this.error(`struct '${expr.structName}' has no field '${f.name}'`, expr.line, expr.col);
        fields.set(f.name, fType);
        continue;
      }

      if (!typesEqual(fType, expectedType) && fType.kind !== "unknown") {
        this.error(
          `struct field '${f.name}' type mismatch: expected ${typeToString(expectedType)}, got ${typeToString(fType)}`,
          expr.line, expr.col,
        );
      }
      fields.set(f.name, expectedType);
    }

    // 모든 필드가 제공되었는지 확인
    for (const [fieldName, fieldType] of structDef.fields.entries()) {
      if (!fields.has(fieldName)) {
        this.error(`struct '${expr.structName}' is missing field '${fieldName}'`, expr.line, expr.col);
      }
    }

    return structDef;
  }

  private checkFnLit(expr: Expr & { kind: "fn_lit" }): Type {
    // 함수 리터럴의 매개변수 타입 확인
    const paramTypes: Type[] = [];
    for (const param of expr.params) {
      if (param.type) {
        const paramType = annotationToType(param.type, this.structs);
        paramTypes.push(paramType);
      } else {
        // 타입 어노테이션 없으면 unknown (타입 추론 미지원)
        paramTypes.push({ kind: "unknown" });
      }
    }

    // 반환 타입 확인
    let returnType: Type;
    if (expr.returnType) {
      returnType = annotationToType(expr.returnType, this.structs);
    } else {
      // 함수 본체에서 반환 타입 추론
      const bodyType = this.checkExpr(expr.body);
      returnType = bodyType;
    }

    // 함수 본체 타입 검사 (새로운 스코프에서)
    const prevScope = this.scope;
    this.scope = new Scope(prevScope);

    // 매개변수를 스코프에 등록
    for (let i = 0; i < expr.params.length; i++) {
      const param = expr.params[i];
      const paramType = paramTypes[i];
      this.scope.define(param.name, {
        type: paramType,
        mutable: false,
        moved: false,
        line: expr.line,
        col: expr.col,
      });
    }

    // 함수 본체 타입 검사
    const actualBodyType = this.checkExpr(expr.body);

    // 반환 타입과 일치 검사
    if (expr.returnType && !typesEqual(actualBodyType, returnType) && actualBodyType.kind !== "unknown") {
      this.error(
        `function body type mismatch: expected ${typeToString(returnType)}, got ${typeToString(actualBodyType)}`,
        expr.line, expr.col,
      );
    }

    this.scope = prevScope;

    // 함수 타입 반환
    return { kind: "fn", params: paramTypes, returnType };
  }

  private checkBlockExpr(expr: Expr & { kind: "block_expr" }): Type {
    const prevScope = this.scope;
    this.scope = new Scope(prevScope);

    for (const s of expr.stmts) this.checkStmt(s);
    let result: Type = { kind: "void" };
    if (expr.expr) result = this.checkExpr(expr.expr);

    this.scope = prevScope;
    return result;
  }

  // ============================================================
  // 내장 함수 (SPEC_10)
  // ============================================================

  private isBuiltin(name: string): boolean {
    return [
      "println", "read_line", "read_file", "write_file",
      "i32", "i64", "f64", "str",
      "push", "pop", "slice", "clone", "length",
      "char_at", "contains", "split", "trim", "to_upper", "to_lower",
      "abs", "min", "max", "pow", "sqrt",
      "range", "channel", "panic", "typeof", "assert",
    ].includes(name);
  }

  private getBuiltinReturnType(name: string, args: Expr[]): Type | null {
    switch (name) {
      case "println": return { kind: "void" };
      case "read_line": return { kind: "string" };
      case "read_file": return { kind: "result", ok: { kind: "string" }, err: { kind: "string" } };
      case "write_file": return { kind: "result", ok: { kind: "void" }, err: { kind: "string" } };
      case "i32": return { kind: "result", ok: { kind: "i32" }, err: { kind: "string" } };
      case "i64": return { kind: "result", ok: { kind: "i64" }, err: { kind: "string" } };
      case "f64": return { kind: "result", ok: { kind: "f64" }, err: { kind: "string" } };
      case "str": return { kind: "string" };
      case "length": return { kind: "i32" };
      case "push": return { kind: "void" };
      case "pop": return { kind: "unknown" }; // 원소 타입 모름
      case "clone": return { kind: "unknown" };
      case "range": return { kind: "array", element: { kind: "i32" } };
      case "channel": return { kind: "unknown" }; // 채널 타입은 문맥 의존
      case "panic": return { kind: "void" };
      case "typeof": return { kind: "string" };
      case "assert": return { kind: "void" };
      case "abs": case "min": case "max": case "pow": case "sqrt":
        return null; // 인자 타입에 의존 — 기본 처리
      case "contains": return { kind: "bool" };
      case "split": return { kind: "array", element: { kind: "string" } };
      case "trim": case "to_upper": case "to_lower": case "char_at":
        return { kind: "string" };
      case "slice": return { kind: "unknown" };
      default: return null;
    }
  }

  // ============================================================
  // 에러 헬퍼
  // ============================================================

  private error(message: string, line: number, col: number): void {
    this.errors.push({ message, line, col });
  }
}
