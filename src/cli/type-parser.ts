/**
 * FreeLang Type Annotation Parser
 * Parse optional type annotations in function signatures
 * Phase 3: Added generic type support (array<T>, fn<T, U> -> V)
 */

/**
 * Phase 3: Generic Type Definition
 * Represents a generic type with type parameters
 */
export interface GenericType {
  base: string;                    // 'array', 'function', etc.
  parameters: string[];            // Type variables: ['T', 'U', 'V']
  constraints?: Record<string, string>;  // Type constraints: { T: 'number' }
}

/**
 * Phase 3: Type Variable
 * Represents a type variable like T, U, K, V
 */
export interface TypeVariable {
  name: string;
  constraint?: string;  // Optional constraint (e.g., T <: number)
}

/**
 * Type information for a function parameter
 */
export interface ParameterType {
  name: string;
  type: string;
}

/**
 * Function with type annotations
 */
export interface TypedFunction {
  type: 'FunctionDefinition';
  name: string;
  params: string[];
  paramTypes: Record<string, string>;  // param name -> type
  returnType?: string;                  // return type (optional)
  body: string;
}

/**
 * TypeParser: Extract and parse type annotations from function signatures
 * Syntax: fn name(param1: type1, param2: type2): returnType { body }
 */
export class TypeParser {
  /**
   * Parse type annotations from a single function signature
   * Handles both typed and untyped parameters
   */
  static parseTypeAnnotations(functionSignature: string): {
    paramTypes: Record<string, string>;
    returnType?: string;
    params: string[];
  } {
    const paramTypes: Record<string, string> = {};
    const params: string[] = [];
    let returnType: string | undefined;

    // Extract parameter list: fn name(PARAMS): RETURN
    const paramMatch = functionSignature.match(/\((.*?)\)(?:\s*:\s*(\w+|array<[^>]+>))?/);
    if (!paramMatch) {
      return { paramTypes, params, returnType };
    }

    const paramStr = paramMatch[1];
    returnType = paramMatch[2];

    // Parse individual parameters
    if (paramStr.trim().length > 0) {
      const paramParts = this.splitParameters(paramStr);

      for (const param of paramParts) {
        const param_trimmed = param.trim();
        if (!param_trimmed) continue;

        // Check if parameter has type annotation
        const typeMatch = param_trimmed.match(/^(\w+)\s*:\s*(.+)$/);
        if (typeMatch) {
          const name = typeMatch[1];
          const type = typeMatch[2].trim();
          paramTypes[name] = type;
          params.push(name);
        } else {
          // Parameter without type annotation
          params.push(param_trimmed);
        }
      }
    }

    return { paramTypes, params, returnType };
  }

  /**
   * Split parameters respecting nested angle brackets (for array<T>)
   */
  static splitParameters(paramStr: string): string[] {
    const params: string[] = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < paramStr.length; i++) {
      const ch = paramStr[i];

      if (ch === '<') {
        depth++;
        current += ch;
      } else if (ch === '>') {
        depth--;
        current += ch;
      } else if (ch === ',' && depth === 0) {
        params.push(current);
        current = '';
      } else {
        current += ch;
      }
    }

    if (current.length > 0) {
      params.push(current);
    }

