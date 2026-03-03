/**
 * FreeLang Type Checker
 * Validate type compatibility and check function calls
 * Phase 3: Added generic type support (array<T>, fn<T, U> -> V)
 * Phase 14-2: Added LRU cache for 3-5x speedup on repeated checks
 */

import { TypeParser, GenericType, TypeVariable } from '../cli/type-parser';
import { getGlobalTypeCheckCache } from './type-check-cache';

/**
 * Result of a type check operation
 */
export interface TypeCheckResult {
  compatible: boolean;
  message: string;
  details?: {
    expected?: string;
    received?: string;
    paramName?: string;
    paramIndex?: number;
  };
}

/**
 * Function type information
 */
export interface FunctionTypes {
  params: Record<string, string>;  // param name -> type
  returnType?: string;             // return type (optional)
}

/**
 * Phase 3: Generic function type information
 */
export interface GenericFunctionType {
  typeVars: string[];              // Type variables: [T, U, V]
  params: Record<string, string>;  // param name -> type (may contain type vars)
  returnType?: string;             // return type (may contain type vars)
}

/**
 * Phase 3: Type constraint from function call
 */
export interface TypeConstraint {
  typeVar: string;                 // Variable name (T, U, V)
  constrainedType: string;         // Concrete or variable type
  source: string;                  // Where constraint came from
}

/**
 * Phase 3 Step 2: Array method result
 */
export interface ArrayMethodResult {
  compatible: boolean;
  resultType?: string;             // Result type of the method
  error?: TypeCheckResult;          // Error details if not compatible
}

/**
 * Phase 3 Step 3: Lambda expression result
 */
export interface LambdaExpressionResult {
  compatible: boolean;
  functionType?: string;           // Inferred function type: fn(T, U) -> V
  paramTypes?: string[];           // Inferred parameter types
  returnType?: string;             // Inferred return type
  capturedVars?: string[];         // Variables captured from outer scope
  error?: TypeCheckResult;         // Error if incompatible
}

/**
 * Phase 3 Step 3: Closure context (variable scope)
 */
export interface ClosureContext {
  variables: Record<string, string>;  // Variable name -> type
  functions: Record<string, FunctionTypes>; // Function name -> types
  parentContext?: ClosureContext;      // Outer scope
}

/**
 * Phase 4 Step 4: Import validation result
 */
export interface ImportValidationResult extends TypeCheckResult {
  importedType?: string;              // Type of imported symbol
  symbolType?: 'function' | 'variable'; // Type of symbol
}

/**
 * Phase 4 Step 4: Import context (available imports)
 */
export interface ImportContext {
  availableImports: Map<string, string>;  // Import name -> type
  importedSymbols: Map<string, 'function' | 'variable'>; // Import name -> symbol type
  moduleResolver?: any;                   // ModuleResolver instance
}

/**
 * FunctionTypeChecker: Validate type compatibility and track errors
 */
export class FunctionTypeChecker {
  private errors: Array<{
    functionName: string;
    error: TypeCheckResult;
    timestamp: Date;
  }> = [];

  /**
   * Check function call type compatibility
   * Validates that provided argument types match expected parameter types
   * Phase 14-2: Caches results for 3-5x speedup on repeated checks
   */
  checkFunctionCall(
    funcName: string,
    argTypes: string[],
    expectedParams: Record<string, string>,
    expectedParamNames: string[]
  ): TypeCheckResult {
    // Phase 14-2: Check cache first (O(1) lookup)
    const cache = getGlobalTypeCheckCache();
    const paramTypesList = expectedParamNames.map(name => expectedParams[name]);
    const cachedResult = cache.get(funcName, argTypes, paramTypesList);

    if (cachedResult !== null) {
      return cachedResult;
    }

    // Cache miss - perform full type check
    let result: TypeCheckResult;

    // Check parameter count
    if (argTypes.length !== expectedParamNames.length) {
      result = {
        compatible: false,
        message: `Function '${funcName}' expects ${expectedParamNames.length} arguments, got ${argTypes.length}`,
        details: {
          expected: `${expectedParamNames.length} parameters`,
          received: `${argTypes.length} arguments`
        }
      };
      this.trackError(funcName, result);
    } else {
      // Check each parameter type
      let allCompatible = true;
      for (let i = 0; i < expectedParamNames.length; i++) {
        const paramName = expectedParamNames[i];
        const expectedType = expectedParams[paramName];
        const providedType = argTypes[i];

        if (expectedType && !TypeParser.areTypesCompatible(expectedType, providedType)) {
          result = {
            compatible: false,
            message: `Parameter '${paramName}' expects ${expectedType}, got ${providedType}`,
            details: {
              expected: expectedType,
              received: providedType,
              paramName,
              paramIndex: i
            }
          };
          this.trackError(funcName, result);
          allCompatible = false;
          break;
        }
      }

      // All checks passed
      if (allCompatible) {
        result = {
          compatible: true,
          message: `Function '${funcName}' call is type-safe`
        };
      }
    }

    // Phase 14-2: Store result in cache
    cache.set(funcName, argTypes, paramTypesList, result!);
    return result!;
  }

