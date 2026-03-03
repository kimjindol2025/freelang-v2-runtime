/**
 * FreeLang Type System Extension: Advanced Type Inference
 *
 * Advanced type inference: contextual typing, parameter inference, return type inference
 */

import { TypeAnnotation } from './union-types';

/**
 * Expression node (simplified AST)
 */
export interface Expression {
  type: string;
  [key: string]: any;
}

/**
 * Function expression
 */
export interface FunctionExpression extends Expression {
  type: 'function';
  parameters: Array<{ name: string; type?: TypeAnnotation }>;
  body: any;
}

/**
 * Function type
 */
export interface FunctionType {
  kind: 'function';
  paramTypes: TypeAnnotation[];
  returnType: TypeAnnotation;
}

/**
 * Array literal type
 */
export interface ArrayLiteralType {
  kind: 'array';
  elementType: TypeAnnotation;
}

/**
 * Object literal type
 */
export interface ObjectLiteralType {
  kind: 'object';
  properties: { [key: string]: TypeAnnotation };
}

/**
 * Contextual Type Inference
 */
export class ContextualTypeInferencer {
  /**
   * Infer parameter types from context
   * @param func Function expression without explicit types
   * @param contextType Expected function type (with parameter types)
   */
  public static inferParametersFromContext(
    func: FunctionExpression,
    contextType: FunctionType
  ): Array<{ name: string; type: TypeAnnotation }> {
    const inferredParams: Array<{ name: string; type: TypeAnnotation }> = [];

    for (let i = 0; i < func.parameters.length; i++) {
      const param = func.parameters[i];
      const contextParamType = contextType.paramTypes[i] || 'any';

      inferredParams.push({
        name: param.name,
        type: param.type || contextParamType
      });
    }

    return inferredParams;
  }

  /**
   * Infer return type from context
   * @param func Function expression
   * @param expectedReturnType The expected return type
   */
  public static inferReturnTypeFromContext(
    func: FunctionExpression,
    expectedReturnType: TypeAnnotation
  ): TypeAnnotation {
    // If function has explicit return type, use it
    // Otherwise use expected type from context
    return expectedReturnType;
  }

  /**
   * Infer variable type from assignment context
   * @param variableName Variable name
   * @param contextType Type inferred from context
   * @param inferredFromValue Type inferred from assigned value
   */
  public static resolveVariableType(
    variableName: string,
    contextType?: TypeAnnotation,
    inferredFromValue?: TypeAnnotation
  ): TypeAnnotation {
    // Prefer explicit context type
    if (contextType) {
      return contextType;
    }

    // Fall back to inferred type from value
    if (inferredFromValue) {
      return inferredFromValue;
    }

    // Default to any
    return 'any';
  }
}

/**
 * Literal Type Inference
 */
export class LiteralTypeInferencer {
  /**
   * Infer type from literal value
   */
  public static inferLiteralType(value: any): TypeAnnotation {
    if (typeof value === 'string') {
      return 'string';
    }

    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'number' : 'number';
    }

    if (typeof value === 'boolean') {
      return 'boolean';
    }

    if (value === null) {
      return 'null';
    }

    if (value === undefined) {
      return 'undefined';
    }

    return 'any';
  }

  /**
   * Infer type from array literal
   */
  public static inferArrayType(elements: any[]): ArrayLiteralType {
    if (elements.length === 0) {
      return {
        kind: 'array',
        elementType: 'any'
      };
    }

    // Get types of all elements
    const elementTypes = elements.map(el => this.inferLiteralType(el));

    // Check if all same type
    if (this.allSameType(elementTypes)) {
      return {
        kind: 'array',
        elementType: elementTypes[0]
      };
    }

    // Mixed types - create union
    const uniqueTypes = [...new Set(elementTypes)];
    return {
      kind: 'array',
      elementType: uniqueTypes.length > 1
        ? { type: 'union', members: uniqueTypes }
        : uniqueTypes[0]
    };
  }

  /**
   * Infer type from object literal
   */
  public static inferObjectType(obj: { [key: string]: any }): ObjectLiteralType {
    const properties: { [key: string]: TypeAnnotation } = {};

    for (const [key, value] of Object.entries(obj)) {
      properties[key] = this.inferLiteralType(value);
    }

    return {
      kind: 'object',
      properties
    };
  }

  /**
   * Check if all types are the same
   */
  private static allSameType(types: TypeAnnotation[]): boolean {
    if (types.length === 0) return true;
    const first = typeof types[0] === 'string' ? types[0] : 'complex';
    return types.every(t => {
      const typeStr = typeof t === 'string' ? t : 'complex';
      return typeStr === first;
    });
  }
}

