/**
 * Phase 4 Step 3: Module System - Module Resolver
 * Phase 5 Step 5: Package Integration
 *
 * 모듈 파일을 찾고, 로드하고, 캐싱하며, 순환 의존성을 감지합니다.
 * Phase 5에서 PackageResolver와 통합되어 패키지 기반 import를 지원합니다.
 */

import * as path from 'path';
import * as fs from 'fs';
import { Lexer } from '../lexer/lexer';
import { TokenBuffer } from '../lexer/lexer';
import { Parser } from '../parser/parser';
import {
  Module,
  ExportStatement,
  FunctionStatement,
  VariableDeclaration,
  ParseError
} from '../parser/ast';
import { PackageManifest } from '../package/manifest';
import type { PackageResolver } from '../package/package-resolver';

/**
 * 내보내기 심볼 (함수 또는 변수)
 */
export interface ExportSymbol {
  name: string;
  type: 'function' | 'variable';
  declaration: FunctionStatement | VariableDeclaration;
}

/**
 * Module Resolver - 모듈 시스템의 핵심
 *
 * 역할:
 * 1. 모듈 경로 해석 (상대/절대 경로 + 패키지 이름)
 * 2. 모듈 파일 로드 및 파싱
 * 3. 모듈 캐싱 (중복 파싱 방지)
 * 4. 순환 의존성 감지
 * 5. 내보내기 심볼 추출
 * 6. 패키지 기반 모듈 해석 (Phase 5 통합)
 */
export class ModuleResolver {
  // 모듈 캐시: 경로 → 파싱된 Module
  private moduleCache: Map<string, Module> = new Map();

  // 로딩 중인 모듈: 순환 의존성 감지용
  private loadingModules: Set<string> = new Set();

  // 패키지 해석기 (Phase 5 통합)
  private packageResolver?: PackageResolver;

  // 프로젝트 매니페스트 (Version range 적용용)
  private projectManifest?: PackageManifest;

  // 프로젝트 루트 (패키지 해석용)
  private projectRoot?: string;

  /**
   * PackageResolver 설정 (Phase 5 통합)
   *
   * ModuleResolver가 패키지 기반 import를 해석할 수 있도록
   * PackageResolver 인스턴스를 주입합니다.
   *
   * @param resolver PackageResolver 인스턴스
   */
  public setPackageResolver(resolver: PackageResolver): void {
    this.packageResolver = resolver;
  }

  /**
   * 프로젝트 매니페스트 설정 (Phase 5 통합)
   *
   * 패키지 import 시 version range를 적용하기 위해
   * 프로젝트의 freelang.json 내용을 설정합니다.
   *
   * @param manifest 프로젝트의 PackageManifest
   */
  public setProjectManifest(manifest: PackageManifest): void {
    this.projectManifest = manifest;
  }

  /**
   * 프로젝트 루트 디렉토리 설정 (Phase 5 통합)
   *
   * 패키지 해석 시 기준이 되는 프로젝트 루트를 설정합니다.
   *
   * @param root 프로젝트 루트 디렉토리 경로
   */
  public setProjectRoot(root: string): void {
    this.projectRoot = root;
  }

  /**
   * 모듈 경로 해석
   *
   * 상대 경로: ./path, ../path → 절대 경로로 변환
   * 절대 경로: /path → 그대로 사용
   * 패키지 이름: package-name → fl_modules/package-name/src/index.fl
   *
   * @param fromFile 현재 파일 경로
   * @param modulePath 참조하는 모듈 경로
   * @returns 절대 경로
   * @throws 패키지를 찾을 수 없거나 PackageResolver가 설정되지 않으면 에러
   */
  public resolveModulePath(fromFile: string, modulePath: string): string {
    // 상대 경로 처리
    if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
      const dir = path.dirname(fromFile);
      return path.resolve(dir, modulePath);
    }

    // 절대 경로 처리 (그대로 반환)
    if (modulePath.startsWith('/')) {
      return modulePath;
    }

    // 패키지 이름 처리 (Phase 5 통합)
    if (this.packageResolver) {
      try {
        // projectManifest에서 version range 추출
        const versionRange = this.projectManifest?.dependencies?.[modulePath];
        const resolved = this.packageResolver.resolve(modulePath, versionRange);
        return resolved.main;
      } catch (error) {
        throw new Error(
          `패키지 해석 실패 '${modulePath}': ${error}`
        );
      }
    }