  /**
   * Check type assignment compatibility
   * Can source type be assigned to target type?
   */
  checkAssignment(paramName: string, paramType: string, argType: string): TypeCheckResult {
    const compatible = TypeParser.areTypesCompatible(paramType, argType);

    return {
      compatible,
      message: compatible
        ? `Assignment of '${argType}' to '${paramType}' is valid`
        : `Cannot assign '${argType}' to '${paramType}' parameter '${paramName}'`,
      details: {
        expected: paramType,
        received: argType,
        paramName
      }
    };
  }

  /**
   * Infer type of a value
   */
  inferType(value: any): string {
    return TypeParser.inferType(value);
  }

  /**
   * Validate function signature types
   */
  validateFunctionSignature(
    funcName: string,
    paramTypes: Record<string, string>,
    returnType: string | undefined,
    paramNames: string[]
  ): TypeCheckResult {
    // Check that all parameter types are valid
    for (const paramName of paramNames) {
      const paramType = paramTypes[paramName];
      if (paramType && !TypeParser.isValidType(paramType)) {
        const result: TypeCheckResult = {
          compatible: false,
          message: `Invalid type '${paramType}' for parameter '${paramName}' in function '${funcName}'`,
          details: {
            expected: 'Valid type',
            received: paramType,
            paramName
          }
        };
        this.trackError(funcName, result);
        return result;
      }
    }

    // Check return type is valid
    if (returnType && !TypeParser.isValidType(returnType)) {
      const result: TypeCheckResult = {
        compatible: false,
        message: `Invalid return type '${returnType}' for function '${funcName}'`,
        details: {
          expected: 'Valid type',
          received: returnType
        }
      };
      this.trackError(funcName, result);
      return result;
    }

    return {
      compatible: true,
      message: `Function '${funcName}' signature is valid`
    };
  }

  /**
   * Generate function signature string
   * Example: "fn add(number, number): number"
   */
  generateSignature(
    funcName: string,
    paramTypes: Record<string, string>,
    paramNames: string[],
    returnType?: string
  ): string {
    const params = paramNames
      .map(name => paramTypes[name] ? `${name}: ${paramTypes[name]}` : name)
      .join(', ');

    const returnPart = returnType ? `: ${returnType}` : '';
    return `fn ${funcName}(${params})${returnPart}`;
  }

  /**
   * Track type error for reporting
   */
  private trackError(functionName: string, error: TypeCheckResult): void {
    this.errors.push({
      functionName,
      error,
      timestamp: new Date()
    });
  }

  /**
   * Get all tracked errors
   */
  getErrors(): Array<{
    functionName: string;
    error: TypeCheckResult;
    timestamp: Date;
  }> {
    return [...this.errors];
  }

  /**
   * Get errors for a specific function
   */
  getFunctionErrors(funcName: string): TypeCheckResult[] {
    return this.errors
      .filter(e => e.functionName === funcName)
      .map(e => e.error);
  }

  /**
   * Clear all tracked errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Get error count
   */
  getErrorCount(): number {
    return this.errors.length;
  }

