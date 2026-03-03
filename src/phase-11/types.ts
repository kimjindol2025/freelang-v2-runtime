/**
 * Phase 11: Type Definitions
 *
 * Shared types for feedback analysis and confidence adjustment
 */

/**
 * Feedback statistics for summary reporting
 */
export interface FeedbackSummary {
  totalFeedbackEntries: number;
  totalPatternsAffected: number;
  timeRange: {
    earliest: number;  // timestamp
    latest: number;    // timestamp
    durationDays: number;
  };
  feedbackSources: {
    approved: number;
    modified: number;
    rejected: number;
    suggested: number;
  };
}

/**
 * Confidence trend over time
 */
export interface ConfidenceTrendData {
  patternName: string;
  dataPoints: {
    timestamp: number;
    confidence: number;
    feedbackCount: number;
  }[];
  trend: 'improving' | 'declining' | 'stable';
  slopePercent: number; // % per day
}

/**
 * Pattern discovery candidate
 * Patterns that users wanted but couldn't find (from "suggest" feedback)
 */
export interface DiscoveryCandidate {
  suggestionCount: number;
  commonKeywords: string[];
  suggestedNames: string[];
  relatedPatterns: string[];
  priority: 'high' | 'medium' | 'low';
}

/**
 * Confidence adjustment validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  statistics: {
    allConfidencesInRange: boolean;
    noNaNValues: boolean;
    noDuplicates: boolean;
    correctMetadataCount: boolean;
  };
}

export default {};
