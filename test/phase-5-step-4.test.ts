import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PackageInstaller } from '../src/package/package-installer';
import { ManifestLoader } from '../src/package/manifest';

describe('Phase 5 Step 4: Package Installer', () => {
  let tempDir: string;
  let packageSourceDir: string;
  let installer: PackageInstaller;

  beforeEach(() => {
    // Create temporary directories
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freelang-install-test-'));
    packageSourceDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'freelang-pkg-source-')
    );

    installer = new PackageInstaller(tempDir);
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (fs.existsSync(packageSourceDir)) {
      fs.rmSync(packageSourceDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to create a package in source directory
   */
  function createPackageSource(
    name: string,
    version: string,
    dependencies?: Record<string, string>
  ): string {
    const pkgDir = path.join(packageSourceDir, name);
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

    // Add some other files to test full copy
    fs.writeFileSync(path.join(pkgDir, 'README.md'), `# ${name}`);
    fs.writeFileSync(path.join(srcDir, 'helper.fl'), '// helper');

    return pkgDir;
  }

  describe('1️⃣ Package Installation', () => {
    it('should install package from source directory', async () => {
      const pkgSource = createPackageSource('math-lib', '1.0.0');

      await installer.install(pkgSource);

      const flModulesDir = path.join(tempDir, 'fl_modules');
      const installedDir = path.join(flModulesDir, 'math-lib');

      expect(fs.existsSync(installedDir)).toBe(true);
      expect(fs.existsSync(path.join(installedDir, 'freelang.json'))).toBe(true);
      expect(fs.existsSync(path.join(installedDir, 'src', 'index.fl'))).toBe(
        true
      );
    });

    it('should create fl_modules directory if not exists', async () => {
      const flModulesDir = path.join(tempDir, 'fl_modules');
      expect(fs.existsSync(flModulesDir)).toBe(false);

      const pkgSource = createPackageSource('lib', '1.0.0');
      await installer.install(pkgSource);

      expect(fs.existsSync(flModulesDir)).toBe(true);
    });

    it('should copy all package files', async () => {
      const pkgSource = createPackageSource('lib', '1.0.0');

      await installer.install(pkgSource);

      const installedDir = path.join(tempDir, 'fl_modules', 'lib');

      expect(fs.existsSync(path.join(installedDir, 'freelang.json'))).toBe(
        true
      );
      expect(fs.existsSync(path.join(installedDir, 'README.md'))).toBe(true);
      expect(fs.existsSync(path.join(installedDir, 'src', 'index.fl'))).toBe(
        true
      );
      expect(fs.existsSync(path.join(installedDir, 'src', 'helper.fl'))).toBe(
        true
      );
    });

    it('should throw error when package path not found', async () => {
      const invalidPath = path.join(packageSourceDir, 'nonexistent');

      await expect(installer.install(invalidPath)).rejects.toThrow(
        'Package path not found'
      );
    });

    it('should throw error when manifest is invalid', async () => {
      const pkgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bad-pkg-'));
      const srcDir = path.join(pkgDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'index.fl'), '// no manifest');

      await expect(installer.install(pkgDir)).rejects.toThrow();

      fs.rmSync(pkgDir, { recursive: true, force: true });
    });
  });

  describe('2️⃣ Manifest Update', () => {
    it('should add dependency to freelang.json', async () => {
      const pkgSource = createPackageSource('lib', '1.2.0');

      await installer.install(pkgSource);

      const manifest = new ManifestLoader().load(tempDir);

      expect(manifest.dependencies).toBeDefined();
      expect(manifest.dependencies!['lib']).toBe('1.2.0');
    });

    it('should create freelang.json if not exists', async () => {
      const manifestPath = path.join(tempDir, 'freelang.json');
      expect(fs.existsSync(manifestPath)).toBe(false);

      const pkgSource = createPackageSource('lib', '1.0.0');
      await installer.install(pkgSource);

      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = new ManifestLoader().load(tempDir);
      expect(manifest.dependencies!['lib']).toBe('1.0.0');
    });

    it('should update existing dependency', async () => {
      const pkgSource = createPackageSource('lib', '1.0.0');

      // Install v1.0.0
      await installer.install(pkgSource);

      let manifest = new ManifestLoader().load(tempDir);
      expect(manifest.dependencies!['lib']).toBe('1.0.0');

      // Update to v2.0.0
      const pkgSource2 = createPackageSource('lib', '2.0.0');
      await installer.install(pkgSource2);

      manifest = new ManifestLoader().load(tempDir);
      expect(manifest.dependencies!['lib']).toBe('2.0.0');
    });

    it('should preserve other dependencies', async () => {
      const pkg1 = createPackageSource('lib1', '1.0.0');
      const pkg2 = createPackageSource('lib2', '2.0.0');

      await installer.install(pkg1);
      await installer.install(pkg2);

      const manifest = new ManifestLoader().load(tempDir);

      expect(manifest.dependencies!['lib1']).toBe('1.0.0');
      expect(manifest.dependencies!['lib2']).toBe('2.0.0');
    });
  });

  describe('3️⃣ Package Uninstallation', () => {
    it('should uninstall package', async () => {
      const pkgSource = createPackageSource('lib', '1.0.0');
      await installer.install(pkgSource);

      const flModulesDir = path.join(tempDir, 'fl_modules');
      const libDir = path.join(flModulesDir, 'lib');

      expect(fs.existsSync(libDir)).toBe(true);

      await installer.uninstall('lib');

      expect(fs.existsSync(libDir)).toBe(false);
    });

    it('should remove dependency from freelang.json', async () => {
      const pkgSource = createPackageSource('lib', '1.0.0');
      await installer.install(pkgSource);

      let manifest = new ManifestLoader().load(tempDir);
      expect(manifest.dependencies!['lib']).toBe('1.0.0');

      await installer.uninstall('lib');

      manifest = new ManifestLoader().load(tempDir);
      expect(manifest.dependencies!['lib']).toBeUndefined();
    });

    it('should throw error when package not installed', async () => {
      await expect(installer.uninstall('nonexistent')).rejects.toThrow(
        'is not installed'
      );
    });

    it('should preserve other dependencies on uninstall', async () => {
      const pkg1 = createPackageSource('lib1', '1.0.0');
      const pkg2 = createPackageSource('lib2', '2.0.0');

      await installer.install(pkg1);
      await installer.install(pkg2);

      await installer.uninstall('lib1');

      const manifest = new ManifestLoader().load(tempDir);
      expect(manifest.dependencies!['lib1']).toBeUndefined();
      expect(manifest.dependencies!['lib2']).toBe('2.0.0');
    });
  });

  describe('4️⃣ Install All Dependencies', () => {
    it('should handle empty dependencies', async () => {
      await expect(installer.installAll()).rejects.toThrow(
        'No freelang.json found'
      );
    });

    it('should log when no dependencies', async () => {
      const manifest = {
        name: 'app',
        version: '1.0.0',
        dependencies: {},
      };

      const loader = new ManifestLoader();
      loader.write(tempDir, manifest);

      // Should not throw
      await expect(installer.installAll()).resolves.not.toThrow();
    });
  });

  describe('5️⃣ Utility Methods', () => {
    it('should list installed packages', async () => {
      const pkg1 = createPackageSource('lib1', '1.0.0');
      const pkg2 = createPackageSource('lib2', '2.0.0');

      await installer.install(pkg1);
      await installer.install(pkg2);

      const packages = installer.getInstalledPackages();

      expect(packages).toContain('lib1');
      expect(packages).toContain('lib2');
      expect(packages.length).toBe(2);
    });

    it('should check if package is installed', async () => {
      const pkgSource = createPackageSource('lib', '1.0.0');

      expect(installer.isInstalled('lib')).toBe(false);

      await installer.install(pkgSource);

      expect(installer.isInstalled('lib')).toBe(true);
    });

    it('should get installed package version', async () => {
      const pkgSource = createPackageSource('lib', '1.5.0');

      expect(installer.getInstalledVersion('lib')).toBeNull();

      await installer.install(pkgSource);

      expect(installer.getInstalledVersion('lib')).toBe('1.5.0');
    });

    it('should get project root', () => {
      expect(installer.getProjectRoot()).toBe(tempDir);
    });

    it('should get modules directory', () => {
      const expected = path.join(tempDir, 'fl_modules');
      expect(installer.getModulesDir()).toBe(expected);
    });

    it('should check if modules directory exists', async () => {
      expect(installer.hasModulesDir()).toBe(false);

      const pkgSource = createPackageSource('lib', '1.0.0');
      await installer.install(pkgSource);

      expect(installer.hasModulesDir()).toBe(true);
    });

    it('should create modules directory', () => {
      expect(installer.hasModulesDir()).toBe(false);

      installer.createModulesDir();

      expect(installer.hasModulesDir()).toBe(true);
    });

    it('should clear all modules with confirmation', async () => {
      const pkgSource = createPackageSource('lib', '1.0.0');
      await installer.install(pkgSource);

      expect(installer.hasModulesDir()).toBe(true);

      // Should throw without confirmation
      expect(() => installer.clearModules(false)).toThrow();

      // Should work with confirmation
      expect(() => installer.clearModules(true)).not.toThrow();

      expect(installer.hasModulesDir()).toBe(false);
    });
  });

  describe('6️⃣ Real-World Scenarios', () => {
    it('should handle package with dependencies metadata', async () => {
      const pkgSource = createPackageSource('lib', '1.0.0', {
        'dep1': '1.0.0',
        'dep2': '2.0.0',
      });

      await installer.install(pkgSource);

      const flModulesDir = path.join(tempDir, 'fl_modules', 'lib');
      const manifest = new ManifestLoader().load(flModulesDir);

      expect(manifest.dependencies).toEqual({
        'dep1': '1.0.0',
        'dep2': '2.0.0',
      });
    });

    it('should skip node_modules and .git during copy', async () => {
      const pkgSource = createPackageSource('lib', '1.0.0');

      // Add node_modules and .git
      fs.mkdirSync(path.join(pkgSource, 'node_modules'), { recursive: true });
      fs.mkdirSync(path.join(pkgSource, '.git'), { recursive: true });
      fs.writeFileSync(
        path.join(pkgSource, 'node_modules', 'test.txt'),
        'should be skipped'
      );
      fs.writeFileSync(
        path.join(pkgSource, '.git', 'config'),
        'should be skipped'
      );

      await installer.install(pkgSource);

      const installedDir = path.join(tempDir, 'fl_modules', 'lib');
      expect(fs.existsSync(path.join(installedDir, 'node_modules'))).toBe(
        false
      );
      expect(fs.existsSync(path.join(installedDir, '.git'))).toBe(false);
    });

    it('should handle nested directory structure', async () => {
      const pkgSource = createPackageSource('lib', '1.0.0');

      // Create nested structure
      const nested = path.join(pkgSource, 'src', 'utils', 'helpers');
      fs.mkdirSync(nested, { recursive: true });
      fs.writeFileSync(path.join(nested, 'math.fl'), '// math helpers');

      await installer.install(pkgSource);

      const installedDir = path.join(tempDir, 'fl_modules', 'lib');
      expect(
        fs.existsSync(path.join(installedDir, 'src', 'utils', 'helpers', 'math.fl'))
      ).toBe(true);
    });

    it('should handle multiple installs and uninstalls', async () => {
      const pkg1 = createPackageSource('lib1', '1.0.0');
      const pkg2 = createPackageSource('lib2', '2.0.0');
      const pkg3 = createPackageSource('lib3', '3.0.0');

      // Install all
      await installer.install(pkg1);
      await installer.install(pkg2);
      await installer.install(pkg3);

      let packages = installer.getInstalledPackages();
      expect(packages.length).toBe(3);

      // Uninstall middle one
      await installer.uninstall('lib2');

      packages = installer.getInstalledPackages();
      expect(packages).toContain('lib1');
      expect(packages).not.toContain('lib2');
      expect(packages).toContain('lib3');

      // Reinstall
      await installer.install(pkg2);

      packages = installer.getInstalledPackages();
      expect(packages.length).toBe(3);
    });
  });
});
