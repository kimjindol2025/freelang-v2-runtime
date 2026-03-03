/**
 * Phase 5 Step 6: CLI Package Management
 *
 * freelang 명령줄 도구로 패키지를 관리합니다.
 *
 * 명령어:
 * - freelang init [project-name]
 * - freelang install [package-path]
 * - freelang uninstall [package-name]
 * - freelang list
 */

import * as fs from 'fs';
import * as path from 'path';
import { ManifestLoader, PackageManifest } from '../package/manifest';
import { PackageResolver } from '../package/package-resolver';
import { PackageInstaller } from '../package/package-installer';

/**
 * FreeLang Package Manager CLI
 */
export class PackageCLI {
  private projectRoot: string;
  private manifestLoader: ManifestLoader;
  private packageResolver: PackageResolver;
  private packageInstaller: PackageInstaller;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.manifestLoader = new ManifestLoader();
    this.packageResolver = new PackageResolver(projectRoot);
    this.packageInstaller = new PackageInstaller(projectRoot);
  }

  /**
   * 프로젝트 초기화
   *
   * @param projectName 프로젝트 이름 (기본값: 현재 디렉토리명)
   */
  public init(projectName?: string): void {
    const name = projectName || path.basename(this.projectRoot);

    try {
      // freelang.json 파일 확인
      const manifestPath = path.join(this.projectRoot, 'freelang.json');

      if (fs.existsSync(manifestPath)) {
        console.log('⚠️  freelang.json이 이미 존재합니다.');
        return;
      }

      // 프로젝트 디렉토리 생성
      if (!fs.existsSync(this.projectRoot)) {
        fs.mkdirSync(this.projectRoot, { recursive: true });
      }

      // 기본 매니페스트 생성
      const manifest = ManifestLoader.createDefault(name);

      // src 디렉토리 생성
      const srcDir = path.join(this.projectRoot, 'src');
      if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir, { recursive: true });
      }

      // main.fl 파일 생성
      const mainFile = path.join(srcDir, 'main.fl');
      if (!fs.existsSync(mainFile)) {
        fs.writeFileSync(
          mainFile,
          `// ${name} - main entry point\n\nfn main() {\n  return "Hello, FreeLang!"\n}\n`
        );
      }

      // freelang.json 작성
      this.manifestLoader.write(this.projectRoot, manifest);

      console.log('✅ 프로젝트 초기화 완료!');
      console.log(`   프로젝트명: ${name}`);
      console.log(`   위치: ${this.projectRoot}`);
      console.log(`   파일:`);
      console.log(`   - freelang.json`);
      console.log(`   - src/main.fl`);
      console.log(`\n다음 단계:`);
      console.log(`   1. 의존성을 freelang.json에 추가`);
      console.log(`   2. freelang install로 패키지 설치`);
    } catch (error) {
      console.error('❌ 프로젝트 초기화 실패:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  /**
   * 패키지 설치
   *
   * @param packagePathOrName 패키지 경로 또는 이름
   * @param version 버전 (선택)
   */
  public async install(packagePathOrName?: string, version?: string): Promise<void> {
    try {
      // freelang.json 확인
      const manifestPath = path.join(this.projectRoot, 'freelang.json');
      if (!fs.existsSync(manifestPath)) {
        console.error(
          '❌ freelang.json을 찾을 수 없습니다.\n' +
          '   먼저 "freelang init"을 실행하세요.'
        );
        process.exit(1);
      }

      // 패키지 경로 지정된 경우
      if (packagePathOrName) {
        // 로컬 경로에서 설치
        if (fs.existsSync(packagePathOrName)) {
          console.log(`📦 패키지 설치 중: ${packagePathOrName}`);
          await this.packageInstaller.install(packagePathOrName, version);
          console.log('✅ 패키지 설치 완료!');
        } else {
          console.error(`❌ 패키지 경로를 찾을 수 없습니다: ${packagePathOrName}`);
          process.exit(1);
        }
      } else {
        // 모든 의존성 설치
        console.log('📦 freelang.json의 의존성을 설치 중...');

        const manifest = this.manifestLoader.load(this.projectRoot);
        const deps = manifest.dependencies || {};

        if (Object.keys(deps).length === 0) {
          console.log('ℹ️  설치할 의존성이 없습니다.');
          return;
        }

        console.log(`\n설치할 패키지: ${Object.keys(deps).length}개\n`);

        let installedCount = 0;
        for (const [name, versionRange] of Object.entries(deps)) {
          // 로컬 경로에서 찾기 (현재는 수동으로 설치된 경우만 지원)
          const localPath = path.join(this.projectRoot, '..', name);

          if (fs.existsSync(localPath)) {
            try {
              console.log(`  📦 ${name}@${versionRange}...`);
              await this.packageInstaller.install(localPath, versionRange as string);
              installedCount++;
              console.log(`     ✅ 설치 완료`);
            } catch (error) {
              console.log(
                `     ⚠️  설치 실패 (로컬 경로 없음)`
              );
            }
          } else {
            console.log(
              `  ⚠️  ${name}@${versionRange}\n` +
              `     경로: ../${name} (찾을 수 없음)`
            );
          }
        }

        if (installedCount > 0) {
          console.log(`\n✅ ${installedCount}개 패키지 설치 완료!`);
        } else {
          console.log('\n⚠️  설치된 패키지가 없습니다.');
          console.log(
            '   freelang.json에 의존성을 추가하고,\n' +
            '   로컬 경로에 패키지를 배치한 후 다시 시도하세요.'
          );
        }
      }
    } catch (error) {
      console.error('❌ 패키지 설치 실패:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  /**
   * 패키지 제거
   *
   * @param packageName 패키지 이름
   */
  public async uninstall(packageName: string): Promise<void> {
    try {
      if (!packageName) {
        console.error('❌ 패키지 이름을 지정하세요.');
        console.error('   사용법: freelang uninstall <package-name>');
        process.exit(1);
      }

      // 패키지 설치 여부 확인
      const installedPackages = this.packageResolver.getInstalledPackages();

      if (!installedPackages.includes(packageName)) {
        console.error(`❌ 패키지 '${packageName}'이(가) 설치되어 있지 않습니다.`);
        console.error('   설치된 패키지: ' + (installedPackages.length > 0 ? installedPackages.join(', ') : '없음'));
        process.exit(1);
      }

      // 패키지 제거
      console.log(`🗑️  패키지 제거 중: ${packageName}`);
      await this.packageInstaller.uninstall(packageName);
      console.log('✅ 패키지 제거 완료!');
    } catch (error) {
      console.error('❌ 패키지 제거 실패:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  /**
   * 설치된 패키지 목록 조회
   */
  public list(): void {
    try {
      const packages = this.packageResolver.getInstalledPackages();

      if (packages.length === 0) {
        console.log('📦 설치된 패키지가 없습니다.');
        console.log('   패키지를 설치하려면: freelang install <package-path>');
        return;
      }

      console.log(`📦 설치된 패키지 (${packages.length}개):\n`);

      for (const packageName of packages) {
        try {
          const resolved = this.packageResolver.resolve(packageName);
          const version = resolved.version;
          const mainPath = path.relative(this.projectRoot, resolved.main);

          console.log(`  ✓ ${packageName}`);
          console.log(`    버전: ${version}`);
          console.log(`    경로: ${mainPath}`);
          console.log('');
        } catch {
          console.log(`  ✗ ${packageName}`);
          console.log('    (Manifest 읽기 실패)');
          console.log('');
        }
      }

      // 프로젝트 의존성 표시
      try {
        const manifest = this.manifestLoader.load(this.projectRoot);
        if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
          console.log('📋 freelang.json 의존성:\n');
          for (const [name, version] of Object.entries(manifest.dependencies)) {
            const status = packages.includes(name) ? '✓' : '✗';
            console.log(`  ${status} ${name}@${version}`);
          }
        }
      } catch {
        // freelang.json이 없을 수 있음
      }
    } catch (error) {
      console.error('❌ 패키지 목록 조회 실패:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  /**
   * 패키지 검색
   *
   * @param query 검색어
   */
  public search(query: string): void {
    try {
      if (!query) {
        console.error('❌ 검색어를 지정하세요.');
        console.error('   사용법: freelang search <query>');
        process.exit(1);
      }

      const allPackages = this.packageResolver.getInstalledPackages();
      const results = this.packageResolver.findPackage(query);

      if (results.length === 0) {
        console.log(`🔍 "${query}"에 해당하는 패키지가 없습니다.`);
        console.log(`   설치된 패키지: ${allPackages.length}개`);
        if (allPackages.length > 0) {
          console.log('   ' + allPackages.join(', '));
        }
        return;
      }

      console.log(`🔍 "${query}" 검색 결과 (${results.length}개):\n`);

      for (const packageName of results) {
        try {
          const resolved = this.packageResolver.resolve(packageName);
          console.log(`  ✓ ${packageName}@${resolved.version}`);
        } catch {
          console.log(`  ✗ ${packageName}`);
        }
      }
    } catch (error) {
      console.error('❌ 패키지 검색 실패:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  /**
   * 도움말 표시
   */
  public showHelp(): void {
    console.log(`
FreeLang Package Manager - 패키지 관리 도구

사용법:
  freelang <command> [options]

명령어:
  init [project-name]     프로젝트 초기화 (freelang.json 생성)
  install [package-path]  패키지 설치
                          (경로 없으면 freelang.json의 모든 의존성 설치)
  uninstall <package>     패키지 제거
  list                    설치된 패키지 목록 조회
  search <query>          패키지 검색
  help                    도움말 표시

예제:
  freelang init my-app
  freelang install ../math-lib
  freelang list
  freelang uninstall math-lib
  freelang search math

설정:
  freelang.json 파일에서 의존성 관리
    {
      "name": "my-app",
      "version": "1.0.0",
      "dependencies": {
        "math-lib": "^1.0.0",
        "utils": "~2.0.0"
      }
    }
    `);
  }

  /**
   * 버전 정보 표시
   */
  public showVersion(): void {
    console.log('FreeLang v2.0.0 - Package Manager');
    console.log('Phase 5 Step 6: CLI Commands');
  }
}

/**
 * CLI 메인 진입점
 */
export async function runCLI(args: string[]): Promise<void> {
  const command = args[0];
  const projectRoot = process.cwd();
  const cli = new PackageCLI(projectRoot);

  switch (command) {
    case 'init':
      cli.init(args[1]);
      break;

    case 'install':
      await cli.install(args[1], args[2]);
      break;

    case 'uninstall':
      await cli.uninstall(args[1]);
      break;

    case 'list':
      cli.list();
      break;

    case 'search':
      cli.search(args[1]);
      break;

    case 'help':
    case '--help':
    case '-h':
      cli.showHelp();
      break;

    case 'version':
    case '--version':
    case '-v':
      cli.showVersion();
      break;

    default:
      if (command) {
        console.error(`❌ 알 수 없는 명령어: ${command}`);
      }
      console.error('사용법: freelang <command>');
      console.error('도움말: freelang help');
      process.exit(1);
  }
}
