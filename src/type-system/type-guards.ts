/**
 * FreeLang Type System Extension: Type Guards
 *
 * Type Guards allow runtime type checking and type narrowing
 * Example: if (typeof value === 'string') { ... }
 */

import { TypeAnnotation, UnionType, NarrowingCondition } from './union-types';

/**
 * Type guard condition definition
 */
export interface TypeGuardCondition {
  type: 'typeof' | 'instanceof' | 'property' | 'custom' | 'truthiness';
  operator?: string;  // '===', '!==', etc.
  targetType?: string;  // 'string', 'number', User, etc.
  property?: string;  // For property checks
  value?: any;  // Value to compare against
  predicate?: string;  // Function name for custom predicates
}

/**
 * Type guard definition
 */
export interface TypeGuard {
  kind: 'type-guard';
  variable: string;
  targetType?: TypeAnnotation;
  condition: TypeGuardCondition;
}

/**
 * Type predicate function signature
 */
export interface TypePredicate {
  kind: 'type-predicate';
  variable: string;  // The variable name in parameter (e.g., 'value')
  predicateType: string;  // The type being checked (e.g., 'User')
  predicateFunction: (value: any) => boolean;  // The actual predicate function
}

/**
 * Type Guard Parser
 */
export class TypeGuardParser {
  /**
   * Parse type guard from condition
   * @param condition The guard condition code
   * @param variable The variable being guarded
   */
  public static parseTypeGuard(condition: string, variable: string): TypeGuard {
    const trimmed = condition.trim();

    // Parse: typeof value === 'string'
    if (trimmed.startsWith('typeof')) {
      const match = trimmed.match(/typeof\s+(\w+)\s*(===|!==)\s*['"](\w+)['"]/);
      if (match) {
        return {
          kind: 'type-guard',
          variable,
          targetType: match[3],
          condition: {
            type: 'typeof',
            operator: match[2],
            targetType: match[3]
          }
        };
      }
    }

    // Parse: value instanceof User
    if (trimmed.includes('instanceof')) {
      const match = trimmed.match(/(\w+)\s+instanceof\s+(\w+)/);
      if (match) {
        return {
          kind: 'type-guard',
          variable,
          targetType: match[2],
          condition: {
            type: 'instanceof',
            targetType: match[2]
          }
        };
      }
    }

    // Parse: value.kind === 'success'
    if (trimmed.includes('.') && trimmed.includes('===')) {
      const match = trimmed.match(/(\w+)\.(\w+)\s*===\s*['"](.+)['"]/);
      if (match) {
        return {
          kind: 'type-guard',
          variable,
          condition: {
            type: 'property',
            property: match[2],
            value: match[3]
          }
        };
      }
    }

    // Parse: isUser(value)
    if (trimmed.includes('(') && trimmed.includes(')')) {
      const match = trimmed.match(/(\w+)\s*\(\s*(\w+)\s*\)/);
      if (match) {
        return {
          kind: 'type-guard',
          variable,
          condition: {
            type: 'custom',
            predicate: match[1]
          }
        };
      }
    }

    // Default: truthiness check
    return {
      kind: 'type-guard',
      variable,
      condition: {
        type: 'truthiness'
      }
    };
  }
}

/**
 * Type Refinement Engine
 */
export class TypeRefiner {
  /**
   * Refine type based on type guard
   * @param originalType The original type
   * @param guard The type guard
   */
  public static refineType(
    originalType: TypeAnnotation,
    guard: TypeGuard
  ): TypeAnnotation {
    // If guard specifies target type, use it
    if (guard.targetType) {
      return guard.targetType;
    }

    // For property-based guards, we can't automatically narrow without more context
    // Return the original type
    return originalType;
  }

  /**
   * Refine type by property value (for discriminated unions)
   * @param type The original type
   * @param propertyName The property name
   * @param propertyValue The property value
   */
  public static refineByProperty(
    type: TypeAnnotation,
    propertyName: string,
    propertyValue: any
  ): TypeAnnotation {
    // This is useful for discriminated unions
    // Example: if type is { kind: 'success'; value: T } | { kind: 'error'; error: string }
    // and property is 'kind' with value 'success'
    // we can narrow to { kind: 'success'; value: T }

    // For now, return original type
    // In a full implementation, we'd analyze the type structure
    return type;
  }

  /**
   * Apply multiple type guards in sequence
   * @param originalType The original type
   * @param guards Array of type guards
   */
  public static refineWithGuards(
    originalType: TypeAnnotation,
    guards: TypeGuard[]
  ): TypeAnnotation {
    let currentType = originalType;

    for (const guard of guards) {
      currentType = this.refineType(currentType, guard);
    }

    return currentType;
  }
}

/**
 * Custom Type Predicate Handler
 */
export class CustomTypePredicateHandler {
  private predicates: Map<string, TypePredicate> = new Map();

  /**
   * Register a custom type predicate
   * @param predicateName Name of the predicate function
   * @param typeStr Type being checked
   * @param predicateFn The predicate function
   */
  public register(
    predicateName: string,
    typeStr: string,
    predicateFn: (value: any) => boolean
  ): void {
    this.predicates.set(predicateName, {
      kind: 'type-predicate',
      variable: 'value',  // Standard parameter name
      predicateType: typeStr,
      predicateFunction: predicateFn
    });
  }

  /**
   * Check if a custom predicate is registered
   */
  public hasPredicate(predicateName: string): boolean {
    return this.predicates.has(predicateName);
  }

  /**
   * Get a registered predicate
   */
  public getPredicate(predicateName: string): TypePredicate | undefined {
    return this.predicates.get(predicateName);
  }

  /**
   * Execute a custom predicate
   */
  public executePredicate(predicateName: string, value: any): boolean {
    const predicate = this.getPredicate(predicateName);
    if (!predicate) {
      throw new Error(`Unknown type predicate: ${predicateName}`);
    }
    return predicate.predicateFunction(value);
  }

  /**
   * Get the type that a predicate checks for
   */
  public getPredicateType(predicateName: string): string | undefined {
    return this.getPredicate(predicateName)?.predicateType;
  }
}

/**
 * Built-in Type Guard Utilities
 */
export class BuiltinTypeGuards {
  /**
   * Create a typeof guard
   */
  public static typeof(variable: string, type: string): TypeGuard {
    return {
      kind: 'type-guard',
      variable,
      targetType: type,
      condition: {
        type: 'typeof',
        operator: '===',
        targetType: type
      }
    };
  }

  /**
   * Create an instanceof guard
   */
  public static instanceof(variable: string, className: string): TypeGuard {
    return {
      kind: 'type-guard',
      variable,
      targetType: className,
      condition: {
        type: 'instanceof',
        targetType: className
      }
    };
  }

  /**
   * Create a property check guard
   */
  public static property(
    variable: string,
    propertyName: string,
    value: any
  ): TypeGuard {
    return {
      kind: 'type-guard',
      variable,
      condition: {
        type: 'property',
        property: propertyName,
        value
      }
    };
  }

  /**
   * Create a custom predicate guard
   */
  public static custom(variable: string, predicateName: string): TypeGuard {
    return {
      kind: 'type-guard',
      variable,
      condition: {
        type: 'custom',
        predicate: predicateName
      }
    };
  }

  /**
   * Create a truthiness guard (filters out null/undefined)
   */
  public static truthiness(variable: string): TypeGuard {
    return {
      kind: 'type-guard',
      variable,
      condition: {
        type: 'truthiness'
      }
    };
  }
}

/**
 * Type Guard Validator
 */
export class TypeGuardValidator {
  /**
   * Validate that a type guard is correctly formed
   */
  public static validate(guard: TypeGuard): boolean {
    if (!guard.variable) {
      throw new Error('Type guard must have a variable');
    }

    if (!guard.condition) {
      throw new Error('Type guard must have a condition');
    }

    const cond = guard.condition;

    switch (cond.type) {
      case 'typeof':
        if (!cond.targetType) {
          throw new Error('typeof guard must have targetType');
        }
        const validTypes = ['string', 'number', 'boolean', 'object', 'function', 'undefined', 'symbol'];
        if (!validTypes.includes(cond.targetType)) {
          throw new Error(`Invalid typeof type: ${cond.targetType}`);
        }
        return true;

      case 'instanceof':
        if (!cond.targetType) {
          throw new Error('instanceof guard must have targetType');
        }
        return true;

      case 'property':
        if (!cond.property) {
          throw new Error('property guard must have property name');
        }
        return true;

      case 'custom':
        if (!cond.predicate) {
          throw new Error('custom guard must have predicate function name');
        }
        return true;

      case 'truthiness':
        return true;

      default:
        throw new Error(`Unknown guard type: ${(cond as any).type}`);
    }
  }
}

/**
 * Common type predicate examples
 */
export const CommonPredicates = {
  /**
   * Check if value is a string
   */
  isString: (value: any): value is string => typeof value === 'string',

  /**
   * Check if value is a number
   */
  isNumber: (value: any): value is number => typeof value === 'number' && !isNaN(value),

  /**
   * Check if value is a boolean
   */
  isBoolean: (value: any): value is boolean => typeof value === 'boolean',

  /**
   * Check if value is an array
   */
  isArray: (value: any): value is any[] => Array.isArray(value),

  /**
   * Check if value is an object
   */
  isObject: (value: any): value is object => value !== null && typeof value === 'object',

  /**
   * Check if value is defined (not null or undefined)
   */
  isDefined: <T>(value: any): value is T => value !== null && value !== undefined,

  /**
   * Check if value is not null
   */
  isNotNull: <T>(value: any): value is T => value !== null,

  /**
   * Check if value is a function
   */
  isFunction: (value: any): value is Function => typeof value === 'function'
};
