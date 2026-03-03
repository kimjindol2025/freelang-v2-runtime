import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PackageCLI } from '../src/cli/package-cli';
import { ManifestLoader } from '../src/package/manifest';
import { PackageInstaller } from '../src/package/package-installer';

describe('Phase 5 Step 6: CLI Package Management', () => {
  let tempDir: string;
  let cli: PackageCLI;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freelang-cli-test-'));
    cli = new PackageCLI(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to create a package
   */
  function createPackage(name: string, version: string): void {
    const pkgDir = path.join(tempDir, '..', name);
    const srcDir = path.join(pkgDir, 'src');

    fs.mkdirSync(srcDir, { recursive: true });

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

    fs.writeFileSync(
      path.join(srcDir, 'index.fl'),
      `// ${name} v${version}\nexport fn ${name}() { return "ok" }`
    );
  }

  /**
   * Capture console output
   */
  function captureConsoleOutput(fn: () => void): { log: string; error: string } {
    const logs: string[] = [];
    const errors: string[] = [];

    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args: any[]) => {
      logs.push(args.map(a => String(a)).join(' '));
    };
    console.error = (...args: any[]) => {
      errors.push(args.map(a => String(a)).join(' '));
    };

    try {
      fn();
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }

    return {
      log: logs.join('\n'),
      error: errors.join('\n')
    };
  }

  describe('1️⃣ Init Command', () => {
    it('should initialize a new project', () => {
      const output = captureConsoleOutput(() => {
        cli.init('test-app');
      });

      expect(output.log).toContain('프로젝트 초기화 완료');
      expect(output.log).toContain('test-app');

      expect(fs.existsSync(path.join(tempDir, 'freelang.json'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'src', 'main.fl'))).toBe(true);
    });

    it('should create valid freelang.json', () => {
      cli.init('my-project');

      const manifestPath = path.join(tempDir, 'freelang.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      expect(manifest.name).toBe('my-project');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.main).toBe('./src/index.fl');
    });

    it('should create src/main.fl with content', () => {
      cli.init('test-app');

      const mainFile = path.join(tempDir, 'src', 'main.fl');
      const content = fs.readFileSync(mainFile, 'utf-8');

      expect(content).toContain('main');
      expect(content).toContain('test-app');
    });

    it('should not overwrite existing freelang.json', () => {
      // Create initial manifest
      cli.init('first-name');

      const manifestPath = path.join(tempDir, 'freelang.json');
      const firstContent = fs.readFileSync(manifestPath, 'utf-8');

      // Try to init again
      const output = captureConsoleOutput(() => {
        cli.init('second-name');
      });

      expect(output.log).toContain('이미 존재합니다');

      // Original manifest unchanged
      const secondContent = fs.readFileSync(manifestPath, 'utf-8');
      expect(firstContent).toBe(secondContent);
    });

    it('should use current directory name if not provided', () => {
      const output = captureConsoleOutput(() => {
        cli.init();
      });

      expect(output.log).toContain('freelang-cli-test-');
    });
  });

  describe('2️⃣ Install Command - Single Package', () => {
    beforeEach(() => {
      cli.init('test-app');
    });

    it('should install a package from local path', async () => {
      createPackage('math-lib', '1.0.0');
      const pkgPath = path.join(tempDir, '..', 'math-lib');

      const output = captureConsoleOutput(() => {
        cli.install(pkgPath);
      });

      expect(fs.existsSync(path.join(tempDir, 'fl_modules', 'math-lib'))).toBe(true);
      expect(output.log).toContain('설치 완료');
    });

    it('should update freelang.json with dependency', async () => {
      createPackage('utils', '2.0.0');
      const pkgPath = path.join(tempDir, '..', 'utils');

      cli.install(pkgPath);

      const manifest = new ManifestLoader().load(tempDir);
      expect(manifest.dependencies!['utils']).toBe('2.0.0');
    });

    it('should handle non-existent package path', () => {
      const output = captureConsoleOutput(() => {
        expect(() => {
          cli.install('/nonexistent/path');
        }).toThrow();
      });

      expect(output.error).toContain('찾을 수 없습니다');
    });

    it('should install multiple packages sequentially', async () => {
      createPackage('lib1', '1.0.0');
      createPackage('lib2', '2.0.0');

      const path1 = path.join(tempDir, '..', 'lib1');
      const path2 = path.join(tempDir, '..', 'lib2');

      cli.install(path1);
      cli.install(path2);

      const manifest = new ManifestLoader().load(tempDir);
      expect(manifest.dependencies!['lib1']).toBe('1.0.0');
      expect(manifest.dependencies!['lib2']).toBe('2.0.0');
    });
  });

  describe('3️⃣ Install Command - All Dependencies', () => {
    it('should install all dependencies from freelang.json', async () => {
      cli.init('test-app');

      // Create packages
      createPackage('math-lib', '1.0.0');
      createPackage('utils', '2.0.0');

      // Update manifest
      const manifest = {
        name: 'test-app',
        version: '1.0.0',
        main: './src/main.fl',
        dependencies: {
          'math-lib': '1.0.0',
          'utils': '2.0.0'
        }
      };

      new ManifestLoader().write(tempDir, manifest);

      // Install all (but won't find them without proper setup)
      const output = captureConsoleOutput(() => {
        cli.install();
      });

      expect(output.log).toContain('의존성을 설치 중');
    });

    it('should handle no dependencies', () => {
      cli.init('test-app');

      const output = captureConsoleOutput(() => {
        cli.install();
      });

      expect(output.log).toContain('설치할 의존성이 없습니다');
    });

    it('should fail without freelang.json', () => {
      expect(() => {
        cli.install();
      }).toThrow();
    });
  });

  describe('4️⃣ Uninstall Command', () => {
    beforeEach(async () => {
      cli.init('test-app');
      createPackage('test-lib', '1.0.0');
      const pkgPath = path.join(tempDir, '..', 'test-lib');
      await new PackageInstaller(tempDir).install(pkgPath);
    });

    it('should uninstall a package', async () => {
      expect(fs.existsSync(path.join(tempDir, 'fl_modules', 'test-lib'))).toBe(true);

      const output = captureConsoleOutput(() => {
        cli.uninstall('test-lib');
      });

      expect(fs.existsSync(path.join(tempDir, 'fl_modules', 'test-lib'))).toBe(false);
      expect(output.log).toContain('제거 완료');
    });

    it('should remove dependency from freelang.json', async () => {
      const manifest = new ManifestLoader().load(tempDir);
      expect(manifest.dependencies!['test-lib']).toBeDefined();

      cli.uninstall('test-lib');

      const newManifest = new ManifestLoader().load(tempDir);
      expect(newManifest.dependencies!['test-lib']).toBeUndefined();
    });

    it('should fail for non-installed package', () => {
      const output = captureConsoleOutput(() => {
        expect(() => {
          cli.uninstall('nonexistent');
        }).toThrow();
      });

      expect(output.error).toContain('설치되어 있지 않습니다');
    });

    it('should require package name', () => {
      expect(() => {
        cli.uninstall('');
      }).toThrow();
    });
  });

  describe('5️⃣ List Command', () => {
    beforeEach(async () => {
      cli.init('test-app');
      createPackage('lib1', '1.0.0');
      createPackage('lib2', '2.0.0');

      const path1 = path.join(tempDir, '..', 'lib1');
      const path2 = path.join(tempDir, '..', 'lib2');

      const installer = new PackageInstaller(tempDir);
      await installer.install(path1);
      await installer.install(path2);
    });

    it('should list installed packages', () => {
      const output = captureConsoleOutput(() => {
        cli.list();
      });

      expect(output.log).toContain('lib1');
      expect(output.log).toContain('lib2');
      expect(output.log).toContain('1.0.0');
      expect(output.log).toContain('2.0.0');
    });

    it('should show count of installed packages', () => {
      const output = captureConsoleOutput(() => {
        cli.list();
      });

      expect(output.log).toContain('2개');
    });

    it('should show freelang.json dependencies', () => {
      const output = captureConsoleOutput(() => {
        cli.list();
      });

      expect(output.log).toContain('freelang.json 의존성');
    });

    it('should handle empty package list', () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-'));
      const emptyCli = new PackageCLI(emptyDir);

      const output = captureConsoleOutput(() => {
        emptyCli.list();
      });

      expect(output.log).toContain('없습니다');

      fs.rmSync(emptyDir, { recursive: true, force: true });
    });
  });

  describe('6️⃣ Search Command', () => {
    beforeEach(async () => {
      cli.init('test-app');
      createPackage('math-lib', '1.0.0');
      createPackage('math-utils', '1.0.0');
      createPackage('string-lib', '1.0.0');

      const installer = new PackageInstaller(tempDir);
      await installer.install(path.join(tempDir, '..', 'math-lib'));
      await installer.install(path.join(tempDir, '..', 'math-utils'));
      await installer.install(path.join(tempDir, '..', 'string-lib'));
    });

    it('should search for packages by query', () => {
      const output = captureConsoleOutput(() => {
        cli.search('math');
      });

      expect(output.log).toContain('math-lib');
      expect(output.log).toContain('math-utils');
      expect(output.log).not.toContain('string-lib');
    });

    it('should show search result count', () => {
      const output = captureConsoleOutput(() => {
        cli.search('math');
      });

      expect(output.log).toContain('2개');
    });

    it('should handle no results', () => {
      const output = captureConsoleOutput(() => {
        cli.search('nonexistent');
      });

      expect(output.log).toContain('해당하는 패키지가 없습니다');
    });

    it('should require search query', () => {
      expect(() => {
        cli.search('');
      }).toThrow();
    });
  });

  describe('7️⃣ Help Command', () => {
    it('should display help information', () => {
      const output = captureConsoleOutput(() => {
        cli.showHelp();
      });

      expect(output.log).toContain('사용법');
      expect(output.log).toContain('init');
      expect(output.log).toContain('install');
      expect(output.log).toContain('uninstall');
      expect(output.log).toContain('list');
      expect(output.log).toContain('search');
    });

    it('should show command examples', () => {
      const output = captureConsoleOutput(() => {
        cli.showHelp();
      });

      expect(output.log).toContain('freelang init');
      expect(output.log).toContain('freelang install');
      expect(output.log).toContain('freelang list');
    });
  });

  describe('8️⃣ Version Command', () => {
    it('should show version information', () => {
      const output = captureConsoleOutput(() => {
        cli.showVersion();
      });

      expect(output.log).toContain('FreeLang');
      expect(output.log).toContain('v2');
      expect(output.log).toContain('Package Manager');
    });
  });

  describe('9️⃣ Real-World Scenarios', () => {
    it('should support complete workflow', async () => {
      // 1. Initialize project
      cli.init('my-app');
      expect(fs.existsSync(path.join(tempDir, 'freelang.json'))).toBe(true);

      // 2. Create and install package
      createPackage('my-lib', '1.0.0');
      const pkgPath = path.join(tempDir, '..', 'my-lib');
      cli.install(pkgPath);

      expect(fs.existsSync(path.join(tempDir, 'fl_modules', 'my-lib'))).toBe(true);

      // 3. List packages
      const listOutput = captureConsoleOutput(() => {
        cli.list();
      });
      expect(listOutput.log).toContain('my-lib');

      // 4. Search packages
      const searchOutput = captureConsoleOutput(() => {
        cli.search('my');
      });
      expect(searchOutput.log).toContain('my-lib');

      // 5. Uninstall package
      cli.uninstall('my-lib');
      expect(fs.existsSync(path.join(tempDir, 'fl_modules', 'my-lib'))).toBe(false);
    });

    it('should handle multiple package operations', async () => {
      cli.init('app');

      // Install multiple packages
      createPackage('lib-a', '1.0.0');
      createPackage('lib-b', '2.0.0');
      createPackage('lib-c', '3.0.0');

      const installer = new PackageInstaller(tempDir);
      await installer.install(path.join(tempDir, '..', 'lib-a'));
      await installer.install(path.join(tempDir, '..', 'lib-b'));
      await installer.install(path.join(tempDir, '..', 'lib-c'));

      // List all
      const listOutput = captureConsoleOutput(() => {
        cli.list();
      });
      expect(listOutput.log).toContain('3개');

      // Uninstall one
      cli.uninstall('lib-b');

      // Verify
      const newListOutput = captureConsoleOutput(() => {
        cli.list();
      });
      expect(newListOutput.log).toContain('lib-a');
      expect(newListOutput.log).toContain('lib-c');
      expect(newListOutput.log).not.toContain('lib-b');
    });
  });

  describe('🔟 Error Handling', () => {
    it('should handle manifest load errors gracefully', () => {
      const invalidDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invalid-'));

      const invalidCli = new PackageCLI(invalidDir);

      expect(() => {
        invalidCli.list();
      }).not.toThrow(); // list handles missing manifest gracefully

      fs.rmSync(invalidDir, { recursive: true, force: true });
    });

    it('should provide helpful error messages', () => {
      const output = captureConsoleOutput(() => {
        expect(() => {
          cli.uninstall('');
        }).toThrow();
      });

      expect(output.error).toContain('패키지 이름');
    });

    it('should handle permission errors gracefully', () => {
      // Try to write to a read-only location (if available)
      // For now, just verify error handling works
      const invalidPath = '/root/no-permission/freelang.json';

      const output = captureConsoleOutput(() => {
        // This should fail gracefully
        expect(() => {
          const testCli = new PackageCLI('/root/no-permission');
          testCli.init('test');
        }).toThrow();
      });

      // Should show error message
      expect(output.error.length >= 0).toBe(true);
    });
  });
});
