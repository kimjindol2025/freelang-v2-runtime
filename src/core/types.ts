/**
 * Core Type Definitions
 * Phase 1 - AutoHeaderEngine 핵심 인터페이스
 */

export interface HeaderProposal {
  header: string;              // "fn sum: array<number> -> number"
  fnName: string;              // "sum"
  inputType: string;           // "array<number>"
  outputType: string;          // "number"
  reason: string;              // "aggregation"
  directive: string;           // "@basic"
  confidence: number;          // 0-1
  alternatives: HeaderProposal[];
  matchedPattern: string;      // "sum"
}

export interface IntentPattern {
  id: string;                  // "sum"
  keywords: string[];          // ["합산", "합계", "sum", "add all"]
  inputType: string;
  outputType: string;
  defaultReason: string;
  defaultDirective: string;
  complexity: string;          // "O(n)"
}
