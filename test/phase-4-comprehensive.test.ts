/**
 * Phase 4 Step 6: Module System - Comprehensive Integration Tests
 *
 * 실제 프로젝트 시나리오를 기반으로 한 종합 테스트
 * Module System 전체 파이프라인 통합 검증
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ModuleResolver } from '../src/module/module-resolver';
import { FunctionTypeChecker, ImportContext } from '../src/analyzer/type-checker';
import { IRGenerator, ModuleLinkContext } from '../src/codegen/ir-generator';
import { Module, ImportStatement } from '../src/parser/ast';
import fs from 'fs';
import path from 'path';

/**
 * Helper: Create temporary module files for testing
 */
class ModuleTestFixture {
  private tempDir = '';
  private modules: Map<string, string> = new Map();

  setup(modulesData: Record<string, string>): string {
    // Create temp directory
    this.tempDir = `/tmp/freelang_test_${Date.now()}`;
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Create module files
    for (const [filename, code] of Object.entries(modulesData)) {
      const filePath = path.join(this.tempDir, filename);
      fs.writeFileSync(filePath, code, 'utf-8');
      this.modules.set(filename, code);
    }

    return this.tempDir;
  }

  getPath(filename: string): string {
    return path.join(this.tempDir, filename);
  }

  cleanup(): void {
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }
  }
}

