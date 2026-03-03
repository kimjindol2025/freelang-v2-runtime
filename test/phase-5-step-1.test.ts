import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ManifestLoader, PackageManifest } from '../src/package/manifest';

describe('Phase 5 Step 1: Package Manifest (freelang.json)', () => {
  let tempDir: string;
  let loader: ManifestLoader;

  beforeEach(() => {
    // Create temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freelang-test-'));
    loader = new ManifestLoader();
  });

  afterEach(() => {
    // Cleanup temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('1️⃣ Load Valid Manifest', () => {
    it('should load valid freelang.json file', () => {
      const manifest: PackageManifest = {
        name: 'test-app',
        version: '1.0.0',
        description: 'Test application',
        main: './src/main.fl',
        dependencies: {
          'math-lib': '1.2.0',
          'utils': '2.0.0',
        },
      };

      const manifestPath = path.join(tempDir, 'freelang.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      const loaded = loader.load(tempDir);

      expect(loaded.name).toBe('test-app');
      expect(loaded.version).toBe('1.0.0');
      expect(loaded.description).toBe('Test application');
      expect(loaded.main).toBe('./src/main.fl');
      expect(loaded.dependencies).toEqual({
        'math-lib': '1.2.0',
        'utils': '2.0.0',
      });
    });

    it('should load manifest with all optional fields', () => {
      const manifest: PackageManifest = {
        name: 'full-app',
        version: '2.5.3',
        description: 'Full featured app',
        main: './app.fl',
        author: 'John Doe',
        license: 'Apache-2.0',
        repository: 'https://github.com/user/repo',
        dependencies: {
          'lib1': '1.0.0',
        },
        devDependencies: {
          'test-framework': '3.0.0',
        },
      };

      const manifestPath = path.join(tempDir, 'freelang.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      const loaded = loader.load(tempDir);

      expect(loaded).toEqual(manifest);
    });

    it('should load manifest with minimal fields', () => {
      const manifest = {
        name: 'minimal-app',
        version: '0.1.0',
      };

      const manifestPath = path.join(tempDir, 'freelang.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));

      const loaded = loader.load(tempDir);

      expect(loaded.name).toBe('minimal-app');
      expect(loaded.version).toBe('0.1.0');
    });
  });

  describe('2️⃣ Validate Manifest Structure', () => {
    it('should throw error when name is missing', () => {
      const manifest = {
        version: '1.0.0',
      };

      const manifestPath = path.join(tempDir, 'freelang.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));

      expect(() => loader.load(tempDir)).toThrow(
        'Package name is required'
      );
    });

    it('should throw error when version is missing', () => {
      const manifest = {
        name: 'test-app',
      };

      const manifestPath = path.join(tempDir, 'freelang.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));

      expect(() => loader.load(tempDir)).toThrow(
        'Package version is required'
      );
    });

    it('should throw error on invalid semver format', () => {
      const manifest = {
        name: 'test-app',
        version: '1.0',  // Invalid: missing patch
      };

      const manifestPath = path.join(tempDir, 'freelang.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));

      expect(() => loader.load(tempDir)).toThrow(
        'Invalid version format'
      );
    });

    it('should throw error on invalid JSON', () => {
      const manifestPath = path.join(tempDir, 'freelang.json');
      fs.writeFileSync(manifestPath, '{ invalid json }');

      expect(() => loader.load(tempDir)).toThrow(
        'Invalid JSON'
      );
    });

    it('should throw error when freelang.json does not exist', () => {
      const nonExistentDir = path.join(tempDir, 'missing');

      expect(() => loader.load(nonExistentDir)).toThrow(
        'No freelang.json found'
      );
    });
  });

  describe('3️⃣ Validate Dependency Objects', () => {
    it('should validate correct dependencies format', () => {
      const manifest = {
        name: 'test-app',
        version: '1.0.0',
        dependencies: {
          'lib1': '1.0.0',
          'lib2': '2.1.3',
          'lib3': '0.0.1',
        },
      };

      const manifestPath = path.join(tempDir, 'freelang.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));

      expect(() => loader.load(tempDir)).not.toThrow();
    });

    it('should throw error when dependency version is not string', () => {
      const manifest = {
        name: 'test-app',
        version: '1.0.0',
        dependencies: {
          'lib1': 1.0,  // Invalid: number instead of string
        },
      };

      const manifestPath = path.join(tempDir, 'freelang.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));

      expect(() => loader.load(tempDir)).toThrow(
        'must be a string'
      );
    });

    it('should validate devDependencies', () => {
      const manifest = {
        name: 'test-app',
        version: '1.0.0',
        devDependencies: {
          'test-runner': '5.0.0',
          'linter': '2.1.0',
        },
      };

      const manifestPath = path.join(tempDir, 'freelang.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));

      expect(() => loader.load(tempDir)).not.toThrow();
    });
  });

  describe('4️⃣ Create Default Manifest', () => {
    it('should create default manifest', () => {
      const manifest = ManifestLoader.createDefault('my-app');

      expect(manifest.name).toBe('my-app');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.main).toBe('./src/index.fl');
      expect(manifest.license).toBe('MIT');
      expect(manifest.dependencies).toEqual({});
      expect(manifest.devDependencies).toEqual({});
    });

    it('should create default manifest with custom options', () => {
      const manifest = ManifestLoader.createDefault('my-app', {
        version: '2.0.0',
        description: 'My awesome app',
        author: 'Jane Doe',
        license: 'MIT',
      });

      expect(manifest.name).toBe('my-app');
      expect(manifest.version).toBe('2.0.0');
      expect(manifest.description).toBe('My awesome app');
      expect(manifest.author).toBe('Jane Doe');
      expect(manifest.license).toBe('MIT');
    });

    it('should validate created default manifest', () => {
      const manifest = ManifestLoader.createDefault('test-app');

      // Should not throw
      const manifestPath = path.join(tempDir, 'freelang.json');
      expect(() => {
        loader.write(tempDir, manifest);
        loader.load(tempDir);
      }).not.toThrow();
    });
  });

  describe('5️⃣ Write Manifest', () => {
    it('should write manifest to freelang.json', () => {
      const manifest: PackageManifest = {
        name: 'write-test',
        version: '1.0.0',
        main: './src/main.fl',
        dependencies: {
          'lib1': '1.0.0',
        },
      };

      loader.write(tempDir, manifest);

      const manifestPath = path.join(tempDir, 'freelang.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const loaded = loader.load(tempDir);
      expect(loaded.name).toBe('write-test');
      expect(loaded.dependencies).toEqual({ 'lib1': '1.0.0' });
    });

    it('should create directory if not exists', () => {
      const newDir = path.join(tempDir, 'new', 'project');
      const manifest = ManifestLoader.createDefault('new-app');

      expect(fs.existsSync(newDir)).toBe(false);

      loader.write(newDir, manifest);

      expect(fs.existsSync(newDir)).toBe(true);
      expect(fs.existsSync(path.join(newDir, 'freelang.json'))).toBe(true);
    });

    it('should throw error when writing invalid manifest', () => {
      const invalidManifest = {
        // Missing required name and version
      } as any;

      expect(() => loader.write(tempDir, invalidManifest)).toThrow();
    });
  });

  describe('6️⃣ Utility Methods', () => {
    it('should check if manifest exists', () => {
      expect(ManifestLoader.exists(tempDir)).toBe(false);

      const manifest = ManifestLoader.createDefault('test');
      loader.write(tempDir, manifest);

      expect(ManifestLoader.exists(tempDir)).toBe(true);
    });

    it('should get main file path', () => {
      const manifest: PackageManifest = {
        name: 'test',
        version: '1.0.0',
        main: './app.fl',
      };

      expect(ManifestLoader.getMainFile(manifest)).toBe('./app.fl');
    });

    it('should get main file with default path', () => {
      const manifest: PackageManifest = {
        name: 'test',
        version: '1.0.0',
      };

      expect(ManifestLoader.getMainFile(manifest)).toBe('./src/index.fl');
    });

    it('should get all dependencies without devDependencies', () => {
      const manifest: PackageManifest = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          'lib1': '1.0.0',
          'lib2': '2.0.0',
        },
        devDependencies: {
          'test-lib': '3.0.0',
        },
      };

      const deps = ManifestLoader.getDependencies(manifest, false);

      expect(deps).toEqual({
        'lib1': '1.0.0',
        'lib2': '2.0.0',
      });
    });

    it('should get all dependencies with devDependencies', () => {
      const manifest: PackageManifest = {
        name: 'test',
        version: '1.0.0',
        dependencies: {
          'lib1': '1.0.0',
        },
        devDependencies: {
          'test-lib': '3.0.0',
        },
      };

      const deps = ManifestLoader.getDependencies(manifest, true);

      expect(deps).toEqual({
        'lib1': '1.0.0',
        'test-lib': '3.0.0',
      });
    });
  });

  describe('7️⃣ Edge Cases', () => {
    it('should handle empty dependencies object', () => {
      const manifest: PackageManifest = {
        name: 'test',
        version: '1.0.0',
        dependencies: {},
      };

      const manifestPath = path.join(tempDir, 'freelang.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));

      expect(() => loader.load(tempDir)).not.toThrow();
    });

    it('should handle whitespace in JSON', () => {
      const manifest = `
{
  "name": "test-app",
  "version": "1.0.0"
}
      `;

      const manifestPath = path.join(tempDir, 'freelang.json');
      fs.writeFileSync(manifestPath, manifest);

      expect(() => loader.load(tempDir)).not.toThrow();
    });

    it('should handle large manifest with many dependencies', () => {
      const deps: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        deps[`lib-${i}`] = `${i}.0.0`;
      }

      const manifest = {
        name: 'large-app',
        version: '1.0.0',
        dependencies: deps,
      };

      const manifestPath = path.join(tempDir, 'freelang.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));

      const loaded = loader.load(tempDir);
      expect(Object.keys(loaded.dependencies || {}).length).toBe(100);
    });
  });
});
