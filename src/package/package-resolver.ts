import * as path from 'path';
import * as fs from 'fs';
import { ManifestLoader, PackageManifest } from './manifest';
import { SemverUtil, VersionRange } from './semver';

/**
 * Resolved package information
 */
export interface ResolvedPackage {
  name: string;
  version: string;
  path: string;                    // Absolute path to package directory
  manifest: PackageManifest;
  main: string;                    // Absolute path to entry point file
}

/**
 * Package resolver - resolves package names to file paths
 *
 * Supports both:
 * - Package-based imports: "math-lib", "utils"
 * - File-based imports: "./math.fl", "../utils/index.fl"
 */
export class PackageResolver {
  private projectRoot: string;
  private flModulesDir: string;
  private manifestLoader: ManifestLoader;
  private resolvedCache: Map<string, ResolvedPackage> = new Map();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.flModulesDir = path.join(projectRoot, 'fl_modules');
    this.manifestLoader = new ManifestLoader();
  }

  /**
   * Resolve package name to file path
   *
   * @param packageName - Package name (e.g., "math-lib")
   * @param versionRange - Version range (e.g., "^1.2.0"), optional
   * @returns Resolved package information
   * @throws Error if package not found or version doesn't match
   */
  public resolve(packageName: string, versionRange?: string): ResolvedPackage {
    // Check cache
    const cacheKey = `${packageName}@${versionRange || 'latest'}`;
    if (this.resolvedCache.has(cacheKey)) {
      return this.resolvedCache.get(cacheKey)!;
    }

    // Look in fl_modules
    const packageDir = path.join(this.flModulesDir, packageName);

    if (!fs.existsSync(packageDir)) {
      throw new Error(
        `Package '${packageName}' not found in fl_modules/\n` +
        `Expected location: ${packageDir}\n` +
        `Run: freelang install ${packageName}`
      );
    }

    // Load manifest
    let manifest: PackageManifest;
    try {
      manifest = this.manifestLoader.load(packageDir);
    } catch (error) {
      throw new Error(
        `Failed to load manifest for package '${packageName}': ${error}`
      );
    }

    // Verify version if range specified
    if (versionRange) {
      try {
        const range = SemverUtil.parseRange(versionRange);
        const version = SemverUtil.parse(manifest.version);

        if (!SemverUtil.satisfies(version, range)) {
          throw new Error(
            `Package '${packageName}' version ${manifest.version} ` +
            `does not satisfy ${versionRange}\n` +
            `Expected: ${versionRange}`
          );
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('does not satisfy')) {
          throw error;
        }
        throw new Error(
          `Invalid version specification for '${packageName}': ${error}`
        );
      }
    }

    // Resolve main entry point
    const mainFile = ManifestLoader.getMainFile(manifest);
    const mainPath = path.resolve(packageDir, mainFile);

    if (!fs.existsSync(mainPath)) {
      throw new Error(
        `Package '${packageName}' entry point not found: ${mainFile}\n` +
        `Expected location: ${mainPath}`
      );
    }

    const resolved: ResolvedPackage = {
      name: packageName,
      version: manifest.version,
      path: packageDir,
      manifest,
      main: mainPath,
    };

    // Cache
    this.resolvedCache.set(cacheKey, resolved);

    return resolved;
  }

  /**
   * Resolve import path to actual file path
   *
   * Handles both package names and file paths:
   * - "math-lib" → fl_modules/math-lib/src/index.fl
   * - "./local.fl" → relative file path
   * - "../utils/index.fl" → relative file path
   *
   * @param fromFile - Absolute path of importing file
   * @param importPath - Import path (package name or file path)
   * @param projectManifest - Project's package manifest (for version specs)
   * @returns Absolute path to the imported module
   * @throws Error if import cannot be resolved
   */
  public resolveImport(
    fromFile: string,
    importPath: string,
    projectManifest?: PackageManifest
  ): string {
    // File path (relative or absolute)
    if (importPath.startsWith('./') ||
        importPath.startsWith('../') ||
        importPath.startsWith('/')) {
      const dir = path.dirname(fromFile);
      const resolved = path.resolve(dir, importPath);

      // Add .fl extension if not present
      if (!resolved.endsWith('.fl')) {
        if (fs.existsSync(resolved + '.fl')) {
          return resolved + '.fl';
        }
        // Try as directory with index.fl
        if (fs.existsSync(path.join(resolved, 'index.fl'))) {
          return path.join(resolved, 'index.fl');
        }
      }

      return resolved;
    }

    // Package name
    const versionRange = projectManifest?.dependencies?.[importPath];
    try {
      const resolved = this.resolve(importPath, versionRange);
      return resolved.main;
    } catch (error) {
      throw new Error(
        `Cannot resolve import '${importPath}' from ${fromFile}:\n${error}`
      );
    }
  }

  /**
   * Get all installed packages in fl_modules
   *
   * @returns Array of package names
   */
  public getInstalledPackages(): string[] {
    if (!fs.existsSync(this.flModulesDir)) {
      return [];
    }

    try {
      const entries = fs.readdirSync(this.flModulesDir);
      return entries.filter(name => {
        const packagePath = path.join(this.flModulesDir, name);
        return fs.statSync(packagePath).isDirectory();
      });
    } catch (error) {
      return [];
    }
  }

  /**
   * Get installed package info
   *
   * @param packageName - Package name
   * @returns Installed package info or null if not installed
   */
  public getInstalledPackageInfo(packageName: string): ResolvedPackage | null {
    try {
      return this.resolve(packageName);
    } catch {
      return null;
    }
  }

  /**
   * Clear resolution cache
   */
  public clearCache(): void {
    this.resolvedCache.clear();
  }

  /**
   * Get cache statistics (for testing/debugging)
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.resolvedCache.size,
      keys: Array.from(this.resolvedCache.keys()),
    };
  }

  /**
   * Check if package is installed with specific version range
   *
   * @param packageName - Package name
   * @param versionRange - Version range
   * @returns true if package satisfies version range
   */
  public hasPackage(packageName: string, versionRange?: string): boolean {
    try {
      this.resolve(packageName, versionRange);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get package dependencies
   *
   * @param packageName - Package name
   * @returns Record of dependencies or empty object if package not found
   */
  public getPackageDependencies(packageName: string): Record<string, string> {
    try {
      const resolved = this.resolve(packageName);
      return ManifestLoader.getDependencies(resolved.manifest, false);
    } catch {
      return {};
    }
  }

  /**
   * Resolve dependency chain (for diagnostics)
   *
   * @param packageName - Starting package
   * @param depth - Maximum depth to traverse
   * @returns Array of resolved packages in dependency chain
   */
  public resolveDependencyChain(
    packageName: string,
    depth: number = 10
  ): ResolvedPackage[] {
    const chain: ResolvedPackage[] = [];
    const visited = new Set<string>();

    const traverse = (name: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(name)) {
        return;
      }

      visited.add(name);

      try {
        const resolved = this.resolve(name);
        chain.push(resolved);

        const deps = ManifestLoader.getDependencies(resolved.manifest);
        for (const depName of Object.keys(deps)) {
          traverse(depName, currentDepth + 1);
        }
      } catch {
        // Skip packages that can't be resolved
      }
    };

    traverse(packageName, 0);
    return chain;
  }

  /**
   * Find package by name (case-insensitive, fuzzy match)
   *
   * @param query - Query string
   * @returns Array of matching package names
   */
  public findPackage(query: string): string[] {
    const installed = this.getInstalledPackages();
    const lowerQuery = query.toLowerCase();

    return installed.filter(name =>
      name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get project root directory
   */
  public getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Get fl_modules directory path
   */
  public getModulesDir(): string {
    return this.flModulesDir;
  }

  /**
   * Check if fl_modules directory exists
   */
  public hasModulesDir(): boolean {
    return fs.existsSync(this.flModulesDir);
  }
}
