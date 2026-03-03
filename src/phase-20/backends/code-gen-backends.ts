/**
 * Phase 20.2: Code Generator Backends (9 Implementations)
 *
 * Nine different code generation targets:
 * 1. C Backend - C language output
 * 2. LLVM Backend - LLVM IR generation
 * 3. WASM Backend - WebAssembly output
 * 4. Bytecode Backend - VM bytecode
 * 5. Native Backend - Assembly/Machine code
 * 6. JavaScript Backend - JavaScript output
 * 7. TypeScript Backend - TypeScript output
 * 8. Custom Backend - Domain-specific
 * 9. Hybrid Backend - Multi-target
 */

import CodeGeneratorBase, { CodeGenConfig, GeneratedCode } from '../codegen-base/code-generator-base';
import { IRGraph, IRFunction, IRBlock, IRNode } from '../../phase-19/ir-base/ir-builder-base';

// ────────── 1. C Backend ──────────

export class CCodeGenerator extends CodeGeneratorBase {
  constructor() {
    const config: CodeGenConfig = {
      target: 'c',
      output_file: 'output.c',
      optimization_level: 2,
      include_runtime: true,
      debug_symbols: false,
      verbose: false,
    };
    super(config);
  }

  protected generateHeader(): void {
    this.code_lines.unshift('#include <stdio.h>');
    this.code_lines.unshift('#include <stdlib.h>');
  }

  protected generateFunctionHeader(func: IRFunction): string {
    const param_str = func.parameters
      .map(p => `${p.metadata?.type || 'int'} ${p.metadata?.name || 'param'}`)
      .join(', ');

    return `${func.return_type || 'int'} ${func.name}(${param_str || 'void'})`;
  }

  protected emitBinaryOp(instr: IRNode, op: string): void {
    if (instr.operands.length >= 2) {
      const left = instr.operands[0];
      const right = instr.operands[1];
      const type = instr.result_type || 'int';
      this.emitLine(`${type} ${instr.id} = ${left} ${op} ${right};`);
    }
  }
}

// ────────── 2. LLVM Backend ──────────

export class LLVMCodeGenerator extends CodeGeneratorBase {
  constructor() {
    const config: CodeGenConfig = {
      target: 'llvm',
      output_file: 'output.ll',
      optimization_level: 2,
      include_runtime: true,
      debug_symbols: false,
      verbose: false,
    };
    super(config);
  }

  protected generateFunctionHeader(func: IRFunction): string {
    const llvm_type = this.mapToLLVMType(func.return_type || 'void');
    const param_str = func.parameters
      .map(p => `${this.mapToLLVMType(p.metadata?.type || 'i32')} %${p.metadata?.name || 'param'}`)
      .join(', ');

    return `define ${llvm_type} @${func.name}(${param_str || ''})`;
  }

  private mapToLLVMType(type: string): string {
    const mapping: Record<string, string> = {
      i32: 'i32',
      i64: 'i64',
      f32: 'float',
      f64: 'double',
      bool: 'i1',
      void: 'void',
    };
    return mapping[type] || 'i32';
  }

  protected emitBinaryOp(instr: IRNode, op: string): void {
    if (instr.operands.length >= 2) {
      const llvm_op = this.mapLLVMOp(op);
      this.emitLine(`%${instr.id} = ${llvm_op} i32 %${instr.operands[0]}, %${instr.operands[1]}`);
    }
  }

  private mapLLVMOp(op: string): string {
    const ops: Record<string, string> = {
      '+': 'add',
      '-': 'sub',
      '*': 'mul',
      '/': 'sdiv',
      '%': 'srem',
    };
    return ops[op] || 'unknown';
  }
}

// ────────── 3. WASM Backend ──────────

export class WASMCodeGenerator extends CodeGeneratorBase {
  private wasm_buffer: number[] = [];

  constructor() {
    const config: CodeGenConfig = {
      target: 'wasm',
      output_file: 'output.wasm',
      optimization_level: 2,
      include_runtime: false,
      debug_symbols: false,
      verbose: false,
    };
    super(config);
  }

  protected generateHeader(): void {
    this.code_lines.unshift(';; WebAssembly module');
    this.code_lines.unshift('(module');
  }

  protected generateFooter(): void {
    this.code_lines.push(')');
  }

  protected generateFunctionHeader(func: IRFunction): string {
    const param_str = func.parameters
      .map((p, i) => `(param $${p.metadata?.name || `p${i}`} i32)`)
      .join(' ');

    const result = func.return_type && func.return_type !== 'void' ? `(result i32)` : '';

    return `(func $${func.name} ${param_str} ${result}`;
  }

