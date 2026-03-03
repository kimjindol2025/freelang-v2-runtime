/**
 * FreeLang Type System Extension: Union Types
 *
 * Union Types allow values to have multiple possible types
 * Example: string | number | boolean
 */

/**
 * Union type definition
 */
export interface UnionType {
  type: 'union';
  members: TypeAnnotation[];  // e.g., ['string', 'number', 'boolean']
  discriminant?: string;      // Optional: discriminant property for discriminated unions
}

/**
 * Discriminated union type
 * Example: { kind: 'success'; value: T } | { kind: 'error'; error: string }
 */
export interface DiscriminatedUnion {
  type: 'discriminated-union';
  members: {
    [discriminantValue: string]: TypeAnnotation;
  };
  discriminantProperty: string;
}

/**
 * Type annotation (can be basic, union, or conditional)
 */
export type TypeAnnotation =
  | string  // 'string', 'number', 'boolean', 'any', etc.
  | UnionType
  | DiscriminatedUnion;

/**
 * Condition for type narrowing
 */
export interface NarrowingCondition {
  type: 'typeof' | 'instanceof' | 'property-check' | 'truthy' | 'custom';
  variable?: string;
  targetType?: string;
  property?: string;
  value?: any;
  predicate?: string;  // Function name for custom checks
}

/**
 * Union Type Parser
 */
export class UnionTypeParser {
  /**
   * Parse union type from string
   * @param typeStr Type string (e.g., "string | number | boolean")
   * @returns Parsed union type
   */
  public static parseUnionType(typeStr: string): TypeAnnotation {
    // Remove whitespace and check for union operator
    const trimmed = typeStr.trim();

    if (!trimmed.includes('|')) {
      return trimmed;  // Not a union, return as-is
    }

    // Split by | and parse each member
    const members = trimmed
      .split('|')
      .map(m => m.trim())
      .map(m => this.parseType(m));

    return {
      type: 'union',
      members
    } as UnionType;
  }

  /**
   * Parse individual type annotation
   */
  private static parseType(typeStr: string): TypeAnnotation {
    // Handle nested unions (shouldn't happen, but be safe)
    if (typeStr.includes('|')) {
      return this.parseUnionType(typeStr);
    }

    return typeStr;
  }

  /**
   * Parse discriminated union
   * @param types Array of types with discriminant property
   * @param discriminantProperty Property name that discriminates (e.g., 'kind', 'type')
   */
  public static parseDiscriminatedUnion(
    types: Array<{ discriminantValue: string; type: TypeAnnotation }>,
    discriminantProperty: string
  ): DiscriminatedUnion {
    const members: { [key: string]: TypeAnnotation } = {};

    for (const { discriminantValue, type } of types) {
      members[discriminantValue] = type;
    }

    return {
      type: 'discriminated-union',
      members,
      discriminantProperty
    };
  }
}

/**
 * Union Type Validator
 */
export class UnionTypeValidator {
  /**
   * Check if value type is assignable to union type
   * @param valueType Type of the value
   * @param unionType The union type to check against
   */
  public static isAssignableToUnion(
    valueType: TypeAnnotation,
    unionType: UnionType
  ): boolean {
    // Normalize value type to string if it's not a complex type
    const valueTypeStr = typeof valueType === 'string' ? valueType : this.typeToString(valueType);

    return unionType.members.some(member => {
      const memberStr = typeof member === 'string' ? member : this.typeToString(member);
      return this.typesMatch(valueTypeStr, memberStr);
    });
  }

  /**
   * Narrow union type based on condition
   * @param unionType The union type to narrow
   * @param condition The narrowing condition
   */
  public static narrowUnion(
    unionType: UnionType,
    condition: NarrowingCondition
  ): TypeAnnotation {
    if (condition.type === 'typeof' && condition.targetType) {
      // Filter members by typeof check
      const narrowed = unionType.members.filter(member => {
        const memberStr = typeof member === 'string' ? member : this.typeToString(member);
        return memberStr === condition.targetType;
      });

      if (narrowed.length === 1) {
        return narrowed[0];
      }
      if (narrowed.length > 1) {
        return {
          type: 'union',
          members: narrowed
        };
      }
    }

    if (condition.type === 'instanceof' && condition.targetType) {
      // For instanceof, filter by class type
      const narrowed = unionType.members.filter(member => {
        const memberStr = typeof member === 'string' ? member : this.typeToString(member);
        return memberStr === condition.targetType;
      });

      if (narrowed.length === 1) {
        return narrowed[0];
      }
      if (narrowed.length > 1) {
        return {
          type: 'union',
          members: narrowed
        };
      }
    }

    if (condition.type === 'truthy') {
      // Remove null and undefined
      const narrowed = unionType.members.filter(member => {
        const memberStr = typeof member === 'string' ? member : this.typeToString(member);
        return memberStr !== 'null' && memberStr !== 'undefined';
      });

      if (narrowed.length === 1) {
        return narrowed[0];
      }
      if (narrowed.length > 1) {
        return {
          type: 'union',
          members: narrowed
        };
      }
    }

    // If narrowing doesn't apply, return original union
    return unionType;
  }

