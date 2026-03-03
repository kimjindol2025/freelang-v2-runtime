/**
 * Version Upgrade Manager
 *
 * Handle package updates with breaking change detection
 * Manage version upgrades intelligently with safety checks
 */

import { readFileSync, existsSync } from 'fs';

import type { KPMRegistryClient } from './kpm-registry-client';
import type { KPMPackageInstaller } from './kpm-package-installer';

export interface UpdateInfo {
  package: string;
  current: string;
  latest: string;
  type: 'major' | 'minor' | 'patch' | 'prerelease';
  breaking: boolean;
  changes: string[];
}

export interface BreakingChange {
  version: string;
  title: string;
  description: string;
  migration: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface UpgradeOptions {
  allowMajor?: boolean;
  allowBreaking?: boolean;
  dryRun?: boolean;
  confirmPrompt?: (message: string) => Promise<boolean>;
}

/**
 * Version Upgrade Manager
 */
export class VersionUpgradeManager {
  constructor(
    private registryClient: KPMRegistryClient,
    private installer?: KPMPackageInstaller
  ) {}

  /**
   * Check for updates across all dependencies
   */
  async checkUpdates(manifest: any): Promise<UpdateInfo[]> {
    try {
      const updates: UpdateInfo[] = [];
      const dependencies = manifest.dependencies || {};

      for (const [name, currentVersion] of Object.entries(dependencies)) {
        const info = await this.registryClient.getPackageInfo(name);

        if (info) {
          const updateInfo = this.analyzeVersion(
            name,
            currentVersion as string,
            info.latest
          );

          if (updateInfo) {
            updates.push(updateInfo);
          }
        }
      }

      return updates.sort((a, b) => {
        // Prioritize breaking changes
        if (a.breaking !== b.breaking) {
          return a.breaking ? -1 : 1;
        }
        // Then major versions
        if (a.type !== b.type) {
          const order = { major: 0, minor: 1, patch: 2, prerelease: 3 };
          return order[a.type] - order[b.type];
        }
        return 0;
      });
    } catch (error) {
      console.error('Failed to check updates:', error);
      return [];
    }
  }

  /**
   * Upgrade single package with safety checks
   */
  async upgrade(packageName: string, options: UpgradeOptions = {}): Promise<boolean> {
    try {
      const info = await this.registryClient.getPackageInfo(packageName);
      if (!info) {
        console.error(`Package not found: ${packageName}`);
        return false;
      }

      const current = this.installer?.getInstalledVersion(packageName) || '1.0.0';
      const latest = info.latest;

      // Analyze version change
      const updateInfo = this.analyzeVersion(packageName, current, latest);

      if (!updateInfo) {
        console.log(`✓ ${packageName} is already at latest version`);
        return true;
      }

      // Check for breaking changes
      if (updateInfo.breaking) {
        console.warn(`⚠️  ${packageName} has breaking changes in v${latest}`);

        if (!options.allowBreaking) {
          console.log('  Use --allow-breaking to proceed');
          return false;
        }

        // Show migration guide if available
        await this.showMigrationGuide(packageName, current, latest);

        // Require confirmation
        if (options.confirmPrompt) {
          const confirmed = await options.confirmPrompt(
            `Continue upgrading ${packageName} from ${current} to ${latest}?`
          );

          if (!confirmed) {
            console.log('Upgrade cancelled');
            return false;
          }
        }
      }

      // Check for major version jump
      const currentMajor = parseInt(current.split('.')[0]);
      const latestMajor = parseInt(latest.split('.')[0]);

      if (latestMajor > currentMajor && !options.allowMajor) {
        console.warn(`⚠️  Major version upgrade available: ${current} → ${latest}`);
        console.log('  Use --allow-major to proceed');
        return false;
      }

      // Perform upgrade
      if (!options.dryRun) {
        console.log(`Upgrading ${packageName}@${current} → ${latest}...`);
        const success = await this.installer?.installFromKPM(packageName, latest);

        if (success) {
          console.log(`✓ Successfully upgraded to ${latest}`);
          return true;
        } else {
          console.error('✗ Upgrade failed');
          return false;
        }
      } else {
        console.log(`[DRY RUN] Would upgrade ${packageName}@${current} → ${latest}`);
        return true;
      }
    } catch (error) {
      console.error('Upgrade failed:', error);
      return false;
    }
  }

  /**
   * Detect breaking changes between versions
   */
  async detectBreakingChanges(
    packageName: string,
    fromVersion: string,
    toVersion: string
  ): Promise<BreakingChange[]> {
    const changes: BreakingChange[] = [];

    try {
      // Try to find CHANGELOG or release notes
      // In production, would fetch from repository
      // For now, return common breaking change patterns

      const fromMajor = parseInt(fromVersion.split('.')[0]);
      const toMajor = parseInt(toVersion.split('.')[0]);

      if (toMajor > fromMajor) {
        changes.push({
          version: toVersion,
          title: 'Major Version Upgrade',
          description: `Upgrading from v${fromVersion} to v${toVersion} may introduce breaking changes`,
          migration: `Review the CHANGELOG.md or migration guide for ${packageName} v${toVersion}`,
          severity: 'high',
        });
      }

      // Check for known breaking changes in specific packages
      const knownBreakingChanges = this.getKnownBreakingChanges(packageName);
      const relevant = knownBreakingChanges.filter(
        change =>
          this.isVersionInRange(change.version, fromVersion, toVersion)
      );

      changes.push(...relevant);
    } catch (error) {
      console.error('Failed to detect breaking changes:', error);
    }

    return changes;
  }