  protected generateBlock(block: IRBlock): void {
    if (block.label) {
      this.emitLine(`(block $${block.label}`);
      this.indent();
    }

    for (const instr of block.instructions) {
      this.generateInstruction(instr);
    }

    if (block.label) {
      this.unindent();
      this.emitLine(`)`);
    }
  }

  protected emitBinaryOp(instr: IRNode, op: string): void {
    if (instr.operands.length >= 2) {
      const wasm_op = this.mapWASMOp(op);
      this.emitLine(`(${wasm_op})`);
    }
  }

  private mapWASMOp(op: string): string {
    const ops: Record<string, string> = {
      '+': 'i32.add',
      '-': 'i32.sub',
      '*': 'i32.mul',
      '/': 'i32.div_s',
    };
    return ops[op] || 'i32.add';
  }
}

// ────────── 4. Bytecode Backend ──────────

export class BytecodeGenerator extends CodeGeneratorBase {
  private bytecode: Uint8Array[] = [];
  private instruction_set: Map<string, number> = new Map([
    ['push', 0x01],
    ['add', 0x02],
    ['sub', 0x03],
    ['mul', 0x04],
    ['div', 0x05],
    ['load', 0x06],
    ['store', 0x07],
    ['ret', 0x08],
  ]);

  constructor() {
    const config: CodeGenConfig = {
      target: 'bytecode',
      output_file: 'output.bytecode',
      optimization_level: 1,
      include_runtime: true,
      debug_symbols: false,
      verbose: false,
    };
    super(config);
  }

  async generateFromIR(ir_graph: IRGraph): Promise<GeneratedCode> {
    const result = await super.generateFromIR(ir_graph);

    // Convert code lines to bytecode representation
    const bytecode_hex = this.code_lines.map(line => {
      for (const [instr, opcode] of this.instruction_set) {
        if (line.includes(instr)) {
          return `0x${opcode.toString(16).padStart(2, '0')}`;
        }
      }
      return '0x00';
    });

    return {
      ...result,
      code: bytecode_hex.join(' '),
    };
  }

  protected emitBinaryOp(instr: IRNode, op: string): void {
    const opcode_map: Record<string, string> = {
      '+': 'add',
      '-': 'sub',
      '*': 'mul',
      '/': 'div',
    };
    const opcode = opcode_map[op] || 'add';
    this.emitLine(`${opcode}`);
  }
}

// ────────── 5. Native Backend ──────────

export class NativeCodeGenerator extends CodeGeneratorBase {
  constructor() {
    const config: CodeGenConfig = {
      target: 'native',
      output_file: 'output.asm',
      optimization_level: 3,
      include_runtime: true,
      debug_symbols: false,
      verbose: false,
    };
    super(config);
  }

  protected generateHeader(): void {
    this.code_lines.unshift('; x86-64 Assembly');
    this.code_lines.unshift('section .data');
  }

  protected generateFunctionHeader(func: IRFunction): string {
    return `${func.name}:`;
  }

  protected emitBinaryOp(instr: IRNode, op: string): void {
    if (instr.operands.length >= 2) {
      const asm_op = this.mapAssemblyOp(op);
      this.emitLine(`${asm_op} rax, rbx`);
    }
  }

  private mapAssemblyOp(op: string): string {
    const ops: Record<string, string> = {
      '+': 'add',
      '-': 'sub',
      '*': 'imul',
      '/': 'idiv',
    };
    return ops[op] || 'add';
  }
}

// ────────── 6. JavaScript Backend ──────────

export class JavaScriptCodeGenerator extends CodeGeneratorBase {
  constructor() {
    const config: CodeGenConfig = {
      target: 'javascript',
      output_file: 'output.js',
      optimization_level: 1,
      include_runtime: false,
      debug_symbols: false,
      verbose: false,
    };
    super(config);
  }

  protected generateHeader(): void {
    this.code_lines.unshift("'use strict';");
  }

  protected generateFunctionHeader(func: IRFunction): string {
    const param_str = func.parameters
      .map(p => p.metadata?.name || 'param')
      .join(', ');

    return `function ${func.name}(${param_str})`;
  }

  protected emitBinaryOp(instr: IRNode, op: string): void {
    if (instr.operands.length >= 2) {
      this.emitLine(`const ${instr.id} = ${instr.operands[0]} ${op} ${instr.operands[1]};`);
    }
  }

  protected emitReturn(instr: IRNode): void {
    if (instr.operands.length > 0) {
      this.emitLine(`return ${instr.operands[0]};`);
    } else {
      this.emitLine('return;');
    }
  }
}

// ────────── 7. TypeScript Backend ──────────

export class TypeScriptCodeGenerator extends CodeGeneratorBase {
  constructor() {
    const config: CodeGenConfig = {
      target: 'typescript',
      output_file: 'output.ts',
      optimization_level: 1,
      include_runtime: false,
      debug_symbols: true,
      verbose: false,
    };
    super(config);
  }

