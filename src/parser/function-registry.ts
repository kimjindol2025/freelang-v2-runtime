/**
 * Function Registry - Manages user-defined function definitions
 * Enables function lookup during IR generation and execution
 */

export interface FunctionDefinition {
  type: 'FunctionDefinition';
  name: string;
  params: string[];
  body: any; // AST node (Expression or Statement)
  returnType?: string; // Optional return type annotation
  paramTypes?: Record<string, string>; // Optional parameter type annotations
}

export interface FunctionTypes {
  params: Record<string, string>;  // param name -> type
  returnType?: string;             // return type (optional)
}

export interface FunctionStats {
  totalFunctions: number;
  totalCalls: number;
  callsByFunction: Record<string, number>;
}

/**
 * FunctionRegistry: Simple Map-based function definition storage
 * O(1) lookup, no global state needed
 * Supports optional type information for each function
 */
export class FunctionRegistry {
  private functions: Map<string, FunctionDefinition> = new Map();
  private callCounts: Map<string, number> = new Map();
  private types: Map<string, FunctionTypes> = new Map();

  /**
   * Register a function definition
   */
  register(definition: FunctionDefinition): void {
    this.functions.set(definition.name, definition);
    if (!this.callCounts.has(definition.name)) {
      this.callCounts.set(definition.name, 0);
    }
  }

  /**
   * Look up a function by name
   */
  lookup(name: string): FunctionDefinition | null {
    return this.functions.get(name) || null;
  }

  /**
   * Check if function exists
   */
  exists(name: string): boolean {
    return this.functions.has(name);
  }

  /**
   * Get number of registered functions
   */
  count(): number {
    return this.functions.size;
  }

  /**
   * Get all function names
   */
  getNames(): string[] {
    return Array.from(this.functions.keys());
  }

  /**
   * Clear all functions
   */
  clear(): void {
    this.functions.clear();
    this.callCounts.clear();
    this.types.clear();
  }

  /**
   * Track a function call
   */
  trackCall(name: string): void {
    const current = this.callCounts.get(name) || 0;
    this.callCounts.set(name, current + 1);
  }

  /**
   * Get statistics about function calls
   */
  getStats(): FunctionStats {
    let totalCalls = 0;
    const callsByFunction: Record<string, number> = {};

    for (const [name, count] of this.callCounts) {
      callsByFunction[name] = count;
      totalCalls += count;
    }

    return {
      totalFunctions: this.functions.size,
      totalCalls,
      callsByFunction
    };
  }

  /**
   * Reset call counts (for testing)
   */
  resetCallCounts(): void {
    this.callCounts.clear();
    for (const name of this.functions.keys()) {
      this.callCounts.set(name, 0);
    }
  }

  /**
   * Store type information for a function
   */
  registerTypes(name: string, types: FunctionTypes): void {
    this.types.set(name, types);
  }

  /**
   * Get type information for a function
   */
  getTypes(name: string): FunctionTypes | null {
    return this.types.get(name) || null;
  }

  /**
   * Check if function has type information
   */
  hasTypes(name: string): boolean {
    return this.types.has(name);
  }

  /**
   * Get function signature string
   * Example: "fn add(a: number, b: number): number"
   */
  getSignature(name: string): string {
    const fn = this.lookup(name);
    if (!fn) return '';

    const types = this.getTypes(name);
    if (!types) {
      // No type info, return basic signature
      return `fn ${name}(${fn.params.join(', ')})`;
    }

    const params = fn.params
      .map(p => types.params[p] ? `${p}: ${types.params[p]}` : p)
      .join(', ');

    const returnPart = types.returnType ? `: ${types.returnType}` : '';
    return `fn ${name}(${params})${returnPart}`;
  }

  /**
   * Validate function call with type checking
   */
  validateCall(name: string, argTypes: string[]): { valid: boolean; message: string } {
    if (!this.exists(name)) {
      return { valid: false, message: `Function '${name}' not found` };
    }

    const fn = this.lookup(name)!;
    const types = this.getTypes(name);

    // If no type info, can't validate
    if (!types) {
      return { valid: true, message: `Function '${name}' has no type information` };
    }

    // Check parameter count
    if (argTypes.length !== fn.params.length) {
      return {
        valid: false,
        message: `Function '${name}' expects ${fn.params.length} arguments, got ${argTypes.length}`
      };
    }

    // Check each parameter type (simplified - any type is accepted as compatible with any)
    for (let i = 0; i < fn.params.length; i++) {
      const paramName = fn.params[i];
      const expectedType = types.params[paramName];
      const providedType = argTypes[i];

      // If parameter has type annotation, should match
      if (expectedType && providedType !== 'any' && expectedType !== 'any') {
        if (expectedType !== providedType) {
          return {
            valid: false,
            message: `Parameter '${paramName}' expects ${expectedType}, got ${providedType}`
          };
        }
      }
    }

    return { valid: true, message: `Function '${name}' call is valid` };
  }
}

/**
 * LocalScope: Manages variable visibility with parent chaining
 * Enables proper scoping without global state
 */
export class LocalScope {
  private vars: Map<string, any> = new Map();
  private parent: LocalScope | null;

  constructor(parent: LocalScope | null, initialParams?: Record<string, any>) {
    this.parent = parent;

    if (initialParams) {
      for (const [name, value] of Object.entries(initialParams)) {
        this.vars.set(name, value);
      }
    }
  }

  /**
   * Set variable in current scope
   */
  set(name: string, value: any): void {
    this.vars.set(name, value);
  }

  /**
   * Get variable (walks parent chain if not found locally)
   */
  get(name: string): any {
    if (this.vars.has(name)) {
      return this.vars.get(name);
    }

    if (this.parent) {
      return this.parent.get(name);
    }

    return undefined;
  }

  /**
   * Check if variable exists
   */
  has(name: string): boolean {
    if (this.vars.has(name)) {
      return true;
    }

    if (this.parent) {
      return this.parent.has(name);
    }

    return false;
  }

  /**
   * Get all variables in current scope (for debugging)
   */
  getAll(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [name, value] of this.vars) {
      result[name] = value;
    }
    return result;
  }
}
