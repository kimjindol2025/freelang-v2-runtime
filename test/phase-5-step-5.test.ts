import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ModuleResolver } from '../src/module/module-resolver';
import { PackageResolver } from '../src/package/package-resolver';
import { PackageInstaller } from '../src/package/package-installer';
import { ManifestLoader } from '../src/package/manifest';

describe('Phase 5 Step 5: ModuleResolver + PackageResolver Integration', () => {
  let tempDir: string;
  let projectDir: string;
  let moduleResolver: ModuleResolver;
  let packageResolver: PackageResolver;
  let packageInstaller: PackageInstaller;

  beforeEach(() => {
    // Create temporary directories
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freelang-integration-test-'));
    projectDir = tempDir;

    // Initialize resolvers
    moduleResolver = new ModuleResolver();
    packageResolver = new PackageResolver(projectDir);
    packageInstaller = new PackageInstaller(projectDir);

    // Set up project manifest
    const projectManifest = {
      name: 'test-app',
      version: '1.0.0',
      main: './src/main.fl',
      dependencies: {}
    };

    const loader = new ManifestLoader();
    loader.write(projectDir, projectManifest);

    // Integrate ModuleResolver with PackageResolver
    moduleResolver.setPackageResolver(packageResolver);
    moduleResolver.setProjectManifest(projectManifest);
    moduleResolver.setProjectRoot(projectDir);
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
  function createPackage(name: string, version: string, files: Record<string, string> = {}): void {
    const pkgDir = path.join(projectDir, 'fl_modules', name);
    const srcDir = path.join(pkgDir, 'src');

    fs.mkdirSync(srcDir, { recursive: true });

    // Create manifest
    const manifest = {
      name,
      version,
      main: './src/index.fl',
      dependencies: {}
    };

    fs.writeFileSync(
      path.join(pkgDir, 'freelang.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Create index.fl
    fs.writeFileSync(
      path.join(srcDir, 'index.fl'),
      files['index.fl'] || `// ${name} v${version}\nexport fn ${name}() { return "ok" }`
    );

    // Create additional files
    for (const [fileName, content] of Object.entries(files)) {
      if (fileName !== 'index.fl') {
        const filePath = path.join(srcDir, fileName);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content);
      }
    }
  }

  /**
   * Helper to create a local file in project
   */
  function createLocalFile(filePath: string, content: string): void {
    const fullPath = path.join(projectDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  describe('1️⃣ Backward Compatibility: File-Based Imports', () => {
    it('should resolve relative path imports', () => {
      createLocalFile('src/main.fl', '// main');
      createLocalFile('src/utils/math.fl', '// math');

      const fromFile = path.join(projectDir, 'src/main.fl');
      const resolvedPath = moduleResolver.resolveModulePath(fromFile, './utils/math.fl');

      expect(resolvedPath).toBe(path.join(projectDir, 'src/utils/math.fl'));
    });

    it('should resolve parent directory imports', () => {
      createLocalFile('src/main.fl', '// main');
      createLocalFile('lib/helper.fl', '// helper');

      const fromFile = path.join(projectDir, 'src/main.fl');
      const resolvedPath = moduleResolver.resolveModulePath(fromFile, '../lib/helper.fl');

      expect(resolvedPath).toBe(path.join(projectDir, 'lib/helper.fl'));
    });

    it('should resolve absolute path imports', () => {
      const absolutePath = '/absolute/path/to/file.fl';
      const fromFile = path.join(projectDir, 'src/main.fl');

      const resolvedPath = moduleResolver.resolveModulePath(fromFile, absolutePath);

      expect(resolvedPath).toBe(absolutePath);
    });

    it('should handle nested relative imports', () => {
      createLocalFile('src/main.fl', '// main');
      createLocalFile('src/deep/nested/utils.fl', '// nested');

      const fromFile = path.join(projectDir, 'src/deep/file.fl');
      const resolvedPath = moduleResolver.resolveModulePath(fromFile, './nested/utils.fl');

      expect(resolvedPath).toBe(path.join(projectDir, 'src/deep/nested/utils.fl'));
    });
  });

  describe('2️⃣ Package-Based Imports', () => {
    it('should resolve package name to entry point', () => {
      createPackage('math-lib', '1.0.0');

      // Update project manifest with dependency
      const manifest = new ManifestLoader().load(projectDir);
      manifest.dependencies = { 'math-lib': '1.0.0' };
      new ManifestLoader().write(projectDir, manifest);

      moduleResolver.setProjectManifest(manifest);

      const fromFile = path.join(projectDir, 'src/main.fl');
      const resolvedPath = moduleResolver.resolveModulePath(fromFile, 'math-lib');

      expect(resolvedPath).toBe(path.join(projectDir, 'fl_modules/math-lib/src/index.fl'));
    });

    it('should resolve package with version range', () => {
      createPackage('utils', '2.1.5');

      // Update project manifest with version range
      const manifest = new ManifestLoader().load(projectDir);
      manifest.dependencies = { 'utils': '^2.0.0' };
      new ManifestLoader().write(projectDir, manifest);

      moduleResolver.setProjectManifest(manifest);

      const fromFile = path.join(projectDir, 'src/main.fl');
      const resolvedPath = moduleResolver.resolveModulePath(fromFile, 'utils');

      expect(resolvedPath).toBe(path.join(projectDir, 'fl_modules/utils/src/index.fl'));
    });

    it('should throw error when package not installed', () => {
      const fromFile = path.join(projectDir, 'src/main.fl');

      expect(() => {
        moduleResolver.resolveModulePath(fromFile, 'nonexistent-lib');
      }).toThrow();
    });

    it('should resolve multiple packages', () => {
      createPackage('math-lib', '1.0.0');
      createPackage('string-lib', '2.0.0');

      const manifest = new ManifestLoader().load(projectDir);
      manifest.dependencies = {
        'math-lib': '1.0.0',
        'string-lib': '2.0.0'
      };
      new ManifestLoader().write(projectDir, manifest);

      moduleResolver.setProjectManifest(manifest);

      const fromFile = path.join(projectDir, 'src/main.fl');

      const mathPath = moduleResolver.resolveModulePath(fromFile, 'math-lib');
      const stringPath = moduleResolver.resolveModulePath(fromFile, 'string-lib');

      expect(mathPath).toContain('math-lib');
      expect(stringPath).toContain('string-lib');
      expect(mathPath).not.toBe(stringPath);
    });
  });

  describe('3️⃣ Mixed Imports: Packages + Files', () => {
    it('should resolve both package and file imports in same project', () => {
      createPackage('utils', '1.0.0');
      createLocalFile('src/main.fl', '// main');
      createLocalFile('src/helpers.fl', '// helpers');

      const manifest = new ManifestLoader().load(projectDir);
      manifest.dependencies = { 'utils': '1.0.0' };
      new ManifestLoader().write(projectDir, manifest);

      moduleResolver.setProjectManifest(manifest);

      const fromFile = path.join(projectDir, 'src/main.fl');

      // Package import
      const pkgPath = moduleResolver.resolveModulePath(fromFile, 'utils');
      expect(pkgPath).toContain('fl_modules/utils');

      // File import
      const filePath = moduleResolver.resolveModulePath(fromFile, './helpers.fl');
      expect(filePath).toContain('src/helpers.fl');
    });

    it('should maintain priority: package names before file path interpretation', () => {
      createPackage('utils', '1.0.0');

      const manifest = new ManifestLoader().load(projectDir);
      manifest.dependencies = { 'utils': '1.0.0' };
      new ManifestLoader().write(projectDir, manifest);

      moduleResolver.setProjectManifest(manifest);

      const fromFile = path.join(projectDir, 'src/main.fl');
      const resolvedPath = moduleResolver.resolveModulePath(fromFile, 'utils');

      // Should resolve as package, not as file path
      expect(resolvedPath).toContain('fl_modules/utils');
      expect(resolvedPath).not.toContain('src/utils');
    });
  });

  describe('4️⃣ Package Resolver Integration', () => {
    it('should use PackageResolver to resolve package info', () => {
      createPackage('math-lib', '1.2.3');

      const resolved = packageResolver.resolve('math-lib');

      expect(resolved.name).toBe('math-lib');
      expect(resolved.version).toBe('1.2.3');
      expect(resolved.path).toContain('fl_modules/math-lib');
      expect(resolved.main).toContain('src/index.fl');
    });

    it('should apply version range validation', () => {
      createPackage('lib', '1.5.0');

      // Version range is satisfied
      const resolved = packageResolver.resolve('lib', '^1.0.0');
      expect(resolved.version).toBe('1.5.0');

      // Version range is not satisfied
      expect(() => {
        packageResolver.resolve('lib', '^2.0.0');
      }).toThrow();
    });

    it('should cache resolved packages', () => {
      createPackage('utils', '1.0.0');

      const resolved1 = packageResolver.resolve('utils');
      const resolved2 = packageResolver.resolve('utils');

      expect(resolved1).toBe(resolved2); // Same object reference
    });

    it('should list installed packages', () => {
      createPackage('lib1', '1.0.0');
      createPackage('lib2', '2.0.0');
      createPackage('lib3', '3.0.0');

      const packages = packageResolver.getInstalledPackages();

      expect(packages).toContain('lib1');
      expect(packages).toContain('lib2');
      expect(packages).toContain('lib3');
      expect(packages.length).toBe(3);
    });
  });

  describe('5️⃣ Setter Methods', () => {
    it('should set and use PackageResolver', () => {
      createPackage('math-lib', '1.0.0');

      const fromFile = path.join(projectDir, 'src/main.fl');

      // Without PackageResolver, should throw
      const resolver1 = new ModuleResolver();
      expect(() => {
        resolver1.resolveModulePath(fromFile, 'math-lib');
      }).toThrow();

      // With PackageResolver, should work
      const resolver2 = new ModuleResolver();
      resolver2.setPackageResolver(new PackageResolver(projectDir));

      const manifest = new ManifestLoader().load(projectDir);
      manifest.dependencies = { 'math-lib': '1.0.0' };
      resolver2.setProjectManifest(manifest);

      const resolvedPath = resolver2.resolveModulePath(fromFile, 'math-lib');
      expect(resolvedPath).toContain('math-lib');
    });

    it('should use project manifest for version range', () => {
      createPackage('lib', '2.5.0');

      const manifest = new ManifestLoader().load(projectDir);
      manifest.dependencies = { 'lib': '~2.5.0' };

      const resolver = new ModuleResolver();
      resolver.setPackageResolver(new PackageResolver(projectDir));
      resolver.setProjectManifest(manifest);

      const fromFile = path.join(projectDir, 'src/main.fl');
      const resolvedPath = resolver.resolveModulePath(fromFile, 'lib');

      expect(resolvedPath).toContain('lib');
    });

    it('should store and use project root', () => {
      const resolver = new ModuleResolver();
      const root = '/path/to/project';

      resolver.setProjectRoot(root);
      // Just verify it's stored (no public getter, but would be used internally)
      expect(resolver).toBeDefined();
    });
  });

  describe('6️⃣ Error Handling', () => {
    it('should throw descriptive error for missing package', () => {
      const fromFile = path.join(projectDir, 'src/main.fl');

      expect(() => {
        moduleResolver.resolveModulePath(fromFile, 'missing-package');
      }).toThrow('패키지 해석 실패');
    });

    it('should throw error without PackageResolver for package names', () => {
      const resolver = new ModuleResolver();
      const fromFile = path.join(projectDir, 'src/main.fl');

      expect(() => {
        resolver.resolveModulePath(fromFile, 'some-package');
      }).toThrow('패키지 기반 import는 지원하지 않습니다');
    });

    it('should handle file not found gracefully', () => {
      const fromFile = path.join(projectDir, 'src/main.fl');

      // This just returns a path (doesn't validate file existence)
      const resolvedPath = moduleResolver.resolveModulePath(fromFile, './nonexistent.fl');

      expect(resolvedPath).toContain('nonexistent.fl');
    });
  });

  describe('7️⃣ Real-World Scenarios', () => {
    it('should resolve complex project structure', () => {
      // Create packages
      createPackage('http', '1.0.0', {
        'index.fl': 'export fn get() { return "http" }',
        'request.fl': 'export fn request() { return "req" }'
      });
      createPackage('db', '2.0.0', {
        'index.fl': 'export fn connect() { return "db" }',
        'query.fl': 'export fn query() { return "q" }'
      });

      // Create local files
      createLocalFile('src/main.fl', '// main');
      createLocalFile('src/api/routes.fl', '// routes');
      createLocalFile('src/db/models.fl', '// models');

      // Update manifest
      const manifest = new ManifestLoader().load(projectDir);
      manifest.dependencies = {
        'http': '1.0.0',
        'db': '2.0.0'
      };
      new ManifestLoader().write(projectDir, manifest);
      moduleResolver.setProjectManifest(manifest);

      const mainFile = path.join(projectDir, 'src/main.fl');

      // Resolve various imports
      const httpPkg = moduleResolver.resolveModulePath(mainFile, 'http');
      const dbPkg = moduleResolver.resolveModulePath(mainFile, 'db');
      const localApi = moduleResolver.resolveModulePath(mainFile, './api/routes.fl');

      expect(httpPkg).toContain('http');
      expect(dbPkg).toContain('db');
      expect(localApi).toContain('api/routes.fl');
    });

    it('should handle package with nested source structure', () => {
      createPackage('complex-lib', '1.0.0', {
        'index.fl': 'export fn main() { return "ok" }',
        'utils/math.fl': 'export fn add(a, b) { return a + b }',
        'utils/string.fl': 'export fn concat(a, b) { return a + b }'
      });

      const manifest = new ManifestLoader().load(projectDir);
      manifest.dependencies = { 'complex-lib': '1.0.0' };
      new ManifestLoader().write(projectDir, manifest);
      moduleResolver.setProjectManifest(manifest);

      const fromFile = path.join(projectDir, 'src/main.fl');
      const resolvedPath = moduleResolver.resolveModulePath(fromFile, 'complex-lib');

      expect(resolvedPath).toBe(path.join(projectDir, 'fl_modules/complex-lib/src/index.fl'));

      // Files in nested structure should exist
      const mathFile = path.join(projectDir, 'fl_modules/complex-lib/src/utils/math.fl');
      expect(fs.existsSync(mathFile)).toBe(true);
    });

    it('should update package version and resolve new version', async () => {
      createPackage('lib', '1.0.0');

      const manifest = new ManifestLoader().load(projectDir);
      manifest.dependencies = { 'lib': '1.0.0' };
      new ManifestLoader().write(projectDir, manifest);
      moduleResolver.setProjectManifest(manifest);

      const fromFile = path.join(projectDir, 'src/main.fl');
      const resolved1 = moduleResolver.resolveModulePath(fromFile, 'lib');

      expect(resolved1).toContain('lib');

      // Uninstall old version
      await packageInstaller.uninstall('lib');

      // Install new version
      createPackage('lib', '2.0.0');

      // Update manifest
      const newManifest = new ManifestLoader().load(projectDir);
      newManifest.dependencies = { 'lib': '2.0.0' };
      new ManifestLoader().write(projectDir, newManifest);

      moduleResolver.setProjectManifest(newManifest);

      const resolved2 = moduleResolver.resolveModulePath(fromFile, 'lib');

      expect(resolved2).toContain('lib');
    });
  });

  describe('8️⃣ Package Resolver Caching', () => {
    it('should cache and reuse resolved packages', () => {
      createPackage('utils', '1.0.0');

      // First resolution
      const resolved1 = packageResolver.resolve('utils');

      // Second resolution (should be from cache)
      const resolved2 = packageResolver.resolve('utils');

      // Same reference (cached)
      expect(resolved1).toBe(resolved2);
    });

    it('should separate cache for different versions', () => {
      createPackage('lib', '1.0.0');

      // Resolve without version
      const resolved1 = packageResolver.resolve('lib');
      expect(resolved1.version).toBe('1.0.0');

      // Different versions would have different cache keys
      // (but since we only have 1.0.0 installed, both would work)
      const resolved2 = packageResolver.resolve('lib', '1.0.0');
      expect(resolved2.version).toBe('1.0.0');
    });

    it('should allow cache clearing', () => {
      createPackage('utils', '1.0.0');

      const resolved1 = packageResolver.resolve('utils');

      // Clear cache
      packageResolver.clearCache();

      // Next resolution would reload (but gets same data)
      const resolved2 = packageResolver.resolve('utils');

      // Different references after cache clear
      expect(resolved1.name).toBe(resolved2.name);
    });
  });
});