  /**
   * Narrow discriminated union based on discriminant value
   * @param discriminated The discriminated union
   * @param discriminantValue The value of the discriminant
   */
  public static narrowDiscriminatedUnion(
    discriminated: DiscriminatedUnion,
    discriminantValue: string
  ): TypeAnnotation {
    const narrowed = discriminated.members[discriminantValue];

    if (!narrowed) {
      throw new Error(
        `Unknown discriminant value: ${discriminantValue} ` +
        `(expected one of: ${Object.keys(discriminated.members).join(', ')})`
      );
    }

    return narrowed;
  }

  /**
   * Check if two type strings match
   */
  private static typesMatch(type1: string, type2: string): boolean {
    // Normalize types
    const norm1 = type1.toLowerCase().trim();
    const norm2 = type2.toLowerCase().trim();

    return norm1 === norm2 || norm1 === 'any' || norm2 === 'any';
  }

  /**
   * Convert type annotation to string representation
   */
  private static typeToString(type: TypeAnnotation): string {
    if (typeof type === 'string') {
      return type;
    }

    if (type.type === 'union') {
      return (type as UnionType).members
        .map(m => this.typeToString(m))
        .join(' | ');
    }

    if (type.type === 'discriminated-union') {
      const du = type as DiscriminatedUnion;
      return `(discriminated: ${du.discriminantProperty})`;
    }

    return 'unknown';
  }
}

/**
 * Union Type utilities
 */
export class UnionTypeUtil {
  /**
   * Create a union type from multiple types
   */
  public static createUnion(...types: TypeAnnotation[]): UnionType {
    return {
      type: 'union',
      members: types
    };
  }

  /**
   * Check if type is a union type
   */
  public static isUnionType(type: TypeAnnotation): type is UnionType {
    return typeof type !== 'string' && type.type === 'union';
  }

  /**
   * Check if type is a discriminated union
   */
  public static isDiscriminatedUnion(type: TypeAnnotation): type is DiscriminatedUnion {
    return typeof type !== 'string' && type.type === 'discriminated-union';
  }

  /**
   * Get all members from a union type
   */
  public static getUnionMembers(type: TypeAnnotation): TypeAnnotation[] {
    if (this.isUnionType(type)) {
      return type.members;
    }
    return [type];
  }

  /**
   * Flatten nested unions
   */
  public static flattenUnion(type: TypeAnnotation): TypeAnnotation[] {
    if (this.isUnionType(type)) {
      return type.members.flatMap(m => this.flattenUnion(m));
    }
    return [type];
  }

  /**
   * Remove duplicate types from union
   */
  public static deduplicateUnion(type: UnionType): UnionType {
    const seen = new Set<string>();
    const uniqueMembers: TypeAnnotation[] = [];

    for (const member of type.members) {
      const memberStr = this.typeToString(member);
      if (!seen.has(memberStr)) {
        seen.add(memberStr);
        uniqueMembers.push(member);
      }
    }

    return {
      type: 'union',
      members: uniqueMembers
    };
  }

  /**
   * Convert type annotation to string
   */
  private static typeToString(type: TypeAnnotation): string {
    if (typeof type === 'string') {
      return type;
    }

    if (type.type === 'union') {
      return (type as UnionType).members
        .map(m => this.typeToString(m))
        .join(' | ');
    }

    return 'unknown';
  }

  /**
   * Check if union includes a specific type
   */
  public static unionIncludes(union: UnionType, typeStr: string): boolean {
    return union.members.some(member => {
      const memberStr = typeof member === 'string' ? member : this.typeToString(member);
      return memberStr === typeStr;
    });
  }
}
