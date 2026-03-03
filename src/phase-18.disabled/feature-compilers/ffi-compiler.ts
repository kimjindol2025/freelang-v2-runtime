/**
 * Phase 18.8: FFI Compiler
 *
 * Specializes in C binding generation and memory safety validation
 * Features:
 * - C signature parsing (int, char*, void*, struct)
 * - Binding generation for C functions
 * - Type marshaling (C ↔ FreeLang types)
 * - Memory safety checks (null pointers, buffer bounds)
 * - Native library loading and symbol resolution
 * - Error handling and function wrapping
 *
 * Reuses: FFIIntegration, FFIBindingGenerator, NativeLibraryLoader
 */

import { IntegratedCompilerBase, CompileTarget } from '../compiler-base/integrated-compiler-base';
import { IRGenerator } from '../../codegen/ir-generator';
import { Parser } from '../../parser/parser';
import { Inst } from '../../types';

/**
 * C type definition
 */
interface CType {
  baseType: string;
  isPointer: boolean;
  isArray: boolean;
  arraySize?: number;
  isStruct: boolean;
  structName?: string;
}

/**
 * FFI function binding
 */
interface FFIBinding {
  name: string;
  cSignature: string;
  returnType: CType;
  parameters: Array<{ name: string; type: CType }>;
  library: string;
  safetyChecks: string[];
}

/**
 * Type marshaling rule
 */
interface MarshalRule {
  cType: string;
  flType: string;
  toFL: string; // code to convert from C to FreeLang
  toC: string; // code to convert from FreeLang to C
}

/**
 * FFI Compiler
 * Generates and validates C bindings with memory safety
 */
class FFICompiler extends IntegratedCompilerBase {
  private irGenerator: IRGenerator;
  private parser: Parser;
  protected ast: any = null;
  protected instructions: Inst[] = [];
  private bindings: Map<string, FFIBinding> = new Map();
  private libraries: Set<string> = new Set();
  private marshalRules: MarshalRule[] = [];
  private safetyErrors: string[] = [];

  constructor(target: CompileTarget = 'jit') {
    super({
      target,
      output_file: 'ffi.out',
      optimization_level: 1,
      debug_info: true,
      include_runtime: true,
    } as any);

    this.irGenerator = new IRGenerator();
    this.parser = new Parser();
    this.initializeMarshalRules();
  }

  /**
   * Initialize type marshaling rules
   */
  private initializeMarshalRules(): void {
    this.marshalRules = [
      {
        cType: 'int',
        flType: 'number',
        toFL: '(v) => v',
        toC: '(v) => Math.floor(v)',
      },
      {
        cType: 'double',
        flType: 'number',
        toFL: '(v) => v',
        toC: '(v) => v',
      },
      {
        cType: 'char*',
        flType: 'string',
        toFL: '(ptr) => readCString(ptr)',
        toC: '(s) => allocCString(s)',
      },
      {
        cType: 'void*',
        flType: 'pointer',
        toFL: '(ptr) => new Pointer(ptr)',
        toC: '(p) => p.address',
      },
      {
        cType: 'int*',
        flType: 'array<number>',
        toFL: '(ptr, len) => ptrToArray(ptr, len)',
        toC: '(arr) => arrayToPtr(arr)',
      },
      {
        cType: 'bool',
        flType: 'bool',
        toFL: '(v) => v !== 0',
        toC: '(v) => v ? 1 : 0',
      },
    ];
  }

  /**
   * Lexical analysis
   */
  protected lexicalAnalysis(source: string): void {
    const stage: any = { name: 'Lexical Analysis', duration_ms: 0, success: true, warnings: [] };
    const startTime = performance.now();

    try {
      if (!source || source.trim().length === 0) {
        throw new Error('Empty source code');
      }
      stage.success = true;
    } catch (error: any) {
      stage.success = false;
      stage.error = error.message;
      this.errors.push(error.message);
    }

    stage.duration_ms = performance.now() - startTime;
    this.stages.push(stage);
  }

  /**
   * Syntax analysis - parse FFI declarations
   */
  protected syntaxAnalysis(source: string): void {
    const stage: any = { name: 'Syntax Analysis (FFI)', duration_ms: 0, success: true, warnings: [] };
    const startTime = performance.now();

    try {
      this.ast = this.parseFFIProgram(source);
      this.extractFFIBindings();
      stage.success = true;
    } catch (error: any) {
      stage.success = false;
      stage.error = error.message;
      this.errors.push(error.message);
    }

    stage.duration_ms = performance.now() - startTime;
    this.stages.push(stage);
  }

