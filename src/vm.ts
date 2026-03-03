// FreeLang v2 VM - Stack-based IR interpreter
// Extended: Now supports strings for Project Ouroboros (Self-Hosting)
// Phase 19: Now supports user-defined functions
// Phase 21: Now supports type-safe execution with runtime validation

import { Op, Inst, VMResult, VMError } from './types';
import { Iterator, IteratorEngine } from './engine/iterator';
import { FunctionRegistry, LocalScope } from './parser/function-registry';
import { FunctionTypeChecker } from './analyzer/type-checker';
import { TypeParser } from './cli/type-parser';
import * as net from 'net';

const MAX_CYCLES = 100_000;
const MAX_STACK  = 10_000;

export interface TypeWarning {
  functionName: string;
  message: string;
  timestamp: Date;
  paramName?: string;
  expectedType?: string;
  receivedType?: string;
}

export class VM {
  private stack: (number | Iterator | string)[] = [];
  private vars: Map<string, number | number[] | Iterator | string> = new Map();
  private pc = 0;
  private cycles = 0;
  private callStack: number[] = [];  // for CALL/RET
  private callbackRegistry: Map<number, Inst[]> = new Map();  // callback_id -> bytecode
  private nextCallbackId = 0;
  private functionRegistry?: FunctionRegistry;  // Phase 19: user-defined functions
  private currentScope?: LocalScope;  // Phase 19: variable scoping
  private typeChecker = new FunctionTypeChecker();  // Phase 21: type-safe execution
  private typeWarnings: TypeWarning[] = [];  // Phase 21: track type warnings

  // ── Network (Phase 26) ──
  private servers: Map<number, net.Server> = new Map();
  private clients: Map<number, net.Socket> = new Map();
  private socketHandleCounter = 1;
  private pendingBindData: Map<number, { port: number }> = new Map();

  // ── Test Framework (Phase 27) ──
  private testResults: Array<{ name: string; passed: boolean; error?: string }> = [];

  constructor(functionRegistry?: FunctionRegistry) {
    this.functionRegistry = functionRegistry;
  }

  /**
   * Phase 21: Infer type of a value
   */
  private inferType(value: any): string {
    return TypeParser.inferType(value);
  }

  /**
   * Phase 21: Infer types of stack top N values
   */
  private inferStackTypes(count: number): string[] {
    const types: string[] = [];
    const startIdx = Math.max(0, this.stack.length - count);
    for (let i = startIdx; i < this.stack.length; i++) {
      types.push(this.inferType(this.stack[i]));
    }
    return types;
  }

  /**
   * Phase 21: Check type compatibility and generate warnings
   */
  private checkTypeCompatibility(funcName: string, argTypes: string[], expectedParams: Record<string, string>, paramNames: string[]): boolean {
    const result = this.typeChecker.checkFunctionCall(
      funcName,
      argTypes,
      expectedParams,
      paramNames
    );

    if (!result.compatible) {
      this.typeWarnings.push({
        functionName: funcName,
        message: result.message,
        timestamp: new Date(),
        paramName: result.details?.paramName,
        expectedType: result.details?.expected,
        receivedType: result.details?.received
      });
      console.warn(`Type warning in '${funcName}': ${result.message}`);
    }

    return result.compatible;
  }

  /**
   * Phase 21: Get type warnings
   */
  getTypeWarnings(): TypeWarning[] {
    return [...this.typeWarnings];
  }

  /**
   * Phase 21: Clear type warnings
   */
  clearTypeWarnings(): void {
    this.typeWarnings = [];
  }

  /**
   * Phase 21: Get warning count
   */
  getWarningCount(): number {
    return this.typeWarnings.length;
  }

  run(program: Inst[]): VMResult {
    this.stack = [];
    this.vars = new Map();
    this.pc = 0;
    this.cycles = 0;
    this.callStack = [];
    const t0 = performance.now();

    try {
      while (this.pc < program.length) {
        if (this.cycles++ > MAX_CYCLES) {
          return this.fail(program[this.pc]?.op ?? Op.HALT, 1, 'cycle_limit');
        }
        const inst = program[this.pc];
        this.exec(inst, program);
        if (inst.op === Op.HALT) break;
      }

      const value = this.stack.length > 0 ? this.stack[this.stack.length - 1] : undefined;
      return { ok: true, value, cycles: this.cycles, ms: performance.now() - t0 };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return this.fail(program[this.pc]?.op ?? Op.HALT, 99, msg, performance.now() - t0);
    }
  }

