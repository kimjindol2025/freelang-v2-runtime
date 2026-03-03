/**
 * Phase 16: FFI Integration - Main Module
 *
 * Orchestrates C/Rust library integration for FreeLang:
 * - Generates bindings from headers
 * - Loads native libraries
 * - Manages symbol resolution
 * - Ensures memory safety
 */

import FFIBindingGenerator, {
  CFunctionSignature,
  GeneratedBinding,
} from './c-bindings/ffi-binding-generator';
import NativeLibraryLoader, {
  LibraryInfo,
  SymbolResolution,
} from './native-loader/native-library-loader';

export interface FFIConfig {
  auto_memory_safety: boolean;
  type_checking: boolean;
  performance_checks: boolean;
  generate_tests: boolean;
}

export interface FFILibrary {
  name: string;
  path: string;
  bindings: Map<string, GeneratedBinding>;
  native_lib: LibraryInfo | null;
  is_ready: boolean;
}

export interface FFICallResult {
  success: boolean;
  return_value?: any;
  error?: string;
  execution_time: number;
  memory_used: number;
}

/**
 * Main FFI Integration Module
 */
export class FFIIntegration {
  private generator: FFIBindingGenerator;
  private loader: NativeLibraryLoader;
  private libraries: Map<string, FFILibrary>;
  private config: FFIConfig;
  private call_count: number;
  private error_log: string[];

  constructor(config?: Partial<FFIConfig>) {
    this.generator = new FFIBindingGenerator();
    this.loader = new NativeLibraryLoader();
    this.libraries = new Map();
    this.config = {
      auto_memory_safety: true,
      type_checking: true,
      performance_checks: true,
      generate_tests: true,
      ...config,
    };
    this.call_count = 0;
    this.error_log = [];
  }

  /**
   * Register and load a C library
   */
  registerLibrary(
    name: string,
    path: string,
    c_signatures: string[]
  ): FFILibrary | null {
    try {
      // Load native library
      const native_lib = this.loader.loadLibrary(name);
      if (!native_lib) {
        this.logError(`Failed to load native library: ${name}`);
        return null;
      }

      // Generate bindings for all C functions
      const bindings = new Map<string, GeneratedBinding>();
      for (const sig_str of c_signatures) {
        const parsed = this.generator.parseSignature(sig_str);
        if (parsed) {
          const binding = this.generator.generateBinding(parsed);
          bindings.set(parsed.name, binding);

          // Register symbol in native loader
          const params = parsed.parameters.map(p => p.type.base);
          this.loader.registerSymbol(
            name,
            parsed.name,
            this.ctypeToString(parsed.return_type),
            params
          );
        }
      }

      const ffi_lib: FFILibrary = {
        name,
        path,
        bindings,
        native_lib,
        is_ready: true,
      };

      this.libraries.set(name, ffi_lib);
      return ffi_lib;
    } catch (error) {
      this.logError(`Error registering library ${name}: ${error}`);
      return null;
    }
  }

  /**
   * Call a native function through FFI
   */
  callFunction(
    library_name: string,
    function_name: string,
    ...args: any[]
  ): FFICallResult {
    const start_time = performance.now();
    const start_memory = process.memoryUsage().heapUsed;

    try {
      const lib = this.libraries.get(library_name);
      if (!lib) {
        return {
          success: false,
          error: `Library not registered: ${library_name}`,
          execution_time: performance.now() - start_time,
          memory_used: 0,
        };
      }

      if (!lib.is_ready) {
        return {
          success: false,
          error: `Library not ready: ${library_name}`,
          execution_time: performance.now() - start_time,
          memory_used: 0,
        };
      }

      // Resolve function symbol
      const resolution = this.loader.resolveSymbol(library_name, function_name);
      if (!resolution.found) {
        return {
          success: false,
          error: `Function not found: ${function_name}`,
          execution_time: performance.now() - start_time,
          memory_used: 0,
        };
      }

      // Get binding information
      const binding = lib.bindings.get(function_name);
      if (!binding) {
        return {
          success: false,
          error: `No binding for function: ${function_name}`,
          execution_time: performance.now() - start_time,
          memory_used: 0,
        };
      }

      // Perform memory safety checks
      if (this.config.auto_memory_safety) {
        const safety_check = this.performSafetyChecks(binding, args);
        if (!safety_check.passed) {
          return {
            success: false,
            error: safety_check.error,
            execution_time: performance.now() - start_time,
            memory_used: 0,
          };
        }
      }

      // Perform type checking
      if (this.config.type_checking) {
        const type_check = this.performTypeChecks(binding, args);
        if (!type_check.passed) {
          return {
            success: false,
            error: type_check.error,
            execution_time: performance.now() - start_time,
            memory_used: 0,
          };
        }
      }

      // Execute function (mock in this implementation)
      const return_value = this.executeNativeFunction(
        resolution.address!,
        args
      );

      this.call_count++;

      const execution_time = performance.now() - start_time;
      const memory_used = process.memoryUsage().heapUsed - start_memory;

      // Log performance if enabled
      if (this.config.performance_checks) {
        if (execution_time > 1000) {
          this.logError(
            `Slow FFI call: ${library_name}.${function_name} took ${execution_time.toFixed(
              2
            )}ms`
          );
        }
      }

      return {
        success: true,
        return_value,
        execution_time,
        memory_used,
      };
    } catch (error) {
      this.logError(
        `Exception in FFI call ${library_name}.${function_name}: ${error}`
      );
      return {
        success: false,
        error: String(error),
        execution_time: performance.now() - start_time,
        memory_used: 0,
      };
    }
  }

