/**
 * Phase 20: Code Generation - Main Exports
 *
 * Exports all code generation components:
 * - Base code generator class
 * - 9 code generator backends
 * - Factory pattern for backend selection
 */

// Base Code Generator
export {
  CodeGenTarget,
  CodeGenConfig,
  Symbol,
  GeneratedCode,
} from './codegen-base/code-generator-base';

export { default as CodeGeneratorBase } from './codegen-base/code-generator-base';

// Code Generator Backends
export {
  CCodeGenerator,
  LLVMCodeGenerator,
  WASMCodeGenerator,
  BytecodeGenerator,
  NativeCodeGenerator,
  JavaScriptCodeGenerator,
  TypeScriptCodeGenerator,
  CustomCodeGenerator,
  HybridCodeGenerator,
} from './backends/code-gen-backends';

export { default as CodeGeneratorFactory } from './backends/code-gen-backends';

// Import for convenience functions
import CodeGeneratorFactory from './backends/code-gen-backends';

/**
 * Convenience function to create code generator with any target
 */
export async function generateCode(target: string = 'c'): Promise<any> {
  return CodeGeneratorFactory.create(target);
}

/**
 * List all available code generation backends
 */
export function getAvailableCodeGenBackends(): string[] {
  return CodeGeneratorFactory.availableBackends();
}

/**
 * Get description of a code generation backend
 */
export function getCodeGenBackendDescription(target: string): string {
  return CodeGeneratorFactory.getDescription(target);
}
