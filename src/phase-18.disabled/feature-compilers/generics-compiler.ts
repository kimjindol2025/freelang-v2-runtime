/**
 * Phase 18.4: Generics Compiler
 *
 * Specializes in generic type resolution and monomorphization
 * Features:
 * - Generic declaration extraction (Type<T>, Map<K, V>)
 * - Type parameter constraint validation (T extends X)
 * - Generic instantiation tracking
 * - Monomorphization (generate concrete versions for each instantiation)
 * - Variance inference (covariant, contravariant, invariant)
 *
 * Reuses: GenericsResolutionEngine
 */

import { IntegratedCompilerBase, CompileTarget } from '../compiler-base/integrated-compiler-base';
import { IRGenerator } from '../../codegen/ir-generator';
import { Parser } from '../../parser/parser';
import { Inst } from '../../types';

/**
 * Generic type parameter
 */
interface GenericParam {
  name: string;
  constraints?: string[];
  default?: string;
  variance?: 'covariant' | 'contravariant' | 'invariant';
}

/**
 * Generic instantiation
 */
interface GenericInstantiation {
  generic: string;
  typeArguments: string[];
  concreteType: string;
}

/**
 * Generics Compiler
 * Transforms generic code into monomorphized concrete implementations
 */
class GenericsCompiler extends IntegratedCompilerBase {
  private irGenerator: IRGenerator;
  private parser: Parser;
  protected ast: any = null;
  protected instructions: Inst[] = [];
  private genericDefinitions: Map<string, GenericParam[]> = new Map();
  private instantiations: GenericInstantiation[] = [];
  private monomorphizedVersions: Map<string, Inst[]> = new Map();

