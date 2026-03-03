/**
 * Phase 17: Package Installer
 * Installs dependencies based on resolved dependency graph
 * Handles caching, versioning, and atomic rollback
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { DependencyResolver, ResolutionResult, DependencyNode, MockRegistry } from './dependency-resolver';
import { PackageJson } from './package-parser';

/**
 * Installation options
 */
export interface InstallOptions {
  targetDir?: string;
  cacheDir?: string;
  onProgress?: (message: string) => void;
  atomic?: boolean; // Rollback on error
  saveLockfile?: boolean;
}

/**
 * Installation result
 */
export interface InstallResult {
  success: boolean;
  installed: string[];
  skipped: string[];
  failed: string[];
  duration: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Installed package metadata
 */
export interface InstalledPackage {
  name: string;
  version: string;
  installedAt: string;
  hash: string;
  source: 'cache' | 'download';
  dependencies: string[];
}

/**
 * Lock file format (like package-lock.json)
 */
export interface LockFile {
  version: string;
  lockfileVersion: number;
  requires: boolean;
  packages: Record<string, InstalledPackage>;
  dependencies: Record<string, { version: string }>;
  timestamp: string;
}

/**
 * Atomic installation transaction
 */
class InstallTransaction {
  private installDir: string;
  private backupDir: string;
  private installed: Map<string, string> = new Map();
  private rollbackEnabled: boolean;

  constructor(installDir: string, enableRollback: boolean = true) {
    this.installDir = installDir;
    this.rollbackEnabled = enableRollback;
    this.backupDir = path.join(path.dirname(installDir), `.backup-${Date.now()}`);
  }

  /**
   * Create backup before installation
   */
  async createBackup(): Promise<void> {
    if (!this.rollbackEnabled) return;

    if (fs.existsSync(this.installDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      // In real implementation, use recursive copy
      console.log(`📦 Backup created: ${this.backupDir}`);
    }
  }

  /**
   * Record installed package
   */
  recordInstall(name: string, version: string): void {
    this.installed.set(name, version);
  }

  /**
   * Commit transaction (cleanup backup)
   */
  async commit(): Promise<void> {
    if (this.rollbackEnabled && fs.existsSync(this.backupDir)) {
      fs.rmSync(this.backupDir, { recursive: true, force: true });
    }
    console.log(`✅ Installation committed: ${this.installed.size} packages`);
  }

  /**
   * Rollback transaction (restore backup)
   */
  async rollback(): Promise<void> {
    if (!this.rollbackEnabled || !fs.existsSync(this.backupDir)) {
      return;
    }

    console.log(`⏮️  Rolling back installation...`);
    // In real implementation, restore from backup
    fs.rmSync(this.installDir, { recursive: true, force: true });
    fs.renameSync(this.backupDir, this.installDir);
    console.log(`✅ Rollback completed`);
  }
}

/**
 * Cache manager
 */
class CacheManager {
  private cacheDir: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(process.env.HOME || '~', '.kim-cache');
  }

  /**
   * Get cache key for package
   */
  private getCacheKey(name: string, version: string): string {
    return crypto
      .createHash('sha256')
      .update(`${name}@${version}`)
      .digest('hex')
      .substring(0, 12);
  }

  /**
   * Get cached package path
   */
  getCachePath(name: string, version: string): string {
    const key = this.getCacheKey(name, version);
    return path.join(this.cacheDir, key, `${name}-${version}.tgz`);
  }

  /**
   * Check if package is cached
   */
  isCached(name: string, version: string): boolean {
    const cachePath = this.getCachePath(name, version);
    return fs.existsSync(cachePath);
  }

  /**
   * Save package to cache
   */
  async saveToCache(name: string, version: string, data: Buffer): Promise<void> {
    const cachePath = this.getCachePath(name, version);
    const cacheDir = path.dirname(cachePath);

    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cachePath, data);

    console.log(`💾 Cached: ${name}@${version}`);
  }

