/**
 * Workspace Manager
 *
 * Support monorepo-style workspaces with shared dependencies
 * Enable multi-project management with dependency hoisting
 */

import * as fs from 'fs';
import * as path from 'path';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';

import type { KPMPackageInstaller } from './kpm-package-installer';
import type { KPMRegistryClient } from './kpm-registry-client';

export interface WorkspaceConfig {
  name: string;
  workspaces: string[];
  sharedDependencies?: Record<string, string>;
}

export interface WorkspacePackage {
  name: string;
  version: string;
  path: string;
  dependencies: Record<string, string>;
  location: 'root' | 'package';
}

export interface HoistingResult {
  hoisted: string[];
  duplicates: Record<string, string[]>;
  conflicts: Record<string, string[]>;
}

/**
 * Workspace Manager
 */
export class WorkspaceManager {
  private workspaceConfig: WorkspaceConfig | null = null;
  private packages: Map<string, WorkspacePackage> = new Map();

  constructor(
    private rootDir: string,
    private installer?: KPMPackageInstaller,
    private registryClient?: KPMRegistryClient
  ) {}

  /**
   * Initialize workspace
   */
  async initWorkspace(workspaceName: string = 'my-monorepo'): Promise<void> {
    try {
      const config: WorkspaceConfig = {
        name: workspaceName,
        workspaces: ['packages/*', 'apps/*'],
        sharedDependencies: {},
      };

      const configPath = path.join(this.rootDir, 'freelang-workspace.json');
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      this.workspaceConfig = config;

      console.log(`✓ Initialized workspace: ${workspaceName}`);
      console.log(`  Configuration: ${configPath}`);
    } catch (error) {
      console.error('Failed to initialize workspace:', error);
      throw error;
    }
  }

  /**
   * Load workspace configuration
   */
  async loadWorkspace(): Promise<boolean> {
    try {
      const configPath = path.join(this.rootDir, 'freelang-workspace.json');

      if (!existsSync(configPath)) {
        console.warn('No workspace configuration found');
        return false;
      }

      const content = readFileSync(configPath, 'utf-8');
      this.workspaceConfig = JSON.parse(content);

      // Load all packages in workspace
      await this.loadPackages();

      return true;
    } catch (error) {
      console.error('Failed to load workspace:', error);
      return false;
    }
  }

  /**
   * Add package to workspace
   */
  async addPackage(packagePath: string): Promise<void> {
    try {
      const manifestPath = path.join(packagePath, 'freelang.json');

      if (!existsSync(manifestPath)) {
        console.error(`No freelang.json found in ${packagePath}`);
        return;
      }

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      const pkg: WorkspacePackage = {
        name: manifest.name,
        version: manifest.version || '1.0.0',
        path: packagePath,
        dependencies: manifest.dependencies || {},
        location: 'package',
      };

      this.packages.set(pkg.name, pkg);

      console.log(`✓ Added package: ${pkg.name}`);
    } catch (error) {
      console.error('Failed to add package:', error);
    }
  }

  /**
   * Install dependencies for entire workspace
   */
  async installWorkspace(): Promise<void> {
    try {
      if (!this.workspaceConfig) {
        console.error('No workspace configuration loaded');
        return;
      }

      console.log(`Installing workspace: ${this.workspaceConfig.name}`);

      // Load packages
      await this.loadPackages();

      // Install each package's dependencies
      for (const [name, pkg] of this.packages) {
        console.log(`\nInstalling dependencies for ${name}...`);

        for (const [depName, depVersion] of Object.entries(pkg.dependencies)) {
          // Check if dependency is hoisted to root
          if (this.workspaceConfig.sharedDependencies?.[depName]) {
            console.log(`  ✓ ${depName} (hoisted)`);
          } else if (this.installer) {
            // Install from KPM
            const success = await this.installer.installFromKPM(depName, depVersion as string);
            console.log(`  ${success ? '✓' : '✗'} ${depName}@${depVersion}`);
          }
        }
      }

      console.log('\n✓ Workspace installation complete');
    } catch (error) {
      console.error('Workspace installation failed:', error);
    }
  }

