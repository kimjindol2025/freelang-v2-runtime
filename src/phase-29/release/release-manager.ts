/**
 * Phase 29: Production Release - Release Manager
 * Handles semantic versioning, release tagging, and publication
 */

export interface ReleaseVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string; // alpha, beta, rc
  build?: string;
}

export interface ReleaseNotes {
  version: string;
  releaseDate: Date;
  features: string[];
  bugFixes: string[];
  breakingChanges: string[];
  deprecations: string[];
  knownIssues: string[];
  contributors: string[];
}

export interface Release {
  id: string;
  version: string;
  versionObject: ReleaseVersion;
  timestamp: Date;
  gitTag: string;
  notes: ReleaseNotes;
  status: 'DRAFT' | 'READY' | 'PUBLISHED' | 'YANKED';
  artifacts: Map<string, Buffer>;
  checksum: string;
  publishedTo: string[]; // 'npm', 'kpm', 'github'
}

export interface Changelog {
  entries: ReleaseNotes[];
  lastUpdated: Date;
}

export class ReleaseManager {
  private releases: Map<string, Release> = new Map();
  private changelog: Changelog = {
    entries: [],
    lastUpdated: new Date(),
  };
  private versions: ReleaseVersion[] = [];
  private currentVersion: ReleaseVersion = { major: 0, minor: 0, patch: 0 };

