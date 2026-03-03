/**
 * Phase 2 Compiler: Integrated E2E Compilation Pipeline
 *
 * Integrates all Task 2.1-2.4 components:
 * 1. StubGenerator (Task 2.1): Type-aware stub values
 * 2. ExpressionCompleter (Task 2.2): Complete incomplete expressions
 * 3. IncompleteTypeInferenceEngine (Task 2.3): Infer types from intent/code
 * 4. SuggestionEngine (Task 2.4): Generate warnings and suggestions
 *
 * Pipeline:
 * Incomplete Code
 *   ↓
 * Parse & Extract Intent
 *   ↓
 * Type Inference (Task 2.3)
 *   ↓
 * Expression Completion (Task 2.2)
 *   ↓
 * Stub Generation (Task 2.1)
 *   ↓
 * Suggestion & Warnings (Task 2.4)
 *   ↓
 * Compilable Code ✅
 *
 * Example:
 * ```freelang
 * fn process
 *   intent: "배열 처리"
 *   do
 *     sum = 0
 *     for item in arr
 *       sum = sum +    // ← incomplete
 *     // ← missing return
 * ↓ (Phase 2 Compiler)
 * fn process
 *   intent: "배열 처리"
 *   input: arr: array
 *   output: number
 *   do
 *     sum: number = 0
 *     for item in arr
 *       sum = sum + 0  // ← completed (Task 2.1+2.2)
 *     return sum       // ← added (Task 2.1)
 *
 * Warnings:
 *   [INCOMPLETE_EXPR] sum = sum + (incomplete)
 *   [MISSING_RETURN] Missing return for number
 * ```
 */

import { StubGenerator } from './phase-2-stub-generator';
import { ExpressionCompleter } from '../parser/expression-completer';
import { IncompleteTypeInferenceEngine } from '../analyzer/incomplete-type-inference';
import { SuggestionEngine, CompileWarning, WarningType } from './suggestion-engine';

/**
 * Compilation result
 */
export interface Phase2CompileResult {
  success: boolean;                    // Did compilation succeed?
  originalCode: string;                // Original input code
  completedCode: string;               // Code after completion
  warnings: CompileWarning[];          // All warnings found
  autoFixesApplied: number;            // Number of auto-fixes applied
  inferredSignature?: {
    name: string;
    inputs: Map<string, string>;
    output: string;
  };
  errors: string[];                    // Critical errors preventing compilation
  metadata: {
    totalWarnings: number;
    criticalCount: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
}

/**
 * Phase 2 Compiler - E2E Pipeline
 */
export class Phase2Compiler {
  private stubGenerator: StubGenerator;
  private expressionCompleter: ExpressionCompleter;
  private typeInference: IncompleteTypeInferenceEngine;
  private suggestionEngine: SuggestionEngine;

  constructor() {
    this.stubGenerator = new StubGenerator({
      defaultValue: true,
      autoComplete: true,
      strictMode: false,
    });
    this.expressionCompleter = new ExpressionCompleter();
    this.typeInference = new IncompleteTypeInferenceEngine();
    this.suggestionEngine = new SuggestionEngine();
  }

