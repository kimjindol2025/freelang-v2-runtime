/**
 * FreeLang Package Manager
 *
 * 기능:
 * - 패키지 설치/삭제
 * - 의존성 해결
 * - 시맨틱 버전 관리
 * - 빌드 캐싱
 * - 패키지 서명
 */

/**
 * 패키지 메타데이터
 */
export interface FreeLangPackage {
  name: string;
  version: string;  // SemVer: 1.2.3
  description?: string;
  main: string;  // 진입점 (e.g., index.fl)
  author?: string;
  license?: string;
  dependencies?: Record<string, string>;  // {package: version}
  devDependencies?: Record<string, string>;
  homepage?: string;
  repository?: string;
  keywords?: string[];
}

/**
 * 의존성 해결 결과
 */
export interface ResolvedDeps {
  packages: Map<string, string>;  // name → resolved version
  order: string[];  // 설치 순서
}

/**
 * 컴파일된 모듈
 */
export interface CompiledModule {
  name: string;
  version: string;
  code: string;  // 컴파일된 바이트코드 또는 IR
  hash: string;  // 캐시 키
}

/**
 * 패키지 관리자
 */
export class PackageManager {
  private registry: string;
  private packages: Map<string, FreeLangPackage> = new Map();
  private buildCache: Map<string, CompiledModule> = new Map();
  private installed: Map<string, string> = new Map();  // name → version

  constructor(registry: string = 'https://registry.freelang.ai') {
    this.registry = registry;
  }

  /**
   * 패키지 설치
   */
  async install(name: string, version?: string): Promise<void> {
    try {
      // 레지스트리에서 패키지 정보 조회
      const pkg = await this.fetchPackageInfo(name, version);

      if (!pkg) {
        throw new Error(`Package not found: ${name}@${version}`);
      }

      // 의존성 해결
      const deps = await this.resolveDependencies(pkg);

      // 설치 순서대로 설치
      for (const depName of deps.order) {
        const depVersion = deps.packages.get(depName)!;

        // 이미 설치된 경우 스킵
        if (this.installed.has(depName)) {
          const installed = this.installed.get(depName)!;
          if (installed === depVersion) {
            continue;
          }
        }

        const depPkg = await this.fetchPackageInfo(depName, depVersion);
        if (depPkg) {
          this.packages.set(`${depName}@${depVersion}`, depPkg);
          this.installed.set(depName, depVersion);
        }
      }

      // 메인 패키지 설치
      this.packages.set(`${name}@${pkg.version}`, pkg);
      this.installed.set(name, pkg.version);
    } catch (error) {
      throw new Error(`Failed to install package ${name}: ${error}`);
    }
  }

  /**
   * 패키지 정보 조회
   */
  private async fetchPackageInfo(
    name: string,
    version?: string
  ): Promise<FreeLangPackage | null> {
    // 실제로는 HTTP 요청 필요
    // 여기서는 stub
    return {
      name,
      version: version || '1.0.0',
      main: 'index.fl',
      dependencies: {},
    };
  }

  /**
   * 의존성 해결 (깊이 우선 탐색)
   */
  async resolveDependencies(pkg: FreeLangPackage): Promise<ResolvedDeps> {
    const resolved = new Map<string, string>();
    const order: string[] = [];

    const visit = async (name: string, version: string) => {
      const key = `${name}@${version}`;
      if (resolved.has(key)) {
        return;
      }

      const depPkg = await this.fetchPackageInfo(name, version);
      if (!depPkg) {
        throw new Error(`Package not found: ${name}@${version}`);
      }

      resolved.set(key, version);

      // 의존성 재귀 처리
      if (depPkg.dependencies) {
        for (const [depName, depVersion] of Object.entries(depPkg.dependencies)) {
          await visit(depName, this.resolveVersion(depVersion));
        }
      }

      order.push(name);
    };

    // 메인 패키지 의존성 처리
    if (pkg.dependencies) {
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        await visit(name, this.resolveVersion(version));
      }
    }