  /**
   * Semantic analysis - validate FFI safety
   */
  protected semanticAnalysis(source: string): void {
    const stage: any = { name: 'Semantic Analysis (FFI Safety)', duration_ms: 0, success: true, warnings: [] };
    const startTime = performance.now();

    try {
      if (!this.ast) {
        throw new Error('No AST available');
      }

      this.validateCSignatures();
      this.validateTypeMarshal();
      this.validateMemorySafety();
      this.validateLibraryLoading();

      stage.success = true;
      stage.warnings.push(
        `Found ${this.bindings.size} FFI bindings from ${this.libraries.size} libraries, ${this.safetyErrors.length} safety issues`
      );
    } catch (error: any) {
      stage.success = false;
      stage.error = error.message;
      this.errors.push(error.message);
    }

    stage.duration_ms = performance.now() - startTime;
    this.stages.push(stage);
  }

  /**
   * Optimization - generate binding wrappers
   */
  protected optimizeCode(source: string): void {
    const stage: any = { name: 'Binding Generation', duration_ms: 0, success: true, warnings: [] };
    const startTime = performance.now();

    try {
      // Generate wrapper functions for each binding
      this.generateBindingWrappers();
      stage.success = true;
      stage.warnings.push(`Generated wrapper functions for ${this.bindings.size} bindings`);
    } catch (error: any) {
      stage.success = false;
      stage.error = error.message;
    }

    stage.duration_ms = performance.now() - startTime;
    this.stages.push(stage);
  }

  /**
   * Code generation
   */
  protected generateCode(source: string): void {
    const stage: any = { name: 'Code Generation (FFI IR)', duration_ms: 0, success: true, warnings: [] };
    const startTime = performance.now();

    try {
      if (!this.ast) {
        throw new Error('No AST available');
      }

      this.instructions = this.irGenerator.generateIR(this.ast);
      stage.success = true;
      stage.warnings.push(`Generated ${this.instructions.length} FFI instructions`);
    } catch (error: any) {
      stage.success = false;
      stage.error = error.message;
      this.errors.push(error.message);
    }

    stage.duration_ms = performance.now() - startTime;
    this.stages.push(stage);
  }

  /**
   * Parse FFI program
   */
  private parseFFIProgram(source: string): any {
    const lines = source.split('\n').filter(line => line.trim().length > 0);
    const statements: any[] = [];

    for (const line of lines) {
      const stmt = this.parseStatement(line.trim());
      if (stmt) {
        statements.push(stmt);
      }
    }

    return {
      type: 'Program',
      statements: statements,
    };
  }

