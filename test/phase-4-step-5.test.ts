/**
 * Phase 4 Step 5: Module System - Code Generator Extensions
 *
 * Module IR 생성 및 Cross-Module 함수 호출 테스트
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  IRGenerator,
  ModuleLinkContext,
  ASTNode
} from '../src/codegen/ir-generator';
import { Module, ImportStatement, ExportStatement } from '../src/parser/ast';
import { Op } from '../src/types';

describe('Phase 4 Step 5: Code Generator Extensions - Module IR 생성', () => {
  let generator: IRGenerator;

  beforeEach(() => {
    generator = new IRGenerator();
  });

  describe('Module IR 생성: generateModuleIR', () => {
    it('단순 모듈을 IR로 변환', () => {
      const module: Module = {
        path: './math.fl',
        imports: [],
        exports: [],
        statements: [
          {
            type: 'expression',
            expression: {
              type: 'literal',
              value: 42,
              dataType: 'number'
            }
          }
        ]
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      expect(ir[ir.length - 1].op).toBe(Op.HALT);
      expect(ir.length).toBeGreaterThan(1);
    });

    it('Import 문이 포함된 모듈 처리', () => {
      const module: Module = {
        path: './main.fl',
        imports: [
          {
            type: 'import',
            imports: [{ name: 'add' }],
            from: './math.fl'
          }
        ],
        exports: [],
        statements: []
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      // Import가 처리됨
      const hasComment = ir.some(inst => inst.op === Op.COMMENT);
      expect(hasComment).toBe(true);
    });

    it('Export 문이 포함된 모듈 처리', () => {
      const module: Module = {
        path: './math.fl',
        imports: [],
        exports: [
          {
            type: 'export',
            declaration: {
              type: 'function',
              name: 'add',
              params: [],
              body: {
                type: 'literal',
                value: 0,
                dataType: 'number'
              }
            }
          }
        ],
        statements: []
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      // Export 함수가 IR로 생성됨
      const hasFuncDef = ir.some(inst => inst.op === Op.FUNC_DEF);
      expect(hasFuncDef).toBe(true);
    });

    it('다중 Import 문 처리', () => {
      const module: Module = {
        path: './app.fl',
        imports: [
          {
            type: 'import',
            imports: [
              { name: 'add' },
              { name: 'multiply' }
            ],
            from: './math.fl'
          }
        ],
        exports: [],
        statements: []
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      // 두 개의 Import가 처리됨
      const commentCount = ir.filter(inst => inst.op === Op.COMMENT).length;
      expect(commentCount).toBeGreaterThanOrEqual(2);
    });

    it('Namespace Import 처리 (import * as math)', () => {
      const module: Module = {
        path: './main.fl',
        imports: [
          {
            type: 'import',
            imports: [],
            from: './math.fl',
            isNamespace: true,
            namespace: 'math'
          }
        ],
        exports: [],
        statements: []
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      // Namespace import 메타데이터
      const namespaceComment = ir.find(
        inst => inst.op === Op.COMMENT && inst.arg?.includes('math')
      );
      expect(namespaceComment).toBeDefined();
    });

    it('Import + Statements 조합', () => {
      const module: Module = {
        path: './main.fl',
        imports: [
          {
            type: 'import',
            imports: [{ name: 'add' }],
            from: './math.fl'
          }
        ],
        exports: [],
        statements: [
          {
            type: 'expression',
            expression: {
              type: 'binary',
              operator: '+',
              left: { type: 'literal', value: 1, dataType: 'number' },
              right: { type: 'literal', value: 2, dataType: 'number' }
            }
          }
        ]
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      // Import + 계산 모두 포함
      expect(ir.length).toBeGreaterThan(3);
    });
  });

  describe('Cross-Module 함수 호출: resolveCalleeForModule', () => {
    it('Namespace 호출: math.add 해석', () => {
      const context: ModuleLinkContext = {
        importedSymbols: new Map([['math', './math.fl']]),
        exportedSymbols: new Map()
      };

      generator.setModuleLinkContext(context);

      const module: Module = {
        path: './main.fl',
        imports: [
          {
            type: 'import',
            imports: [],
            from: './math.fl',
            isNamespace: true,
            namespace: 'math'
          }
        ],
        exports: [],
        statements: [
          {
            type: 'expression',
            expression: {
              type: 'call',
              callee: 'math.add',
              arguments: [
                { type: 'literal', value: 1, dataType: 'number' },
                { type: 'literal', value: 2, dataType: 'number' }
              ]
            }
          }
        ]
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      // math.add가 qualified name으로 변환되어야 함
      const callInst = ir.find(inst => inst.op === Op.CALL);
      expect(callInst).toBeDefined();
      expect(callInst?.arg).toContain('./math.fl');
    });

    it('로컬 함수 호출 (Qualified name 아님)', () => {
      const context: ModuleLinkContext = {
        importedSymbols: new Map(),
        exportedSymbols: new Map()
      };

      generator.setModuleLinkContext(context);

      const module: Module = {
        path: './main.fl',
        imports: [],
        exports: [],
        statements: [
          {
            type: 'expression',
            expression: {
              type: 'call',
              callee: 'localFunc',
              arguments: []
            }
          }
        ]
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      const callInst = ir.find(inst => inst.op === Op.CALL);
      expect(callInst?.arg).toBe('localFunc');
    });

    it('Named import 함수 호출', () => {
      const context: ModuleLinkContext = {
        importedSymbols: new Map([['add', './math.fl#add']]),
        exportedSymbols: new Map()
      };

      generator.setModuleLinkContext(context);

      const module: Module = {
        path: './main.fl',
        imports: [
          {
            type: 'import',
            imports: [{ name: 'add' }],
            from: './math.fl'
          }
        ],
        exports: [],
        statements: [
          {
            type: 'expression',
            expression: {
              type: 'call',
              callee: 'add',
              arguments: [
                { type: 'literal', value: 1, dataType: 'number' },
                { type: 'literal', value: 2, dataType: 'number' }
              ]
            }
          }
        ]
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      const callInst = ir.find(inst => inst.op === Op.CALL);
      expect(callInst?.arg).toBe('add');
    });

    it('Alias를 가진 Import 함수 호출', () => {
      const context: ModuleLinkContext = {
        importedSymbols: new Map([['sum', './math.fl#add']]),
        exportedSymbols: new Map()
      };

      generator.setModuleLinkContext(context);

      const module: Module = {
        path: './main.fl',
        imports: [
          {
            type: 'import',
            imports: [{ name: 'add', alias: 'sum' }],
            from: './math.fl'
          }
        ],
        exports: [],
        statements: [
          {
            type: 'expression',
            expression: {
              type: 'call',
              callee: 'sum',
              arguments: [
                { type: 'literal', value: 1, dataType: 'number' },
                { type: 'literal', value: 2, dataType: 'number' }
              ]
            }
          }
        ]
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      const callInst = ir.find(inst => inst.op === Op.CALL);
      expect(callInst?.arg).toBe('sum');
    });
  });

  describe('Export 심볼 수집: collectExportedSymbol', () => {
    it('함수 Export 수집', () => {
      const context: ModuleLinkContext = {
        importedSymbols: new Map(),
        exportedSymbols: new Map()
      };

      generator.setModuleLinkContext(context);

      const module: Module = {
        path: './math.fl',
        imports: [],
        exports: [
          {
            type: 'export',
            declaration: {
              type: 'function',
              name: 'add',
              params: [],
              body: {
                type: 'literal',
                value: 0,
                dataType: 'number'
              }
            }
          }
        ],
        statements: []
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      // Export 함수가 IR에 생성됨
      const hasFuncDef = ir.some(inst => inst.op === Op.FUNC_DEF);
      expect(hasFuncDef).toBe(true);
    });

    it('변수 Export 수집', () => {
      const context: ModuleLinkContext = {
        importedSymbols: new Map(),
        exportedSymbols: new Map()
      };

      generator.setModuleLinkContext(context);

      const module: Module = {
        path: './constants.fl',
        imports: [],
        exports: [
          {
            type: 'export',
            declaration: {
              type: 'variable',
              name: 'PI',
              value: { type: 'literal', value: 3.14159, dataType: 'number' }
            }
          }
        ],
        statements: []
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      // PI 변수가 IR에 생성됨
      const hasPush = ir.some(inst => inst.op === Op.PUSH);
      expect(hasPush).toBe(true);
    });

    it('다중 Export 수집', () => {
      const context: ModuleLinkContext = {
        importedSymbols: new Map(),
        exportedSymbols: new Map()
      };

      generator.setModuleLinkContext(context);

      const module: Module = {
        path: './utils.fl',
        imports: [],
        exports: [
          {
            type: 'export',
            declaration: {
              type: 'function',
              name: 'sum',
              params: [],
              body: { type: 'literal', value: 0, dataType: 'number' }
            }
          },
          {
            type: 'export',
            declaration: {
              type: 'variable',
              name: 'VERSION',
              value: { type: 'literal', value: '1.0', dataType: 'string' }
            }
          }
        ],
        statements: []
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      expect(ir.length).toBeGreaterThan(1);
    });
  });

  describe('Module Linking Context: setModuleLinkContext', () => {
    it('Import 컨텍스트 설정', () => {
      const context: ModuleLinkContext = {
        importedSymbols: new Map([
          ['math', './math.fl'],
          ['utils', './utils.fl']
        ]),
        exportedSymbols: new Map()
      };

      generator.setModuleLinkContext(context);

      const module: Module = {
        path: './main.fl',
        imports: [],
        exports: [],
        statements: []
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
    });

    it('Export 컨텍스트 설정', () => {
      const context: ModuleLinkContext = {
        importedSymbols: new Map(),
        exportedSymbols: new Map([
          ['add', 'function'],
          ['PI', 'number']
        ])
      };

      generator.setModuleLinkContext(context);

      const module: Module = {
        path: './math.fl',
        imports: [],
        exports: [],
        statements: []
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
    });

    it('혼합 컨텍스트 (Import + Export)', () => {
      const context: ModuleLinkContext = {
        importedSymbols: new Map([['utils', './utils.fl']]),
        exportedSymbols: new Map([['transform', 'function']])
      };

      generator.setModuleLinkContext(context);

      const module: Module = {
        path: './processor.fl',
        imports: [
          {
            type: 'import',
            imports: [],
            from: './utils.fl',
            isNamespace: true,
            namespace: 'utils'
          }
        ],
        exports: [
          {
            type: 'export',
            declaration: {
              type: 'function',
              name: 'transform',
              params: [],
              body: { type: 'literal', value: 0, dataType: 'number' }
            }
          }
        ],
        statements: []
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
    });
  });

  describe('실제 사용 시나리오', () => {
    it('Math 라이브러리 모듈 (내보내기)', () => {
      const mathModule: Module = {
        path: './math.fl',
        imports: [],
        exports: [
          {
            type: 'export',
            declaration: {
              type: 'function',
              name: 'add',
              params: [],
              body: { type: 'literal', value: 0, dataType: 'number' }
            }
          },
          {
            type: 'export',
            declaration: {
              type: 'function',
              name: 'multiply',
              params: [],
              body: { type: 'literal', value: 0, dataType: 'number' }
            }
          },
          {
            type: 'export',
            declaration: {
              type: 'variable',
              name: 'PI',
              value: { type: 'literal', value: 3.14159, dataType: 'number' }
            }
          }
        ],
        statements: []
      };

      const ir = generator.generateModuleIR(mathModule);

      expect(ir).toBeDefined();
      const funcDefs = ir.filter(inst => inst.op === Op.FUNC_DEF);
      expect(funcDefs.length).toBe(2);
    });

    it('Utils 모듈 (함수형 내보내기)', () => {
      const utilsModule: Module = {
        path: './utils.fl',
        imports: [],
        exports: [
          {
            type: 'export',
            declaration: {
              type: 'function',
              name: 'map',
              params: [],
              body: { type: 'literal', value: 0, dataType: 'number' }
            }
          },
          {
            type: 'export',
            declaration: {
              type: 'function',
              name: 'filter',
              params: [],
              body: { type: 'literal', value: 0, dataType: 'number' }
            }
          }
        ],
        statements: []
      };

      const ir = generator.generateModuleIR(utilsModule);

      expect(ir).toBeDefined();
      expect(ir.filter(inst => inst.op === Op.FUNC_DEF).length).toBe(2);
    });

    it('Config 모듈 (상수만 내보내기)', () => {
      const configModule: Module = {
        path: './config.fl',
        imports: [],
        exports: [
          {
            type: 'export',
            declaration: {
              type: 'variable',
              name: 'DEBUG',
              value: { type: 'literal', value: true, dataType: 'bool' }
            }
          },
          {
            type: 'export',
            declaration: {
              type: 'variable',
              name: 'MAX_RETRIES',
              value: { type: 'literal', value: 3, dataType: 'number' }
            }
          }
        ],
        statements: []
      };

      const ir = generator.generateModuleIR(configModule);

      expect(ir).toBeDefined();
    });

    it('Main 모듈 (다중 Import)', () => {
      const context: ModuleLinkContext = {
        importedSymbols: new Map([
          ['math', './math.fl'],
          ['utils', './utils.fl'],
          ['DEBUG', './config.fl#DEBUG']
        ]),
        exportedSymbols: new Map()
      };

      generator.setModuleLinkContext(context);

      const mainModule: Module = {
        path: './main.fl',
        imports: [
          {
            type: 'import',
            imports: [],
            from: './math.fl',
            isNamespace: true,
            namespace: 'math'
          },
          {
            type: 'import',
            imports: [],
            from: './utils.fl',
            isNamespace: true,
            namespace: 'utils'
          },
          {
            type: 'import',
            imports: [{ name: 'DEBUG' }],
            from: './config.fl'
          }
        ],
        exports: [],
        statements: [
          {
            type: 'expression',
            expression: {
              type: 'call',
              callee: 'math.add',
              arguments: [
                { type: 'literal', value: 1, dataType: 'number' },
                { type: 'literal', value: 2, dataType: 'number' }
              ]
            }
          }
        ]
      };

      const ir = generator.generateModuleIR(mainModule);

      expect(ir).toBeDefined();
      expect(ir.length).toBeGreaterThan(5);
    });

    it('Import Alias를 가진 모듈', () => {
      const context: ModuleLinkContext = {
        importedSymbols: new Map([['sum', './math.fl#add']]),
        exportedSymbols: new Map()
      };

      generator.setModuleLinkContext(context);

      const appModule: Module = {
        path: './app.fl',
        imports: [
          {
            type: 'import',
            imports: [{ name: 'add', alias: 'sum' }],
            from: './math.fl'
          }
        ],
        exports: [],
        statements: [
          {
            type: 'expression',
            expression: {
              type: 'call',
              callee: 'sum',
              arguments: [
                { type: 'literal', value: 10, dataType: 'number' },
                { type: 'literal', value: 20, dataType: 'number' }
              ]
            }
          }
        ]
      };

      const ir = generator.generateModuleIR(appModule);

      expect(ir).toBeDefined();
      const callInst = ir.find(inst => inst.op === Op.CALL);
      expect(callInst?.arg).toBe('sum');
    });
  });

  describe('에러 처리 및 엣지 케이스', () => {
    it('빈 모듈 처리', () => {
      const emptyModule: Module = {
        path: './empty.fl',
        imports: [],
        exports: [],
        statements: []
      };

      const ir = generator.generateModuleIR(emptyModule);

      expect(ir).toBeDefined();
      expect(ir[ir.length - 1].op).toBe(Op.HALT);
    });

    it('Import만 있고 사용하지 않는 모듈', () => {
      const module: Module = {
        path: './unused.fl',
        imports: [
          {
            type: 'import',
            imports: [{ name: 'unused' }],
            from: './somewhere.fl'
          }
        ],
        exports: [],
        statements: []
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      const hasImportComment = ir.some(
        inst => inst.op === Op.COMMENT && inst.arg?.includes('Import')
      );
      expect(hasImportComment).toBe(true);
    });

    it('Export된 함수의 Body가 복잡한 경우', () => {
      const module: Module = {
        path: './complex.fl',
        imports: [],
        exports: [
          {
            type: 'export',
            declaration: {
              type: 'function',
              name: 'complex',
              params: [],
              body: {
                type: 'binary',
                operator: '+',
                left: {
                  type: 'binary',
                  operator: '*',
                  left: { type: 'literal', value: 2, dataType: 'number' },
                  right: { type: 'literal', value: 3, dataType: 'number' }
                },
                right: { type: 'literal', value: 4, dataType: 'number' }
              }
            }
          }
        ],
        statements: []
      };

      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      expect(ir.length).toBeGreaterThan(3);
    });

    it('Namespace Import 후 존재하지 않는 함수 호출', () => {
      const context: ModuleLinkContext = {
        importedSymbols: new Map([['math', './math.fl']]),
        exportedSymbols: new Map()
      };

      generator.setModuleLinkContext(context);

      const module: Module = {
        path: './main.fl',
        imports: [
          {
            type: 'import',
            imports: [],
            from: './math.fl',
            isNamespace: true,
            namespace: 'math'
          }
        ],
        exports: [],
        statements: [
          {
            type: 'expression',
            expression: {
              type: 'call',
              callee: 'math.nonexistent',
              arguments: []
            }
          }
        ]
      };

      // IR은 생성되지만 Runtime에서 에러 발생
      const ir = generator.generateModuleIR(module);

      expect(ir).toBeDefined();
      const callInst = ir.find(inst => inst.op === Op.CALL);
      expect(callInst?.arg).toContain('./math.fl');
    });
  });
});
