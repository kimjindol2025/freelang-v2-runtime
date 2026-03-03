/**
 * Phase 10: v1 API to Intent Pattern Converter
 *
 * Convert extracted v1 APIs into Intent patterns for v2-freelang-ai
 * - Group related APIs into pattern families
 * - Generate aliases and examples
 * - Initialize confidence from API characteristics
 * - Create pattern documentation
 */

import * as fs from 'fs';

interface V1API {
  name: string;
  package: string;
  category: string;
  type: string;
  description: string;
  params: Array<{ name: string; type: string }>;
  returns: string;
  isAsync: boolean;
  signature: string;
}

interface IntentPattern {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  package: string;
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
  metadata: {
    source: string;
    apiType: string;
    paramCount: number;
    isAsync: boolean;
    signature: string;
  };
}

/**
 * Convert v1 API to Intent pattern
 */
function apiToPattern(api: V1API, index: number): IntentPattern {
  const baseConfidence = 0.85; // Base confidence for v1 APIs
  const typeBonus = getTypeBonus(api.type); // Bonus based on API type
  const paramPenalty = -Math.min(0.1, api.params.length * 0.02); // Penalty for many params

  const confidence = Math.max(0.7, Math.min(0.99, baseConfidence + typeBonus + paramPenalty));

  return {
    id: `v1-${index}`,
    name: api.name,
    aliases: generateAliases(api),
    category: api.category,
    package: api.package,
    description: api.description,
    confidence,
    inputTypes: formatInputTypes(api),
    outputType: formatOutputType(api),
    examples: generateExamples(api),
    tags: generateTags(api),
    complexity: estimateComplexity(api),
    relatedPatterns: [], // Will be filled in later
    metadata: {
      source: 'v1-stdlib',
      apiType: api.type,
      paramCount: api.params.length,
      isAsync: api.isAsync,
      signature: api.signature
    }
  };
}

/**
 * Get confidence bonus based on API type
 */
function getTypeBonus(type: string): number {
  const bonuses: Record<string, number> = {
    'function': 0.05,  // Functions are well-tested
    'method': 0.08,    // Methods are part of classes (mature)
    'constant': 0.10,  // Constants are simple & stable
    'class': 0.08,     // Classes are core abstractions
    'interface': 0.05, // Interfaces are type definitions
    'type': 0.02       // Type aliases are simple
  };
  return bonuses[type] || 0.0;
}

/**
 * Generate aliases for a function
 */
function generateAliases(api: V1API): string[] {
  const aliases = [api.name];

  // Add snake_case version
  const snakeCase = api.name.replace(/([A-Z])/g, '_$1').toLowerCase();
  if (snakeCase !== api.name) {
    aliases.push(snakeCase);
  }

  // Add with package prefix
  aliases.push(`${api.package}:${api.name}`);

  // Add intent-like aliases based on name
  if (api.name.startsWith('get')) {
    aliases.push(`fetch${api.name.substring(3)}`);
  } else if (api.name.startsWith('set')) {
    aliases.push(`update${api.name.substring(3)}`);
  } else if (api.name.startsWith('to')) {
    aliases.push(`convert_to_${api.name.substring(2)}`);
  } else if (api.name.startsWith('is')) {
    aliases.push(`check${api.name.substring(2)}`);
  }

  // Add shorthand
  if (api.name.length > 10) {
    const shorthand = api.name.substring(0, 3) + '_' + api.name.substring(api.name.length - 3);
    aliases.push(shorthand);
  }

  return [...new Set(aliases)]; // Remove duplicates
}

/**
 * Format input types for pattern
 */
function formatInputTypes(api: V1API): string {
  if (api.params.length === 0) {
    return 'void';
  }

  return api.params.map(p => {
    const type = p.type.replace(/\s+/g, '');
    return `${p.name}: ${type}`;
  }).join(', ');
}

/**
 * Format output type
 */
function formatOutputType(api: V1API): string {
  return api.returns.replace(/\s+/g, '');
}

/**
 * Generate example usages
 */
function generateExamples(api: V1API): Array<{ input: string; output: string; description: string }> {
  const examples: Array<{ input: string; output: string; description: string }> = [];

  // Example 1: Basic usage
  examples.push({
    input: `Call ${api.name} with default parameters`,
    output: api.returns,
    description: `Basic usage of ${api.name}`
  });

  // Example 2: With parameters (if any)
  if (api.params.length > 0) {
    const paramList = api.params.map(p => `${p.name}=${p.type}`).join(', ');
    examples.push({
      input: `${api.name}(${paramList})`,
      output: api.returns,
      description: `Call with parameters: ${paramList}`
    });
  }

  // Example 3: Common use case based on name/package
  const useCase = generateUseCase(api);
  if (useCase) {
    examples.push({
      input: useCase.input,
      output: useCase.output,
      description: useCase.description
    });
  }

  return examples;
}

/**
 * Generate common use case example
 */
function generateUseCase(api: V1API): any {
  if (api.name.includes('read') || api.name.includes('get')) {
    return {
      input: `read data`,
      output: api.returns,
      description: 'Read or fetch operation'
    };
  } else if (api.name.includes('write') || api.name.includes('set')) {
    return {
      input: `write data`,
      output: 'void | success',
      description: 'Write or set operation'
    };
  } else if (api.name.includes('parse') || api.name.includes('convert')) {
    return {
      input: `convert input`,
      output: api.returns,
      description: 'Parse or convert operation'
    };
  } else if (api.name.includes('format') || api.name.includes('stringify')) {
    return {
      input: `format value`,
      output: 'string',
      description: 'Format operation'
    };
  }

  return null;
}

/**
 * Generate tags for categorization
 */