  private exec(inst: Inst, program: Inst[]): void {
    const { op, arg } = inst;

    switch (op) {
      // ── Stack ──
      case Op.PUSH:
        this.guardStack();
        this.stack.push(arg as number);
        this.pc++;
        break;

      case Op.POP:
        this.need(1);
        this.stack.pop();
        this.pc++;
        break;

      case Op.DUP:
        this.need(1);
        this.guardStack();
        this.stack.push(this.stack[this.stack.length - 1]);
        this.pc++;
        break;

      // ── Arithmetic ──
      case Op.ADD: this.binop((a, b) => a + b); break;
      case Op.SUB: this.binop((a, b) => a - b); break;
      case Op.MUL: this.binop((a, b) => a * b); break;
      case Op.DIV:
        this.need(2);
        if (this.stack[this.stack.length - 1] === 0) {
          throw new Error('div_zero');
        }
        this.binop((a, b) => a / b);
        break;
      case Op.MOD: this.binop((a, b) => a % b); break;
      case Op.NEG:
        this.need(1);
        this.stack[this.stack.length - 1] = -this.stack[this.stack.length - 1];
        this.pc++;
        break;

      // ── Comparison ──
      case Op.EQ:  this.binop((a, b) => a === b ? 1 : 0); break;
      case Op.NEQ: this.binop((a, b) => a !== b ? 1 : 0); break;
      case Op.LT:  this.binop((a, b) => a < b ? 1 : 0); break;
      case Op.GT:  this.binop((a, b) => a > b ? 1 : 0); break;
      case Op.LTE: this.binop((a, b) => a <= b ? 1 : 0); break;
      case Op.GTE: this.binop((a, b) => a >= b ? 1 : 0); break;

      // ── Logic ──
      case Op.AND: this.binop((a, b) => (a && b) ? 1 : 0); break;
      case Op.OR:  this.binop((a, b) => (a || b) ? 1 : 0); break;
      case Op.NOT:
        this.need(1);
        this.stack[this.stack.length - 1] = this.stack[this.stack.length - 1] ? 0 : 1;
        this.pc++;
        break;

      // ── Variables ──
      case Op.STORE:
        this.need(1);
        this.vars.set(arg as string, this.stack.pop()!);
        this.pc++;
        break;

      case Op.LOAD: {
        const v = this.vars.get(arg as string);
        if (v === undefined) throw new Error('undef_var:' + arg);
        if (typeof v === 'number') {
          this.guardStack();
          this.stack.push(v);
        }
        this.pc++;
        break;
      }

      // ── Control ──
      case Op.JMP:
        this.pc = arg as number;
        break;

      case Op.JMP_IF:
        this.need(1);
        this.pc = this.stack.pop()! ? (arg as number) : this.pc + 1;
        break;

      case Op.JMP_NOT:
        this.need(1);
        this.pc = this.stack.pop()! ? this.pc + 1 : (arg as number);
        break;

      case Op.RET:
      case Op.HALT:
        this.pc = program.length; // exit
        break;

      // ── Array ──
      case Op.ARR_NEW:
        this.vars.set(arg as string, []);
        this.pc++;
        break;

      case Op.ARR_PUSH: {
        this.need(1);
        const arr = this.vars.get(arg as string);
        if (!Array.isArray(arr)) throw new Error('not_array:' + arg);
        arr.push(this.stack.pop() as number);
        this.pc++;
        break;
      }

      case Op.ARR_GET: {
        this.need(1);
        const arr = this.vars.get(arg as string);
        if (!Array.isArray(arr)) throw new Error('not_array:' + arg);
        const idx = this.stack.pop() as number;
        if (idx < 0 || idx >= arr.length) throw new Error('oob:' + idx);
        this.guardStack();
        this.stack.push(arr[idx]);
        this.pc++;
        break;
      }

      case Op.ARR_SET: {
        this.need(2);
        const arr = this.vars.get(arg as string);
        if (!Array.isArray(arr)) throw new Error('not_array:' + arg);
        const val = this.stack.pop() as number;
        const idx = this.stack.pop() as number;
        if (idx < 0 || idx >= arr.length) throw new Error('oob:' + idx);
        arr[idx] = val;
        this.pc++;
        break;
      }

      case Op.ARR_LEN: {
        const arr = this.vars.get(arg as string);
        if (!Array.isArray(arr)) throw new Error('not_array:' + arg);
        this.guardStack();
        this.stack.push(arr.length);
        this.pc++;
        break;
      }

      // ── Array Aggregate (AI shorthand) ──
      case Op.ARR_SUM: {
        const arr = this.getArr(arg as string);
        this.guardStack();
        this.stack.push(arr.reduce((s, x) => s + x, 0));
        this.pc++;
        break;
      }

      case Op.ARR_AVG: {
        const arr = this.getArr(arg as string);
        if (arr.length === 0) throw new Error('empty_arr_avg');
        this.guardStack();
        this.stack.push(arr.reduce((s, x) => s + x, 0) / arr.length);
        this.pc++;
        break;
      }

      case Op.ARR_MAX: {
        const arr = this.getArr(arg as string);
        if (arr.length === 0) throw new Error('empty_arr_max');
        this.guardStack();
        this.stack.push(Math.max(...arr));
        this.pc++;
        break;
      }

      case Op.ARR_MIN: {
        const arr = this.getArr(arg as string);
        if (arr.length === 0) throw new Error('empty_arr_min');
        this.guardStack();
        this.stack.push(Math.min(...arr));
        this.pc++;
        break;
      }

      case Op.ARR_SORT: {
        const arr = this.getArr(arg as string);
        arr.sort((a, b) => a - b);
        this.pc++;
        break;
      }

      case Op.ARR_REV: {
        const arr = this.getArr(arg as string);
        arr.reverse();
        this.pc++;
        break;
      }

      case Op.ARR_MAP: {
        const arr = this.getArr(arg as string);
        if (!inst.sub) throw new Error('arr_map_no_sub');
        const result: number[] = [];
        for (const elem of arr) {
          const savedStack = this.stack;
          this.stack = [elem];
          this.runSub(inst.sub);
          const mappedVal = (this.stack.length > 0 ? this.stack[0] : 0) as number;
          result.push(mappedVal);
          this.stack = savedStack;
        }
        this.vars.set(arg as string, result);
        this.pc++;
        break;
      }

      case Op.ARR_FILTER: {
        const arr = this.getArr(arg as string);
        if (!inst.sub) throw new Error('arr_filter_no_sub');
        const result: number[] = [];
        for (const elem of arr) {
          const savedStack = this.stack;
          this.stack = [elem];
          this.runSub(inst.sub);
          const cond = this.stack.length > 0 ? this.stack[0] : 0;
          if (cond) result.push(elem);
          this.stack = savedStack;
        }
        this.vars.set(arg as string, result);
        this.pc++;
        break;
      }

      case Op.CALL: {
        // Phase 19: Support both user-defined functions and legacy sub-programs
        // Phase 21: Add type checking and validation
        const funcName = inst.arg as string;

        // Try user-defined function first
        if (this.functionRegistry && funcName && this.functionRegistry.exists(funcName)) {
          const fn = this.functionRegistry.lookup(funcName);
          if (!fn) throw new Error('function_not_found:' + funcName);

          // Get arguments from stack (right-to-left, so reverse)
          const args: any[] = [];
          for (let i = 0; i < fn.params.length; i++) {
            if (this.stack.length === 0) throw new Error('stack_underflow');
            args.unshift(this.stack.pop());
          }

          // Phase 21: Type checking if function has type annotations
          if (this.functionRegistry.hasTypes(funcName)) {
            const types = this.functionRegistry.getTypes(funcName);
            const argTypes = args.map(arg => this.inferType(arg));

            // Check type compatibility (warnings, not errors)
            this.checkTypeCompatibility(funcName, argTypes, types!.params, fn.params);
          }

          // Create function scope with parameters
          const savedVars = this.vars;
          this.vars = new Map(savedVars);
          for (let i = 0; i < fn.params.length; i++) {
            this.vars.set(fn.params[i], args[i]);
          }

          // Execute function body (generate IR and run)
          const gen = new (require('../codegen/ir-generator').IRGenerator)();
          const bodyIR = gen.generateIR(fn.body);

          const bodyResult = this.runProgram(bodyIR);
          const returnValue = bodyResult.value as (number | Iterator | string | undefined);

          // Restore caller's variables
          this.vars = savedVars;

          // Push return value (skip if undefined)
          if (returnValue !== undefined) {
            this.stack.push(returnValue);
          }
          this.functionRegistry!.trackCall(funcName);
          this.pc++;
        } else if (inst.sub) {
          // Legacy sub-program support
          const subResult = this.runSub(inst.sub);
          if (!subResult.ok) throw new Error('call_failed:' + subResult.error?.detail);
          this.pc++;
        } else {
          throw new Error('call_no_sub');
        }
        break;
      }

      case Op.RET: {
        this.pc = program.length; // exit sub-program
        break;
      }

      // ── Iterator (lazy evaluation) ──
      case Op.ITER_INIT: {
        // stack: [start, end] → [iterator]
        this.need(2);
        const end = this.stack.pop() as number;
        const start = this.stack.pop() as number;
        const iter = IteratorEngine.init(start, end);
        this.guardStack();
        this.stack.push(iter);
        this.pc++;
        break;
      }

      case Op.ITER_HAS: {
        // stack: [iterator] → [bool]
        this.need(1);
        const iter = this.stack[this.stack.length - 1] as Iterator;
        if (!iter || typeof iter !== 'object' || !('current' in iter)) {
          throw new Error('not_iterator');
        }
        const hasMore = IteratorEngine.has(iter);
        this.stack[this.stack.length - 1] = hasMore ? 1 : 0;
        this.pc++;
        break;
      }

      case Op.ITER_NEXT: {
        // stack: [iterator] → [value, iterator]
        this.need(1);
        const iter = this.stack.pop() as Iterator;
        if (!iter || typeof iter !== 'object' || !('current' in iter)) {
          throw new Error('not_iterator');
        }
        const { value, iterator: nextIter } = IteratorEngine.next(iter);
        this.guardStack();
        this.stack.push(value);
        this.guardStack();
        this.stack.push(nextIter);
        this.pc++;
        break;
      }

      // ── String Operations (Project Ouroboros) ──
      case Op.STR_NEW:
        // arg: string → push to stack
        this.guardStack();
        this.stack.push(arg as string);
        this.pc++;
        break;

      case Op.STR_LEN: {
        // stack: [str] → [length]
        this.need(1);
        const str = this.stack[this.stack.length - 1];
        if (typeof str !== 'string') throw new Error('not_string');
        this.stack[this.stack.length - 1] = str.length;
        this.pc++;
        break;
      }

      case Op.STR_AT: {
        // stack: [str, index] → [char]
        this.need(2);
        const idx = this.stack.pop() as number;
        const str = this.stack.pop() as string;
        if (typeof str !== 'string') throw new Error('not_string');
        this.guardStack();
        this.stack.push(str[Math.floor(idx)] || '');
        this.pc++;
        break;
      }

      case Op.STR_SUB: {
        // stack: [str, start, end] → [substr]
        this.need(3);
        const end = this.stack.pop() as number;
        const start = this.stack.pop() as number;
        const str = this.stack.pop() as string;
        if (typeof str !== 'string') throw new Error('not_string');
        this.guardStack();
        this.stack.push(str.substring(Math.floor(start), Math.floor(end)));
        this.pc++;
        break;
      }

      case Op.STR_CONCAT: {
        // stack: [str1, str2] → [str1+str2]
        this.need(2);
        const str2 = this.stack.pop();
        const str1 = this.stack.pop();
        if (typeof str1 !== 'string' || typeof str2 !== 'string') {
          throw new Error('not_string');
        }
        this.guardStack();
        this.stack.push(str1 + str2);
        this.pc++;
        break;
      }

      case Op.STR_EQ: {
        // stack: [str1, str2] → [bool]
        this.need(2);
        const str2 = this.stack.pop();
        const str1 = this.stack.pop();
        if (typeof str1 !== 'string' || typeof str2 !== 'string') {
          throw new Error('not_string');
        }
        this.guardStack();
        this.stack.push(str1 === str2 ? 1 : 0);
        this.pc++;
        break;
      }

      case Op.STR_NEQ: {
        // stack: [str1, str2] → [bool]
        this.need(2);
        const str2 = this.stack.pop();
        const str1 = this.stack.pop();
        if (typeof str1 !== 'string' || typeof str2 !== 'string') {
          throw new Error('not_string');
        }
        this.guardStack();
        this.stack.push(str1 !== str2 ? 1 : 0);
        this.pc++;
        break;
      }

      case Op.CHAR_NEW:
        // arg: char → push to stack
        this.guardStack();
        this.stack.push((arg as string).charAt(0) || '');
        this.pc++;
        break;

      case Op.CHAR_CODE: {
        // stack: [char] → [code]
        this.need(1);
        const char = this.stack[this.stack.length - 1];
        if (typeof char !== 'string' || char.length === 0) {
          throw new Error('not_char');
        }
        this.stack[this.stack.length - 1] = char.charCodeAt(0);
        this.pc++;
        break;
      }

      case Op.CHAR_FROM: {
        // stack: [code] → [char]
        this.need(1);
        const code = this.stack[this.stack.length - 1] as number;
        this.stack[this.stack.length - 1] = String.fromCharCode(Math.floor(code));
        this.pc++;
        break;
      }

      // ── Socket Operations (Phase 26) ──
      case Op.SOCKET_CREATE: {
        // stack: [] → [handle]
        const handle = this.socketHandleCounter++;
        this.guardStack();
        this.stack.push(handle);
        this.pc++;
        break;
      }

      case Op.SOCKET_BIND: {
        // stack: [handle, port] → [handle]
        this.need(2);
        const port = this.stack.pop() as number;
        const handle = this.stack.pop() as number;
        this.pendingBindData.set(handle, { port });
        this.guardStack();
        this.stack.push(handle);
        this.pc++;
        break;
      }

      case Op.SOCKET_LISTEN: {
        // stack: [handle] → [handle]
        this.need(1);
        const handle = this.stack[this.stack.length - 1] as number;
        const bindData = this.pendingBindData.get(handle);
        if (!bindData) throw new Error('socket_not_bound:' + handle);

        const server = net.createServer();
        this.servers.set(handle, server);
        server.listen(bindData.port, '0.0.0.0', () => {
          // Listening
        });
        this.pc++;
        break;
      }

      case Op.TCP_ACCEPT: {
        // stack: [handle] → [client_handle]
        this.need(1);
        const handle = this.stack.pop() as number;
        const server = this.servers.get(handle);
        if (!server) throw new Error('server_not_found:' + handle);

        // Note: For async accept in sync VM, we use a simplified approach
        // In production, this would need async/await support
        const clientHandle = this.socketHandleCounter++;
        // Placeholder: actual acceptance would be async
        this.guardStack();
        this.stack.push(clientHandle);
        this.pc++;
        break;
      }

      case Op.TCP_READ: {
        // stack: [client_fd, size] → [buffer]
        this.need(2);
        const size = this.stack.pop() as number;
        const clientHandle = this.stack.pop() as number;
        const client = this.clients.get(clientHandle);
        if (!client) throw new Error('client_not_found:' + clientHandle);

        // Placeholder: would be async in real implementation
        this.guardStack();
        this.stack.push(''); // Empty buffer placeholder
        this.pc++;
        break;
      }

      case Op.TCP_WRITE: {
        // stack: [client_fd, buffer] → []
        this.need(2);
        const buffer = this.stack.pop();
        const clientHandle = this.stack.pop() as number;
        const client = this.clients.get(clientHandle);
        if (!client) throw new Error('client_not_found:' + clientHandle);

        if (typeof buffer === 'string') {
          client.write(buffer);
        }
        this.pc++;
        break;
      }

      case Op.SOCKET_CLOSE: {
        // stack: [fd] → []
        this.need(1);
        const fd = this.stack.pop() as number;
        const server = this.servers.get(fd);
        const client = this.clients.get(fd);

        if (server) {
          server.close();
          this.servers.delete(fd);
        } else if (client) {
          client.destroy();
          this.clients.delete(fd);
        } else {
          throw new Error('fd_not_found:' + fd);
        }
        this.pc++;
        break;
      }

      case Op.HTTP_PARSE: {
        // stack: [buffer] → [parsed_http_object]
        this.need(1);
        const buffer = this.stack.pop() as string;
        const lines = buffer.split('\r\n');
        if (lines.length < 1) throw new Error('invalid_http');

        const [method, path, version] = lines[0].split(' ');
        // Simplified HTTP parsing - returns method + path for now
        this.guardStack();
        this.stack.push(method);
        this.guardStack();
        this.stack.push(path);
        this.pc++;
        break;
      }

      // ── Test Framework (Phase 27) ──
      case Op.TEST_ASSERT: {
        // stack: [condition, message] → []
        this.need(2);
        const message = this.stack.pop();
        const condition = this.stack.pop();

        const passed = condition ? true : false;
        this.testResults.push({
          name: typeof message === 'string' ? message : 'test',
          passed,
          error: passed ? undefined : 'assertion_failed'
        });
        this.pc++;
        break;
      }

      case Op.TEST_REPORT: {
        // stack: [name, passed] → []
        this.need(2);
        const passed = this.stack.pop();
        const name = this.stack.pop();

        this.testResults.push({
          name: typeof name === 'string' ? name : 'test',
          passed: passed ? true : false
        });
        this.pc++;
        break;
      }

      // ── Debug ──
      case Op.DUMP:
        // AI reads this programmatically, no console.log
        this.pc++;
        break;

      default:
        throw new Error('unknown_op:' + op);
    }
  }

