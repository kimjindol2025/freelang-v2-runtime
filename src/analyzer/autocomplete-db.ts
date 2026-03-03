/**
 * Phase 2 Task 2.2: Auto-Complete Database
 *
 * Collects and manages auto-complete information:
 * - Function signatures
 * - Variable types
 * - Method signatures
 * - Type information
 *
 * Example:
 * ```
 * db.addFunction("sum", ["array<number>"], "number", "Sums array elements")
 * db.addMethod("array", "map", ["(x) => type"], "array", "Maps array elements")
 * db.getCompletions("arr.", 4) → ["map", "filter", "reduce", ...]
 * ```
 */

export interface Parameter {
  name: string;
  type: string;
  description?: string;
  optional?: boolean;
}

export interface FunctionSignature {
  name: string;
  params: Parameter[];
  returnType: string;
  description?: string;
  category?: string; // 'builtin', 'user', 'method', 'type'
  examples?: string[];
}

export interface MethodSignature extends FunctionSignature {
  owner: string; // Type that owns this method (e.g., 'array', 'string')
}

export interface TypeInfo {
  name: string;
  baseType?: string;
  methods: MethodSignature[];
  properties: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
}

export interface CompletionItem {
  label: string;
  kind: 'function' | 'method' | 'variable' | 'type' | 'keyword' | 'property';
  detail?: string;
  description?: string;
  sortText?: string;
  insertText?: string;
  type?: string; // Return type
}

export class AutoCompleteDB {
  private functions: Map<string, FunctionSignature> = new Map();
  private methods: Map<string, MethodSignature[]> = new Map(); // key: "typeName.methodName"
  private types: Map<string, TypeInfo> = new Map();
  private variables: Map<string, string> = new Map(); // key: variable name, value: type
  private keywords: Set<string> = new Set();

  constructor() {
    this.initializeBuiltins();
  }

  /**
   * Initialize built-in functions and types
   */
  private initializeBuiltins(): void {
    // Array methods
    this.addMethod('array', 'map', [{ name: 'fn', type: '(x) => type', description: 'Mapper function' }], 'array', 'Maps array elements');
    this.addMethod('array', 'filter', [{ name: 'fn', type: '(x) => bool', description: 'Predicate function' }], 'array', 'Filters array elements');
    this.addMethod('array', 'reduce', [{ name: 'initial', type: 'any' }, { name: 'fn', type: '(acc, x) => any' }], 'any', 'Reduces array to single value');
    this.addMethod('array', 'forEach', [{ name: 'fn', type: '(x) => void' }], 'void', 'Iterates over array elements');
    this.addMethod('array', 'length', [], 'number', 'Array length');
    this.addMethod('array', 'push', [{ name: 'element', type: 'any' }], 'void', 'Adds element to end');
    this.addMethod('array', 'pop', [], 'any', 'Removes and returns last element');
    this.addMethod('array', 'slice', [{ name: 'start', type: 'number', optional: true }, { name: 'end', type: 'number', optional: true }], 'array', 'Returns subarray');

    // String methods
    this.addMethod('string', 'length', [], 'number', 'String length');
    this.addMethod('string', 'substring', [{ name: 'start', type: 'number' }, { name: 'end', type: 'number', optional: true }], 'string', 'Returns substring');
    this.addMethod('string', 'split', [{ name: 'separator', type: 'string' }], 'array', 'Splits string into array');
    this.addMethod('string', 'concat', [{ name: 'other', type: 'string' }], 'string', 'Concatenates strings');
    this.addMethod('string', 'toUpperCase', [], 'string', 'Converts to uppercase');
    this.addMethod('string', 'toLowerCase', [], 'string', 'Converts to lowercase');
    this.addMethod('string', 'trim', [], 'string', 'Removes whitespace');
    this.addMethod('string', 'includes', [{ name: 'substring', type: 'string' }], 'bool', 'Checks if contains substring');

    // Number methods
    this.addMethod('number', 'toString', [], 'string', 'Converts to string');
    this.addMethod('number', 'toFixed', [{ name: 'digits', type: 'number', optional: true }], 'string', 'Returns fixed-point notation');
    this.addMethod('number', 'abs', [], 'number', 'Returns absolute value');
    this.addMethod('number', 'floor', [], 'number', 'Rounds down');
    this.addMethod('number', 'ceil', [], 'number', 'Rounds up');
    this.addMethod('number', 'round', [], 'number', 'Rounds to nearest integer');

    // Global functions
    this.addFunction('print', [{ name: 'value', type: 'any' }], 'void', 'Prints value to output');
    this.addFunction('parseInt', [{ name: 'str', type: 'string' }], 'number', 'Parses string to integer');
    this.addFunction('parseFloat', [{ name: 'str', type: 'string' }], 'number', 'Parses string to float');
    this.addFunction('type', [{ name: 'value', type: 'any' }], 'string', 'Returns type of value');
    this.addFunction('length', [{ name: 'value', type: 'array|string' }], 'number', 'Returns length of array or string');
    this.addFunction('sum', [{ name: 'arr', type: 'array<number>' }], 'number', 'Sums array elements');
    this.addFunction('max', [{ name: 'arr', type: 'array<number>' }], 'number', 'Returns max element');
    this.addFunction('min', [{ name: 'arr', type: 'array<number>' }], 'number', 'Returns min element');

    // Keywords
    this.keywords.add('fn');
    this.keywords.add('if');
    this.keywords.add('else');
    this.keywords.add('for');
    this.keywords.add('in');
    this.keywords.add('return');
    this.keywords.add('const');
    this.keywords.add('type');
    this.keywords.add('true');
    this.keywords.add('false');
    this.keywords.add('null');
  }

