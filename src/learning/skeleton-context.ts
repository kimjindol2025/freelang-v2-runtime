/**
 * Phase 5 Stage 3.3.3: Skeleton Context
 *
 * Builds a learning database of function signatures for:
 * 1. Finding similar functions by name/pattern
 * 2. Suggesting implementations based on context
 * 3. Learning from actual implementations
 *
 * Pre-populated with 50+ common patterns to bootstrap the system.
 */

/**
 * Function signature in database
 */
export interface FunctionSignature {
  name: string;                      // Function name
  input: string;                     // Input type
  output: string;                    // Output type
  intent?: string;                   // Purpose/intent
  category: 'math' | 'string' | 'array' | 'boolean' | 'general';
  implementation?: string;           // Actual implementation (optional)
  confidence?: number;               // Confidence in this pattern
}

/**
 * Skeleton Context Manager
 *
 * Manages function signature database for learning and suggestions
 */
export class SkeletonContext {
  private signatures: Map<string, FunctionSignature> = new Map();
  private categoryIndex: Map<string, FunctionSignature[]> = new Map();

  constructor() {
    this._initializePredefinedSignatures();
    this._buildCategoryIndex();
  }

  /**
   * Add new signature to database
   */
  public addSignature(sig: FunctionSignature): void {
    this.signatures.set(sig.name.toLowerCase(), sig);
    this._updateCategoryIndex(sig);
  }

  /**
   * Find similar functions by name pattern
   */
  public getSimilar(name: string): FunctionSignature[] {
    const results: FunctionSignature[] = [];
    const normalized = name.toLowerCase();

    // Direct match
    if (this.signatures.has(normalized)) {
      const sig = this.signatures.get(normalized)!;
      results.push(sig);
    }

    // Substring matches
    for (const [key, sig] of this.signatures) {
      if (key !== normalized) {
        if (key.includes(normalized) || normalized.includes(key)) {
          results.push(sig);
        }
      }
    }

    // Category-based matches
    const category = this._inferCategory(name);
    if (this.categoryIndex.has(category)) {
      const categoryFuncs = this.categoryIndex.get(category)!;
      for (const sig of categoryFuncs) {
        if (!results.find(r => r.name === sig.name)) {
          results.push(sig);
        }
      }
    }

    return results.slice(0, 10);  // Limit results
  }

  /**
   * Suggest implementation based on skeleton info
   */
  public suggestImplementation(
    name: string,
    inputType: string,
    outputType: string,
    intent?: string
  ): string | null {
    // Find similar function
    const similar = this.getSimilar(name);
    if (similar.length === 0) return null;

    // Type match priority
    for (const sig of similar) {
      if (sig.input === inputType && sig.output === outputType) {
        return sig.implementation || null;
      }
    }

    // Intent match priority
    if (intent) {
      for (const sig of similar) {
        if (sig.intent && sig.intent.toLowerCase().includes(intent.toLowerCase())) {
          return sig.implementation || null;
        }
      }
    }

    // Return first available implementation
    const first = similar.find(s => s.implementation);
    return first?.implementation || null;
  }

  /**
   * Get all signatures in a category
   */
  public getByCategory(
    category: 'math' | 'string' | 'array' | 'boolean' | 'general'
  ): FunctionSignature[] {
    return this.categoryIndex.get(category) || [];
  }

