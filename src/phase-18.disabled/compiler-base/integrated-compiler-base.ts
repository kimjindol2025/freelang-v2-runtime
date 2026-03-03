/**
 * Phase 18.1: Integrated Compiler Base
 *
 * Base class for all compiler variants
 * - Common compilation pipeline
 * - Optimization framework
 * - Output management
 * - Configuration system
 */

export type CompileTarget =
  | 'executable'
  | 'debug'
  | 'profile'
  | 'optimize'
  | 'wasm'
  | 'c'
  | 'llvm'
  | 'jit'
  | 'aot';

export interface CompilerConfig {
  target: CompileTarget;
  output_file: string;
  optimization_level: 0 | 1 | 2 | 3;
  debug_info: boolean;
  include_runtime: boolean;
  profile_enabled: boolean;
  parallel_jobs: number;
}

export interface CompilationStage {
  name: string;
  duration_ms: number;
  success: boolean;
  error?: string;
  warnings: string[];
}

export interface CompilationResult {
  success: boolean;
  output_file?: string;
  file_size: number;
  compilation_time_ms: number;
  stages: CompilationStage[];
  warnings: string[];
  errors: string[];
  optimization_info?: {
    pass_count: number;
    lines_eliminated: number;
    bytes_saved: number;
  };
}

export interface ASTNode {
  type: string;
  value?: any;
  children?: ASTNode[];
  line?: number;
  column?: number;
}

/**
 * Integrated Compiler Base
 * Common foundation for all compiler variants
 */
export class IntegratedCompilerBase {
  protected config: CompilerConfig;
  protected stages: CompilationStage[];
  protected warnings: string[];
  protected errors: string[];
  protected optimization_count: number;
  protected start_time: number;

  constructor(config: Partial<CompilerConfig> = {}) {
    this.config = {
      target: 'executable',
      output_file: 'output.bin',
      optimization_level: 2,
      debug_info: false,
      include_runtime: true,
      profile_enabled: false,
      parallel_jobs: 4,
      ...config,
    };

    this.stages = [];
    this.warnings = [];
    this.errors = [];
    this.optimization_count = 0;
    this.start_time = 0;
  }

  // ────────── Core Compilation Pipeline ──────────

  /**
   * Main compilation entry point
   */
  async compile(source: string): Promise<CompilationResult> {
    this.start_time = Date.now();
    this.stages = [];
    this.warnings = [];
    this.errors = [];
    this.optimization_count = 0;

    try {
      // Stage 1: Lexical Analysis
      await this.runStage('Lexical Analysis', async () => {
        this.lexicalAnalysis(source);
      });

      // Stage 2: Syntax Analysis
      await this.runStage('Syntax Analysis', async () => {
        this.syntaxAnalysis(source);
      });

      // Stage 3: Semantic Analysis
      await this.runStage('Semantic Analysis', async () => {
        this.semanticAnalysis(source);
      });

      // Stage 4: Optimization (if enabled)
      if (this.config.optimization_level > 0) {
        await this.runStage('Optimization', async () => {
          this.optimizeCode(source);
        });
      }

      // Stage 5: Code Generation (variant-specific)
      await this.runStage('Code Generation', async () => {
        this.generateCode(source);
      });

      // Stage 6: Linking
      await this.runStage('Linking', async () => {
        this.linkOutput();
      });

      const compilation_time = Date.now() - this.start_time;

      return {
        success: this.errors.length === 0,
        output_file: this.config.output_file,
        file_size: 0, // Will be set by variants
        compilation_time_ms: compilation_time,
        stages: this.stages,
        warnings: this.warnings,
        errors: this.errors,
      };
    } catch (error) {
      this.errors.push(String(error));
      return {
        success: false,
        file_size: 0,
        compilation_time_ms: Date.now() - this.start_time,
        stages: this.stages,
        warnings: this.warnings,
        errors: this.errors,
      };
    }
  }

