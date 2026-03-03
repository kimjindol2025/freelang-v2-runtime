/**
 * npm to KPM Migrator
 *
 * Auto-suggest KPM alternatives for npm packages
 * Analyze package.json and suggest migrations
 */

import * as fs from 'fs';
import * as path from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

import type { KPMRegistryClient } from './kpm-registry-client';

export interface Replacement {
  npm: string;
  kpm: string;
  confidence: number;
  reason: string;
  notes?: string;
}

export interface MigrationReport {
  totalPackages: number;
  migratable: number;
  alternatives: Replacement[];
  noAlternatives: string[];
  summary: string;
}

/**
 * npm to KPM Migrator
 */
export class NPMToKPMMigrator {
  // Known npm to KPM mappings
  private readonly knownMappings: Record<string, { kpm: string; confidence: number }> = {
    // Network/HTTP
    express: { kpm: '@kim/express', confidence: 0.95 },
    'axios': { kpm: '@kim/http-client', confidence: 0.9 },
    'fetch-polyfill': { kpm: '@kim/fetch', confidence: 0.85 },

    // Utilities
    lodash: { kpm: '@kim/lodash', confidence: 0.95 },
    'uuid': { kpm: '@kim/uuid', confidence: 0.9 },
    'moment': { kpm: '@kim/date-utils', confidence: 0.8 },

    // Async/Promise
    'bluebird': { kpm: '@freelang/async', confidence: 0.85 },
    'async': { kpm: '@freelang/async', confidence: 0.9 },

    // Testing
    'jest': { kpm: '@kim/test-framework', confidence: 0.8 },
    'mocha': { kpm: '@kim/test-framework', confidence: 0.75 },

    // CLI
    'yargs': { kpm: '@kim/cli-parser', confidence: 0.8 },
    'commander': { kpm: '@kim/cli-commander', confidence: 0.85 },

    // Database
    'mongoose': { kpm: '@kim/mongodb-driver', confidence: 0.8 },
    'mysql': { kpm: '@kim/mysql-driver', confidence: 0.85 },
    'redis': { kpm: '@kim/redis-client', confidence: 0.9 },

    // Build tools
    'webpack': { kpm: '@kim/bundler', confidence: 0.7 },
    'rollup': { kpm: '@kim/bundler', confidence: 0.65 },
  };

  constructor(private registryClient?: KPMRegistryClient) {}

