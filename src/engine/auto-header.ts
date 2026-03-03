// FreeLang v2 - Auto Header Engine
// Converts free-form input to structured headers for IR generation

import { patterns, keywordToOp, Directive } from './patterns';

/**
 * Confidence 레벨 정의 (매직 넘버 제거)
 *
 * 의미:
 * - EXACT (0.95): 완전 일치 또는 explicit 선언
 * - SUBSTRING (0.70): 부분 문자열 매칭
 * - FUZZY (0.50): fuzzy/edit distance 기반 매칭
 */
export const CONFIDENCE_LEVELS = {
  EXACT: 0.95,
  SUBSTRING: 0.70,
  FUZZY: 0.50,
} as const;

export interface HeaderProposal {
  fn: string;                    // function name
  input: string;                 // input type
  output: string;                // output type
  reason: string;                // business rationale
  directive: Directive;          // optimization hint (speed | memory | safety)
  complexity: string;            // time complexity
  confidence: number;            // 0.0-1.0 (normalized)
  matched_op: string;            // which pattern was matched
}

export class AutoHeaderEngine {
  /**
   * Parse free-form input and generate header proposal
   *
   * Input: "배열 합산", "sum arr", "add all", etc
   * Output: { fn: "sum", input: "array<number>", output: "number", confidence: 95 }
   */
  generate(input: string): HeaderProposal | null {
    // Step 1: Normalize input (tokenize)
    const tokens = this.tokenize(input);
    if (tokens.length === 0) return null;

    // Step 2: Match against patterns
    const matched = this.matchPatterns(tokens);
    if (!matched) return null;

    // Step 3: Build proposal
    const pattern = patterns[matched.op];
    if (!pattern) return null;

    return {
      fn: matched.op,
      input: pattern.input,
      output: pattern.output,
      reason: pattern.reason,
      directive: pattern.directive,
      complexity: pattern.complexity,
      confidence: matched.confidence,
      matched_op: matched.op,
    };
  }

  private tokenize(input: string): string[] {
    // Simple tokenization: split by space, lowercase, remove empty
    return input
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  private matchPatterns(tokens: string[]): { op: string; confidence: number } | null {
    let bestMatch: { op: string; confidence: number } | null = null;

    for (const token of tokens) {
      const op = keywordToOp[token];
      if (op) {
        // Exact match = high confidence
        bestMatch = { op, confidence: CONFIDENCE_LEVELS.EXACT };
        break;
      }
    }

    if (!bestMatch) {
      // Try substring matching (lower confidence)
      for (const token of tokens) {
        for (const [keyword, op] of Object.entries(keywordToOp)) {
          if (token.includes(keyword) || keyword.includes(token)) {
            bestMatch = { op, confidence: CONFIDENCE_LEVELS.SUBSTRING };
            break;
          }
        }
        if (bestMatch) break;
      }
    }

    if (!bestMatch) {
      // Try fuzzy matching (very low confidence)
      for (const patternOp of Object.keys(patterns)) {
        for (const token of tokens) {
          if (this.fuzzyMatch(token, patternOp) > 0.7) {
            bestMatch = { op: patternOp, confidence: CONFIDENCE_LEVELS.FUZZY };
            break;
          }
        }
        if (bestMatch) break;
      }
    }

    return bestMatch;
  }

  private fuzzyMatch(a: string, b: string): number {
    // Levenshtein-like distance heuristic
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;

    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return 1.0 - editDistance / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
    const costs: number[] = [];
    for (let j = 0; j <= b.length; j++) costs[j] = j;

    for (let i = 1; i <= a.length; i++) {
      costs[0] = i;
      let nw = i - 1;

      for (let j = 1; j <= b.length; j++) {
        const cj = Math.min(
          1 + Math.min(costs[j], costs[j - 1]),
          nw + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
        nw = costs[j];
        costs[j] = cj;
      }
    }

    return costs[b.length];
  }

  /**
   * Get all available operations for reference
   */
  getOperations(): string[] {
    return Object.keys(patterns);
  }

  /**
   * Get pattern details
   */
  getPattern(op: string) {
    return patterns[op] || null;
  }
}
