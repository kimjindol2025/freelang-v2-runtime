/**
 * Phase 16.1: C FFI Binding Generator
 *
 * Automatically generates FreeLang bindings from C header files.
 * - Parse C function signatures
 * - Map C types to FreeLang types
 * - Generate safe wrapper functions
 * - Ensure memory safety
 */

export interface CFunctionSignature {
  name: string;
  return_type: CType;
  parameters: CFunctionParam[];
  is_variadic: boolean;
  is_const: boolean;
}

export interface CFunctionParam {
  name: string;
  type: CType;
  is_pointer: boolean;
  is_const: boolean;
}

export interface CType {
  base: 'void' | 'int' | 'float' | 'double' | 'char' | 'struct' | 'enum' | 'typedef';
  is_pointer: boolean;
  is_const: boolean;
  array_size?: number;
  struct_name?: string;
  enum_name?: string;
}

export interface TypeMapping {
  c_type: string;
  freelang_type: string;
  requires_conversion: boolean;
  conversion_fn?: string;
  reverse_conversion_fn?: string;
}

export interface GeneratedBinding {
  function_name: string;
  freelang_signature: string;
  c_signature: string;
  wrapper_code: string;
  memory_safety_checks: string[];
  test_stub: string;
}

/**
 * Main FFI Binding Generator
 * Converts C headers to FreeLang bindings
 */
export class FFIBindingGenerator {
  private type_mappings: Map<string, TypeMapping>;
  private generated_bindings: Map<string, GeneratedBinding>;
  private c_functions: CFunctionSignature[];

  constructor() {
    this.type_mappings = this.createDefaultMappings();
    this.generated_bindings = new Map();
    this.c_functions = [];
  }

  /**
   * Default C → FreeLang type mappings
   */
  private createDefaultMappings(): Map<string, TypeMapping> {
    const mappings = new Map<string, TypeMapping>();

    // Primitive types
    mappings.set('void', {
      c_type: 'void',
      freelang_type: 'null',
      requires_conversion: false,
    });

    mappings.set('int', {
      c_type: 'int',
      freelang_type: 'i32',
      requires_conversion: false,
    });

    mappings.set('long', {
      c_type: 'long',
      freelang_type: 'i64',
      requires_conversion: false,
    });

    mappings.set('float', {
      c_type: 'float',
      freelang_type: 'f32',
      requires_conversion: false,
    });

    mappings.set('double', {
      c_type: 'double',
      freelang_type: 'f64',
      requires_conversion: false,
    });

    mappings.set('char', {
      c_type: 'char',
      freelang_type: 'u8',
      requires_conversion: false,
    });

    // Pointer types
    mappings.set('char*', {
      c_type: 'char*',
      freelang_type: 'string',
      requires_conversion: true,
      conversion_fn: 'cstr_to_string',
      reverse_conversion_fn: 'string_to_cstr',
    });

    mappings.set('void*', {
      c_type: 'void*',
      freelang_type: 'pointer',
      requires_conversion: false,
    });

    mappings.set('int*', {
      c_type: 'int*',
      freelang_type: 'array<i32>',
      requires_conversion: true,
      conversion_fn: 'ptr_to_array',
      reverse_conversion_fn: 'array_to_ptr',
    });

    mappings.set('double*', {
      c_type: 'double*',
      freelang_type: 'array<f64>',
      requires_conversion: true,
      conversion_fn: 'ptr_to_array_f64',
      reverse_conversion_fn: 'array_to_ptr_f64',
    });

    // Struct types
    mappings.set('struct', {
      c_type: 'struct',
      freelang_type: 'object',
      requires_conversion: true,
      conversion_fn: 'struct_to_object',
      reverse_conversion_fn: 'object_to_struct',
    });

    return mappings;
  }

  /**
   * Parse C function signature from string
   * Example: "int add(int a, int b)"
   */
  parseSignature(signature: string): CFunctionSignature | null {
    const match = signature.match(
      /^(const\s+)?(\w+[\s\*]+)(\w+)\s*\((.*?)\)$/
    );

    if (!match) return null;

    const [, is_const_str, return_type_str, func_name, params_str] = match;
    const is_const = !!is_const_str;

    const return_type = this.parseType(return_type_str.trim());
    const parameters = this.parseParameters(params_str);

    return {
      name: func_name,
      return_type,
      parameters,
      is_variadic: params_str.includes('...'),
      is_const,
    };
  }

  /**
   * Parse C type
   */
  private parseType(type_str: string): CType {
    const is_const = type_str.includes('const');
    const is_pointer = type_str.includes('*');

    // Remove const and pointer markers
    let base_type = type_str
      .replace(/const\s+/g, '')
      .replace(/\s*\*/g, '')
      .trim();

    // Extract array size if present
    const array_match = base_type.match(/(\w+)\[(\d+)\]/);
    if (array_match) {
      base_type = array_match[1];
      return {
        base: 'int', // default for arrays
        is_pointer: false,
        is_const,
        array_size: parseInt(array_match[2]),
      };
    }

    // Determine base type
    let base: CType['base'] = 'int'; // default
    if (base_type === 'void') base = 'void';
    else if (base_type === 'float') base = 'float';
    else if (base_type === 'double') base = 'double';
    else if (base_type === 'char') base = 'char';
    else if (base_type.startsWith('struct')) base = 'struct';
    else if (base_type.startsWith('enum')) base = 'enum';

    return {
      base,
      is_pointer,
      is_const,
    };
  }