/**
 * Expression Type Inference
 */
export class ExpressionTypeInferencer {
  private symbolTable: Map<string, TypeAnnotation> = new Map();

  /**
   * Infer type of identifier
   */
  public inferIdentifierType(name: string): TypeAnnotation {
    return this.symbolTable.get(name) || 'unknown';
  }

  /**
   * Infer type of binary expression
   */
  public inferBinaryExpressionType(
    left: TypeAnnotation,
    operator: string,
    right: TypeAnnotation
  ): TypeAnnotation {
    // Arithmetic operators return number
    if (['+', '-', '*', '/', '%'].includes(operator)) {
      if (operator === '+' && (left === 'string' || right === 'string')) {
        return 'string';  // String concatenation
      }
      return 'number';
    }

    // Comparison operators return boolean
    if (['<', '>', '<=', '>=', '===', '!==', '==', '!='].includes(operator)) {
      return 'boolean';
    }

    // Logical operators return boolean
    if (['&&', '||'].includes(operator)) {
      return 'boolean';
    }

    return 'any';
  }

  /**
   * Infer type of conditional expression (ternary)
   */
  public inferConditionalType(
    trueType: TypeAnnotation,
    falseType: TypeAnnotation
  ): TypeAnnotation {
    // If both are same type, return that type
    if (this.typesEqual(trueType, falseType)) {
      return trueType;
    }

    // Otherwise return union
    return {
      type: 'union',
      members: [trueType, falseType]
    };
  }

  /**
   * Infer type of function call
   */
  public inferCallExpressionType(
    functionType: TypeAnnotation,
    argumentTypes: TypeAnnotation[]
  ): TypeAnnotation {
    // If we know the function's return type, use it
    if (typeof functionType === 'object' && 'returnType' in functionType) {
      const ft = functionType as unknown as FunctionType;
      return ft.returnType;
    }

    return 'any';
  }

  /**
   * Infer type of member expression (obj.property)
   */
  public inferMemberExpressionType(
    objectType: TypeAnnotation,
    propertyName: string
  ): TypeAnnotation {
    if (typeof objectType === 'object' && objectType.kind === 'object') {
      const objType = objectType as unknown as ObjectLiteralType;
      return objType.properties[propertyName] || 'any';
    }

    return 'any';
  }

  /**
   * Register a symbol with its type
   */
  public registerSymbol(name: string, type: TypeAnnotation): void {
    this.symbolTable.set(name, type);
  }

  /**
   * Check if two types are equal
   */
  private typesEqual(type1: TypeAnnotation, type2: TypeAnnotation): boolean {
    if (typeof type1 === 'string' && typeof type2 === 'string') {
      return type1 === type2;
    }

    return false;
  }
}

/**
 * Return Type Inference
 */
export class ReturnTypeInferencer {
  /**
   * Infer return type from function body
   */
  public static inferFromBody(
    statements: any[],
    explicitReturnType?: TypeAnnotation
  ): TypeAnnotation {
    // If explicit return type provided, use it
    if (explicitReturnType) {
      return explicitReturnType;
    }

    // Extract return types from return statements
    const returnTypes = this.extractReturnTypes(statements);

    if (returnTypes.length === 0) {
      return 'void';
    }

    if (returnTypes.length === 1) {
      return returnTypes[0];
    }

    // Multiple return types - create union
    return {
      type: 'union',
      members: this.deduplicateTypes(returnTypes)
    };
  }