    // PackageResolver가 없으면 패키지 이름 지원 안 함
    throw new Error(
      `패키지 기반 import는 지원하지 않습니다: '${modulePath}'\n` +
      `파일 경로를 사용하세요: ./path.fl 또는 ../path.fl`
    );
  }

  /**
   * 모듈 로드
   *
   * 1. 캐시에서 확인
   * 2. 순환 의존성 확인
   * 3. 파일 읽기
   * 4. 파싱
   * 5. 캐싱
   *
   * @param modulePath 모듈 파일의 절대 경로
   * @returns 파싱된 Module
   * @throws 파일이 없거나 순환 의존성이 있으면 에러
   */
  public loadModule(modulePath: string): Module {
    // Step 1: 캐시 확인
    if (this.moduleCache.has(modulePath)) {
      return this.moduleCache.get(modulePath)!;
    }

    // Step 2: 순환 의존성 확인
    if (this.loadingModules.has(modulePath)) {
      throw new Error(
        `순환 의존성 감지됨: ${modulePath}\n` +
        `로딩 중인 모듈들: ${Array.from(this.loadingModules).join(' → ')} → ${modulePath}`
      );
    }

    // Step 3: 로딩 중으로 표시
    this.loadingModules.add(modulePath);

    try {
      // Step 4: 파일 읽기
      if (!fs.existsSync(modulePath)) {
        throw new Error(`모듈 파일을 찾을 수 없습니다: ${modulePath}`);
      }

      let code: string;
      try {
        code = fs.readFileSync(modulePath, 'utf-8');
      } catch (e) {
        if (e instanceof Error) {
          throw new Error(`모듈 파일을 읽을 수 없습니다: ${modulePath}\n${e.message}`);
        }
        throw e;
      }

      // Step 5: 파싱
      let module: Module;
      try {
        const lexer = new Lexer(code);
        const tokens = new TokenBuffer(lexer);
        const parser = new Parser(tokens);
        // parser에 파일 경로 설정 (에러 메시지용)
        (parser as any).setCurrentFilePath?.(modulePath);

        // parseProgram() 메서드가 있는지 확인하고, 없으면 parseStatement() 반복 사용
        const statements = [];
        while (true) {
          try {
            const stmt = parser.parseStatement();
            if (stmt) {
              statements.push(stmt);
            } else {
              break;
            }
          } catch (e) {
            if (e instanceof ParseError) {
              // 파일 끝에 도달했거나 다른 파싱 에러
              break;
            }
            throw e;
          }
        }

        // Module 구조로 변환
        module = {
          path: modulePath,
          imports: statements.filter(s => s.type === 'import') as any[],
          exports: statements.filter(s => s.type === 'export') as any[],
          statements: statements
        };
      } catch (e) {
        if (e instanceof ParseError) {
          throw new Error(
            `${modulePath} 파싱 에러:\n${e.message}`
          );
        }
        throw e;
      }

      // Step 6: 캐싱
      this.moduleCache.set(modulePath, module);

      // Step 7: 로딩 완료 표시
      this.loadingModules.delete(modulePath);

      return module;
    } catch (error) {
      // 에러 발생 시 로딩 중 표시 제거
      this.loadingModules.delete(modulePath);
      throw error;
    }
  }

  /**
   * 모듈의 내보내기 심볼 추출
   *
   * @param module 파싱된 Module
   * @returns 내보내기 심볼 배열
   */
  public getExports(module: Module): ExportSymbol[] {
    const exports: ExportSymbol[] = [];

    for (const exportStmt of module.exports) {
      const decl = exportStmt.declaration;

      if (decl.type === 'function') {
        const fn = decl as FunctionStatement;
        exports.push({
          name: fn.name,
          type: 'function',
          declaration: fn
        });
      } else if (decl.type === 'variable') {
        const varDecl = decl as VariableDeclaration;
        exports.push({
          name: varDecl.name,
          type: 'variable',
          declaration: varDecl
        });
      }
    }

    return exports;
  }

  /**
   * 모듈의 내보내기 심볼을 Map으로 반환
   *
   * @param module 파싱된 Module
   * @returns 이름 → 심볼 Map
   */
  public getExportsAsMap(module: Module): Map<string, ExportSymbol> {
    const exports = this.getExports(module);
    const map = new Map<string, ExportSymbol>();

    for (const symbol of exports) {
      map.set(symbol.name, symbol);
    }

    return map;
  }

  /**
   * 모듈 캐시 초기화
   * (테스트용)
   */
  public clearCache(): void {
    this.moduleCache.clear();
  }

  /**
   * 캐시된 모듈 개수 반환
   * (테스트/디버깅용)
   */
  public getCacheSize(): number {
    return this.moduleCache.size;
  }

  /**
   * 캐시된 모듈 목록 반환
   * (디버깅용)
   */
  public getCachedModules(): string[] {
    return Array.from(this.moduleCache.keys());
  }

  /**
   * 모듈 로드 (편의 메서드)
   *
   * 현재 파일을 기준으로 모듈 경로를 해석하고 로드
   *
   * @param fromFile 현재 파일 경로
   * @param modulePath import에서 지정한 경로
   * @returns 파싱된 Module
   */
  public loadModuleFrom(fromFile: string, modulePath: string): Module {
    const resolvedPath = this.resolveModulePath(fromFile, modulePath);
    return this.loadModule(resolvedPath);
  }

  /**
   * 모듈 의존성 그래프 생성
   *
   * @param module 시작 모듈
   * @returns 모든 의존성 모듈 목록
   */
  public getDependencies(module: Module): Module[] {
    const dependencies: Module[] = [];
    const visited = new Set<string>();

    const visit = (mod: Module) => {
      if (visited.has(mod.path)) {
        return;
      }
      visited.add(mod.path);

      for (const importStmt of mod.imports) {
        try {
          const depModule = this.loadModuleFrom(mod.path, importStmt.from);
          dependencies.push(depModule);
          visit(depModule);
        } catch (e) {
          // 모듈 로드 실패는 무시 (Type Checking에서 확인)
        }
      }
    };

    visit(module);
    return dependencies;
  }
}

/**
 * 편의 함수: 단일 모듈 로드
 *
 * @param filePath 모듈 파일 경로
 * @returns 파싱된 Module
 */
export function loadModule(filePath: string): Module {
  const resolver = new ModuleResolver();
  return resolver.loadModule(filePath);
}

/**
 * 편의 함수: 모듈 경로 해석
 *
 * @param fromFile 현재 파일
 * @param modulePath 모듈 경로
 * @returns 절대 경로
 */
export function resolveModulePath(fromFile: string, modulePath: string): string {
  const resolver = new ModuleResolver();
  return resolver.resolveModulePath(fromFile, modulePath);
}
