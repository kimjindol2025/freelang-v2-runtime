/**
 * Phase 5 Stage 3.3.2: Stub Generator
 *
 * Generates reasonable placeholder implementations for skeleton functions
 * based on metadata (input/output types, domain, complexity, intent).
 *
 * Key feature: Intent-aware generation produces domain-specific stubs
 * that are more helpful than generic placeholders.
 */

import { SkeletonInfo } from '../analyzer/skeleton-detector';

/**
 * Configuration options for stub generation
 */
export interface StubOptions {
  generateComments?: boolean;      // Add TODO comments (default: true)
  includeLogging?: boolean;        // Add console.log for debugging (default: false)
  useDataTypes?: boolean;          // Return typed defaults (default: true)
}

/**
 * Generated stub code with metadata
 */
export interface GeneratedStub {
  code: string;                    // Generated stub body
  placeholders: string[];          // What needs completion
  confidence: number;              // 0.0-1.0 confidence in stub appropriateness
  reasoning: string;               // Why this stub was generated
}

/**
 * Stub Generator
 *
 * Converts skeleton function metadata into reasonable placeholder implementations
 * that developers can use as starting points.
 */
export class StubGenerator {
  /**
   * Generate stub implementation for skeleton function
   *
   * @param info Skeleton information from SkeletonDetector
   * @param options Configuration options
   * @returns Generated stub with code and metadata
   */
  public generate(info: SkeletonInfo, options?: StubOptions): GeneratedStub {
    const opts = this._normalizeOptions(options);

    // Step 1: Determine base stub from output type
    const baseStub = this._generateBaseStub(info.outputType);

    // Step 2: Enhance with intent-specific logic
    const enhancedStub = this._enhanceWithIntent(
      info,
      baseStub,
      opts
    );

    // Step 3: Add comments and metadata
    const finalCode = this._formatCode(
      enhancedStub.code,
      info,
      opts
    );

    // Step 4: Identify placeholders
    const placeholders = this._extractPlaceholders(enhancedStub);

    // Step 5: Estimate confidence
    const confidence = this._calculateConfidence(info, enhancedStub);

    return {
      code: finalCode,
      placeholders,
      confidence,
      reasoning: enhancedStub.reasoning
    };
  }

  /**
   * Generate basic stub from output type
   */
  private _generateBaseStub(outputType: string): {
    code: string;
    reasoning: string;
  } {
    // Array type
    if (outputType.includes('array')) {
      return {
        code: 'return []',
        reasoning: 'Array output: returning empty array'
      };
    }

    // String type
    if (outputType.includes('string')) {
      return {
        code: 'return ""',
        reasoning: 'String output: returning empty string'
      };
    }

    // Boolean type
    if (outputType.includes('boolean')) {
      return {
        code: 'return false',
        reasoning: 'Boolean output: returning false (neutral)'
      };
    }

    // Number type (default)
    if (outputType.includes('number')) {
      return {
        code: 'return 0',
        reasoning: 'Number output: returning 0 (neutral)'
      };
    }

    // Unknown/other type
    return {
      code: 'return null',
      reasoning: 'Unknown output type: returning null'
    };
  }