  private binop(fn: (a: number, b: number) => number): void {
    this.need(2);
    const b = this.stack.pop() as number;
    const a = this.stack.pop() as number;
    this.guardStack();
    this.stack.push(fn(a, b));
    this.pc++;
  }

  private need(n: number): void {
    if (this.stack.length < n) {
      throw new Error('stack_underflow:need=' + n + ',have=' + this.stack.length);
    }
  }

  private guardStack(): void {
    if (this.stack.length >= MAX_STACK) {
      throw new Error('stack_overflow');
    }
  }

  private getArr(name: string): number[] {
    const arr = this.vars.get(name);
    if (!Array.isArray(arr)) throw new Error('not_array:' + name);
    return arr;
  }

  private runSub(subProgram: Inst[]): VMResult {
    const savedPc = this.pc;
    this.pc = 0;
    while (this.pc < subProgram.length) {
      if (this.cycles++ > 100_000) {
        const result = this.fail(Op.HALT, 1, 'cycle_limit');
        this.pc = savedPc;
        return result;
      }
      const inst = subProgram[this.pc];
      if (inst.op === Op.RET || inst.op === Op.HALT) {
        this.pc = savedPc;
        break;
      }
      this.exec(inst, subProgram);
    }
    this.pc = savedPc;
    return { ok: true, value: undefined, cycles: this.cycles, ms: 0 };
  }

