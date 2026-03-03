/**
 * Phase 10: v1 API Extractor (Improved)
 *
 * Extract ALL API types from v1:
 * - Functions (export function)
 * - Constants (export const)
 * - Classes and their methods (export class)
 * - Interfaces (export interface)
 * - Type aliases (export type)
 */

import * as fs from 'fs';
import * as path from 'path';

interface V1API {
  name: string;
  package: string;
  category: string;
  type: 'function' | 'constant' | 'method' | 'interface' | 'class' | 'type';
  description: string;
  params: Array<{ name: string; type: string }>;
  returns: string;
  isAsync: boolean;
  signature: string;
  confidence?: number;
}

/**
 * Extract all exported items from code
 */
function extractAllExports(code: string, packageName: string, category: string): V1API[] {
  const apis: V1API[] = [];

  // 1. Export functions
  const funcPattern = /export\s+(async\s+)?function\s+(\w+)\s*\((.*?)\)\s*:\s*([\w<>|, ]+)\s*\{/g;
  let match;
  while ((match = funcPattern.exec(code)) !== null) {
    const [, isAsync, name, paramsStr, returnType] = match;
    const params = parseParams(paramsStr);

    apis.push({
      name,
      package: packageName,
      category,
      type: 'function',
      description: `Function: ${name}`,
      params,
      returns: returnType.trim(),
      isAsync: !!isAsync,
      signature: `${name}(${paramsStr}): ${returnType}`
    });
  }

  // 2. Export constants
  const constPattern = /export\s+const\s+(\w+)\s*[:=]\s*([^;}\n]+)/g;
  while ((match = constPattern.exec(code)) !== null) {
    const [, name, value] = match;
    if (name === 'default') continue;

    apis.push({
      name,
      package: packageName,
      category,
      type: 'constant',
      description: `Constant: ${name}`,
      params: [],
      returns: inferType(value.trim()),
      isAsync: false,
      signature: `const ${name} = ${value.substring(0, 40)}...`
    });
  }

  // 3. Export classes and collect methods
  const classPattern = /export\s+class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g;
  while ((match = classPattern.exec(code)) !== null) {
    const [, className] = match;

    apis.push({
      name: className,
      package: packageName,
      category,
      type: 'class',
      description: `Class: ${className}`,
      params: [],
      returns: className,
      isAsync: false,
      signature: `class ${className}`
    });

    // Extract methods from class
    const classBody = extractClassBody(code, match.index);
    const methods = extractMethodsFromClass(classBody, className, packageName, category);
    apis.push(...methods);
  }

  // 4. Export interfaces
  const interfacePattern = /export\s+interface\s+(\w+)(?:\s+extends\s+[\w, ]+)?\s*\{/g;
  while ((match = interfacePattern.exec(code)) !== null) {
    const [, interfaceName] = match;

    apis.push({
      name: interfaceName,
      package: packageName,
      category,
      type: 'interface',
      description: `Interface: ${interfaceName}`,
      params: [],
      returns: interfaceName,
      isAsync: false,
      signature: `interface ${interfaceName}`
    });
  }

  // 5. Export type aliases
  const typePattern = /export\s+type\s+(\w+)\s*=\s*([^;}\n]+);/g;
  while ((match = typePattern.exec(code)) !== null) {
    const [, typeName, typeValue] = match;

    apis.push({
      name: typeName,
      package: packageName,
      category,
      type: 'type',
      description: `Type: ${typeName}`,
      params: [],
      returns: typeValue.trim().substring(0, 50),
      isAsync: false,
      signature: `type ${typeName} = ${typeValue.substring(0, 40)}...`
    });
  }

  return apis;
}

/**
 * Extract class body
 */
function extractClassBody(code: string, startIndex: number): string {
  let braceCount = 0;
  let inBody = false;
  let body = '';

  for (let i = startIndex; i < code.length; i++) {
    const char = code[i];

    if (char === '{') {
      inBody = true;
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (inBody && braceCount === 0) {
        break;
      }
    }

    if (inBody && braceCount > 0) {
      body += char;
    }
  }

  return body;
}

/**
 * Extract methods from class body
 */
