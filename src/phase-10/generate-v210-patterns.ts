/**
 * Generate v2.1.0 patterns from autocomplete-patterns-100.ts
 */

import * as fs from 'fs';

const patterns = [
  {
    id: 'v2-sum',
    name: 'sum',
    aliases: ['total', 'aggregate', 'add_all'],
    category: 'math',
    description: 'Calculate sum of array elements',
    confidence: 0.95,
    inputTypes: 'array<number>',
    outputType: 'number',
    examples: [{ input: '[1,2,3]', output: '6', description: 'Sum of array' }],
    tags: ['math', 'sum', 'aggregate'],
    complexity: 1
  },
  {
    id: 'v2-mean',
    name: 'mean',
    aliases: ['average', 'avg'],
    category: 'math',
    description: 'Calculate mean of array',
    confidence: 0.95,
    inputTypes: 'array<number>',
    outputType: 'number',
    examples: [{ input: '[1,2,3]', output: '2', description: 'Average' }],
    tags: ['math', 'mean', 'average'],
    complexity: 1
  },
  {
    id: 'v2-median',
    name: 'median',
    aliases: ['middle_value'],
    category: 'math',
    description: 'Find median of array',
    confidence: 0.92,
    inputTypes: 'array<number>',
    outputType: 'number',
    examples: [{ input: '[1,2,3]', output: '2', description: 'Median' }],
    tags: ['math', 'median', 'statistics'],
    complexity: 2
  },
  // ... Add more patterns as needed
];

fs.writeFileSync('./src/phase-10/v210-patterns.json', JSON.stringify(patterns.slice(0, 100), null, 2));
console.log('✅ Generated v2.1.0 pattern template');
