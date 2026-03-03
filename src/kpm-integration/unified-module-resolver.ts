/**
 * Unified Module Resolver
 *
 * Extends ModuleResolver to search both fl_modules/ and kim_modules/
 * Provides seamless package resolution from KPM packages
 */

import * as path from 'path';
import * as fs from 'fs';
import { existsSync, readdirSync, readFileSync } from 'fs';

import type { KPMRegistryClient } from './kpm-registry-client';
import type { KPMPackageInstaller } from './kpm-package-installer';

export interface ResolveOptions {
  autoInstall?: boolean;
  searchPaths?: string[];
  preferKPM?: boolean;
}

export interface ModuleResolutionResult {
  path: string | null;
  source: 'fl_modules' | 'kim_modules' | 'node_modules' | null;
  found: boolean;
}

/**
 * Unified Module Resolver
 *
 * Searches for modules in:
 * 1. fl_modules/ (FreeLang native packages)
 * 2. kim_modules/ (KPM packages)
 * 3. node_modules/ (npm packages - fallback)
 */
export class UnifiedModuleResolver {
  private readonly projectRoot: string;
  private readonly flModulesDir: string;
  private readonly kimModulesDir: string;
  private readonly nodeModulesDir: string;
  private readonly cache: Map<string, ModuleResolutionResult> = new Map();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps: Map<string, number> = new Map();

  constructor(
    projectRoot: string,
    private registryClient?: KPMRegistryClient,
    private installer?: KPMPackageInstaller
  ) {
    this.projectRoot = projectRoot;
    this.flModulesDir = path.join(projectRoot, 'fl_modules');
    this.kimModulesDir = path.join(projectRoot, 'kim_modules');
    this.nodeModulesDir = path.join(projectRoot, 'node_modules');
  }