  /**
   * Phase 19: Run a program IR and return its result
   * Used for function body execution
   */
  private runProgram(program: Inst[]): VMResult {
    const savedPc = this.pc;
    const savedStack = [...this.stack];
    this.pc = 0;

    try {
      while (this.pc < program.length) {
        if (this.cycles++ > 100_000) {
          this.pc = savedPc;
          this.stack = savedStack;
          return this.fail(Op.HALT, 1, 'cycle_limit');
        }
        const inst = program[this.pc];
        if (inst.op === Op.RET || inst.op === Op.HALT) {
          break;
        }
        this.exec(inst, program);
      }

      // Get return value from stack
      const value = this.stack.length > 0 ? this.stack[this.stack.length - 1] : undefined;
      this.pc = savedPc;
      return { ok: true, value, cycles: this.cycles, ms: 0 };
    } catch (e: unknown) {
      this.pc = savedPc;
      this.stack = savedStack;
      const msg = e instanceof Error ? e.message : String(e);
      return this.fail(Op.HALT, 99, msg);
    }
  }

  private fail(op: Op, code: number, detail: string, ms?: number): VMResult {
    return {
      ok: false,
      cycles: this.cycles,
      ms: ms ?? 0,
      error: {
        code,
        op,
        pc: this.pc,
        stack_depth: this.stack.length,
        detail,
      },
    };
  }

