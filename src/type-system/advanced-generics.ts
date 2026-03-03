/**
 * FreeLang Type System Extension: Advanced Generics
 *
 * Advanced generic features: constraints, conditional types, mapped types
 */

import { TypeAnnotation } from './union-types';

/**
 * Generic type parameter
 */
export interface GenericTypeParameter {
  name: string;
  constraint?: TypeAnnotation;  // T extends Serializable
  default?: TypeAnnotation;     // T = string (default type)
}

/**
 * Constrained generic
 */
export interface ConstrainedGeneric {
  type: 'generic';
  name: string;
  constraint?: TypeAnnotation;
  default?: TypeAnnotation;
}

/**
 * Conditional type (T extends X ? Y : Z)
 */
export interface ConditionalType {
  type: 'conditional';
  check: TypeAnnotation;        // The type to check (T)
  extends: TypeAnnotation;      // What it extends (string)
  trueType: TypeAnnotation;     // Type if true
  falseType: TypeAnnotation;    // Type if false
}

/**
 * Mapped type ({ [K in keyof T]: T[K] })
 */
export interface MappedType {
  type: 'mapped';
  key: string;                  // K
  source: TypeAnnotation;       // T
  value: TypeAnnotation;        // T[K]
  optional?: boolean;           // K? for optional properties
  readonly?: boolean;           // readonly K for immutable
}

/**
 * Generic type context for substitution
 */
export type GenericContext = Map<string, TypeAnnotation>;

/**
 * Generic Type Parser
 */
export class GenericTypeParser {
  /**
   * Parse generic parameter declaration
   * @param paramStr Parameter string (e.g., "T", "T extends Serializable", "T = string")
   */
  public static parseGenericParameter(paramStr: string): GenericTypeParameter {
    const trimmed = paramStr.trim();
    const name = trimmed.split(/[\s=<]/)[0];

    let constraint: TypeAnnotation | undefined;
    let defaultType: TypeAnnotation | undefined;

    // Check for extends constraint
    if (trimmed.includes('extends')) {
      const extMatch = trimmed.match(/extends\s+(.+?)(?:\s*=|$)/);
      if (extMatch) {
        constraint = extMatch[1].trim();
      }
    }

    // Check for default value
    if (trimmed.includes('=')) {
      const defMatch = trimmed.match(/=\s*(.+?)$/);
      if (defMatch) {
        defaultType = defMatch[1].trim();
      }
    }

    return {
      name,
      constraint,
      default: defaultType
    };
  }

  /**
   * Parse conditional type
   * @param typeStr Type string (e.g., "T extends string ? string : number")
   */
  public static parseConditionalType(typeStr: string): ConditionalType {
    // Match: T extends X ? Y : Z
    const match = typeStr.match(/(.+?)\s+extends\s+(.+?)\s*\?\s*(.+?)\s*:\s*(.+)/);

    if (!match) {
      throw new Error(`Invalid conditional type: ${typeStr}`);
    }

    return {
      type: 'conditional',
      check: match[1].trim(),
      extends: match[2].trim(),
      trueType: match[3].trim(),
      falseType: match[4].trim()
    };
  }

  /**
   * Parse mapped type
   * @param typeStr Type string (e.g., "{ [K in keyof T]: T[K] }")
   */
  public static parseMappedType(typeStr: string): MappedType {
    // Match: { [K in keyof T]: T[K] }
    const match = typeStr.match(/{\s*(?:readonly\s+)?(?:\?\s+)?(\w+)\s+in\s+keyof\s+(\w+)\s*:\s*(.+?)\s*}/);

    if (!match) {
      throw new Error(`Invalid mapped type: ${typeStr}`);
    }

    const isReadonly = typeStr.includes('readonly');
    const isOptional = typeStr.includes('?');

    return {
      type: 'mapped',
      key: match[1],
      source: match[2],
      value: match[3].trim(),
      optional: isOptional,
      readonly: isReadonly
    };
  }
}

/**
 * Generic Type Evaluator
 */
export class GenericTypeEvaluator {
  /**
   * Substitute type parameters in a type
   * @param type The type with generic parameters
   * @param context Map of type parameter names to concrete types
   */
  public static substitute(type: TypeAnnotation, context: GenericContext): TypeAnnotation {
    if (typeof type === 'string') {
      // If it's a type parameter in context, substitute it
      if (context.has(type)) {
        return context.get(type)!;
      }
      return type;
    }

    if (type.type === 'conditional') {
      const cond = type as ConditionalType;
      const checkType = this.substitute(cond.check, context);
      const extendsType = cond.extends;

      // Evaluate if checkType extends extendsType
      if (this.isAssignable(checkType, extendsType)) {
        return this.substitute(cond.trueType, context);
      } else {
        return this.substitute(cond.falseType, context);
      }
    }

    if (type.type === 'mapped') {
      const mapped = type as MappedType;
      const sourceType = this.substitute(mapped.source, context);
      const valueType = this.substitute(mapped.value, context);

      return {
        type: 'mapped',
        key: mapped.key,
        source: sourceType,
        value: valueType,
        optional: mapped.optional,
        readonly: mapped.readonly
      };
    }

    return type;
  }

  /**
   * Evaluate conditional type
   * @param conditional The conditional type
   * @param context Generic context
   */
  public static evaluateConditional(
    conditional: ConditionalType,
    context: GenericContext
  ): TypeAnnotation {
    const checkType = this.substitute(conditional.check, context);

    if (this.isAssignable(checkType, conditional.extends)) {
      return this.substitute(conditional.trueType, context);
    } else {
      return this.substitute(conditional.falseType, context);
    }
  }