function extractMethodsFromClass(classBody: string, className: string, packageName: string, category: string): V1API[] {
  const methods: V1API[] = [];

  // Pattern: method_name(params): return_type { ... }
  const methodPattern = /(async\s+)?(\w+)\s*\((.*?)\)\s*:\s*([\w<>|, ]+)\s*\{/g;
  let match;

  while ((match = methodPattern.exec(classBody)) !== null) {
    const [, isAsync, name, paramsStr, returnType] = match;

    // Skip constructor
    if (name === 'constructor') continue;

    const params = parseParams(paramsStr);

    methods.push({
      name: `${className}.${name}`,
      package: packageName,
      category,
      type: 'method',
      description: `Method: ${className}.${name}`,
      params,
      returns: returnType.trim(),
      isAsync: !!isAsync,
      signature: `${name}(${paramsStr}): ${returnType}`
    });
  }

  return methods;
}

/**
 * Parse parameter string
 */
function parseParams(paramsStr: string): Array<{ name: string; type: string }> {
  if (!paramsStr.trim()) return [];

  return paramsStr
    .split(',')
    .map(p => {
      const trimmed = p.trim();
      const [name, type] = trimmed.split(':').map(x => x.trim());
      return { name: name || 'arg', type: type || 'any' };
    })
    .filter(p => p.name.length > 0);
}

/**
 * Infer type from value
 */
function inferType(value: string): string {
  if (value === 'true' || value === 'false') return 'boolean';
  if (/^\d+(\.\d+)?$/.test(value)) return 'number';
  if (value.startsWith('"') || value.startsWith("'")) return 'string';
  if (value.startsWith('[')) return 'array';
  if (value.startsWith('{')) return 'object';
  if (value.startsWith('Math.')) return 'number';
  return 'any';
}

/**
 * Load and extract all v1 packages
 */
async function extractAllV1() {
  const v1BasePath = '/tmp/freelang-v1/self-hosting/packages';
  let allAPIs: V1API[] = [];
  const packageStats: any[] = [];

  if (!fs.existsSync(v1BasePath)) {
    console.error(`Path not found: ${v1BasePath}`);
    return;
  }

  const categories = fs.readdirSync(v1BasePath);

  for (const category of categories) {
    const categoryPath = path.join(v1BasePath, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const packages = fs.readdirSync(categoryPath);

    for (const packageName of packages) {
      const pkgPath = path.join(categoryPath, packageName, 'src', 'index.ts');

      if (!fs.existsSync(pkgPath)) continue;

      try {
        const code = fs.readFileSync(pkgPath, 'utf-8');
        const apis = extractAllExports(code, packageName, category);

        if (apis.length > 0) {
          allAPIs = allAPIs.concat(apis);

          packageStats.push({
            category,
            package: packageName,
            count: apis.length,
            types: {
              functions: apis.filter(a => a.type === 'function').length,
              constants: apis.filter(a => a.type === 'constant').length,
              methods: apis.filter(a => a.type === 'method').length,
              interfaces: apis.filter(a => a.type === 'interface').length,
              classes: apis.filter(a => a.type === 'class').length,
              types: apis.filter(a => a.type === 'type').length
            }
          });
        }
      } catch (err) {
        console.error(`Error: ${category}/${packageName}`);
      }
    }
  }

  // Show results
  console.log('🔍 Phase 10: v1 API Extraction Complete\n');

  console.log('📊 Package Summary:');
  console.log('─'.repeat(70));

  let totalByType: any = {
    functions: 0,
    constants: 0,
    methods: 0,
    interfaces: 0,
    classes: 0,
    types: 0
  };

  for (const stat of packageStats) {
    console.log(`${stat.category}/${stat.package.padEnd(15)} | APIs: ${stat.count.toString().padStart(3)}`);
    for (const [type, count] of Object.entries(stat.types)) {
      totalByType[type] += count;
    }
  }

  console.log('─'.repeat(70));
  console.log(
    `\n📈 Total: ${allAPIs.length} APIs extracted\n` +
    `  - Functions:  ${totalByType.functions}\n` +
    `  - Constants:  ${totalByType.constants}\n` +
    `  - Methods:    ${totalByType.methods}\n` +
    `  - Interfaces: ${totalByType.interfaces}\n` +
    `  - Classes:    ${totalByType.classes}\n` +
    `  - Types:      ${totalByType.types}\n`
  );

  // Save to file
  const outputPath = '/home/kimjin/Desktop/kim/v2-freelang-ai/src/phase-10/v1-apis-complete.json';
  fs.writeFileSync(outputPath, JSON.stringify(allAPIs, null, 2));
  console.log(`✅ Saved to ${outputPath}\n`);

  return allAPIs;
}

// Run
extractAllV1().catch(console.error);