    return params;
  }

  /**
   * Parse complete function with type annotations
   * Input: "fn add(a: number, b: number): number { return a + b }"
   * Output: TypedFunction with paramTypes and returnType extracted
   */
  static parseTypedFunction(source: string): TypedFunction | null {
    // Extract function signature and body
    const fnPattern = /fn\s+(\w+)\s*\((.*?)\)(?:\s*:\s*(\w+|array<[^>]+>))?\s*\{/;
    const match = source.match(fnPattern);

    if (!match) return null;

    const name = match[1];
    const paramsStr = match[2];
    const returnType = match[3];

    // Find the opening brace position
    const fnMatch = source.match(/fn\s+\w+\s*\(.*?\)(?:\s*:\s*(?:\w+|array<[^>]+>))?\s*\{/);
    if (!fnMatch) return null;

    const openBracePos = source.indexOf('{', fnMatch.index!);

    // Count braces to find matching closing brace
    let braceCount = 1;
    let pos = openBracePos + 1;

    while (pos < source.length && braceCount > 0) {
      if (source[pos] === '{') braceCount++;
      else if (source[pos] === '}') braceCount--;
      pos++;
    }

    // Extract body
    const bodyStr = source.substring(openBracePos + 1, pos - 1).trim();

    // Parse parameter types
    const { paramTypes, params } = this.parseTypeAnnotations(
      `(${paramsStr})${returnType ? ': ' + returnType : ''}`
    );

    return {
      type: 'FunctionDefinition',
      name,
      params,
      paramTypes,
      returnType,
      body: bodyStr
    };
  }

  /**
   * Parse multiple typed functions from source code
   */
  static parseTypedProgram(source: string): TypedFunction[] {
    const functions: TypedFunction[] = [];

    // Find all function definitions (typed and untyped)
    const fnPattern = /fn\s+(\w+)\s*\((.*?)\)(?:\s*:\s*(\w+|array<[^>]+>))?\s*\{/g;
    let match;

    while ((match = fnPattern.exec(source)) !== null) {
      const name = match[1];
      const paramsStr = match[2];
      const returnType = match[3];

      // Find the opening brace position
      const openBracePos = match.index + match[0].length - 1;

      // Count braces to find matching closing brace
      let braceCount = 1;
      let pos = openBracePos + 1;

      while (pos < source.length && braceCount > 0) {
        if (source[pos] === '{') braceCount++;
        else if (source[pos] === '}') braceCount--;
        pos++;
      }

      // Extract body
      const bodyStr = source.substring(openBracePos + 1, pos - 1);

      // Parse parameter types
      const { paramTypes, params } = this.parseTypeAnnotations(
        `(${paramsStr})${returnType ? ': ' + returnType : ''}`
      );

      functions.push({
        type: 'FunctionDefinition',
        name,
        params,
        paramTypes,
        returnType,
        body: bodyStr.trim()
      });
    }

    return functions;
  }

  /**
   * Extract all parameter types from a function
   */
  static getParameterTypes(functionSignature: string): ParameterType[] {
    const { paramTypes, params } = this.parseTypeAnnotations(functionSignature);

    return params.map(name => ({
      name,
      type: paramTypes[name] || 'any'
    }));
  }

  /**
   * Phase 3: Check if a string is a type variable (T, U, K, V, etc.)
   */
  static isTypeVariable(str: string): boolean {
    // Type variables are single uppercase letters
    // or uppercase followed by digits
    return /^[A-Z]\d*$/.test(str);
  }

  /**
   * Phase 3: Parse generic type syntax
   * Examples: array<T>, fn<T, U> -> V, map<K, V>
   */
  static parseGenericType(typeStr: string): GenericType | null {
    // Pattern: base<T, U, ...> or base<T> -> U
    const genericMatch = typeStr.match(/^(\w+)<([^>]+)>(?:\s*->\s*(.+))?$/);

    if (!genericMatch) {
      return null;
    }

    const base = genericMatch[1];
    const paramsStr = genericMatch[2];
    const returnType = genericMatch[3];

    // Parse type parameters
    const parameters = paramsStr
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // If there's a return type for function, add it to parameters
    if (returnType && base.toLowerCase() === 'fn') {
      parameters.push(returnType.trim());
    }

    return {
      base,
      parameters,
      constraints: {}
    };
  }

  /**
   * Phase 3: Parse function type signature
   * Examples: fn<T>(T) -> T, fn<T, U>(T, U) -> boolean
   */
  static parseFunctionType(typeStr: string): {
    typeVars: string[];
    paramTypes: string[];
    returnType: string;
  } | null {
    // Pattern: fn<T, U, ...>(params) -> returnType
    const fnMatch = typeStr.match(/^fn<([^>]+)>\(([^)]*)\)\s*->\s*(.+)$/);

    if (!fnMatch) {
      return null;
    }

    const typeVarsStr = fnMatch[1];
    const paramsStr = fnMatch[2];
    const returnType = fnMatch[3].trim();

    // Parse type variables
    const typeVars = typeVarsStr
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0);

    // Parse parameter types
    const paramTypes = paramsStr
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    return {
      typeVars,
      paramTypes,
      returnType
    };
  }

  /**
   * Phase 3: Type substitution - replace type variable with concrete type
   * Example: substitute(array<T>, { T: number }) -> array<number>
   */
  static substituteType(
    typeStr: string,
    substitution: Record<string, string>
  ): string {
    // Replace each type variable with its substitution
    let result = typeStr;

    for (const [typeVar, concreteType] of Object.entries(substitution)) {
      // Replace type variable with concrete type
      // Handle edge cases: whole type, within array<>, function args
      const pattern = new RegExp(`\\b${typeVar}\\b`, 'g');
      result = result.replace(pattern, concreteType);
    }

    return result;
  }

  /**
   * Check if a type is valid
   * Valid types: number, string, boolean, array<T>, any, or type variables
   */
  static isValidType(type: string): boolean {
    const validTypes = ['number', 'string', 'boolean', 'any', 'object'];

    // Check for type variable (T, U, K, V, etc.)
    if (this.isTypeVariable(type)) return true;

    // Check for basic types
    if (validTypes.includes(type)) return true;

    // Check for array<T>
    if (type.startsWith('array<') && type.endsWith('>')) {
      const innerType = type.substring(6, type.length - 1);
      return this.isValidType(innerType);
    }

    // Check for generic types like map<K, V>
    if (type.includes('<') && type.endsWith('>')) {
      const genericPart = type.substring(0, type.indexOf('<'));
      const paramPart = type.substring(type.indexOf('<') + 1, type.length - 1);
      const params = paramPart.split(',').map(p => p.trim());
      return params.every(p => this.isValidType(p));
    }

    return false;
  }

  /**
   * Infer type of a literal value
   */
  static inferType(value: any): string {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'array<any>';
      // Assume homogeneous array
      const elementType = this.inferType(value[0]);
      return `array<${elementType}>`;
    }
    return 'any';
  }

  /**
   * Phase 3: Unify two types for generic constraints
   * Example: unify(array<T>, array<number>) -> { T: number }
   */
  static unifyTypes(
    type1: string,
    type2: string,
    substitution: Record<string, string> = {}
  ): Record<string, string> | null {
    // Apply existing substitutions
    const t1 = this.substituteType(type1, substitution);
    const t2 = this.substituteType(type2, substitution);

    // If they match exactly, no new constraint
    if (t1 === t2) {
      return substitution;
    }

    // If t1 is a type variable, unify it with t2
    if (this.isTypeVariable(t1)) {
      // Occurs check: make sure t1 doesn't appear in t2
      if (t2.includes(t1)) {
        return null; // Unification fails
      }
      return { ...substitution, [t1]: t2 };
    }

    // If t2 is a type variable, unify it with t1
    if (this.isTypeVariable(t2)) {
      if (t1.includes(t2)) {
        return null;
      }
      return { ...substitution, [t2]: t1 };
    }

    // Both are concrete types - check structural unification
    // array<T> unifies with array<U> -> unify T with U
    if (t1.startsWith('array<') && t2.startsWith('array<')) {
      const inner1 = t1.substring(6, t1.length - 1);
      const inner2 = t2.substring(6, t2.length - 1);
      return this.unifyTypes(inner1, inner2, substitution);
    }

    // No unification possible
    return null;
  }

  /**
   * Check if two types are compatible (for assignment/function calls)
   */
  static areTypesCompatible(targetType: string, sourceType: string): boolean {
    // Exact match
    if (targetType === sourceType) return true;

    // any is compatible with everything
    if (targetType === 'any' || sourceType === 'any') return true;

    // Type variables are compatible with anything
    if (this.isTypeVariable(targetType) || this.isTypeVariable(sourceType)) {
      return true;
    }

    // array<T> compatibility
    if (targetType.startsWith('array<') && sourceType.startsWith('array<')) {
      const targetInner = targetType.substring(6, targetType.length - 1);
      const sourceInner = sourceType.substring(6, sourceType.length - 1);
      return this.areTypesCompatible(targetInner, sourceInner);
    }

    return false;
  }
}