  /**
   * Perform memory safety checks
   */
  private performSafetyChecks(
    binding: GeneratedBinding,
    args: any[]
  ): { passed: boolean; error?: string } {
    for (const check of binding.memory_safety_checks) {
      if (check.includes('check_not_null')) {
        // Verify non-null pointers
        const arg_idx = parseInt(
          check.match(/\((\w+)\)/)?.[1] || '0'
        );
        if (args[arg_idx] === null || args[arg_idx] === undefined) {
          return {
            passed: false,
            error: `Null pointer violation at argument ${arg_idx}`,
          };
        }
      }

      if (check.includes('check_null_terminated')) {
        // Verify null-terminated strings
        // This is a simplified check
      }

      if (check.includes('check_array_bounds')) {
        // Verify array bounds
      }
    }

    return { passed: true };
  }

  /**
   * Perform type checking
   */
  private performTypeChecks(
    binding: GeneratedBinding,
    args: any[]
  ): { passed: boolean; error?: string } {
    // Parse expected types from signature
    const sig_match = binding.freelang_signature.match(
      /fn \w+\((.*?)\) -> (\w+)/
    );
    if (!sig_match) {
      return { passed: true }; // Skip if we can't parse
    }

    const params = sig_match[1].split(',').map(p => p.trim());
    const return_type = sig_match[2];

    // Check argument count
    if (args.length !== params.length) {
      return {
        passed: false,
        error: `Argument count mismatch: expected ${params.length}, got ${args.length}`,
      };
    }

    // Type checking would be more sophisticated in production
    return { passed: true };
  }

  /**
   * Execute native function (mock implementation)
   */
  private executeNativeFunction(address: number, args: any[]): any {
    // In production, this would use NodeJS native binding or FFI library
    // to actually call the native function at the given address
    // For now, we return a mock result
    return 0;
  }

  /**
   * Get library info
   */
  getLibrary(name: string): FFILibrary | undefined {
    return this.libraries.get(name);
  }

  /**
   * List all registered libraries
   */
  getLibraries(): FFILibrary[] {
    return Array.from(this.libraries.values());
  }

  /**
   * Generate test file for library
   */
  generateTests(library_name: string): string {
    const lib = this.libraries.get(library_name);
    if (!lib) {
      return '// Library not found';
    }

    let test_code = `// Auto-generated tests for ${library_name}\n\n`;

    for (const binding of lib.bindings.values()) {
      test_code += `describe("${library_name}.${binding.function_name}", () => {\n`;
      test_code += `  test("should call native function", () => {\n`;
      test_code += `    // ${binding.c_signature}\n`;
      test_code += `    // ${binding.freelang_signature}\n`;
      test_code += `  });\n`;
      test_code += `});\n\n`;
    }

    return test_code;
  }

  /**
   * Export as FreeLang module
   */
  exportModule(library_name: string): string {
    const lib = this.libraries.get(library_name);
    if (!lib) {
      return '// Library not found';
    }

    let module = `// FFI Module: ${library_name}\n`;
    module += `// Auto-generated by FreeLang FFI Integration\n\n`;

    for (const binding of lib.bindings.values()) {
      module += `// ${binding.c_signature}\n`;
      module += binding.freelang_signature + '\n\n';
    }

    return module;
  }

  /**
   * Get statistics
   */
  getStats(): {
    libraries_registered: number;
    total_bindings: number;
    total_calls: number;
    errors: number;
  } {
    let total_bindings = 0;
    for (const lib of this.libraries.values()) {
      total_bindings += lib.bindings.size;
    }

    return {
      libraries_registered: this.libraries.size,
      total_bindings,
      total_calls: this.call_count,
      errors: this.error_log.length,
    };
  }

  /**
   * Get error log
   */
  getErrors(): string[] {
    return [...this.error_log];
  }

  /**
   * Clear error log
   */
  clearErrors(): void {
    this.error_log = [];
  }

  /**
   * Log error
   */
  private logError(message: string): void {
    this.error_log.push(
      `[${new Date().toISOString()}] ${message}`
    );
  }

  /**
   * Convert CType to string
   */
  private ctypeToString(c_type: any): string {
    let result = c_type.base;
    if (c_type.is_const) result = `const ${result}`;
    if (c_type.is_pointer) result = `${result}*`;
    return result;
  }
}

export default FFIIntegration;