  /**
   * Main compilation entry point
   */
  public compile(code: string): Phase2CompileResult {
    const result: Phase2CompileResult = {
      success: false,
      originalCode: code,
      completedCode: code,
      warnings: [],
      autoFixesApplied: 0,
      errors: [],
      metadata: {
        totalWarnings: 0,
        criticalCount: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      },
    };

    try {
      // Step 1: Extract intent
      const intent = this.extractIntent(code);

      // Step 2: Type inference
      const signature = this.typeInference.inferTypesForIncompleteCode(intent, code);

      // Convert InferredType Map to string Map
      const inputsMap = new Map<string, string>();
      for (const [key, val] of signature.inputs) {
        const typeStr = typeof val === 'string' ? val : (val as any).type || 'unknown';
        inputsMap.set(key, typeStr);
      }

      result.inferredSignature = {
        name: signature.name,
        inputs: inputsMap,
        output: signature.output.type,
      };

      // Step 3: Get all warnings from suggestion engine
      const warnings = this.suggestionEngine.analyze(code, intent);
      result.warnings = warnings;

      // Step 4: Apply auto-fixes
      let completedCode = code;
      const autoFixableWarnings = warnings.filter(w => this.suggestionEngine.canAutoFix(w));
      for (const warning of autoFixableWarnings) {
        completedCode = this.suggestionEngine.applyAutoFix(completedCode, warning);
        result.autoFixesApplied++;
      }

      // Step 5: Generate stubs for incomplete parts
      completedCode = this.generateStubs(completedCode, signature.output.type);

      // Step 6: Final analysis on completed code
      const finalWarnings = this.suggestionEngine.analyze(completedCode, intent);

      // Step 7: Check for critical errors
      const criticalWarnings = warnings.filter(
        w => w.severity === 'CRITICAL' || w.severity === 'ERROR'
      );
      const stillCritical = finalWarnings.filter(
        w => w.severity === 'CRITICAL' || w.severity === 'ERROR'
      );

      result.completedCode = completedCode;
      result.success = stillCritical.length === 0;
      result.errors = stillCritical.map(w => w.message);

      // Update metadata
      result.metadata.totalWarnings = finalWarnings.length;
      result.metadata.criticalCount = finalWarnings.filter(w => w.severity === 'CRITICAL').length;
      result.metadata.errorCount = finalWarnings.filter(w => w.severity === 'ERROR').length;
      result.metadata.warningCount = finalWarnings.filter(w => w.severity === 'WARNING').length;
      result.metadata.infoCount = finalWarnings.filter(w => w.severity === 'INFO').length;
    } catch (error) {
      result.success = false;
      result.errors.push(`Compilation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Extract intent from code
   */
  private extractIntent(code: string): string {
    const intentMatch = code.match(/intent:\s*"([^"]+)"/);
    return intentMatch ? intentMatch[1] : '';
  }

  /**
   * Generate stubs for incomplete parts
   */
  private generateStubs(code: string, returnType: string): string {
    let result = code;

    // Add return if missing (only check for actual return statements)
    const hasReturn = /^\s*return\b/m.test(result);
    if (!hasReturn && returnType && returnType !== 'void') {
      const stub = this.stubGenerator.generateStubForType(returnType);
      if (!result.trim().endsWith('return')) {
        result += `\n  return ${stub}`;
      }
    }

    // Fill empty blocks
    const lines = result.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().endsWith('do')) {
        // Check if next line is empty or closing
        if (i + 1 >= lines.length || lines[i + 1].trim() === '' || lines[i + 1].trim().startsWith('}')) {
          lines.splice(i + 1, 0, '    stub(void)');
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Check if code is compilable
   */
  public isCompilable(code: string): boolean {
    const result = this.compile(code);
    return result.success;
  }

  /**
   * Get warnings only
   */
  public getWarnings(code: string): CompileWarning[] {
    return this.suggestionEngine.analyze(code);
  }

  /**
   * Get critical issues
   */
  public getCriticalIssues(code: string): CompileWarning[] {
    const warnings = this.suggestionEngine.analyze(code);
    return warnings.filter(w => w.severity === 'CRITICAL' || w.severity === 'ERROR');
  }

  /**
   * Auto-fix code
   */
  public autoFix(code: string): string {
    const warnings = this.suggestionEngine.analyze(code);
    let result = code;

    for (const warning of warnings) {
      if (this.suggestionEngine.canAutoFix(warning)) {
        result = this.suggestionEngine.applyAutoFix(result, warning);
      }
    }

    return result;
  }

  /**
   * Get compilation report (human-readable)
   */
  public getReport(result: Phase2CompileResult): string {
    const lines: string[] = [];

    lines.push('=== Phase 2 Compilation Report ===');
    lines.push(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    lines.push(`Auto-fixes applied: ${result.autoFixesApplied}`);
    lines.push('');

    if (result.inferredSignature) {
      lines.push('Inferred Signature:');
      lines.push(`  fn ${result.inferredSignature.name}`);
      for (const [name, type] of result.inferredSignature.inputs) {
        lines.push(`    input: ${name}: ${type}`);
      }
      lines.push(`    output: ${result.inferredSignature.output}`);
      lines.push('');
    }

    lines.push(`Warnings: ${result.metadata.totalWarnings}`);
    lines.push(`  CRITICAL: ${result.metadata.criticalCount}`);
    lines.push(`  ERROR: ${result.metadata.errorCount}`);
    lines.push(`  WARNING: ${result.metadata.warningCount}`);
    lines.push(`  INFO: ${result.metadata.infoCount}`);
    lines.push('');

    if (result.warnings.length > 0) {
      lines.push('Warnings Details:');
      for (const warning of result.warnings) {
        lines.push(`  [${warning.type}] Line ${warning.line}: ${warning.message}`);
        if (warning.autoFixable) {
          lines.push(`    → Suggestion: ${warning.suggestion}`);
          lines.push(`    → Confidence: ${(warning.confidence * 100).toFixed(0)}%`);
        }
      }
    }

    if (result.errors.length > 0) {
      lines.push('');
      lines.push('Critical Errors:');
      for (const error of result.errors) {
        lines.push(`  ❌ ${error}`);
      }
    }

    return lines.join('\n');
  }
}

// Convenience function
export function createPhase2Compiler(): Phase2Compiler {
  return new Phase2Compiler();
}
