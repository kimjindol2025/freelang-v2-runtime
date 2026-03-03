/**
 * Phase 20.1: Code Generator Base
 *
 * Base class for all code generators
 * - IR → Target-specific code generation
 * - Symbol management
 * - Instruction selection
 * - Register/variable allocation
 * - Output management
 */

import {
  IRGraph,
  IRFunction,
  IRBlock,
  IRNode,
  OperationType,
} from '../../phase-19/ir-base/ir-builder-base';

export type CodeGenTarget =
  | 'c'
  | 'llvm'
  | 'wasm'
  | 'bytecode'
  | 'native'
  | 'assembly'
  | 'javascript'
  | 'typescript'
  | 'custom';

export interface CodeGenConfig {
  target: CodeGenTarget;
  output_file: string;
  optimization_level: 0 | 1 | 2 | 3;
  include_runtime: boolean;
  debug_symbols: boolean;
  verbose: boolean;
}

export interface Symbol {
  name: string;
  type: string;
  scope: 'global' | 'local' | 'parameter';
  offset?: number;
  register?: string;
}

export interface GeneratedCode {
  target: CodeGenTarget;
  code: string;
  symbols: Map<string, Symbol>;
  warnings: string[];
  errors: string[];
  file_size: number;
  generation_time_ms: number;
}

/**
 * Code Generator Base
 * Common foundation for all code generators
 */
export class CodeGeneratorBase {
  protected target: CodeGenTarget;
  protected config: CodeGenConfig;
  protected symbols: Map<string, Symbol>;
  protected code_lines: string[];
  protected warnings: string[];
  protected errors: string[];
  protected variable_counter: number;
  protected label_counter: number;
  protected indent_level: number;

  constructor(config: CodeGenConfig) {
    this.target = config.target;
    this.config = config;
    this.symbols = new Map();
    this.code_lines = [];
    this.warnings = [];
    this.errors = [];
    this.variable_counter = 0;
    this.label_counter = 0;
    this.indent_level = 0;
  }

  // ────────── IR Processing ──────────

  /**
   * Generate code from IR graph
   */
  async generateFromIR(ir_graph: IRGraph): Promise<GeneratedCode> {
    const start_time = Date.now();
    this.code_lines = [];
    this.errors = [];
    this.warnings = [];

    try {
      // Generate code for each function
      for (const func of ir_graph.functions) {
        this.generateFunction(func);
      }

      // Generate global variables
      if (ir_graph.globals.length > 0) {
        this.generateGlobals(ir_graph.globals);
      }

      // Generate header/runtime
      this.generateHeader();

      // Generate footer
      this.generateFooter();
    } catch (error: any) {
      this.errors.push(`Code generation failed: ${error.message}`);
    }

    const code = this.code_lines.join('\n');
    const generation_time = Date.now() - start_time;

    return {
      target: this.target,
      code,
      symbols: new Map(this.symbols),
      warnings: [...this.warnings],
      errors: [...this.errors],
      file_size: code.length,
      generation_time_ms: generation_time,
    };
  }

  /**
   * Generate function code
   */
  protected generateFunction(func: IRFunction): void {
    // Register function parameters as symbols
    for (const param of func.parameters) {
      if (param.metadata?.name) {
        this.symbols.set(param.metadata.name, {
          name: param.metadata.name,
          type: param.metadata.type || 'unknown',
          scope: 'parameter',
        });
      }
    }

    // Generate function declaration
    const func_header = this.generateFunctionHeader(func);
    this.emitLine(func_header);
    this.emitLine('{');
    this.indent();

    // Generate code for each block
    for (const block of func.blocks) {
      this.generateBlock(block);
    }

    this.unindent();
    this.emitLine('}');
    this.emitLine('');
  }

  /**
   * Generate function header
   */
  protected generateFunctionHeader(func: IRFunction): string {
    const param_str = func.parameters
      .map(p => `${p.metadata?.type || 'var'} ${p.metadata?.name || 'param'}`)
      .join(', ');

    return `${func.return_type} ${func.name}(${param_str})`;
  }

  /**
   * Generate block code
   */
  protected generateBlock(block: IRBlock): void {
    if (block.label) {
      this.emitLine(`${block.label}:`);
    }

    // Generate instructions
    for (const instr of block.instructions) {
      this.generateInstruction(instr);
    }

    // Generate control flow
    if (block.successors.length === 0) {
      this.emitLine('return;');
    } else if (block.successors.length === 1) {
      this.emitLine(`goto ${block.successors[0]};`);
    } else if (block.successors.length === 2) {
      this.emitLine(`// branch to ${block.successors[0]} or ${block.successors[1]}`);
    }
  }