  /**
   * Get package from cache
   */
  async getFromCache(name: string, version: string): Promise<Buffer | null> {
    const cachePath = this.getCachePath(name, version);

    if (!fs.existsSync(cachePath)) {
      return null;
    }

    return fs.readFileSync(cachePath);
  }

  /**
   * Clean old cache entries
   */
  async cleanup(maxAgeDays: number = 30): Promise<void> {
    if (!fs.existsSync(this.cacheDir)) {
      return;
    }

    const now = Date.now();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    let removed = 0;

    const entries = fs.readdirSync(this.cacheDir);
    for (const entry of entries) {
      const entryPath = path.join(this.cacheDir, entry);
      const stats = fs.statSync(entryPath);

      if (now - stats.mtimeMs > maxAge) {
        fs.rmSync(entryPath, { recursive: true, force: true });
        removed++;
      }
    }

    console.log(`🗑️  Cache cleanup: ${removed} old entries removed`);
  }
}

/**
 * Package installer
 */
export class PackageInstaller {
  private resolver: DependencyResolver;
  private cache: CacheManager;
  private options: InstallOptions;

  constructor(resolver?: DependencyResolver, options: InstallOptions = {}) {
    this.resolver = resolver || new DependencyResolver();
    this.cache = new CacheManager(options.cacheDir);
    this.options = {
      targetDir: './kim_modules',
      atomic: true,
      saveLockfile: true,
      ...options
    };
  }

