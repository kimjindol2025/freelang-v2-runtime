/**
 * Phase 10: v1 & v2 Pattern Merger
 *
 * Merge v1 converted patterns (596) with v2.1.0 patterns (100)
 * - Deduplicate patterns with similar names/aliases
 * - Combine confidence scores
 * - Consolidate examples and metadata
 * - Generate unified pattern database
 */

import * as fs from 'fs';
import * as path from 'path';

interface UnifiedPattern {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  source: ('v2.1.0' | 'v1')[];
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
 * Load v2.1.0 patterns from TypeScript file
 */
function loadV210Patterns(): Map<string, UnifiedPattern> {
  const patterns = new Map<string, UnifiedPattern>();

  // Read the TypeScript file
  const filePath = './src/phase-6/autocomplete-patterns-100.ts';
  const code = fs.readFileSync(filePath, 'utf-8');

  // Extract the patterns object using regex
  const match = code.match(/export const AUTOCOMPLETE_PATTERNS = \{([\s\S]*)\};/);
  if (!match) {
    console.error('Failed to extract patterns from file');
    return patterns;
  }

  const patternsCode = match[1];

  // Parse each pattern entry
  const entries = patternsCode.split('\n  ').filter(e => e.trim().length > 0);

  for (const entry of entries) {
    // Extract pattern name and properties
    const nameMatch = entry.match(/(\w+):\s*\{/);
    if (!nameMatch) continue;

    const name = nameMatch[1];

    // Extract properties using regex patterns
    const opMatch = entry.match(/op:\s*'([^']+)'/);
    const inputMatch = entry.match(/input:\s*'([^']+)'/);
    const outputMatch = entry.match(/output:\s*'([^']+)'/);
    const reasonMatch = entry.match(/reason:\s*'([^']+)'/);
    const complexityMatch = entry.match(/complexity:\s*'([^']+)'/);
    const categoryMatch = entry.match(/category:\s*'([^']+)'/);

    // Extract arrays
    const aliasesMatch = entry.match(/aliases:\s*\[(.*?)\]/);
    const tagsMatch = entry.match(/tags:\s*\[(.*?)\]/);
    const relatedMatch = entry.match(/relatedPatterns:\s*\[(.*?)\]/);

    const aliases = aliasesMatch
      ? aliasesMatch[1].split(',').map(a => a.trim().replace(/'/g, '').replace(/"/g, ''))
      : [];
    const tags = tagsMatch
      ? tagsMatch[1].split(',').map(t => t.trim().replace(/'/g, '').replace(/"/g, ''))
      : [];
    const relatedPatterns = relatedMatch
      ? relatedMatch[1].split(',').map(r => r.trim().replace(/'/g, '').replace(/"/g, ''))
      : [];

    const pattern: UnifiedPattern = {
      id: `v2-${name}`,
      name: opMatch ? opMatch[1] : name,
      aliases: [name, ...aliases],
      category: categoryMatch ? categoryMatch[1] : 'other',
      source: ['v2.1.0'],
      packages: [],
      description: reasonMatch ? reasonMatch[1] : name,
      confidence: 0.90, // v2.1.0 patterns are mature
      inputTypes: inputMatch ? inputMatch[1] : 'any',
      outputType: outputMatch ? outputMatch[1] : 'any',
      examples: [
        {
          input: `Use ${name}`,
          output: outputMatch ? outputMatch[1] : 'result',
          description: `Example of ${name}`
        }
      ],
      tags,
      complexity: estimateComplexity(complexityMatch ? complexityMatch[1] : ''),
      relatedPatterns,
      metadata: {
        source: 'v2.1.0',
        directive: entry.includes('directive') ? 'speed' : 'default'
      }
    };

    patterns.set(name, pattern);
  }

  return patterns;
}

/**
 * Load v1 converted patterns
 */
function loadV1Patterns(): Map<string, UnifiedPattern> {
  const patterns = new Map<string, UnifiedPattern>();
  const v1data = JSON.parse(fs.readFileSync('./src/phase-10/v1-intent-patterns-generated.json', 'utf-8'));

  for (const api of v1data) {
    const pattern: UnifiedPattern = {
      id: api.id,
      name: api.name,
      aliases: api.aliases || [api.name],
      category: api.category,
      source: ['v1'],
      packages: api.package ? [api.package] : [],
      description: api.description,
      confidence: api.confidence,
      inputTypes: api.inputTypes,
      outputType: api.outputType,
      examples: api.examples || [],
      tags: api.tags || [],
      complexity: api.complexity,
      relatedPatterns: api.relatedPatterns || [],
      metadata: api.metadata || {}
    };

    patterns.set(api.name, pattern);
  }

  return patterns;
}

/**
 * Estimate complexity from string
 */
function estimateComplexity(complexityStr: string): number {
  if (!complexityStr) return 2;

  if (complexityStr.includes('O(1)')) return 1;
  if (complexityStr.includes('O(log n)')) return 2;
  if (complexityStr.includes('O(n)')) return 3;
  if (complexityStr.includes('O(n log n)')) return 4;
  if (complexityStr.includes('O(n^2)')) return 5;

  return 2;
}

/**
 * Check if two pattern names are similar (potential duplicates)
 */
function areSimilar(name1: string, name2: string, aliases1: string[], aliases2: string[]): boolean {
  // Exact match
  if (name1 === name2) return true;
  if (aliases1.includes(name2) || aliases2.includes(name1)) return true;

  // Check if any alias matches
  for (const a1 of aliases1) {
    for (const a2 of aliases2) {
      if (a1 === a2 && a1.length > 2) return true;
    }
  }

  // Levenshtein distance for close matches
  const distance = levenshteinDistance(name1.toLowerCase(), name2.toLowerCase());
  return distance <= 2 && Math.min(name1.length, name2.length) > 3;
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Merge two patterns
 */
function mergePatterns(p1: UnifiedPattern, p2: UnifiedPattern): UnifiedPattern {
  // Use v2.1.0 as primary if available
  const primary = p1.source.includes('v2.1.0') ? p1 : p2;
  const secondary = p1.source.includes('v2.1.0') ? p2 : p1;

  // Combine metadata
  const merged: UnifiedPattern = {
    id: primary.id,
    name: primary.name,
    aliases: [...new Set([...primary.aliases, ...secondary.aliases])],
    category: primary.category || secondary.category,
    source: [...new Set([...primary.source, ...secondary.source])],
    packages: [...new Set([...primary.packages, ...secondary.packages])],
    description: primary.description || secondary.description,
    confidence: Math.max(primary.confidence, secondary.confidence),
    inputTypes: primary.inputTypes || secondary.inputTypes,
    outputType: primary.outputType || secondary.outputType,
    examples: [...primary.examples, ...secondary.examples].slice(0, 5),
    tags: [...new Set([...primary.tags, ...secondary.tags])],
    complexity: Math.max(primary.complexity, secondary.complexity),
    relatedPatterns: [...new Set([...primary.relatedPatterns, ...secondary.relatedPatterns])],
    metadata: {
      ...primary.metadata,
      ...secondary.metadata,
      merged: true,
      sources: [p1.id, p2.id]
    }
  };

  return merged;
}

/**
 * Main merge workflow
 */
async function mergePatternsWorkflow() {
  console.log('🔀 Phase 10: Merging v2.1.0 and v1 Patterns...\n');

  // Load patterns
  console.log('📥 Loading v2.1.0 patterns...');
  const v210Patterns = loadV210Patterns();
  console.log(`   ✅ Loaded ${v210Patterns.size} v2.1.0 patterns`);

  console.log('\n📥 Loading v1 converted patterns...');
  const v1Patterns = loadV1Patterns();
  console.log(`   ✅ Loaded ${v1Patterns.size} v1 patterns\n`);

  // Merge patterns
  const mergedPatterns = new Map<string, UnifiedPattern>();
  const used = new Set<string>();
  let mergeCount = 0;

  // First, add all v2.1.0 patterns
  for (const [name, pattern] of v210Patterns) {
    mergedPatterns.set(name, pattern);
  }

  // Then, try to merge v1 patterns
  for (const [name, v1Pattern] of v1Patterns) {
    let matched = false;

    // Check for similar patterns
    for (const [v2Name, v2Pattern] of v210Patterns) {
      if (areSimilar(name, v2Name, v1Pattern.aliases, v2Pattern.aliases)) {
        // Merge with existing pattern
        const merged = mergePatterns(v2Pattern, v1Pattern);
        mergedPatterns.set(v2Name, merged);
        matched = true;
        mergeCount++;
        used.add(name);
        break;
      }
    }

    // If no match, add as new pattern
    if (!matched) {
      mergedPatterns.set(name, v1Pattern);
    }
  }

  console.log('📊 Merge Statistics:\n');
  console.log(`   v2.1.0 Patterns:      ${v210Patterns.size}`);
  console.log(`   v1 Patterns:          ${v1Patterns.size}`);
  console.log(`   Merged/Deduplicated:  ${mergeCount}`);
  console.log(`   Total Unique:         ${mergedPatterns.size}\n`);

  // Calculate confidence statistics
  let totalConfidence = 0;
  let highConfidence = 0; // >= 0.85
  let mediumConfidence = 0; // 0.75-0.85
  let lowConfidence = 0; // < 0.75

  for (const pattern of mergedPatterns.values()) {
    totalConfidence += pattern.confidence;

    if (pattern.confidence >= 0.85) highConfidence++;
    else if (pattern.confidence >= 0.75) mediumConfidence++;
    else lowConfidence++;
  }

  const avgConfidence = (totalConfidence / mergedPatterns.size * 100).toFixed(1);

  console.log('📈 Confidence Distribution:\n');
  console.log(`   High (≥0.85):  ${highConfidence} patterns (${(highConfidence / mergedPatterns.size * 100).toFixed(1)}%)`);
  console.log(`   Medium (0.75-0.85): ${mediumConfidence} patterns (${(mediumConfidence / mergedPatterns.size * 100).toFixed(1)}%)`);
  console.log(`   Low (<0.75):   ${lowConfidence} patterns (${(lowConfidence / mergedPatterns.size * 100).toFixed(1)}%)`);
  console.log(`   Average:       ${avgConfidence}%\n`);

  // Save merged patterns
  const patternsArray = Array.from(mergedPatterns.values());
  const outputPath = './src/phase-10/v1-v2-merged-patterns.json';
  fs.writeFileSync(outputPath, JSON.stringify(patternsArray, null, 2));

  console.log(`✅ Saved ${patternsArray.length} merged patterns to ${outputPath}\n`);

  // Save summary report
  const report = {
    timestamp: new Date().toISOString(),
    v210Count: v210Patterns.size,
    v1Count: v1Patterns.size,
    mergedCount: mergeCount,
    totalUnique: patternsArray.length,
    confidenceStats: {
      average: parseFloat(avgConfidence),
      high: highConfidence,
      medium: mediumConfidence,
      low: lowConfidence
    },
    deduplication: {
      eliminated: v1Patterns.size + v210Patterns.size - patternsArray.length,
      percentage: ((v1Patterns.size + v210Patterns.size - patternsArray.length) / (v1Patterns.size + v210Patterns.size) * 100).toFixed(1)
    }
  };

  fs.writeFileSync('./src/phase-10/v1-v2-merge-report.json', JSON.stringify(report, null, 2));

  return patternsArray;
}

// Run
mergePatternsWorkflow().catch(console.error);
