/**
 * KPM Package Installer
 *
 * Download and install packages from KPM registry
 * Handles dependency resolution and atomic installation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { createWriteStream, mkdirSync, existsSync, readFileSync } from 'fs';
import { promisify } from 'util';
import { execSync } from 'child_process';

const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const rmdir = promisify(fs.rm);

import type { KPMRegistryClient } from './kpm-registry-client';
import type { KPMCLIWrapper } from './kpm-cli-wrapper';

export interface DependencyTree {
  name: string;
  version: string;
  dependencies: Map<string, DependencyTree>;
  resolved: boolean;
}

export interface InstallResult {
  success: boolean;
  installed: string[];
  failed: string[];
  time: number;
}

/**
 * KPM Package Installer
 */
export class KPMPackageInstaller {
  private readonly installDir = path.resolve('/home/kimjin/kim_modules');
  private readonly cacheDir = path.resolve('/home/kimjin/.kpm/cache');
  private readonly lockFilePath = path.resolve(process.cwd(), 'kpm-lock.json');
  private installedPackages: Set<string> = new Set();
  private readonly MAX_DEPTH = 20; // Prevent infinite recursion

  constructor(
    private registryClient: KPMRegistryClient,
    private cliWrapper?: KPMCLIWrapper
  ) {
    this.ensureDirectories();
  }

