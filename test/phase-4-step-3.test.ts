/**
 * Phase 4 Step 3: Module System - Module Resolver Tests
 *
 * 모듈 경로 해석, 로드, 캐싱, 순환 의존성 감지 테스트
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { ModuleResolver, loadModule, resolveModulePath, ExportSymbol } from '../src/module/module-resolver';
import { Module } from '../src/parser/ast';

// 테스트용 임시 디렉토리
const TEST_DIR = path.join(__dirname, 'fixtures', 'modules');

/**
 * 테스트 모듈 파일 생성
 */
function createTestModule(filePath: string, code: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, code, 'utf-8');
}

/**
 * 테스트 파일 정리
 */
function cleanupTestFiles(): void {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

describe('Phase 4 Step 3: Module Resolver', () => {
  beforeEach(() => {
    cleanupTestFiles();
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  describe('경로 해석 (resolveModulePath)', () => {
    let resolver: ModuleResolver;

    beforeEach(() => {
      resolver = new ModuleResolver();
    });

    it('상대 경로 (./)를 절대 경로로 변환', () => {
      const currentFile = '/project/src/main.fl';
      const modulePath = './math.fl';

      const resolved = resolver.resolveModulePath(currentFile, modulePath);

      expect(resolved).toBe('/project/src/math.fl');
    });

    it('부모 경로 (../)를 절대 경로로 변환', () => {
      const currentFile = '/project/src/app/main.fl';
      const modulePath = '../utils/helper.fl';

      const resolved = resolver.resolveModulePath(currentFile, modulePath);

      expect(resolved).toBe('/project/src/utils/helper.fl');
    });

    it('복합 경로 (../../)를 절대 경로로 변환', () => {
      const currentFile = '/project/src/app/nested/main.fl';
      const modulePath = '../../lib/core.fl';

      const resolved = resolver.resolveModulePath(currentFile, modulePath);

      expect(resolved).toBe('/project/lib/core.fl');
    });

    it('절대 경로 (/)는 그대로 반환', () => {
      const currentFile = '/project/src/main.fl';
      const modulePath = '/lib/constants.fl';

      const resolved = resolver.resolveModulePath(currentFile, modulePath);

      expect(resolved).toBe('/lib/constants.fl');
    });

    it('패키지 이름은 에러 발생', () => {
      const currentFile = '/project/src/main.fl';
      const modulePath = 'math-lib';

      expect(() => {
        resolver.resolveModulePath(currentFile, modulePath);
      }).toThrow('패키지 이름은 아직 지원하지 않습니다');
    });
  });

  describe('모듈 로드 (loadModule)', () => {
    let resolver: ModuleResolver;

    beforeEach(() => {
      resolver = new ModuleResolver();
    });

    it('단순 모듈 로드', () => {
      const mathFile = path.join(TEST_DIR, 'math.fl');
      createTestModule(mathFile, `
export fn add(a: number, b: number) -> number {
  return a + b
}

export let PI = 3.14159
      `);

      const module = resolver.loadModule(mathFile);

      expect(module.path).toBe(mathFile);
      expect(module.exports).toHaveLength(2);
      expect(module.imports).toHaveLength(0);
    });

    it('import가 있는 모듈 로드', () => {
      const mathFile = path.join(TEST_DIR, 'math.fl');
      const mainFile = path.join(TEST_DIR, 'main.fl');

      createTestModule(mathFile, `
export fn add(a: number, b: number) -> number {
  return a + b
}
      `);

      createTestModule(mainFile, `
import { add } from "./math.fl"

export let result = 10
      `);

      const module = resolver.loadModule(mainFile);

      expect(module.path).toBe(mainFile);
      expect(module.imports).toHaveLength(1);
      expect(module.imports[0].from).toBe('./math.fl');
    });

    it('파일이 없으면 에러 발생', () => {
      const nonExistentFile = path.join(TEST_DIR, 'nonexistent.fl');

      expect(() => {
        resolver.loadModule(nonExistentFile);
      }).toThrow('모듈 파일을 찾을 수 없습니다');
    });

    it('유효하지 않은 문법은 파싱 에러 발생', () => {
      const invalidFile = path.join(TEST_DIR, 'invalid.fl');
      createTestModule(invalidFile, `
export fn add(a: number, b: number {
  return a + b
}
      `);

      expect(() => {
        resolver.loadModule(invalidFile);
      }).toThrow();
    });
  });

  describe('모듈 캐싱', () => {
    let resolver: ModuleResolver;

    beforeEach(() => {
      resolver = new ModuleResolver();
    });

    it('같은 모듈을 두 번 로드하면 캐시 사용', () => {
      const mathFile = path.join(TEST_DIR, 'math.fl');
      createTestModule(mathFile, `
export fn add(a: number, b: number) -> number {
  return a + b
}
      `);

      const module1 = resolver.loadModule(mathFile);
      const module2 = resolver.loadModule(mathFile);

      // 같은 객체여야 함 (캐시)
      expect(module1).toBe(module2);
    });

    it('캐시 크기 반환', () => {
      const math1 = path.join(TEST_DIR, 'math1.fl');
      const math2 = path.join(TEST_DIR, 'math2.fl');

      createTestModule(math1, 'export let PI = 3.14159');
      createTestModule(math2, 'export let E = 2.71828');

      resolver.loadModule(math1);
      expect(resolver.getCacheSize()).toBe(1);

      resolver.loadModule(math2);
      expect(resolver.getCacheSize()).toBe(2);

      resolver.loadModule(math1); // 캐시된 것 로드
      expect(resolver.getCacheSize()).toBe(2); // 증가하지 않음
    });

    it('캐시 초기화', () => {
      const mathFile = path.join(TEST_DIR, 'math.fl');
      createTestModule(mathFile, 'export let PI = 3.14159');

      resolver.loadModule(mathFile);
      expect(resolver.getCacheSize()).toBe(1);

      resolver.clearCache();
      expect(resolver.getCacheSize()).toBe(0);
    });

    it('캐시된 모듈 목록 반환', () => {
      const math1 = path.join(TEST_DIR, 'math1.fl');
      const math2 = path.join(TEST_DIR, 'math2.fl');

      createTestModule(math1, 'export let PI = 3.14159');
      createTestModule(math2, 'export let E = 2.71828');

      resolver.loadModule(math1);
      resolver.loadModule(math2);

      const cached = resolver.getCachedModules();
      expect(cached).toContain(math1);
      expect(cached).toContain(math2);
      expect(cached).toHaveLength(2);
    });
  });

  describe('순환 의존성 감지', () => {
    let resolver: ModuleResolver;

    beforeEach(() => {
      resolver = new ModuleResolver();
    });

    it('간단한 순환 의존성 감지 (A → B → A)', () => {
      const fileA = path.join(TEST_DIR, 'a.fl');
      const fileB = path.join(TEST_DIR, 'b.fl');

      createTestModule(fileA, `
import { bFunc } from "./b.fl"
export fn aFunc() -> number { return 1 }
      `);

      createTestModule(fileB, `
import { aFunc } from "./a.fl"
export fn bFunc() -> number { return 2 }
      `);

      // fileA 로드 시도 → fileB 로드 → fileA 다시 로드 → 에러
      expect(() => {
        resolver.loadModule(fileA);
      }).toThrow('순환 의존성 감지됨');
    });

    it('3단계 순환 의존성 감지 (A → B → C → A)', () => {
      const fileA = path.join(TEST_DIR, 'a.fl');
      const fileB = path.join(TEST_DIR, 'b.fl');
      const fileC = path.join(TEST_DIR, 'c.fl');

      createTestModule(fileA, 'import { b } from "./b.fl"\nexport fn a() -> number { return 1 }');
      createTestModule(fileB, 'import { c } from "./c.fl"\nexport fn b() -> number { return 2 }');
      createTestModule(fileC, 'import { a } from "./a.fl"\nexport fn c() -> number { return 3 }');

      expect(() => {
        resolver.loadModule(fileA);
      }).toThrow('순환 의존성 감지됨');
    });

    it('순환 의존성이 없으면 정상 로드', () => {
      const fileA = path.join(TEST_DIR, 'a.fl');
      const fileB = path.join(TEST_DIR, 'b.fl');

      createTestModule(fileA, 'import { b } from "./b.fl"\nexport fn a() -> number { return 1 }');
      createTestModule(fileB, 'export fn b() -> number { return 2 }'); // import 없음

      expect(() => {
        resolver.loadModule(fileA);
      }).not.toThrow();
    });
  });

  describe('내보내기 심볼 추출 (getExports)', () => {
    let resolver: ModuleResolver;

    beforeEach(() => {
      resolver = new ModuleResolver();
    });

    it('함수 export 추출', () => {
      const mathFile = path.join(TEST_DIR, 'math.fl');
      createTestModule(mathFile, `
export fn add(a: number, b: number) -> number {
  return a + b
}

export fn subtract(a: number, b: number) -> number {
  return a - b
}
      `);

      const module = resolver.loadModule(mathFile);
      const exports = resolver.getExports(module);

      expect(exports).toHaveLength(2);
      expect(exports[0].name).toBe('add');
      expect(exports[0].type).toBe('function');
      expect(exports[1].name).toBe('subtract');
      expect(exports[1].type).toBe('function');
    });

    it('변수 export 추출', () => {
      const configFile = path.join(TEST_DIR, 'config.fl');
      createTestModule(configFile, `
export let PI = 3.14159
export let VERSION: string = "1.0.0"
export let MAX_ATTEMPTS = 3
      `);

      const module = resolver.loadModule(configFile);
      const exports = resolver.getExports(module);

      expect(exports).toHaveLength(3);
      expect(exports[0].name).toBe('PI');
      expect(exports[0].type).toBe('variable');
      expect(exports[1].name).toBe('VERSION');
      expect(exports[2].name).toBe('MAX_ATTEMPTS');
    });

    it('함수와 변수 export 모두 추출', () => {
      const utilsFile = path.join(TEST_DIR, 'utils.fl');
      createTestModule(utilsFile, `
export fn process(x: number) -> number {
  return x * 2
}

export let defaultValue = 10

export fn validate(x: number) -> bool {
  return x > 0
}
      `);

      const module = resolver.loadModule(utilsFile);
      const exports = resolver.getExports(module);

      expect(exports).toHaveLength(3);
      expect(exports[0].type).toBe('function');
      expect(exports[1].type).toBe('variable');
      expect(exports[2].type).toBe('function');
    });

    it('getExportsAsMap: Map 형식으로 export 반환', () => {
      const mathFile = path.join(TEST_DIR, 'math.fl');
      createTestModule(mathFile, `
export fn add(a: number, b: number) -> number {
  return a + b
}

export let PI = 3.14159
      `);

      const module = resolver.loadModule(mathFile);
      const exportsMap = resolver.getExportsAsMap(module);

      expect(exportsMap.size).toBe(2);
      expect(exportsMap.has('add')).toBe(true);
      expect(exportsMap.has('PI')).toBe(true);
      expect(exportsMap.get('add')!.type).toBe('function');
      expect(exportsMap.get('PI')!.type).toBe('variable');
    });
  });

  describe('편의 메서드 (loadModuleFrom)', () => {
    let resolver: ModuleResolver;

    beforeEach(() => {
      resolver = new ModuleResolver();
    });

    it('현재 파일을 기준으로 모듈 경로 해석 및 로드', () => {
      const mathFile = path.join(TEST_DIR, 'math.fl');
      const appDir = path.join(TEST_DIR, 'app');
      const mainFile = path.join(appDir, 'main.fl');

      createTestModule(mathFile, 'export fn add(a: number, b: number) -> number { return a + b }');
      createTestModule(mainFile, 'import { add } from "../math.fl"\nexport let result = 10');

      const module = resolver.loadModuleFrom(mainFile, '../math.fl');

      expect(module.path).toBe(mathFile);
      expect(module.exports).toHaveLength(1);
    });
  });

  describe('의존성 분석 (getDependencies)', () => {
    let resolver: ModuleResolver;

    beforeEach(() => {
      resolver = new ModuleResolver();
    });

    it('모듈의 모든 의존성 추출', () => {
      const mathFile = path.join(TEST_DIR, 'math.fl');
      const utilsFile = path.join(TEST_DIR, 'utils.fl');
      const mainFile = path.join(TEST_DIR, 'main.fl');

      createTestModule(mathFile, 'export let PI = 3.14159');
      createTestModule(utilsFile, 'export fn process(x: number) -> number { return x * 2 }');
      createTestModule(mainFile, `
import { PI } from "./math.fl"
import { process } from "./utils.fl"
export let result = 10
      `);

      const mainModule = resolver.loadModule(mainFile);
      const deps = resolver.getDependencies(mainModule);

      expect(deps).toHaveLength(2);
      // 순서는 import 순서대로
      expect(deps.some(m => m.path === mathFile)).toBe(true);
      expect(deps.some(m => m.path === utilsFile)).toBe(true);
    });

    it('깊은 의존성도 추출 (A → B → C)', () => {
      const fileC = path.join(TEST_DIR, 'c.fl');
      const fileB = path.join(TEST_DIR, 'b.fl');
      const fileA = path.join(TEST_DIR, 'a.fl');

      createTestModule(fileC, 'export fn c() -> number { return 3 }');
      createTestModule(fileB, `
import { c } from "./c.fl"
export fn b() -> number { return 2 }
      `);
      createTestModule(fileA, `
import { b } from "./b.fl"
export fn a() -> number { return 1 }
      `);

      const moduleA = resolver.loadModule(fileA);
      const deps = resolver.getDependencies(moduleA);

      expect(deps).toHaveLength(2); // B와 C
      expect(deps.some(m => m.path === fileB)).toBe(true);
      expect(deps.some(m => m.path === fileC)).toBe(true);
    });
  });

  describe('전역 편의 함수', () => {
    it('loadModule() 함수로 모듈 로드', () => {
      const mathFile = path.join(TEST_DIR, 'math.fl');
      createTestModule(mathFile, 'export fn add(a: number, b: number) -> number { return a + b }');

      const module = loadModule(mathFile);

      expect(module.path).toBe(mathFile);
      expect(module.exports).toHaveLength(1);
    });

    it('resolveModulePath() 함수로 경로 해석', () => {
      const resolved = resolveModulePath('/project/src/main.fl', './math.fl');

      expect(resolved).toBe('/project/src/math.fl');
    });
  });

  describe('실제 모듈 구조 테스트', () => {
    let resolver: ModuleResolver;

    beforeEach(() => {
      resolver = new ModuleResolver();
    });

    it('math 라이브러리 모듈', () => {
      const mathFile = path.join(TEST_DIR, 'math.fl');
      createTestModule(mathFile, `
export fn add(a: number, b: number) -> number {
  return a + b
}

export fn multiply(a: number, b: number) -> number {
  return a * b
}

export let PI = 3.14159
export let E = 2.71828
      `);

      const module = resolver.loadModule(mathFile);
      const exportsMap = resolver.getExportsAsMap(module);

      expect(exportsMap.size).toBe(4);
      expect(exportsMap.has('add')).toBe(true);
      expect(exportsMap.has('multiply')).toBe(true);
      expect(exportsMap.has('PI')).toBe(true);
      expect(exportsMap.has('E')).toBe(true);
    });

    it('utils 라이브러리 모듈', () => {
      const utilsFile = path.join(TEST_DIR, 'utils.fl');
      createTestModule(utilsFile, `
export fn map(arr: array<T>, fn: fn(T) -> U) -> array<U> {
  return arr
}

export fn filter(arr: array<T>, pred: fn(T) -> bool) -> array<T> {
  return arr
}

export let defaultThreshold = 10
      `);

      const module = resolver.loadModule(utilsFile);
      const exports = resolver.getExports(module);

      expect(exports).toHaveLength(3);
      expect(exports[0].name).toBe('map');
      expect(exports[1].name).toBe('filter');
      expect(exports[2].name).toBe('defaultThreshold');
    });

    it('main 프로그램이 두 라이브러리를 import', () => {
      const mathFile = path.join(TEST_DIR, 'math.fl');
      const utilsFile = path.join(TEST_DIR, 'utils.fl');
      const mainFile = path.join(TEST_DIR, 'main.fl');

      createTestModule(mathFile, 'export fn add(a: number, b: number) -> number { return a + b }');
      createTestModule(utilsFile, 'export fn map(arr: array<T>, fn: fn(T) -> U) -> array<U> { return arr }');
      createTestModule(mainFile, `
import { add } from "./math.fl"
import { map } from "./utils.fl"

export let result = 10
      `);

      const mainModule = resolver.loadModule(mainFile);

      expect(mainModule.imports).toHaveLength(2);
      expect(mainModule.imports[0].from).toBe('./math.fl');
      expect(mainModule.imports[1].from).toBe('./utils.fl');

      const deps = resolver.getDependencies(mainModule);
      expect(deps).toHaveLength(2);
    });
  });
});
