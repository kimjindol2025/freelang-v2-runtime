/**
 * Phase 17: Semantic Versioning (SemVer) Handler
 * Parses and compares semantic versions according to semver.org
 */

/**
 * Parsed semantic version
 */
export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
  metadata: string[];
  raw: string;
}

/**
 * Version range specification (npm-style)
 */
export interface VersionRange {
  operator: '^' | '~' | '>' | '>=' | '<' | '<=' | '=' | '*' | '';
  version: string;
  parsed?: SemanticVersion;
}

/**
 * Semantic versioning parser and comparator
 */
export class SemVer {
  /**
   * Parse a semantic version string
   * @param versionString - version string (e.g., "1.2.3", "1.2.3-alpha.1")
   * @returns parsed semantic version
   */
  static parse(versionString: string): SemanticVersion {
    const raw = versionString.trim();

    // Extract prerelease and metadata
    let version = raw;
    let prerelease: string[] = [];
    let metadata: string[] = [];

    // Metadata (e.g., +build.123)
    const metadataMatch = version.match(/\+(.+)$/);
    if (metadataMatch) {
      metadata = metadataMatch[1].split('.');
      version = version.substring(0, metadataMatch.index);
    }

    // Prerelease (e.g., -alpha.1)
    const prereleaseMatch = version.match(/-(.+)$/);
    if (prereleaseMatch) {
      prerelease = prereleaseMatch[1].split('.');
      version = version.substring(0, prereleaseMatch.index);
    }

    // Core version (major.minor.patch)
    const versionMatch = version.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
    if (!versionMatch) {
      throw new Error(`Invalid semantic version: ${raw}`);
    }

    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2] || '0', 10);
    const patch = parseInt(versionMatch[3] || '0', 10);

    return { major, minor, patch, prerelease, metadata, raw };
  }

  /**
   * Parse a version range specifier (npm-style)
   * @param rangeString - range string (e.g., "^1.2.3", "~1.2.3", ">=1.0.0")
   * @returns parsed version range
   */
  static parseRange(rangeString: string): VersionRange {
    const trimmed = rangeString.trim();

    // Match operator and version
    const match = trimmed.match(/^([\^~><=!*]*)(.+)$/);
    if (!match) {
      throw new Error(`Invalid version range: ${rangeString}`);
    }

    const operator = (match[1] || '') as any;
    const versionPart = match[2].trim();

    // Handle wildcards
    if (versionPart === '*' || versionPart === 'latest') {
      return { operator: '*', version: versionPart };
    }

    try {
      const parsed = this.parse(versionPart);
      return { operator, version: versionPart, parsed };
    } catch (error) {
      throw new Error(`Invalid version in range ${rangeString}: ${error}`);
    }
  }

  /**
   * Compare two semantic versions
   * @param a - first version
   * @param b - second version
   * @returns -1 if a < b, 0 if a == b, 1 if a > b
   */
  static compare(a: SemanticVersion, b: SemanticVersion): number {
    // Compare major.minor.patch
    if (a.major !== b.major) return a.major < b.major ? -1 : 1;
    if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
    if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;

    // Version with prerelease is less than without
    if (a.prerelease.length !== b.prerelease.length) {
      return a.prerelease.length === 0 ? 1 : -1;
    }

    // Compare prerelease versions
    for (let i = 0; i < a.prerelease.length; i++) {
      const aPart = a.prerelease[i];
      const bPart = b.prerelease[i];

      // Numeric parts
      const aNum = parseInt(aPart, 10);
      const bNum = parseInt(bPart, 10);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        if (aNum !== bNum) return aNum < bNum ? -1 : 1;
      } else {
        // String comparison
        if (aPart !== bPart) return aPart < bPart ? -1 : 1;
      }
    }

    return 0;
  }

  /**
   * Check if version satisfies a range
   * @param version - version to check
   * @param range - version range
   * @returns true if version satisfies range
   */
  static satisfies(version: string | SemanticVersion, range: string | VersionRange): boolean {
    const ver = typeof version === 'string' ? this.parse(version) : version;
    const rng = typeof range === 'string' ? this.parseRange(range) : range;

    // Handle wildcards
    if (rng.operator === '*') {
      return true; // Accept any version
    }

    if (!rng.parsed) {
      throw new Error(`Cannot evaluate satisfies without parsed range: ${rng.version}`);
    }

    const rangeVer = rng.parsed;

    switch (rng.operator) {
      case '^': // ^1.2.3 => >=1.2.3 <2.0.0
        if (ver.major !== rangeVer.major) {
          return false;
        }
        return this.compare(ver, rangeVer) >= 0;

      case '~': // ~1.2.3 => >=1.2.3 <1.3.0
        if (ver.major !== rangeVer.major || ver.minor !== rangeVer.minor) {
          return false;
        }
        return this.compare(ver, rangeVer) >= 0;

      case '>':
        return this.compare(ver, rangeVer) > 0;

      case '>=':
        return this.compare(ver, rangeVer) >= 0;

      case '<':
        return this.compare(ver, rangeVer) < 0;

      case '<=':
        return this.compare(ver, rangeVer) <= 0;

      case '=':
      case '':
        return this.compare(ver, rangeVer) === 0;

      default:
        throw new Error(`Unknown operator: ${rng.operator}`);
    }
  }

  /**
   * Find highest version that satisfies range
   * @param versions - array of versions to choose from
   * @param range - version range
   * @returns highest version that satisfies, or null if none
   */
  static maxSatisfying(versions: string[], range: string): string | null {
    const satisfying = versions.filter((v) => this.satisfies(v, range));

    if (satisfying.length === 0) {
      return null;
    }

    satisfying.sort((a, b) => {
      const parsed_a = this.parse(a);
      const parsed_b = this.parse(b);
      return this.compare(parsed_a, parsed_b);
    });

    return satisfying[satisfying.length - 1];
  }

  /**
   * Check if version is stable (no prerelease)
   * @param version - version to check
   * @returns true if stable
   */
  static isStable(version: string | SemanticVersion): boolean {
    const ver = typeof version === 'string' ? this.parse(version) : version;
    return ver.prerelease.length === 0;
  }

  /**
   * Get version bump level
   * @param from - current version
   * @param to - new version
   * @returns 'major' | 'minor' | 'patch' | 'prerelease' | 'none'
   */
  static getBumpLevel(
    from: string | SemanticVersion,
    to: string | SemanticVersion
  ): 'major' | 'minor' | 'patch' | 'prerelease' | 'none' {
    const fromVer = typeof from === 'string' ? this.parse(from) : from;
    const toVer = typeof to === 'string' ? this.parse(to) : to;

    if (toVer.major > fromVer.major) return 'major';
    if (toVer.minor > fromVer.minor) return 'minor';
    if (toVer.patch > fromVer.patch) return 'patch';
    if (toVer.prerelease.length > 0) return 'prerelease';
    return 'none';
  }

  /**
   * Format semantic version
   * @param ver - version to format
   * @returns formatted version string
   */
  static stringify(ver: SemanticVersion): string {
    let str = `${ver.major}.${ver.minor}.${ver.patch}`;

    if (ver.prerelease.length > 0) {
      str += `-${ver.prerelease.join('.')}`;
    }

    if (ver.metadata.length > 0) {
      str += `+${ver.metadata.join('.')}`;
    }

    return str;
  }
}

/**
 * Helper function to check if version satisfies range
 * @param version - version string
 * @param range - range string
 * @returns true if satisfies
 */
export function satisfiesSemver(version: string, range: string): boolean {
  return SemVer.satisfies(version, range);
}

/**
 * Helper function to parse version
 * @param versionString - version string
 * @returns parsed semantic version
 */
export function parseSemver(versionString: string): SemanticVersion {
  return SemVer.parse(versionString);
}

/**
 * Helper function to compare versions
 * @param a - first version
 * @param b - second version
 * @returns -1, 0, or 1
 */
export function compareSemver(a: string, b: string): number {
  return SemVer.compare(SemVer.parse(a), SemVer.parse(b));
}
