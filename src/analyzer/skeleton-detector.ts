/**
 * Phase 5 Stage 3.3.1: Skeleton Function Detector
 *
 * Detects functions with missing bodies (skeleton functions)
 * and extracts metadata for stub generation.
 *
 * A "skeleton function" is one that has:
 * - Function header (name, input, output, intent)
 * - NO body (body is undefined)
 *
 * Example:
 * fn calculate_tax
 *   input: number
 *   output: number
 *   intent: "Calculate income tax"
 * (missing: do { ... })
 */

import { MinimalFunctionAST } from '../parser/ast';

/**
 * Information about a potential skeleton function
 */
export interface SkeletonInfo {
  isSkeleton: boolean;           // true if body is missing
  functionName: string;          // Function name
  inputType: string;             // Input type
  outputType: string;            // Output type
  intent?: string;               // Optional intent/description
  decorator?: string;            // @minimal, etc.
  completeness: number;          // 0.0 (header only) to 1.0 (complete)
  suggestions: string[];         // Auto-completion hints
}

/**
 * Skeleton Function Detector
 *
 * Analyzes AST to identify skeleton functions and extract metadata
 */
export class SkeletonDetector {
  /**
   * Detect if function is a skeleton and extract metadata
   *
   * @param ast Parsed function AST
   * @returns Skeleton information
   */
  public detect(ast: MinimalFunctionAST): SkeletonInfo {
    const isSkeleton = !ast.body || ast.body.trim().length === 0;

    // Calculate completeness
    const completeness = this._calculateCompleteness(ast);

    // Generate suggestions
    const suggestions = this._generateSuggestions(ast);

    return {
      isSkeleton,
      functionName: ast.fnName,
      inputType: ast.inputType,
      outputType: ast.outputType,
      intent: ast.intent,
      decorator: ast.decorator,
      completeness,
      suggestions
    };
  }

  /**
   * Calculate function completeness (0.0-1.0)
   *
   * 0.0 = header only (skeleton)
   * 0.5 = header + minimal body (placeholder)
   * 1.0 = complete with documentation
   */
  private _calculateCompleteness(ast: MinimalFunctionAST): number {
    let score = 0;

    // Base: header present = 0.2
    score += 0.2;

    // Body present = +0.4
    if (ast.body && ast.body.trim().length > 0) {
      score += 0.4;
    }

    // Intent present = +0.2
    if (ast.intent && ast.intent.trim().length > 0) {
      score += 0.2;
    }

    // @minimal decorator = reduce score
    if (ast.decorator === 'minimal') {
      score *= 0.8;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Generate auto-completion suggestions based on metadata
   */
  private _generateSuggestions(ast: MinimalFunctionAST): string[] {
    const suggestions: string[] = [];

    // Suggestion 1: Function purpose
    if (ast.intent) {
      suggestions.push(`Purpose: ${ast.intent}`);
    } else {
      suggestions.push(`Purpose: [Missing - add intent description]`);
    }

    // Suggestion 2: Input handling
    suggestions.push(`Input: ${ast.inputType}`);

    // Suggestion 3: Output expectation
    suggestions.push(`Output: ${ast.outputType}`);

    // Suggestion 4: Body status
    if (!ast.body || ast.body.trim().length === 0) {
      suggestions.push(`[TODO: Implement function body]`);
    } else if (ast.body.length < 50) {
      suggestions.push(`[TODO: Expand function body - currently too simple]`);
    }

    // Suggestion 5: Type-based hint
    suggestions.push(this._generateTypeHint(ast.inputType, ast.outputType));

    return suggestions;
  }

  /**
   * Generate type-based implementation hint
   */
  private _generateTypeHint(inputType: string, outputType: string): string {
    // Array operations
    if (inputType.includes('array') && outputType.includes('array')) {
      return `[Hint: Use .map(), .filter(), or .reduce() on input array]`;
    }

    // Array to scalar
    if (inputType.includes('array') && !outputType.includes('array')) {
      return `[Hint: Aggregate array (sum, min, max, count, etc.)]`;
    }

    // Scalar to array
    if (!inputType.includes('array') && outputType.includes('array')) {
      return `[Hint: Generate or transform to array]`;
    }

    // Number operations
    if (inputType.includes('number') && outputType.includes('number')) {
      return `[Hint: Use arithmetic operations on input]`;
    }

    // String operations
    if (inputType.includes('string') && outputType.includes('string')) {
      return `[Hint: Use string methods (.replace, .split, .toUpperCase, etc.)]`;
    }

    // Type conversion
    if (inputType !== outputType) {
      return `[Hint: Transform ${inputType} to ${outputType}]`;
    }

    return `[Hint: Process input and return output]`;
  }

  /**
   * Classify function by domain based on name and intent
   */
  public classifyDomain(
    info: SkeletonInfo
  ): 'math' | 'string' | 'array' | 'boolean' | 'general' {
    const name = info.functionName.toLowerCase();
    const intent = (info.intent || '').toLowerCase();
    const fullText = `${name} ${intent}`;

    // Math domain - use looser regex without strict word boundaries
    if (
      /(sum|average|min|max|total|calculate|tax|percent|multiply|divide|power|sqrt)/i.test(
        fullText
      )
    ) {
      return 'math';
    }

    // String domain - check for string operations
    if (
      /(string|text|word|char|uppercase|lowercase|upper|lower|trim|replace|split|concat|format|parse)/i.test(
        fullText
      )
    ) {
      return 'string';
    }

    // Array domain - check for array operations
    if (
      /(array|list|map|filter|reduce|sort|find|count|length|iterate|element|item)/i.test(
        fullText
      )
    ) {
      return 'array';
    }

    // Boolean domain - check for boolean operations
    if (
      /(check|is|valid|contains|empty|equal|compare|condition|if|test|match|true|false)/i.test(
        fullText
      )
    ) {
      return 'boolean';
    }

    return 'general';
  }

  /**
   * Estimate complexity based on IO types
   */
  public estimateComplexity(info: SkeletonInfo): 'simple' | 'moderate' | 'complex' {
    // Complex: array to scalar, multiple transformations
    if (info.inputType.includes('array') && !info.outputType.includes('array')) {
      return 'complex';
    }

    // Moderate: array to array, type conversion
    if (
      (info.inputType.includes('array') && info.outputType.includes('array')) ||
      info.inputType !== info.outputType
    ) {
      return 'moderate';
    }

    // Simple: same type, scalar
    return 'simple';
  }
}

/**
 * Singleton instance
 */
export const skeletonDetector = new SkeletonDetector();