  protected generateHeader(): void {
    this.code_lines.unshift("'use strict';");
  }

  protected generateFunctionHeader(func: IRFunction): string {
    const param_str = func.parameters
      .map(p => `${p.metadata?.name || 'param'}: ${p.metadata?.type || 'unknown'}`)
      .join(', ');

    const return_type = func.return_type || 'void';

    return `function ${func.name}(${param_str}): ${return_type}`;
  }

  protected emitBinaryOp(instr: IRNode, op: string): void {
    if (instr.operands.length >= 2) {
      const type = instr.result_type || 'number';
      this.emitLine(`const ${instr.id}: ${type} = ${instr.operands[0]} ${op} ${instr.operands[1]};`);
    }
  }
}

// ────────── 8. Custom Backend ──────────

export class CustomCodeGenerator extends CodeGeneratorBase {
  private domain: string;

  constructor(domain: string = 'generic') {
    const config: CodeGenConfig = {
      target: 'custom',
      output_file: `output.${domain}`,
      optimization_level: 1,
      include_runtime: false,
      debug_symbols: false,
      verbose: false,
    };
    super(config);
    this.domain = domain;
  }

  protected generateHeader(): void {
    this.code_lines.unshift(`// Domain: ${this.domain}`);
  }

  getDomain(): string {
    return this.domain;
  }

  setDomain(domain: string): void {
    this.domain = domain;
    this.config.output_file = `output.${domain}`;
  }
}

// ────────── 9. Hybrid Backend ──────────

export class HybridCodeGenerator extends CodeGeneratorBase {
  private backends: Map<string, CodeGeneratorBase> = new Map();

  constructor() {
    const config: CodeGenConfig = {
      target: 'custom',
      output_file: 'output.hybrid',
      optimization_level: 2,
      include_runtime: true,
      debug_symbols: true,
      verbose: false,
    };
    super(config);
    this.initializeBackends();
  }

  private initializeBackends(): void {
    this.backends.set('c', new CCodeGenerator());
    this.backends.set('llvm', new LLVMCodeGenerator());
    this.backends.set('wasm', new WASMCodeGenerator());
    this.backends.set('bytecode', new BytecodeGenerator());
    this.backends.set('native', new NativeCodeGenerator());
    this.backends.set('javascript', new JavaScriptCodeGenerator());
    this.backends.set('typescript', new TypeScriptCodeGenerator());
  }

  async generateForMultipleTargets(ir_graph: IRGraph): Promise<Map<string, GeneratedCode>> {
    const results = new Map<string, GeneratedCode>();

    for (const [target, backend] of this.backends) {
      const result = await backend.generateFromIR(ir_graph);
      results.set(target, result);
    }

    return results;
  }

  getBackend(target: string): CodeGeneratorBase | undefined {
    return this.backends.get(target);
  }

  getAvailableBackends(): string[] {
    return Array.from(this.backends.keys());
  }
}

// ────────── Code Generator Factory ──────────

export class CodeGeneratorFactory {
  /**
   * Create code generator for target
   */
  static create(target: string): CodeGeneratorBase {
    const targetLower = target.toLowerCase();

    switch (targetLower) {
      case 'c':
        return new CCodeGenerator();
      case 'llvm':
        return new LLVMCodeGenerator();
      case 'wasm':
        return new WASMCodeGenerator();
      case 'bytecode':
        return new BytecodeGenerator();
      case 'native':
        return new NativeCodeGenerator();
      case 'javascript':
      case 'js':
        return new JavaScriptCodeGenerator();
      case 'typescript':
      case 'ts':
        return new TypeScriptCodeGenerator();
      case 'custom':
        return new CustomCodeGenerator();
      case 'hybrid':
        return new HybridCodeGenerator();
      default:
        return new CCodeGenerator();
    }
  }

  /**
   * List available backends
   */
  static availableBackends(): string[] {
    return ['c', 'llvm', 'wasm', 'bytecode', 'native', 'javascript', 'typescript', 'custom', 'hybrid'];
  }

  /**
   * Get backend description
   */
  static getDescription(target: string): string {
    const descriptions: Record<string, string> = {
      c: 'C language code generation',
      llvm: 'LLVM Intermediate Representation',
      wasm: 'WebAssembly binary output',
      bytecode: 'VM bytecode format',
      native: 'x86-64 Assembly generation',
      javascript: 'JavaScript code generation',
      typescript: 'TypeScript code generation',
      custom: 'Domain-specific code generation',
      hybrid: 'Multi-target code generation',
    };

    return descriptions[target] || 'Unknown code generator';
  }
}

export default CodeGeneratorFactory;
