/**
 * Phase 5 Stage 3.2: Variable Type Recommender
 *
 * Recommends whether variable type annotations can be omitted based on:
 * - Inference confidence (0.0-1.0)
 * - Type clarity and usage patterns
 * - Development mode settings
 *
 * Philosophy: "Omit when confident, show comment when uncertain"
 *
 * Confidence thresholds:
 * - ≥0.80: Very safe to omit (e.g., let x = 5)
 * - 0.70-0.79: Safe to omit with confidence comment
 * - 0.60-0.69: Show in comment, recommend explicit type
 * - <0.60: Recommend explicit type (too uncertain)
 */

export interface VariableTypeInfo {
  name: string;                           // Variable name
  inferredType: string;                   // Inferred type
  confidence: number;                     // 0.0-1.0
  source: string;                         // 'assignment', 'method', 'operation', etc
  reasoning: string[];                    // Why this type was inferred
  relatedVariables?: string[];            // Variables used in inference
}

export interface TypeRecommendation {
  shouldOmitType: boolean;                // Recommend omitting explicit type
  shouldShowComment: boolean;             // Should show confidence comment
  comment: string;                        // Suggested comment text
  explanation: string;                    // Why this recommendation
  riskLevel: 'safe' | 'medium' | 'risky'; // Risk level of omitting type
}

/**
 * Recommender for variable type annotations
 * Decides whether to output explicit type or let system infer
 */
export class VariableTypeRecommender {
  // Confidence thresholds (tunable)
  private omitThreshold = 0.70;        // Safe to omit if >= this
  private showCommentThreshold = 0.60; // Show comment if >= this
  private safeThreshold = 0.80;         // Very safe if >= this

  constructor(options?: {
    omitThreshold?: number;
    showCommentThreshold?: number;
    safeThreshold?: number;
  }) {
    if (options?.omitThreshold !== undefined) {
      this.omitThreshold = options.omitThreshold;
    }
    if (options?.showCommentThreshold !== undefined) {
      this.showCommentThreshold = options.showCommentThreshold;
    }
    if (options?.safeThreshold !== undefined) {
      this.safeThreshold = options.safeThreshold;
    }
  }

  /**
   * Main method: Get recommendation for a variable
   */
  public recommend(info: VariableTypeInfo): TypeRecommendation {
    const confidence = info.confidence;

    if (confidence >= this.safeThreshold) {
      // Very high confidence: safe to omit completely
      return {
        shouldOmitType: true,
        shouldShowComment: false,
        comment: this.generateComment(info, false),
        explanation: 'High confidence inference - type omission is safe',
        riskLevel: 'safe'
      };
    } else if (confidence >= this.omitThreshold) {
      // High confidence: can omit but might show comment
      return {
        shouldOmitType: true,
        shouldShowComment: true,
        comment: this.generateComment(info, true),
        explanation: 'Moderate confidence - shows inferred type in comment for clarity',
        riskLevel: 'medium'
      };
    } else if (confidence >= this.showCommentThreshold) {
      // Medium confidence: recommend explicit type but show inference
      return {
        shouldOmitType: false,
        shouldShowComment: true,
        comment: this.generateComment(info, true),
        explanation: 'Lower confidence - recommend explicit type with inference comment',
        riskLevel: 'medium'
      };
    } else {
      // Low confidence: require explicit type
      return {
        shouldOmitType: false,
        shouldShowComment: true,
        comment: this.generateComment(info, true),
        explanation: 'Low confidence - explicit type annotation recommended',
        riskLevel: 'risky'
      };
    }
  }

  /**
   * Generate comment for variable with confidence info
   */
  private generateComment(info: VariableTypeInfo, includeConfidence: boolean): string {
    if (!includeConfidence) {
      return '';
    }

    const confidencePercent = Math.round(info.confidence * 100);
    const reasoning = this.formatReasoning(info.reasoning);

    return `// Inferred: ${info.inferredType} (${confidencePercent}% confidence, source: ${info.source})${reasoning}`;
  }

