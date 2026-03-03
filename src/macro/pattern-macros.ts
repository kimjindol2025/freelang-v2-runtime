/**
 * FreeLang Macro System: Pattern Matching Macros
 *
 * Support for pattern-based macros with wildcards and captures
 */

import { MacroDefinition, MacroArgument, ASTNode } from './macro-definition';

/**
 * Pattern matcher type
 */
export type PatternMatcherType = 'literal' | 'wildcard' | 'sequence' | 'alternative' | 'regex';

/**
 * Pattern matcher
 */
export interface PatternMatcher {
  type: PatternMatcherType;
  value?: string;
  subPatterns?: PatternMatcher[];
  regex?: RegExp;
}

/**
 * Pattern capture result
 */
export interface PatternCapture {
  name: string;
  value: string;
}

/**
 * Pattern macro
 */
export interface PatternMacroDefinition extends MacroDefinition {
  kind: 'pattern-macro';
  patterns: MacroPattern[];
}

/**
 * Macro pattern with replacement
 */
export interface MacroPattern {
  pattern: PatternMatcher;
  replacement: string;
  condition?: (captures: Map<string, string>) => boolean;
  priority?: number;  // Higher priority patterns match first
}

/**
 * Pattern match result
 */
export interface PatternMatchResult {
  matched: boolean;
  captures: Map<string, string>;
  pattern?: MacroPattern;
}

/**
 * Pattern Matcher Engine
 */
export class PatternMatchingEngine {
  /**
   * Match input against pattern
   */
  public static match(
    input: string,
    pattern: PatternMatcher
  ): PatternMatchResult {
    const captures = new Map<string, string>();
    const matched = this.matchPattern(input, pattern, captures);

    return {
      matched,
      captures
    };
  }

  /**
   * Recursively match pattern
   */
  private static matchPattern(
    input: string,
    pattern: PatternMatcher,
    captures: Map<string, string>
  ): boolean {
    switch (pattern.type) {
      case 'literal':
        return input === pattern.value;

      case 'wildcard': {
        // Wildcard matches anything and captures it
        if (pattern.value) {
          captures.set(pattern.value, input);
        }
        return true;
      }

      case 'regex': {
        if (!pattern.regex) return false;
        const match = input.match(pattern.regex);
        if (!match) return false;

        // Capture groups
        if (pattern.value) {
          captures.set(pattern.value, match[0]);
        }
        return true;
      }

      case 'sequence': {
        // Match sequence of patterns
        const subPatterns = pattern.subPatterns || [];
        const inputs = input.split(/\s+/);  // Simple splitting

        if (inputs.length !== subPatterns.length) {
          return false;
        }

        for (let i = 0; i < subPatterns.length; i++) {
          if (!this.matchPattern(inputs[i], subPatterns[i], captures)) {
            return false;
          }
        }
        return true;
      }

      case 'alternative': {
        // Try each alternative
        const subPatterns = pattern.subPatterns || [];

        for (const subPattern of subPatterns) {
          const subCaptures = new Map<string, string>();
          if (this.matchPattern(input, subPattern, subCaptures)) {
            // Copy captures
            subCaptures.forEach((value, key) => captures.set(key, value));
            return true;
          }
        }
        return false;
      }

      default:
        return false;
    }
  }
}

/**
 * Pattern Macro Processor
 */
export class PatternMacroProcessor {
  /**
   * Process pattern macro with multiple patterns
   */
  public static processPatternMacro(
    input: string,
    macro: PatternMacroDefinition
  ): { success: boolean; result?: string; error?: string } {
    // Sort patterns by priority (higher first)
    const sortedPatterns = [...macro.patterns].sort((a, b) => {
      const priorityA = a.priority || 0;
      const priorityB = b.priority || 0;
      return priorityB - priorityA;
    });

    // Try each pattern
    for (const pattern of sortedPatterns) {
      const result = PatternMatchingEngine.match(input, pattern.pattern);

      if (result.matched) {
        // Check condition if present
        if (pattern.condition && !pattern.condition(result.captures)) {
          continue;
        }

        // Apply replacement
        const replaced = this.applyReplacement(
          pattern.replacement,
          result.captures
        );

        return {
          success: true,
          result: replaced
        };
      }
    }

    return {
      success: false,
      error: `No pattern matched for input: ${input}`
    };
  }