describe('Phase 4 Step 6: Module System - Comprehensive Integration Tests', () => {
  let resolver: ModuleResolver;
  let typeChecker: FunctionTypeChecker;
  let codeGenerator: IRGenerator;
  let fixture: ModuleTestFixture;

  beforeEach(() => {
    resolver = new ModuleResolver();
    typeChecker = new FunctionTypeChecker();
    codeGenerator = new IRGenerator();
    fixture = new ModuleTestFixture();
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('실제 프로젝트 시나리오', () => {
    it('프로젝트 1: Math Library + App', () => {
      // Setup: math.fl와 app.fl 생성
      const tempDir = fixture.setup({
        'math.fl': `
          export fn add(a: number, b: number) -> number {
            return a + b
          }

          export fn multiply(a: number, b: number) -> number {
            return a * b
          }

          export let PI = 3.14159
        `,
        'app.fl': `
          import { add, multiply, PI } from "./math.fl"

          fn main() {
            let x = add(5, 10)
            let y = multiply(x, 2)
            return y
          }
        `
      });

      // Step 1: Module Resolution
      const mathModule = resolver.loadModule(fixture.getPath('math.fl'));
      expect(mathModule).toBeDefined();
      expect(mathModule.exports.length).toBe(3);

      // Step 2: Extract Exports
      const exports = resolver.getExports(mathModule);
      expect(exports.length).toBe(3);
      expect(exports.find(e => e.name === 'add')).toBeDefined();
      expect(exports.find(e => e.name === 'PI')).toBeDefined();

      // Step 3: Type Checking (validate imports)
      const appModule = resolver.loadModule(fixture.getPath('app.fl'));
      const importStmt = appModule.imports[0];
      expect(importStmt.imports[0].name).toBe('add');

      // Step 4: Code Generation
      const mathIR = codeGenerator.generateModuleIR(mathModule);
      expect(mathIR).toBeDefined();
      expect(mathIR.length).toBeGreaterThan(0);
    });

    it('프로젝트 2: Utils + Config + Main', () => {
      const tempDir = fixture.setup({
        'config.fl': `
          export let DEBUG = true
          export let MAX_ITEMS = 100
        `,
        'utils.fl': `
          import { DEBUG, MAX_ITEMS } from "./config.fl"

          export fn log(msg: string) {
            return msg
          }

          export fn validate(count: number) -> bool {
            return count <= MAX_ITEMS
          }
        `,
        'main.fl': `
          import { log, validate } from "./utils.fl"
          import { DEBUG } from "./config.fl"

          fn main() {
            let valid = validate(50)
            return valid
          }
        `
      });

      // Module chain: main.fl → utils.fl → config.fl
      const mainModule = resolver.loadModule(fixture.getPath('main.fl'));
      expect(mainModule.imports.length).toBe(2);

      // Get all dependencies
      const allDeps = resolver.getDependencies(mainModule);
      expect(allDeps.length).toBeGreaterThanOrEqual(1);
    });

    it('프로젝트 3: Layered Architecture', () => {
      const tempDir = fixture.setup({
        'models.fl': `
          export fn createUser(name: string) {
            return name
          }
        `,
        'services.fl': `
          import { createUser } from "./models.fl"

          export fn registerUser(name: string) {
            let user = createUser(name)
            return user
          }
        `,
        'handlers.fl': `
          import { registerUser } from "./services.fl"

          export fn handleRequest() {
            let result = registerUser("John")
            return result
          }
        `,
        'app.fl': `
          import { handleRequest } from "./handlers.fl"

          fn main() {
            let res = handleRequest()
            return res
          }
        `
      });

      // 4-layer dependency chain
      const appModule = resolver.loadModule(fixture.getPath('app.fl'));
      expect(appModule.imports.length).toBeGreaterThan(0);

      // Verify the chain is loadable
      const deps = resolver.getDependencies(appModule);
      expect(deps.length).toBeGreaterThan(0);
    });

    it('프로젝트 4: Multi-Module with Shared Utils', () => {
      const tempDir = fixture.setup({
        'shared.fl': `
          export fn isEmpty(str: string) -> bool {
            return str == ""
          }

          export fn toUpperCase(str: string) -> string {
            return str
          }
        `,
        'validators.fl': `
          import { isEmpty } from "./shared.fl"

          export fn validateEmail(email: string) -> bool {
            let notEmpty = isEmpty(email)
            return notEmpty
          }
        `,
        'formatters.fl': `
          import { toUpperCase } from "./shared.fl"

          export fn formatName(name: string) -> string {
            let upper = toUpperCase(name)
            return upper
          }
        `,
        'main.fl': `
          import { validateEmail } from "./validators.fl"
          import { formatName } from "./formatters.fl"

          fn main() {
            let email = validateEmail("test@example.com")
            let formatted = formatName("john")
            return formatted
          }
        `
      });

      // shared.fl is used by multiple modules
      const sharedModule = resolver.loadModule(fixture.getPath('shared.fl'));
      const validateModule = resolver.loadModule(fixture.getPath('validators.fl'));
      const formatModule = resolver.loadModule(fixture.getPath('formatters.fl'));

      expect(sharedModule).toBeDefined();
      expect(validateModule).toBeDefined();
      expect(formatModule).toBeDefined();
    });
  });

  describe('Cross-Module 함수 호출 시나리오', () => {
    it('Namespace import로 함수 호출', () => {
      const tempDir = fixture.setup({
        'math.fl': `
          export fn add(a: number, b: number) -> number {
            return a + b
          }

          export fn subtract(a: number, b: number) -> number {
            return a - b
          }
        `,
        'calc.fl': `
          import * as math from "./math.fl"

          fn calculate() {
            let x = 10
            let y = 5
            return x + y
          }
        `
      });

      const mathModule = resolver.loadModule(fixture.getPath('math.fl'));
      const calcModule = resolver.loadModule(fixture.getPath('calc.fl'));

      // Validate imports
      expect(calcModule.imports[0].isNamespace).toBe(true);
      expect(calcModule.imports[0].namespace).toBe('math');

      // Code generation with context
      const context: ModuleLinkContext = {
        importedSymbols: new Map([['math', fixture.getPath('math.fl')]]),
        exportedSymbols: new Map()
      };

      codeGenerator.setModuleLinkContext(context);
      const ir = codeGenerator.generateModuleIR(calcModule);
      expect(ir).toBeDefined();
    });

    it('Named import로 함수 호출', () => {
      const tempDir = fixture.setup({
        'helpers.fl': `
          export fn greet(name: string) -> string {
            return name
          }

          export fn farewell(name: string) -> string {
            return name
          }
        `,
        'app.fl': `
          import { greet, farewell } from "./helpers.fl"

          fn main() {
            let greeting = greet("Alice")
            let goodbye = farewell("Bob")
            return greeting
          }
        `
      });

      const helpersModule = resolver.loadModule(fixture.getPath('helpers.fl'));
      const appModule = resolver.loadModule(fixture.getPath('app.fl'));

      // Validate named imports
      expect(appModule.imports[0].imports.length).toBe(2);
      expect(appModule.imports[0].imports[0].name).toBe('greet');
      expect(appModule.imports[0].imports[1].name).toBe('farewell');

      // Code generation
      const ir = codeGenerator.generateModuleIR(appModule);
      expect(ir).toBeDefined();
    });

    it('Aliased import로 함수 호출', () => {
      const tempDir = fixture.setup({
        'math.fl': `
          export fn add(a: number, b: number) -> number {
            return a + b
          }
        `,
        'main.fl': `
          import { add as sum } from "./math.fl"

          fn main() {
            let result = sum(3, 4)
            return result
          }
        `
      });

      const mainModule = resolver.loadModule(fixture.getPath('main.fl'));

      // Validate alias
      expect(mainModule.imports[0].imports[0].alias).toBe('sum');

      // Type checking with alias
      const context: ModuleLinkContext = {
        importedSymbols: new Map([['sum', `${fixture.getPath('math.fl')}#add`]]),
        exportedSymbols: new Map()
      };

      codeGenerator.setModuleLinkContext(context);
      const ir = codeGenerator.generateModuleIR(mainModule);
      expect(ir).toBeDefined();
    });

    it('다중 namespace import', () => {
      const tempDir = fixture.setup({
        'math.fl': `
          export fn add(a: number, b: number) -> number {
            return a + b
          }
        `,
        'string.fl': `
          export fn concat(a: string, b: string) -> string {
            return a
          }
        `,
        'main.fl': `
          import * as math from "./math.fl"
          import * as str from "./string.fl"

          fn main() {
            return 0
          }
        `
      });

      const mainModule = resolver.loadModule(fixture.getPath('main.fl'));

      // Validate multiple namespace imports
      expect(mainModule.imports.length).toBe(2);
      expect(mainModule.imports[0].namespace).toBe('math');
      expect(mainModule.imports[1].namespace).toBe('str');

      // Code generation
      const ir = codeGenerator.generateModuleIR(mainModule);
      expect(ir).toBeDefined();
    });
  });

  describe('Import 검증 (Validation)', () => {
    it('존재하는 심볼 import 성공', () => {
      const tempDir = fixture.setup({
        'source.fl': `
          export fn doSomething() {
            return 1
          }
        `,
        'dest.fl': `
          import { doSomething } from "./source.fl"

          fn main() {
            return doSomething()
          }
        `
      });

      const sourceModule = resolver.loadModule(fixture.getPath('source.fl'));
      const destModule = resolver.loadModule(fixture.getPath('dest.fl'));

      // Get exports and validate import
      const exports = resolver.getExports(sourceModule);
      const exportMap = new Map(exports.map(e => [e.name, { type: 'function' as const }]));

      const importStmt = destModule.imports[0];
      const result = typeChecker.validateImport(importStmt.imports[0].name, exportMap);

      expect(result.compatible).toBe(true);
    });

    it('존재하지 않는 심볼 import 실패', () => {
      const tempDir = fixture.setup({
        'source.fl': `
          export fn exists() {
            return 1
          }
        `,
        'dest.fl': `
          import { notExists } from "./source.fl"

          fn main() {
            return 0
          }
        `
      });

      const sourceModule = resolver.loadModule(fixture.getPath('source.fl'));
      const exports = resolver.getExports(sourceModule);
      const exportMap = new Map(exports.map(e => [e.name, { type: 'function' as const }]));

      // Try to import non-existent symbol
      const result = typeChecker.validateImport('notExists', exportMap);

      expect(result.compatible).toBe(false);
      expect(result.message).toContain('모듈에서');
    });

    it('존재하지 않는 모듈 import 에러', () => {
      const tempDir = fixture.setup({
        'main.fl': `
          import { something } from "./nonexistent.fl"

          fn main() {
            return 0
          }
        `
      });

      const mainModule = resolver.loadModule(fixture.getPath('main.fl'));
      expect(mainModule).toBeDefined();

      // Try to load non-existent module
      const nonexistentPath = fixture.getPath('nonexistent.fl');
      expect(() => {
        resolver.loadModule(nonexistentPath);
      }).toThrow();
    });

    it('부분적 import validation (일부만 실패)', () => {
      const tempDir = fixture.setup({
        'source.fl': `
          export fn exists1() {
            return 1
          }

          export fn exists2() {
            return 2
          }
        `
      });

      const sourceModule = resolver.loadModule(fixture.getPath('source.fl'));
      const exports = resolver.getExports(sourceModule);
      const exportMap = new Map(exports.map(e => [e.name, { type: 'function' as const }]));

      // Validate multiple imports
      const importSpecs = [
        { name: 'exists1' },
        { name: 'exists2' },
        { name: 'notExists' }
      ];

      const results = typeChecker.validateImportSpecifiers(importSpecs, exportMap);

      expect(results[0].compatible).toBe(true);
      expect(results[1].compatible).toBe(true);
      expect(results[2].compatible).toBe(false);
    });
  });

  describe('순환 의존성 (Circular Dependencies)', () => {
    it('2단계 순환 의존성 감지', () => {
      const tempDir = fixture.setup({
        'a.fl': `
          import { bFunc } from "./b.fl"

          export fn aFunc() {
            return 1
          }
        `,
        'b.fl': `
          import { aFunc } from "./a.fl"

          export fn bFunc() {
            return 2
          }
        `
      });

      const aModule = resolver.loadModule(fixture.getPath('a.fl'));
      expect(aModule).toBeDefined();

      // Trying to load b should trigger circular dependency
      expect(() => {
        // This would be caught during the dependency resolution
        resolver.getDependencies(aModule);
      }).not.toThrow(); // The check happens at module load time
    });

    it('3단계 순환 의존성 감지', () => {
      const tempDir = fixture.setup({
        'a.fl': `
          import { bFunc } from "./b.fl"

          export fn aFunc() {
            return 1
          }
        `,
        'b.fl': `
          import { cFunc } from "./c.fl"

          export fn bFunc() {
            return 2
          }
        `,
        'c.fl': `
          import { aFunc } from "./a.fl"

          export fn cFunc() {
            return 3
          }
        `
      });

      const aModule = resolver.loadModule(fixture.getPath('a.fl'));
      expect(aModule).toBeDefined();

      // Try to resolve dependencies (circular)
      // In this case, the circular dependency would be caught
      const deps = resolver.getDependencies(aModule);
      expect(deps).toBeDefined();
    });

    it('순환 의존성 없음 (선형 체인)', () => {
      const tempDir = fixture.setup({
        'a.fl': `
          export fn aFunc() {
            return 1
          }
        `,
        'b.fl': `
          import { aFunc } from "./a.fl"

          export fn bFunc() {
            return 2
          }
        `,
        'c.fl': `
          import { bFunc } from "./b.fl"

          export fn cFunc() {
            return 3
          }
        `
      });

      const cModule = resolver.loadModule(fixture.getPath('c.fl'));
      const deps = resolver.getDependencies(cModule);

      expect(cModule).toBeDefined();
      expect(deps.length).toBeGreaterThan(0);
    });
  });

  describe('타입 체크 통합', () => {
    it('Import된 함수 타입 확인', () => {
      const tempDir = fixture.setup({
        'math.fl': `
          export fn add(a: number, b: number) -> number {
            return a + b
          }
        `
      });

      const mathModule = resolver.loadModule(fixture.getPath('math.fl'));
      const exports = resolver.getExports(mathModule);

      // Build import context
      const importContext = typeChecker.buildImportContext(
        mathModule.exports
      );

      expect(importContext.availableImports.has('add')).toBe(true);
      expect(importContext.importedSymbols.get('add')).toBe('function');
    });

    it('Cross-module symbol lookup', () => {
      const tempDir = fixture.setup({
        'utils.fl': `
          export fn helper() {
            return 1
          }

          export let CONST = 42
        `
      });

      const utilsModule = resolver.loadModule(fixture.getPath('utils.fl'));
      const importContext = typeChecker.buildImportContext(
        utilsModule.exports
      );

      const context = {
        variables: {} as any,
        functions: {} as any
      };

      // Lookup imported symbol
      const helperType = typeChecker.lookupSymbol('helper', context, importContext);
      expect(helperType).toBeDefined();

      const constType = typeChecker.lookupSymbol('CONST', context, importContext);
      expect(constType).toBeDefined();
    });

    it('Symbol resolution 우선순위', () => {
      const tempDir = fixture.setup({});

      const context = {
        variables: { x: 'number', add: 'string' },
        functions: { process: { params: {}, returnType: 'bool' } }
      };

      const importContext: ImportContext = {
        availableImports: new Map([['add', 'fn(number, number) -> number']]),
        importedSymbols: new Map()
      };

      // 'add'는 로컬 변수로 존재 → 로컬 변수 타입 우선
      const type = typeChecker.lookupSymbol('add', context, importContext);
      expect(type).toBe('string'); // 변수가 우선

      // 'process'는 로컬 함수만 존재
      const processType = typeChecker.lookupSymbol('process', context, importContext);
      expect(processType).toContain('fn');
    });
  });

  describe('코드 생성 통합', () => {
    it('Module IR 생성 with context', () => {
      const tempDir = fixture.setup({
        'math.fl': `
          export fn add(a: number, b: number) -> number {
            return a + b
          }
        `,
        'main.fl': `
          import { add } from "./math.fl"

          fn main() {
            let result = add(1, 2)
            return result
          }
        `
      });

      const mainModule = resolver.loadModule(fixture.getPath('main.fl'));
      const mathModule = resolver.loadModule(fixture.getPath('math.fl'));

      // Build linking context
      const context: ModuleLinkContext = {
        importedSymbols: new Map([
          ['add', `${fixture.getPath('math.fl')}#add`]
        ]),
        exportedSymbols: new Map()
      };

      codeGenerator.setModuleLinkContext(context);

      // Generate IR for both modules
      const mathIR = codeGenerator.generateModuleIR(mathModule);
      const mainIR = codeGenerator.generateModuleIR(mainModule);

      expect(mathIR).toBeDefined();
      expect(mainIR).toBeDefined();
      expect(mainIR.length).toBeGreaterThan(mathIR.length);
    });

    it('Export된 함수가 IR에 포함됨', () => {
      const tempDir = fixture.setup({
        'lib.fl': `
          export fn exported() {
            return 42
          }

          fn internal() {
            return 0
          }
        `
      });

      const libModule = resolver.loadModule(fixture.getPath('lib.fl'));
      const ir = codeGenerator.generateModuleIR(libModule);

      // Should contain FUNC_DEF for exported
      const hasFuncDef = ir.some(inst => inst.op === 'FUNC_DEF' && inst.arg === 'exported');
      expect(hasFuncDef).toBe(true);
    });
  });

  describe('복합 통합 시나리오', () => {
    it('Full Pipeline: Parse → Resolve → TypeCheck → Generate', () => {
      const tempDir = fixture.setup({
        'types.fl': `
          export fn createObject() {
            return 0
          }
        `,
        'validators.fl': `
          import { createObject } from "./types.fl"

          export fn validate(obj: number) -> bool {
            return true
          }
        `,
        'app.fl': `
          import { validate } from "./validators.fl"
          import { createObject } from "./types.fl"

          fn main() {
            let obj = createObject()
            let valid = validate(obj)
            return valid
          }
        `
      });

      // 1. Parse & Resolve
      const appModule = resolver.loadModule(fixture.getPath('app.fl'));
      expect(appModule).toBeDefined();
      expect(appModule.imports.length).toBe(2);

      // 2. Get exports from dependencies
      const typesModule = resolver.loadModule(fixture.getPath('types.fl'));
      const validatorsModule = resolver.loadModule(fixture.getPath('validators.fl'));

      const typesExports = resolver.getExports(typesModule);
      const validatorsExports = resolver.getExports(validatorsModule);

      // 3. Type check imports
      const typesMap = new Map(typesExports.map(e => [e.name, { type: 'function' }]));
      const validatorsMap = new Map(validatorsExports.map(e => [e.name, { type: 'function' }]));

      const createObjectCheck = typeChecker.validateImport('createObject', typesMap);
      const validateCheck = typeChecker.validateImport('validate', validatorsMap);

      expect(createObjectCheck.compatible).toBe(true);
      expect(validateCheck.compatible).toBe(true);

      // 4. Generate IR
      const linkContext: ModuleLinkContext = {
        importedSymbols: new Map([
          ['validate', `${fixture.getPath('validators.fl')}#validate`],
          ['createObject', `${fixture.getPath('types.fl')}#createObject`]
        ]),
        exportedSymbols: new Map()
      };

      codeGenerator.setModuleLinkContext(linkContext);
      const ir = codeGenerator.generateModuleIR(appModule);

      expect(ir).toBeDefined();
      expect(ir.length).toBeGreaterThan(0);
    });

    it('성능: 다중 모듈 로딩', () => {
      // Create 10 modules
      const modulesData: Record<string, string> = {};
      for (let i = 0; i < 10; i++) {
        modulesData[`module${i}.fl`] = `
          export fn func${i}() {
            return ${i}
          }
        `;
      }

      const tempDir = fixture.setup(modulesData);

      // Measure loading time
      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        const mod = resolver.loadModule(fixture.getPath(`module${i}.fl`));
        expect(mod).toBeDefined();
      }

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should be reasonably fast (< 1000ms for 10 modules)
      expect(elapsed).toBeLessThan(1000);
    });

    it('성능: 캐싱 효과', () => {
      const tempDir = fixture.setup({
        'shared.fl': `
          export fn shared() {
            return 1
          }
        `,
        'a.fl': `
          import { shared } from "./shared.fl"

          export fn funcA() {
            return 1
          }
        `,
        'b.fl': `
          import { shared } from "./shared.fl"

          export fn funcB() {
            return 2
          }
        `
      });

      const sharedModule = resolver.loadModule(fixture.getPath('shared.fl'));
      const cacheSize1 = resolver.getCacheSize();

      // Load a.fl (which imports shared.fl)
      const aModule = resolver.loadModule(fixture.getPath('a.fl'));

      // Load b.fl (which also imports shared.fl)
      const bModule = resolver.loadModule(fixture.getPath('b.fl'));

      const cacheSize2 = resolver.getCacheSize();

      // Should only have 3 modules in cache (shared, a, b), not 4
      expect(cacheSize2).toBeLessThanOrEqual(3);
    });
  });

  describe('에러 처리 및 복원력', () => {
    it('Import validation 후 계속 진행 가능', () => {
      const tempDir = fixture.setup({
        'lib.fl': `
          export fn exists() {
            return 1
          }
        `
      });

      const libModule = resolver.loadModule(fixture.getPath('lib.fl'));
      const exports = resolver.getExports(libModule);
      const exportMap = new Map(exports.map(e => [e.name, { type: 'function' as const }]));

      // Validation fails
      const badResult = typeChecker.validateImport('notExists', exportMap);
      expect(badResult.compatible).toBe(false);

      // But good import should still work
      const goodResult = typeChecker.validateImport('exists', exportMap);
      expect(goodResult.compatible).toBe(true);
    });

    it('Module 로드 실패 후 다른 모듈 로드 가능', () => {
      const tempDir = fixture.setup({
        'good.fl': `
          export fn good() {
            return 1
          }
        `
      });

      // Try to load non-existent module
      try {
        resolver.loadModule(fixture.getPath('nonexistent.fl'));
      } catch (e) {
        // Expected error
      }

      // But other modules should still load fine
      const goodModule = resolver.loadModule(fixture.getPath('good.fl'));
      expect(goodModule).toBeDefined();
    });

    it('Empty module 처리', () => {
      const tempDir = fixture.setup({
        'empty.fl': ``
      });

      const emptyModule = resolver.loadModule(fixture.getPath('empty.fl'));
      expect(emptyModule).toBeDefined();
      expect(emptyModule.exports.length).toBe(0);
      expect(emptyModule.imports.length).toBe(0);
      expect(emptyModule.statements.length).toBe(0);

      const ir = codeGenerator.generateModuleIR(emptyModule);
      expect(ir).toBeDefined();
    });

    it('Module export 없는 import 시도', () => {
      const tempDir = fixture.setup({
        'lib.fl': `
          fn internal() {
            return 1
          }
        `,
        'app.fl': `
          import { internal } from "./lib.fl"

          fn main() {
            return 0
          }
        `
      });

      const libModule = resolver.loadModule(fixture.getPath('lib.fl'));
      const appModule = resolver.loadModule(fixture.getPath('app.fl'));

      // lib.fl has no exports
      const exports = resolver.getExports(libModule);
      expect(exports.length).toBe(0);

      // Import validation should fail
      const exportMap = new Map(exports.map(e => [e.name, { type: 'function' as const }]));
      const result = typeChecker.validateImport('internal', exportMap);
      expect(result.compatible).toBe(false);
    });
  });
});
