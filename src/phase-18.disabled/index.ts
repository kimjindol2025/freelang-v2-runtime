/**
 * Phase 18: Integrated Compiler - Main Exports
 *
 * Exports all compiler components:
 * - Base compiler class
 * - 9 compiler variants
 * - Factory pattern for variant selection
 */

// Base Compiler
export {
  CompileTarget,
  CompilerConfig,
  CompilationStage,
  CompilationResult,
  ASTNode,
} from './compiler-base/integrated-compiler-base';

export { default as IntegratedCompilerBase } from './compiler-base/integrated-compiler-base';

// Compiler Variants
export {
  DirectExecutableCompiler,
  DebugCompiler,
  ProfileCompiler,
  OptimizeCompiler,
  WasmCompiler,
  COutputCompiler,
  LLVMCompiler,
  JITCompiler,
  AOTCompiler,
} from './variants/compiler-variants';

export { default as CompilerFactory } from './variants/compiler-variants';

// Import for convenience functions
import CompilerFactory from './variants/compiler-variants';

/**
 * Convenience function to compile with any target
 */
export async function compile(
  source: string,
  target: string = 'executable'
): Promise<any> {
  const compiler = CompilerFactory.create(target);
  return compiler.compile(source);
}

/**
 * List all available compilation targets
 */
export function getAvailableTargets(): string[] {
  return CompilerFactory.availableTargets();
}

/**
 * Get description of a target
 */
export function getTargetDescription(target: string): string {
  return CompilerFactory.getDescription(target);
}