  /**
   * Enhance stub based on intent and domain
   */
  private _enhanceWithIntent(
    info: SkeletonInfo,
    baseStub: { code: string; reasoning: string },
    opts: StubOptions
  ): {
    code: string;
    reasoning: string;
  } {
    const intent = (info.intent || '').toLowerCase();
    const name = info.functionName.toLowerCase();
    const inputType = info.inputType.toLowerCase();
    const outputType = info.outputType.toLowerCase();

    // Pattern: Sum/aggregate array
    if (
      (intent.includes('sum') || intent.includes('total') || name.includes('sum')) &&
      inputType.includes('array<number>')
    ) {
      return {
        code: 'return input.reduce((a, b) => a + b, 0)',
        reasoning: 'Math pattern: Array sum → using reduce()'
      };
    }

    // Pattern: Count elements
    if (
      (intent.includes('count') || name.includes('count')) &&
      inputType.includes('array')
    ) {
      return {
        code: 'return input.length',
        reasoning: 'Array pattern: Counting elements → length'
      };
    }

    // Pattern: Filter array
    if (
      (intent.includes('filter') || intent.includes('keep')) &&
      inputType.includes('array') &&
      outputType.includes('array')
    ) {
      if (intent.includes('positive') || intent.includes('> 0')) {
        return {
          code: 'return input.filter(x => x > 0)',
          reasoning: 'Array filter pattern: keeping positive numbers'
        };
      } else if (intent.includes('empty') || intent.includes('remove')) {
        return {
          code: 'return input.filter(x => x)',
          reasoning: 'Array filter pattern: removing falsy values'
        };
      } else {
        return {
          code: 'return input.filter(x => true)',
          reasoning: 'Array filter pattern: generic filter'
        };
      }
    }

    // Pattern: Map/transform array
    if (
      (intent.includes('map') || intent.includes('transform')) &&
      inputType.includes('array') &&
      outputType.includes('array')
    ) {
      return {
        code: 'return input.map(x => x)',
        reasoning: 'Array map pattern: identity transform'
      };
    }

    // Pattern: Average/mean
    if (
      (intent.includes('average') || intent.includes('mean')) &&
      inputType.includes('array<number>')
    ) {
      return {
        code: 'const sum = input.reduce((a, b) => a + b, 0); return sum / input.length',
        reasoning: 'Math pattern: Array average → sum/length'
      };
    }

    // Pattern: Percentage/tax calculation
    if (
      (intent.includes('percent') || intent.includes('tax')) &&
      outputType.includes('number')
    ) {
      const rate = this._extractPercentageFromIntent(intent);
      return {
        code: `return input * ${rate}`,
        reasoning: `Tax/percentage pattern: ${rate} rate from intent`
      };
    }

    // Pattern: String transformation
    if (
      (intent.includes('uppercase') || intent.includes('upper')) &&
      inputType.includes('string')
    ) {
      return {
        code: 'return input.toUpperCase()',
        reasoning: 'String pattern: uppercase conversion'
      };
    }

    // Pattern: String lowercase
    if (
      (intent.includes('lowercase') || intent.includes('lower')) &&
      inputType.includes('string')
    ) {
      return {
        code: 'return input.toLowerCase()',
        reasoning: 'String pattern: lowercase conversion'
      };
    }

    // Pattern: String concatenation/joining
    if (
      (intent.includes('join') || intent.includes('concat')) &&
      inputType.includes('array')
    ) {
      return {
        code: 'return input.join(",")',
        reasoning: 'String pattern: array joining'
      };
    }

    // Pattern: String length
    if (
      (intent.includes('length') || intent.includes('size')) &&
      inputType.includes('string')
    ) {
      return {
        code: 'return input.length',
        reasoning: 'String pattern: length property'
      };
    }

    // Pattern: Boolean check (exists/is valid)
    if (
      (intent.includes('check') || intent.includes('is') || intent.includes('valid')) &&
      outputType.includes('boolean')
    ) {
      if (intent.includes('empty')) {
        return {
          code: 'return input.length === 0',
          reasoning: 'Boolean pattern: empty check'
        };
      } else if (intent.includes('contains')) {
        return {
          code: 'return true',
          reasoning: 'Boolean pattern: contains check (stub)'
        };
      } else {
        return {
          code: 'return !!input',
          reasoning: 'Boolean pattern: truthiness check'
        };
      }
    }

    // No specific pattern matched - use base stub
    return baseStub;
  }

  /**
   * Extract percentage/rate from intent string
   */
  private _extractPercentageFromIntent(intent: string): number {
    // Try to find percentages like "15%", "0.15", "15 percent"
    const percentMatch = intent.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentMatch) {
      return parseInt(percentMatch[1]) / 100;
    }

    const decimalMatch = intent.match(/(\d+\.\d+)\s*rate/);
    if (decimalMatch) {
      return parseFloat(decimalMatch[1]);
    }

    // Common defaults
    if (intent.includes('tax')) return 0.15;
    if (intent.includes('discount')) return 0.10;

    return 0.1;  // default 10%
  }

  /**
   * Format generated code with comments and logging
   */
  private _formatCode(
    code: string,
    info: SkeletonInfo,
    opts: StubOptions
  ): string {
    let result = '';

    if (opts.generateComments) {
      result += `// TODO: Implement ${info.functionName}\n`;
      result += `// Input: ${info.inputType}\n`;
      result += `// Output: ${info.outputType}\n`;
      if (info.intent) {
        result += `// Intent: ${info.intent}\n`;
      }
      result += '\n';
    }

    if (opts.includeLogging) {
      result += `console.log('${info.functionName} called with:', input);\n`;
    }

    result += code;

    return result;
  }

  /**
   * Extract placeholder descriptions from stub
   */
  private _extractPlaceholders(stub: {
    code: string;
    reasoning: string;
  }): string[] {
    const placeholders: string[] = [];

    if (stub.code.includes('TODO')) {
      placeholders.push('Complete implementation');
    }

    if (stub.code.includes('[') && stub.code.includes(']')) {
      placeholders.push('Fill array access patterns');
    }

    if (stub.code.includes('=>') && stub.code.includes('true')) {
      placeholders.push('Refine filter logic');
    }

    if (stub.code.includes('rate')) {
      placeholders.push('Verify calculation rate');
    }

    if (placeholders.length === 0) {
      placeholders.push('Consider edge cases');
      placeholders.push('Add input validation');
    }

    return placeholders;
  }

  /**
   * Calculate confidence in generated stub
   */
  private _calculateConfidence(
    info: SkeletonInfo,
    stub: { code: string; reasoning: string }
  ): number {
    let confidence = 0.5;  // Base confidence

    // Increase with intent specificity
    if (info.intent && info.intent.length > 20) {
      confidence += 0.2;
    }

    // Increase with clear IO types
    if (!info.inputType.includes('unknown') && !info.outputType.includes('unknown')) {
      confidence += 0.15;
    }

    // Increase if stub has actual logic (not just default return)
    if (
      stub.code.includes('.') ||
      stub.code.includes('[') ||
      stub.code.includes('(')
    ) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Normalize options with defaults
   */
  private _normalizeOptions(opts?: StubOptions): StubOptions {
    return {
      generateComments: opts?.generateComments ?? true,
      includeLogging: opts?.includeLogging ?? false,
      useDataTypes: opts?.useDataTypes ?? true
    };
  }
}

/**
 * Singleton instance for global use
 */
export const stubGenerator = new StubGenerator();
