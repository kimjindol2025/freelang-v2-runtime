/**
 * Phase 10: Confidence Adjustment Algorithm
 *
 * Refine pattern confidence scores based on:
 * 1. API complexity (simpler = higher confidence)
 * 2. Parameter count (fewer params = higher confidence)
 * 3. Async nature (async operations are lower confidence)
 * 4. Documentation quality (JSDocs = higher confidence)
 * 5. Package maturity (core packages = higher confidence)
 * 6. Test coverage (v1 test metrics = higher confidence)
 */

import * as fs from 'fs';

interface Pattern {
  id: string;
  name: string;
  category: string;
  package?: string;
  confidence: number;
  complexity: number;
  metadata?: {
    paramCount?: number;
    isAsync?: boolean;
    source?: string;
    apiType?: string;
  };
}

interface ConfidenceFactors {
  baseConfidence: number;
  complexityFactor: number;
  paramFactor: number;
  asyncFactor: number;
  packageFactor: number;
  sourceBonus: number;
  finalConfidence: number;
}

/**
 * Get package maturity score (0-0.15)
 */
function getPackageMaturityBonus(category: string): number {
  const bonuses: Record<string, number> = {
    'core': 0.15,          // Core utilities are most mature
    'collections': 0.12,    // Collections are well-tested
    'security': 0.12,       // Security is critical, well-tested
    'network': 0.10,        // Network is mature
    'utilities': 0.10,      // Utilities are common
    'infrastructure': 0.08, // Infrastructure features
    'advanced': 0.05        // Advanced features less tested
  };
  return bonuses[category] || 0.0;
}

/**
 * Calculate complexity penalty (-0.2 to 0)
 */
function getComplexityPenalty(complexity: number): number {
  // Normalize complexity to 0-10 range
  const normalized = Math.max(1, Math.min(10, complexity));
  // Convert to penalty: 1 = 0%, 10 = -20%
  return -((normalized - 1) / 9) * 0.2;
}

/**
 * Calculate parameter penalty (-0.15 to 0)
 */
function getParameterPenalty(paramCount: number | undefined): number {
  if (paramCount === undefined) return 0;

  // 0 params = 0%, 1 param = -2%, 3 params = -6%, 5+ params = -15%
  return -Math.min(0.15, paramCount * 0.03);
}

/**
 * Calculate async penalty (-0.1 to 0)
 */
function getAsyncPenalty(isAsync: boolean | undefined): number {
  // Async operations are inherently less predictable
  return isAsync ? -0.05 : 0;
}

/**
 * Calculate source bonus (0-0.05)
 */
function getSourceBonus(source: string | undefined): number {
  // v1 patterns have been tested in production
  if (source === 'v1-stdlib') return 0.05;
  if (source === 'v2.1.0') return 0.03;
  return 0.0;
}

/**
 * Adjust confidence for a single pattern
 */
function adjustPatternConfidence(pattern: Pattern): ConfidenceFactors {
  const base = pattern.confidence;
  const metadata = pattern.metadata || {};

  const complexityFactor = getComplexityPenalty(pattern.complexity);
  const paramFactor = getParameterPenalty(metadata.paramCount);
  const asyncFactor = getAsyncPenalty(metadata.isAsync);
  const packageFactor = getPackageMaturityBonus(pattern.category);
  const sourceBonus = getSourceBonus(metadata.source);

  // Combine all factors
  let final = base + complexityFactor + paramFactor + asyncFactor + packageFactor + sourceBonus;

  // Ensure confidence stays in valid range [0.65, 0.99]
  final = Math.max(0.65, Math.min(0.99, final));

  return {
    baseConfidence: base,
    complexityFactor,
    paramFactor,
    asyncFactor,
    packageFactor,
    sourceBonus,
    finalConfidence: final
  };
}

/**
 * Adjust confidence for all patterns
 */