  /**
   * Generate instruction code
   */
  protected generateInstruction(instr: IRNode): void {
    const op = instr.operation;

    if (!op) {
      return; // No operation, skip
    }

    switch (op) {
      case 'add':
        this.emitBinaryOp(instr, '+');
        break;
      case 'subtract':
        this.emitBinaryOp(instr, '-');
        break;
      case 'multiply':
        this.emitBinaryOp(instr, '*');
        break;
      case 'divide':
        this.emitBinaryOp(instr, '/');
        break;
      case 'modulo':
        this.emitBinaryOp(instr, '%');
        break;
      case 'load':
        this.emitLoad(instr);
        break;
      case 'store':
        this.emitStore(instr);
        break;
      default:
        this.warnings.push(`Unknown operation: ${op}`);
    }
  }

  /**
   * Emit binary operation
   */
  protected emitBinaryOp(instr: IRNode, op: string): void {
    if (instr.operands.length >= 2) {
      const left = instr.operands[0];
      const right = instr.operands[1];
      this.emitLine(`${instr.id} = ${left} ${op} ${right};`);
    }
  }

  /**
   * Emit load operation
   */
  protected emitLoad(instr: IRNode): void {
    if (instr.operands.length > 0) {
      this.emitLine(`${instr.id} = load ${instr.operands[0]};`);
    }
  }

  /**
   * Emit store operation
   */
  protected emitStore(instr: IRNode): void {
    if (instr.operands.length >= 2) {
      this.emitLine(`store ${instr.operands[0]}, ${instr.operands[1]};`);
    }
  }

  /**
   * Emit return statement
   */
  protected emitReturn(instr: IRNode): void {
    if (instr.operands.length > 0) {
      this.emitLine(`return ${instr.operands[0]};`);
    } else {
      this.emitLine('return;');
    }
  }

  /**
   * Generate global variables
   */
  protected generateGlobals(globals: IRNode[]): void {
    this.emitLine('// Global variables');
    for (const global of globals) {
      if (global.metadata?.name) {
        const type = global.metadata?.type || 'var';
        this.emitLine(`${type} ${global.metadata.name};`);
      }
    }
    this.emitLine('');
  }

  /**
   * Generate header
   */
  protected generateHeader(): void {
    this.code_lines.unshift('// Generated code');
    if (this.config.include_runtime) {
      this.code_lines.unshift('// Runtime included');
    }
  }

  /**
   * Generate footer
   */
  protected generateFooter(): void {
    if (this.config.include_runtime) {
      this.emitLine('// End of generated code');
    }
  }

  // ────────── Symbol Management ──────────

  /**
   * Register symbol
   */
  registerSymbol(name: string, type: string, scope: 'global' | 'local' | 'parameter'): void {
    this.symbols.set(name, { name, type, scope });
  }

  /**
   * Get symbol
   */
  getSymbol(name: string): Symbol | undefined {
    return this.symbols.get(name);
  }

  /**
   * Allocate variable
   */
  allocateVariable(base_name: string = 'var'): string {
    const var_name = `${base_name}_${this.variable_counter++}`;
    this.registerSymbol(var_name, 'unknown', 'local');
    return var_name;
  }

  /**
   * Allocate label
   */
  allocateLabel(base_name: string = 'label'): string {
    return `${base_name}_${this.label_counter++}`;
  }

  // ────────── Code Emission ──────────

  /**
   * Emit line of code
   */
  protected emitLine(code: string): void {
    const indent = '  '.repeat(this.indent_level);
    this.code_lines.push(`${indent}${code}`);
  }

  /**
   * Increase indentation
   */
  protected indent(): void {
    this.indent_level++;
  }

  /**
   * Decrease indentation
   */
  protected unindent(): void {
    if (this.indent_level > 0) {
      this.indent_level--;
    }
  }

  // ────────── Configuration ──────────

  /**
   * Set configuration
   */
  setConfig(config: Partial<CodeGenConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get configuration
   */
  getConfig(): CodeGenConfig {
    return { ...this.config };
  }

  /**
   * Set optimization level
   */
  setOptimizationLevel(level: 0 | 1 | 2 | 3): void {
    this.config.optimization_level = level;
  }

  /**
   * Enable/disable debug symbols
   */
  setDebugSymbols(enabled: boolean): void {
    this.config.debug_symbols = enabled;
  }

  // ────────── Statistics ──────────

  /**
   * Get generation statistics
   */
  getStats(): {
    target: CodeGenTarget;
    code_lines: number;
    symbols_count: number;
    warnings_count: number;
    errors_count: number;
  } {
    return {
      target: this.target,
      code_lines: this.code_lines.length,
      symbols_count: this.symbols.size,
      warnings_count: this.warnings.length,
      errors_count: this.errors.length,
    };
  }

  /**
   * Reset generator
   */
  reset(): void {
    this.symbols.clear();
    this.code_lines = [];
    this.warnings = [];
    this.errors = [];
    this.variable_counter = 0;
    this.label_counter = 0;
    this.indent_level = 0;
  }
}

export default CodeGeneratorBase;