  /**
   * Show migration guide for package upgrade
   */
  async showMigrationGuide(
    packageName: string,
    fromVersion: string,
    toVersion: string
  ): Promise<void> {
    try {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📚 Migration Guide: ${packageName} ${fromVersion} → ${toVersion}`);
      console.log(`${'═'.repeat(60)}\n`);

      // Get breaking changes
      const changes = await this.detectBreakingChanges(packageName, fromVersion, toVersion);

      if (changes.length > 0) {
        console.log('⚠️  Breaking Changes:');
        for (const change of changes) {
          console.log(`\n  ${change.title}`);
          console.log(`  ${change.description}`);
          console.log(`  Migration: ${change.migration}`);
        }
      }

      // Show typical migration steps
      console.log('\n✅ Upgrade Steps:');
      console.log('  1. Review breaking changes above');
      console.log('  2. Update your code accordingly');
      console.log(`  3. Run: freelang install ${packageName}@${toVersion}`);
      console.log('  4. Run your test suite');
      console.log('  5. Deploy and monitor for errors\n');

      console.log(`${'═'.repeat(60)}\n`);
    } catch (error) {
      console.error('Failed to show migration guide:', error);
    }
  }

  /**
   * Get outdated packages
   */
  async getOutdated(manifest: any): Promise<UpdateInfo[]> {
    return this.checkUpdates(manifest);
  }

  /**
   * Private: Analyze version change
   */
  private analyzeVersion(
    name: string,
    current: string,
    latest: string
  ): UpdateInfo | null {
    // Normalize versions
    const curr = this.parseVersion(current);
    const lts = this.parseVersion(latest);

    if (!curr || !lts) {
      return null;
    }

    // Check if already latest
    if (curr.major === lts.major && curr.minor === lts.minor && curr.patch === lts.patch) {
      return null;
    }

    // Determine type of update
    let type: 'major' | 'minor' | 'patch' | 'prerelease' = 'patch';
    let breaking = false;

    if (lts.major > curr.major) {
      type = 'major';
      breaking = true;
    } else if (lts.minor > curr.minor) {
      type = 'minor';
    }

    // Check for prerelease
    if (lts.prerelease || lts.build) {
      type = 'prerelease';
    }

    return {
      package: name,
      current,
      latest,
      type,
      breaking,
      changes: this.getChangesSummary(type),
    };
  }

  /**
   * Private: Parse semantic version
   */
  private parseVersion(
    versionStr: string
  ): { major: number; minor: number; patch: number; prerelease?: string; build?: string } | null {
    const match = versionStr.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+?))?(?:\+(.+))?$/);

    if (!match) {
      return null;
    }

    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3]),
      prerelease: match[4],
      build: match[5],
    };
  }

  /**
   * Private: Get known breaking changes for package
   */
  private getKnownBreakingChanges(packageName: string): BreakingChange[] {
    const knownChanges: Record<string, BreakingChange[]> = {
      'express': [
        {
          version: '5.0.0',
          title: 'Express 5.0 Breaking Changes',
          description: 'Middleware API changes and router updates',
          migration: 'See https://expressjs.com/en/guide/migrating-5.html',
          severity: 'high',
        },
      ],
      'lodash': [
        {
          version: '5.0.0',
          title: 'Lodash 5.0 Rewrite',
          description: 'Major API restructuring',
          migration: 'Review breaking changes in official documentation',
          severity: 'critical',
        },
      ],
    };

    return knownChanges[packageName] || [];
  }

  /**
   * Private: Check if version is in range
   */
  private isVersionInRange(version: string, from: string, to: string): boolean {
    const v = this.parseVersion(version);
    const f = this.parseVersion(from);
    const t = this.parseVersion(to);

    if (!v || !f || !t) return false;

    // Check if v is between f and t
    const vNum = v.major * 10000 + v.minor * 100 + v.patch;
    const fNum = f.major * 10000 + f.minor * 100 + f.patch;
    const tNum = t.major * 10000 + t.minor * 100 + t.patch;

    return vNum > fNum && vNum <= tNum;
  }

  /**
   * Private: Get summary of changes for update type
   */
  private getChangesSummary(type: string): string[] {
    const summaries: Record<string, string[]> = {
      major: [
        'Potential API changes',
        'May require code refactoring',
        'New features and improvements',
      ],
      minor: ['New features added', 'Backwards compatible', 'No breaking changes'],
      patch: ['Bug fixes', 'Performance improvements', 'No breaking changes'],
      prerelease: [
        'Pre-release version',
        'May be unstable',
        'Use with caution',
      ],
    };

    return summaries[type] || [];
  }
}
