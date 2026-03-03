import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PackageResolver } from '../src/package/package-resolver';
import { ManifestLoader } from '../src/package/manifest';

describe('Phase 5 Step 3: Package Resolver', () => {
  let tempDir: string;
  let flModulesDir: string;
  let resolver: PackageResolver;

  beforeEach(() => {
    // Create temporary directory structure
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freelang-pkg-test-'));
    flModulesDir = path.join(tempDir, 'fl_modules');
    fs.mkdirSync(flModulesDir, { recursive: true });

    resolver = new PackageResolver(tempDir);
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to create a package in fl_modules
   */
  function createPackage(
    name: string,
    version: string,
    dependencies?: Record<string, string>
  ): void {
    const pkgDir = path.join(flModulesDir, name);
    const srcDir = path.join(pkgDir, 'src');

    fs.mkdirSync(srcDir, { recursive: true });

    const manifest = {
      name,
      version,
      main: './src/index.fl',
      dependencies: dependencies || {},
    };

    fs.writeFileSync(
      path.join(pkgDir, 'freelang.json'),
      JSON.stringify(manifest, null, 2)
    );

    fs.writeFileSync(
      path.join(srcDir, 'index.fl'),
      `// ${name} v${version}\nexport fn api() { return "${name}" }`
    );
  }

  describe('1️⃣ Package Resolution', () => {
    it('should resolve package name to path', () => {
      createPackage('math-lib', '1.2.0');

      const resolved = resolver.resolve('math-lib');

      expect(resolved.name).toBe('math-lib');
      expect(resolved.version).toBe('1.2.0');
      expect(resolved.path).toBe(path.join(flModulesDir, 'math-lib'));
      expect(resolved.main).toBe(
        path.join(flModulesDir, 'math-lib', 'src', 'index.fl')
      );
    });

    it('should load package manifest', () => {
      createPackage('utils', '2.0.0');

      const resolved = resolver.resolve('utils');

      expect(resolved.manifest.name).toBe('utils');
      expect(resolved.manifest.version).toBe('2.0.0');
      expect(resolved.manifest.main).toBe('./src/index.fl');
    });

    it('should throw error when package not found', () => {
      expect(() => resolver.resolve('nonexistent')).toThrow(
        "Package 'nonexistent' not found"
      );
    });

    it('should throw error when manifest is missing', () => {
      const pkgDir = path.join(flModulesDir, 'bad-pkg');
      const srcDir = path.join(pkgDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'index.fl'), '// no manifest');

      expect(() => resolver.resolve('bad-pkg')).toThrow();
    });

    it('should throw error when entry point is missing', () => {
      const pkgDir = path.join(flModulesDir, 'missing-entry');
      fs.mkdirSync(pkgDir, { recursive: true });

      const manifest = {
        name: 'missing-entry',
        version: '1.0.0',
        main: './src/index.fl',
      };

      fs.writeFileSync(
        path.join(pkgDir, 'freelang.json'),
        JSON.stringify(manifest)
      );

      expect(() => resolver.resolve('missing-entry')).toThrow();
    });
  });

  describe('2️⃣ Version Range Validation', () => {
    it('should satisfy caret range', () => {
      createPackage('lib', '1.2.3');

      const resolved = resolver.resolve('lib', '^1.2.0');

      expect(resolved.version).toBe('1.2.3');
    });

    it('should satisfy tilde range', () => {
      createPackage('lib', '2.1.5');

      const resolved = resolver.resolve('lib', '~2.1.0');

      expect(resolved.version).toBe('2.1.5');
    });

    it('should throw error on version mismatch', () => {
      createPackage('lib', '1.0.0');

      expect(() => resolver.resolve('lib', '^2.0.0')).toThrow(
        'does not satisfy'
      );
    });

    it('should resolve exact version', () => {
      createPackage('lib', '3.0.0');

      const resolved = resolver.resolve('lib', '3.0.0');

      expect(resolved.version).toBe('3.0.0');
    });

    it('should throw error on exact version mismatch', () => {
      createPackage('lib', '1.5.0');

      expect(() => resolver.resolve('lib', '2.0.0')).toThrow();
    });

    it('should handle >= and > operators', () => {
      createPackage('lib', '1.5.0');

      const resolved1 = resolver.resolve('lib', '>=1.0.0');
      expect(resolved1.version).toBe('1.5.0');

      const resolved2 = resolver.resolve('lib', '>1.0.0');
      expect(resolved2.version).toBe('1.5.0');
    });
  });

  describe('3️⃣ Import Path Resolution', () => {
    it('should resolve file-based import (relative)', () => {
      const fromFile = path.join(tempDir, 'src', 'app.fl');
      const importPath = './math.fl';

      fs.mkdirSync(path.dirname(fromFile), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });

      const mathFile = path.join(tempDir, 'src', 'math.fl');
      fs.writeFileSync(mathFile, '// math module');

      const resolved = resolver.resolveImport(fromFile, importPath);

      expect(resolved).toBe(mathFile);
    });

    it('should resolve file-based import (parent directory)', () => {
      const fromFile = path.join(tempDir, 'src', 'sub', 'app.fl');
      const importPath = '../utils.fl';

      fs.mkdirSync(path.dirname(fromFile), { recursive: true });

      const utilsFile = path.join(tempDir, 'src', 'utils.fl');
      fs.writeFileSync(utilsFile, '// utils module');

      const resolved = resolver.resolveImport(fromFile, importPath);

      expect(resolved).toBe(utilsFile);
    });

    it('should resolve package-based import', () => {
      const fromFile = path.join(tempDir, 'src', 'app.fl');
      createPackage('math-lib', '1.0.0');

      fs.mkdirSync(path.dirname(fromFile), { recursive: true });

      const resolved = resolver.resolveImport(fromFile, 'math-lib');

      expect(resolved).toBe(
        path.join(flModulesDir, 'math-lib', 'src', 'index.fl')
      );
    });

    it('should resolve package-based import with version', () => {
      const fromFile = path.join(tempDir, 'src', 'app.fl');
      const manifest = {
        name: 'app',
        version: '1.0.0',
        dependencies: {
          'utils': '^2.0.0',
        },
      };

      createPackage('utils', '2.1.0');
      fs.mkdirSync(path.dirname(fromFile), { recursive: true });

      const resolved = resolver.resolveImport(fromFile, 'utils', manifest);

      expect(resolved).toBe(
        path.join(flModulesDir, 'utils', 'src', 'index.fl')
      );
    });

    it('should handle .fl extension automatically', () => {
      const fromFile = path.join(tempDir, 'src', 'app.fl');
      const mathFile = path.join(tempDir, 'src', 'math.fl');

      fs.mkdirSync(path.dirname(fromFile), { recursive: true });
      fs.writeFileSync(mathFile, '// math');

      const resolved = resolver.resolveImport(fromFile, './math.fl');

      expect(resolved).toBe(mathFile);
    });

    it('should throw error on package not found', () => {
      const fromFile = path.join(tempDir, 'src', 'app.fl');
      fs.mkdirSync(path.dirname(fromFile), { recursive: true });

      expect(() => resolver.resolveImport(fromFile, 'missing')).toThrow(
        'Cannot resolve import'
      );
    });
  });

  describe('4️⃣ Package Listing and Discovery', () => {
    it('should list installed packages', () => {
      createPackage('math-lib', '1.0.0');
      createPackage('utils', '2.0.0');
      createPackage('string-helpers', '1.5.0');

      const packages = resolver.getInstalledPackages();

      expect(packages).toContain('math-lib');
      expect(packages).toContain('utils');
      expect(packages).toContain('string-helpers');
      expect(packages.length).toBe(3);
    });

    it('should return empty list if no packages installed', () => {
      const packages = resolver.getInstalledPackages();

      expect(packages).toEqual([]);
    });

    it('should find package by fuzzy match', () => {
      createPackage('math-lib', '1.0.0');
      createPackage('math-utils', '2.0.0');
      createPackage('string-helpers', '1.5.0');

      const found = resolver.findPackage('math');

      expect(found).toContain('math-lib');
      expect(found).toContain('math-utils');
      expect(found).not.toContain('string-helpers');
    });

    it('should check if package is installed', () => {
      createPackage('lib', '1.5.0');

      expect(resolver.hasPackage('lib')).toBe(true);
      expect(resolver.hasPackage('missing')).toBe(false);
    });

    it('should check if package satisfies version range', () => {
      createPackage('lib', '1.5.0');

      expect(resolver.hasPackage('lib', '^1.0.0')).toBe(true);
      expect(resolver.hasPackage('lib', '^2.0.0')).toBe(false);
    });
  });

  describe('5️⃣ Caching', () => {
    it('should cache resolved packages', () => {
      createPackage('lib', '1.0.0');

      const resolved1 = resolver.resolve('lib');
      const resolved2 = resolver.resolve('lib');

      expect(resolved1).toEqual(resolved2);
      expect(resolver.getCacheStats().size).toBe(1);
    });

    it('should maintain separate cache entries for different versions', () => {
      createPackage('lib', '1.0.0');

      resolver.resolve('lib', '^1.0.0');
      resolver.resolve('lib', '1.0.0');

      expect(resolver.getCacheStats().size).toBe(2);
    });

    it('should clear cache', () => {
      createPackage('lib', '1.0.0');

      resolver.resolve('lib');
      expect(resolver.getCacheStats().size).toBe(1);

      resolver.clearCache();
      expect(resolver.getCacheStats().size).toBe(0);
    });

    it('should still work after cache clear', () => {
      createPackage('lib', '1.0.0');

      resolver.resolve('lib');
      resolver.clearCache();

      const resolved = resolver.resolve('lib');
      expect(resolved.name).toBe('lib');
    });
  });

  describe('6️⃣ Utility Methods', () => {
    it('should get package dependencies', () => {
      createPackage('lib', '1.0.0', {
        'dep1': '1.0.0',
        'dep2': '2.0.0',
      });

      const deps = resolver.getPackageDependencies('lib');

      expect(deps).toEqual({
        'dep1': '1.0.0',
        'dep2': '2.0.0',
      });
    });

    it('should return empty dependencies for missing package', () => {
      const deps = resolver.getPackageDependencies('missing');

      expect(deps).toEqual({});
    });

    it('should get installed package info', () => {
      createPackage('lib', '1.5.0');

      const info = resolver.getInstalledPackageInfo('lib');

      expect(info).not.toBeNull();
      expect(info!.version).toBe('1.5.0');
    });

    it('should return null for missing package info', () => {
      const info = resolver.getInstalledPackageInfo('missing');

      expect(info).toBeNull();
    });

    it('should get project root', () => {
      expect(resolver.getProjectRoot()).toBe(tempDir);
    });

    it('should get modules directory', () => {
      expect(resolver.getModulesDir()).toBe(flModulesDir);
    });

    it('should check if modules directory exists', () => {
      expect(resolver.hasModulesDir()).toBe(true);

      fs.rmSync(flModulesDir, { recursive: true });
      expect(resolver.hasModulesDir()).toBe(false);
    });
  });

  describe('7️⃣ Dependency Chain Resolution', () => {
    it('should resolve simple dependency chain', () => {
      createPackage('a', '1.0.0', { 'b': '1.0.0' });
      createPackage('b', '1.0.0', { 'c': '1.0.0' });
      createPackage('c', '1.0.0');

      const chain = resolver.resolveDependencyChain('a');

      expect(chain.length).toBeGreaterThan(0);
      expect(chain[0].name).toBe('a');
    });

    it('should handle circular dependencies gracefully', () => {
      createPackage('a', '1.0.0', { 'b': '1.0.0' });
      createPackage('b', '1.0.0', { 'a': '1.0.0' });

      // Should not throw, just handle gracefully
      const chain = resolver.resolveDependencyChain('a', 5);

      expect(chain.length).toBeGreaterThan(0);
    });

    it('should respect depth limit', () => {
      createPackage('a', '1.0.0', { 'b': '1.0.0' });
      createPackage('b', '1.0.0', { 'c': '1.0.0' });
      createPackage('c', '1.0.0', { 'd': '1.0.0' });
      createPackage('d', '1.0.0');

      const chain = resolver.resolveDependencyChain('a', 2);

      expect(chain.length).toBeLessThanOrEqual(3);
    });
  });

  describe('8️⃣ Real-World Scenarios', () => {
    it('should handle complex project structure', () => {
      // Project dependencies
      const projectManifest = {
        name: 'my-app',
        version: '1.0.0',
        dependencies: {
          'math-lib': '^1.2.0',
          'utils': '~2.0.0',
        },
      };

      // Create packages
      createPackage('math-lib', '1.2.5');
      createPackage('utils', '2.0.3');

      // Verify resolution
      const math = resolver.resolve('math-lib', projectManifest.dependencies['math-lib']);
      const utils = resolver.resolve('utils', projectManifest.dependencies['utils']);

      expect(math.version).toBe('1.2.5');
      expect(utils.version).toBe('2.0.3');
    });

    it('should resolve mixed imports (file + package)', () => {
      const appFile = path.join(tempDir, 'src', 'app.fl');
      const manifest = {
        name: 'my-app',
        version: '1.0.0',
        dependencies: { 'lib': '1.0.0' },
      };

      createPackage('lib', '1.0.0');
      fs.mkdirSync(path.dirname(appFile), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'src', 'local.fl'), '// local');

      // File-based import
      const local = resolver.resolveImport(appFile, './local.fl');
      expect(fs.existsSync(local)).toBe(true);

      // Package-based import
      const lib = resolver.resolveImport(appFile, 'lib', manifest);
      expect(lib).toContain('lib');
    });

    it('should handle package updates', () => {
      createPackage('lib', '1.0.0');

      // Old version
      const v1 = resolver.resolve('lib');
      expect(v1.version).toBe('1.0.0');

      // Clear cache and update
      resolver.clearCache();
      fs.rmSync(path.join(flModulesDir, 'lib'), { recursive: true });
      createPackage('lib', '1.1.0');

      // New version
      const v2 = resolver.resolve('lib');
      expect(v2.version).toBe('1.1.0');
    });
  });
});