  /**
   * Build mapped type structure
   * @param mapped The mapped type
   * @param sourceType The concrete source type
   * @param context Generic context
   */
  public static buildMappedType(
    mapped: MappedType,
    sourceType: TypeAnnotation,
    context: GenericContext
  ): TypeAnnotation {
    // In a full implementation, we'd extract keys from sourceType
    // and apply the mapping to each key
    // For now, return mapped with substituted types

    return {
      type: 'mapped',
      key: mapped.key,
      source: sourceType,
      value: this.substitute(mapped.value, context),
      optional: mapped.optional,
      readonly: mapped.readonly
    };
  }

  /**
   * Infer generic types from function call
   * @param functionType Function type with generic parameters
   * @param argumentTypes Types of arguments passed
   */
  public static inferGenerics(
    functionType: {
      genericParams: GenericTypeParameter[];
      paramTypes: TypeAnnotation[];
      returnType: TypeAnnotation;
    },
    argumentTypes: TypeAnnotation[]
  ): GenericContext {
    const context: GenericContext = new Map();

    // Match argument types to parameter types
    for (let i = 0; i < argumentTypes.length && i < functionType.paramTypes.length; i++) {
      const paramType = functionType.paramTypes[i];
      const argType = argumentTypes[i];

      // If paramType is a generic parameter, infer it
      if (typeof paramType === 'string' && this.isGenericParameter(paramType, functionType.genericParams)) {
        context.set(paramType, argType);
      }
    }

    return context;
  }

  /**
   * Check if type is assignable to another
   */
  private static isAssignable(fromType: TypeAnnotation, toType: TypeAnnotation): boolean {
    const fromStr = typeof fromType === 'string' ? fromType : 'complex';
    const toStr = typeof toType === 'string' ? toType : 'complex';

    if (fromStr === toStr || toStr === 'any') {
      return true;
    }

    // Allow subtype assignment (simplified)
    return false;
  }

  /**
   * Check if name is a generic parameter
   */
  private static isGenericParameter(name: string, params: GenericTypeParameter[]): boolean {
    return params.some(p => p.name === name);
  }
}

/**
 * Generic Constraint Validator
 */
export class GenericConstraintValidator {
  /**
   * Check if type satisfies constraint
   * @param typeArg The type argument
   * @param constraint The constraint type
   */
  public static satisfiesConstraint(
    typeArg: TypeAnnotation,
    constraint: TypeAnnotation
  ): boolean {
    if (typeof constraint !== 'string') {
      return false; // Can't check complex constraints easily
    }

    if (constraint === 'any') {
      return true;
    }

    if (typeof typeArg !== 'string') {
      return false;
    }

    // Check if typeArg can be assigned to constraint
    return typeArg === constraint || this.isSubtypeOf(typeArg, constraint);
  }

  /**
   * Validate generic parameter against constraints
   */
  public static validateParameter(
    param: GenericTypeParameter,
    concreteType: TypeAnnotation
  ): void {
    if (param.constraint) {
      if (!this.satisfiesConstraint(concreteType, param.constraint)) {
        const constraintStr = typeof param.constraint === 'string'
          ? param.constraint
          : 'complex type';
        const typeStr = typeof concreteType === 'string'
          ? concreteType
          : 'complex type';

        throw new Error(
          `Type '${typeStr}' does not satisfy constraint '${constraintStr}' ` +
          `for generic parameter '${param.name}'`
        );
      }
    }
  }

  /**
   * Get default type for generic parameter
   */
  public static getDefaultType(param: GenericTypeParameter): TypeAnnotation | null {
    return param.default || null;
  }

  /**
   * Check if one type is a subtype of another (simplified)
   */
  private static isSubtypeOf(subType: string, superType: string): boolean {
    // Simplified subtyping relationship
    const subtypeMap: { [key: string]: string[] } = {
      'number': ['any'],
      'string': ['any'],
      'boolean': ['any'],
      'null': ['any'],
      'undefined': ['any']
    };

    if (subtypeMap[subType]) {
      return subtypeMap[subType].includes(superType);
    }

    return false;
  }
}

/**
 * Generic Utilities
 */
export class GenericUtil {
  /**
   * Create generic type context from type arguments
   */
  public static createContext(
    params: GenericTypeParameter[],
    typeArgs: TypeAnnotation[]
  ): GenericContext {
    const context: GenericContext = new Map();

    for (let i = 0; i < params.length; i++) {
      const param = params[i];
      const arg = typeArgs[i] || param.default;

      if (arg) {
        GenericConstraintValidator.validateParameter(param, arg);
        context.set(param.name, arg);
      }
    }

    return context;
  }

  /**
   * Check if type has unresolved type parameters
   */
  public static hasTypeParameters(type: TypeAnnotation): boolean {
    if (typeof type === 'string') {
      // Heuristic: if it's a single capital letter, it might be a type parameter
      return /^[A-Z]$/.test(type);
    }

    // Check in complex types
    return false;
  }

  /**
   * Get all type parameters from a type
   */
  public static getTypeParameters(type: TypeAnnotation): string[] {
    const params: string[] = [];

    if (typeof type === 'string' && /^[A-Z]$/.test(type)) {
      params.push(type);
    }

    return params;
  }

  /**
   * Create a function signature with generics
   */
  public static createGenericFunction(
    name: string,
    genericParams: GenericTypeParameter[],
    paramTypes: TypeAnnotation[],
    returnType: TypeAnnotation
  ) {
    return {
      name,
      genericParams,
      paramTypes,
      returnType
    };
  }
}
