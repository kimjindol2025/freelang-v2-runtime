/**
 * Phase 2 Task 2.1: Stub Generator for Incomplete Code
 *
 * Generates type-aware stub values for incomplete code
 */

import { FunctionStatement, BlockStatement, Expression, Statement } from '../parser/ast';

/**
 * Configuration for stub generation
 */
export interface StubGeneratorConfig {
  defaultValue: boolean;  // true: basic default (0, "", []), false: null
  autoComplete: boolean;  // true: auto-complete incomplete expressions
  strictMode: boolean;    // true: stub is error, false: warning only
}

/**
 * Result of stub generation
 */
export interface StubResult {
  success: boolean;
  code: string;
  stubs: Stub[];
  warnings: Warning[];
  modified: boolean;
}

/**
 * A generated stub
 */
export interface Stub {
  type: string;           // number, string, array<T>, etc.
  value: any;             // 0, "", [], null
  reason: string;         // Why stub was generated
  line: number;
}

/**
 * Warning message
 */
export interface Warning {
  type: 'MISSING_RETURN' | 'EMPTY_BODY' | 'INCOMPLETE_EXPR';
  line: number;
  message: string;
  autoFixed: boolean;
}

/**
 * Factory function to create StubGenerator
 */
export function createStubGenerator(config?: Partial<StubGeneratorConfig>): StubGenerator {
  return new StubGenerator(config);
}

/**
 * Stub Generator: Fills incomplete code with type-aware stubs
 */
export class StubGenerator {
  private config: StubGeneratorConfig;
  private stubs: Stub[] = [];
  private warnings: Warning[] = [];

  constructor(config?: Partial<StubGeneratorConfig>) {
    this.config = {
      defaultValue: true,
      autoComplete: true,
      strictMode: false,
      ...config,
    };
  }

  /**
   * Generate stubs for a function
   */
  public generateForFunction(func: FunctionStatement): StubResult {
    this.stubs = [];
    this.warnings = [];

    const code = this.processFunctionBody(func);

    return {
      success: true,
      code,
      stubs: this.stubs,
      warnings: this.warnings,
      modified: this.stubs.length > 0,
    };
  }

  /**
   * Process function body and add missing stubs
   */
  private processFunctionBody(func: FunctionStatement): string {
    // Simple implementation: just return the function as-is for now
    // Full implementation would parse and modify the AST

    if (!func.body || !func.body.body || func.body.body.length === 0) {
      // Empty body - add stub return
      const returnType = func.returnType || 'any';
      const stubValue = this.getStubForType(returnType);

      this.stubs.push({
        type: returnType,
        value: stubValue,
        reason: 'Empty function body',
        line: (func.source?.line || 0),
      });

      this.warnings.push({
        type: 'EMPTY_BODY',
        line: (func.source?.line || 0),
        message: `Function body is empty, added return stub: ${stubValue}`,
        autoFixed: true,
      });
    }

    // Return placeholder code
    return `fn ${func.name}() { /* stub generated */ }`;
  }

  /**
   * Get appropriate stub value for a type (public method for testing)
   */
  public generateStubForType(type: string): string {
    if (!this.config.defaultValue) return 'null';

    const lowerType = type.toLowerCase();

    // Number types
    if (lowerType === 'number' || lowerType === 'int' || lowerType === 'float') return '0';

    // String types
    if (lowerType === 'string' || lowerType === 'str') return '""';

    // Array types
    if (lowerType.startsWith('array') || lowerType === 'list') return '[]';

    // Boolean types
    if (lowerType === 'bool' || lowerType === 'boolean') return 'false';

    // Void
    if (lowerType === 'void') return '// empty';

    // Null/None
    if (lowerType === 'null' || lowerType === 'none') return 'null';

    return 'null';
  }

  /**
   * Get appropriate stub value for a type (internal use)
   */
  private getStubForType(type: string): any {
    if (!this.config.defaultValue) return null;

    switch (type.toLowerCase()) {
      case 'number':
        return 0;
      case 'string':
        return '';
      case 'bool':
      case 'boolean':
        return false;
      case 'array':
      case 'list':
        return [];
      case 'any':
      default:
        return null;
    }
  }

  /**
   * Complete an incomplete expression by adding appropriate stub value
   */
  public completeExpression(expr: string, expectedType: string): string {
    const trimmed = expr.trim();

    // If empty, just return the stub
    if (trimmed === '') {
      return this.generateStubForType(expectedType);
    }

    // If ends with operator, add stub
    if (['+', '-', '*', '/', '='].some(op => trimmed.endsWith(op))) {
      const stub = this.generateStubForType(expectedType);
      return expr + stub;
    }

    // If ends with parenthesis, add closing one
    if (trimmed.endsWith('(')) {
      return expr + ')';
    }

    // If ends with array bracket, add closing one
    if (trimmed.endsWith('[')) {
      return expr + ']';
    }

    return expr;
  }

  /**
   * Generate stubs from tokens (for incomplete expressions)
   */
  public generateFromTokens(tokens: string[]): StubResult {
    this.stubs = [];
    this.warnings = [];

    // Analyze tokens to find what's missing
    if (tokens.length === 0) {
      this.warnings.push({
        type: 'INCOMPLETE_EXPR',
        line: 0,
        message: 'Empty expression, cannot generate stub',
        autoFixed: false,
      });
      return {
        success: false,
        code: '',
        stubs: this.stubs,
        warnings: this.warnings,
        modified: false,
      };
    }

    // Simple heuristic: look for incomplete operators
    let lastToken = tokens[tokens.length - 1];
    if (['+', '-', '*', '/', '=', '(', '['].includes(lastToken)) {
      this.warnings.push({
        type: 'INCOMPLETE_EXPR',
        line: 0,
        message: `Incomplete expression (ends with '${lastToken}')`,
        autoFixed: false,
      });
    }

    return {
      success: this.warnings.length === 0,
      code: tokens.join(' '),
      stubs: this.stubs,
      warnings: this.warnings,
      modified: false,
    };
  }

  /**
   * Check if function has return statement
   */
  private hasReturn(block: BlockStatement): boolean {
    if (!block.body) return false;
    return block.body.some((stmt: any) => stmt.type === 'return');
  }

  /**
   * Get warnings
   */
  public getWarnings(): Warning[] {
    return this.warnings;
  }

  /**
   * Get generated stubs
   */
  public getStubs(): Stub[] {
    return this.stubs;
  }

  /**
   * Reset state
   */
  public reset(): void {
    this.stubs = [];
    this.warnings = [];
  }
}
