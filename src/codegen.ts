// FreeLang v2 - IR to C code generator
// Converts AI's IR to compilable C code.

import { Op, Inst, AIIntent, CompileResult } from './types';
import { getBuiltinC } from './engine/builtins';
import { LibraryResolver } from './codegen/library-resolver';

export class CodeGen {
  private resolver: LibraryResolver;

  constructor() {
    this.resolver = new LibraryResolver();
  }

  generate(intent: AIIntent): string {
    const lines: string[] = [];

    // Use LibraryResolver to determine headers based on directive
    const profile = this.resolver.resolveFromHeader({
      fn: intent.fn,
      input: intent.params.length > 0 ? intent.params[0].type : 'void',
      output: intent.ret,
      reason: 'Generated code',
      directive: 'memory', // default directive (speed | memory | safety)
      complexity: 'O(n)',
      confidence: 0.95, // 0.0-1.0 범위
      matched_op: intent.fn,
    });

    const includes = profile.headers;
    const linkerFlags = profile.linkerFlags;

    // Includes
    for (const h of includes) {
      lines.push(`#include <${h}>`);
    }
    lines.push('');

    // Function signature
    const retC = this.typeToC(intent.ret);
    const paramsC = intent.params
      .map(p => {
        const isArray = p.type.startsWith('array<');
        return `${this.typeToC(p.type)} ${p.name}${isArray ? `, int ${p.name}_len` : ''}`;
      })
      .join(', ');
    lines.push(`${retC} ${intent.fn}(${paramsC || 'void'}) {`);

    // Local vars
    const locals = new Set<string>();
    const arrays = new Set<string>();

    for (const inst of intent.body) {
      if (inst.op === Op.STORE && typeof inst.arg === 'string') locals.add(inst.arg);
      if (inst.op === Op.ARR_NEW && typeof inst.arg === 'string') arrays.add(inst.arg);
    }

    // Stack simulation for C
    lines.push('    double _stack[1024];');
    lines.push('    int _sp = 0;');
    if (locals.size > 0) {
      for (const v of locals) {
        lines.push(`    double ${this.safeName(v)} = 0;`);
      }
    }
    lines.push('');

    // Emit instructions
    for (let i = 0; i < intent.body.length; i++) {
      const inst = intent.body[i];
      const c = this.emitInst(inst, intent, i);
      if (c) lines.push('    ' + c);
    }

    lines.push('}');
    lines.push('');

    // main() for testing
    lines.push('int main(void) {');
    lines.push(this.emitTestMain(intent));
    lines.push('    return 0;');
    lines.push('}');

    return lines.join('\n') + '\n';
  }

  private emitInst(inst: Inst, intent: AIIntent, idx: number): string {
    switch (inst.op) {
      case Op.PUSH:
        return `_stack[_sp++] = ${inst.arg};`;

      case Op.POP:
        return '_sp--;';

      case Op.DUP:
        return '_stack[_sp] = _stack[_sp-1]; _sp++;';

      case Op.ADD: return this.emitBinop('+');
      case Op.SUB: return this.emitBinop('-');
      case Op.MUL: return this.emitBinop('*');
      case Op.DIV:
        return '{ double _b = _stack[--_sp]; double _a = _stack[--_sp]; _stack[_sp++] = _b != 0 ? _a / _b : 0; }';
      case Op.MOD:
        return '{ double _b = _stack[--_sp]; double _a = _stack[--_sp]; _stack[_sp++] = (int)_a % (int)_b; }';
      case Op.NEG:
        return '_stack[_sp-1] = -_stack[_sp-1];';

      case Op.EQ:  return this.emitCmp('==');
      case Op.NEQ: return this.emitCmp('!=');
      case Op.LT:  return this.emitCmp('<');
      case Op.GT:  return this.emitCmp('>');
      case Op.LTE: return this.emitCmp('<=');
      case Op.GTE: return this.emitCmp('>=');

      case Op.AND: return this.emitBinop('&&');
      case Op.OR:  return this.emitBinop('||');
      case Op.NOT:
        return '_stack[_sp-1] = !_stack[_sp-1];';

      case Op.STORE:
        return `${this.safeName(inst.arg as string)} = _stack[--_sp];`;

      case Op.LOAD:
        return `_stack[_sp++] = ${this.safeName(inst.arg as string)};`;

      case Op.JMP:
        return `goto _L${inst.arg};`;

      case Op.JMP_IF:
        return `if (_stack[--_sp]) goto _L${inst.arg};`;

      case Op.JMP_NOT:
        return `if (!_stack[--_sp]) goto _L${inst.arg};`;

      case Op.RET:
        return 'return _stack[--_sp];';

      case Op.HALT:
        return 'return _stack[_sp > 0 ? _sp-1 : 0];';

      // Array aggregate - inline C loops
      case Op.ARR_SUM:
        return this.emitArrLoop(inst.arg as string, intent, 'sum');
      case Op.ARR_AVG:
        return this.emitArrLoop(inst.arg as string, intent, 'avg');
      case Op.ARR_MAX:
        return this.emitArrLoop(inst.arg as string, intent, 'max');
      case Op.ARR_MIN:
        return this.emitArrLoop(inst.arg as string, intent, 'min');
      case Op.ARR_SORT:
        return this.emitSort(inst.arg as string, intent);
      case Op.ARR_REV:
        return this.emitReverse(inst.arg as string, intent);

      case Op.ARR_LEN:
        return `_stack[_sp++] = ${this.safeName(inst.arg as string)}_len;`;

      case Op.DUMP:
        return '/* dump */';

      default:
        return `/* unknown op ${inst.op} */`;
    }
  }