  /**
   * Format reasoning array into readable string
   */
  private formatReasoning(reasoning: string[]): string {
    if (reasoning.length === 0) {
      return '';
    }

    if (reasoning.length === 1) {
      return ` - ${reasoning[0]}`;
    }

    // Multiple reasons: show first one with ellipsis
    return ` - ${reasoning[0]} (+ ${reasoning.length - 1} more)`;
  }

  /**
   * Check if variable is a loop iteration variable
   * These often have lower confidence but are generally safe
   */
  public isLoopVariable(name: string, reasoning: string[]): boolean {
    return (
      reasoning.some(r => r.includes('loop') || r.includes('for') || r.includes('iteration')) ||
      name === 'i' ||
      name === 'j' ||
      name === 'k' ||
      name === 'item' ||
      name === 'element'
    );
  }

  /**
   * Boost confidence for loop variables (generally safe)
   */
  public adjustConfidenceForLoopVariable(confidence: number, isLoopVar: boolean): number {
    if (isLoopVar && confidence > 0.5) {
      // Loop variables are generally safe even with moderate confidence
      // Add 0.10 boost if it's a recognized pattern
      return Math.min(confidence + 0.10, 1.0);
    }
    return confidence;
  }

  /**
   * Check if type is "obvious" (no need to show even in comment)
   */
  public isObviousType(type: string, value: string): boolean {
    // Obvious literal assignments
    if ((type === 'number' && /^-?\d+(\.\d+)?$/.test(value)) ||
        (type === 'string' && /^["'].*["']$/.test(value)) ||
        (type === 'boolean' && /^(true|false)$/.test(value)) ||
        (type === 'array' && /^\[.*\]$/.test(value))) {
      return true;
    }
    return false;
  }

  /**
   * Generate recommendation summary for multiple variables
   */
  public summarizeRecommendations(infos: VariableTypeInfo[]): {
    omitCount: number;
    requireCount: number;
    totalConfidence: number;
    riskLevels: Record<string, number>;
  } {
    const recommendations = infos.map(info => this.recommend(info));

    return {
      omitCount: recommendations.filter(r => r.shouldOmitType).length,
      requireCount: recommendations.filter(r => !r.shouldOmitType).length,
      totalConfidence: infos.reduce((sum, info) => sum + info.confidence, 0) / infos.length,
      riskLevels: {
        safe: recommendations.filter(r => r.riskLevel === 'safe').length,
        medium: recommendations.filter(r => r.riskLevel === 'medium').length,
        risky: recommendations.filter(r => r.riskLevel === 'risky').length
      }
    };
  }

  /**
   * Generate user-friendly explanation of recommendation
   */
  public explainRecommendation(info: VariableTypeInfo, recommendation: TypeRecommendation): string {
    const lines: string[] = [
      `Variable: ${info.name}`,
      `Inferred type: ${info.inferredType}`,
      `Confidence: ${Math.round(info.confidence * 100)}%`,
      `Source: ${info.source}`,
      `Recommendation: ${recommendation.shouldOmitType ? 'Can omit type' : 'Keep explicit type'}`,
      `Risk level: ${recommendation.riskLevel.toUpperCase()}`
    ];

    if (recommendation.shouldShowComment) {
      lines.push(`Comment: ${recommendation.comment}`);
    }

    lines.push(`Reason: ${recommendation.explanation}`);

    if (info.reasoning && info.reasoning.length > 0) {
      lines.push('');
      lines.push('Reasoning:');
      info.reasoning.forEach(r => {
        lines.push(`  - ${r}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Tuning: Create new instance with adjusted thresholds
   */
  public withThresholds(options: {
    omitThreshold?: number;
    showCommentThreshold?: number;
    safeThreshold?: number;
  }): VariableTypeRecommender {
    return new VariableTypeRecommender({
      omitThreshold: options.omitThreshold ?? this.omitThreshold,
      showCommentThreshold: options.showCommentThreshold ?? this.showCommentThreshold,
      safeThreshold: options.safeThreshold ?? this.safeThreshold
    });
  }
}

/**
 * Export singleton instance with default thresholds
 */
export const variableTypeRecommender = new VariableTypeRecommender();