  /**
   * Add function to database
   */
  public addFunction(
    name: string,
    params: Parameter[],
    returnType: string,
    description?: string,
    category: string = 'user'
  ): void {
    this.functions.set(name, {
      name,
      params,
      returnType,
      description,
      category,
    });
  }

  /**
   * Add method to database
   */
  public addMethod(
    typeName: string,
    methodName: string,
    params: Parameter[],
    returnType: string,
    description?: string
  ): void {
    const key = `${typeName}.${methodName}`;
    const methods = this.methods.get(typeName) || [];

    methods.push({
      name: methodName,
      owner: typeName,
      params,
      returnType,
      description,
      category: 'method',
    });

    this.methods.set(typeName, methods);
  }

  /**
   * Add type to database
   */
  public addType(
    name: string,
    baseType?: string,
    methods?: MethodSignature[],
    properties?: Array<{ name: string; type: string; description?: string }>
  ): void {
    this.types.set(name, {
      name,
      baseType,
      methods: methods || [],
      properties: properties || [],
    });
  }

  /**
   * Add variable to scope
   */
  public addVariable(name: string, type: string): void {
    this.variables.set(name, type);
  }

  /**
   * Get variable type
   */
  public getVariableType(name: string): string | undefined {
    return this.variables.get(name);
  }

  /**
   * Get completions at position
   *
   * Handles:
   * - Global functions: "func|" → ["function1", "function2", ...]
   * - Methods: "arr.|" → ["map", "filter", "reduce", ...]
   * - Types: "number|" (for type hints)
   * - Variables: "var|" → matching variables
   */
  public getCompletions(prefix: string, position: number): CompletionItem[] {
    const completions: CompletionItem[] = [];

    // Check for method completion: "obj.method|"
    if (prefix.includes('.')) {
      const parts = prefix.substring(0, position).split('.');
      if (parts.length >= 2) {
        const varName = parts[0].trim();
        const methodPrefix = parts[parts.length - 1];

        // Get type of variable
        const varType = this.getVariableType(varName);
        if (varType) {
          // Get methods for this type
          const methods = this.methods.get(varType) || [];
          for (const method of methods) {
            if (method.name.startsWith(methodPrefix)) {
              completions.push({
                label: method.name,
                kind: 'method',
                detail: this.formatSignature(method),
                description: method.description,
                type: method.returnType,
              });
            }
          }
        }

        // Also check built-in types
        for (const [typeName, typeInfo] of this.types) {
          if (varType === typeName || varType?.includes(typeName)) {
            for (const method of typeInfo.methods) {
              if (method.name.startsWith(methodPrefix)) {
                completions.push({
                  label: method.name,
                  kind: 'method',
                  detail: this.formatSignature(method),
                  description: method.description,
                  type: method.returnType,
                });
              }
            }
          }
        }
      }
    }

    // Check for function completion: "func|"
    for (const [funcName, signature] of this.functions) {
      if (funcName.startsWith(prefix)) {
        completions.push({
          label: funcName,
          kind: 'function',
          detail: this.formatSignature(signature),
          description: signature.description,
          type: signature.returnType,
        });
      }
    }

    // Check for variable completion: "var|"
    for (const [varName, varType] of this.variables) {
      if (varName.startsWith(prefix)) {
        completions.push({
          label: varName,
          kind: 'variable',
          detail: varType,
          type: varType,
        });
      }
    }

    // Check for type completion
    for (const [typeName] of this.types) {
      if (typeName.startsWith(prefix)) {
        completions.push({
          label: typeName,
          kind: 'type',
        });
      }
    }

    // Check for keyword completion
    for (const keyword of this.keywords) {
      if (keyword.startsWith(prefix)) {
        completions.push({
          label: keyword,
          kind: 'keyword',
        });
      }
    }

    // Sort by label
    completions.sort((a, b) => a.label.localeCompare(b.label));

    return completions;
  }

