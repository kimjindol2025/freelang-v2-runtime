/**
 * KPM Commands for FreeLang CLI
 *
 * New CLI commands for KPM integration:
 * - freelang search <query>
 * - freelang install <package>[@version]
 * - freelang update [package]
 * - freelang list
 * - freelang tree
 * - freelang migrate
 */

import * as fs from 'fs';
import * as path from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import chalk from 'chalk';

import { KPMRegistryClient } from '../kpm-integration/kpm-registry-client';
import { KPMCLIWrapper } from '../kpm-integration/kpm-cli-wrapper';
import { KPMPackageInstaller } from '../kpm-integration/kpm-package-installer';
import { UnifiedModuleResolver } from '../kpm-integration/unified-module-resolver';
import { DependencyGraphBuilder } from '../kpm-integration/dependency-graph-builder';
import { LockFileManager } from '../kpm-integration/lock-file-manager';
import { NPMToKPMMigrator } from '../kpm-integration/npm-to-kpm-migrator';

export class KPMCommands {
  private registryClient: KPMRegistryClient;
  private cliWrapper: KPMCLIWrapper;
  private installer: KPMPackageInstaller;
  private resolver: UnifiedModuleResolver;
  private graphBuilder: DependencyGraphBuilder;
  private lockManager: LockFileManager;
  private migrator: NPMToKPMMigrator;
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.registryClient = new KPMRegistryClient();
    this.cliWrapper = new KPMCLIWrapper();
    this.installer = new KPMPackageInstaller(this.registryClient, this.cliWrapper);
    this.resolver = new UnifiedModuleResolver(projectRoot, this.registryClient, this.installer);
    this.graphBuilder = new DependencyGraphBuilder(this.registryClient);
    this.lockManager = new LockFileManager(projectRoot);
    this.migrator = new NPMToKPMMigrator(this.registryClient);
  }

  /**
   * freelang search <query>
   * Search for packages in KPM registry
   */
  async search(query: string, options: { limit?: number } = {}): Promise<void> {
    try {
      if (!query) {
        console.error(chalk.red('Error: search query required'));
        return;
      }

      console.log(chalk.blue(`Searching for "${query}"...`));

      const limit = options.limit || 20;
      const results = await this.registryClient.search(query, { limit });

      if (results.length === 0) {
        console.log(chalk.yellow('No packages found'));
        return;
      }

      console.log(chalk.cyan('\nName                          Version         Description'));
      console.log(chalk.gray('─'.repeat(90)));

      for (const pkg of results) {
        const name = chalk.green(pkg.name).padEnd(30);
        const version = pkg.version.padEnd(15);
        const desc = (pkg.description || '').substring(0, 45);
        console.log(`${name} ${version} ${desc}`);
      }
      console.log(chalk.gray(`\nFound ${results.length} packages`));
    } catch (error) {
      console.error(chalk.red('Search failed:'), error);
    }
  }

  /**
   * freelang info <package-name>
   * Show detailed package information
   */
  async info(packageName: string): Promise<void> {
    try {
      if (!packageName) {
        console.error(chalk.red('Error: package name required'));
        return;
      }

      console.log(chalk.blue(`Fetching info for ${packageName}...`));

      const info = await this.registryClient.getPackageInfo(packageName);
      if (!info) {
        console.error(chalk.red(`Package not found: ${packageName}`));
        return;
      }

      console.log(chalk.bold(`\n${info.name}`));
      console.log(chalk.gray('─'.repeat(50)));

      const printField = (label: string, value: string) => {
        console.log(`${chalk.cyan(label.padEnd(15))} ${value}`);
      };

      printField('Latest', chalk.yellow(info.latest));
      printField('Versions', info.versions.slice(0, 5).join(', ') + (info.versions.length > 5 ? '...' : ''));
      printField('Description', info.description);
      printField('Author', info.author || 'N/A');
      printField('License', info.license || 'N/A');
      printField('Homepage', info.homepage || 'N/A');
      printField('Repository', info.repository || 'N/A');
      printField('Downloads', (info.downloads || 0).toLocaleString());

      if (info.dependencies && Object.keys(info.dependencies).length > 0) {
        printField('Dependencies', Object.keys(info.dependencies).join(', '));
      }
    } catch (error) {
      console.error(chalk.red('Info fetch failed:'), error);
    }
  }

  /**
   * freelang install <package>[@version]
   * Install package from KPM
   */
  async install(packageSpec: string): Promise<void> {
    try {
      if (!packageSpec) {
        console.error(chalk.red('Error: package spec required (e.g., @freelang/async or @freelang/async@2.0.0)'));
        return;
      }

      const [name, version = 'latest'] = packageSpec.split('@').filter(Boolean);
      const normalizedName = packageSpec.startsWith('@') ? `@${name}` : name;

      console.log(chalk.blue(`Installing ${normalizedName}@${version}...`));

      const startTime = Date.now();
      const success = await this.installer.installFromKPM(normalizedName, version);

      if (success) {
        const time = Date.now() - startTime;
        console.log(chalk.green(`✓ ${normalizedName}@${version} installed`), chalk.gray(`(${time}ms)`));

        // Update freelang.json
        await this.updateManifest(normalizedName, version);
      } else {
        console.error(chalk.red(`✗ Installation failed for ${normalizedName}`));
      }
    } catch (error) {
      console.error(chalk.red('Installation failed:'), error);
    }
  }

  /**
   * freelang update [package]
   * Update dependencies
   */
  async update(packageName?: string): Promise<void> {
    try {
      if (packageName) {
        // Update specific package
        console.log(chalk.blue(`Updating ${packageName}...`));
        const success = await this.installer.updatePackage(packageName);

        if (success) {
          console.log(chalk.green(`✓ ${packageName} updated`));
        } else {
          console.error(chalk.red(`✗ Update failed for ${packageName}`));
        }
      } else {
        // Update all dependencies
        console.log(chalk.blue('Updating all dependencies...'));
        const manifest = this.readManifest();

        if (!manifest.dependencies || Object.keys(manifest.dependencies).length === 0) {
          console.log(chalk.yellow('No dependencies to update'));
          return;
        }

        for (const [name] of Object.entries(manifest.dependencies)) {
          await this.installer.updatePackage(name);
        }

        console.log(chalk.green('✓ All dependencies updated'));
      }
    } catch (error) {
      console.error(chalk.red('Update failed:'), error);
    }
  }

  /**
   * freelang list
   * List installed packages
   */
  async list(): Promise<void> {
    try {
      const packages = this.resolver.getInstalledPackages();
      if (packages.length === 0) {
        console.log(chalk.yellow('No packages installed'));
        return;
      }

      if (packages.length === 0) {
        console.log(chalk.yellow('No packages installed'));
        return;
      }

      console.log(chalk.cyan('\nPackage                        Version         Location'));
      console.log(chalk.gray('─'.repeat(80)));

      for (const pkg of packages) {
        const version = this.installer.getInstalledVersion(pkg) || 'unknown';
        const location = await this.resolver.resolveModulePath(__filename, pkg);

        const pkgName = chalk.green(pkg).padEnd(30);
        const ver = version.padEnd(15);
        const loc = location.found ? 'installed' : 'not found';
        console.log(`${pkgName} ${ver} ${loc}`);
      }

      console.log(chalk.gray(`\nTotal: ${packages.length} packages`));
    } catch (error) {
      console.error(chalk.red('List failed:'), error);
    }
  }

  /**
   * freelang tree
   * Show dependency tree
   */
  async tree(packageName?: string): Promise<void> {
    try {
      if (!packageName) {
        // Show dependencies from freelang.json
        const manifest = this.readManifest();
        packageName = manifest.name || 'root';
      }

      console.log(chalk.blue(`Dependency tree for ${packageName}:`));

      const graph = await this.graphBuilder.buildGraph(packageName, 'latest');
      this.printTree(graph, 0);
    } catch (error) {
      console.error(chalk.red('Tree fetch failed:'), error);
    }
  }

  /**
   * freelang migrate
   * Migrate from npm to KPM
   */
  async migrate(dryRun: boolean = true): Promise<void> {
    try {
      console.log(chalk.blue('Analyzing npm packages for KPM alternatives...'));

      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (!existsSync(packageJsonPath)) {
        console.log(chalk.yellow('No package.json found'));
        return;
      }

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const report = await this.migrator.analyze(packageJson);

      console.log(chalk.bold('\n📊 Migration Report'));
      console.log(chalk.gray('─'.repeat(50)));

      // Summary
      console.log(chalk.cyan('Total packages analyzed:'), report.totalPackages);
      console.log(chalk.cyan('Can be migrated:'), chalk.green(report.migratable));
      console.log(chalk.cyan('Alternatives found:'), chalk.yellow(report.alternatives.length));

      // Recommendations
      if (report.alternatives.length > 0) {
        console.log(chalk.bold('\n💡 Recommended replacements:'));
        console.log(chalk.cyan('npm Package          → KPM Package             Confidence'));
        console.log(chalk.gray('─'.repeat(70)));

        for (const alt of report.alternatives.slice(0, 10)) {
          const confidence = Math.round(alt.confidence * 100);
          const npm = alt.npm.padEnd(20);
          const kpm = chalk.green(alt.kpm).padEnd(28);
          const conf =
            confidence >= 90 ? chalk.green(`${confidence}%`) : chalk.yellow(`${confidence}%`);
          console.log(`${npm} → ${kpm} ${conf}`);
        }
      }

      if (dryRun) {
        console.log(chalk.gray('\n(Run with --no-dry-run to apply changes)'));
      } else {
        console.log(chalk.blue('\nApplying migration...'));
        await this.migrator.migrate(false);
        console.log(chalk.green('✓ Migration complete'));
      }
    } catch (error) {
      console.error(chalk.red('Migration failed:'), error);
    }
  }

  /**
   * Private: Update freelang.json manifest
   */
  private async updateManifest(packageName: string, version: string): Promise<void> {
    try {
      const manifestPath = path.join(this.projectRoot, 'freelang.json');
      let manifest = this.readManifest();

      if (!manifest.dependencies) {
        manifest.dependencies = {};
      }

      manifest.dependencies[packageName] = version;
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    } catch (error) {
      console.warn(chalk.yellow('Could not update manifest:'), error);
    }
  }

  /**
   * Private: Read freelang.json manifest
   */
  private readManifest(): any {
    try {
      const manifestPath = path.join(this.projectRoot, 'freelang.json');
      if (existsSync(manifestPath)) {
        return JSON.parse(readFileSync(manifestPath, 'utf-8'));
      }
    } catch (error) {
      // Silently fail
    }
    return { name: 'unknown', dependencies: {} };
  }

  /**
   * Private: Print dependency tree
   */
  private printTree(node: any, depth: number, prefix: string = ''): void {
    const indent = '  '.repeat(depth);
    const icon = depth === 0 ? '📦' : '├─';

    console.log(`${indent}${icon} ${chalk.green(node.name)}@${node.version}`);

    if (node.dependencies && node.dependencies.size > 0) {
      let index = 0;
      for (const [, dep] of node.dependencies) {
        const isLast = index === node.dependencies.size - 1;
        const nextPrefix = prefix + (isLast ? '  ' : '│ ');
        this.printTree(dep, depth + 1, nextPrefix);
        index++;
      }
    }
  }
}
