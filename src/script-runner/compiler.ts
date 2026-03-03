// FreeLang v4 — Bytecode Compiler (SPEC_02 구현)
// AST → Bytecode

import { Program, Stmt, Expr, Pattern, MatchArm, Param, TypeAnnotation } from "./ast";

// ============================================================
// Opcodes
// ============================================================

export enum Op {
  // 상수 로드
  PUSH_I32 = 0x01,
  PUSH_F64 = 0x02,
  PUSH_STR = 0x03,
  PUSH_TRUE = 0x04,
  PUSH_FALSE = 0x05,
  PUSH_VOID = 0x06,
  PUSH_NONE = 0x07,
  POP = 0x08,

  // 산술 (i32)
  ADD_I32 = 0x10,
  SUB_I32 = 0x11,
  MUL_I32 = 0x12,
  DIV_I32 = 0x13,
  MOD_I32 = 0x14,
  NEG_I32 = 0x15,

  // 산술 (f64)
  ADD_F64 = 0x18,
  SUB_F64 = 0x19,
  MUL_F64 = 0x1A,
  DIV_F64 = 0x1B,
  MOD_F64 = 0x1C,
  NEG_F64 = 0x1D,

  // 비교
  EQ = 0x20,
  NEQ = 0x21,
  LT = 0x22,
  GT = 0x23,
  LTEQ = 0x24,
  GTEQ = 0x25,

  // 논리
  AND = 0x28,
  OR = 0x29,
  NOT = 0x2A,

  // 문자열
  STR_CONCAT = 0x2E,

  // 변수
  LOAD_LOCAL = 0x30,
  STORE_LOCAL = 0x31,
  LOAD_GLOBAL = 0x32,
  STORE_GLOBAL = 0x33,

  // 제어
  JUMP = 0x40,
  JUMP_IF_FALSE = 0x41,
  RETURN = 0x42,
  HALT = 0x43,

  // 함수
  CALL = 0x50,
  CALL_BUILTIN = 0x51,

  // 배열
  ARRAY_NEW = 0x60,
  ARRAY_GET = 0x61,
  ARRAY_SET = 0x62,

  // 구조체
  STRUCT_NEW = 0x68,
  STRUCT_GET = 0x69,
  STRUCT_SET = 0x6A,

  // Option/Result
  WRAP_OK = 0x70,
  WRAP_ERR = 0x71,
  WRAP_SOME = 0x72,
  UNWRAP = 0x73,
  IS_OK = 0x74,
  IS_ERR = 0x75,
  IS_SOME = 0x76,
  IS_NONE = 0x77,

  // Actor/Channel
  SPAWN = 0x80,
  CHAN_NEW = 0x81,
  CHAN_SEND = 0x82,
  CHAN_RECV = 0x83,

  // 디버그
  DUP = 0xF0,
}

// ============================================================
// Chunk — 바이트코드 청크
// ============================================================

export type FuncInfo = {
  name: string;
  arity: number;
  offset: number; // bytecode 시작 위치
};

export class Chunk {
  code: number[] = [];
  constants: any[] = [];
  functions: FuncInfo[] = [];
  lines: number[] = []; // 각 바이트코드의 소스 줄

  emit(op: Op, line: number): void {
    this.code.push(op);
    this.lines.push(line);
  }

  emitByte(b: number, line: number): void {
    this.code.push(b & 0xFF);
    this.lines.push(line);
  }

  emitI32(val: number, line: number): void {
    // 4바이트 little-endian
    this.code.push(val & 0xFF);
    this.code.push((val >> 8) & 0xFF);
    this.code.push((val >> 16) & 0xFF);
    this.code.push((val >> 24) & 0xFF);
    for (let i = 0; i < 4; i++) this.lines.push(line);
  }