  /**
   * Parse function parameters
   */
  private parseParameters(params_str: string): CFunctionParam[] {
    if (!params_str.trim() || params_str.trim() === 'void') {
      return [];
    }

    const params: CFunctionParam[] = [];
    const parts = params_str.split(',');

    for (const part of parts) {
      const param_str = part.trim();
      if (!param_str) continue;

      // Match: [const] type [*] name
      const match = param_str.match(
        /^(const\s+)?(\w+(?:\s*\*)?)\s+(\w+)$/
      );

      if (match) {
        const [, is_const_str, type_str, param_name] = match;
        const type = this.parseType(type_str.trim());

        params.push({
          name: param_name,
          type,
          is_pointer: type.is_pointer,
          is_const: !!is_const_str,
        });
      }
    }

    return params;
  }

  /**
   * Generate FreeLang binding from C function
   */
  generateBinding(sig: CFunctionSignature): GeneratedBinding {
    const freelang_type = this.mapType(sig.return_type);
    const param_types = sig.parameters.map(p => this.mapType(p.type));

    // Generate FreeLang function signature
    const param_str = sig.parameters
      .map((p, i) => `${p.name}: ${param_types[i]}`)
      .join(', ');

    const freelang_sig = `fn ${sig.name}(${param_str}) -> ${freelang_type}`;

    // Generate C signature
    const c_return_type = this.ctypeToString(sig.return_type);
    const c_param_str = sig.parameters
      .map(p => `${this.ctypeToString(p.type)} ${p.name}`)
      .join(', ');

    const c_sig = `${c_return_type} ${sig.name}(${c_param_str})`;

    // Generate wrapper code
    const wrapper = this.generateWrapper(sig, freelang_type);
    const safety_checks = this.generateSafetyChecks(sig);
    const test = this.generateTestStub(sig, freelang_type);

    const binding: GeneratedBinding = {
      function_name: sig.name,
      freelang_signature: freelang_sig,
      c_signature: c_sig,
      wrapper_code: wrapper,
      memory_safety_checks: safety_checks,
      test_stub: test,
    };

    this.generated_bindings.set(sig.name, binding);
    return binding;
  }

  /**
   * Map C type to FreeLang type
   */
  private mapType(c_type: CType): string {
    const key = this.ctypeToString(c_type);
    const mapping = this.type_mappings.get(key);

    if (mapping) {
      return mapping.freelang_type;
    }

    // Fallback for unmapped types
    if (c_type.base === 'void') return 'null';
    if (c_type.base === 'float' || c_type.base === 'double') return 'f64';
    return 'any';
  }

  /**
   * Convert CType to string representation
   */
  private ctypeToString(c_type: CType): string {
    let result: string = c_type.base;
    if (c_type.is_const) result = `const ${result}`;
    if (c_type.is_pointer) result = `${result}*`;
    return result;
  }

  /**
   * Generate wrapper function code
   */
  private generateWrapper(sig: CFunctionSignature, return_type: string): string {
    const extern_declare = `extern "C" { fn ${sig.name}(${sig.parameters.map(p => `${p.name}: ${this.mapType(p.type)}`).join(', ')}) -> ${return_type}; }`;

    const call_args = sig.parameters
      .map(p => {
        const mapping = this.type_mappings.get(this.ctypeToString(p.type));
        if (mapping?.requires_conversion && mapping.reverse_conversion_fn) {
          return `${mapping.reverse_conversion_fn}(${p.name})`;
        }
        return p.name;
      })
      .join(', ');

    const call = `${sig.name}(${call_args})`;
    const return_stmt = return_type === 'null' ? '' : `return ${call};`;

    return `${extern_declare}\n\nwrapper fn ${sig.name}(...) {\n  ${return_stmt}\n}`;
  }

  /**
   * Generate memory safety checks
   */
  private generateSafetyChecks(sig: CFunctionSignature): string[] {
    const checks: string[] = [];

    for (const param of sig.parameters) {
      if (param.is_pointer) {
        checks.push(`check_not_null(${param.name})`);
      }

      if (param.type.base === 'char' && param.is_pointer) {
        checks.push(`check_null_terminated(${param.name})`);
      }

      if (param.type.array_size) {
        checks.push(`check_array_bounds(${param.name}, ${param.type.array_size})`);
      }
    }

    return checks;
  }

  /**
   * Generate test stub for binding
   */
  private generateTestStub(sig: CFunctionSignature, return_type: string): string {
    const params = sig.parameters
      .map((p, i) => `  param${i}: ${p.type.base}`)
      .join('\n');

    return `test "${sig.name} works" {
  // Setup
${params}

  // Call
  result := ${sig.name}(${sig.parameters.map((_, i) => `param${i}`).join(', ')})

  // Assert
  assert(result != null)
}`;
  }

  /**
   * Batch generate bindings from multiple C signatures
   */
  generateAll(signatures: string[]): GeneratedBinding[] {
    const bindings: GeneratedBinding[] = [];

    for (const sig_str of signatures) {
      const parsed = this.parseSignature(sig_str);
      if (parsed) {
        bindings.push(this.generateBinding(parsed));
      }
    }

    return bindings;
  }

  /**
   * Get all generated bindings
   */
  getBindings(): Map<string, GeneratedBinding> {
    return this.generated_bindings;
  }

  /**
   * Export bindings as FreeLang module code
   */
  exportAsModule(module_name: string): string {
    let code = `// FFI Module: ${module_name}\n// Auto-generated by FreeLang FFI Binding Generator\n\n`;

    for (const binding of this.generated_bindings.values()) {
      code += `// ${binding.c_signature}\n`;
      code += binding.freelang_signature + '\n\n';
    }

    return code;
  }

  /**
   * Export type mappings
   */
  exportMappings(): Map<string, TypeMapping> {
    return new Map(this.type_mappings);
  }
}

export default FFIBindingGenerator;
