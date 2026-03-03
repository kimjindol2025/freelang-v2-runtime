/**
 * Phase 4 Step 1: Module System - AST & Lexer Extensions
 * Tests for import/export AST nodes and lexer tokens
 */

import { describe, it, expect } from '@jest/globals';
import {
  ImportStatement,
  ImportSpecifier,
  ExportStatement,
  Module,
  FunctionStatement,
  VariableDeclaration,
  Statement,
} from '../src/parser/ast';
import { TokenType, KEYWORDS, isKeyword, getKeyword } from '../src/lexer/token';

describe('Phase 4 Step 1: Module System - AST & Lexer Extensions', () => {
  describe('Token Types', () => {
    it('should have IMPORT token type', () => {
      expect(TokenType.IMPORT).toBe('IMPORT');
    });

    it('should have EXPORT token type', () => {
      expect(TokenType.EXPORT).toBe('EXPORT');
    });

    it('should have FROM token type', () => {
      expect(TokenType.FROM).toBe('FROM');
    });

    it('should include IMPORT in keywords', () => {
      expect(KEYWORDS['import']).toBe(TokenType.IMPORT);
    });

    it('should include EXPORT in keywords', () => {
      expect(KEYWORDS['export']).toBe(TokenType.EXPORT);
    });

    it('should include FROM in keywords', () => {
      expect(KEYWORDS['from']).toBe(TokenType.FROM);
    });
  });

  describe('Keyword Detection', () => {
    it('should recognize "import" as keyword', () => {
      expect(isKeyword('import')).toBe(true);
    });

    it('should recognize "export" as keyword', () => {
      expect(isKeyword('export')).toBe(true);
    });

    it('should recognize "from" as keyword', () => {
      expect(isKeyword('from')).toBe(true);
    });

    it('should get correct token type for "import"', () => {
      expect(getKeyword('import')).toBe(TokenType.IMPORT);
    });

    it('should get correct token type for "export"', () => {
      expect(getKeyword('export')).toBe(TokenType.EXPORT);
    });

    it('should get correct token type for "from"', () => {
      expect(getKeyword('from')).toBe(TokenType.FROM);
    });
  });

  describe('ImportSpecifier Interface', () => {
    it('should create import specifier with name only', () => {
      const spec: ImportSpecifier = {
        name: 'add',
      };
      expect(spec.name).toBe('add');
      expect(spec.alias).toBeUndefined();
    });

    it('should create import specifier with alias', () => {
      const spec: ImportSpecifier = {
        name: 'add',
        alias: 'sum',
      };
      expect(spec.name).toBe('add');
      expect(spec.alias).toBe('sum');
    });

    it('should create multiple import specifiers', () => {
      const specs: ImportSpecifier[] = [
        { name: 'add' },
        { name: 'multiply' },
        { name: 'divide', alias: 'div' },
      ];
      expect(specs).toHaveLength(3);
      expect(specs[0].name).toBe('add');
      expect(specs[2].alias).toBe('div');
    });
  });

  describe('ImportStatement Interface', () => {
    it('should create named import statement', () => {
      const stmt: ImportStatement = {
        type: 'import',
        imports: [
          { name: 'add' },
          { name: 'multiply' },
        ],
        from: './math.fl',
      };
      expect(stmt.type).toBe('import');
      expect(stmt.imports).toHaveLength(2);
      expect(stmt.from).toBe('./math.fl');
      expect(stmt.isNamespace).toBeUndefined();
    });

    it('should create namespace import statement', () => {
      const stmt: ImportStatement = {
        type: 'import',
        imports: [],
        from: './math.fl',
        isNamespace: true,
        namespace: 'math',
      };
      expect(stmt.isNamespace).toBe(true);
      expect(stmt.namespace).toBe('math');
    });

    it('should create import with aliased imports', () => {
      const stmt: ImportStatement = {
        type: 'import',
        imports: [
          { name: 'add', alias: 'sum' },
          { name: 'multiply', alias: 'mul' },
        ],
        from: './math.fl',
      };
      expect(stmt.imports[0].alias).toBe('sum');
      expect(stmt.imports[1].alias).toBe('mul');
    });

    it('should support relative module path', () => {
      const stmt: ImportStatement = {
        type: 'import',
        imports: [{ name: 'process' }],
        from: '../utils/helpers.fl',
      };
      expect(stmt.from).toMatch(/\.\.\//);
    });

    it('should support absolute module path', () => {
      const stmt: ImportStatement = {
        type: 'import',
        imports: [{ name: 'constants' }],
        from: '/lib/constants.fl',
      };
      expect(stmt.from).toMatch(/^\//);
    });
  });

  describe('ExportStatement Interface', () => {
    it('should create export statement for function', () => {
      const funcDecl: FunctionStatement = {
        type: 'function',
        name: 'add',
        params: [
          { name: 'a', paramType: 'number' },
          { name: 'b', paramType: 'number' },
        ],
        returnType: 'number',
        body: { type: 'block', body: [] },
      };

      const stmt: ExportStatement = {
        type: 'export',
        declaration: funcDecl,
      };

      expect(stmt.type).toBe('export');
      expect(stmt.declaration.type).toBe('function');
      expect((stmt.declaration as FunctionStatement).name).toBe('add');
    });

    it('should create export statement for variable', () => {
      const varDecl: VariableDeclaration = {
        type: 'variable',
        name: 'PI',
        varType: 'number',
        value: {
          type: 'literal',
          value: 3.14159,
          dataType: 'number',
        },
      };

      const stmt: ExportStatement = {
        type: 'export',
        declaration: varDecl,
      };

      expect(stmt.type).toBe('export');
      expect(stmt.declaration.type).toBe('variable');
      expect((stmt.declaration as VariableDeclaration).name).toBe('PI');
    });

    it('should support multiple export statements', () => {
      const exports: ExportStatement[] = [
        {
          type: 'export',
          declaration: {
            type: 'function',
            name: 'add',
            params: [],
            body: { type: 'block', body: [] },
          } as FunctionStatement,
        },
        {
          type: 'export',
          declaration: {
            type: 'variable',
            name: 'PI',
          } as VariableDeclaration,
        },
      ];

      expect(exports).toHaveLength(2);
      expect(exports[0].declaration.type).toBe('function');
      expect(exports[1].declaration.type).toBe('variable');
    });
  });

  describe('Module Interface', () => {
    it('should create empty module', () => {
      const module: Module = {
        path: 'main.fl',
        imports: [],
        exports: [],
        statements: [],
      };

      expect(module.path).toBe('main.fl');
      expect(module.imports).toEqual([]);
      expect(module.exports).toEqual([]);
      expect(module.statements).toEqual([]);
    });

    it('should create module with imports and exports', () => {
      const module: Module = {
        path: './math.fl',
        imports: [
          {
            type: 'import',
            imports: [{ name: 'constants' }],
            from: './config.fl',
          },
        ],
        exports: [
          {
            type: 'export',
            declaration: {
              type: 'function',
              name: 'add',
              params: [],
              body: { type: 'block', body: [] },
            } as FunctionStatement,
          },
        ],
        statements: [
          {
            type: 'expression',
            expression: {
              type: 'literal',
              value: 42,
              dataType: 'number',
            },
          },
        ],
      };

      expect(module.path).toBe('./math.fl');
      expect(module.imports).toHaveLength(1);
      expect(module.exports).toHaveLength(1);
      expect(module.statements).toHaveLength(1);
    });

    it('should support complex module structure', () => {
      const module: Module = {
        path: 'app.fl',
        imports: [
          {
            type: 'import',
            imports: [{ name: 'add' }, { name: 'multiply' }],
            from: './math.fl',
          },
          {
            type: 'import',
            imports: [],
            from: './config.fl',
            isNamespace: true,
            namespace: 'config',
          },
        ],
        exports: [
          {
            type: 'export',
            declaration: {
              type: 'variable',
              name: 'result',
            } as VariableDeclaration,
          },
        ],
        statements: [
          {
            type: 'variable',
            name: 'x',
            varType: 'number',
            value: { type: 'literal', value: 10, dataType: 'number' },
          } as VariableDeclaration,
        ],
      };

      expect(module.imports).toHaveLength(2);
      expect(module.imports[0].imports).toHaveLength(2);
      expect(module.imports[1].isNamespace).toBe(true);
      expect(module.exports).toHaveLength(1);
    });
  });

  describe('Statement Union Type', () => {
    it('should include ImportStatement in Statement type', () => {
      const stmt: Statement = {
        type: 'import',
        imports: [{ name: 'add' }],
        from: './math.fl',
      };

      expect(stmt.type).toBe('import');
    });

    it('should include ExportStatement in Statement type', () => {
      const stmt: Statement = {
        type: 'export',
        declaration: {
          type: 'variable',
          name: 'PI',
        } as VariableDeclaration,
      };

      expect(stmt.type).toBe('export');
    });

    it('should allow mixed statement types in array', () => {
      const statements: Statement[] = [
        {
          type: 'import',
          imports: [{ name: 'add' }],
          from: './math.fl',
        },
        {
          type: 'variable',
          name: 'x',
          varType: 'number',
        } as VariableDeclaration,
        {
          type: 'export',
          declaration: {
            type: 'variable',
            name: 'result',
          } as VariableDeclaration,
        },
      ];

      expect(statements).toHaveLength(3);
      expect(statements[0].type).toBe('import');
      expect(statements[1].type).toBe('variable');
      expect(statements[2].type).toBe('export');
    });
  });

  describe('Real-world Module Examples', () => {
    it('should model math.fl module', () => {
      const mathModule: Module = {
        path: './math.fl',
        imports: [],
        exports: [
          {
            type: 'export',
            declaration: {
              type: 'function',
              name: 'add',
              params: [
                { name: 'a', paramType: 'number' },
                { name: 'b', paramType: 'number' },
              ],
              returnType: 'number',
              body: { type: 'block', body: [] },
            },
          },
          {
            type: 'export',
            declaration: {
              type: 'function',
              name: 'multiply',
              params: [
                { name: 'a', paramType: 'number' },
                { name: 'b', paramType: 'number' },
              ],
              returnType: 'number',
              body: { type: 'block', body: [] },
            },
          },
          {
            type: 'export',
            declaration: {
              type: 'variable',
              name: 'PI',
              varType: 'number',
              value: {
                type: 'literal',
                value: 3.14159,
                dataType: 'number',
              },
            },
          },
        ],
        statements: [],
      };

      expect(mathModule.exports).toHaveLength(3);
      expect(mathModule.exports[0].declaration.type).toBe('function');
      expect(mathModule.exports[2].declaration.type).toBe('variable');
    });

    it('should model main.fl importing from math.fl', () => {
      const mainModule: Module = {
        path: './main.fl',
        imports: [
          {
            type: 'import',
            imports: [
              { name: 'add' },
              { name: 'multiply' },
              { name: 'PI' },
            ],
            from: './math.fl',
          },
        ],
        exports: [],
        statements: [
          {
            type: 'variable',
            name: 'result1',
            value: {
              type: 'call',
              callee: 'add',
              arguments: [
                { type: 'literal', value: 5, dataType: 'number' },
                { type: 'literal', value: 10, dataType: 'number' },
              ],
            },
          } as VariableDeclaration,
        ],
      };

      expect(mainModule.imports).toHaveLength(1);
      expect(mainModule.imports[0].imports).toHaveLength(3);
      expect(mainModule.imports[0].from).toBe('./math.fl');
    });

    it('should model namespace import pattern', () => {
      const module: Module = {
        path: './app.fl',
        imports: [
          {
            type: 'import',
            imports: [],
            from: './math.fl',
            isNamespace: true,
            namespace: 'math',
          },
        ],
        exports: [],
        statements: [],
      };

      expect(module.imports[0].isNamespace).toBe(true);
      expect(module.imports[0].namespace).toBe('math');
    });

    it('should model aliased imports', () => {
      const module: Module = {
        path: './app.fl',
        imports: [
          {
            type: 'import',
            imports: [
              { name: 'add', alias: 'sum' },
              { name: 'multiply', alias: 'mul' },
            ],
            from: './math.fl',
          },
        ],
        exports: [],
        statements: [],
      };

      const imports = module.imports[0].imports;
      expect(imports[0].alias).toBe('sum');
      expect(imports[1].alias).toBe('mul');
    });
  });
});