  private emitBinop(op: string): string {
    return `{ double _b = _stack[--_sp]; double _a = _stack[--_sp]; _stack[_sp++] = _a ${op} _b; }`;
  }

  private emitCmp(op: string): string {
    return `{ double _b = _stack[--_sp]; double _a = _stack[--_sp]; _stack[_sp++] = (_a ${op} _b) ? 1 : 0; }`;
  }

  private emitArrLoop(arrName: string, intent: AIIntent, mode: string): string {
    const name = this.resolveArrParam(arrName, intent);
    const lenExpr = `${name}_len`;
    switch (mode) {
      case 'sum':
        return `{ double _s = 0; for (int _i = 0; _i < ${lenExpr}; _i++) _s += ${name}[_i]; _stack[_sp++] = _s; }`;
      case 'avg':
        return `{ double _s = 0; for (int _i = 0; _i < ${lenExpr}; _i++) _s += ${name}[_i]; _stack[_sp++] = ${lenExpr} > 0 ? _s / ${lenExpr} : 0; }`;
      case 'max':
        return `{ double _m = ${name}[0]; for (int _i = 1; _i < ${lenExpr}; _i++) if (${name}[_i] > _m) _m = ${name}[_i]; _stack[_sp++] = _m; }`;
      case 'min':
        return `{ double _m = ${name}[0]; for (int _i = 1; _i < ${lenExpr}; _i++) if (${name}[_i] < _m) _m = ${name}[_i]; _stack[_sp++] = _m; }`;
      default:
        return `/* unsupported arr mode ${mode} */`;
    }
  }

  private emitSort(arrName: string, intent: AIIntent): string {
    const name = this.resolveArrParam(arrName, intent);
    // Simple insertion sort in C
    return `{ for (int _i = 1; _i < ${name}_len; _i++) { double _k = ${name}[_i]; int _j = _i - 1; while (_j >= 0 && ${name}[_j] > _k) { ${name}[_j+1] = ${name}[_j]; _j--; } ${name}[_j+1] = _k; } }`;
  }

  private emitReverse(arrName: string, intent: AIIntent): string {
    const name = this.resolveArrParam(arrName, intent);
    return `{ for (int _i = 0; _i < ${name}_len / 2; _i++) { double _t = ${name}[_i]; ${name}[_i] = ${name}[${name}_len-1-_i]; ${name}[${name}_len-1-_i] = _t; } }`;
  }

  private emitTestMain(intent: AIIntent): string {
    const lines: string[] = [];
    // Generate test data based on param types
    for (const p of intent.params) {
      if (p.type === 'array') {
        lines.push(`    double _test_${p.name}[] = {1, 2, 3, 4, 5};`);
        lines.push(`    int _test_${p.name}_len = 5;`);
      } else if (p.type === 'number') {
        lines.push(`    double _test_${p.name} = 10;`);
      }
    }

    // Call function
    const args = intent.params.map(p => {
      if (p.type === 'array') return `_test_${p.name}, _test_${p.name}_len`;
      return `_test_${p.name}`;
    }).join(', ');

    if (intent.ret === 'number') {
      lines.push(`    double _result = ${intent.fn}(${args});`);
      lines.push(`    printf("result=%f\\n", _result);`);
    } else if (intent.ret === 'array') {
      lines.push(`    ${intent.fn}(${args});`);
      for (const p of intent.params) {
        if (p.type === 'array') {
          lines.push(`    for (int _i = 0; _i < _test_${p.name}_len; _i++) printf("%f ", _test_${p.name}[_i]);`);
          lines.push(`    printf("\\n");`);
        }
      }
    } else {
      lines.push(`    ${intent.fn}(${args});`);
    }

    return lines.join('\n');
  }

  private resolveArrParam(arrName: string, intent: AIIntent): string {
    // If arrName matches a param, use param name directly
    for (const p of intent.params) {
      if (p.name === arrName) return arrName;
    }
    return this.safeName(arrName);
  }

  private typeToC(t: string): string {
    switch (t) {
      case 'number': return 'double';
      case 'array':  return 'void'; // arrays passed as pointer + len
      case 'bool':   return 'int';
      case 'string': return 'const char*';
      default:       return 'double';
    }
  }

  private safeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }
}