  /**
   * Parse semantic version string
   */
  parseVersion(versionString: string): ReleaseVersion {
    // Simple parser for semantic versioning
    const match = versionString.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?(?:\+(.+))?$/);
    if (!match) {
      throw new Error(`Invalid version format: ${versionString}`);
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      prerelease: match[4],
      build: match[5],
    };
  }

  /**
   * Format version object to string
   */
  versionToString(version: ReleaseVersion): string {
    let str = `${version.major}.${version.minor}.${version.patch}`;
    if (version.prerelease) str += `-${version.prerelease}`;
    if (version.build) str += `+${version.build}`;
    return str;
  }

  /**
   * Increment version (major, minor, or patch)
   */
  incrementVersion(type: 'major' | 'minor' | 'patch', current: ReleaseVersion): ReleaseVersion {
    const incremented = { ...current, prerelease: undefined, build: undefined };

    if (type === 'major') {
      incremented.major++;
      incremented.minor = 0;
      incremented.patch = 0;
    } else if (type === 'minor') {
      incremented.minor++;
      incremented.patch = 0;
    } else if (type === 'patch') {
      incremented.patch++;
    }

    return incremented;
  }

  /**
   * Create a new release
   */
  createRelease(
    versionString: string,
    notes: ReleaseNotes,
    artifacts: Map<string, Buffer>
  ): Release {
    const versionObject = this.parseVersion(versionString);

    const release: Release = {
      id: `release-${Date.now()}`,
      version: versionString,
      versionObject,
      timestamp: new Date(),
      gitTag: `v${versionString}`,
      notes,
      status: 'DRAFT',
      artifacts,
      checksum: this.calculateChecksum(artifacts),
      publishedTo: [],
    };

    this.releases.set(release.id, release);
    this.versions.push(versionObject);
    this.currentVersion = versionObject;

    return release;
  }

  /**
   * Prepare release for publishing
   */
  prepareRelease(releaseId: string): Release {
    const release = this.releases.get(releaseId);
    if (!release) {
      throw new Error('Release not found');
    }

    if (release.status !== 'DRAFT') {
      throw new Error(`Cannot prepare release with status: ${release.status}`);
    }

    // Validate release
    this.validateRelease(release);

    release.status = 'READY';
    return release;
  }

  /**
   * Validate release before publishing
   */
  private validateRelease(release: Release): void {
    // Check that version doesn't already exist
    const existingVersion = Array.from(this.releases.values()).find(
      (r) => r.version === release.version && r.id !== release.id
    );
    if (existingVersion) {
      throw new Error(`Version ${release.version} already exists`);
    }

    // Validate release notes
    if (!release.notes.features && !release.notes.bugFixes) {
      console.warn('Warning: Release has no features or bug fixes documented');
    }

    // Ensure artifacts exist
    if (release.artifacts.size === 0) {
      throw new Error('Release must contain at least one artifact');
    }
  }

  /**
   * Publish release to a registry
   */
  async publishRelease(releaseId: string, registry: string): Promise<Release> {
    const release = this.releases.get(releaseId);
    if (!release) {
      throw new Error('Release not found');
    }

    if (release.status !== 'READY') {
      throw new Error(`Cannot publish release with status: ${release.status}`);
    }

    try {
      // Simulate publishing
      if (registry === 'npm') {
        await this.publishToNpm(release);
      } else if (registry === 'kpm') {
        await this.publishToKpm(release);
      } else if (registry === 'github') {
        await this.publishToGitHub(release);
      } else {
        throw new Error(`Unknown registry: ${registry}`);
      }

      if (!release.publishedTo.includes(registry)) {
        release.publishedTo.push(registry);
      }

      // Update changelog
      this.changelog.entries.push(release.notes);
      this.changelog.lastUpdated = new Date();

      return release;
    } catch (error) {
      throw new Error(`Failed to publish to ${registry}: ${error}`);
    }
  }

  /**
   * Publish to npm registry
   */
  private async publishToNpm(release: Release): Promise<void> {
    // Simplified implementation - in real world, would use npm CLI
    console.log(`Publishing ${release.version} to npm...`);
    // Validate package.json exists
    const hasPackageJson = Array.from(release.artifacts.keys()).some((k) => k === 'package.json');
    if (!hasPackageJson) {
      throw new Error('package.json not found in artifacts');
    }
  }

  /**
   * Publish to KPM registry
   */
  private async publishToKpm(release: Release): Promise<void> {
    // Simplified implementation
    console.log(`Publishing ${release.version} to KPM...`);
    // Create KPM registry entry
    if (release.artifacts.size === 0) {
      throw new Error('No artifacts to publish to KPM');
    }
  }

  /**
   * Publish to GitHub Releases
   */
  private async publishToGitHub(release: Release): Promise<void> {
    // Simplified implementation
    console.log(`Creating GitHub release ${release.version}...`);
    // Generate release notes for GitHub
    if (!release.gitTag) {
      throw new Error('Git tag not set');
    }
  }

  /**
   * Generate CHANGELOG.md
   */
  generateChangelog(): string {
    let markdown = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';

    for (const release of this.changelog.entries) {
      markdown += `## [${release.version}] - ${release.releaseDate.toISOString().split('T')[0]}\n\n`;

      if (release.features.length > 0) {
        markdown += '### Added\n';
        for (const feature of release.features) {
          markdown += `- ${feature}\n`;
        }
        markdown += '\n';
      }

      if (release.bugFixes.length > 0) {
        markdown += '### Fixed\n';
        for (const fix of release.bugFixes) {
          markdown += `- ${fix}\n`;
        }
        markdown += '\n';
      }

      if (release.breakingChanges.length > 0) {
        markdown += '### Changed\n';
        for (const change of release.breakingChanges) {
          markdown += `- ${change}\n`;
        }
        markdown += '\n';
      }

      if (release.deprecations.length > 0) {
        markdown += '### Deprecated\n';
        for (const dep of release.deprecations) {
          markdown += `- ${dep}\n`;
        }
        markdown += '\n';
      }

      if (release.knownIssues.length > 0) {
        markdown += '### Known Issues\n';
        for (const issue of release.knownIssues) {
          markdown += `- ${issue}\n`;
        }
        markdown += '\n';
      }
    }

    return markdown;
  }

  /**
   * Get release by ID
   */
  getRelease(releaseId: string): Release | undefined {
    return this.releases.get(releaseId);
  }

  /**
   * Get release by version
   */
  getReleaseByVersion(version: string): Release | undefined {
    for (const release of this.releases.values()) {
      if (release.version === version) {
        return release;
      }
    }
    return undefined;
  }

  /**
   * List all releases
   */
  listReleases(limit: number = 10): Release[] {
    return Array.from(this.releases.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get release statistics
   */
  getReleaseStats(): {
    totalReleases: number;
    publishedReleases: number;
    draftReleases: number;
    currentVersion: string;
    registries: Map<string, number>;
  } {
    const totalReleases = this.releases.size;
    const publishedReleases = Array.from(this.releases.values()).filter((r) => r.status === 'PUBLISHED')
      .length;
    const draftReleases = Array.from(this.releases.values()).filter((r) => r.status === 'DRAFT').length;
    const currentVersion = this.versionToString(this.currentVersion);

    const registries = new Map<string, number>();
    for (const release of this.releases.values()) {
      for (const registry of release.publishedTo) {
        registries.set(registry, (registries.get(registry) || 0) + 1);
      }
    }

    return {
      totalReleases,
      publishedReleases,
      draftReleases,
      currentVersion,
      registries,
    };
  }

  /**
   * Calculate checksum for artifacts
   */
  private calculateChecksum(artifacts: Map<string, Buffer>): string {
    let data = '';
    for (const [filename] of artifacts) {
      data += filename;
    }
    return Buffer.from(data).toString('hex').substring(0, 16);
  }

  /**
   * Get version history
   */
  getVersionHistory(): ReleaseVersion[] {
    return this.versions.sort((a, b) => {
      const aCompare = [a.major, a.minor, a.patch].join('.');
      const bCompare = [b.major, b.minor, b.patch].join('.');
      return aCompare.localeCompare(bCompare);
    });
  }
}