  /**
   * Run a compilation stage with timing
   */
  protected async runStage(
    name: string,
    fn: () => Promise<void>
  ): Promise<void> {
    const start = Date.now();

    try {
      await fn();

      this.stages.push({
        name,
        duration_ms: Date.now() - start,
        success: true,
        warnings: [],
      });
    } catch (error) {
      this.stages.push({
        name,
        duration_ms: Date.now() - start,
        success: false,
        error: String(error),
        warnings: [],
      });

      throw error;
    }
  }

  // ────────── Compilation Stages (Overridable) ──────────

  /**
   * Lexical Analysis - Tokenization
   */
  protected lexicalAnalysis(source: string): void {
    if (!source || source.length === 0) {
      throw new Error('Empty source code');
    }
    // Base implementation: just validate
  }

  /**
   * Syntax Analysis - Parsing
   */
  protected syntaxAnalysis(source: string): void {
    // Base implementation: just validate
  }

  /**
   * Semantic Analysis - Type checking, scope validation
   */
  protected semanticAnalysis(source: string): void {
    // Base implementation: just validate
  }

  /**
   * Code Optimization
   */
  protected optimizeCode(source: string): void {
    // Base implementation
    const passes = this.config.optimization_level;
    this.optimization_count += passes;

    // Dummy optimization stats
    this.warnings.push(
      `Applied ${passes} optimization passes`
    );
  }

  /**
   * Code Generation - Variant-specific (must override)
   */
  protected generateCode(source: string): void {
    throw new Error('generateCode must be implemented by variant');
  }

  /**
   * Linking - Combine object files
   */
  protected linkOutput(): void {
    // Base implementation
  }

  // ────────── Configuration ──────────

  /**
   * Set configuration
   */
  setConfig(config: Partial<CompilerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): CompilerConfig {
    return { ...this.config };
  }

  /**
   * Set optimization level (0-3)
   */
  setOptimizationLevel(level: 0 | 1 | 2 | 3): void {
    this.config.optimization_level = level;
  }

  /**
   * Enable/disable debug info
   */
  setDebugInfo(enabled: boolean): void {
    this.config.debug_info = enabled;
  }

  /**
   * Enable/disable profiling
   */
  setProfileEnabled(enabled: boolean): void {
    this.config.profile_enabled = enabled;
  }

  // ────────── Output Management ──────────

  /**
   * Set output file
   */
  setOutputFile(filename: string): void {
    this.config.output_file = filename;
  }

  /**
   * Get output file
   */
  getOutputFile(): string {
    return this.config.output_file;
  }

  // ────────── Warnings & Errors ──────────

  /**
   * Add warning
   */
  protected addWarning(message: string): void {
    this.warnings.push(message);
  }

  /**
   * Add error
   */
  protected addError(message: string): void {
    this.errors.push(message);
  }

  /**
   * Get warnings
   */
  getWarnings(): string[] {
    return [...this.warnings];
  }

  /**
   * Get errors
   */
  getErrors(): string[] {
    return [...this.errors];
  }

  /**
   * Clear warnings
   */
  clearWarnings(): void {
    this.warnings = [];
  }

  /**
   * Clear errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  // ────────── Diagnostics ──────────

  /**
   * Get compilation statistics
   */
  getStats(): {
    target: CompileTarget;
    stages_completed: number;
    optimization_passes: number;
    warnings_count: number;
    errors_count: number;
  } {
    return {
      target: this.config.target,
      stages_completed: this.stages.filter(s => s.success).length,
      optimization_passes: this.optimization_count,
      warnings_count: this.warnings.length,
      errors_count: this.errors.length,
    };
  }

  /**
   * Get stages
   */
  getStages(): CompilationStage[] {
    return [...this.stages];
  }

  /**
   * Reset compiler state
   */
  reset(): void {
    this.stages = [];
    this.warnings = [];
    this.errors = [];
    this.optimization_count = 0;
  }
}

export default IntegratedCompilerBase;
