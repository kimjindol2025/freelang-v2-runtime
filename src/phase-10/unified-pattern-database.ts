/**
 * Phase 10: Unified Pattern Database
 *
 * Final unified database combining:
 * - 578 v1-converted patterns
 * - Confidence-adjusted scores (96.67% average)
 * - Complete metadata and indexing
 * - Ready for Phase 11 (dynamic confidence)
 */

import patterns from './v1-v2-adjusted-patterns.json';

export interface IntentPattern {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  packages: string[];
  description: string;
  confidence: number;
  inputTypes: string;
  outputType: string;
  examples: Array<{
    input: string;
    output: string;
    description: string;
  }>;
  tags: string[];
  complexity: number;
  relatedPatterns: string[];
  metadata: Record<string, any>;
}

/**
 * Unified Pattern Database with full-text search and indexing
 */
export class UnifiedPatternDatabase {
  private patterns: IntentPattern[];
  private patternMap: Map<string, IntentPattern>;
  private categoryIndex: Map<string, IntentPattern[]>;
  private packageIndex: Map<string, IntentPattern[]>;
  private tagIndex: Map<string, IntentPattern[]>;
  private aliasIndex: Map<string, IntentPattern>;

  constructor() {
    this.patterns = patterns as IntentPattern[];
    this.patternMap = new Map();
    this.categoryIndex = new Map();
    this.packageIndex = new Map();
    this.tagIndex = new Map();
    this.aliasIndex = new Map();

    this.buildIndices();
  }

  /**
   * Build all indices for fast lookup
   */
  private buildIndices(): void {
    for (const pattern of this.patterns) {
      // Pattern name index
      this.patternMap.set(pattern.name, pattern);

      // Category index
      if (!this.categoryIndex.has(pattern.category)) {
        this.categoryIndex.set(pattern.category, []);
      }
      this.categoryIndex.get(pattern.category)!.push(pattern);

      // Package index
      if (pattern.packages) {
        for (const pkg of pattern.packages) {
          if (!this.packageIndex.has(pkg)) {
            this.packageIndex.set(pkg, []);
          }
          this.packageIndex.get(pkg)!.push(pattern);
        }
      }

      // Tag index
      for (const tag of pattern.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, []);
        }
        this.tagIndex.get(tag)!.push(pattern);
      }

      // Alias index
      for (const alias of pattern.aliases) {
        this.aliasIndex.set(alias, pattern);
      }
    }
  }

  /**
   * Get pattern by name
   */
  getByName(name: string): IntentPattern | undefined {
    return this.patternMap.get(name);
  }

  /**
   * Get pattern by alias
   */
  getByAlias(alias: string): IntentPattern | undefined {
    return this.aliasIndex.get(alias);
  }

  /**
   * Get pattern by ID
   */
  getById(id: string): IntentPattern | undefined {
    return this.patterns.find(p => p.id === id);
  }

  /**
   * Search patterns by full-text
   */
  search(query: string, limit: number = 20): IntentPattern[] {
    const lowerQuery = query.toLowerCase();
    const scored: Array<[IntentPattern, number]> = [];

    for (const pattern of this.patterns) {
      let score = 0;

      // Exact name match
      if (pattern.name.toLowerCase() === lowerQuery) {
        score += 100;
      }
      // Name contains query
      if (pattern.name.toLowerCase().includes(lowerQuery)) {
        score += 50;
      }
      // Alias contains query
      if (pattern.aliases.some(a => a.toLowerCase().includes(lowerQuery))) {
        score += 40;
      }
      // Description contains query
      if (pattern.description.toLowerCase().includes(lowerQuery)) {
        score += 20;
      }
      // Tag contains query
      if (pattern.tags.some(t => t.toLowerCase().includes(lowerQuery))) {
        score += 15;
      }
      // Category contains query
      if (pattern.category.toLowerCase().includes(lowerQuery)) {
        score += 10;
      }

      if (score > 0) {
        scored.push([pattern, score]);
      }
    }

    // Sort by score and confidence
    scored.sort(([a, scoreA], [b, scoreB]) => {
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.confidence - a.confidence;
    });

    return scored.slice(0, limit).map(([pattern]) => pattern);
  }

  /**
   * Get patterns by category
   */
  getByCategory(category: string): IntentPattern[] {
    return this.categoryIndex.get(category) || [];
  }

  /**
   * Get patterns by package
   */
  getByPackage(pkg: string): IntentPattern[] {
    return this.packageIndex.get(pkg) || [];
  }

  /**
   * Get patterns by tag
   */
  getByTag(tag: string): IntentPattern[] {
    return this.tagIndex.get(tag) || [];
  }

  /**
   * Get related patterns
   */
  getRelated(patternId: string, limit: number = 5): IntentPattern[] {
    const pattern = this.getById(patternId);
    if (!pattern || !pattern.relatedPatterns) return [];

    const related = pattern.relatedPatterns
      .map(id => this.getById(id))
      .filter(Boolean) as IntentPattern[];

    return related.slice(0, limit);
  }

  /**
   * Get patterns with confidence >= threshold
   */
  getHighConfidence(threshold: number = 0.85): IntentPattern[] {
    return this.patterns.filter(p => p.confidence >= threshold);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const totalPatterns = this.patterns.length;
    const avgConfidence =
      this.patterns.reduce((sum, p) => sum + p.confidence, 0) / totalPatterns;
    const highConfidence = this.patterns.filter(p => p.confidence >= 0.85).length;
    const mediumConfidence = this.patterns.filter(
      p => p.confidence >= 0.75 && p.confidence < 0.85
    ).length;

    const categories = Array.from(this.categoryIndex.keys());
    const packages = Array.from(this.packageIndex.keys());

    return {
      totalPatterns,
      averageConfidence: avgConfidence,
      confidenceBreakdown: {
        high: highConfidence,
        medium: mediumConfidence,
        low: totalPatterns - highConfidence - mediumConfidence
      },
      categories: categories.length,
      packages: packages.length,
      categoryList: categories,
      packageList: packages
    };
  }

  /**
   * Get all patterns
   */
  getAll(): IntentPattern[] {
    return [...this.patterns];
  }

  /**
   * Get pattern count
   */
  count(): number {
    return this.patterns.length;
  }
}

/**
 * Export singleton instance
 */
export const DATABASE = new UnifiedPatternDatabase();

/**
 * Export patterns for direct access
 */
export { patterns };

export default DATABASE;