  emitF64(val: number, line: number): void {
    const buf = new ArrayBuffer(8);
    new Float64Array(buf)[0] = val;
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < 8; i++) {
      this.code.push(bytes[i]);
      this.lines.push(line);
    }
  }

  addConstant(val: any): number {
    const idx = this.constants.length;
    this.constants.push(val);
    return idx;
  }

  // 패치: 나중에 오프셋 채우기
  currentOffset(): number {
    return this.code.length;
  }

  patchI32(offset: number, val: number): void {
    this.code[offset] = val & 0xFF;
    this.code[offset + 1] = (val >> 8) & 0xFF;
    this.code[offset + 2] = (val >> 16) & 0xFF;
    this.code[offset + 3] = (val >> 24) & 0xFF;
  }
}

// ============================================================
// Compiler — 스코프 내 변수 슬롯 관리
// ============================================================

type LocalVar = {
  name: string;
  slot: number;
  depth: number;
};

// ============================================================
// Compiler
// ============================================================

export class Compiler {
  private chunk: Chunk = new Chunk();
  private locals: LocalVar[] = [];
  private scopeDepth: number = 0;
  private nextSlot: number = 0;
  private functionBodies: Map<string, Stmt & { kind: "fn_decl" }> = new Map();

  // Loop 제어 (break/continue)
  private loopStack: Array<{ start: number; breakJumps: number[] }> = [];

  compile(program: Program): Chunk {
    // Pass 1: 함수 등록
    for (const stmt of program.stmts) {
      if (stmt.kind === "fn_decl") {
        this.functionBodies.set(stmt.name, stmt);
        this.chunk.functions.push({
          name: stmt.name,
          arity: stmt.params.length,
          offset: -1, // 나중에 패치
        });
      }
    }

    // Pass 2: 최상위 코드 컴파일
    for (const stmt of program.stmts) {
      if (stmt.kind !== "fn_decl") {
        this.compileStmt(stmt);
      }
    }

    // main 함수 자동 호출
    const mainFnIdx = this.chunk.functions.findIndex((f) => f.name === "main");
    if (mainFnIdx !== -1) {
      this.chunk.emit(Op.CALL, 0);
      this.chunk.emitI32(mainFnIdx, 0);
      this.chunk.emit(Op.POP, 0); // 반환값 무시
    }

    this.chunk.emit(Op.HALT, 0);

    // Pass 3: 함수 본문 컴파일
    for (const [name, stmt] of this.functionBodies) {
      this.compileFnBody(name, stmt);
    }

    return this.chunk;
  }

  // ============================================================
  // 문 컴파일
  // ============================================================

  private compileStmt(stmt: Stmt): void {
    switch (stmt.kind) {
      case "var_decl": return this.compileVarDecl(stmt);
      case "fn_decl": return; // Pass 3에서 처리
      case "use_decl": return; // use 문은 무시 (컴파일 단계에서 처리 안 함)
      case "if_stmt": return this.compileIfStmt(stmt);
      case "match_stmt": return this.compileMatchStmt(stmt);
      case "for_stmt": return this.compileForStmt(stmt);
      case "while_stmt": return this.compileWhileStmt(stmt);
      case "break_stmt": return this.compileBreakStmt(stmt);
      case "continue_stmt": return this.compileContinueStmt(stmt);
      case "spawn_stmt": return this.compileSpawnStmt(stmt);
      case "return_stmt": return this.compileReturnStmt(stmt);
      case "expr_stmt": return this.compileExprStmt(stmt);
    }
  }

  private compileVarDecl(stmt: Stmt & { kind: "var_decl" }): void {
    this.compileExpr(stmt.init);
    const slot = this.declareLocal(stmt.name);
    this.chunk.emit(Op.STORE_LOCAL, stmt.line);
    this.chunk.emitI32(slot, stmt.line);
  }

