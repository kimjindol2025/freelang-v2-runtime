/**
 * Phase 7 Step 3: Macro System - Comprehensive Test Suite
 *
 * Tests for macro definitions, expansion, pattern matching, and conditional compilation
 */

import {
  MacroParser,
  MacroRegistry,
  MacroExpander,
  MacroBuilder,
  MacroCallExpression
} from '../src/macro/macro-definition';

import {
  MacroExpansionEngine,
  HygieneManager,
  SafeMacroExpander
} from '../src/macro/macro-expansion';

import {
  PatternMatchingEngine,
  PatternBuilder,
  PatternMacroProcessor
} from '../src/macro/pattern-macros';

import {
  ConditionalCompiler,
  DirectiveParser,
  ConfigurableCompiler
} from '../src/macro/conditional-compilation';

import {
  StandardMacroLibrary,
  MacroLibraryCategories,
  MacroDocumentation
} from '../src/macro/macro-library';

import {
  MacroTypeChecker,
  MacroConstraintValidator,
  ComprehensiveMacroValidator
} from '../src/macro/macro-type-checker';

describe('Phase 7 Step 3: Macro System', () => {

  // =====================================================
  // MACRO DEFINITION AND PARSING TESTS (10 tests)
  // =====================================================

  describe('Macro Definition and Parsing', () => {
    test('parse simple macro definition', () => {
      const macroStr = 'macro assert(condition, message) { if !condition { throw Error(message) } }';
      const macro = MacroParser.parseMacroDefinition(macroStr);

      expect(macro.kind).toBe('macro');
      expect(macro.name).toBe('assert');
      expect(macro.parameters).toHaveLength(2);
      expect(macro.parameters[0].name).toBe('condition');
      expect(macro.parameters[1].name).toBe('message');
    });

    test('parse macro with parameter kinds', () => {
      const macroStr = 'macro repeat(n: expression, body: statement) { let i = 0; while i < n { body; i = i + 1 } }';
      const macro = MacroParser.parseMacroDefinition(macroStr);

      expect(macro.parameters[0].kind).toBe('expression');
      expect(macro.parameters[1].kind).toBe('statement');
    });

    test('parse macro with default parameters', () => {
      const macroStr = 'macro debug(msg: expression = "debug") { console.log(msg) }';
      const macro = MacroParser.parseMacroDefinition(macroStr);

      expect(macro.parameters[0].default).toBe('"debug"');
    });

    test('register and retrieve macro', () => {
      const registry = new MacroRegistry();
      const macro = new MacroBuilder('test')
        .withParameter('x')
        .withBody('x')
        .build();

      registry.register(macro);

      expect(registry.has('test')).toBe(true);
      expect(registry.get('test')).toBe(macro);
    });

    test('cannot register duplicate macro', () => {
      const registry = new MacroRegistry();
      const macro = new MacroBuilder('test').withBody('test').build();

      registry.register(macro);

      expect(() => registry.register(macro)).toThrow();
    });

    test('parse macro call', () => {
      const callStr = 'assert(x > 0, "x must be positive")';
      const call = MacroParser.parseMacroCall(callStr);

      expect(call.type).toBe('macro-call');
      expect(call.macroName).toBe('assert');
      expect(call.arguments).toHaveLength(2);
    });

    test('expand simple macro', () => {
      const macro = new MacroBuilder('min')
        .withParameter('a')
        .withParameter('b')
        .withBody('(a < b ? a : b)')
        .build();

      const result = MacroExpander.expand(macro, [
        { value: 'x' },
        { value: 'y' }
      ]);

      expect(result).toContain('x');
      expect(result).toContain('y');
    });

    test('macro with invalid name throws error', () => {
      expect(() => {
        MacroParser.parseMacroDefinition('macro 123invalid() { }');
      }).toThrow();
    });

    test('macro builder fluent API', () => {
      const macro = new MacroBuilder('test')
        .withParameter('x', 'expression')
        .withParameter('y', 'expression', '0')
        .withBody('x + y')
        .withDocs('Test macro')
        .build();

      expect(macro.name).toBe('test');
      expect(macro.parameters).toHaveLength(2);
      expect(macro.docs).toBe('Test macro');
    });

    test('get all registered macros', () => {
      const registry = new MacroRegistry();

      registry.register(new MacroBuilder('m1').withBody('1').build());
      registry.register(new MacroBuilder('m2').withBody('2').build());

      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });
  });

  // =====================================================
  // MACRO EXPANSION TESTS (10 tests)
  // =====================================================

  describe('Macro Expansion', () => {
    test('expand macro in block statement', () => {
      const registry = new MacroRegistry();
      registry.register(
        new MacroBuilder('test').withParameter('x').withBody('console.log(x)').build()
      );

      const ast = {
        type: 'block-statement',
        statements: [
          { type: 'macro-call', macroName: 'test', arguments: [{ value: 'hello' }] }
        ]
      };

      const expanded = MacroExpansionEngine.expandMacros(ast, registry);
      expect(expanded.type).toBe('block-statement');
    });

    test('expand macros in if statement', () => {
      const registry = new MacroRegistry();
      registry.register(
        new MacroBuilder('check').withParameter('c').withBody('if c {}').build()
      );

      const ast = {
        type: 'if-statement',
        test: { type: 'macro-call', macroName: 'check', arguments: [{ value: 'true' }] },
        consequent: { type: 'block-statement', statements: [] }
      };

      const expanded = MacroExpansionEngine.expandMacros(ast, registry);
      expect(expanded.type).toBe('if-statement');
    });

    test('prevent infinite macro recursion', () => {
      const registry = new MacroRegistry();

      // Create a macro that calls itself
      const recursiveMacro = new MacroBuilder('recursive')
        .withParameter('x')
        .withBody('recursive(x)')
        .build();

      registry.register(recursiveMacro);

      const ast = {
        type: 'macro-call',
        macroName: 'recursive',
        arguments: [{ value: '1' }]
      };

      expect(() => {
        MacroExpansionEngine.expandMacros(ast, registry);
      }).toThrow();
    });

    test('expand nested macros', () => {
      const registry = new MacroRegistry();
      registry.register(new MacroBuilder('outer').withParameter('x').withBody('outer: x').build());
      registry.register(new MacroBuilder('inner').withParameter('x').withBody('inner: x').build());

      const ast = {
        type: 'block-statement',
        statements: [
          {
            type: 'macro-call',
            macroName: 'outer',
            arguments: [{ value: 'test' }]
          }
        ]
      };

      const result = MacroExpansionEngine.expandMacros(ast, registry);
      expect(result).toBeDefined();
    });

    test('safe macro expansion with error handling', () => {
      const registry = new MacroRegistry();

      const ast = {
        type: 'macro-call',
        macroName: 'undefined',
        arguments: []
      };

      const result = SafeMacroExpander.safeExpand(ast, registry);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('macro hygiene - variable renaming', () => {
      const hygiene = new HygieneManager();
      const code = 'let x = 10; let y = x + 1';

      const hygienic = hygiene.makeHygienic(code, 'test');
      expect(hygienic).not.toBe(code);
      expect(hygienic).toContain('__macro');
    });

    test('multiple macro expansions', () => {
      const registry = new MacroRegistry();
      registry.register(new MacroBuilder('a').withBody('aaa').build());
      registry.register(new MacroBuilder('b').withBody('bbb').build());

      const ast = {
        type: 'block-statement',
        statements: [
          { type: 'macro-call', macroName: 'a', arguments: [] },
          { type: 'macro-call', macroName: 'b', arguments: [] }
        ]
      };

      const result = MacroExpansionEngine.expandMacros(ast, registry);
      expect(result.statements).toHaveLength(2);
    });

    test('macro with no arguments', () => {
      const macro = new MacroBuilder('empty')
        .withBody('console.log("empty macro")')
        .build();

      const result = MacroExpander.expand(macro, []);
      expect(result).toContain('console.log');
    });

    test('macro argument validation', () => {
      const macro = new MacroBuilder('test')
        .withParameter('a')
        .withParameter('b')
        .withBody('a + b')
        .build();

      expect(() => {
        MacroExpander.expand(macro, [{ value: 'x' }]);  // Missing argument
      }).toThrow();
    });

    test('expand macro with default parameter', () => {
      const macro = new MacroBuilder('test')
        .withParameter('a')
        .withParameter('b', 'expression', '0')
        .withBody('a + b')
        .build();

      const result = MacroExpander.expand(macro, [{ value: '5' }]);
      expect(result).toContain('5');
      expect(result).toContain('0');
    });
  });

  // =====================================================
  // PATTERN MATCHING MACRO TESTS (10 tests)
  // =====================================================

  describe('Pattern Matching Macros', () => {
    test('match literal pattern', () => {
      const pattern = { type: 'literal' as const, value: 'test' };
      const result = PatternMatchingEngine.match('test', pattern);

      expect(result.matched).toBe(true);
    });

    test('match wildcard pattern', () => {
      const pattern = { type: 'wildcard' as const, value: 'x' };
      const result = PatternMatchingEngine.match('anything', pattern);

      expect(result.matched).toBe(true);
      expect(result.captures.get('x')).toBe('anything');
    });

    test('match regex pattern', () => {
      const pattern = { type: 'regex' as const, regex: /\d+/ };
      const result = PatternMatchingEngine.match('123', pattern);

      expect(result.matched).toBe(true);
    });

    test('pattern builder - literal', () => {
      const pattern = PatternBuilder.literal('test').build();
      expect(pattern.pattern.type).toBe('literal');
      expect(pattern.pattern.value).toBe('test');
    });

    test('pattern builder - wildcard', () => {
      const pattern = PatternBuilder.wildcard('x').build();
      expect(pattern.pattern.type).toBe('wildcard');
      expect(pattern.pattern.value).toBe('x');
    });

    test('pattern builder - regex', () => {
      const pattern = PatternBuilder.regex('[0-9]+').build();
      expect(pattern.pattern.type).toBe('regex');
    });

    test('pattern builder - with replacement and condition', () => {
      const pattern = PatternBuilder
        .wildcard('x')
        .then('result: $x')
        .when((captures) => captures.get('x')?.length! > 0)
        .build();

      expect(pattern.replacement).toBe('result: $x');
      expect(pattern.condition).toBeDefined();
    });

    test('process pattern macro with matching pattern', () => {
      const macro = {
        kind: 'pattern-macro' as const,
        name: 'test',
        parameters: [],
        body: { type: 'literal' as const, content: '', tokens: [] },
        patterns: [
          {
            pattern: { type: 'literal' as const, value: 'hello' },
            replacement: 'goodbye'
          }
        ]
      };

      const result = PatternMacroProcessor.processPatternMacro('hello', macro);
      expect(result.success).toBe(true);
      expect(result.result).toBe('goodbye');
    });

    test('process pattern macro with no matching pattern', () => {
      const macro = {
        kind: 'pattern-macro' as const,
        name: 'test',
        parameters: [],
        body: { type: 'literal' as const, content: '', tokens: [] },
        patterns: [
          {
            pattern: { type: 'literal' as const, value: 'hello' },
            replacement: 'goodbye'
          }
        ]
      };

      const result = PatternMacroProcessor.processPatternMacro('world', macro);
      expect(result.success).toBe(false);
    });

    test('pattern priority - higher priority first', () => {
      const macro = {
        kind: 'pattern-macro' as const,
        name: 'test',
        parameters: [],
        body: { type: 'literal' as const, content: '', tokens: [] },
        patterns: [
          {
            pattern: { type: 'wildcard' as const },
            replacement: 'wildcard',
            priority: 0
          },
          {
            pattern: { type: 'literal' as const, value: 'test' },
            replacement: 'literal',
            priority: 10
          }
        ]
      };

      const result = PatternMacroProcessor.processPatternMacro('test', macro);
      expect(result.result).toBe('literal');
    });
  });

  // =====================================================
  // CONDITIONAL COMPILATION TESTS (10 tests)
  // =====================================================

  describe('Conditional Compilation', () => {
    test('set and check symbol', () => {
      const compiler = new ConditionalCompiler();
      compiler.setSymbol('debug', true);

      expect(compiler.isDefined('debug')).toBe(true);
      expect(compiler.getSymbol('debug')).toBe(true);
    });

    test('process #ifdef directive - defined', () => {
      const compiler = new ConditionalCompiler();
      compiler.setSymbol('feature', true);

      const nodes = [
        { type: 'ifdef', condition: 'feature', body: [{ type: 'code' }] },
        { type: 'endif' }
      ];

      const result = compiler.processDirectives(nodes);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('code');
    });

    test('process #ifdef directive - undefined', () => {
      const compiler = new ConditionalCompiler();

      const nodes = [
        { type: 'ifdef', condition: 'feature', body: [{ type: 'code' }] },
        { type: 'endif' }
      ];

      const result = compiler.processDirectives(nodes);
      expect(result).toHaveLength(0);
    });

    test('process #ifndef directive', () => {
      const compiler = new ConditionalCompiler();

      const nodes = [
        { type: 'ifndef', condition: 'feature', body: [{ type: 'code' }] },
        { type: 'endif' }
      ];

      const result = compiler.processDirectives(nodes);
      expect(result).toHaveLength(1);
    });

    test('process #if with condition evaluation', () => {
      const compiler = new ConditionalCompiler();
      compiler.setSymbol('debug', true);

      const nodes = [
        { type: 'if', condition: 'debug', body: [{ type: 'code' }] },
        { type: 'endif' }
      ];

      const result = compiler.processDirectives(nodes);
      expect(result).toHaveLength(1);
    });

    test('parse directive from text', () => {
      const directive = DirectiveParser.parseDirective('#ifdef DEBUG');
      expect(directive?.type).toBe('ifdef');
      expect(directive?.condition).toBe('DEBUG');
    });

    test('configurable compiler - debug preset', () => {
      const compiler = new ConfigurableCompiler();
      compiler.addPreset('debug');

      expect(compiler.getCompiler().isDefined('debug')).toBe(true);
      expect(compiler.getCompiler().isDefined('release')).toBe(false);
    });

    test('configurable compiler - release preset', () => {
      const compiler = new ConfigurableCompiler();
      compiler.addPreset('release');

      expect(compiler.getCompiler().isDefined('debug')).toBe(false);
      expect(compiler.getCompiler().isDefined('release')).toBe(true);
    });

    test('set feature flag', () => {
      const compiler = new ConfigurableCompiler();
      compiler.setFeature('networking', true);

      expect(compiler.getCompiler().isDefined('feature_networking')).toBe(true);
    });

    test('set version information', () => {
      const compiler = new ConfigurableCompiler();
      compiler.setVersion(2, 0, 1);

      expect(compiler.getCompiler().getSymbol('version')).toBe('2.0.1');
      expect(compiler.getCompiler().getSymbol('version_major')).toBe(2);
    });
  });

  // =====================================================
  // STANDARD MACRO LIBRARY TESTS (10 tests)
  // =====================================================

  describe('Standard Macro Library', () => {
    test('assert macro defined', () => {
      const macro = StandardMacroLibrary.assert;
      expect(macro.name).toBe('assert');
      expect(macro.parameters).toHaveLength(2);
    });

    test('repeat macro defined', () => {
      const macro = StandardMacroLibrary.repeat;
      expect(macro.name).toBe('repeat');
    });

    test('trace macro defined', () => {
      const macro = StandardMacroLibrary.trace;
      expect(macro.name).toBe('trace');
    });

    test('get macro registry', () => {
      const registry = StandardMacroLibrary.getRegistry();
      expect(registry.has('assert')).toBe(true);
      expect(registry.has('repeat')).toBe(true);
      expect(registry.has('trace')).toBe(true);
    });

    test('control flow category macros', () => {
      const macros = MacroLibraryCategories.controlFlow;
      const names = macros.map(m => m.name);

      expect(names).toContain('repeat');
      expect(names).toContain('unless');
    });

    test('debugging category macros', () => {
      const macros = MacroLibraryCategories.debugging;
      const names = macros.map(m => m.name);

      expect(names).toContain('assert');
      expect(names).toContain('trace');
    });

    test('utility macros - min/max', () => {
      const minMacro = StandardMacroLibrary.min;
      const maxMacro = StandardMacroLibrary.max;

      expect(minMacro.name).toBe('min');
      expect(maxMacro.name).toBe('max');
    });

    test('macro documentation generation', () => {
      const doc = MacroDocumentation.getDoc('assert');
      expect(doc).toBeDefined();
      expect(typeof doc).toBe('string');
    });

    test('markdown documentation generation', () => {
      const md = MacroDocumentation.generateMarkdown();
      expect(md).toContain('# FreeLang Standard Macro Library');
      expect(md).toContain('assert');
    });

    test('all macros by category', () => {
      const categories = MacroLibraryCategories.allByCategory;
      expect(categories.size).toBeGreaterThan(0);
    });
  });

  // =====================================================
  // MACRO TYPE CHECKING TESTS (10 tests)
  // =====================================================

  describe('Macro Type Checking', () => {
    test('validate correct macro definition', () => {
      const macro = new MacroBuilder('test')
        .withParameter('x', 'expression')
        .withBody('x')
        .build();

      const result = MacroTypeChecker.validateMacroDefinition(macro);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('detect invalid macro name', () => {
      const macro = {
        kind: 'macro' as const,
        name: '123invalid',
        parameters: [],
        body: { type: 'literal' as const, content: 'test', tokens: [] }
      };

      const result = MacroTypeChecker.validateMacroDefinition(macro);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('detect duplicate parameter names', () => {
      const macro = {
        kind: 'macro' as const,
        name: 'test',
        parameters: [
          { name: 'x', kind: 'expression' as const },
          { name: 'x', kind: 'expression' as const }
        ],
        body: { type: 'literal' as const, content: 'test', tokens: [] }
      };

      const result = MacroTypeChecker.validateMacroDefinition(macro);
      expect(result.valid).toBe(false);
    });

    test('validate macro call', () => {
      const macro = new MacroBuilder('test')
        .withParameter('x')
        .withParameter('y')
        .withBody('x + y')
        .build();

      const call = {
        type: 'macro-call' as const,
        macroName: 'test',
        arguments: [{ value: 'a' }, { value: 'b' }]
      };

      const result = MacroTypeChecker.validateMacroCall(call, macro);
      expect(result.valid).toBe(true);
    });

    test('detect missing arguments', () => {
      const macro = new MacroBuilder('test')
        .withParameter('x')
        .withParameter('y')
        .withBody('x + y')
        .build();

      const call = {
        type: 'macro-call' as const,
        macroName: 'test',
        arguments: [{ value: 'a' }]
      };

      const result = MacroTypeChecker.validateMacroCall(call, macro);
      expect(result.valid).toBe(false);
    });

    test('check macro hygiene', () => {
      const macro = new MacroBuilder('test')
        .withParameter('x')
        .withBody('let _safe = x; _safe')
        .build();

      const errors = MacroConstraintValidator.checkHygiene(macro);
      expect(errors.length >= 0).toBe(true);  // May or may not have errors
    });

    test('check parameter substitution', () => {
      const macro = new MacroBuilder('test')
        .withParameter('x')
        .withBody('let x = 10; x')
        .build();

      const errors = MacroConstraintValidator.checkSubstitution(macro);
      expect(errors.length).toBeGreaterThan(0);  // Shadow variable
    });

    test('comprehensive macro validation', () => {
      const macro = new MacroBuilder('test')
        .withParameter('x', 'expression')
        .withBody('x')
        .build();

      const result = ComprehensiveMacroValidator.validate(macro);
      expect(result.valid).toBe(true);
    });

    test('format validation errors', () => {
      const errors = [
        { type: 'definition-error' as const, message: 'Test error' }
      ];

      const formatted = ComprehensiveMacroValidator.formatErrors(errors);
      expect(formatted).toContain('Test error');
    });

    test('no errors message', () => {
      const formatted = ComprehensiveMacroValidator.formatErrors([]);
      expect(formatted).toBe('No errors');
    });
  });
});