  /**
   * Hoist common dependencies to root
   */
  async hoistDependencies(): Promise<HoistingResult> {
    const result: HoistingResult = {
      hoisted: [],
      duplicates: {},
      conflicts: {},
    };

    try {
      if (!this.workspaceConfig) {
        console.error('No workspace configuration loaded');
        return result;
      }

      // Collect all dependencies
      const depMap = new Map<string, Map<string, number>>();

      for (const pkg of this.packages.values()) {
        for (const [depName, depVersion] of Object.entries(pkg.dependencies)) {
          if (!depMap.has(depName)) {
            depMap.set(depName, new Map());
          }

          const versionMap = depMap.get(depName)!;
          const count = versionMap.get(depVersion as string) || 0;
          versionMap.set(depVersion as string, count + 1);
        }
      }

      // Find candidates for hoisting
      for (const [depName, versionMap] of depMap) {
        const totalPackages = this.packages.size;
        const usedByCount = versionMap.size === 1 ? Array.from(versionMap.values())[0] : 0;

        // Hoist if used by 2+ packages with same version
        if (usedByCount >= 2) {
          const version = Array.from(versionMap.keys())[0];

          this.workspaceConfig.sharedDependencies = this.workspaceConfig.sharedDependencies || {};
          this.workspaceConfig.sharedDependencies[depName] = version;

          result.hoisted.push(`${depName}@${version}`);

          // Remove from individual packages
          for (const pkg of this.packages.values()) {
            if (pkg.dependencies[depName]) {
              delete pkg.dependencies[depName];
            }
          }
        } else if (versionMap.size > 1) {
          // Track duplicates
          result.duplicates[depName] = Array.from(versionMap.keys());

          // Track conflicts if versions differ significantly
          const versions = Array.from(versionMap.keys());
          const majorVersions = new Set(
            versions.map(v => v.split('.')[0])
          );

          if (majorVersions.size > 1) {
            result.conflicts[depName] = versions;
          }
        }
      }

      // Save updated configuration
      const configPath = path.join(this.rootDir, 'freelang-workspace.json');
      writeFileSync(configPath, JSON.stringify(this.workspaceConfig, null, 2));

      console.log(`\n✓ Hoisting complete`);
      console.log(`  Hoisted: ${result.hoisted.length} packages`);
      console.log(`  Duplicates: ${Object.keys(result.duplicates).length}`);
      console.log(`  Conflicts: ${Object.keys(result.conflicts).length}`);

      return result;
    } catch (error) {
      console.error('Dependency hoisting failed:', error);
      return result;
    }
  }

  /**
   * Get workspace statistics
   */
  async getStats(): Promise<{
    totalPackages: number;
    totalDependencies: number;
    sharedDependencies: number;
    packageList: string[];
  }> {
    let totalDeps = 0;

    for (const pkg of this.packages.values()) {
      totalDeps += Object.keys(pkg.dependencies).length;
    }

    return {
      totalPackages: this.packages.size,
      totalDependencies: totalDeps,
      sharedDependencies: Object.keys(this.workspaceConfig?.sharedDependencies || {}).length,
      packageList: Array.from(this.packages.keys()),
    };
  }

  /**
   * Get workspace configuration
   */
  getConfiguration(): WorkspaceConfig | null {
    return this.workspaceConfig;
  }

  /**
   * List all workspace packages
   */
  listPackages(): WorkspacePackage[] {
    return Array.from(this.packages.values());
  }

  /**
   * Clean workspace (remove node_modules, caches)
   */
  async clean(): Promise<void> {
    try {
      console.log('Cleaning workspace...');

      for (const pkg of this.packages.values()) {
        const nodeModulesPath = path.join(pkg.path, 'node_modules');
        const kimModulesPath = path.join(pkg.path, 'kim_modules');
        const flModulesPath = path.join(pkg.path, 'fl_modules');

        for (const dir of [nodeModulesPath, kimModulesPath, flModulesPath]) {
          if (existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
            console.log(`  ✓ Removed ${dir}`);
          }
        }
      }

      console.log('✓ Workspace cleaned');
    } catch (error) {
      console.error('Clean failed:', error);
    }
  }

  /**
   * Private: Load all packages in workspace
   */
  private async loadPackages(): Promise<void> {
    try {
      if (!this.workspaceConfig) {
        return;
      }

      this.packages.clear();

      for (const pattern of this.workspaceConfig.workspaces) {
        const baseDir = path.dirname(pattern);
        const glob = path.basename(pattern);

        if (glob === '*') {
          // Load all directories
          if (existsSync(baseDir)) {
            const dirs = readdirSync(baseDir);

            for (const dir of dirs) {
              const fullPath = path.join(baseDir, dir);
              const manifestPath = path.join(fullPath, 'freelang.json');

              if (existsSync(manifestPath)) {
                await this.addPackage(fullPath);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load packages:', error);
    }
  }
}
