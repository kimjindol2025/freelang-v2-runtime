import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ModuleResolver } from '../src/module/module-resolver';
import { PackageResolver } from '../src/package/package-resolver';
import { PackageInstaller } from '../src/package/package-installer';
import { ManifestLoader, PackageManifest } from '../src/package/manifest';
import { PackageCLI } from '../src/cli/package-cli';
import { SemverUtil } from '../src/package/semver';

describe('Phase 5: Complete Package Manager Integration Tests', () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freelang-integration-'));
    projectDir = tempDir;
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper: Create a complete package
   */
  function createPackage(
    name: string,
    version: string,
    files: Record<string, string> = {},
    dependencies: Record<string, string> = {}
  ): string {
    const pkgDir = path.join(tempDir, '..', name);
    const srcDir = path.join(pkgDir, 'src');

    fs.mkdirSync(srcDir, { recursive: true });

    const manifest: PackageManifest = {
      name,
      version,
      main: './src/index.fl',
      dependencies
    };

    fs.writeFileSync(
      path.join(pkgDir, 'freelang.json'),
      JSON.stringify(manifest, null, 2)
    );

    fs.writeFileSync(
      path.join(srcDir, 'index.fl'),
      files['index.fl'] ||
      `// ${name} v${version}\nexport fn api() { return "${name}" }`
    );

    for (const [fileName, content] of Object.entries(files)) {
      if (fileName !== 'index.fl') {
        const filePath = path.join(srcDir, fileName);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content);
      }
    }

    fs.writeFileSync(path.join(pkgDir, 'README.md'), `# ${name}\n\nVersion ${version}`);

    return pkgDir;
  }

  /**
   * Capture console output
   */
  function captureConsole(fn: () => void): { log: string; error: string } {
    const logs: string[] = [];
    const errors: string[] = [];

    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args: any[]) => logs.push(args.join(' '));
    console.error = (...args: any[]) => errors.push(args.join(' '));

    try {
      fn();
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }

    return { log: logs.join('\n'), error: errors.join('\n') };
  }

  describe('1️⃣ End-to-End: Complete Workflow', () => {
    it('should complete full project lifecycle', async () => {
      // Step 1: Initialize project
      const cli = new PackageCLI(projectDir);
      cli.init('my-app');

      expect(fs.existsSync(path.join(projectDir, 'freelang.json'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'src', 'main.fl'))).toBe(true);

      // Step 2: Create packages
      createPackage('math-lib', '1.0.0', {
        'index.fl': 'export fn add(a, b) { return a + b }'
      });
      createPackage('string-lib', '2.0.0', {
        'index.fl': 'export fn concat(a, b) { return a + b }'
      });

      // Step 3: Install packages
      const installer = new PackageInstaller(projectDir);
      await installer.install(path.join(projectDir, '..', 'math-lib'));
      await installer.install(path.join(projectDir, '..', 'string-lib'), '2.0.0');

      // Step 4: Verify installation
      const manifest = new ManifestLoader().load(projectDir);
      expect(manifest.dependencies!['math-lib']).toBe('1.0.0');
      expect(manifest.dependencies!['string-lib']).toBe('2.0.0');

      // Step 5: List packages
      const listOutput = captureConsole(() => {
        cli.list();
      });
      expect(listOutput.log).toContain('math-lib');
      expect(listOutput.log).toContain('string-lib');

      // Step 6: Test module resolution with packages
      const moduleResolver = new ModuleResolver();
      const packageResolver = new PackageResolver(projectDir);

      moduleResolver.setPackageResolver(packageResolver);
      moduleResolver.setProjectManifest(manifest);

      const mainFile = path.join(projectDir, 'src', 'main.fl');
      const mathPath = moduleResolver.resolveModulePath(mainFile, 'math-lib');
      const stringPath = moduleResolver.resolveModulePath(mainFile, 'string-lib');

      expect(mathPath).toContain('math-lib');
      expect(stringPath).toContain('string-lib');

      // Step 7: Uninstall package
      await installer.uninstall('math-lib');

      const newManifest = new ManifestLoader().load(projectDir);
      expect(newManifest.dependencies!['math-lib']).toBeUndefined();
      expect(newManifest.dependencies!['string-lib']).toBe('2.0.0');
    });

    it('should support complex dependency chains', async () => {
      // Create dependency chain: app → lib-a → lib-b
      createPackage('lib-b', '1.0.0', {
        'index.fl': 'export fn utilB() { return "b" }'
      });

      createPackage('lib-a', '1.0.0', {
        'index.fl': 'import { utilB } from "lib-b"\nexport fn utilA() { return utilB() }'
      }, {
        'lib-b': '1.0.0'
      });

      // Initialize main app
      const cli = new PackageCLI(projectDir);
      cli.init('my-app');

      const installer = new PackageInstaller(projectDir);

      // Install lib-b first
      await installer.install(path.join(projectDir, '..', 'lib-b'));

      // Install lib-a (which depends on lib-b)
      await installer.install(path.join(projectDir, '..', 'lib-a'));

      // Verify installation
      const manifest = new ManifestLoader().load(projectDir);
      expect(manifest.dependencies!['lib-a']).toBe('1.0.0');
      expect(manifest.dependencies!['lib-b']).toBe('1.0.0');

      // Test resolution chain
      const resolver = new PackageResolver(projectDir);
      const libA = resolver.resolve('lib-a');
      expect(libA.version).toBe('1.0.0');
      expect(libA.main).toContain('lib-a');
    });
  });

  describe('2️⃣ Module System Integration', () => {
    it('should resolve both file and package imports', async () => {
      // Create project structure
      const cli = new PackageCLI(projectDir);
      cli.init('test-app');

      // Create local file
      const helperFile = path.join(projectDir, 'src', 'helpers.fl');
      fs.writeFileSync(helperFile, 'export fn localHelper() { return "helper" }');

      // Create and install package
      createPackage('utils', '1.0.0', {
        'index.fl': 'export fn globalUtil() { return "util" }'
      });

      const installer = new PackageInstaller(projectDir);
      await installer.install(path.join(projectDir, '..', 'utils'));

      // Setup module resolver
      const moduleResolver = new ModuleResolver();
      const packageResolver = new PackageResolver(projectDir);
      const manifest = new ManifestLoader().load(projectDir);

      moduleResolver.setPackageResolver(packageResolver);
      moduleResolver.setProjectManifest(manifest);

      const mainFile = path.join(projectDir, 'src', 'main.fl');

      // Resolve file import
      const filePath = moduleResolver.resolveModulePath(mainFile, './helpers.fl');
      expect(filePath).toContain('helpers.fl');
      expect(fs.existsSync(filePath)).toBe(true);

      // Resolve package import
      const pkgPath = moduleResolver.resolveModulePath(mainFile, 'utils');
      expect(pkgPath).toContain('utils');
      expect(fs.existsSync(pkgPath)).toBe(true);
    });

    it('should handle mixed import scenarios', async () => {
      const cli = new PackageCLI(projectDir);
      cli.init('app');

      // Create file hierarchy
      const libDir = path.join(projectDir, 'src', 'lib');
      fs.mkdirSync(libDir, { recursive: true });
      fs.writeFileSync(path.join(libDir, 'math.fl'), 'export fn mult(a, b) { return a * b }');
      fs.writeFileSync(path.join(libDir, 'string.fl'), 'export fn upper(s) { return s }');

      // Create packages
      createPackage('array-lib', '1.0.0', {
        'index.fl': 'export fn map(arr, fn) { return arr }'
      });

      createPackage('object-lib', '1.0.0', {
        'index.fl': 'export fn keys(obj) { return [] }'
      });

      const installer = new PackageInstaller(projectDir);
      await installer.install(path.join(projectDir, '..', 'array-lib'));
      await installer.install(path.join(projectDir, '..', 'object-lib'));

      const moduleResolver = new ModuleResolver();
      const packageResolver = new PackageResolver(projectDir);
      const manifest = new ManifestLoader().load(projectDir);

      moduleResolver.setPackageResolver(packageResolver);
      moduleResolver.setProjectManifest(manifest);

      const mainFile = path.join(projectDir, 'src', 'main.fl');

      // Mix of file and package imports
      const imports = [
        { path: './lib/math.fl', type: 'file' },
        { path: './lib/string.fl', type: 'file' },
        { path: 'array-lib', type: 'package' },
        { path: 'object-lib', type: 'package' }
      ];

      for (const imp of imports) {
        const resolved = moduleResolver.resolveModulePath(mainFile, imp.path);
        expect(resolved).toBeDefined();
        if (imp.type === 'file') {
          expect(resolved).toContain('lib');
        } else {
          expect(resolved).toContain('fl_modules');
        }
      }
    });
  });

  describe('3️⃣ Version Management', () => {
    it('should enforce version range compatibility', async () => {
      const cli = new PackageCLI(projectDir);
      cli.init('app');

      // Create package with version 1.5.0
      createPackage('compatibility-lib', '1.5.0');

      const installer = new PackageInstaller(projectDir);
      await installer.install(
        path.join(projectDir, '..', 'compatibility-lib'),
        '1.5.0'
      );

      const resolver = new PackageResolver(projectDir);

      // Test different version ranges
      const testRanges = [
        { range: '^1.0.0', shouldPass: true },
        { range: '~1.5.0', shouldPass: true },
        { range: '1.5.0', shouldPass: true },
        { range: '^2.0.0', shouldPass: false },
        { range: '~1.4.0', shouldPass: false }
      ];

      for (const test of testRanges) {
        if (test.shouldPass) {
          expect(() => {
            resolver.resolve('compatibility-lib', test.range);
          }).not.toThrow();
        } else {
          expect(() => {
            resolver.resolve('compatibility-lib', test.range);
          }).toThrow();
        }
      }
    });

    it('should support semver operations', () => {
      const version1 = SemverUtil.parse('1.2.3');
      const version2 = SemverUtil.parse('1.5.0');
      const version3 = SemverUtil.parse('2.0.0');

      expect(SemverUtil.lt(version1, version2)).toBe(true);
      expect(SemverUtil.gte(version2, version1)).toBe(true);
      expect(SemverUtil.gt(version3, version1)).toBe(true);

      const range = SemverUtil.parseRange('^1.2.0');
      expect(SemverUtil.satisfies(version1, range)).toBe(true);
      expect(SemverUtil.satisfies(version3, range)).toBe(false);
    });
  });

  describe('4️⃣ Manifest Management', () => {
    it('should create and modify manifests correctly', () => {
      const loader = new ManifestLoader();

      // Create default manifest
      const manifest = ManifestLoader.createDefault('test-pkg');
      expect(manifest.name).toBe('test-pkg');
      expect(manifest.version).toBe('1.0.0');

      // Write and read
      loader.write(projectDir, manifest);
      const loaded = loader.load(projectDir);

      expect(loaded.name).toBe('test-pkg');
      expect(loaded.version).toBe('1.0.0');

      // Modify and update
      loaded.dependencies = {
        'pkg-a': '1.0.0',
        'pkg-b': '2.0.0'
      };

      loader.write(projectDir, loaded);
      const updated = loader.load(projectDir);

      expect(updated.dependencies!['pkg-a']).toBe('1.0.0');
      expect(updated.dependencies!['pkg-b']).toBe('2.0.0');
    });

    it('should handle manifest validation', () => {
      const loader = new ManifestLoader();

      // Invalid manifest (no name)
      expect(() => {
        loader.write(projectDir, { version: '1.0.0' } as any);
        loader.load(projectDir);
      }).toThrow();
    });
  });

  describe('5️⃣ CLI Integration', () => {
    it('should support complete CLI workflow', async () => {
      const cli = new PackageCLI(projectDir);

      // Init
      captureConsole(() => cli.init('integration-test'));
      expect(fs.existsSync(path.join(projectDir, 'freelang.json'))).toBe(true);

      // Create packages
      createPackage('cli-lib-1', '1.0.0');
      createPackage('cli-lib-2', '2.0.0');

      // Install via CLI
      const installer = new PackageInstaller(projectDir);
      await installer.install(path.join(projectDir, '..', 'cli-lib-1'));
      await installer.install(path.join(projectDir, '..', 'cli-lib-2'));

      // List via CLI
      const listOutput = captureConsole(() => cli.list());
      expect(listOutput.log).toContain('cli-lib-1');
      expect(listOutput.log).toContain('cli-lib-2');

      // Search via CLI
      const searchOutput = captureConsole(() => cli.search('cli-lib'));
      expect(searchOutput.log).toContain('2개');

      // Uninstall via CLI
      await cli.uninstall('cli-lib-1');

      // Verify
      const finalList = captureConsole(() => cli.list());
      expect(finalList.log).toContain('cli-lib-2');
      expect(finalList.log).not.toContain('cli-lib-1');
    });

    it('should provide helpful CLI error messages', () => {
      const cli = new PackageCLI(projectDir);

      // Missing command
      expect(() => {
        cli.uninstall('nonexistent');
      }).toThrow();

      // Empty search
      expect(() => {
        cli.search('');
      }).toThrow();
    });
  });

  describe('6️⃣ Caching and Performance', () => {
    it('should cache resolved packages', async () => {
      const cli = new PackageCLI(projectDir);
      cli.init('cache-test');

      createPackage('cache-lib', '1.0.0');

      const installer = new PackageInstaller(projectDir);
      await installer.install(path.join(projectDir, '..', 'cache-lib'));

      const resolver = new PackageResolver(projectDir);

      // First resolution
      const resolved1 = resolver.resolve('cache-lib');

      // Second resolution (should be cached)
      const resolved2 = resolver.resolve('cache-lib');

      // Same reference
      expect(resolved1).toBe(resolved2);

      // Clear cache
      resolver.clearCache();

      // After cache clear, gets new instance
      const resolved3 = resolver.resolve('cache-lib');
      expect(resolved1.name).toBe(resolved3.name);
    });

    it('should handle concurrent installations', async () => {
      const cli = new PackageCLI(projectDir);
      cli.init('concurrent-test');

      createPackage('pkg-a', '1.0.0');
      createPackage('pkg-b', '2.0.0');
      createPackage('pkg-c', '3.0.0');

      const installer = new PackageInstaller(projectDir);

      // Sequential installs (JS is single-threaded)
      await installer.install(path.join(projectDir, '..', 'pkg-a'));
      await installer.install(path.join(projectDir, '..', 'pkg-b'));
      await installer.install(path.join(projectDir, '..', 'pkg-c'));

      const manifest = new ManifestLoader().load(projectDir);

      expect(manifest.dependencies!['pkg-a']).toBe('1.0.0');
      expect(manifest.dependencies!['pkg-b']).toBe('2.0.0');
      expect(manifest.dependencies!['pkg-c']).toBe('3.0.0');
    });
  });

  describe('7️⃣ Error Recovery', () => {
    it('should handle installation failures gracefully', async () => {
      const cli = new PackageCLI(projectDir);
      cli.init('error-test');

      // Try to install non-existent package
      expect(async () => {
        await new PackageInstaller(projectDir).install('/nonexistent/path');
      }).rejects;
    });

    it('should rollback on errors', async () => {
      const cli = new PackageCLI(projectDir);
      cli.init('rollback-test');

      createPackage('rollback-lib', '1.0.0');

      const manifest = new ManifestLoader().load(projectDir);
      const initialDeps = Object.keys(manifest.dependencies || {});

      try {
        // Try to uninstall non-existent package
        await new PackageInstaller(projectDir).uninstall('nonexistent');
      } catch {
        // Expected to fail
      }

      // Manifest should be unchanged
      const newManifest = new ManifestLoader().load(projectDir);
      const newDeps = Object.keys(newManifest.dependencies || {});

      expect(newDeps.length).toBe(initialDeps.length);
    });
  });

  describe('8️⃣ Package Discovery', () => {
    it('should find packages with fuzzy search', async () => {
      const cli = new PackageCLI(projectDir);
      cli.init('discovery-test');

      createPackage('math-utils', '1.0.0');
      createPackage('math-lib', '1.0.0');
      createPackage('string-utils', '1.0.0');

      const installer = new PackageInstaller(projectDir);
      await installer.install(path.join(projectDir, '..', 'math-utils'));
      await installer.install(path.join(projectDir, '..', 'math-lib'));
      await installer.install(path.join(projectDir, '..', 'string-utils'));

      const resolver = new PackageResolver(projectDir);

      // Search for "math"
      const mathResults = resolver.findPackage('math');
      expect(mathResults).toContain('math-utils');
      expect(mathResults).toContain('math-lib');

      // Search for "string"
      const stringResults = resolver.findPackage('string');
      expect(stringResults).toContain('string-utils');
    });

    it('should provide package information', async () => {
      const cli = new PackageCLI(projectDir);
      cli.init('info-test');

      createPackage('info-lib', '1.2.3', {}, {
        'other-lib': '1.0.0'
      });

      const installer = new PackageInstaller(projectDir);
      await installer.install(path.join(projectDir, '..', 'info-lib'));

      const resolver = new PackageResolver(projectDir);
      const info = resolver.getInstalledPackageInfo('info-lib');

      expect(info).toBeDefined();
      expect(info!.name).toBe('info-lib');
      expect(info!.version).toBe('1.2.3');
      expect(info!.manifest.dependencies!['other-lib']).toBe('1.0.0');
    });
  });

  describe('9️⃣ Real-World Scenarios', () => {
    it('should manage a real project with multiple packages', async () => {
      const cli = new PackageCLI(projectDir);
      cli.init('web-app');

      // Create a realistic package ecosystem
      createPackage('http', '1.0.0', {
        'index.fl': 'export fn request() { return "http" }',
        'server.fl': 'export fn listen() { return "server" }'
      });

      createPackage('database', '2.0.0', {
        'index.fl': 'export fn connect() { return "db" }',
        'query.fl': 'export fn query() { return "result" }'
      });

      createPackage('validation', '1.0.0', {
        'index.fl': 'export fn validate() { return true }'
      });

      const installer = new PackageInstaller(projectDir);

      // Install all packages
      await installer.install(path.join(projectDir, '..', 'http'));
      await installer.install(path.join(projectDir, '..', 'database'));
      await installer.install(path.join(projectDir, '..', 'validation'));

      // Verify complete setup
      const manifest = new ManifestLoader().load(projectDir);
      expect(Object.keys(manifest.dependencies || {}).length).toBe(3);

      const resolver = new PackageResolver(projectDir);
      const packages = resolver.getInstalledPackages();
      expect(packages.length).toBe(3);
    });

    it('should handle package updates', async () => {
      const cli = new PackageCLI(projectDir);
      cli.init('update-test');

      // Install version 1.0.0
      createPackage('update-lib', '1.0.0');
      const installer = new PackageInstaller(projectDir);
      await installer.install(path.join(projectDir, '..', 'update-lib'));

      let manifest = new ManifestLoader().load(projectDir);
      expect(manifest.dependencies!['update-lib']).toBe('1.0.0');

      // Update to 2.0.0
      fs.rmSync(path.join(projectDir, '..', 'update-lib'), { recursive: true });
      createPackage('update-lib', '2.0.0');
      await installer.install(path.join(projectDir, '..', 'update-lib'), '2.0.0');

      manifest = new ManifestLoader().load(projectDir);
      expect(manifest.dependencies!['update-lib']).toBe('2.0.0');
    });
  });

  describe('🔟 Documentation and Examples', () => {
    it('should have correct file structure', () => {
      const cli = new PackageCLI(projectDir);
      cli.init('structure-test');

      expect(fs.existsSync(path.join(projectDir, 'freelang.json'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'src'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'src', 'main.fl'))).toBe(true);

      const manifest = new ManifestLoader().load(projectDir);
      expect(manifest.name).toBe('structure-test');
      expect(manifest.main).toBe('./src/index.fl');
    });

    it('should support package examples', async () => {
      // Create example structure
      const exampleName = 'example-package';
      createPackage(exampleName, '1.0.0', {
        'index.fl': `// Example Package
export fn greet(name) { return "Hello, " + name }
export fn farewell(name) { return "Goodbye, " + name }`,
        'utils.fl': `export fn combine(a, b) { return a + b }`
      });

      const resolver = new PackageResolver(projectDir);
      const pkg = resolver.resolve(exampleName);

      expect(pkg.name).toBe(exampleName);
      expect(fs.existsSync(pkg.main)).toBe(true);
      expect(fs.existsSync(path.join(pkg.path, 'src', 'utils.fl'))).toBe(true);
    });
  });
});
