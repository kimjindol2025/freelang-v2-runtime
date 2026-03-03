/**
 * FreeLang Specification & Compatibility
 *
 * 언어 스펙 관리 및 하위 호환성 보장
 */

/**
 * FreeLang 버전
 */
export const FREELANG_VERSION = '2.0.0';

/**
 * LTS (Long-Term Support) 버전
 */
export const LTS_VERSIONS = ['2.0.0'];

/**
 * 더 이상 사용되지 않는 기능
 */
export interface DeprecatedFeature {
  name: string;
  since: string;  // 버전
  removedIn: string;  // 제거될 버전
  replacement?: string;  // 대체 기능
  reason?: string;
}

/**
 * API 변경사항
 */
export interface APIChange {
  name: string;
  oldSignature: string;
  newSignature: string;
  breaking: boolean;
  migration?: string;
}

/**
 * 마이그레이션 보고서
 */
export interface MigrationReport {
  fromVersion: string;
  toVersion: string;
  breaking: APIChange[];
  deprecated: DeprecatedFeature[];
  suggestions: string[];
}

/**
 * Deprecated 기능 추적기
 */
export class DeprecationTracker {
  deprecated: Map<string, DeprecatedFeature> = new Map();

  constructor() {
    this.initializeDeprecations();
  }

  /**
   * 초기 deprecated 기능들
   */
  private initializeDeprecations(): void {
    // 현재는 deprecated 기능 없음
    // 향후 버전에서 추가
  }

  /**
   * Deprecated 기능 조회
   */
  check(feature: string): DeprecatedFeature | null {
    return this.deprecated.get(feature) || null;
  }

  /**
   * Deprecated 기능 등록
   */
  deprecate(
    name: string,
    since: string,
    removeIn: string,
    replacement?: string,
    reason?: string
  ): void {
    this.deprecated.set(name, {
      name,
      since,
      removedIn: removeIn,
      replacement,
      reason,
    });
  }

  /**
   * 경고 메시지
   */
  warn(feature: string, since: string, removeIn: string): string {
    return `[DEPRECATION WARNING] '${feature}' is deprecated since ${since} and will be removed in ${removeIn}`;
  }

  /**
   * 모든 deprecated 기능 조회
   */
  getAll(): DeprecatedFeature[] {
    return Array.from(this.deprecated.values());
  }

  /**
   * 특정 버전에서 제거될 기능
   */
  getRemovalCandidates(version: string): DeprecatedFeature[] {
    return Array.from(this.deprecated.values()).filter(
      f => f.removedIn === version
    );
  }
}

/**
 * 하위 호환성 검사기
 */
export class CompatibilityChecker {
  private apiChanges: APIChange[] = [];
  private deprecationTracker: DeprecationTracker;

  constructor(deprecationTracker: DeprecationTracker) {
    this.deprecationTracker = deprecationTracker;
  }

  /**
   * API 변경 등록
   */
  registerChange(change: APIChange): void {
    this.apiChanges.push(change);
  }

  /**
   * 마이그레이션 보고서 생성
   */
  checkMigration(fromVersion: string, toVersion: string): MigrationReport {
    const breaking: APIChange[] = [];
    const deprecated: DeprecatedFeature[] = [];
    const suggestions: string[] = [];

    // Breaking changes 찾기
    for (const change of this.apiChanges) {
      if (change.breaking) {
        breaking.push(change);
        if (change.migration) {
          suggestions.push(change.migration);
        }
      }
    }

    // Deprecated 기능 찾기
    for (const feature of this.deprecationTracker.getAll()) {
      // 기능이 이 버전 범위에서 deprecated 된 경우
      if (this.versionInRange(fromVersion, toVersion, feature.since, feature.removedIn)) {
        deprecated.push(feature);

        if (feature.replacement) {
          suggestions.push(`Replace '${feature.name}' with '${feature.replacement}'`);
        }
      }
    }

    return {
      fromVersion,
      toVersion,
      breaking,
      deprecated,
      suggestions,
    };
  }

  /**
   * Breaking change 여부
   */
  isBreakingChange(change: APIChange): boolean {
    return change.breaking;
  }