  /**
   * Get function signature
   */
  public getFunction(name: string): FunctionSignature | undefined {
    return this.functions.get(name);
  }

  /**
   * Get type information
   */
  public getType(name: string): TypeInfo | undefined {
    return this.types.get(name);
  }

  /**
   * Get methods for type
   */
  public getMethods(typeName: string): MethodSignature[] {
    return this.methods.get(typeName) || [];
  }

  /**
   * Get all functions
   */
  public getAllFunctions(): FunctionSignature[] {
    return Array.from(this.functions.values());
  }

  /**
   * Get all types
   */
  public getAllTypes(): TypeInfo[] {
    return Array.from(this.types.values());
  }

  /**
   * Get all variables
   */
  public getAllVariables(): Map<string, string> {
    return new Map(this.variables);
  }

  /**
   * Clear scope (for new function context)
   */
  public clearVariables(): void {
    this.variables.clear();
  }

  /**
   * Format function/method signature for display
   */
  private formatSignature(sig: FunctionSignature | MethodSignature): string {
    const params = sig.params
      .map(p => {
        let s = `${p.name}: ${p.type}`;
        if (p.optional) s += '?';
        return s;
      })
      .join(', ');

    return `${sig.name}(${params}) → ${sig.returnType}`;
  }

  /**
   * Get completion suggestions for hover information
   */
  public getHoverInfo(name: string): string | null {
    // Check functions
    const func = this.functions.get(name);
    if (func) {
      return this.formatSignature(func);
    }

    // Check variables
    const varType = this.variables.get(name);
    if (varType) {
      return `${name}: ${varType}`;
    }

    // Check types
    const type = this.types.get(name);
    if (type) {
      return `type ${name}` + (type.baseType ? ` extends ${type.baseType}` : '');
    }

    return null;
  }

  /**
   * Get definition location (simulated)
   */
  public getDefinitionLocation(name: string): { file: string; line: number } | null {
    if (this.functions.has(name)) {
      return { file: 'builtins.free', line: -1 };
    }
    if (this.variables.has(name)) {
      return { file: 'current', line: -1 };
    }
    return null;
  }

  /**
   * Search for symbol by name
   */
  public search(query: string): CompletionItem[] {
    const results: CompletionItem[] = [];

    // Search functions
    for (const [name, sig] of this.functions) {
      if (name.includes(query)) {
        results.push({
          label: name,
          kind: 'function',
          detail: this.formatSignature(sig),
          type: sig.returnType,
        });
      }
    }

    // Search methods
    for (const [typeName, methods] of this.methods) {
      for (const method of methods) {
        if (method.name.includes(query)) {
          results.push({
            label: `${typeName}.${method.name}`,
            kind: 'method',
            detail: this.formatSignature(method),
            type: method.returnType,
          });
        }
      }
    }

    // Search variables
    for (const [varName, varType] of this.variables) {
      if (varName.includes(query)) {
        results.push({
          label: varName,
          kind: 'variable',
          detail: varType,
          type: varType,
        });
      }
    }

    return results;
  }

  /**
   * Get statistics
   */
  public getStats(): {
    functions: number;
    methods: number;
    types: number;
    variables: number;
    keywords: number;
  } {
    const totalMethods = Array.from(this.methods.values()).reduce((sum, methods) => sum + methods.length, 0);

    return {
      functions: this.functions.size,
      methods: totalMethods,
      types: this.types.size,
      variables: this.variables.size,
      keywords: this.keywords.size,
    };
  }
}
