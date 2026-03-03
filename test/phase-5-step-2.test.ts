import { SemverUtil, Version, VersionRange } from '../src/package/semver';

describe('Phase 5 Step 2: Semantic Versioning', () => {
  describe('1️⃣ Parse Version', () => {
    it('should parse valid version string', () => {
      const version = SemverUtil.parse('1.2.3');

      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
      expect(version.raw).toBe('1.2.3');
    });

    it('should parse version with leading zeros', () => {
      const version = SemverUtil.parse('01.02.03');

      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
    });

    it('should parse version with whitespace', () => {
      const version = SemverUtil.parse('  1.2.3  ');

      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
    });

    it('should throw error on invalid format', () => {
      expect(() => SemverUtil.parse('1.0')).toThrow('Invalid version format');
      expect(() => SemverUtil.parse('1.0.0.0')).toThrow('Invalid version format');
      expect(() => SemverUtil.parse('a.b.c')).toThrow('Invalid version format');
      expect(() => SemverUtil.parse('1.0.0-alpha')).toThrow('Invalid version format');
    });

    it('should handle zero versions', () => {
      const version = SemverUtil.parse('0.0.0');

      expect(version.major).toBe(0);
      expect(version.minor).toBe(0);
      expect(version.patch).toBe(0);
    });

    it('should handle large version numbers', () => {
      const version = SemverUtil.parse('999.888.777');

      expect(version.major).toBe(999);
      expect(version.minor).toBe(888);
      expect(version.patch).toBe(777);
    });
  });

  describe('2️⃣ Parse Version Range', () => {
    it('should parse exact version range', () => {
      const range = SemverUtil.parseRange('1.2.3');

      expect(range.operator).toBe('=');
      expect(range.version.major).toBe(1);
      expect(range.version.minor).toBe(2);
      expect(range.version.patch).toBe(3);
    });

    it('should parse caret range', () => {
      const range = SemverUtil.parseRange('^1.2.3');

      expect(range.operator).toBe('^');
      expect(range.version.major).toBe(1);
      expect(range.version.minor).toBe(2);
      expect(range.version.patch).toBe(3);
    });

    it('should parse tilde range', () => {
      const range = SemverUtil.parseRange('~1.2.3');

      expect(range.operator).toBe('~');
      expect(range.version.major).toBe(1);
      expect(range.version.minor).toBe(2);
      expect(range.version.patch).toBe(3);
    });

    it('should parse greater than or equal range', () => {
      const range = SemverUtil.parseRange('>=1.2.3');

      expect(range.operator).toBe('>=');
      expect(range.version.major).toBe(1);
    });

    it('should parse greater than range', () => {
      const range = SemverUtil.parseRange('>1.2.3');

      expect(range.operator).toBe('>');
      expect(range.version.major).toBe(1);
    });

    it('should parse explicit equal range', () => {
      const range = SemverUtil.parseRange('=1.2.3');

      expect(range.operator).toBe('=');
      expect(range.version.major).toBe(1);
    });

    it('should handle whitespace in range', () => {
      const range = SemverUtil.parseRange('  ^1.2.3  ');

      expect(range.operator).toBe('^');
      expect(range.version.major).toBe(1);
    });

    it('should throw error on invalid range format', () => {
      expect(() => SemverUtil.parseRange('^1.0')).toThrow();
      expect(() => SemverUtil.parseRange('@1.2.3')).toThrow();
    });
  });

  describe('3️⃣ Caret Range (^1.2.3 → >=1.2.3 <2.0.0)', () => {
    it('should satisfy caret range with patch update', () => {
      const version = SemverUtil.parse('1.2.5');
      const range = SemverUtil.parseRange('^1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(true);
    });

    it('should satisfy caret range with minor update', () => {
      const version = SemverUtil.parse('1.5.0');
      const range = SemverUtil.parseRange('^1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(true);
    });

    it('should satisfy caret range with exact match', () => {
      const version = SemverUtil.parse('1.2.3');
      const range = SemverUtil.parseRange('^1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(true);
    });

    it('should not satisfy caret range with major update', () => {
      const version = SemverUtil.parse('2.0.0');
      const range = SemverUtil.parseRange('^1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(false);
    });

    it('should not satisfy caret range with lower version', () => {
      const version = SemverUtil.parse('1.2.2');
      const range = SemverUtil.parseRange('^1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(false);
    });

    it('should satisfy caret zero version', () => {
      const version = SemverUtil.parse('0.1.5');
      const range = SemverUtil.parseRange('^0.1.2');

      expect(SemverUtil.satisfies(version, range)).toBe(true);
    });
  });

  describe('4️⃣ Tilde Range (~1.2.3 → >=1.2.3 <1.3.0)', () => {
    it('should satisfy tilde range with patch update', () => {
      const version = SemverUtil.parse('1.2.5');
      const range = SemverUtil.parseRange('~1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(true);
    });

    it('should satisfy tilde range with exact match', () => {
      const version = SemverUtil.parse('1.2.3');
      const range = SemverUtil.parseRange('~1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(true);
    });

    it('should not satisfy tilde range with minor update', () => {
      const version = SemverUtil.parse('1.3.0');
      const range = SemverUtil.parseRange('~1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(false);
    });

    it('should not satisfy tilde range with major update', () => {
      const version = SemverUtil.parse('2.2.3');
      const range = SemverUtil.parseRange('~1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(false);
    });

    it('should not satisfy tilde range with lower patch', () => {
      const version = SemverUtil.parse('1.2.2');
      const range = SemverUtil.parseRange('~1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(false);
    });
  });

  describe('5️⃣ Exact Version (=1.2.3)', () => {
    it('should satisfy exact match', () => {
      const version = SemverUtil.parse('1.2.3');
      const range = SemverUtil.parseRange('1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(true);
    });

    it('should not satisfy exact when patch differs', () => {
      const version = SemverUtil.parse('1.2.4');
      const range = SemverUtil.parseRange('1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(false);
    });

    it('should not satisfy exact when minor differs', () => {
      const version = SemverUtil.parse('1.3.3');
      const range = SemverUtil.parseRange('1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(false);
    });

    it('should not satisfy exact when major differs', () => {
      const version = SemverUtil.parse('2.2.3');
      const range = SemverUtil.parseRange('1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(false);
    });
  });

  describe('6️⃣ Greater Than/Equal Ranges', () => {
    it('should satisfy >= range with equal version', () => {
      const version = SemverUtil.parse('1.2.3');
      const range = SemverUtil.parseRange('>=1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(true);
    });

    it('should satisfy >= range with greater version', () => {
      const version = SemverUtil.parse('2.0.0');
      const range = SemverUtil.parseRange('>=1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(true);
    });

    it('should not satisfy >= range with lower version', () => {
      const version = SemverUtil.parse('1.2.2');
      const range = SemverUtil.parseRange('>=1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(false);
    });

    it('should satisfy > range with greater version', () => {
      const version = SemverUtil.parse('1.2.4');
      const range = SemverUtil.parseRange('>1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(true);
    });

    it('should not satisfy > range with equal version', () => {
      const version = SemverUtil.parse('1.2.3');
      const range = SemverUtil.parseRange('>1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(false);
    });

    it('should not satisfy > range with lower version', () => {
      const version = SemverUtil.parse('1.2.2');
      const range = SemverUtil.parseRange('>1.2.3');

      expect(SemverUtil.satisfies(version, range)).toBe(false);
    });
  });

  describe('7️⃣ Version Comparison', () => {
    it('should correctly compare equal versions', () => {
      const v1 = SemverUtil.parse('1.2.3');
      const v2 = SemverUtil.parse('1.2.3');

      expect(SemverUtil.equals(v1, v2)).toBe(true);
      expect(SemverUtil.gte(v1, v2)).toBe(true);
      expect(SemverUtil.gt(v1, v2)).toBe(false);
      expect(SemverUtil.lt(v1, v2)).toBe(false);
      expect(SemverUtil.lte(v1, v2)).toBe(true);
    });

    it('should correctly compare when v1 > v2', () => {
      const v1 = SemverUtil.parse('2.0.0');
      const v2 = SemverUtil.parse('1.9.9');

      expect(SemverUtil.gt(v1, v2)).toBe(true);
      expect(SemverUtil.gte(v1, v2)).toBe(true);
      expect(SemverUtil.lt(v1, v2)).toBe(false);
      expect(SemverUtil.lte(v1, v2)).toBe(false);
      expect(SemverUtil.equals(v1, v2)).toBe(false);
    });

    it('should correctly compare when v1 < v2', () => {
      const v1 = SemverUtil.parse('1.0.0');
      const v2 = SemverUtil.parse('1.1.0');

      expect(SemverUtil.lt(v1, v2)).toBe(true);
      expect(SemverUtil.lte(v1, v2)).toBe(true);
      expect(SemverUtil.gt(v1, v2)).toBe(false);
      expect(SemverUtil.gte(v1, v2)).toBe(false);
      expect(SemverUtil.equals(v1, v2)).toBe(false);
    });

    it('should compare major versions', () => {
      const v1 = SemverUtil.parse('2.0.0');
      const v2 = SemverUtil.parse('1.99.99');

      expect(SemverUtil.gt(v1, v2)).toBe(true);
    });

    it('should compare minor versions', () => {
      const v1 = SemverUtil.parse('1.2.0');
      const v2 = SemverUtil.parse('1.1.99');

      expect(SemverUtil.gt(v1, v2)).toBe(true);
    });

    it('should compare patch versions', () => {
      const v1 = SemverUtil.parse('1.0.2');
      const v2 = SemverUtil.parse('1.0.1');

      expect(SemverUtil.gt(v1, v2)).toBe(true);
    });

    it('should use compare method', () => {
      const v1 = SemverUtil.parse('1.2.3');
      const v2 = SemverUtil.parse('1.2.3');
      const v3 = SemverUtil.parse('1.2.4');
      const v4 = SemverUtil.parse('1.2.2');

      expect(SemverUtil.compare(v1, v2)).toBe(0);
      expect(SemverUtil.compare(v3, v1)).toBe(1);
      expect(SemverUtil.compare(v4, v1)).toBe(-1);
    });
  });

  describe('8️⃣ Utility Methods', () => {
    it('should get next major version', () => {
      const version = SemverUtil.parse('1.2.3');
      const next = SemverUtil.nextMajor(version);

      expect(next.major).toBe(2);
      expect(next.minor).toBe(0);
      expect(next.patch).toBe(0);
      expect(SemverUtil.format(next)).toBe('2.0.0');
    });

    it('should get next minor version', () => {
      const version = SemverUtil.parse('1.2.3');
      const next = SemverUtil.nextMinor(version);

      expect(next.major).toBe(1);
      expect(next.minor).toBe(3);
      expect(next.patch).toBe(0);
      expect(SemverUtil.format(next)).toBe('1.3.0');
    });

    it('should get next patch version', () => {
      const version = SemverUtil.parse('1.2.3');
      const next = SemverUtil.nextPatch(version);

      expect(next.major).toBe(1);
      expect(next.minor).toBe(2);
      expect(next.patch).toBe(4);
      expect(SemverUtil.format(next)).toBe('1.2.4');
    });

    it('should format version to string', () => {
      const version = SemverUtil.parse('1.2.3');

      expect(SemverUtil.format(version)).toBe('1.2.3');
    });

    it('should format range to string', () => {
      const range = SemverUtil.parseRange('^1.2.3');

      expect(SemverUtil.formatRange(range)).toBe('^1.2.3');
    });

    it('should format exact range without operator', () => {
      const range = SemverUtil.parseRange('1.2.3');

      expect(SemverUtil.formatRange(range)).toBe('1.2.3');
    });
  });

  describe('9️⃣ Real-World Scenarios', () => {
    it('should handle package dependency resolution', () => {
      const installedVersion = SemverUtil.parse('2.1.5');
      const requiredRange = SemverUtil.parseRange('^2.0.0');

      expect(SemverUtil.satisfies(installedVersion, requiredRange)).toBe(true);
    });

    it('should handle multiple constraints', () => {
      const version = SemverUtil.parse('1.5.3');

      const range1 = SemverUtil.parseRange('^1.0.0');
      const range2 = SemverUtil.parseRange('~1.5.0');

      // Version must satisfy both ranges
      expect(SemverUtil.satisfies(version, range1)).toBe(true);
      expect(SemverUtil.satisfies(version, range2)).toBe(true);
    });

    it('should handle incompatible versions', () => {
      const version = SemverUtil.parse('3.0.0');
      const range = SemverUtil.parseRange('^2.0.0');

      expect(SemverUtil.satisfies(version, range)).toBe(false);
    });

    it('should handle zero versions correctly', () => {
      const v1 = SemverUtil.parse('0.1.0');
      const v2 = SemverUtil.parse('0.1.5');

      const range = SemverUtil.parseRange('^0.1.0');

      expect(SemverUtil.satisfies(v1, range)).toBe(true);
      expect(SemverUtil.satisfies(v2, range)).toBe(true);
    });

    it('should determine appropriate package version', () => {
      const availableVersions = [
        '1.0.0',
        '1.1.0',
        '1.1.5',
        '1.2.0',
        '2.0.0',
        '2.1.0',
      ].map(v => SemverUtil.parse(v));

      const requirement = SemverUtil.parseRange('^1.1.0');

      const compatible = availableVersions.filter(v =>
        SemverUtil.satisfies(v, requirement)
      );

      // Should include 1.1.0, 1.1.5, 1.2.0 but not 2.0.0
      expect(compatible.length).toBe(3);
      expect(SemverUtil.format(compatible[0])).toBe('1.1.0');
      expect(SemverUtil.format(compatible[2])).toBe('1.2.0');
    });
  });
});
