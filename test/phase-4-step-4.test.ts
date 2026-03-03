/**
 * Phase 4 Step 4: Module System - Type Checker Extensions
 *
 * Import/Export의 타입 안전성 검증
 */

import { describe, it, expect } from '@jest/globals';
import {
  FunctionTypeChecker,
  ImportValidationResult,
  ImportContext,
  ClosureContext
} from '../src/analyzer/type-checker';

describe('Phase 4 Step 4: Type Checker Extensions - Import/Export Validation', () => {
  let checker: FunctionTypeChecker;

  beforeEach(() => {
    checker = new FunctionTypeChecker();
  });

  describe('validateImport: 임포트 검증', () => {
    it('존재하는 symbol을 import하면 성공', () => {
      const moduleExports = new Map([
        ['add', { type: 'function' as const, functionType: 'fn(number, number) -> number' }],
        ['PI', { type: 'variable' as const }]
      ]);

      const result = checker.validateImport('add', moduleExports);

      expect(result.compatible).toBe(true);
      expect(result.message).toContain('성공');
      expect(result.importedType).toBe('fn(number, number) -> number');
      expect(result.symbolType).toBe('function');
    });

    it('변수 symbol import 성공', () => {
      const moduleExports = new Map([
        ['PI', { type: 'variable' as const }]
      ]);

      const result = checker.validateImport('PI', moduleExports);

      expect(result.compatible).toBe(true);
      expect(result.symbolType).toBe('variable');
    });

    it('존재하지 않는 symbol import 실패', () => {
      const moduleExports = new Map([
        ['add', { type: 'function' as const }]
      ]);

      const result = checker.validateImport('multiply', moduleExports);

      expect(result.compatible).toBe(false);
      expect(result.message).toContain('내보내지 않습니다');
      expect(result.details?.expected).toContain('multiply');
    });

    it('빈 export 목록에서 import 실패', () => {
      const moduleExports = new Map();

      const result = checker.validateImport('add', moduleExports);

      expect(result.compatible).toBe(false);
      expect(result.message).toContain('내보내지 않습니다');
    });

    it('여러 symbol이 있을 때 정확하게 찾음', () => {
      const moduleExports = new Map([
        ['add', { type: 'function' as const }],
        ['subtract', { type: 'function' as const }],
        ['multiply', { type: 'function' as const }],
        ['divide', { type: 'function' as const }]
      ]);

      const result1 = checker.validateImport('add', moduleExports);
      const result2 = checker.validateImport('multiply', moduleExports);
      const result3 = checker.validateImport('invalid', moduleExports);

      expect(result1.compatible).toBe(true);
      expect(result2.compatible).toBe(true);
      expect(result3.compatible).toBe(false);
    });
  });

  describe('getExportType: Export 타입 추출', () => {
    it('함수 declaration에서 타입 추출', () => {
      const fnDecl = {
        type: 'function',
        name: 'add',
        params: [
          { name: 'a', paramType: 'number' },
          { name: 'b', paramType: 'number' }
        ],
        returnType: 'number',
        body: {}
      };

      const exportType = checker.getExportType(fnDecl);

      expect(exportType).toBe('fn(number, number) -> number');
    });

    it('generic 함수 타입 추출', () => {
      const fnDecl = {
        type: 'function',
        name: 'map',
        params: [
          { name: 'arr', paramType: 'array<T>' },
          { name: 'fn', paramType: 'fn(T) -> U' }
        ],
        returnType: 'array<U>',
        body: {}
      };

      const exportType = checker.getExportType(fnDecl);

      expect(exportType).toContain('array<T>');
      expect(exportType).toContain('fn(T) -> U');
      expect(exportType).toContain('array<U>');
    });

    it('변수 declaration에서 타입 추출', () => {
      const varDecl = {
        type: 'variable',
        name: 'PI',
        varType: 'number',
        value: { type: 'literal', value: 3.14159 }
      };

      const exportType = checker.getExportType(varDecl);

      expect(exportType).toBe('number');
    });

    it('변수 타입 없이 export되면 unknown', () => {
      const varDecl = {
        type: 'variable',
        name: 'VERSION',
        value: { type: 'literal', value: '1.0.0' }
      };

      const exportType = checker.getExportType(varDecl);

      expect(exportType).toBe('unknown');
    });

    it('반환 타입 없는 함수는 unknown', () => {
      const fnDecl = {
        type: 'function',
        name: 'process',
        params: [{ name: 'x', paramType: 'number' }],
        body: {}
      };

      const exportType = checker.getExportType(fnDecl);

      expect(exportType).toContain('unknown');
    });
  });

  describe('buildImportContext: Import 컨텍스트 생성', () => {
    it('함수 export로부터 context 생성', () => {
      const moduleExports = [
        {
          type: 'export',
          declaration: {
            type: 'function',
            name: 'add',
            params: [
              { name: 'a', paramType: 'number' },
              { name: 'b', paramType: 'number' }
            ],
            returnType: 'number',
            body: {}
          }
        }
      ];

      const context = checker.buildImportContext(moduleExports);

      expect(context.availableImports.size).toBe(1);
      expect(context.importedSymbols.size).toBe(1);
      expect(context.availableImports.has('add')).toBe(true);
      expect(context.importedSymbols.get('add')).toBe('function');
    });

    it('변수 export로부터 context 생성', () => {
      const moduleExports = [
        {
          type: 'export',
          declaration: {
            type: 'variable',
            name: 'PI',
            varType: 'number',
            value: {}
          }
        }
      ];

      const context = checker.buildImportContext(moduleExports);

      expect(context.availableImports.has('PI')).toBe(true);
      expect(context.importedSymbols.get('PI')).toBe('variable');
    });

    it('함수와 변수 모두 포함', () => {
      const moduleExports = [
        {
          type: 'export',
          declaration: {
            type: 'function',
            name: 'add',
            params: [
              { name: 'a', paramType: 'number' },
              { name: 'b', paramType: 'number' }
            ],
            returnType: 'number',
            body: {}
          }
        },
        {
          type: 'export',
          declaration: {
            type: 'variable',
            name: 'PI',
            varType: 'number',
            value: {}
          }
        },
        {
          type: 'export',
          declaration: {
            type: 'function',
            name: 'multiply',
            params: [
              { name: 'a', paramType: 'number' },
              { name: 'b', paramType: 'number' }
            ],
            returnType: 'number',
            body: {}
          }
        }
      ];

      const context = checker.buildImportContext(moduleExports);

      expect(context.availableImports.size).toBe(3);
      expect(context.importedSymbols.size).toBe(3);
      expect(context.importedSymbols.get('add')).toBe('function');
      expect(context.importedSymbols.get('PI')).toBe('variable');
      expect(context.importedSymbols.get('multiply')).toBe('function');
    });
  });

  describe('validateImportSpecifiers: 여러 import 검증', () => {
    it('여러 symbol을 모두 검증', () => {
      const importSpecs = [
        { name: 'add' },
        { name: 'multiply' },
        { name: 'PI' }
      ];

      const moduleExports = new Map([
        ['add', { type: 'function' as const }],
        ['multiply', { type: 'function' as const }],
        ['PI', { type: 'variable' as const }]
      ]);

      const results = checker.validateImportSpecifiers(importSpecs, moduleExports);

      expect(results).toHaveLength(3);
      expect(results[0].compatible).toBe(true);
      expect(results[1].compatible).toBe(true);
      expect(results[2].compatible).toBe(true);
    });

    it('일부 symbol이 없으면 해당 항목만 실패', () => {
      const importSpecs = [
        { name: 'add' },
        { name: 'missing' },
        { name: 'PI' }
      ];

      const moduleExports = new Map([
        ['add', { type: 'function' as const }],
        ['PI', { type: 'variable' as const }]
      ]);

      const results = checker.validateImportSpecifiers(importSpecs, moduleExports);

      expect(results[0].compatible).toBe(true);
      expect(results[1].compatible).toBe(false);
      expect(results[2].compatible).toBe(true);
    });

    it('alias를 포함한 import 검증', () => {
      const importSpecs = [
        { name: 'add', alias: 'sum' },
        { name: 'multiply', alias: 'mul' }
      ];

      const moduleExports = new Map([
        ['add', { type: 'function' as const }],
        ['multiply', { type: 'function' as const }]
      ]);

      const results = checker.validateImportSpecifiers(importSpecs, moduleExports);

      expect(results[0].compatible).toBe(true);
      expect(results[0].message).toContain('sum');
      expect(results[1].compatible).toBe(true);
      expect(results[1].message).toContain('mul');
    });
  });

  describe('lookupSymbol: 심볼 조회', () => {
    it('지역 변수에서 심볼 찾기', () => {
      const context: ClosureContext = {
        variables: { x: 'number', y: 'string' },
        functions: {}
      };

      const type1 = checker.lookupSymbol('x', context);
      const type2 = checker.lookupSymbol('y', context);

      expect(type1).toBe('number');
      expect(type2).toBe('string');
    });

    it('지역 함수에서 심볼 찾기', () => {
      const context: ClosureContext = {
        variables: {},
        functions: {
          add: {
            params: { a: 'number', b: 'number' },
            returnType: 'number'
          }
        }
      };

      const type = checker.lookupSymbol('add', context);

      expect(type).toContain('fn(');
      expect(type).toContain('number');
    });

    it('임포트된 심볼에서 찾기', () => {
      const context: ClosureContext = {
        variables: {},
        functions: {}
      };

      const importContext: ImportContext = {
        availableImports: new Map([
          ['multiply', 'fn(number, number) -> number']
        ]),
        importedSymbols: new Map([
          ['multiply', 'function']
        ])
      };

      const type = checker.lookupSymbol('multiply', context, importContext);

      expect(type).toBe('fn(number, number) -> number');
    });

    it('부모 컨텍스트에서 찾기 (클로저)', () => {
      const parentContext: ClosureContext = {
        variables: { global: 'number' },
        functions: {}
      };

      const childContext: ClosureContext = {
        variables: { local: 'string' },
        functions: {},
        parentContext
      };

      const type1 = checker.lookupSymbol('local', childContext);
      const type2 = checker.lookupSymbol('global', childContext);

      expect(type1).toBe('string');
      expect(type2).toBe('number');
    });

    it('없는 심볼은 undefined', () => {
      const context: ClosureContext = {
        variables: {},
        functions: {}
      };

      const type = checker.lookupSymbol('missing', context);

      expect(type).toBeUndefined();
    });

    it('우선순위: 지역 변수 > 임포트 > 부모', () => {
      const parentContext: ClosureContext = {
        variables: { x: 'string' },  // 부모에서는 string
        functions: {}
      };

      const context: ClosureContext = {
        variables: { x: 'number' },   // 지역에서는 number
        functions: {},
        parentContext
      };

      const importContext: ImportContext = {
        availableImports: new Map([
          ['x', 'bool']  // 임포트에서는 bool
        ]),
        importedSymbols: new Map([
          ['x', 'variable']
        ])
      };

      const type = checker.lookupSymbol('x', context, importContext);

      // 지역 변수가 최우선
      expect(type).toBe('number');
    });
  });

  describe('실제 사용 시나리오', () => {
    it('math 모듈에서 add 임포트 검증', () => {
      const mathModuleExports = [
        {
          type: 'export',
          declaration: {
            type: 'function',
            name: 'add',
            params: [
              { name: 'a', paramType: 'number' },
              { name: 'b', paramType: 'number' }
            ],
            returnType: 'number',
            body: {}
          }
        },
        {
          type: 'export',
          declaration: {
            type: 'variable',
            name: 'PI',
            varType: 'number',
            value: {}
          }
        }
      ];

      const context = checker.buildImportContext(mathModuleExports);
      const result = checker.validateImport('add', context.availableImports as any);

      expect(result.compatible).toBe(true);
      expect(result.symbolType).toBe('function');
    });

    it('utils 모듈에서 map 함수 임포트', () => {
      const utilsExports = [
        {
          type: 'export',
          declaration: {
            type: 'function',
            name: 'map',
            params: [
              { name: 'arr', paramType: 'array<T>' },
              { name: 'fn', paramType: 'fn(T) -> U' }
            ],
            returnType: 'array<U>',
            body: {}
          }
        }
      ];

      const context = checker.buildImportContext(utilsExports);
      const mapType = context.availableImports.get('map');

      expect(mapType).toContain('array<T>');
      expect(mapType).toContain('fn(T) -> U');
      expect(mapType).toContain('array<U>');
    });

    it('config 모듈에서 상수들 임포트', () => {
      const configExports = [
        {
          type: 'export',
          declaration: {
            type: 'variable',
            name: 'API_URL',
            varType: 'string',
            value: {}
          }
        },
        {
          type: 'export',
          declaration: {
            type: 'variable',
            name: 'MAX_RETRIES',
            varType: 'number',
            value: {}
          }
        },
        {
          type: 'export',
          declaration: {
            type: 'variable',
            name: 'ENABLE_DEBUG',
            varType: 'bool',
            value: {}
          }
        }
      ];

      const context = checker.buildImportContext(configExports);

      expect(context.availableImports.get('API_URL')).toBe('string');
      expect(context.availableImports.get('MAX_RETRIES')).toBe('number');
      expect(context.availableImports.get('ENABLE_DEBUG')).toBe('bool');
    });

    it('main 프로그램에서 import validation 전체 흐름', () => {
      // 1. 모듈의 export 타입 정보
      const libExports = [
        {
          type: 'export',
          declaration: {
            type: 'function',
            name: 'process',
            params: [{ name: 'x', paramType: 'array<number>' }],
            returnType: 'number',
            body: {}
          }
        },
        {
          type: 'export',
          declaration: {
            type: 'variable',
            name: 'VERSION',
            varType: 'string',
            value: {}
          }
        }
      ];

      // 2. Import context 생성
      const importContext = checker.buildImportContext(libExports);

      // 3. Import 검증
      const results = checker.validateImportSpecifiers(
        [
          { name: 'process' },
          { name: 'VERSION' }
        ],
        importContext.availableImports as any
      );

      expect(results[0].compatible).toBe(true);
      expect(results[0].symbolType).toBe('function');
      expect(results[1].compatible).toBe(true);
      expect(results[1].symbolType).toBe('variable');

      // 4. 현재 context에 import 추가
      const mainContext: ClosureContext = {
        variables: { VERSION: 'string' },  // VERSION 임포트됨
        functions: { process: {           // process 임포트됨
          params: { x: 'array<number>' },
          returnType: 'number'
        } }
      };

      // 5. 심볼 조회
      const processType = checker.lookupSymbol('process', mainContext);
      const versionType = checker.lookupSymbol('VERSION', mainContext);

      expect(processType).toContain('array<number>');
      expect(versionType).toBe('string');
    });
  });
});