function generateTags(api: V1API): string[] {
  const tags = [api.category, api.package];

  // Add API type tag
  tags.push(api.type);

  // Add async tag
  if (api.isAsync) {
    tags.push('async');
  } else {
    tags.push('sync');
  }

  // Add semantic tags based on name
  if (api.name.includes('read') || api.name.includes('get') || api.name.includes('fetch')) {
    tags.push('read');
  }
  if (api.name.includes('write') || api.name.includes('set') || api.name.includes('create')) {
    tags.push('write');
  }
  if (api.name.includes('delete') || api.name.includes('remove')) {
    tags.push('delete');
  }
  if (api.name.includes('parse') || api.name.includes('stringify') || api.name.includes('convert')) {
    tags.push('transform');
  }
  if (api.name.includes('find') || api.name.includes('search') || api.name.includes('match')) {
    tags.push('search');
  }

  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Estimate complexity of API
 */
function estimateComplexity(api: V1API): number {
  let complexity = 1; // Base complexity

  // Add for parameters
  complexity += api.params.length * 0.5;

  // Add for async operations
  if (api.isAsync) complexity += 1;

  // Add for complex return types
  const returnStr = api.returns.toLowerCase();
  if (returnStr.includes('promise') || returnStr.includes('async')) complexity += 1;
  if (returnStr.includes('<') && returnStr.includes('>')) complexity += 0.5;
  if (returnStr.includes('[]') || returnStr.includes('array')) complexity += 0.5;

  // Complexity is 1-10 scale
  return Math.min(10, Math.round(complexity * 10) / 10);
}

/**
 * Find related patterns by package/category
 */
function findRelatedPatterns(patterns: IntentPattern[], currentPattern: IntentPattern): void {
  currentPattern.relatedPatterns = patterns
    .filter(p =>
      p.package === currentPattern.package &&
      p.id !== currentPattern.id &&
      (p.category === currentPattern.category || p.tags.some(t => currentPattern.tags.includes(t)))
    )
    .slice(0, 5) // Limit to 5 related patterns
    .map(p => p.id);
}

/**
 * Main conversion workflow
 */
async function convertV1ToIntent() {
  console.log('🔄 Phase 10: Converting v1 APIs to Intent Patterns...\n');

  // Load extracted APIs
  const apisPath = './src/phase-10/v1-apis-complete.json';
  if (!fs.existsSync(apisPath)) {
    console.error(`File not found: ${apisPath}`);
    return;
  }

  const apis: V1API[] = JSON.parse(fs.readFileSync(apisPath, 'utf-8'));
  console.log(`📥 Loaded ${apis.length} v1 APIs\n`);

  // Convert to Intent patterns
  const patterns: IntentPattern[] = apis.map((api, idx) => apiToPattern(api, idx));

  // Find related patterns
  patterns.forEach(pattern => {
    findRelatedPatterns(patterns, pattern);
  });

  // Group by package and show stats
  console.log('📊 Conversion Statistics:\n');

  const byPackage = new Map<string, IntentPattern[]>();
  patterns.forEach(p => {
    if (!byPackage.has(p.package)) {
      byPackage.set(p.package, []);
    }
    byPackage.get(p.package)!.push(p);
  });

  let totalHigh = 0, totalMedium = 0, totalLow = 0;

  for (const [pkgName, pkgPatterns] of byPackage) {
    const high = pkgPatterns.filter(p => p.confidence >= 0.85).length;
    const medium = pkgPatterns.filter(p => p.confidence >= 0.75 && p.confidence < 0.85).length;
    const low = pkgPatterns.filter(p => p.confidence < 0.75).length;

    totalHigh += high;
    totalMedium += medium;
    totalLow += low;

    const avgConfidence = (pkgPatterns.reduce((a, p) => a + p.confidence, 0) / pkgPatterns.length * 100).toFixed(1);

    console.log(
      `${pkgName.padEnd(20)} | Total: ${pkgPatterns.length.toString().padStart(3)} | ` +
      `H: ${high.toString().padStart(2)} M: ${medium.toString().padStart(2)} L: ${low.toString().padStart(2)} | ` +
      `Avg Confidence: ${avgConfidence}%`
    );
  }

  console.log('─'.repeat(90));
  console.log(
    `High (≥0.85): ${totalHigh} | Medium (0.75-0.85): ${totalMedium} | Low (<0.75): ${totalLow}\n`
  );

  // Confidence distribution
  const avgConfidence = (patterns.reduce((a, p) => a + p.confidence, 0) / patterns.length * 100).toFixed(1);
  console.log(`✅ Average Confidence Score: ${avgConfidence}%`);
  console.log(`✅ Total Patterns Generated: ${patterns.length}\n`);

  // Save patterns
  const outputPath = './src/phase-10/v1-intent-patterns-generated.json';
  fs.writeFileSync(outputPath, JSON.stringify(patterns, null, 2));
  console.log(`✅ Saved ${patterns.length} patterns to ${outputPath}\n`);

  // Generate summary report
  const report = {
    timestamp: new Date().toISOString(),
    sourceAPIs: apis.length,
    generatedPatterns: patterns.length,
    packageCount: byPackage.size,
    confidenceBreakdown: {
      high: totalHigh,
      medium: totalMedium,
      low: totalLow,
      average: parseFloat(avgConfidence)
    },
    byPackage: Array.from(byPackage.entries()).map(([name, patterns]) => ({
      package: name,
      count: patterns.length,
      avgConfidence: (patterns.reduce((a, p) => a + p.confidence, 0) / patterns.length * 100).toFixed(1)
    }))
  };

  fs.writeFileSync('./src/phase-10/v1-conversion-report.json', JSON.stringify(report, null, 2));

  return patterns;
}

// Run
convertV1ToIntent().catch(console.error);