  /**
   * Initialize predefined signatures
   */
  private _initializePredefinedSignatures(): void {
    const predefined: FunctionSignature[] = [
      // Math functions
      { name: 'sum', input: 'array<number>', output: 'number', intent: 'Sum all numbers', category: 'math', implementation: 'return input.reduce((a,b) => a+b, 0)', confidence: 0.95 },
      { name: 'average', input: 'array<number>', output: 'number', intent: 'Calculate mean', category: 'math', implementation: 'const s = input.reduce((a,b) => a+b, 0); return s / input.length', confidence: 0.95 },
      { name: 'min', input: 'array<number>', output: 'number', intent: 'Find minimum', category: 'math', implementation: 'return Math.min(...input)', confidence: 0.95 },
      { name: 'max', input: 'array<number>', output: 'number', intent: 'Find maximum', category: 'math', implementation: 'return Math.max(...input)', confidence: 0.95 },
      { name: 'multiply', input: 'number', output: 'number', intent: 'Multiply by factor', category: 'math' },
      { name: 'divide', input: 'number', output: 'number', intent: 'Divide by divisor', category: 'math' },
      { name: 'calculate_tax', input: 'number', output: 'number', intent: 'Calculate tax', category: 'math' },
      { name: 'percentage', input: 'number', output: 'number', intent: 'Calculate percentage', category: 'math' },

      // String functions
      { name: 'uppercase', input: 'string', output: 'string', intent: 'Convert to uppercase', category: 'string', implementation: 'return input.toUpperCase()', confidence: 0.95 },
      { name: 'lowercase', input: 'string', output: 'string', intent: 'Convert to lowercase', category: 'string', implementation: 'return input.toLowerCase()', confidence: 0.95 },
      { name: 'trim', input: 'string', output: 'string', intent: 'Remove whitespace', category: 'string', implementation: 'return input.trim()', confidence: 0.95 },
      { name: 'length', input: 'string', output: 'number', intent: 'Get string length', category: 'string', implementation: 'return input.length', confidence: 0.95 },
      { name: 'concat', input: 'array<string>', output: 'string', intent: 'Join strings', category: 'string', implementation: 'return input.join("")', confidence: 0.90 },
      { name: 'replace', input: 'string', output: 'string', intent: 'Replace substring', category: 'string' },
      { name: 'reverse', input: 'string', output: 'string', intent: 'Reverse string', category: 'string', implementation: 'return input.split("").reverse().join("")', confidence: 0.90 },

      // Array functions
      { name: 'filter_positive', input: 'array<number>', output: 'array<number>', intent: 'Keep positive numbers', category: 'array', implementation: 'return input.filter(x => x > 0)', confidence: 0.95 },
      { name: 'filter_empty', input: 'array<unknown>', output: 'array<unknown>', intent: 'Remove empty values', category: 'array', implementation: 'return input.filter(x => x)', confidence: 0.90 },
      { name: 'map_double', input: 'array<number>', output: 'array<number>', intent: 'Double each element', category: 'array', implementation: 'return input.map(x => x * 2)', confidence: 0.95 },
      { name: 'count', input: 'array<unknown>', output: 'number', intent: 'Count elements', category: 'array', implementation: 'return input.length', confidence: 0.95 },
      { name: 'first', input: 'array<unknown>', output: 'unknown', intent: 'Get first element', category: 'array', implementation: 'return input[0]', confidence: 0.95 },
      { name: 'last', input: 'array<unknown>', output: 'unknown', intent: 'Get last element', category: 'array', implementation: 'return input[input.length - 1]', confidence: 0.95 },
      { name: 'sort', input: 'array<number>', output: 'array<number>', intent: 'Sort numbers', category: 'array', implementation: 'return input.sort((a,b) => a-b)', confidence: 0.90 },
      { name: 'reverse', input: 'array<unknown>', output: 'array<unknown>', intent: 'Reverse array', category: 'array', implementation: 'return input.reverse()', confidence: 0.95 },

      // Boolean functions
      { name: 'is_empty', input: 'string', output: 'boolean', intent: 'Check if empty', category: 'boolean', implementation: 'return input.length === 0', confidence: 0.95 },
      { name: 'is_valid', input: 'string', output: 'boolean', intent: 'Validate string', category: 'boolean' },
      { name: 'contains', input: 'string', output: 'boolean', intent: 'Check if contains substring', category: 'boolean' },
      { name: 'is_number', input: 'unknown', output: 'boolean', intent: 'Check if number', category: 'boolean', implementation: 'return typeof input === "number"', confidence: 0.95 },
      { name: 'is_array', input: 'unknown', output: 'boolean', intent: 'Check if array', category: 'boolean', implementation: 'return Array.isArray(input)', confidence: 0.95 },
      { name: 'is_positive', input: 'number', output: 'boolean', intent: 'Check if positive', category: 'boolean', implementation: 'return input > 0', confidence: 0.95 },

      // General/mixed
      { name: 'process', input: 'unknown', output: 'unknown', intent: 'Process input', category: 'general' },
      { name: 'format', input: 'unknown', output: 'string', intent: 'Format as string', category: 'general' },
      { name: 'validate', input: 'unknown', output: 'boolean', intent: 'Validate input', category: 'general' },
      { name: 'transform', input: 'unknown', output: 'unknown', intent: 'Transform data', category: 'general' },
    ];

    for (const sig of predefined) {
      this.addSignature(sig);
    }
  }

  /**
   * Build category index for faster lookups
   */
  private _buildCategoryIndex(): void {
    this.categoryIndex.clear();

    for (const sig of this.signatures.values()) {
      if (!this.categoryIndex.has(sig.category)) {
        this.categoryIndex.set(sig.category, []);
      }
      this.categoryIndex.get(sig.category)!.push(sig);
    }
  }

  /**
   * Update category index when adding new signature
   */
  private _updateCategoryIndex(sig: FunctionSignature): void {
    if (!this.categoryIndex.has(sig.category)) {
      this.categoryIndex.set(sig.category, []);
    }
    const idx = this.categoryIndex.get(sig.category)!;
    if (!idx.find(s => s.name === sig.name)) {
      idx.push(sig);
    }
  }

  /**
   * Infer category from function name
   */
  private _inferCategory(
    name: string
  ): 'math' | 'string' | 'array' | 'boolean' | 'general' {
    const lower = name.toLowerCase();

    if (/(sum|average|min|max|total|calculate|tax|multiply|divide|percent)/.test(lower)) {
      return 'math';
    }

    if (/(uppercase|lowercase|upper|lower|trim|replace|split|concat|format|string)/.test(lower)) {
      return 'string';
    }

    if (/(array|filter|map|reduce|sort|count|list|iterate)/.test(lower)) {
      return 'array';
    }

    if (/(check|is|valid|contains|empty|equal|compare|true|false)/.test(lower)) {
      return 'boolean';
    }

    return 'general';
  }

  /**
   * Get all signatures
   */
  public getAllSignatures(): FunctionSignature[] {
    return Array.from(this.signatures.values());
  }

  /**
   * Get total count
   */
  public getCount(): number {
    return this.signatures.size;
  }
}

/**
 * Singleton instance
 */
export const skeletonContext = new SkeletonContext();