  private compileFnBody(name: string, stmt: Stmt & { kind: "fn_decl" }): void {
    // 함수 오프셋 기록
    const fnInfo = this.chunk.functions.find((f) => f.name === name);
    if (fnInfo) fnInfo.offset = this.chunk.currentOffset();

    // 스코프 + 매개변수
    const prevLocals = this.locals;
    const prevSlot = this.nextSlot;
    const prevDepth = this.scopeDepth;

    this.locals = [];
    this.nextSlot = 0;
    this.scopeDepth = 0;

    for (const p of stmt.params) {
      this.declareLocal(p.name);
    }

    // 본문
    for (const s of stmt.body) {
      this.compileStmt(s);
    }

    // void 함수는 암시적 return
    this.chunk.emit(Op.PUSH_VOID, stmt.line);
    this.chunk.emit(Op.RETURN, stmt.line);

    this.locals = prevLocals;
    this.nextSlot = prevSlot;
    this.scopeDepth = prevDepth;
  }

  private compileIfStmt(stmt: Stmt & { kind: "if_stmt" }): void {
    this.compileExpr(stmt.condition);

    // JUMP_IF_FALSE → else or end
    this.chunk.emit(Op.JUMP_IF_FALSE, stmt.line);
    const elseJump = this.chunk.currentOffset();
    this.chunk.emitI32(0, stmt.line); // 패치 대상

    // then
    this.beginScope();
    for (const s of stmt.then) this.compileStmt(s);
    this.endScope(stmt.line);

    if (stmt.else_) {
      // JUMP → end (then 끝에서)
      this.chunk.emit(Op.JUMP, stmt.line);
      const endJump = this.chunk.currentOffset();
      this.chunk.emitI32(0, stmt.line);

      // else 시작 (패치)
      this.chunk.patchI32(elseJump, this.chunk.currentOffset());

      this.beginScope();
      for (const s of stmt.else_) this.compileStmt(s);
      this.endScope(stmt.line);

      // end (패치)
      this.chunk.patchI32(endJump, this.chunk.currentOffset());
    } else {
      this.chunk.patchI32(elseJump, this.chunk.currentOffset());
    }
  }

  private compileMatchStmt(stmt: Stmt & { kind: "match_stmt" }): void {
    this.compileExpr(stmt.subject);
    const endJumps: number[] = [];

    for (const arm of stmt.arms) {
      // DUP subject
      this.chunk.emit(Op.DUP, stmt.line);

      // 패턴 매칭 코드
      this.compilePatternTest(arm.pattern, stmt.line);

      // JUMP_IF_FALSE → 다음 arm
      this.chunk.emit(Op.JUMP_IF_FALSE, stmt.line);
      const nextArm = this.chunk.currentOffset();
      this.chunk.emitI32(0, stmt.line);

      // body (subject POP 후)
      this.chunk.emit(Op.POP, stmt.line); // subject 제거
      this.beginScope();
      this.compilePatternBind(arm.pattern, stmt.line);
      this.compileExpr(arm.body);
      this.chunk.emit(Op.POP, stmt.line); // match stmt → 값 버림
      this.endScope(stmt.line);

      // JUMP → end
      this.chunk.emit(Op.JUMP, stmt.line);
      endJumps.push(this.chunk.currentOffset());
      this.chunk.emitI32(0, stmt.line);

      // 다음 arm (패치)
      this.chunk.patchI32(nextArm, this.chunk.currentOffset());
    }

    // subject POP (매칭 안 된 경우)
    this.chunk.emit(Op.POP, stmt.line);

    // end 패치
    for (const j of endJumps) {
      this.chunk.patchI32(j, this.chunk.currentOffset());
    }
  }