  /**
   * Install package from KPM
   */
  async installFromKPM(name: string, version: string = 'latest'): Promise<boolean> {
    try {
      // 1. Resolve version
      const resolvedVersion = await this.resolveVersion(name, version);
      if (!resolvedVersion) {
        console.error(`Failed to resolve version for ${name}`);
        return false;
      }

      // 2. Check if already installed
      const installPath = path.join(this.installDir, name);
      if (this.isInstalled(name, resolvedVersion)) {
        console.log(`${name}@${resolvedVersion} already installed`);
        return true;
      }

      // 3. Resolve dependencies
      const depTree = await this.resolveDependencyTree(name, resolvedVersion);
      if (!depTree) {
        console.error(`Failed to resolve dependencies for ${name}`);
        return false;
      }

      // 4. Install in correct order (dependencies first)
      const installOrder = this.flattenDependencyTree(depTree);
      for (const dep of installOrder) {
        if (!await this.downloadAndInstall(dep.name, dep.version)) {
          // Rollback on failure
          await this.rollback();
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error(`Installation failed for ${name}:`, error);
      return false;
    }
  }

  /**
   * Install all dependencies from freelang.json
   */
  async installDependencies(manifest: any): Promise<InstallResult> {
    const startTime = Date.now();
    const installed: string[] = [];
    const failed: string[] = [];

    try {
      const dependencies = manifest.dependencies || {};

      for (const [name, versionSpec] of Object.entries(dependencies)) {
        try {
          const success = await this.installFromKPM(name, versionSpec as string);
          if (success) {
            installed.push(name);
          } else {
            failed.push(name);
          }
        } catch (error) {
          console.error(`Failed to install ${name}:`, error);
          failed.push(name);
        }
      }

      return {
        success: failed.length === 0,
        installed,
        failed,
        time: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Dependency installation failed:', error);
      return {
        success: false,
        installed,
        failed: Object.keys(manifest.dependencies || {}),
        time: Date.now() - startTime,
      };
    }
  }

  /**
   * Resolve dependency tree
   */
  async resolveDependencyTree(
    name: string,
    version: string,
    depth: number = 0,
    visited: Set<string> = new Set()
  ): Promise<DependencyTree | null> {
    // Prevent infinite recursion
    if (depth > this.MAX_DEPTH) {
      console.warn(`Max dependency depth reached for ${name}`);
      return null;
    }

    // Prevent cycles
    const key = `${name}@${version}`;
    if (visited.has(key)) {
      return {
        name,
        version,
        dependencies: new Map(),
        resolved: true,
      };
    }
    visited.add(key);

    try {
      // Get package info
      const info = await this.registryClient.getPackageInfo(name);
      if (!info) {
        console.error(`Package not found: ${name}`);
        return null;
      }

      const tree: DependencyTree = {
        name,
        version,
        dependencies: new Map(),
        resolved: true,
      };

      // Recursively resolve dependencies
      if (info.dependencies) {
        for (const [depName, depVersionSpec] of Object.entries(info.dependencies)) {
          const resolved = await this.resolveDependencyTree(
            depName,
            depVersionSpec as string,
            depth + 1,
            visited
          );
          if (resolved) {
            tree.dependencies.set(depName, resolved);
          }
        }
      }

      return tree;
    } catch (error) {
      console.error(`Failed to resolve dependencies for ${name}:`, error);
      return null;
    }
  }

  /**
   * Flatten dependency tree to installation order
   */
  flattenDependencyTree(tree: DependencyTree): Array<{ name: string; version: string }> {
    const result: Array<{ name: string; version: string }> = [];
    const visited = new Set<string>();

    const traverse = (node: DependencyTree) => {
      const key = `${node.name}@${node.version}`;
      if (visited.has(key)) return;
      visited.add(key);

      // Install dependencies first
      for (const [, dep] of node.dependencies) {
        traverse(dep);
      }

      // Then install this package
      result.push({ name: node.name, version: node.version });
    };

    traverse(tree);
    return result;
  }

  /**
   * Update package to latest version
   */
  async updatePackage(name: string): Promise<boolean> {
    try {
      const info = await this.registryClient.getPackageInfo(name);
      if (!info) return false;

      return await this.installFromKPM(name, info.latest);
    } catch (error) {
      console.error(`Update failed for ${name}:`, error);
      return false;
    }
  }

  /**
   * Uninstall package
   */
  async uninstallPackage(name: string): Promise<boolean> {
    try {
      const installPath = path.join(this.installDir, name);

      if (existsSync(installPath)) {
        await rmdir(installPath, { recursive: true, force: true });
        this.installedPackages.delete(name);
        return true;
      }

      return true;
    } catch (error) {
      console.error(`Uninstall failed for ${name}:`, error);
      return false;
    }
  }

  /**
   * Get installed package version
   */
  getInstalledVersion(name: string): string | null {
    try {
      const packageJsonPath = path.join(this.installDir, name, 'package.json');
      if (existsSync(packageJsonPath)) {
        const content = readFileSync(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content);
        return pkg.version || null;
      }
    } catch (error) {
      // Silently fail
    }
    return null;
  }

  /**
   * Check if package is installed
   */
  isInstalled(name: string, version?: string): boolean {
    try {
      const installed = this.getInstalledVersion(name);
      if (!installed) return false;

      if (version && version !== 'latest') {
        return installed === version;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Private: Resolve version string to specific version
   */
  private async resolveVersion(name: string, versionSpec: string): Promise<string | null> {
    try {
      if (versionSpec === 'latest' || versionSpec === '*') {
        const info = await this.registryClient.getPackageInfo(name);
        return info?.latest || null;
      }

      // Check if version exists
      const versions = await this.registryClient.getVersions(name);
      if (versions.includes(versionSpec)) {
        return versionSpec;
      }

      // Try to match version range (basic semver)
      // For now, just return the latest
      const info = await this.registryClient.getPackageInfo(name);
      return info?.latest || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Private: Download and install package
   */
  private async downloadAndInstall(name: string, version: string): Promise<boolean> {
    try {
      const installPath = path.join(this.installDir, name);

      // Create package directory
      await mkdir(installPath, { recursive: true });

      // For now, create a minimal package.json
      // In production, would download actual tarball
      const packageJson = {
        name,
        version,
        installed_at: new Date().toISOString(),
      };

      const packageJsonPath = path.join(installPath, 'package.json');
      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      this.installedPackages.add(name);
      console.log(`✓ Installed ${name}@${version}`);

      return true;
    } catch (error) {
      console.error(`Failed to install ${name}@${version}:`, error);
      return false;
    }
  }

  /**
   * Private: Rollback on failure
   */
  private async rollback(): Promise<void> {
    try {
      console.log('Rolling back installed packages...');
      for (const pkg of this.installedPackages) {
        await this.uninstallPackage(pkg);
      }
      this.installedPackages.clear();
    } catch (error) {
      console.error('Rollback failed:', error);
    }
  }

  /**
   * Private: Ensure required directories exist
   */
  private ensureDirectories(): void {
    try {
      if (!existsSync(this.installDir)) {
        mkdirSync(this.installDir, { recursive: true });
      }
      if (!existsSync(this.cacheDir)) {
        mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (error) {
      console.warn('Failed to create directories:', error);
    }
  }
}
