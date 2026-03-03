/**
 * Semantic versioning support for FreeLang packages
 *
 * Supports semver format: major.minor.patch
 * Range operators: ^, ~, =, >=, >
 *
 * Examples:
 *   ^1.2.3  - Caret: >=1.2.3 <2.0.0
 *   ~1.2.3  - Tilde: >=1.2.3 <1.3.0
 *   1.2.3   - Exact: 1.2.3
 *   >=1.2.3 - Greater than or equal
 *   >1.2.3  - Greater than
 */

/**
 * Parsed semantic version
 */
export interface Version {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

/**
 * Version range specification
 */
export interface VersionRange {
  operator: '^' | '~' | '=' | '>=' | '>';
  version: Version;
  raw: string;
}

/**
 * Semantic versioning utilities
 */
export class SemverUtil {
  /**
   * Parse version string to Version object
   *
   * @param versionStr - Version string (e.g., "1.2.3")
   * @returns Parsed Version object
   * @throws Error if version format is invalid
   */
  public static parse(versionStr: string): Version {
    const trimmed = versionStr.trim();
    const match = trimmed.match(/^(\d+)\.(\d+)\.(\d+)$/);

    if (!match) {
      throw new Error(
        `Invalid version format: ${versionStr}\n` +
        `Expected format: major.minor.patch (e.g., 1.0.0)`
      );
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      raw: versionStr,
    };
  }

  /**
   * Parse version range string to VersionRange object
   *
   * Supports operators:
   * - ^ (caret): ^1.2.3 → >=1.2.3 <2.0.0
   * - ~ (tilde): ~1.2.3 → >=1.2.3 <1.3.0
   * - = (exact): 1.2.3 → exactly 1.2.3
   * - >= (gte): >=1.2.3 → version >= 1.2.3
   * - > (gt): >1.2.3 → version > 1.2.3
   *
   * @param rangeStr - Version range string
   * @returns Parsed VersionRange object
   * @throws Error if range format is invalid
   */
  public static parseRange(rangeStr: string): VersionRange {
    const trimmed = rangeStr.trim();
    let operator: VersionRange['operator'] = '=';
    let versionStr = trimmed;

    // Extract operator
    if (trimmed.startsWith('>=')) {
      operator = '>=';
      versionStr = trimmed.slice(2);
    } else if (trimmed.startsWith('>')) {
      operator = '>';
      versionStr = trimmed.slice(1);
    } else if (trimmed.startsWith('^')) {
      operator = '^';
      versionStr = trimmed.slice(1);
    } else if (trimmed.startsWith('~')) {
      operator = '~';
      versionStr = trimmed.slice(1);
    } else if (trimmed.startsWith('=')) {
      operator = '=';
      versionStr = trimmed.slice(1);
    }

    // Parse version part
    const version = this.parse(versionStr.trim());

    return {
      operator,
      version,
      raw: rangeStr,
    };
  }

  /**
   * Check if version satisfies the given range
   *
   * @param version - Version to check
   * @param range - Version range
   * @returns true if version satisfies range
   */
  public static satisfies(version: Version, range: VersionRange): boolean {
    switch (range.operator) {
      case '=':
        // Exact match
        return this.equals(version, range.version);

      case '^':
        // Caret: ^1.2.3 means >=1.2.3 <2.0.0
        // Allows patch and minor updates within same major version
        return (
          version.major === range.version.major &&
          this.gte(version, range.version)
        );

      case '~':
        // Tilde: ~1.2.3 means >=1.2.3 <1.3.0
        // Allows only patch updates within same major.minor version
        return (
          version.major === range.version.major &&
          version.minor === range.version.minor &&
          version.patch >= range.version.patch
        );

      case '>=':
        // Greater than or equal
        return this.gte(version, range.version);

      case '>':
        // Greater than
        return this.gt(version, range.version);

      default:
        return false;
    }
  }

  /**
   * Check if v1 >= v2
   *
   * @param v1 - First version
   * @param v2 - Second version
   * @returns true if v1 >= v2
   */
  public static gte(v1: Version, v2: Version): boolean {
    if (v1.major !== v2.major) {
      return v1.major > v2.major;
    }
    if (v1.minor !== v2.minor) {
      return v1.minor > v2.minor;
    }
    return v1.patch >= v2.patch;
  }

  /**
   * Check if v1 > v2
   *
   * @param v1 - First version
   * @param v2 - Second version
   * @returns true if v1 > v2
   */
  public static gt(v1: Version, v2: Version): boolean {
    if (v1.major !== v2.major) {
      return v1.major > v2.major;
    }
    if (v1.minor !== v2.minor) {
      return v1.minor > v2.minor;
    }
    return v1.patch > v2.patch;
  }

  /**
   * Check if v1 == v2
   *
   * @param v1 - First version
   * @param v2 - Second version
   * @returns true if v1 == v2
   */
  public static equals(v1: Version, v2: Version): boolean {
    return (
      v1.major === v2.major &&
      v1.minor === v2.minor &&
      v1.patch === v2.patch
    );
  }

  /**
   * Check if v1 < v2
   *
   * @param v1 - First version
   * @param v2 - Second version
   * @returns true if v1 < v2
   */
  public static lt(v1: Version, v2: Version): boolean {
    if (v1.major !== v2.major) {
      return v1.major < v2.major;
    }
    if (v1.minor !== v2.minor) {
      return v1.minor < v2.minor;
    }
    return v1.patch < v2.patch;
  }

  /**
   * Check if v1 <= v2
   *
   * @param v1 - First version
   * @param v2 - Second version
   * @returns true if v1 <= v2
   */
  public static lte(v1: Version, v2: Version): boolean {
    return this.lt(v1, v2) || this.equals(v1, v2);
  }

  /**
   * Get next major version
   *
   * @param version - Current version
   * @returns Version with incremented major number
   */
  public static nextMajor(version: Version): Version {
    return {
      major: version.major + 1,
      minor: 0,
      patch: 0,
      raw: `${version.major + 1}.0.0`,
    };
  }

  /**
   * Get next minor version
   *
   * @param version - Current version
   * @returns Version with incremented minor number
   */
  public static nextMinor(version: Version): Version {
    return {
      major: version.major,
      minor: version.minor + 1,
      patch: 0,
      raw: `${version.major}.${version.minor + 1}.0`,
    };
  }

  /**
   * Get next patch version
   *
   * @param version - Current version
   * @returns Version with incremented patch number
   */
  public static nextPatch(version: Version): Version {
    return {
      major: version.major,
      minor: version.minor,
      patch: version.patch + 1,
      raw: `${version.major}.${version.minor}.${version.patch + 1}`,
    };
  }

  /**
   * Compare two versions
   *
   * @param v1 - First version
   * @param v2 - Second version
   * @returns -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
   */
  public static compare(v1: Version, v2: Version): -1 | 0 | 1 {
    if (this.lt(v1, v2)) return -1;
    if (this.equals(v1, v2)) return 0;
    return 1;
  }

  /**
   * Format version to string
   *
   * @param version - Version to format
   * @returns Version string (e.g., "1.2.3")
   */
  public static format(version: Version): string {
    return `${version.major}.${version.minor}.${version.patch}`;
  }

  /**
   * Format range to string
   *
   * @param range - Range to format
   * @returns Range string (e.g., "^1.2.3")
   */
  public static formatRange(range: VersionRange): string {
    const operator = range.operator === '=' ? '' : range.operator;
    return `${operator}${this.format(range.version)}`;
  }
}