  private compileForStmt(stmt: Stmt & { kind: "for_stmt" }): void {
    // iterable 계산
    this.compileExpr(stmt.iterable);
    const arrSlot = this.declareLocal("__arr__");
    this.chunk.emit(Op.STORE_LOCAL, stmt.line);
    this.chunk.emitI32(arrSlot, stmt.line);

    // 인덱스 = 0
    this.chunk.emit(Op.PUSH_I32, stmt.line);
    this.chunk.emitI32(0, stmt.line);
    const idxSlot = this.declareLocal("__idx__");
    this.chunk.emit(Op.STORE_LOCAL, stmt.line);
    this.chunk.emitI32(idxSlot, stmt.line);

    // 루프 변수
    this.chunk.emit(Op.PUSH_VOID, stmt.line);
    const itemSlot = this.declareLocal(stmt.variable);
    this.chunk.emit(Op.STORE_LOCAL, stmt.line);
    this.chunk.emitI32(itemSlot, stmt.line);

    const loopStart = this.chunk.currentOffset();

    // break를 위한 루프 스택 추가
    const breakJumps: number[] = [];
    this.loopStack.push({ start: loopStart, breakJumps });

    // 조건: idx < length(arr)
    this.chunk.emit(Op.LOAD_LOCAL, stmt.line);
    this.chunk.emitI32(idxSlot, stmt.line);
    this.chunk.emit(Op.LOAD_LOCAL, stmt.line);
    this.chunk.emitI32(arrSlot, stmt.line);
    this.chunk.emit(Op.CALL_BUILTIN, stmt.line);
    this.chunk.emitI32(this.chunk.addConstant("length"), stmt.line);
    this.chunk.emitByte(1, stmt.line); // 1 arg
    this.chunk.emit(Op.LT, stmt.line);
    this.chunk.emit(Op.JUMP_IF_FALSE, stmt.line);
    const exitJump = this.chunk.currentOffset();
    this.chunk.emitI32(0, stmt.line);

    // item = arr[idx]
    this.chunk.emit(Op.LOAD_LOCAL, stmt.line);
    this.chunk.emitI32(arrSlot, stmt.line);
    this.chunk.emit(Op.LOAD_LOCAL, stmt.line);
    this.chunk.emitI32(idxSlot, stmt.line);
    this.chunk.emit(Op.ARRAY_GET, stmt.line);
    this.chunk.emit(Op.STORE_LOCAL, stmt.line);
    this.chunk.emitI32(itemSlot, stmt.line);

    // body
    this.beginScope();
    for (const s of stmt.body) this.compileStmt(s);
    this.endScope(stmt.line);

    // idx = idx + 1
    this.chunk.emit(Op.LOAD_LOCAL, stmt.line);
    this.chunk.emitI32(idxSlot, stmt.line);
    this.chunk.emit(Op.PUSH_I32, stmt.line);
    this.chunk.emitI32(1, stmt.line);
    this.chunk.emit(Op.ADD_I32, stmt.line);
    this.chunk.emit(Op.STORE_LOCAL, stmt.line);
    this.chunk.emitI32(idxSlot, stmt.line);

    // JUMP → loopStart
    this.chunk.emit(Op.JUMP, stmt.line);
    this.chunk.emitI32(loopStart, stmt.line);

    // exit (패치)
    this.chunk.patchI32(exitJump, this.chunk.currentOffset());

    // break 점프들 patch
    for (const breakJump of breakJumps) {
      this.chunk.patchI32(breakJump, this.chunk.currentOffset());
    }

    this.loopStack.pop();
  }

  private compileWhileStmt(stmt: Stmt & { kind: "while_stmt" }): void {
    this.beginScope();

    // 루프 시작
    const loopStart = this.chunk.currentOffset();

    // break를 위한 루프 스택 추가
    const breakJumps: number[] = [];
    this.loopStack.push({ start: loopStart, breakJumps });

    // 조건 평가
    this.compileExpr(stmt.condition);

    // 조건이 false이면 exit으로 점프
    this.chunk.emit(Op.JUMP_IF_FALSE, stmt.line);
    const exitJump = this.chunk.currentOffset();
    this.chunk.emitI32(0, stmt.line); // 나중에 patch

    // 루프 body
    for (const s of stmt.body) {
      this.compileStmt(s);
    }

    // 루프 시작으로 다시 점프
    this.chunk.emit(Op.JUMP, stmt.line);
    this.chunk.emitI32(loopStart, stmt.line);

    // exit 패치
    this.chunk.patchI32(exitJump, this.chunk.currentOffset());

    // break 점프들 patch
    for (const breakJump of breakJumps) {
      this.chunk.patchI32(breakJump, this.chunk.currentOffset());
    }

    this.loopStack.pop();
    this.endScope(stmt.line);
  }

