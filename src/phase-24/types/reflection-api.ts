/**
 * Phase 24.4: Reflection API
 * Runtime type information
 */

export interface TypeInfo {
  name: string;
  kind: 'class' | 'interface' | 'enum' | 'primitive';
  properties: PropertyInfo[];
  methods: MethodInfo[];
  base_type?: string;
}

export interface PropertyInfo {
  name: string;
  type: string;
  readonly: boolean;
  optional: boolean;
}

export interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  return_type: string;
}

export interface ParameterInfo {
  name: string;
  type: string;
  optional: boolean;
}

export class ReflectionAPI {
  private type_registry: Map<string, TypeInfo> = new Map();

  registerType(info: TypeInfo): void {
    this.type_registry.set(info.name, info);
  }

  getTypeInfo(type_name: string): TypeInfo | undefined {
    return this.type_registry.get(type_name);
  }

  getProperties(type_name: string): PropertyInfo[] {
    return this.getTypeInfo(type_name)?.properties || [];
  }

  getMethods(type_name: string): MethodInfo[] {
    return this.getTypeInfo(type_name)?.methods || [];
  }

  invokeMethod(obj: any, method_name: string, args: any[]): any {
    if (typeof obj[method_name] === 'function') {
      return obj[method_name](...args);
    }
    return undefined;
  }

  getPropertyValue(obj: any, prop_name: string): any {
    return obj[prop_name];
  }

  setPropertyValue(obj: any, prop_name: string, value: any): void {
    obj[prop_name] = value;
  }

  getAllTypes(): string[] {
    return Array.from(this.type_registry.keys());
  }

  isTypeCompatible(from_type: string, to_type: string): boolean {
    if (from_type === to_type) return true;

    const from_info = this.getTypeInfo(from_type);
    if (!from_info) return false;

    return from_info.base_type === to_type || from_info.kind === 'interface';
  }
}

export default { ReflectionAPI };