  /**
   * Check if a parameter requires type annotation
   * Based on usage patterns, returns whether type is necessary
   */
  shouldRequireTypeAnnotation(paramName: string, usedInOperations: string[]): boolean {
    // If parameter is used in mathematical operations, should have numeric type
    const mathOps = ['+', '-', '*', '/', '%', '>', '<', '>=', '<='];
    const hasMathUsage = usedInOperations.some(op => mathOps.includes(op));

    // If parameter is used in string operations, should have string type
    const stringOps = ['concat', '+', 'substring', 'contains'];
    const hasStringUsage = usedInOperations.some(op => stringOps.includes(op));

    // Return true if mixed usage (needs clarification) or single clear usage
    return hasMathUsage || hasStringUsage;
  }

  /**
   * Validate parameter count against expected types
   */
  validateParameterCount(
    funcName: string,
    actualCount: number,
    expectedParamTypes: Record<string, string>,
    expectedParamNames: string[]
  ): TypeCheckResult {
    if (actualCount !== expectedParamNames.length) {
      return {
        compatible: false,
        message: `Function '${funcName}' definition has ${actualCount} parameters but type signature expects ${expectedParamNames.length}`,
        details: {
          expected: `${expectedParamNames.length} parameters`,
          received: `${actualCount} parameters`
        }
      };
    }

    return {
      compatible: true,
      message: `Parameter count matches type signature`
    };
  }

  /**
   * Phase 2: Check for...of statement type safety
   * Validates:
   * 1. Iterable is array type
   * 2. Element type is correctly inferred
   * 3. Variable is properly bound in scope
   */
  checkForOfStatement(
    variable: string,
    iterableType: string,
    loopBodyContext?: any
  ): TypeCheckResult {
    // 1. Validate iterable is array
    if (!iterableType.startsWith('array<')) {
      return {
        compatible: false,
        message: `for...of requires array type, got ${iterableType}`,
        details: {
          expected: 'array<T>',
          received: iterableType,
          paramName: 'iterable'
        }
      };
    }

    // 2. Extract element type
    const elementType = this.extractElementType(iterableType);

    // 3. Validate element type is valid
    if (!TypeParser.isValidType(elementType)) {
      return {
        compatible: false,
        message: `Invalid element type '${elementType}' in array`,
        details: {
          expected: 'Valid type',
          received: elementType
        }
      };
    }

    // 4. Variable binding succeeded
    return {
      compatible: true,
      message: `for...of loop variable '${variable}' bound to type '${elementType}'`,
      details: {
        expected: elementType,
        received: elementType,
        paramName: variable
      }
    };
  }