  private compileBreakStmt(stmt: Stmt & { kind: "break_stmt" }): void {
    if (this.loopStack.length === 0) {
      throw new Error("break statement outside of loop");
    }

    // break는 loop exit으로 점프 (아직 모르므로 0으로 설정, 나중에 patch)
    this.chunk.emit(Op.JUMP, stmt.line);
    const jumpOffset = this.chunk.currentOffset();
    this.chunk.emitI32(0, stmt.line);

    // break 점프를 루프 스택에 기록 (나중에 loop exit으로 patch)
    this.loopStack[this.loopStack.length - 1].breakJumps.push(jumpOffset);
  }

  private compileContinueStmt(stmt: Stmt & { kind: "continue_stmt" }): void {
    if (this.loopStack.length === 0) {
      throw new Error("continue statement outside of loop");
    }

    // continue는 loop start로 점프
    this.chunk.emit(Op.JUMP, stmt.line);
    this.chunk.emitI32(this.loopStack[this.loopStack.length - 1].start, stmt.line);
  }

  private compileSpawnStmt(stmt: Stmt & { kind: "spawn_stmt" }): void {
    // SPAWN: 본문의 시작 오프셋을 인자로
    this.chunk.emit(Op.SPAWN, stmt.line);
    const bodyJump = this.chunk.currentOffset();
    this.chunk.emitI32(0, stmt.line); // 패치

    // main은 spawn 다음으로 점프
    this.chunk.emit(Op.JUMP, stmt.line);
    const skipJump = this.chunk.currentOffset();
    this.chunk.emitI32(0, stmt.line);

    // spawn body 시작 (패치)
    this.chunk.patchI32(bodyJump, this.chunk.currentOffset());
    for (const s of stmt.body) this.compileStmt(s);
    this.chunk.emit(Op.HALT, stmt.line);

    // skip end (패치)
    this.chunk.patchI32(skipJump, this.chunk.currentOffset());
  }

  private compileReturnStmt(stmt: Stmt & { kind: "return_stmt" }): void {
    if (stmt.value) {
      this.compileExpr(stmt.value);
    } else {
      this.chunk.emit(Op.PUSH_VOID, stmt.line);
    }
    this.chunk.emit(Op.RETURN, stmt.line);
  }

  private compileExprStmt(stmt: Stmt & { kind: "expr_stmt" }): void {
    this.compileExpr(stmt.expr);
    // 할당은 이미 STORE_LOCAL을 emit하므로 POP 불필요
    if (stmt.expr.kind !== "assign") {
      this.chunk.emit(Op.POP, stmt.line);
    }
  }

  // ============================================================
  // 식 컴파일
  // ============================================================