  /**
   * Extract all return types from statements
   */
  private static extractReturnTypes(statements: any[]): TypeAnnotation[] {
    const types: TypeAnnotation[] = [];

    for (const stmt of statements) {
      if (stmt.type === 'return-statement' && stmt.value) {
        // Infer type from return value
        types.push(this.inferReturnValueType(stmt.value));
      }

      if (stmt.type === 'if-statement') {
        if (stmt.consequent) {
          types.push(...this.extractReturnTypes(stmt.consequent.statements || []));
        }
        if (stmt.alternate) {
          types.push(...this.extractReturnTypes(stmt.alternate.statements || []));
        }
      }

      if (stmt.type === 'block-statement' && stmt.statements) {
        types.push(...this.extractReturnTypes(stmt.statements));
      }
    }

    return types;
  }

  /**
   * Infer type from return value expression
   */
  private static inferReturnValueType(expr: any): TypeAnnotation {
    const inferencer = new ExpressionTypeInferencer();

    switch (expr.type) {
      case 'literal':
        return LiteralTypeInferencer.inferLiteralType(expr.value);

      case 'identifier':
        return inferencer.inferIdentifierType(expr.name);

      case 'array-literal':
        return LiteralTypeInferencer.inferArrayType(expr.elements || []);

      case 'object-literal':
        return LiteralTypeInferencer.inferObjectType(expr.properties || {});

      default:
        return 'any';
    }
  }

  /**
   * Deduplicate types in a union
   */
  private static deduplicateTypes(types: TypeAnnotation[]): TypeAnnotation[] {
    const seen = new Set<string>();
    const unique: TypeAnnotation[] = [];

    for (const type of types) {
      const typeStr = typeof type === 'string' ? type : JSON.stringify(type);
      if (!seen.has(typeStr)) {
        seen.add(typeStr);
        unique.push(type);
      }
    }

    return unique;
  }
}

/**
 * Complex Expression Inference
 */
export class ComplexExpressionInferencer {
  /**
   * Infer type of complex expression
   * @param expr The expression
   * @param context Optional context type
   */
  public static infer(
    expr: Expression,
    context?: TypeAnnotation
  ): TypeAnnotation {
    switch (expr.type) {
      case 'literal':
        return LiteralTypeInferencer.inferLiteralType((expr as any).value);

      case 'array-literal':
        return LiteralTypeInferencer.inferArrayType((expr as any).elements || []);

      case 'object-literal':
        return LiteralTypeInferencer.inferObjectType((expr as any).properties || {});

      case 'conditional':
        const inferencer = new ExpressionTypeInferencer();
        const trueType = this.infer((expr as any).consequent, context);
        const falseType = this.infer((expr as any).alternate, context);
        return inferencer.inferConditionalType(trueType, falseType);

      case 'call-expression':
        return 'any';  // Would need function type info

      case 'function':
        if (context && typeof context === 'object' && 'returnType' in context) {
          const ft = context as unknown as FunctionType;
          return ft.returnType;
        }
        return 'any';

      default:
        return 'any';
    }
  }
}

/**
 * Type Inference Utilities
 */
export class InferenceUtil {
  /**
   * Union multiple types intelligently
   */
  public static unionTypes(...types: TypeAnnotation[]): TypeAnnotation {
    if (types.length === 0) return 'any';
    if (types.length === 1) return types[0];

    // Deduplicate
    const unique: TypeAnnotation[] = [];
    const seen = new Set<string>();

    for (const type of types) {
      const key = typeof type === 'string' ? type : JSON.stringify(type);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(type);
      }
    }

    if (unique.length === 1) return unique[0];

    return {
      type: 'union',
      members: unique
    };
  }

  /**
   * Find common type between multiple types
   */
  public static commonType(...types: TypeAnnotation[]): TypeAnnotation {
    if (types.length === 0) return 'any';
    if (types.length === 1) return types[0];

    // If all same, return that type
    const first = typeof types[0] === 'string' ? types[0] : 'complex';
    if (types.every(t => {
      const typeStr = typeof t === 'string' ? t : 'complex';
      return typeStr === first;
    })) {
      return types[0];
    }

    // Otherwise any
    return 'any';
  }

  /**
   * Widen type (e.g., true -> boolean)
   */
  public static widenType(type: TypeAnnotation): TypeAnnotation {
    if (typeof type !== 'string') {
      return type;
    }

    // Literal types are already widened in FreeLang
    return type;
  }
}