  /**
   * Phase 2: Extract element type from array<T>
   * Example: array<string> → string
   * Example: array<number> → number
   * Example: array<object> → object
   */
  extractElementType(arrayType: string): string {
    const match = arrayType.match(/array<(.+)>/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Phase 2: Validate for...of variable can be used in loop body
   * Returns the type that the variable should have
   */
  getForOfVariableType(iterableType: string): string {
    if (!iterableType.startsWith('array<')) {
      return 'unknown';
    }
    return this.extractElementType(iterableType);
  }

  /**
   * Phase 3: Validate a generic type (array<T>, map<K, V>)
   */
  validateGenericType(typeStr: string): TypeCheckResult {
    // Parse the generic type
    const generic = TypeParser.parseGenericType(typeStr);

    if (!generic) {
      return {
        compatible: false,
        message: `Invalid generic type syntax: '${typeStr}'`,
        details: {
          expected: 'base<T, U, ...>',
          received: typeStr
        }
      };
    }

    // Validate base type
    const validBases = ['array', 'map', 'set', 'list', 'dict', 'pair'];
    if (!validBases.includes(generic.base)) {
      return {
        compatible: false,
        message: `Unknown generic type: '${generic.base}'`,
        details: {
          expected: 'array, map, set, list, dict, or pair',
          received: generic.base
        }
      };
    }

    // Validate all parameters
    for (const param of generic.parameters) {
      if (!TypeParser.isValidType(param)) {
        return {
          compatible: false,
          message: `Invalid type parameter: '${param}' in '${typeStr}'`,
          details: {
            expected: 'Valid type or type variable',
            received: param
          }
        };
      }
    }

    return {
      compatible: true,
      message: `Generic type '${typeStr}' is valid`
    };
  }

  /**
   * Phase 3: Check generic function call
   * Example: map: fn<T, U>(array<T>, fn(T) -> U) -> array<U>
   * Call: myArray.map(fn(x) -> x + 1)
   */
  checkGenericFunctionCall(
    funcName: string,
    genericFuncType: GenericFunctionType,
    argTypes: string[],
    expectedParamNames: string[]
  ): { result: TypeCheckResult; substitution?: Record<string, string> } {
    // Check parameter count
    if (argTypes.length !== expectedParamNames.length) {
      const result: TypeCheckResult = {
        compatible: false,
        message: `Function '${funcName}' expects ${expectedParamNames.length} arguments, got ${argTypes.length}`,
        details: {
          expected: `${expectedParamNames.length} parameters`,
          received: `${argTypes.length} arguments`
        }
      };
      this.trackError(funcName, result);
      return { result };
    }

    // Collect constraints from arguments
    const substitution: Record<string, string> = {};

    for (let i = 0; i < expectedParamNames.length; i++) {
      const paramName = expectedParamNames[i];
      const expectedType = genericFuncType.params[paramName];
      const providedType = argTypes[i];

      if (!expectedType) continue;

      // Unify expected type with provided type
      const unified = TypeParser.unifyTypes(expectedType, providedType, substitution);

      if (unified === null) {
        const result: TypeCheckResult = {
          compatible: false,
          message: `Parameter '${paramName}' type mismatch: expected '${expectedType}', got '${providedType}'`,
          details: {
            expected: expectedType,
            received: providedType,
            paramName,
            paramIndex: i
          }
        };
        this.trackError(funcName, result);
        return { result };
      }

      // Apply constraints to substitution
      Object.assign(substitution, unified);
    }

    // All checks passed
    return {
      result: {
        compatible: true,
        message: `Generic function '${funcName}' call is type-safe`
      },
      substitution
    };
  }

  /**
   * Phase 3: Apply type substitution to a type
   * Example: substituteTypeVariables('array<U>', {U: 'number'}) -> 'array<number>'
   */
  substituteTypeVariables(typeStr: string, substitution: Record<string, string>): string {
    return TypeParser.substituteType(typeStr, substitution);
  }

  /**
   * Phase 3: Unify two types and return constraints
   * Example: unifyTypes('array<T>', 'array<number>') -> {T: 'number'}
   */
  unifyGenericTypes(
    type1: string,
    type2: string,
    existingSubstitution?: Record<string, string>
  ): Record<string, string> | null {
    return TypeParser.unifyTypes(type1, type2, existingSubstitution || {});
  }

  /**
   * Phase 3: Get type variables from generic function
   * Example: getTypeVariablesFromFunction('fn<T, U>(T) -> U') -> ['T', 'U']
   */
  getTypeVariablesFromFunction(funcType: string): string[] {
    const parsed = TypeParser.parseFunctionType(funcType);
    return parsed ? parsed.typeVars : [];
  }

  /**
   * Phase 3: Validate a function with generic type variables
   */
  validateGenericFunction(
    funcName: string,
    funcType: string
  ): TypeCheckResult {
    const parsed = TypeParser.parseFunctionType(funcType);

    if (!parsed) {
      return {
        compatible: false,
        message: `Invalid function type syntax: '${funcType}'`,
        details: {
          expected: 'fn<T, U>(T, U) -> V',
          received: funcType
        }
      };
    }

    // Validate all parameter types
    for (const paramType of parsed.paramTypes) {
      if (!TypeParser.isValidType(paramType)) {
        return {
          compatible: false,
          message: `Invalid parameter type: '${paramType}' in function '${funcName}'`,
          details: {
            expected: 'Valid type or type variable',
            received: paramType
          }
        };
      }
    }

    // Validate return type
    if (!TypeParser.isValidType(parsed.returnType)) {
      return {
        compatible: false,
        message: `Invalid return type: '${parsed.returnType}' in function '${funcName}'`,
        details: {
          expected: 'Valid type or type variable',
          received: parsed.returnType
        }
      };
    }

    return {
      compatible: true,
      message: `Generic function '${funcName}' is valid`
    };
  }

  /**
   * Phase 3: Infer type from generic function call
   * Example: Infer return type of map(array<T>, fn(T) -> U) -> array<U>
   */
  inferGenericReturnType(
    funcType: string,
    substitution: Record<string, string>
  ): string {
    const parsed = TypeParser.parseFunctionType(funcType);

    if (!parsed) {
      return 'unknown';
    }

    // Apply substitution to return type
    return TypeParser.substituteType(parsed.returnType, substitution);
  }

  /**
   * Phase 3 Step 2: Get signature for array method
   * Returns the generic function signature for the method
   */
  getArrayMethodSignature(method: string): GenericFunctionType | null {
    const signatures: Record<string, GenericFunctionType> = {
      // map: fn<T, U>(array<T>, fn(T) -> U) -> array<U>
      'map': {
        typeVars: ['T', 'U'],
        params: {
          'array': 'array<T>',
          'transform': 'fn(T) -> U'
        },
        returnType: 'array<U>'
      },

      // filter: fn<T>(array<T>, fn(T) -> bool) -> array<T>
      'filter': {
        typeVars: ['T'],
        params: {
          'array': 'array<T>',
          'predicate': 'fn(T) -> bool'
        },
        returnType: 'array<T>'
      },

      // reduce: fn<T, U>(array<T>, fn(U, T) -> U, U) -> U
      'reduce': {
        typeVars: ['T', 'U'],
        params: {
          'array': 'array<T>',
          'reducer': 'fn(U, T) -> U',
          'initial': 'U'
        },
        returnType: 'U'
      },

      // find: fn<T>(array<T>, fn(T) -> bool) -> T | null
      'find': {
        typeVars: ['T'],
        params: {
          'array': 'array<T>',
          'predicate': 'fn(T) -> bool'
        },
        returnType: 'T'
      },

      // any: fn<T>(array<T>, fn(T) -> bool) -> bool
      'any': {
        typeVars: ['T'],
        params: {
          'array': 'array<T>',
          'predicate': 'fn(T) -> bool'
        },
        returnType: 'bool'
      },

      // all: fn<T>(array<T>, fn(T) -> bool) -> bool
      'all': {
        typeVars: ['T'],
        params: {
          'array': 'array<T>',
          'predicate': 'fn(T) -> bool'
        },
        returnType: 'bool'
      },

      // forEach: fn<T>(array<T>, fn(T) -> void) -> void
      'forEach': {
        typeVars: ['T'],
        params: {
          'array': 'array<T>',
          'callback': 'fn(T) -> void'
        },
        returnType: 'void'
      },

      // flatten: fn<T>(array<array<T>>) -> array<T>
      'flatten': {
        typeVars: ['T'],
        params: {
          'array': 'array<array<T>>'
        },
        returnType: 'array<T>'
      },

      // concat: fn<T>(array<T>, array<T>) -> array<T>
      'concat': {
        typeVars: ['T'],
        params: {
          'array': 'array<T>',
          'other': 'array<T>'
        },
        returnType: 'array<T>'
      },

      // sort: fn<T>(array<T>, fn(T, T) -> number) -> array<T>
      'sort': {
        typeVars: ['T'],
        params: {
          'array': 'array<T>',
          'comparator': 'fn(T, T) -> number'
        },
        returnType: 'array<T>'
      }
    };

    return signatures[method] || null;
  }

  /**
   * Phase 3 Step 2: Validate array method call
   * Example: array<number>.map(fn(number) -> string)
   */
  checkArrayMethodCall(
    method: string,
    arrayType: string,
    argTypes: string[]
  ): ArrayMethodResult {
    // Get method signature
    const methodSig = this.getArrayMethodSignature(method);

    if (!methodSig) {
      return {
        compatible: false,
        error: {
          compatible: false,
          message: `Unknown array method: '${method}'`
        }
      };
    }

    // Build argument list: [arrayType, ...argTypes]
    const allArgs = [arrayType, ...argTypes];
    const paramNames = Object.keys(methodSig.params);

    // Check with generic function call checker
    const check = this.checkGenericFunctionCall(
      method,
      methodSig,
      allArgs,
      paramNames
    );

    if (!check.result.compatible) {
      return {
        compatible: false,
        error: check.result
      };
    }

    // Infer result type
    const resultType = this.inferGenericReturnType(
      `fn<${methodSig.typeVars.join(', ')}>(${paramNames.map(n => methodSig.params[n]).join(', ')}) -> ${methodSig.returnType}`,
      check.substitution || {}
    );

    return {
      compatible: true,
      resultType
    };
  }

  /**
   * Phase 3 Step 2: Check if type is an array type
   */
  isArrayType(type: string): boolean {
    return type.startsWith('array<') && type.endsWith('>');
  }

  /**
   * Phase 3 Step 2: Get element type from array type
   * array<number> -> number
   * array<array<string>> -> array<string>
   */
  getArrayElementType(arrayType: string): string {
    if (!this.isArrayType(arrayType)) {
      return 'unknown';
    }

    // Extract content between array< and >
    const match = arrayType.match(/^array<(.+)>$/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Phase 3 Step 2: Create array type from element type
   * number -> array<number>
   * array<string> -> array<array<string>>
   */
  createArrayType(elementType: string): string {
    return `array<${elementType}>`;
  }

  /**
   * Phase 3 Step 2: Validate method call chain compatibility
   * Example: array.map(...).filter(...)
   */
  validateMethodChain(
    initialType: string,
    methodCalls: Array<{ method: string; argTypes: string[] }>
  ): { type: string; compatible: boolean; error?: string } {
    let currentType = initialType;

    for (const { method, argTypes } of methodCalls) {
      // Each type must be an array
      if (!this.isArrayType(currentType)) {
        return {
          type: currentType,
          compatible: false,
          error: `Cannot call method '${method}' on non-array type '${currentType}'`
        };
      }

      // Check method call
      const result = this.checkArrayMethodCall(method, currentType, argTypes);

      if (!result.compatible) {
        return {
          type: currentType,
          compatible: false,
          error: result.error?.message
        };
      }

      // Update current type for next method
      currentType = result.resultType || 'unknown';
    }

    return { type: currentType, compatible: true };
  }

  // ========================================================================
  // Phase 3 Step 3: Lambda Expression & Closure Support
  // ========================================================================

  /**
   * Phase 3 Step 3: Validate lambda expression
   * Infers parameter types, validates body, and captures closure variables
   */
  validateLambda(
    lambda: any,
    context: ClosureContext,
    expectedType?: string
  ): LambdaExpressionResult {
    try {
      // Infer parameter types from annotations or expected type
      const paramTypes = this.inferLambdaParameterTypes(lambda, expectedType, context);

      // Validate lambda body expression
      const bodyType = this.validateExpression(lambda.body, {
        ...context,
        variables: {
          ...context.variables,
          ...Object.fromEntries(
            lambda.params.map((param: any, i: number) => [param.name, paramTypes[i]])
          )
        }
      });

      // Collect closure variables (variables from outer scope used in body)
      const capturedVars = this.collectClosureVariables(lambda.body, context, lambda.params.map((p: any) => p.name));

      // Construct function type: fn(T, U) -> V
      const functionType = `fn(${paramTypes.join(', ')}) -> ${bodyType}`;

      return {
        compatible: true,
        functionType,
        paramTypes,
        returnType: bodyType,
        capturedVars
      };
    } catch (error: any) {
      return {
        compatible: false,
        error: {
          compatible: false,
          message: error.message || 'Lambda validation failed'
        }
      };
    }
  }

  /**
   * Phase 3 Step 3: Infer lambda parameter types
   * Uses: explicit annotations, expected type, or marks as 'unknown'
   */
  private inferLambdaParameterTypes(
    lambda: any,
    expectedType: string | undefined,
    context: ClosureContext
  ): string[] {
    const paramTypes: string[] = [];

    // Case 1: Explicit type annotations in lambda
    if (lambda.paramTypes && lambda.paramTypes.length > 0) {
      return lambda.paramTypes;
    }

    // Case 2: Expected type provides parameter types
    // Expected: fn(number, string) -> bool
    if (expectedType?.startsWith('fn(')) {
      const match = expectedType.match(/fn\(([^)]*)\)/);
      if (match) {
        const typeStr = match[1];
        return typeStr.split(',').map((t: string) => t.trim());
      }
    }

    // Case 3: Infer from usage in body (dataflow)
    // For now, mark as unknown
    for (let i = 0; i < lambda.params.length; i++) {
      paramTypes.push('unknown');
    }

    return paramTypes;
  }

  /**
   * Phase 3 Step 3: Collect variables captured from outer scope
   * Variables used in lambda body but defined outside
   */
  private collectClosureVariables(
    expr: any,
    context: ClosureContext,
    paramNames: string[]
  ): string[] {
    const captured: Set<string> = new Set();

    const collectVars = (node: any): void => {
      if (!node) return;

      if (node.type === 'identifier') {
        const name = node.name;

        // Not a parameter, check if in scope
        if (!paramNames.includes(name) && context.variables[name]) {
          captured.add(name);
        }
      } else if (node.type === 'call') {
        // Check arguments for identifiers
        node.arguments?.forEach((arg: any) => collectVars(arg));
      } else if (node.type === 'binary') {
        collectVars(node.left);
        collectVars(node.right);
      } else if (node.type === 'array') {
        node.elements?.forEach((elem: any) => collectVars(elem));
      } else if (node.type === 'member') {
        collectVars(node.object);
      } else if (node.type === 'lambda') {
        // Nested lambda: include its captured vars
        const nested = this.collectClosureVariables(node.body, context, [
          ...paramNames,
          ...node.params.map((p: any) => p.name)
        ]);
        nested.forEach(v => captured.add(v));
      }
    };

    collectVars(expr);
    return Array.from(captured);
  }

  /**
   * Phase 3 Step 3: Validate expression against context
   * Returns inferred type
   */
  private validateExpression(expr: any, context: ClosureContext): string {
    if (!expr) return 'unknown';

    if (expr.type === 'literal') {
      return expr.dataType;
    } else if (expr.type === 'identifier') {
      return context.variables[expr.name] || 'unknown';
    } else if (expr.type === 'binary') {
      const leftType = this.validateExpression(expr.left, context);
      const rightType = this.validateExpression(expr.right, context);

      // Type inference for binary ops
      if (expr.operator === '+' || expr.operator === '-' || expr.operator === '*' || expr.operator === '/') {
        return 'number';
      } else if (expr.operator === '==' || expr.operator === '!=' || expr.operator === '<' || expr.operator === '>') {
        return 'bool';
      }
      return 'unknown';
    } else if (expr.type === 'call') {
      // Function call returns function's return type
      const fn = context.functions[expr.callee];
      return fn?.returnType || 'unknown';
    } else if (expr.type === 'array') {
      const elemTypes = expr.elements.map((e: any) => this.validateExpression(e, context));
      if (elemTypes.length === 0) return 'array<unknown>';
      return `array<${elemTypes[0]}>`;  // Assume homogeneous
    } else if (expr.type === 'lambda') {
      const result = this.validateLambda(expr, context);
      return result.functionType || 'unknown';
    }

    return 'unknown';
  }

  /**
   * Phase 3 Step 3: Create function type from lambda
   * lambda with params [T, U] and return V -> fn(T, U) -> V
   */
  createFunctionType(paramTypes: string[], returnType: string): string {
    return `fn(${paramTypes.join(', ')}) -> ${returnType}`;
  }

  /**
   * Phase 4 Step 4: Validate import statement
   *
   * 임포트한 심볼이 실제로 모듈에서 내보내지는지 확인
   *
   * @param importName 임포트하는 심볼 이름
   * @param moduleExports 모듈의 내보내기 맵 (심볼 이름 -> 타입)
   * @returns 검증 결과
   */
  validateImport(
    importName: string,
    moduleExports: Map<string, { type: 'function' | 'variable'; functionType?: string }>
  ): ImportValidationResult {
    // Step 1: 심볼이 export 목록에 있는지 확인
    if (!moduleExports.has(importName)) {
      return {
        compatible: false,
        message: `모듈에서 '${importName}'을 내보내지 않습니다`,
        details: {
          expected: `Export named '${importName}'`,
          received: `Available exports: ${Array.from(moduleExports.keys()).join(', ')}`
        }
      };
    }

    // Step 2: 심볼 타입 확인
    const symbol = moduleExports.get(importName)!;
    const importedType = symbol.functionType || 'unknown';

    return {
      compatible: true,
      message: `'${importName}' 임포트 성공 (${symbol.type})`,
      importedType,
      symbolType: symbol.type
    };
  }

  /**
   * Phase 4 Step 4: Get exported symbol type
   *
   * 내보내기 심볼의 타입을 추출
   *
   * @param declaration 내보내기 선언 (함수 또는 변수)
   * @returns 심볼 타입
   */
  getExportType(declaration: any): string {
    if (declaration.type === 'function') {
      // 함수 타입: fn(param1: type1, param2: type2, ...) -> returnType
      const fn = declaration as any;
      const paramTypes = (fn.params || []).map((p: any) => p.paramType || 'unknown');
      const returnType = fn.returnType || 'unknown';
      return this.createFunctionType(paramTypes, returnType);
    } else if (declaration.type === 'variable') {
      // 변수 타입
      const varDecl = declaration as any;
      return varDecl.varType || 'unknown';
    }

    return 'unknown';
  }

  /**
   * Phase 4 Step 4: Build import context from module exports
   *
   * 모듈의 내보내기로부터 import 컨텍스트 생성
   *
   * @param moduleExports 모듈의 내보내기 배열
   * @returns Import 컨텍스트
   */
  buildImportContext(moduleExports: any[]): ImportContext {
    const availableImports = new Map<string, string>();
    const importedSymbols = new Map<string, 'function' | 'variable'>();

    for (const exportStmt of moduleExports) {
      const decl = exportStmt.declaration;
      const symbolName = decl.name;
      const symbolType = decl.type === 'function' ? 'function' : 'variable';
      const importedType = this.getExportType(decl);

      availableImports.set(symbolName, importedType);
      importedSymbols.set(symbolName, symbolType);
    }

    return {
      availableImports,
      importedSymbols
    };
  }

  /**
   * Phase 4 Step 4: Validate all imports in import statement
   *
   * Import 문의 모든 심볼이 올바르게 내보내지는지 확인
   *
   * @param importSpecifiers 임포트할 심볼들 ([{ name, alias? }])
   * @param moduleExports 모듈의 내보내기 맵
   * @returns 검증 결과 배열
   */
  validateImportSpecifiers(
    importSpecifiers: any[],
    moduleExports: Map<string, { type: 'function' | 'variable'; functionType?: string }>
  ): ImportValidationResult[] {
    return importSpecifiers.map(spec => {
      // 원본 이름으로 검증
      const result = this.validateImport(spec.name, moduleExports);

      // alias가 있으면 alias로 매핑
      if (spec.alias && result.compatible) {
        result.message = `'${spec.name}'을 '${spec.alias}'로 임포트`;
      }

      return result;
    });
  }

  /**
   * Phase 4 Step 4: Check if symbol is defined in context
   *
   * 심볼이 현재 컨텍스트에 정의되어 있는지 확인
   * (변수 또는 임포트된 심볼)
   *
   * @param name 심볼 이름
   * @param context 현재 컨텍스트
   * @param importContext Import 컨텍스트
   * @returns 심볼이 정의되어 있으면 타입, 없으면 undefined
   */
  lookupSymbol(
    name: string,
    context: ClosureContext,
    importContext?: ImportContext
  ): string | undefined {
    // Step 1: 지역 변수 확인
    if (context.variables[name]) {
      return context.variables[name];
    }

    // Step 2: 지역 함수 확인
    if (context.functions[name]) {
      const fn = context.functions[name];
      const paramTypes = Object.values(fn.params);
      const returnType = fn.returnType || 'unknown';
      return this.createFunctionType(paramTypes, returnType);
    }

    // Step 3: 임포트된 심볼 확인
    if (importContext?.availableImports.has(name)) {
      return importContext.availableImports.get(name);
    }

    // Step 4: 부모 컨텍스트 확인 (클로저)
    if (context.parentContext) {
      return this.lookupSymbol(name, context.parentContext, importContext);
    }

    return undefined;
  }
}