  private compileExpr(expr: Expr): void {
    switch (expr.kind) {
      case "int_lit":
        this.chunk.emit(Op.PUSH_I32, expr.line);
        this.chunk.emitI32(expr.value, expr.line);
        break;

      case "float_lit":
        this.chunk.emit(Op.PUSH_F64, expr.line);
        this.chunk.emitF64(expr.value, expr.line);
        break;

      case "string_lit": {
        const idx = this.chunk.addConstant(expr.value);
        this.chunk.emit(Op.PUSH_STR, expr.line);
        this.chunk.emitI32(idx, expr.line);
        break;
      }

      case "bool_lit":
        this.chunk.emit(expr.value ? Op.PUSH_TRUE : Op.PUSH_FALSE, expr.line);
        break;

      case "ident":
        this.compileIdent(expr);
        break;

      case "binary":
        this.compileBinary(expr);
        break;

      case "unary":
        this.compileUnary(expr);
        break;

      case "call":
        this.compileCall(expr);
        break;

      case "index":
        this.compileExpr(expr.object);
        this.compileExpr(expr.index);
        this.chunk.emit(Op.ARRAY_GET, expr.line);
        break;

      case "field_access":
        this.compileExpr(expr.object);
        this.chunk.emit(Op.STRUCT_GET, expr.line);
        this.chunk.emitI32(this.chunk.addConstant(expr.field), expr.line);
        break;

      case "assign":
        this.compileAssign(expr);
        break;

      case "try":
        this.compileExpr(expr.operand);
        this.chunk.emit(Op.UNWRAP, expr.line);
        break;

      case "if_expr":
        this.compileIfExpr(expr);
        break;

      case "match_expr":
        this.compileMatchExpr(expr);
        break;

      case "array_lit":
        for (const el of expr.elements) this.compileExpr(el);
        this.chunk.emit(Op.ARRAY_NEW, expr.line);
        this.chunk.emitI32(expr.elements.length, expr.line);
        break;

      case "struct_lit":
        for (const f of expr.fields) {
          this.chunk.emit(Op.PUSH_STR, expr.line);
          this.chunk.emitI32(this.chunk.addConstant(f.name), expr.line);
          this.compileExpr(f.value);
        }
        this.chunk.emit(Op.STRUCT_NEW, expr.line);
        this.chunk.emitI32(expr.fields.length, expr.line);
        break;

      case "block_expr":
        this.beginScope();
        for (const s of expr.stmts) this.compileStmt(s);
        if (expr.expr) this.compileExpr(expr.expr);
        else this.chunk.emit(Op.PUSH_VOID, expr.line);
        this.endScope(expr.line);
        break;
    }
  }

  private compileIdent(expr: Expr & { kind: "ident" }): void {
    const local = this.resolveLocal(expr.name);
    if (local !== -1) {
      this.chunk.emit(Op.LOAD_LOCAL, expr.line);
      this.chunk.emitI32(local, expr.line);
    } else {
      // global 또는 함수 이름 — 함수 참조로 처리
      this.chunk.emit(Op.LOAD_GLOBAL, expr.line);
      this.chunk.emitI32(this.chunk.addConstant(expr.name), expr.line);
    }
  }

  private compileBinary(expr: Expr & { kind: "binary" }): void {
    // 문자열 + 문자열
    if (expr.op === "+") {
      this.compileExpr(expr.left);
      this.compileExpr(expr.right);
      // VM이 런타임에 타입 보고 ADD_I32/ADD_F64/STR_CONCAT 결정
      // 여기서는 일반 ADD로 emit
      this.chunk.emit(Op.ADD_I32, expr.line);
      return;
    }

    this.compileExpr(expr.left);
    this.compileExpr(expr.right);

    switch (expr.op) {
      case "-": this.chunk.emit(Op.SUB_I32, expr.line); break;
      case "*": this.chunk.emit(Op.MUL_I32, expr.line); break;
      case "/": this.chunk.emit(Op.DIV_I32, expr.line); break;
      case "%": this.chunk.emit(Op.MOD_I32, expr.line); break;
      case "==": this.chunk.emit(Op.EQ, expr.line); break;
      case "!=": this.chunk.emit(Op.NEQ, expr.line); break;
      case "<": this.chunk.emit(Op.LT, expr.line); break;
      case ">": this.chunk.emit(Op.GT, expr.line); break;
      case "<=": this.chunk.emit(Op.LTEQ, expr.line); break;
      case ">=": this.chunk.emit(Op.GTEQ, expr.line); break;
      case "&&": this.chunk.emit(Op.AND, expr.line); break;
      case "||": this.chunk.emit(Op.OR, expr.line); break;
    }
  }

  private compileUnary(expr: Expr & { kind: "unary" }): void {
    this.compileExpr(expr.operand);
    if (expr.op === "-") this.chunk.emit(Op.NEG_I32, expr.line);
    if (expr.op === "!") this.chunk.emit(Op.NOT, expr.line);
  }