  /**
   * Resolve module path from import statement
   */
  async resolveModulePath(
    fromFile: string,
    importPath: string,
    options: ResolveOptions = {}
  ): Promise<ModuleResolutionResult> {
    // Check cache first
    const cacheKey = `${importPath}:${fromFile}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // 1. Try fl_modules/ (FreeLang native)
      const flResult = this.resolveFromFlModules(importPath);
      if (flResult.found && !options.preferKPM) {
        return this.cacheResult(cacheKey, flResult);
      }

      // 2. Try kim_modules/ (KPM packages)
      const kimResult = this.resolveFromKimModules(importPath);
      if (kimResult.found) {
        return this.cacheResult(cacheKey, kimResult);
      }

      // 3. Try node_modules/ (npm packages - fallback)
      const nodeResult = this.resolveFromNodeModules(importPath);
      if (nodeResult.found) {
        return this.cacheResult(cacheKey, nodeResult);
      }

      // 4. Try auto-install from KPM if enabled
      if (options.autoInstall && this.registryClient && this.installer) {
        if (await this.registryClient.exists(importPath)) {
          console.log(`Auto-installing ${importPath} from KPM...`);
          const success = await this.installer.installFromKPM(importPath, 'latest');

          if (success) {
            const result = this.resolveFromKimModules(importPath);
            if (result.found) {
              return this.cacheResult(cacheKey, result);
            }
          }
        }
      }

      // Module not found
      const notFound: ModuleResolutionResult = {
        path: null,
        source: null,
        found: false,
      };
      return this.cacheResult(cacheKey, notFound);
    } catch (error) {
      console.error(`Module resolution failed for ${importPath}:`, error);
      return {
        path: null,
        source: null,
        found: false,
      };
    }
  }

  /**
   * Resolve module from fl_modules/
   */
  private resolveFromFlModules(importPath: string): ModuleResolutionResult {
    const normalized = this.normalizeImportPath(importPath);

    // Try as directory with index file
    const dirPath = path.join(this.flModulesDir, normalized);
    if (this.isValidModuleDirectory(dirPath)) {
      return {
        path: dirPath,
        source: 'fl_modules',
        found: true,
      };
    }

    // Try as file
    for (const ext of ['.fl', '.ts', '.js']) {
      const filePath = path.join(this.flModulesDir, normalized + ext);
      if (existsSync(filePath)) {
        return {
          path: filePath,
          source: 'fl_modules',
          found: true,
        };
      }
    }

    return {
      path: null,
      source: null,
      found: false,
    };
  }

  /**
   * Resolve module from kim_modules/ (KPM packages)
   */
  private resolveFromKimModules(importPath: string): ModuleResolutionResult {
    const normalized = this.normalizeImportPath(importPath);

    // Try as directory with package.json
    const dirPath = path.join(this.kimModulesDir, normalized);
    if (this.isValidPackageDirectory(dirPath)) {
      return {
        path: dirPath,
        source: 'kim_modules',
        found: true,
      };
    }

    // Try as scoped package
    if (normalized.includes('/')) {
      const [scope, name] = normalized.split('/');
      const scopedPath = path.join(this.kimModulesDir, scope, name);
      if (this.isValidPackageDirectory(scopedPath)) {
        return {
          path: scopedPath,
          source: 'kim_modules',
          found: true,
        };
      }
    }

    return {
      path: null,
      source: null,
      found: false,
    };
  }

  /**
   * Resolve module from node_modules/ (npm packages)
   */
  private resolveFromNodeModules(importPath: string): ModuleResolutionResult {
    const normalized = this.normalizeImportPath(importPath);

    // Try as directory with package.json
    const dirPath = path.join(this.nodeModulesDir, normalized);
    if (this.isValidPackageDirectory(dirPath)) {
      return {
        path: dirPath,
        source: 'node_modules',
        found: true,
      };
    }

    // Try as file
    for (const ext of ['.js', '.ts', '.json']) {
      const filePath = path.join(this.nodeModulesDir, normalized + ext);
      if (existsSync(filePath)) {
        return {
          path: filePath,
          source: 'node_modules',
          found: true,
        };
      }
    }

    return {
      path: null,
      source: null,
      found: false,
    };
  }

  /**
   * Get module entry point (main file)
   */
  getModuleEntryPoint(modulePath: string): string | null {
    try {
      const packageJsonPath = path.join(modulePath, 'package.json');

      if (existsSync(packageJsonPath)) {
        const content = readFileSync(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content);

        // Try different entry point fields
        const main = pkg.main || pkg.exports || 'index.js';
        return path.join(modulePath, main);
      }

      // Try index file
      for (const indexFile of ['index.fl', 'index.ts', 'index.js']) {
        const indexPath = path.join(modulePath, indexFile);
        if (existsSync(indexPath)) {
          return indexPath;
        }
      }
    } catch (error) {
      console.error(`Failed to get entry point for ${modulePath}:`, error);
    }

    return null;
  }

  /**
   * Get all installed packages
   */
  getInstalledPackages(): string[] {
    const packages: Set<string> = new Set();

    // From fl_modules
    if (existsSync(this.flModulesDir)) {
      try {
        const items = readdirSync(this.flModulesDir);
        items.forEach(item => packages.add(item));
      } catch (error) {
        // Silently fail
      }
    }

    // From kim_modules
    if (existsSync(this.kimModulesDir)) {
      try {
        const items = readdirSync(this.kimModulesDir);
        items.forEach(item => packages.add(item));
      } catch (error) {
        // Silently fail
      }
    }

    return Array.from(packages);
  }

  /**
   * Check if package is installed
   */
  isPackageInstalled(name: string): boolean {
    return (
      this.resolveFromFlModules(name).found ||
      this.resolveFromKimModules(name).found
    );
  }

  /**
   * Clear resolution cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Private: Get from cache with TTL check
   */
  private getFromCache(key: string): ModuleResolutionResult | null {
    if (!this.cache.has(key)) {
      return null;
    }

    const timestamp = this.cacheTimestamps.get(key) || 0;
    if (Date.now() - timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }

    return this.cache.get(key) || null;
  }

  /**
   * Private: Store in cache
   */
  private cacheResult(key: string, result: ModuleResolutionResult): ModuleResolutionResult {
    this.cache.set(key, result);
    this.cacheTimestamps.set(key, Date.now());
    return result;
  }

  /**
   * Private: Normalize import path
   */
  private normalizeImportPath(importPath: string): string {
    // Remove leading ./
    let normalized = importPath.startsWith('./') ? importPath.slice(2) : importPath;

    // Remove trailing /index
    if (normalized.endsWith('/index')) {
      normalized = normalized.slice(0, -6);
    }

    return normalized;
  }

  /**
   * Private: Check if directory is valid FreeLang module
   */
  private isValidModuleDirectory(dirPath: string): boolean {
    if (!existsSync(dirPath)) return false;

    try {
      const stats = fs.statSync(dirPath);
      if (!stats.isDirectory()) return false;

      // Check for index file
      for (const indexFile of ['index.fl', 'index.ts', 'index.js']) {
        if (existsSync(path.join(dirPath, indexFile))) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Private: Check if directory is valid package (has package.json)
   */
  private isValidPackageDirectory(dirPath: string): boolean {
    if (!existsSync(dirPath)) return false;

    try {
      const stats = fs.statSync(dirPath);
      return stats.isDirectory() && existsSync(path.join(dirPath, 'package.json'));
    } catch (error) {
      return false;
    }
  }
}