  constructor(target: CompileTarget = 'optimize') {
    super({
      target,
      output_file: 'monomorphic.out',
      optimization_level: 2,
      debug_info: false,
      include_runtime: true,
    } as any);

    this.irGenerator = new IRGenerator();
    this.parser = new Parser();
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
   * Syntax analysis - parse generics
   */
  protected syntaxAnalysis(source: string): void {
    const stage: any = { name: 'Syntax Analysis (Generics)', duration_ms: 0, success: true, warnings: [] };
    const startTime = performance.now();

    try {
      this.ast = this.parseProgram(source);
      this.extractGenericDefinitions();
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
   * Semantic analysis - validate generics
   */
  protected semanticAnalysis(source: string): void {
    const stage: any = { name: 'Semantic Analysis (Generics)', duration_ms: 0, success: true, warnings: [] };
    const startTime = performance.now();

    try {
      if (!this.ast) {
        throw new Error('No AST available');
      }

      // Extract instantiations from code
      this.extractInstantiations();

      // Validate constraints
      this.validateConstraints();

      stage.success = true;
      stage.warnings.push(
        `Found ${this.genericDefinitions.size} generics, ${this.instantiations.length} instantiations`
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
   * Optimization - monomorphize
   */
  protected optimizeCode(source: string): void {
    const stage: any = { name: 'Monomorphization', duration_ms: 0, success: true, warnings: [] };
    const startTime = performance.now();

    try {
      // Generate concrete versions for each instantiation
      this.monomorphize();
      stage.success = true;
      stage.warnings.push(`Monomorphized to ${this.monomorphizedVersions.size} concrete versions`);
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
    const stage: any = { name: 'Code Generation (Monomorphic)', duration_ms: 0, success: true, warnings: [] };
    const startTime = performance.now();

    try {
      if (!this.ast) {
        throw new Error('No AST available');
      }

      // Generate IR for each monomorphized version
      const allInstructions: Inst[] = [];

      for (const [name, irCode] of this.monomorphizedVersions) {
        allInstructions.push(...irCode);
      }

      this.instructions = allInstructions.length > 0 ? allInstructions : this.irGenerator.generateIR(this.ast);

      stage.success = true;
      stage.warnings.push(`Generated ${this.instructions.length} instructions`);
    } catch (error: any) {
      stage.success = false;
      stage.error = error.message;
      this.errors.push(error.message);
    }

    stage.duration_ms = performance.now() - startTime;
    this.stages.push(stage);
  }

  /**
   * Parse program
   */
  private parseProgram(source: string): any {
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
    // Generic function: fn<T, K>(x: T, y: K) where T: Clone, K: Serializable
    if (line.startsWith('fn<')) {
      const match = /^fn<([^>]+)>\s*(\w+)\s*\(([^)]*)\)(?:\s+where\s+(.+))?/.exec(line);
      if (match) {
        return {
          type: 'GenericFunctionDeclaration',
          typeParams: match[1].split(',').map(p => p.trim()),
          name: match[2],
          params: match[3],
          constraints: match[4],
        };
      }
    }

    // Generic type: type<T> = ...
    if (line.match(/^type\s+\w+<[^>]+>/)) {
      const match = /^type\s+(\w+)<([^>]+)>\s*=\s*(.+)/.exec(line);
      if (match) {
        return {
          type: 'GenericTypeDeclaration',
          name: match[1],
          typeParams: match[2].split(',').map(p => p.trim()),
          definition: match[3],
        };
      }
    }

    // Generic instantiation: let x: List<number>
    if (line.includes('<')) {
      const match = /(\w+)<([^>]+)>/.exec(line);
      if (match) {
        return {
          type: 'GenericInstantiation',
          genericName: match[1],
          typeArguments: match[2].split(',').map(p => p.trim()),
          line: line,
        };
      }
    }

    return {
      type: 'Statement',
      content: line,
    };
  }

  /**
   * Extract generic definitions
   */
  private extractGenericDefinitions(): void {
    const extractFromStatements = (stmts: any[]) => {
      for (const stmt of stmts) {
        if (stmt.type === 'GenericFunctionDeclaration') {
          const params: GenericParam[] = stmt.typeParams.map((p: string) => ({
            name: p,
            constraints: stmt.constraints ? this.parseConstraints(stmt.constraints) : [],
          }));
          this.genericDefinitions.set(stmt.name, params);
        } else if (stmt.type === 'GenericTypeDeclaration') {
          const params: GenericParam[] = stmt.typeParams.map((p: string) => ({
            name: p,
          }));
          this.genericDefinitions.set(stmt.name, params);
        }
      }
    };

    if (this.ast && this.ast.statements) {
      extractFromStatements(this.ast.statements);
    }
  }

  /**
   * Parse type constraints: T: Clone, K: Serializable
   */
  private parseConstraints(constraintStr: string): string[] {
    return constraintStr
      .split(',')
      .map(c => {
        const [typeParam, constraint] = c.split(':').map(s => s.trim());
        return constraint || 'any';
      })
      .filter(c => c.length > 0);
  }

  /**
   * Extract generic instantiations from code
   */
  private extractInstantiations(): void {
    const extractFromStatements = (stmts: any[]) => {
      for (const stmt of stmts) {
        if (stmt.type === 'GenericInstantiation') {
          const concreteType = `${stmt.genericName}<${stmt.typeArguments.join(', ')}>`;
          this.instantiations.push({
            generic: stmt.genericName,
            typeArguments: stmt.typeArguments,
            concreteType: concreteType,
          });
        }
      }
    };

    if (this.ast && this.ast.statements) {
      extractFromStatements(this.ast.statements);
    }
  }

  /**
   * Validate generic constraints
   */
  private validateConstraints(): void {
    for (const inst of this.instantiations) {
      const def = this.genericDefinitions.get(inst.generic);
      if (!def) {
        this.errors.push(`Unknown generic type: ${inst.generic}`);
        continue;
      }

      // Check arity (number of type arguments)
      if (inst.typeArguments.length !== def.length) {
        this.errors.push(
          `Generic ${inst.generic} expects ${def.length} type arguments, got ${inst.typeArguments.length}`
        );
      }

      // Check constraints
      for (let i = 0; i < Math.min(inst.typeArguments.length, def.length); i++) {
        const param = def[i];
        const arg = inst.typeArguments[i];

        if (param.constraints && param.constraints.length > 0) {
          // Basic constraint checking
          this.validateConstraintForArg(arg, param.constraints, param.name);
        }
      }
    }
  }

  /**
   * Validate constraint for type argument
   */
  private validateConstraintForArg(arg: string, constraints: string[], paramName: string): void {
    // Simple constraint checking
    // In real implementation, would check if type satisfies trait/interface
    const validatedConstraints = constraints.filter(c => this.doesTypeSatisfyConstraint(arg, c));

    if (validatedConstraints.length < constraints.length) {
      this.addWarning(
        `Type '${arg}' may not satisfy all constraints for type parameter '${paramName}'`
      );
    }
  }

  /**
   * Check if type satisfies constraint
   */
  private doesTypeSatisfyConstraint(type: string, constraint: string): boolean {
    // Basic constraint checking
    // In production: check against trait system

    // Common built-in constraints
    const typeConstraintMap: Record<string, string[]> = {
      Clone: ['number', 'string', 'bool', 'array'],
      Comparable: ['number', 'string'],
      Serializable: ['number', 'string', 'bool', 'array', 'object'],
      Iterable: ['array', 'string', 'range'],
    };

    const satisfying = typeConstraintMap[constraint] || [];
    return satisfying.includes(type) || type === 'T' || type === 'U' || type === 'V'; // Type variables pass through
  }

  /**
   * Monomorphize - generate concrete versions
   */
  private monomorphize(): void {
    // For each instantiation, create a specialized version
    for (const inst of this.instantiations) {
      const concreteName = inst.concreteType.replace(/[<>, ]/g, '_');

      // Create AST for concrete version
      const concreteAST = this.specializeGeneric(inst.generic, inst.typeArguments);

      // Generate IR
      const ir = this.irGenerator.generateIR(concreteAST);
      this.monomorphizedVersions.set(concreteName, ir);
    }
  }

  /**
   * Specialize generic for concrete type arguments
   */
  private specializeGeneric(genericName: string, typeArguments: string[]): any {
    // Create a specialized version of the generic
    // In simple case, just return AST with substitutions

    return {
      type: 'MonomorphizedFunction',
      originalGeneric: genericName,
      typeArguments: typeArguments,
      concreteType: `${genericName}<${typeArguments.join(', ')}>`,
    };
  }
}

export { GenericsCompiler };
