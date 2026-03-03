/**
 * Phase 24.4: Advanced Type System
 * Generic constraints and bounds
 */

export type Constraint = 'extends' | 'super' | 'exact';

export interface TypeParameter {
  name: string;
  constraint?: string;
  default?: string;
  variance: 'invariant' | 'covariant' | 'contravariant';
}

export interface GenericType {
  name: string;
  parameters: TypeParameter[];
  bound_types: Map<string, string>;
}

export class GenericConstraints {
  private generics: Map<string, GenericType> = new Map();

  defineGeneric(name: string, parameters: TypeParameter[]): GenericType {
    const generic: GenericType = {
      name,
      parameters,
      bound_types: new Map(),
    };

    this.generics.set(name, generic);
    return generic;
  }

  bindType(generic_name: string, param_name: string, type_name: string): boolean {
    const generic = this.generics.get(generic_name);
    if (!generic) return false;

    const param = generic.parameters.find((p) => p.name === param_name);
    if (!param) return false;

    if (param.constraint && !this.satisfiesConstraint(type_name, param.constraint)) {
      return false;
    }

    generic.bound_types.set(param_name, type_name);
    return true;
  }

  getGenericType(name: string): GenericType | undefined {
    return this.generics.get(name);
  }

  satisfiesConstraint(type_name: string, constraint: string): boolean {
    // Simplified constraint checking
    return type_name.includes(constraint) || constraint === 'Any';
  }

  inferTypeParameter(values: any[]): string {
    const types = new Set(values.map((v) => typeof v));
    if (types.size === 1) {
      return Array.from(types)[0];
    }
    return 'union';
  }
}

export default { GenericConstraints };