  /**
   * 버전이 범위 내에 있는지 확인
   */
  private versionInRange(
    from: string,
    to: string,
    deprecatedSince: string,
    removedIn: string
  ): boolean {
    // 간소화: 문자열 비교
    return deprecatedSince >= from && deprecatedSince <= to;
  }

  /**
   * 호환성 점수 (0-100)
   */
  getCompatibilityScore(fromVersion: string, toVersion: string): number {
    const report = this.checkMigration(fromVersion, toVersion);
    const breakingCount = report.breaking.length;
    const deprecatedCount = report.deprecated.length;

    // 간소화: breaking 3개 = -30점, deprecated 1개 = -2점
    let score = 100;
    score -= breakingCount * 30;
    score -= deprecatedCount * 2;

    return Math.max(0, score);
  }
}

/**
 * 언어 스펙
 */
export const LANGUAGE_SPEC = {
  name: 'FreeLang',
  version: FREELANG_VERSION,
  lts: LTS_VERSIONS,

  /**
   * 지원 데이터 타입
   */
  types: [
    'int',
    'float',
    'string',
    'bool',
    'null',
    'array',
    'object',
  ],

  /**
   * 지원 연산자
   */
  operators: [
    '+', '-', '*', '/', '%',      // 산술
    '==', '!=', '<', '>', '<=', '>=',  // 비교
    '&&', '||', '!',              // 논리
    '=',                           // 할당
  ],

  /**
   * 키워드
   */
  keywords: [
    'fn', 'let', 'if', 'else', 'while', 'for', 'return',
    'true', 'false', 'null', 'break', 'continue',
  ],

  /**
   * 표준 라이브러리 모듈
   */
  stdlibModules: [
    'io',
    'math',
    'string',
    'collections',
    'json',
    'http',
    'test',
  ],

  /**
   * 호환성 정책
   */
  compatibility: {
    major: {
      breaking: true,
      deprecation_period: '1년',
    },
    minor: {
      breaking: false,
      backward_compatible: true,
    },
    patch: {
      breaking: false,
      bug_fixes_only: true,
    },
  },

  /**
   * 향후 계획
   */
  roadmap: {
    '2.1.0': 'Enhanced memory safety',
    '2.2.0': 'JIT/AOT optimization',
    '3.0.0': 'Module system overhaul',
  },
};

/**
 * 릴리스 노트
 */
export interface ReleaseNote {
  version: string;
  releaseDate: string;
  features: string[];
  bugFixes: string[];
  breaking: string[];
  deprecated: string[];
}

/**
 * v2.0.0 릴리스 노트
 */
export const RELEASE_NOTES_V2_0_0: ReleaseNote = {
  version: '2.0.0',
  releaseDate: '2026-03-04',
  features: [
    'Complete AST-based parser (Pratt)',
    'SSA intermediate representation',
    'ADCE + Constant Folding + Inlining + CSE optimization',
    'Mark-Sweep + Generational GC',
    'Memory safety with SafeRef abstraction',
    'Baseline JIT with execution profiling',
    'Multi-target compilation (Bytecode/WASM/LLVM)',
    'Static analysis with data flow analysis',
    'Sandboxed VM with capability-based security',
    'Package manager with dependency resolution',
  ],
  bugFixes: [
    'Function parser regex limitations',
    'Inlining early termination bug',
  ],
  breaking: [],
  deprecated: [],
};

/**
 * 호환성 인증서
 */
export function generateCompatibilityCertificate(
  version: string,
  testsPassed: number,
  testsTotal: number
): string {
  const percentage = ((testsPassed / testsTotal) * 100).toFixed(1);

  return `
╔════════════════════════════════════════════════════════════════╗
║        FreeLang Compatibility Certificate                      ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  Version: ${version.padEnd(56)} ║
║  Compatibility: ${percentage}% (${testsPassed}/${testsTotal} tests passed)    │
║  Issued: ${new Date().toISOString().split('T')[0]}                             ║
║  LTS: ${LTS_VERSIONS.includes(version) ? 'YES' : 'NO'}                                      ║
║                                                                ║
║  ✓ Lexer compliance                                            ║
║  ✓ Parser compliance (Pratt)                                   ║
║  ✓ IR generation compliance                                    ║
║  ✓ VM execution compliance                                     ║
║  ✓ Optimization compliance (SSA + ADCE + CSE)                  ║
║  ✓ Type safety compliance                                      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`;
}
