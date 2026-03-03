/**
 * Phase 16-1: Zig Compiler
 * Transforms FreeLang IR to Zig source code
 *
 * Based on Phase 2 Compiler pattern:
 * Pipeline: IR → Analysis → Transformation → AST → Code Generation
 */

import { Inst, Op } from '../types';
import {
  ZigASTNode,
  ZigNodeType,
  ZigParam,
  getZigType,
  getZigOp,
  DEFAULT_ZIG_OPTIONS,
  ZigCompileOptions,
} from './zig-types';

export interface ZigCompileResult {
  success: boolean;
  code: string;
  ast: ZigASTNode;
  stats: {
    linesOfCode: number;
    functions: number;
    variables: number;
    operations: number;
    compilationTimeMs: number;
  };
  errors: string[];
  warnings: string[];
}

/**
 * Analysis result from IR
 */
interface IRAnalysis {
  totalOps: number;
  functionCount: number;
  variableCount: number;
  hasLoops: boolean;
  hasConditionals: boolean;
}

export class ZigCompiler {
  private options: ZigCompileOptions;
  private functions: Map<string, ZigASTNode> = new Map();
  private variables: Map<string, { name: string; type: string }> = new Map();
  private errors: string[] = [];
  private warnings: string[] = [];

  constructor(options: Partial<ZigCompileOptions> = {}) {
    this.options = { ...DEFAULT_ZIG_OPTIONS, ...options };
  }

  /**
   * Main entry point: IR → Zig code
   * Pattern: Analyze → Transform → Generate
   */
  compile(instrs: Inst[], functions?: Map<string, any>): ZigCompileResult {
    const startTime = performance.now();
    this.reset();

    try {
      // Step 1: Analyze IR
      const analysis = this.analyzeIR(instrs);

      // Step 2: Transform IR to AST
      const ast = this.transformIR(instrs);

      // Step 3: Generate Zig code from AST
      const code = this.generateCode(ast);

      const elapsed = performance.now() - startTime;

      return {
        success: this.errors.length === 0,
        code,
        ast,
        stats: {
          linesOfCode: code.split('\n').length,
          functions: this.functions.size,
          variables: this.variables.size,
          operations: analysis.totalOps,
          compilationTimeMs: elapsed,
        },
        errors: this.errors,
        warnings: this.warnings,
      };
    } catch (error) {
      const elapsed = performance.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.errors.push(`Fatal: ${errorMsg}`);

      return {
        success: false,
        code: '',
        ast: { type: 'program' },
        stats: {
          linesOfCode: 0,
          functions: 0,
          variables: 0,
          operations: 0,
          compilationTimeMs: elapsed,
        },
        errors: this.errors,
        warnings: this.warnings,
      };
    }
  }

  /**
   * Step 1: Analyze IR instructions
   */
  private analyzeIR(instrs: Inst[]): IRAnalysis {
    const analysis: IRAnalysis = {
      totalOps: instrs.length,
      functionCount: 0,
      variableCount: 0,
      hasLoops: false,
      hasConditionals: false,
    };

    const varIndices = new Set<number>();

    for (const inst of instrs) {
      // Track variables
      if (inst.op === Op.STORE && typeof inst.arg === 'number') {
        varIndices.add(inst.arg);
      }

      // Detect control flow
      if (inst.op === Op.JMP || inst.op === Op.JMP_IF || inst.op === Op.JMP_NOT) {
        analysis.hasLoops = true;
        analysis.hasConditionals = true;
      }

      // Track functions
      if (inst.op === Op.CALL) {
        analysis.functionCount++;
      }
    }

    analysis.variableCount = varIndices.size;
    return analysis;
  }

  /**
   * Step 2: Transform FreeLang IR to Zig AST
   */
  private transformIR(instrs: Inst[]): ZigASTNode {
    const body: ZigASTNode[] = [];
    const stack: any[] = [];
    const varMap = new Map<number, string>();

    for (let i = 0; i < instrs.length; i++) {
      const inst = instrs[i];

      try {
        switch (inst.op) {
          case Op.PUSH:
            stack.push({ type: 'literal', value: inst.arg });
            break;

          case Op.STORE:
            if (typeof inst.arg === 'number') {
              const varName = `var_${inst.arg}`;
              varMap.set(inst.arg, varName);
              this.variables.set(varName, { name: varName, type: 'f64' });
              const value = stack.pop() || { type: 'literal', value: 0 };
              body.push(this.createAssignmentNode(varName, value));
            }
            break;

          case Op.LOAD:
            if (typeof inst.arg === 'number') {
              const varName = varMap.get(inst.arg) || `var_${inst.arg}`;
              stack.push(this.createIdentifierNode(varName));
            }
            break;

          case Op.ADD:
          case Op.SUB:
          case Op.MUL:
          case Op.DIV:
          case Op.MOD:
            {
              const right = stack.pop();
              const left = stack.pop();
              const zigOp = getZigOp(Op[inst.op]);
              if (zigOp && left && right) {
                const binaryNode = this.createBinaryOpNode(left, right, zigOp.zigOp);
                stack.push(binaryNode);
              } else {
                this.warnings.push(`Unknown operator: ${Op[inst.op]}`);
              }
            }
            break;

          case Op.EQ:
          case Op.NEQ:
          case Op.LT:
          case Op.LTE:
          case Op.GT:
          case Op.GTE:
            {
              const right = stack.pop();
              const left = stack.pop();
              const zigOp = getZigOp(Op[inst.op]);
              if (zigOp && left && right) {
                stack.push(this.createBinaryOpNode(left, right, zigOp.zigOp));
              }
            }
            break;

          case Op.RET:
            {
              const value = stack[stack.length - 1] || { type: 'literal', value: 0 };
              body.push(this.createReturnNode(value));
            }
            break;

          case Op.CALL:
            if (typeof inst.arg === 'number') {
              body.push(this.createFunctionCallNode(`fn_${inst.arg}`, []));
            }
            break;

          // Control flow (basic handling)
          case Op.JMP:
          case Op.JMP_IF:
          case Op.JMP_NOT:
            // TODO: Implement proper loop/conditional handling in Phase 16-2
            this.warnings.push(`Control flow ${Op[inst.op]} not yet fully supported`);
            break;

          default:
            // Silently skip unsupported opcodes
            break;
        }
      } catch (err) {
        this.warnings.push(`Error processing opcode ${Op[inst.op]}: ${err}`);
      }
    }

    return {
      type: 'program',
      body,
    };
  }