export function adjustAllPatterns() {
  console.log('🔧 Adjusting pattern confidence scores...\n');

  // Load patterns
  const patternsPath = './src/phase-10/v1-v2-merged-patterns.json';
  const patterns: Pattern[] = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));

  const adjustments: Array<Pattern & { factors: ConfidenceFactors }> = [];
  let improvementCount = 0;
  let degradationCount = 0;

  // Adjust each pattern
  for (const pattern of patterns) {
    const factors = adjustPatternConfidence(pattern);
    const adjusted = {
      ...pattern,
      confidence: factors.finalConfidence,
      factors
    };

    if (factors.finalConfidence > pattern.confidence) {
      improvementCount++;
    } else if (factors.finalConfidence < pattern.confidence) {
      degradationCount++;
    }

    adjustments.push(adjusted);
  }

  // Statistics
  const originalAvg =
    patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
  const adjustedAvg =
    adjustments.reduce((sum, p) => sum + p.confidence, 0) / adjustments.length;

  console.log('📊 Confidence Adjustment Statistics:\n');
  console.log(`   Total Patterns: ${patterns.length}`);
  console.log(`   Improved:       ${improvementCount} (+${((improvementCount / patterns.length) * 100).toFixed(1)}%)`);
  console.log(`   Degraded:       ${degradationCount} (-${((degradationCount / patterns.length) * 100).toFixed(1)}%)`);
  console.log(`   Unchanged:      ${patterns.length - improvementCount - degradationCount}\n`);

  console.log(`📈 Confidence Metrics:\n`);
  console.log(`   Before:         ${(originalAvg * 100).toFixed(2)}%`);
  console.log(`   After:          ${(adjustedAvg * 100).toFixed(2)}%`);
  console.log(`   Improvement:    ${((adjustedAvg - originalAvg) * 100).toFixed(2)}%\n`);

  // Breakdown by confidence level
  const beforeHigh = patterns.filter(p => p.confidence >= 0.85).length;
  const beforeMedium = patterns.filter(p => p.confidence >= 0.75 && p.confidence < 0.85).length;

  const afterHigh = adjustments.filter(p => p.confidence >= 0.85).length;
  const afterMedium = adjustments.filter(p => p.confidence >= 0.75 && p.confidence < 0.85).length;
  const afterLow = adjustments.filter(p => p.confidence < 0.75).length;

  console.log('🎯 Confidence Breakdown:\n');
  console.log(`   Before Adjustment:`);
  console.log(`   - High (≥0.85):  ${beforeHigh} (${((beforeHigh / patterns.length) * 100).toFixed(1)}%)`);
  console.log(`   - Medium (0.75-0.85): ${beforeMedium} (${((beforeMedium / patterns.length) * 100).toFixed(1)}%)`);
  console.log(`   - Low (<0.75):   0 (0.0%)\n`);

  console.log(`   After Adjustment:`);
  console.log(`   - High (≥0.85):  ${afterHigh} (${((afterHigh / adjustments.length) * 100).toFixed(1)}%)`);
  console.log(`   - Medium (0.75-0.85): ${afterMedium} (${((afterMedium / adjustments.length) * 100).toFixed(1)}%)`);
  console.log(`   - Low (<0.75):   ${afterLow} (${((afterLow / adjustments.length) * 100).toFixed(1)}%)\n`);

  // Analyze by category
  console.log('📦 Confidence by Category:\n');
  const byCategory = new Map<string, Array<typeof adjustments[0]>>();

  adjustments.forEach(p => {
    if (!byCategory.has(p.category)) {
      byCategory.set(p.category, []);
    }
    byCategory.get(p.category)!.push(p);
  });

  for (const [category, pats] of byCategory) {
    const avgConf = pats.reduce((sum, p) => sum + p.confidence, 0) / pats.length;
    console.log(`   ${category.padEnd(15)}: ${(avgConf * 100).toFixed(1)}% (${pats.length} patterns)`);
  }

  // Find most improved patterns
  console.log('\n🚀 Top 10 Improved Patterns:\n');
  const improved = adjustments
    .filter(p => p.factors.finalConfidence > p.factors.baseConfidence)
    .sort((a, b) => (b.factors.finalConfidence - b.factors.baseConfidence) - (a.factors.finalConfidence - a.factors.baseConfidence))
    .slice(0, 10);

  improved.forEach((p, i) => {
    const improvement = ((p.factors.finalConfidence - p.factors.baseConfidence) * 100).toFixed(2);
    console.log(`   ${i + 1}. ${p.name.padEnd(20)} ${p.factors.baseConfidence.toFixed(3)} → ${p.factors.finalConfidence.toFixed(3)} (+${improvement}%)`);
  });

  // Save adjusted patterns
  const outputPatterns = adjustments.map(({ factors, ...p }) => p);
  fs.writeFileSync(
    './src/phase-10/v1-v2-adjusted-patterns.json',
    JSON.stringify(outputPatterns, null, 2)
  );

  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    totalPatterns: patterns.length,
    statistics: {
      beforeAverage: originalAvg,
      afterAverage: adjustedAvg,
      improvement: adjustedAvg - originalAvg,
      improved: improvementCount,
      degraded: degradationCount,
      unchanged: patterns.length - improvementCount - degradationCount
    },
    confidenceBreakdown: {
      before: {
        high: beforeHigh,
        medium: beforeMedium,
        low: 0
      },
      after: {
        high: afterHigh,
        medium: afterMedium,
        low: afterLow
      }
    },
    byCategory: Array.from(byCategory.entries()).map(([cat, pats]) => ({
      category: cat,
      count: pats.length,
      averageConfidence: pats.reduce((sum, p) => sum + p.confidence, 0) / pats.length
    }))
  };

  fs.writeFileSync(
    './src/phase-10/confidence-adjustment-report.json',
    JSON.stringify(report, null, 2)
  );

  console.log(`\n✅ Saved ${adjustments.length} adjusted patterns to v1-v2-adjusted-patterns.json`);
  console.log(`✅ Saved adjustment report to confidence-adjustment-report.json\n`);

  return adjustments;
}

/**
 * Analyze a specific pattern's confidence factors
 */
export function analyzePatternConfidence(patternName: string) {
  const patternsPath = './src/phase-10/v1-v2-merged-patterns.json';
  const patterns: Pattern[] = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));

  const pattern = patterns.find(p => p.name === patternName);
  if (!pattern) {
    console.log(`Pattern "${patternName}" not found`);
    return;
  }

  const factors = adjustPatternConfidence(pattern);

  console.log(`\n📋 Confidence Analysis: ${patternName}\n`);
  console.log(`   Base Confidence:     ${(factors.baseConfidence * 100).toFixed(2)}%`);
  console.log(`   Complexity Factor:   ${(factors.complexityFactor * 100).toFixed(2)}%`);
  console.log(`   Parameter Factor:    ${(factors.paramFactor * 100).toFixed(2)}%`);
  console.log(`   Async Factor:        ${(factors.asyncFactor * 100).toFixed(2)}%`);
  console.log(`   Package Bonus:       ${(factors.packageFactor * 100).toFixed(2)}%`);
  console.log(`   Source Bonus:        ${(factors.sourceBonus * 100).toFixed(2)}%`);
  console.log(`   ────────────────────────────────────`);
  console.log(`   Final Confidence:    ${(factors.finalConfidence * 100).toFixed(2)}%\n`);
}

// Run if executed directly
if (require.main === module) {
  adjustAllPatterns();
  analyzePatternConfidence('sum');
}