  private compileCall(expr: Expr & { kind: "call" }): void {
    // 내장 함수
    if (expr.callee.kind === "ident") {
      const name = expr.callee.name;
      const builtins = [
        "println", "print", "read_line", "read_file", "write_file",
        "i32", "i64", "f64", "str",
        "push", "pop", "slice", "clone", "length",
        "char_at", "contains", "split", "trim", "to_upper", "to_lower",
        "abs", "min", "max", "pow", "sqrt",
        "range", "channel", "panic", "typeof", "assert",
        // Phase 7: 20 Core Libraries
        // Cryptography & Encoding (6)
        "md5", "sha256", "sha512", "base64_encode", "base64_decode", "hmac",
        // JSON (4)
        "json_parse", "json_stringify", "json_validate", "json_pretty",
        // Advanced Strings (3)
        "starts_with", "ends_with", "replace",
        // Advanced Arrays (3)
        "reverse", "sort", "unique",
        // Math (2)
        "gcd", "lcm",
        // Utils (2)
        "uuid", "timestamp",
        // Channel (2)
        "send", "recv",
      ];

      if (builtins.includes(name)) {
        for (const arg of expr.args) this.compileExpr(arg);
        this.chunk.emit(Op.CALL_BUILTIN, expr.line);
        this.chunk.emitI32(this.chunk.addConstant(name), expr.line);
        this.chunk.emitByte(expr.args.length, expr.line);
        return;
      }

      // 사용자 함수
      const fnIdx = this.chunk.functions.findIndex((f) => f.name === name);
      if (fnIdx !== -1) {
        for (const arg of expr.args) this.compileExpr(arg);
        this.chunk.emit(Op.CALL, expr.line);
        this.chunk.emitI32(fnIdx, expr.line);
        this.chunk.emitByte(expr.args.length, expr.line);
        return;
      }
    }

    // 메서드 호출: obj.method(args)
    if (expr.callee.kind === "field_access") {
      this.compileExpr(expr.callee.object);
      for (const arg of expr.args) this.compileExpr(arg);
      this.chunk.emit(Op.CALL_BUILTIN, expr.line);
      this.chunk.emitI32(this.chunk.addConstant(expr.callee.field), expr.line);
      this.chunk.emitByte(expr.args.length + 1, expr.line); // +1 for self
      return;
    }

    // fallback: 동적 호출
    this.compileExpr(expr.callee);
    for (const arg of expr.args) this.compileExpr(arg);
    this.chunk.emit(Op.CALL, expr.line);
    this.chunk.emitI32(-1, expr.line);
    this.chunk.emitByte(expr.args.length, expr.line);
  }

  private compileAssign(expr: Expr & { kind: "assign" }): void {
    if (expr.target.kind === "ident") {
      this.compileExpr(expr.value);
      const slot = this.resolveLocal(expr.target.name);
      if (slot !== -1) {
        this.chunk.emit(Op.STORE_LOCAL, expr.line);
        this.chunk.emitI32(slot, expr.line);
      } else {
        this.chunk.emit(Op.STORE_GLOBAL, expr.line);
        this.chunk.emitI32(this.chunk.addConstant(expr.target.name), expr.line);
      }
    } else if (expr.target.kind === "index") {
      // stack order for ARRAY_SET: [... arr, idx, val]
      this.compileExpr(expr.target.object);  // push array
      this.compileExpr(expr.target.index);   // push index
      this.compileExpr(expr.value);          // push value
      this.chunk.emit(Op.ARRAY_SET, expr.line);
    } else if (expr.target.kind === "field_access") {
      // stack order for STRUCT_SET: [... obj, val]
      this.compileExpr(expr.target.object);  // push struct
      this.compileExpr(expr.value);          // push value
      this.chunk.emit(Op.STRUCT_SET, expr.line);
      this.chunk.emitI32(this.chunk.addConstant(expr.target.field), expr.line);
    }
  }