  /**
   * Step 3: Generate Zig source code from AST
   */
  private generateCode(ast: ZigASTNode): string {
    let code = 'const std = @import("std");\n\n';

    // Add variable declarations
    for (const [name, info] of this.variables) {
      code += `var ${info.name}: ${info.type} = 0.0;\n`;
    }

    if (this.variables.size > 0) {
      code += '\n';
    }

    // Add function declarations
    if (ast.body) {
      for (const node of ast.body) {
        const nodeCode = this.nodeToCode(node, 0);
        if (nodeCode) {
          code += nodeCode;
        }
      }
    }

    return code;
  }

  /**
   * Convert AST node to Zig code
   */
  private nodeToCode(node: ZigASTNode | undefined, depth: number = 0): string {
    if (!node) return '';

    const indent = '  '.repeat(depth);

    switch (node.type) {
      case 'function':
        return this.functionToCode(node, depth);

      case 'assignment':
        return indent + `${node.name} = ${this.exprToCode(node.value)};\n`;

      case 'return':
        return indent + `return ${this.exprToCode(node.value)};\n`;

      case 'call':
        return indent + `${node.name}();\n`;

      case 'binary_op':
        return `(${this.exprToCode(node.left)} ${node.operator} ${this.exprToCode(node.right)})`;

      case 'identifier':
        return node.name || '';

      case 'literal':
        if (typeof node.value === 'string') {
          return `"${this.escapeString(node.value)}"`;
        }
        return String(node.value);

      default:
        return '';
    }
  }

  private functionToCode(node: ZigASTNode, depth: number): string {
    const indent = '  '.repeat(depth);
    const params = (node.params || [])
      .map(p => `${p.name}: ${p.type}`)
      .join(', ');

    let code = indent + `pub fn ${node.name}(${params}) ${node.returnType || 'void'} {\n`;

    if (node.body) {
      for (const stmt of node.body) {
        code += this.nodeToCode(stmt, depth + 1);
      }
    }

    code += indent + '}\n\n';
    return code;
  }

  private exprToCode(expr: any): string {
    if (expr === null || expr === undefined) return '0';
    if (typeof expr === 'number' || typeof expr === 'boolean') {
      return String(expr);
    }
    if (typeof expr === 'string') {
      return `"${this.escapeString(expr)}"`;
    }
    if (expr && typeof expr === 'object') {
      return this.nodeToCode(expr);
    }
    return '0';
  }

  private escapeString(s: string): string {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');
  }

  // ============= Node Builders =============

  private createLiteralNode(value: any): ZigASTNode {
    return { type: 'literal', value };
  }

  private createIdentifierNode(name: string): ZigASTNode {
    return { type: 'identifier', name };
  }

  private createAssignmentNode(name: string, value: any): ZigASTNode {
    return { type: 'assignment', name, value };
  }

  private createBinaryOpNode(left: any, right: any, operator: string): ZigASTNode {
    return {
      type: 'binary_op',
      left: typeof left === 'object' ? left : this.createLiteralNode(left),
      right: typeof right === 'object' ? right : this.createLiteralNode(right),
      operator,
    };
  }

  private createReturnNode(value: any): ZigASTNode {
    return { type: 'return', value };
  }

  private createFunctionCallNode(name: string, args: any[]): ZigASTNode {
    return { type: 'call', name };
  }

  // ============= Utility =============

  private reset(): void {
    this.functions.clear();
    this.variables.clear();
    this.errors = [];
    this.warnings = [];
  }
}

/**
 * Standalone function: IR → Zig code
 */
export function compileToZig(
  instrs: Inst[],
  options?: Partial<ZigCompileOptions>
): ZigCompileResult {
  const compiler = new ZigCompiler(options);
  return compiler.compile(instrs);
}