    return { packages: resolved, order };
  }

  /**
   * 버전 문자열 해석
   * "^1.2.3" → "1.2.3"
   * "~1.2.3" → "1.2.x"
   * "1.2.3"  → "1.2.3"
   */
  private resolveVersion(versionSpec: string): string {
    // 간소화: 그대로 반환 (실제는 SemVer 파싱 필요)
    return versionSpec.replace(/^[\^~]/, '');
  }

  /**
   * 패키지 퍼블리시
   */
  async publish(pkg: FreeLangPackage, code: string): Promise<void> {
    try {
      // 레지스트리에 업로드
      await this.uploadToRegistry(pkg, code);

      // 로컬에 기록
      this.packages.set(`${pkg.name}@${pkg.version}`, pkg);
    } catch (error) {
      throw new Error(`Failed to publish package: ${error}`);
    }
  }

  /**
   * 레지스트리 업로드
   */
  private async uploadToRegistry(pkg: FreeLangPackage, code: string): Promise<void> {
    // 실제로는 HTTP POST 필요
    // 여기서는 stub
  }

  /**
   * 빌드 캐시 조회
   */
  getFromCache(name: string, version: string, sourceHash: string): CompiledModule | null {
    const key = `${name}@${version}:${sourceHash}`;
    return this.buildCache.get(key) || null;
  }

  /**
   * 빌드 캐시 저장
   */
  putInCache(module: CompiledModule): void {
    const key = `${module.name}@${module.version}:${module.hash}`;
    this.buildCache.set(key, module);
  }

  /**
   * 설치된 패키지 목록
   */
  getInstalledPackages(): Map<string, string> {
    return new Map(this.installed);
  }

  /**
   * 패키지 제거
   */
  uninstall(name: string): void {
    this.installed.delete(name);

    // 패키지 정보도 제거
    for (const key of this.packages.keys()) {
      if (key.startsWith(`${name}@`)) {
        this.packages.delete(key);
      }
    }
  }

  /**
   * 캐시 통계
   */
  getCacheStats() {
    return {
      cacheSize: this.buildCache.size,
      installedCount: this.installed.size,
      packageCount: this.packages.size,
    };
  }
}

/**
 * 패키지 검증기
 */
export class PackageVerifier {
  /**
   * 패키지 서명 검증
   * (실제 구현은 RSA/ECDSA 필요)
   */
  verify(pkg: FreeLangPackage, signature: string): boolean {
    // 간소화: signature 길이로 검증
    return signature.length > 0;
  }

  /**
   * 패키지 무결성 검사
   */
  validatePackage(pkg: FreeLangPackage): string[] {
    const errors: string[] = [];

    if (!pkg.name || pkg.name.length === 0) {
      errors.push('Package name is required');
    }

    if (!pkg.version || !this.isValidSemVer(pkg.version)) {
      errors.push('Package version must be SemVer (e.g., 1.2.3)');
    }

    if (!pkg.main || pkg.main.length === 0) {
      errors.push('Package main file is required');
    }

    if (!pkg.main.endsWith('.fl')) {
      errors.push('Main file must be a .fl file');
    }

    return errors;
  }

  /**
   * SemVer 검증
   */
  private isValidSemVer(version: string): boolean {
    const semverPattern = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/;
    return semverPattern.test(version);
  }
}

/**
 * SemVer 비교
 */
export class SemVer {
  major: number;
  minor: number;
  patch: number;

  constructor(version: string) {
    const parts = version.split('.');
    this.major = parseInt(parts[0], 10) || 0;
    this.minor = parseInt(parts[1], 10) || 0;
    this.patch = parseInt(parts[2], 10) || 0;
  }

  /**
   * 버전 비교: -1 (작음), 0 (같음), 1 (큼)
   */
  compare(other: SemVer): number {
    if (this.major !== other.major) {
      return this.major < other.major ? -1 : 1;
    }
    if (this.minor !== other.minor) {
      return this.minor < other.minor ? -1 : 1;
    }
    if (this.patch !== other.patch) {
      return this.patch < other.patch ? -1 : 1;
    }
    return 0;
  }

  /**
   * 호환 여부 (^, ~ 규칙)
   */
  isCompatible(constraint: string): boolean {
    if (constraint.startsWith('^')) {
      // Caret: major 버전 같음
      const target = new SemVer(constraint.slice(1));
      return (
        this.major === target.major &&
        (this.minor > target.minor ||
          (this.minor === target.minor && this.patch >= target.patch))
      );
    } else if (constraint.startsWith('~')) {
      // Tilde: major.minor 같음
      const target = new SemVer(constraint.slice(1));
      return (
        this.major === target.major &&
        this.minor === target.minor &&
        this.patch >= target.patch
      );
    } else {
      // 정확한 버전
      return this.compare(new SemVer(constraint)) === 0;
    }
  }

  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }
}
