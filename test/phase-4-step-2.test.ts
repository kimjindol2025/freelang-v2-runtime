/**
 * Phase 4 Step 2: Module System - Parser Extensions
 * Tests for import/export statement parsing
 */

import { describe, it, expect } from '@jest/globals';
import { Lexer } from '../src/lexer/lexer';
import { TokenBuffer } from '../src/lexer/lexer';
import { Parser } from '../src/parser/parser';
import {
  ImportStatement,
  ExportStatement,
  Statement,
  FunctionStatement,
  VariableDeclaration,
  Parameter
} from '../src/parser/ast';

/**
 * 헬퍼 함수: 코드를 파싱하기 위한 Parser 생성
 */
function createParser(code: string): Parser {
  const lexer = new Lexer(code);
  const tokens = new TokenBuffer(lexer);
  return new Parser(tokens);
}

/**
 * 헬퍼 함수: Statement 파싱 (첫 번째 statement만)
 */
function parseStatement(code: string): Statement {
  const parser = createParser(code);
  return parser.parseStatement();
}

describe('Phase 4 Step 2: Parser Extensions - Import/Export', () => {
  describe('Import 문 파싱', () => {
    it('should parse named import with single name', () => {
      const code = 'import { add } from "./math.fl"';
      const stmt = parseStatement(code) as ImportStatement;

      expect(stmt.type).toBe('import');
      expect(stmt.imports).toHaveLength(1);
      expect(stmt.imports[0].name).toBe('add');
      expect(stmt.imports[0].alias).toBeUndefined();
      expect(stmt.from).toBe('./math.fl');
    });

    it('should parse named imports with multiple names', () => {
      const code = 'import { add, multiply, subtract } from "./math.fl"';
      const stmt = parseStatement(code) as ImportStatement;

      expect(stmt.type).toBe('import');
      expect(stmt.imports).toHaveLength(3);
      expect(stmt.imports[0].name).toBe('add');
      expect(stmt.imports[1].name).toBe('multiply');
      expect(stmt.imports[2].name).toBe('subtract');
      expect(stmt.from).toBe('./math.fl');
    });

    it('should parse aliased imports', () => {
      const code = 'import { add as sum, multiply as mul } from "./math.fl"';
      const stmt = parseStatement(code) as ImportStatement;

      expect(stmt.type).toBe('import');
      expect(stmt.imports).toHaveLength(2);
      expect(stmt.imports[0].name).toBe('add');
      expect(stmt.imports[0].alias).toBe('sum');
      expect(stmt.imports[1].name).toBe('multiply');
      expect(stmt.imports[1].alias).toBe('mul');
    });

    it('should parse namespace import', () => {
      const code = 'import * as math from "./math.fl"';
      const stmt = parseStatement(code) as ImportStatement;

      expect(stmt.type).toBe('import');
      expect(stmt.isNamespace).toBe(true);
      expect(stmt.namespace).toBe('math');
      expect(stmt.imports).toHaveLength(0);
      expect(stmt.from).toBe('./math.fl');
    });

    it('should parse relative paths', () => {
      const code = 'import { helper } from "../utils/helper.fl"';
      const stmt = parseStatement(code) as ImportStatement;

      expect(stmt.from).toBe('../utils/helper.fl');
    });

    it('should parse absolute paths', () => {
      const code = 'import { constants } from "/lib/constants.fl"';
      const stmt = parseStatement(code) as ImportStatement;

      expect(stmt.from).toBe('/lib/constants.fl');
    });

    it('should parse mixed aliased and non-aliased imports', () => {
      const code = 'import { add, multiply as mul, divide } from "./math.fl"';
      const stmt = parseStatement(code) as ImportStatement;

      expect(stmt.imports).toHaveLength(3);
      expect(stmt.imports[0].alias).toBeUndefined();
      expect(stmt.imports[1].alias).toBe('mul');
      expect(stmt.imports[2].alias).toBeUndefined();
    });
  });

  describe('Export 함수 파싱', () => {
    it('should parse exported function with parameters', () => {
      const code = `export fn add(a: number, b: number) -> number {
        return a + b
      }`;
      const stmt = parseStatement(code) as ExportStatement;

      expect(stmt.type).toBe('export');
      expect(stmt.declaration.type).toBe('function');

      const fn = stmt.declaration as FunctionStatement;
      expect(fn.name).toBe('add');
      expect(fn.params).toHaveLength(2);
      expect(fn.params[0].name).toBe('a');
      expect(fn.params[0].paramType).toBe('number');
      expect(fn.params[1].name).toBe('b');
      expect(fn.returnType).toBe('number');
    });

    it('should parse exported function without return type', () => {
      const code = `export fn greet(name: string) {
        return "Hello " + name
      }`;
      const stmt = parseStatement(code) as ExportStatement;

      const fn = stmt.declaration as FunctionStatement;
      expect(fn.name).toBe('greet');
      expect(fn.returnType).toBeUndefined();
    });

    it('should parse exported function with array parameter', () => {
      const code = `export fn sum(arr: array<number>) -> number {
        return 0
      }`;
      const stmt = parseStatement(code) as ExportStatement;

      const fn = stmt.declaration as FunctionStatement;
      expect(fn.params[0].paramType).toBe('array<number>');
    });

    it('should parse exported function with generic type parameter', () => {
      const code = `export fn process(arr: array<T>) -> array<T> {
        return arr
      }`;
      const stmt = parseStatement(code) as ExportStatement;

      const fn = stmt.declaration as FunctionStatement;
      expect(fn.params[0].paramType).toBe('array<T>');
      expect(fn.returnType).toBe('array<T>');
    });

    it('should parse exported function with no parameters', () => {
      const code = `export fn getData() -> number {
        return 42
      }`;
      const stmt = parseStatement(code) as ExportStatement;

      const fn = stmt.declaration as FunctionStatement;
      expect(fn.params).toHaveLength(0);
    });
  });

  describe('Export 변수 파싱', () => {
    it('should parse exported variable with value', () => {
      const code = 'export let PI = 3.14159';
      const stmt = parseStatement(code) as ExportStatement;

      expect(stmt.type).toBe('export');
      expect(stmt.declaration.type).toBe('variable');

      const varDecl = stmt.declaration as VariableDeclaration;
      expect(varDecl.name).toBe('PI');
      expect(varDecl.value).toBeDefined();
    });

    it('should parse exported variable with type annotation', () => {
      const code = 'export let PI: number = 3.14159';
      const stmt = parseStatement(code) as ExportStatement;

      const varDecl = stmt.declaration as VariableDeclaration;
      expect(varDecl.name).toBe('PI');
      expect(varDecl.varType).toBe('number');
    });

    it('should parse exported string constant', () => {
      const code = 'export let VERSION = "1.0.0"';
      const stmt = parseStatement(code) as ExportStatement;

      const varDecl = stmt.declaration as VariableDeclaration;
      expect(varDecl.name).toBe('VERSION');
    });

    it('should parse exported variable with array type', () => {
      const code = 'export let numbers: array<number> = [1, 2, 3]';
      const stmt = parseStatement(code) as ExportStatement;

      const varDecl = stmt.declaration as VariableDeclaration;
      expect(varDecl.varType).toBe('array<number>');
    });

    it('should parse exported variable without value', () => {
      const code = 'export let config: number';
      const stmt = parseStatement(code) as ExportStatement;

      const varDecl = stmt.declaration as VariableDeclaration;
      expect(varDecl.name).toBe('config');
      expect(varDecl.varType).toBe('number');
      expect(varDecl.value).toBeUndefined();
    });
  });

  describe('매개변수 파싱', () => {
    it('should parse function with typed parameters', () => {
      const code = `export fn func(x: number, y: string) -> bool {
        return true
      }`;
      const stmt = parseStatement(code) as ExportStatement;
      const fn = stmt.declaration as FunctionStatement;

      expect(fn.params).toHaveLength(2);
      expect(fn.params[0].name).toBe('x');
      expect(fn.params[0].paramType).toBe('number');
      expect(fn.params[1].name).toBe('y');
      expect(fn.params[1].paramType).toBe('string');
    });

    it('should parse function with mixed typed and untyped parameters', () => {
      const code = `export fn func(x: number, y) -> bool {
        return true
      }`;
      const stmt = parseStatement(code) as ExportStatement;
      const fn = stmt.declaration as FunctionStatement;

      expect(fn.params[0].paramType).toBe('number');
      expect(fn.params[1].paramType).toBeUndefined();
    });

    it('should parse function with generic type parameters', () => {
      const code = `export fn identity(x: T) -> T {
        return x
      }`;
      const stmt = parseStatement(code) as ExportStatement;
      const fn = stmt.declaration as FunctionStatement;

      expect(fn.params[0].paramType).toBe('T');
      expect(fn.returnType).toBe('T');
    });

    it('should parse function with function type parameter', () => {
      const code = `export fn apply(f: fn(number) -> number, x: number) -> number {
        return f(x)
      }`;
      const stmt = parseStatement(code) as ExportStatement;
      const fn = stmt.declaration as FunctionStatement;

      expect(fn.params[0].paramType).toBe('fn(number) -> number');
    });
  });

  describe('실제 모듈 예제', () => {
    it('should parse math module structure', () => {
      const imports = parseStatement('import { constants } from "./config.fl"') as ImportStatement;
      const exportAdd = parseStatement(`export fn add(a: number, b: number) -> number {
        return a + b
      }`) as ExportStatement;
      const exportPI = parseStatement('export let PI: number = 3.14159') as ExportStatement;

      expect(imports.type).toBe('import');
      expect(exportAdd.declaration.type).toBe('function');
      expect(exportPI.declaration.type).toBe('variable');
    });

    it('should parse utils module with array methods', () => {
      const exportMap = parseStatement(`export fn map(arr: array<T>, fn: fn(T) -> U) -> array<U> {
        return arr
      }`) as ExportStatement;

      const fn = exportMap.declaration as FunctionStatement;
      expect(fn.params).toHaveLength(2);
      expect(fn.params[0].paramType).toBe('array<T>');
      expect(fn.params[1].paramType).toBe('fn(T) -> U');
      expect(fn.returnType).toBe('array<U>');
    });

    it('should parse main file with multiple imports', () => {
      const stmt1 = parseStatement('import { add, multiply, PI } from "./math.fl"') as ImportStatement;
      const stmt2 = parseStatement('import * as utils from "./utils.fl"') as ImportStatement;

      expect(stmt1.imports).toHaveLength(3);
      expect(stmt2.isNamespace).toBe(true);
      expect(stmt2.namespace).toBe('utils');
    });
  });

  describe('타입 파싱', () => {
    it('should handle simple types in export', () => {
      const code1 = 'export let x: number = 10';
      const code2 = 'export let s: string = "hello"';
      const code3 = 'export let b: bool = true';

      const stmt1 = parseStatement(code1) as ExportStatement;
      const stmt2 = parseStatement(code2) as ExportStatement;
      const stmt3 = parseStatement(code3) as ExportStatement;

      expect((stmt1.declaration as VariableDeclaration).varType).toBe('number');
      expect((stmt2.declaration as VariableDeclaration).varType).toBe('string');
      expect((stmt3.declaration as VariableDeclaration).varType).toBe('bool');
    });

    it('should handle generic types in export', () => {
      const code = 'export let items: array<number> = [1, 2, 3]';
      const stmt = parseStatement(code) as ExportStatement;

      expect((stmt.declaration as VariableDeclaration).varType).toBe('array<number>');
    });

    it('should handle nested generic types', () => {
      const code = 'export let matrix: array<array<number>> = [[1, 2], [3, 4]]';
      const stmt = parseStatement(code) as ExportStatement;

      expect((stmt.declaration as VariableDeclaration).varType).toBe('array<array<number>>');
    });
  });

  describe('Statement 타입 호환성', () => {
    it('should return ImportStatement as Statement type', () => {
      const code = 'import { add } from "./math.fl"';
      const stmt = parseStatement(code);

      expect(stmt.type).toBe('import');
      const importStmt = stmt as ImportStatement;
      expect(importStmt.imports).toBeDefined();
    });

    it('should return ExportStatement as Statement type', () => {
      const code = 'export let PI = 3.14159';
      const stmt = parseStatement(code);

      expect(stmt.type).toBe('export');
      const exportStmt = stmt as ExportStatement;
      expect(exportStmt.declaration).toBeDefined();
    });

    it('should mix import/export with other statements', () => {
      const stmts: Statement[] = [
        parseStatement('import { add } from "./math.fl"'),
        parseStatement('let x = 10'),
        parseStatement('export let PI = 3.14159'),
        parseStatement('if true then { let y = 20 }')
      ];

      expect(stmts).toHaveLength(4);
      expect(stmts[0].type).toBe('import');
      expect(stmts[1].type).toBe('variable');
      expect(stmts[2].type).toBe('export');
      expect(stmts[3].type).toBe('if');
    });
  });

  describe('에러 처리', () => {
    it('should throw error on incomplete import statement', () => {
      const code = 'import { add';
      expect(() => parseStatement(code)).toThrow();
    });

    it('should throw error on missing from keyword', () => {
      const code = 'import { add } "./math.fl"';
      expect(() => parseStatement(code)).toThrow();
    });

    it('should throw error on missing module path', () => {
      const code = 'import { add } from';
      expect(() => parseStatement(code)).toThrow();
    });

    it('should throw error on invalid export target', () => {
      const code = 'export let x = 10; export 42';
      // 첫 번째 statement는 파싱되지만 두 번째는 실패해야 함
      expect(() => parseStatement('export 42')).toThrow();
    });

    it('should throw error on incomplete function export', () => {
      const code = 'export fn add(a: number';
      expect(() => parseStatement(code)).toThrow();
    });
  });
});