  // ── Callback Management (Phase 16-17) ──
  registerCallback(bytecode: Inst[]): number {
    const id = this.nextCallbackId++;
    this.callbackRegistry.set(id, bytecode);
    return id;
  }

  executeCallback(callbackId: number, _args?: any[]): VMResult {
    const bytecode = this.callbackRegistry.get(callbackId);
    if (!bytecode) {
      return this.fail(Op.HALT, 1, `callback_not_found:${callbackId}`);
    }

    // Execute callback bytecode in isolated context
    const savedStack = this.stack;
    const savedVars = this.vars;
    const savedPc = this.pc;

    this.stack = [];
    this.vars = new Map();
    this.pc = 0;

    const result = this.run(bytecode);

    this.stack = savedStack;
    this.vars = savedVars;
    this.pc = savedPc;

    return result;
  }

  // ── State inspection (for AI) ──
  getStack(): readonly unknown[] { return this.stack; }
  getVar(name: string): unknown { return this.vars.get(name); }
  getVarNames(): string[] { return [...this.vars.keys()]; }

  // ── Test inspection ──
  getTestResults() {
    return {
      total: this.testResults.length,
      passed: this.testResults.filter(r => r.passed).length,
      failed: this.testResults.filter(r => !r.passed).length,
      results: this.testResults
    };
  }

  clearTestResults(): void {
    this.testResults = [];
  }
}
