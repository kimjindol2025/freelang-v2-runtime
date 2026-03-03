/**
 * Phase 17: KPM Package Parser
 * Parses package.json files and extracts dependency metadata
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for parsed package.json
 */
export interface PackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  types?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  author?: string;
  license?: string;
  repository?: {
    type?: string;
    url?: string;
  };
  keywords?: string[];
  bin?: Record<string, string> | string;
  files?: string[];
}

/**
 * Interface for parsed dependencies with types
 */
export interface DependencyMap {
  [packageName: string]: DependencySpec;
}

/**
 * Single dependency specification
 */
export interface DependencySpec {
  name: string;
  version: string;
  type: 'production' | 'dev' | 'peer' | 'optional';
}

/**
 * Parser for package.json files
 */
export class PackageParser {
  /**
   * Parse a package.json file
   * @param filePath - path to package.json
   * @returns parsed package metadata
   */
  parse(filePath: string): PackageJson {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const pkg = JSON.parse(content);

      // Validate required fields
      if (!pkg.name) {
        throw new Error('Missing required field: name');
      }
      if (!pkg.version) {
        throw new Error('Missing required field: version');
      }

      return pkg as PackageJson;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Parse multiple package.json files
   * @param filePaths - array of paths
   * @returns array of parsed packages
   */
  parseMultiple(filePaths: string[]): PackageJson[] {
    return filePaths.map((filePath) => this.parse(filePath));
  }

  /**
   * Extract all dependencies from a package
   * @param pkg - parsed package
   * @returns flattened dependency map
   */
  extractDependencies(pkg: PackageJson): DependencyMap {
    const deps: DependencyMap = {};

    // Production dependencies
    if (pkg.dependencies) {
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        deps[name] = {
          name,
          version,
          type: 'production'
        };
      }
    }

    // Development dependencies
    if (pkg.devDependencies) {
      for (const [name, version] of Object.entries(pkg.devDependencies)) {
        deps[name] = {
          name,
          version,
          type: 'dev'
        };
      }
    }

    // Peer dependencies
    if (pkg.peerDependencies) {
      for (const [name, version] of Object.entries(pkg.peerDependencies)) {
        if (deps[name]) {
          // Already exists, mark as peer if not already
          deps[name].type = 'peer';
        } else {
          deps[name] = {
            name,
            version,
            type: 'peer'
          };
        }
      }
    }

    // Optional dependencies
    if (pkg.optionalDependencies) {
      for (const [name, version] of Object.entries(pkg.optionalDependencies)) {
        deps[name] = {
          name,
          version,
          type: 'optional'
        };
      }
    }

    return deps;
  }

  /**
   * Get production dependencies only
   * @param pkg - parsed package
   * @returns production dependencies
   */
  getProductionDeps(pkg: PackageJson): DependencyMap {
    const deps: DependencyMap = {};

    if (pkg.dependencies) {
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        deps[name] = { name, version, type: 'production' };
      }
    }

    return deps;
  }

  /**
   * Get development dependencies only
   * @param pkg - parsed package
   * @returns development dependencies
   */
  getDevDeps(pkg: PackageJson): DependencyMap {
    const deps: DependencyMap = {};

    if (pkg.devDependencies) {
      for (const [name, version] of Object.entries(pkg.devDependencies)) {
        deps[name] = { name, version, type: 'dev' };
      }
    }

    return deps;
  }

  /**
   * Get dependency count by type
   * @param pkg - parsed package
   * @returns count statistics
   */
  getStats(pkg: PackageJson): {
    production: number;
    dev: number;
    peer: number;
    optional: number;
    total: number;
  } {
    return {
      production: Object.keys(pkg.dependencies || {}).length,
      dev: Object.keys(pkg.devDependencies || {}).length,
      peer: Object.keys(pkg.peerDependencies || {}).length,
      optional: Object.keys(pkg.optionalDependencies || {}).length,
      total:
        Object.keys(pkg.dependencies || {}).length +
        Object.keys(pkg.devDependencies || {}).length +
        Object.keys(pkg.peerDependencies || {}).length +
        Object.keys(pkg.optionalDependencies || {}).length
    };
  }

  /**
   * Validate package name
   * @param name - package name
   * @returns true if valid
   */
  isValidName(name: string): boolean {
    // Package name validation: lowercase, numbers, hyphens, dots, slashes
    const nameRegex = /^(@[a-z0-9-]+\/)?[a-z0-9-]+([.-][a-z0-9-]+)*$/;
    return nameRegex.test(name);
  }

  /**
   * Validate semantic version
   * @param version - version string
   * @returns true if looks like semver
   */
  looksLikeSemver(version: string): boolean {
    // Very basic check for version format
    return /^[\d.~^*><=!x]+/.test(version);
  }

  /**
   * Validate a package.json structure
   * @param pkg - package to validate
   * @returns array of validation errors (empty if valid)
   */
  validate(pkg: any): string[] {
    const errors: string[] = [];

    if (!pkg.name) errors.push('Missing required field: name');
    if (!pkg.version) errors.push('Missing required field: version');

    if (pkg.name && !this.isValidName(pkg.name)) {
      errors.push(`Invalid package name: ${pkg.name}`);
    }

    if (pkg.version && !this.looksLikeSemver(pkg.version)) {
      errors.push(`Invalid version format: ${pkg.version}`);
    }

    // Check for circular references in dependencies
    const allDeps = this.extractDependencies(pkg);
    if (allDeps[pkg.name]) {
      errors.push(`Self-reference in dependencies: ${pkg.name}`);
    }

    return errors;
  }
}

/**
 * Helper function to parse package.json
 * @param filePath - path to package.json
 * @returns parsed package
 */
export function parsePackageJson(filePath: string): PackageJson {
  const parser = new PackageParser();
  return parser.parse(filePath);
}

/**
 * Helper function to extract dependencies
 * @param filePath - path to package.json
 * @returns dependency map
 */
export function extractPackageDependencies(filePath: string): DependencyMap {
  const parser = new PackageParser();
  const pkg = parser.parse(filePath);
  return parser.extractDependencies(pkg);
}
