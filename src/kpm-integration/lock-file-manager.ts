/**
 * Lock File Manager
 *
 * Generate and manage kpm-lock.json for reproducible builds
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

export interface LockPackage {
  version: string;
  resolved?: string;
  integrity?: string;
  dependencies?: Record<string, string>;
}

export interface LockFile {
  lockfileVersion: number;
  packages: Record<string, LockPackage>;
  timestamp: string;
  hash?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Lock File Manager
 */
export class LockFileManager {
  private readonly lockFilePath: string;
  private readonly lockFileName = 'kpm-lock.json';

  constructor(projectRoot: string) {
    this.lockFilePath = path.join(projectRoot, this.lockFileName);
  }

  /**
   * Generate lock file from installed packages
   */
  async generate(packages: Map<string, { version: string; path: string }>): Promise<LockFile> {
    try {
      const lockPackages: Record<string, LockPackage> = {};

      for (const [name, pkg] of packages) {
        lockPackages[name] = {
          version: pkg.version,
          resolved: pkg.path,
          integrity: await this.calculateIntegrity(pkg.path),
        };
      }

      const lockFile: LockFile = {
        lockfileVersion: 1,
        packages: lockPackages,
        timestamp: new Date().toISOString(),
      };

      lockFile.hash = this.calculateHash(lockFile);

      // Save to disk
      await this.save(lockFile);

      return lockFile;
    } catch (error) {
      console.error('Failed to generate lock file:', error);
      throw error;
    }
  }

  /**
   * Load existing lock file
   */
  async load(): Promise<LockFile | null> {
    try {
      if (!existsSync(this.lockFilePath)) {
        return null;
      }

      const content = await readFile(this.lockFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to load lock file:', error);
      return null;
    }
  }

  /**
   * Save lock file to disk
   */
  async save(lockFile: LockFile): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.lockFilePath);
      if (!existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await writeFile(this.lockFilePath, JSON.stringify(lockFile, null, 2));
    } catch (error) {
      console.error('Failed to save lock file:', error);
      throw error;
    }
  }

  /**
   * Validate lock file integrity
   */
  async validate(lockFile: LockFile): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check version
      if (lockFile.lockfileVersion !== 1) {
        errors.push(`Unsupported lockfile version: ${lockFile.lockfileVersion}`);
      }

      // Check timestamp
      if (!lockFile.timestamp) {
        warnings.push('Missing timestamp');
      } else {
        try {
          new Date(lockFile.timestamp);
        } catch (e) {
          errors.push(`Invalid timestamp: ${lockFile.timestamp}`);
        }
      }

      // Verify hash if present
      if (lockFile.hash) {
        const calculatedHash = this.calculateHash(lockFile);
        if (lockFile.hash !== calculatedHash) {
          errors.push('Lock file hash mismatch - file may be corrupted');
        }
      }

      // Check packages
      if (!lockFile.packages || typeof lockFile.packages !== 'object') {
        errors.push('Invalid packages object');
      } else {
        for (const [name, pkg] of Object.entries(lockFile.packages)) {
          if (!pkg.version) {
            errors.push(`Package ${name} missing version`);
          }

          // Check integrity if present
          if (pkg.integrity && pkg.resolved) {
            const isValid = await this.validatePackageIntegrity(name, pkg);
            if (!isValid) {
              warnings.push(`Package ${name} integrity check failed`);
            }
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(`Validation error: ${error}`);
      return {
        valid: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Install packages from lock file (exact versions)
   */
  async installFromLock(lockFile: LockFile): Promise<boolean> {
    try {
      const validation = await this.validate(lockFile);

      if (!validation.valid) {
        console.error('Lock file validation failed:');
        validation.errors.forEach(e => console.error(`  - ${e}`));
        return false;
      }

      if (validation.warnings.length > 0) {
        console.warn('Lock file warnings:');
        validation.warnings.forEach(w => console.warn(`  - ${w}`));
      }

      // For each package in lock file, install exact version
      for (const [name, pkg] of Object.entries(lockFile.packages)) {
        // In production, would download exact tarball from 'resolved' URL
        console.log(`Installing ${name}@${pkg.version}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to install from lock file:', error);
      return false;
    }
  }

  /**
   * Update lock file with new package
   */
  async updatePackage(
    lockFile: LockFile,
    name: string,
    version: string,
    path: string
  ): Promise<LockFile> {
    try {
      const integrity = await this.calculateIntegrity(path);

      lockFile.packages[name] = {
        version,
        resolved: path,
        integrity,
      };

      lockFile.timestamp = new Date().toISOString();
      lockFile.hash = this.calculateHash(lockFile);

      return lockFile;
    } catch (error) {
      console.error(`Failed to update package ${name}:`, error);
      throw error;
    }
  }

  /**
   * Remove package from lock file
   */
  removePackage(lockFile: LockFile, name: string): LockFile {
    delete lockFile.packages[name];

    lockFile.timestamp = new Date().toISOString();
    lockFile.hash = this.calculateHash(lockFile);

    return lockFile;
  }

  /**
   * Get lock file statistics
   */
  getStats(lockFile: LockFile): {
    totalPackages: number;
    createdAt: string;
    lastModified: string;
  } {
    return {
      totalPackages: Object.keys(lockFile.packages).length,
      createdAt: lockFile.timestamp,
      lastModified: lockFile.timestamp,
    };
  }

  /**
   * Private: Calculate file integrity hash
   */
  private async calculateIntegrity(filePath: string): Promise<string> {
    try {
      if (!existsSync(filePath)) {
        return '';
      }

      const content = await readFile(filePath);
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      return `sha256-${hash}`;
    } catch (error) {
      console.warn(`Failed to calculate integrity for ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Private: Calculate lock file hash
   */
  private calculateHash(lockFile: LockFile): string {
    const { hash, ...content } = lockFile;
    const jsonString = JSON.stringify(content, Object.keys(content).sort());
    return crypto.createHash('sha256').update(jsonString).digest('hex');
  }

  /**
   * Private: Validate package integrity
   */
  private async validatePackageIntegrity(name: string, pkg: LockPackage): Promise<boolean> {
    try {
      if (!pkg.resolved || !pkg.integrity) {
        return false;
      }

      if (!existsSync(pkg.resolved)) {
        console.warn(`Package path not found: ${pkg.resolved}`);
        return false;
      }

      const actualIntegrity = await this.calculateIntegrity(pkg.resolved);
      return actualIntegrity === pkg.integrity;
    } catch (error) {
      return false;
    }
  }
}