  /**
   * Analyze package.json for KPM alternatives
   */
  async analyze(packageJson: any): Promise<MigrationReport> {
    try {
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.optionalDependencies,
      };

      const totalPackages = Object.keys(allDeps).length;
      const alternatives: Replacement[] = [];
      const noAlternatives: string[] = [];

      for (const [npmPackage] of Object.entries(allDeps)) {
        const replacement = await this.findReplacement(npmPackage);

        if (replacement) {
          alternatives.push(replacement);
        } else {
          noAlternatives.push(npmPackage);
        }
      }

      const migratable = alternatives.length;
      const confidence = migratable > 0 ? alternatives.reduce((sum, r) => sum + r.confidence, 0) / migratable : 0;

      return {
        totalPackages,
        migratable,
        alternatives: alternatives.sort((a, b) => b.confidence - a.confidence),
        noAlternatives,
        summary: `Can migrate ${migratable}/${totalPackages} packages (${(confidence * 100).toFixed(0)}% avg confidence)`,
      };
    } catch (error) {
      console.error('Migration analysis failed:', error);
      return {
        totalPackages: 0,
        migratable: 0,
        alternatives: [],
        noAlternatives: [],
        summary: 'Analysis failed',
      };
    }
  }

  /**
   * Suggest KPM replacements
   */
  async suggestReplacements(): Promise<Replacement[]> {
    const suggestions: Replacement[] = [];

    for (const [npm, { kpm, confidence }] of Object.entries(this.knownMappings)) {
      // Verify KPM package exists
      if (this.registryClient) {
        const exists = await this.registryClient.exists(kpm);
        if (exists) {
          suggestions.push({
            npm,
            kpm,
            confidence,
            reason: 'Direct KPM alternative available',
          });
        }
      } else {
        suggestions.push({
          npm,
          kpm,
          confidence,
          reason: 'Known mapping in migration database',
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Migrate package.json to freelang.json
   */
  async migrate(dryRun: boolean = true): Promise<void> {
    try {
      const packageJsonPath = path.resolve('package.json');
      if (!existsSync(packageJsonPath)) {
        console.error('package.json not found');
        return;
      }

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const report = await this.analyze(packageJson);

      // Create freelang.json
      const freelangJson = {
        name: packageJson.name || 'migrated-project',
        version: packageJson.version || '1.0.0',
        description: packageJson.description,
        author: packageJson.author,
        license: packageJson.license,
        main: packageJson.main,
        scripts: packageJson.scripts || {},
        dependencies: this.mapDependencies(report.alternatives),
        devDependencies: this.mapDevDependencies(report.alternatives),
        keywords: packageJson.keywords,
        migrations: {
          from: 'npm',
          date: new Date().toISOString(),
          unmappedPackages: report.noAlternatives,
        },
      };

      if (dryRun) {
        console.log('Would create freelang.json with the following structure:');
        console.log(JSON.stringify(freelangJson, null, 2));
      } else {
        const freelangPath = path.resolve('freelang.json');
        writeFileSync(freelangPath, JSON.stringify(freelangJson, null, 2));
        console.log('Created freelang.json');

        // Backup package.json
        const backupPath = path.resolve('package.json.backup');
        if (!existsSync(backupPath)) {
          fs.copyFileSync(packageJsonPath, backupPath);
          console.log('Backed up package.json to package.json.backup');
        }
      }
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Check for breaking changes between versions
   */
  async detectBreakingChanges(npmPackage: string, fromVersion: string, toVersion: string): Promise<BreakingChange[]> {
    const changes: BreakingChange[] = [];

    // Would normally parse CHANGELOG.md or check npm registry
    // For now, return empty array
    return changes;
  }

  /**
   * Show migration guide
   */
  async showMigrationGuide(npmPackage: string, fromVersion: string, toVersion: string): Promise<void> {
    console.log(`\n📚 Migration Guide: ${npmPackage} → ${toVersion}`);
    console.log('─'.repeat(50));

    // Would normally fetch from documentation
    console.log('1. Update imports in your code');
    console.log(`   - From: import ... from '${npmPackage}';`);
    console.log(`   - To: import ... from '@kim/${npmPackage}';`);
    console.log('\n2. Check API differences');
    console.log('3. Run tests to ensure compatibility');
    console.log('4. Deploy and monitor for errors');
  }

  /**
   * Private: Find replacement for npm package
   */
  private async findReplacement(npmPackage: string): Promise<Replacement | null> {
    // Try exact match first
    if (this.knownMappings[npmPackage]) {
      const { kpm, confidence } = this.knownMappings[npmPackage];
      return {
        npm: npmPackage,
        kpm,
        confidence,
        reason: 'Direct KPM alternative available',
      };
    }

    // Try fuzzy matching (simple version)
    const lowerNpm = npmPackage.toLowerCase();
    for (const [known, { kpm, confidence }] of Object.entries(this.knownMappings)) {
      if (known.includes(lowerNpm) || lowerNpm.includes(known)) {
        return {
          npm: npmPackage,
          kpm,
          confidence: confidence * 0.8, // Lower confidence for fuzzy match
          reason: 'Potential KPM alternative (fuzzy match)',
        };
      }
    }

    // Try to find in KPM registry by name
    if (this.registryClient) {
      try {
        const results = await this.registryClient.search(npmPackage, { limit: 1 });
        if (results.length > 0) {
          return {
            npm: npmPackage,
            kpm: results[0].name,
            confidence: 0.6,
            reason: 'Found similar package in KPM registry',
          };
        }
      } catch (error) {
        // Silently fail
      }
    }

    return null;
  }

  /**
   * Private: Map dependencies using suggested replacements
   */
  private mapDependencies(alternatives: Replacement[]): Record<string, string> {
    const deps: Record<string, string> = {};

    for (const alt of alternatives) {
      if (alt.confidence >= 0.8) {
        deps[alt.kpm] = 'latest';
      }
    }

    return deps;
  }

  /**
   * Private: Map dev dependencies
   */
  private mapDevDependencies(alternatives: Replacement[]): Record<string, string> {
    const devDeps: Record<string, string> = {};

    for (const alt of alternatives) {
      if (alt.npm.includes('test') || alt.npm.includes('jest') || alt.npm.includes('mocha')) {
        if (alt.confidence >= 0.75) {
          devDeps[alt.kpm] = 'latest';
        }
      }
    }

    return devDeps;
  }
}

export interface BreakingChange {
  version: string;
  title: string;
  description: string;
  migration: string;
}