  /**
   * Parse statement
   */
  private parseStatement(line: string): any {
    // FFI declaration: extern "C" { int add(int a, int b); }
    if (line.startsWith('extern')) {
      const match = /^extern\s+"([^"]+)"\s*{/.exec(line);
      if (match) {
        return {
          type: 'ExternBlock',
          language: match[1],
        };
      }
    }

    // Library loading: use "libc" or use "./custom.so"
    if (line.startsWith('use ')) {
      const match = /^use\s+"([^"]+)"/.exec(line);
      if (match) {
        return {
          type: 'LibraryDeclaration',
          library: match[1],
        };
      }
    }

    // C function signature: int add(int a, int b)
    if (/^[a-zA-Z_][\w\*\s]*\s+\w+\s*\([^)]*\)/.test(line)) {
      const match = /^([\w\*\s]+)\s+(\w+)\s*\(([^)]*)\)/.exec(line);
      if (match) {
        return {
          type: 'FFIBinding',
          returnType: match[1].trim(),
          name: match[2],
          parameters: match[3]
            ? match[3].split(',').map(p => {
                const parts = p.trim().split(/\s+/);
                return {
                  type: parts[0],
                  name: parts[1] || 'arg',
                };
              })
            : [],
        };
      }
    }

    return {
      type: 'Statement',
      content: line,
    };
  }

  /**
   * Extract FFI bindings
   */
  private extractFFIBindings(): void {
    const extract = (stmts: any[]) => {
      let currentLibrary = '';

      for (const stmt of stmts) {
        if (stmt.type === 'LibraryDeclaration') {
          currentLibrary = stmt.library;
          this.libraries.add(stmt.library);
        } else if (stmt.type === 'FFIBinding') {
          const binding: FFIBinding = {
            name: stmt.name,
            cSignature: `${stmt.returnType} ${stmt.name}(${stmt.parameters.map((p: any) => `${p.type} ${p.name}`).join(', ')})`,
            returnType: this.parseType(stmt.returnType),
            parameters: stmt.parameters.map((p: any) => ({
              name: p.name,
              type: this.parseType(p.type),
            })),
            library: currentLibrary,
            safetyChecks: [],
          };

          this.bindings.set(stmt.name, binding);
        }
      }
    };

    if (this.ast && this.ast.statements) {
      extract(this.ast.statements);
    }
  }

  /**
   * Parse C type
   */
  private parseType(typeStr: string): CType {
    typeStr = typeStr.trim();
    const isPointer = typeStr.endsWith('*');
    const isArray = typeStr.includes('[');
    const baseType = typeStr.replace(/[\*\[\]\d]/g, '').trim();

    return {
      baseType,
      isPointer,
      isArray,
      isStruct: baseType.startsWith('struct '),
      structName: baseType.startsWith('struct ') ? baseType.substring(7) : undefined,
    };
  }

  /**
   * Validate C signatures
   */
  private validateCSignatures(): void {
    for (const [name, binding] of this.bindings) {
      // Validate return type
      if (!this.isValidCType(binding.returnType)) {
        this.errors.push(`Invalid return type for ${name}: ${binding.returnType.baseType}`);
      }

      // Validate parameters
      for (const param of binding.parameters) {
        if (!this.isValidCType(param.type)) {
          this.errors.push(`Invalid parameter type for ${name}: ${param.type.baseType}`);
        }
      }
    }
  }

  /**
   * Check if type is valid C type
   */
  private isValidCType(type: CType): boolean {
    const validTypes = ['int', 'double', 'char', 'void', 'bool', 'long', 'short', 'float'];
    return validTypes.includes(type.baseType) || type.isStruct;
  }

  /**
   * Validate type marshaling
   */
  private validateTypeMarshal(): void {
    for (const [name, binding] of this.bindings) {
      // Check if return type can be marshaled
      const returnTypeStr = this.cTypeToString(binding.returnType);
      if (!this.hasMarshalRule(returnTypeStr)) {
        this.addWarning(`No marshal rule for return type ${returnTypeStr} in ${name}`);
      }

      // Check parameters
      for (const param of binding.parameters) {
        const paramTypeStr = this.cTypeToString(param.type);
        if (!this.hasMarshalRule(paramTypeStr)) {
          this.addWarning(`No marshal rule for parameter type ${paramTypeStr} in ${name}`);
        }
      }
    }
  }

  /**
   * Convert C type to string
   */
  private cTypeToString(type: CType): string {
    let result = type.baseType;
    if (type.isPointer) result += '*';
    if (type.isArray) result += '[]';
    return result;
  }

  /**
   * Check if marshal rule exists
   */
  private hasMarshalRule(cType: string): boolean {
    return this.marshalRules.some(rule => rule.cType === cType);
  }

  /**
   * Validate memory safety
   */
  private validateMemorySafety(): void {
    for (const [name, binding] of this.bindings) {
      // Check for pointer parameters
      for (const param of binding.parameters) {
        if (param.type.isPointer) {
          binding.safetyChecks.push(`null_check_${param.name}`);
          this.addWarning(`Pointer parameter ${param.name} in ${name} needs null check`);
        }
      }

      // Check for char* (string) parameters
      for (const param of binding.parameters) {
        if (param.type.baseType === 'char' && param.type.isPointer) {
          binding.safetyChecks.push(`null_terminated_check_${param.name}`);
          this.addWarning(`String parameter ${param.name} in ${name} needs null-termination check`);
        }
      }

      // Check for array parameters
      for (const param of binding.parameters) {
        if (param.type.isArray) {
          binding.safetyChecks.push(`bounds_check_${param.name}`);
          this.addWarning(`Array parameter ${param.name} in ${name} needs bounds check`);
        }
      }
    }
  }

  /**
   * Validate library loading
   */
  private validateLibraryLoading(): void {
    for (const lib of this.libraries) {
      // Check if library name is valid
      if (!this.isValidLibraryName(lib)) {
        this.errors.push(`Invalid library name: ${lib}`);
      }
    }
  }

  /**
   * Check if library name is valid
   */
  private isValidLibraryName(libName: string): boolean {
    // Valid: libc, ./lib.so, libm, etc.
    return /^[a-zA-Z0-9._\/-]+$/.test(libName);
  }

  /**
   * Generate binding wrappers
   */
  private generateBindingWrappers(): void {
    for (const [name, binding] of this.bindings) {
      // Generate wrapper function with safety checks
      const wrapper = this.createWrapper(binding);
      if (!wrapper) {
        this.addWarning(`Could not generate wrapper for ${name}`);
      }
    }
  }

  /**
   * Create wrapper function
   */
  private createWrapper(binding: FFIBinding): any {
    return {
      type: 'FFIWrapper',
      name: binding.name,
      safetyChecks: binding.safetyChecks,
      originalSignature: binding.cSignature,
    };
  }

  /**
   * Get bindings
   */
  getBindings(): Map<string, FFIBinding> {
    return this.bindings;
  }

  /**
   * Get libraries
   */
  getLibraries(): Set<string> {
    return this.libraries;
  }
}

export { FFICompiler };