  /**
   * Apply replacement with captures
   */
  private static applyReplacement(
    replacement: string,
    captures: Map<string, string>
  ): string {
    let result = replacement;

    // Replace capture references
    captures.forEach((value, name) => {
      const pattern = new RegExp(`\\$${name}\\b`, 'g');
      result = result.replace(pattern, value);
    });

    // Replace numbered captures
    let index = 0;
    captures.forEach((value) => {
      const pattern = new RegExp(`\\$${index}\\b`, 'g');
      result = result.replace(pattern, value);
      index++;
    });

    return result;
  }
}

/**
 * Pattern Builder (Fluent API)
 */
export class PatternBuilder {
  private matcher: PatternMatcher;
  private replacement: string = '';
  private condition?: (captures: Map<string, string>) => boolean;
  private priority: number = 0;

  /**
   * Match literal value
   */
  public static literal(value: string): PatternBuilder {
    const builder = new PatternBuilder();
    builder.matcher = { type: 'literal', value };
    return builder;
  }

  /**
   * Match anything and capture
   */
  public static wildcard(name?: string): PatternBuilder {
    const builder = new PatternBuilder();
    builder.matcher = { type: 'wildcard', value: name };
    return builder;
  }

  /**
   * Match regex pattern
   */
  public static regex(pattern: string | RegExp): PatternBuilder {
    const builder = new PatternBuilder();
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    builder.matcher = { type: 'regex', regex };
    return builder;
  }

  /**
   * Match sequence of patterns
   */
  public static sequence(...matchers: PatternMatcher[]): PatternBuilder {
    const builder = new PatternBuilder();
    builder.matcher = { type: 'sequence', subPatterns: matchers };
    return builder;
  }

  /**
   * Match one of alternatives
   */
  public static alternatives(...matchers: PatternMatcher[]): PatternBuilder {
    const builder = new PatternBuilder();
    builder.matcher = { type: 'alternative', subPatterns: matchers };
    return builder;
  }

  /**
   * Set replacement string
   */
  public then(replacement: string): PatternBuilder {
    this.replacement = replacement;
    return this;
  }

  /**
   * Add condition
   */
  public when(condition: (captures: Map<string, string>) => boolean): PatternBuilder {
    this.condition = condition;
    return this;
  }

  /**
   * Set priority
   */
  public withPriority(priority: number): PatternBuilder {
    this.priority = priority;
    return this;
  }

  /**
   * Build pattern
   */
  public build(): MacroPattern {
    return {
      pattern: this.matcher,
      replacement: this.replacement,
      condition: this.condition,
      priority: this.priority
    };
  }
}

/**
 * AST Pattern Matcher (for matching AST nodes)
 */
export class ASTPatternMatcher {
  /**
   * Match AST node against pattern
   */
  public static matchAST(
    node: any,
    pattern: PatternMatcher,
    captures: Map<string, any> = new Map()
  ): boolean {
    if (pattern.type === 'literal') {
      // Match node type
      return node.type === pattern.value;
    }

    if (pattern.type === 'wildcard') {
      // Capture the entire node
      if (pattern.value) {
        captures.set(pattern.value, node);
      }
      return true;
    }

    if (pattern.type === 'sequence') {
      // Match sequence of statements
      if (!Array.isArray(node)) return false;

      const subPatterns = pattern.subPatterns || [];
      if (node.length !== subPatterns.length) return false;

      for (let i = 0; i < node.length; i++) {
        if (!this.matchAST(node[i], subPatterns[i], captures)) {
          return false;
        }
      }
      return true;
    }

    if (pattern.type === 'alternative') {
      // Try each alternative
      for (const subPattern of pattern.subPatterns || []) {
        const subCaptures = new Map();
        if (this.matchAST(node, subPattern, subCaptures)) {
          // Copy captures
          subCaptures.forEach((value, key) => captures.set(key, value));
          return true;
        }
      }
      return false;
    }

    return false;
  }
}