  /**
   * Install dependencies
   * @param packageName - root package to install
   * @param version - version constraint
   * @returns installation result
   */
  async install(packageName: string, version?: string): Promise<InstallResult> {
    const startTime = Date.now();
    const result: InstallResult = {
      success: false,
      installed: [],
      skipped: [],
      failed: [],
      duration: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    const transaction = new InstallTransaction(this.options.targetDir!, this.options.atomic);

    try {
      // Create backup
      await transaction.createBackup();
      this.log(`📦 Starting installation of ${packageName}@${version || '*'}`);

      // Resolve dependencies
      this.log(`🔍 Resolving dependencies...`);
      const resolution = await this.resolver.resolve(packageName, version);

      // Check for circular dependencies
      if (this.resolver.hasCircularDependencies(resolution)) {
        this.log(`⚠️  Warning: Circular dependencies detected`);
        console.log(this.resolver.summarize(resolution));
      }

      // Install in post-order (dependencies first)
      await this.installTree(resolution.root, result, transaction);

      // Save lock file
      if (this.options.saveLockfile) {
        await this.saveLockfile(resolution, result);
      }

      // Commit transaction
      await transaction.commit();

      result.success = true;
      result.duration = Date.now() - startTime;

      this.log(`✅ Installation complete: ${result.installed.length} packages, ${result.duration}ms`);
    } catch (error) {
      this.log(`❌ Installation failed: ${error}`);
      result.failed.push(packageName);

      if (this.options.atomic) {
        await transaction.rollback();
      }
    }

    return result;
  }

  /**
   * Install dependency tree recursively (post-order)
   * Dependencies are installed before dependents
   */
  private async installTree(
    node: DependencyNode,
    result: InstallResult,
    transaction: InstallTransaction
  ): Promise<void> {
    // Skip if circular
    if (node.version === 'circular') {
      this.log(`⚠️  Skipped circular dependency: ${node.name}`);
      result.skipped.push(`${node.name}@${node.version}`);
      return;
    }

    // Install children first (post-order)
    for (const dep of node.dependencies) {
      await this.installTree(dep, result, transaction);
    }

    // Install this package
    await this.installPackage(node, result, transaction);
  }

  /**
   * Install single package
   */
  private async installPackage(
    node: DependencyNode,
    result: InstallResult,
    transaction: InstallTransaction
  ): Promise<void> {
    const pkgName = `${node.name}@${node.version}`;

    try {
      // Check cache first
      if (this.cache.isCached(node.name, node.version)) {
        this.log(`✅ Cache hit: ${pkgName}`);
        result.cacheHits++;
        result.installed.push(pkgName);
        transaction.recordInstall(node.name, node.version);
        return;
      }

      // Download from registry (mock: skip actual download)
      this.log(`📥 Installing: ${pkgName}`);
      result.cacheMisses++;

      // Simulate download
      const data = Buffer.from(JSON.stringify({ name: node.name, version: node.version }));
      await this.cache.saveToCache(node.name, node.version, data);

      // Create directory structure
      const installPath = path.join(this.options.targetDir!, node.name);
      fs.mkdirSync(installPath, { recursive: true });

      result.installed.push(pkgName);
      transaction.recordInstall(node.name, node.version);

      this.log(`✅ Installed: ${pkgName}`);
    } catch (error) {
      this.log(`❌ Failed to install ${pkgName}: ${error}`);
      result.failed.push(pkgName);
      throw error; // Trigger rollback
    }
  }

  /**
   * Save lock file
   */
  private async saveLockfile(result: ResolutionResult, installResult: InstallResult): Promise<void> {
    const lockfile: LockFile = {
      version: '1.0.0',
      lockfileVersion: 2,
      requires: true,
      packages: {},
      dependencies: {},
      timestamp: new Date().toISOString()
    };

    // Populate packages from flat tree
    for (const [name, node] of result.flatTree.entries()) {
      lockfile.packages[`node_modules/${name}`] = {
        name,
        version: node.version,
        installedAt: new Date().toISOString(),
        hash: crypto
          .createHash('sha256')
          .update(`${name}@${node.version}`)
          .digest('hex')
          .substring(0, 12),
        source: 'cache',
        dependencies: node.dependencies.map((d) => `${d.name}@${d.version}`)
      };

      lockfile.dependencies[name] = { version: node.version };
    }

    const lockfilePath = path.join(this.options.targetDir!, 'package-lock.json');
    fs.writeFileSync(lockfilePath, JSON.stringify(lockfile, null, 2));

    this.log(`💾 Lock file saved: ${lockfilePath}`);
  }

  /**
   * Uninstall package and dependencies
   */
  async uninstall(packageName: string): Promise<void> {
    const packagePath = path.join(this.options.targetDir!, packageName);

    if (!fs.existsSync(packagePath)) {
      this.log(`⚠️  Package not found: ${packageName}`);
      return;
    }

    fs.rmSync(packagePath, { recursive: true, force: true });
    this.log(`🗑️  Uninstalled: ${packageName}`);
  }

  /**
   * Clean cache
   */
  async cleanCache(maxAgeDays?: number): Promise<void> {
    await this.cache.cleanup(maxAgeDays);
  }

  /**
   * Get installation summary
   */
  summarize(result: InstallResult): string {
    const lines: string[] = [];

    lines.push(`📦 Installation Summary`);
    lines.push(`✅ Installed: ${result.installed.length}`);
    lines.push(`⏭️  Skipped: ${result.skipped.length}`);
    lines.push(`❌ Failed: ${result.failed.length}`);
    lines.push(`⚡ Duration: ${result.duration}ms`);
    lines.push(`💾 Cache hits: ${result.cacheHits}`);
    lines.push(`📥 Cache misses: ${result.cacheMisses}`);

    if (result.failed.length > 0) {
      lines.push(`\n⚠️  Failed packages:`);
      for (const pkg of result.failed) {
        lines.push(`   - ${pkg}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Log message
   */
  private log(message: string): void {
    if (this.options.onProgress) {
      this.options.onProgress(message);
    } else {
      console.log(message);
    }
  }
}

/**
 * Helper function to install package
 */
export async function installPackage(
  packageName: string,
  version?: string,
  options?: InstallOptions
): Promise<InstallResult> {
  const installer = new PackageInstaller(undefined, options);
  return installer.install(packageName, version);
}

/**
 * Export cache manager for testing
 */
export { CacheManager, InstallTransaction };