  private compileIfExpr(expr: Expr & { kind: "if_expr" }): void {
    this.compileExpr(expr.condition);
    this.chunk.emit(Op.JUMP_IF_FALSE, expr.line);
    const elseJump = this.chunk.currentOffset();
    this.chunk.emitI32(0, expr.line);

    // then — 마지막 식이 값
    for (const e of expr.then) this.compileExpr(e);

    this.chunk.emit(Op.JUMP, expr.line);
    const endJump = this.chunk.currentOffset();
    this.chunk.emitI32(0, expr.line);

    this.chunk.patchI32(elseJump, this.chunk.currentOffset());

    // else — 마지막 식이 값
    for (const e of expr.else_) this.compileExpr(e);

    this.chunk.patchI32(endJump, this.chunk.currentOffset());
  }

  private compileMatchExpr(expr: Expr & { kind: "match_expr" }): void {
    this.compileExpr(expr.subject);
    const endJumps: number[] = [];

    for (const arm of expr.arms) {
      this.chunk.emit(Op.DUP, expr.line);
      this.compilePatternTest(arm.pattern, expr.line);
      this.chunk.emit(Op.JUMP_IF_FALSE, expr.line);
      const nextArm = this.chunk.currentOffset();
      this.chunk.emitI32(0, expr.line);

      this.chunk.emit(Op.POP, expr.line); // subject 제거
      this.compileExpr(arm.body);

      this.chunk.emit(Op.JUMP, expr.line);
      endJumps.push(this.chunk.currentOffset());
      this.chunk.emitI32(0, expr.line);

      this.chunk.patchI32(nextArm, this.chunk.currentOffset());
    }

    this.chunk.emit(Op.POP, expr.line); // fallthrough
    this.chunk.emit(Op.PUSH_VOID, expr.line);

    for (const j of endJumps) {
      this.chunk.patchI32(j, this.chunk.currentOffset());
    }
  }

  // ============================================================
  // 패턴 컴파일
  // ============================================================

  private compilePatternTest(pattern: Pattern, line: number): void {
    switch (pattern.kind) {
      case "wildcard":
      case "ident":
        // 항상 매칭
        this.chunk.emit(Op.POP, line); // DUP된 값 제거
        this.chunk.emit(Op.PUSH_TRUE, line);
        break;
      case "literal":
        this.compileExpr(pattern.value);
        this.chunk.emit(Op.EQ, line);
        break;
      case "none":
        this.chunk.emit(Op.IS_NONE, line);
        break;
      case "some":
        this.chunk.emit(Op.IS_SOME, line);
        break;
      case "ok":
        this.chunk.emit(Op.IS_OK, line);
        break;
      case "err":
        this.chunk.emit(Op.IS_ERR, line);
        break;
    }
  }

  private compilePatternBind(pattern: Pattern, line: number): void {
    // 패턴에서 바인딩 변수 생성
    if (pattern.kind === "ident") {
      // subject가 이미 스택에 있음 — 복원 필요
      // 여기서는 단순화: match body에서 바인딩 변수에 접근 가능하게
      // 실제로는 match subject를 로컬에 저장해야 함
    }
  }

  // ============================================================
  // 스코프 관리
  // ============================================================

  private beginScope(): void {
    this.scopeDepth++;
  }

  private endScope(line: number): void {
    while (this.locals.length > 0 && this.locals[this.locals.length - 1].depth === this.scopeDepth) {
      this.locals.pop();
      this.nextSlot--;
    }
    this.scopeDepth--;
  }

  private declareLocal(name: string): number {
    const slot = this.nextSlot++;
    this.locals.push({ name, slot, depth: this.scopeDepth });
    return slot;
  }

  private resolveLocal(name: string): number {
    for (let i = this.locals.length - 1; i >= 0; i--) {
      if (this.locals[i].name === name) return this.locals[i].slot;
    }
    return -1;
  }
}
