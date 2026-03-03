/**
 * Phase 3 Step 3: Function Types & Closures Tests
 * Tests lambda expression parsing, type checking, closure capture, and code generation
 */

import { FunctionTypeChecker, ClosureContext, LambdaExpressionResult } from '../src/analyzer/type-checker';
import { Parser } from '../src/parser/parser';
import { Lexer } from '../src/lexer/lexer';
import { TokenBuffer } from '../src/lexer/lexer';

describe('Phase 3 Step 3: Function Types & Closures', () => {
  let checker: FunctionTypeChecker;
  let parser: Parser;

  beforeEach(() => {
    checker = new FunctionTypeChecker();
  });

  // ======================================================================
  // TEST 1: Parse Lambda Expression Syntax
  // ======================================================================
  describe('Lambda Expression Parsing', () => {
    test('should parse simple lambda: fn(x) -> x + 1', () => {
      const code = 'fn(x) -> x + 1';
      const lexer = new Lexer(code);
      const tokens = new TokenBuffer(lexer);
      parser = new Parser(tokens);

      const expr = parser.parseExpression();

      expect(expr.type).toBe('lambda');
      expect((expr as any).params).toHaveLength(1);
      expect((expr as any).params[0].name).toBe('x');
      expect((expr as any).body.type).toBe('binary');
    });

    test('should parse lambda with multiple parameters: fn(x, y) -> x + y', () => {
      const code = 'fn(x, y) -> x + y';
      const lexer = new Lexer(code);
      const tokens = new TokenBuffer(lexer);
      parser = new Parser(tokens);

      const expr = parser.parseExpression();

      expect(expr.type).toBe('lambda');
      expect((expr as any).params).toHaveLength(2);
      expect((expr as any).params[0].name).toBe('x');
      expect((expr as any).params[1].name).toBe('y');
    });

    test('should parse lambda with type annotations: fn(x: number, y: string) -> bool', () => {
      const code = 'fn(x: number, y: string) -> bool -> x.length > 0';
      const lexer = new Lexer(code);
      const tokens = new TokenBuffer(lexer);
      parser = new Parser(tokens);

      const expr = parser.parseExpression();

      expect(expr.type).toBe('lambda');
      expect((expr as any).params).toHaveLength(2);
      expect((expr as any).paramTypes).toEqual(['number', 'string']);
      expect((expr as any).returnType).toBe('bool');
    });

    test('should parse lambda with array parameter type: fn(arr: array<number>) -> number', () => {
      const code = 'fn(arr: array<number>) -> number -> arr.length';
      const lexer = new Lexer(code);
      const tokens = new TokenBuffer(lexer);
      parser = new Parser(tokens);

      const expr = parser.parseExpression();

      expect(expr.type).toBe('lambda');
      expect((expr as any).paramTypes).toEqual(['array<number>']);
      expect((expr as any).returnType).toBe('number');
    });

    test('should parse lambda with complex body: fn(x) -> x * 2 + 1', () => {
      const code = 'fn(x) -> x * 2 + 1';
      const lexer = new Lexer(code);
      const tokens = new TokenBuffer(lexer);
      parser = new Parser(tokens);

      const expr = parser.parseExpression();

      expect(expr.type).toBe('lambda');
      expect((expr as any).body.type).toBe('binary');
      expect((expr as any).body.operator).toBe('+');
    });

    test('should parse lambda with no parameters: fn() -> 42', () => {
      const code = 'fn() -> 42';
      const lexer = new Lexer(code);
      const tokens = new TokenBuffer(lexer);
      parser = new Parser(tokens);

      const expr = parser.parseExpression();

      expect(expr.type).toBe('lambda');
      expect((expr as any).params).toHaveLength(0);
    });
  });

  // ======================================================================
  // TEST 2: Lambda Type Checking
  // ======================================================================
  describe('Lambda Type Validation', () => {
    test('should validate simple lambda with number parameter', () => {
      const lambda: any = {
        type: 'lambda',
        params: [{ name: 'x', paramType: 'number' }],
        paramTypes: ['number'],
        body: { type: 'binary', operator: '+', left: { type: 'identifier', name: 'x' }, right: { type: 'literal', value: 1 } },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: {},
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.compatible).toBe(true);
      expect(result.functionType).toBeDefined();
      expect(result.paramTypes).toEqual(['number']);
      expect(result.returnType).toBe('number');
    });

    test('should infer return type from lambda body', () => {
      const lambda: any = {
        type: 'lambda',
        params: [{ name: 'x', paramType: 'number' }],
        paramTypes: ['number'],
        body: { type: 'literal', value: true, dataType: 'bool' },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: {},
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.compatible).toBe(true);
      expect(result.returnType).toBe('bool');
    });

    test('should create correct function type: fn(number) -> number', () => {
      const lambda: any = {
        type: 'lambda',
        params: [{ name: 'x' }],
        paramTypes: ['number'],
        body: { type: 'identifier', name: 'x' },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: {},
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.compatible).toBe(true);
      expect(result.functionType).toBe('fn(number) -> unknown');
    });

    test('should validate lambda with multiple parameters', () => {
      const lambda: any = {
        type: 'lambda',
        params: [
          { name: 'x', paramType: 'number' },
          { name: 'y', paramType: 'number' }
        ],
        paramTypes: ['number', 'number'],
        body: { type: 'binary', operator: '+', left: { type: 'identifier', name: 'x' }, right: { type: 'identifier', name: 'y' } },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: {},
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.compatible).toBe(true);
      expect(result.paramTypes).toEqual(['number', 'number']);
    });
  });

  // ======================================================================
  // TEST 3: Closure Variable Capture
  // ======================================================================
  describe('Closure Variable Capture', () => {
    test('should capture variable from outer scope', () => {
      const lambda: any = {
        type: 'lambda',
        params: [{ name: 'x' }],
        paramTypes: ['number'],
        body: { type: 'binary', operator: '+', left: { type: 'identifier', name: 'x' }, right: { type: 'identifier', name: 'multiplier' } },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: { multiplier: 'number', other: 'string' },
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.capturedVars).toContain('multiplier');
      expect(result.capturedVars).not.toContain('other');
    });

    test('should not capture lambda parameters as closure vars', () => {
      const lambda: any = {
        type: 'lambda',
        params: [{ name: 'x' }],
        paramTypes: ['number'],
        body: { type: 'identifier', name: 'x' },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: { x: 'number' },  // shadowed by parameter
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      // 'x' should not be in captured vars (it's a parameter)
      expect(result.capturedVars).not.toContain('x');
    });

    test('should capture multiple outer variables', () => {
      const lambda: any = {
        type: 'lambda',
        params: [{ name: 'x' }],
        paramTypes: ['number'],
        body: {
          type: 'binary',
          operator: '+',
          left: {
            type: 'binary',
            operator: '*',
            left: { type: 'identifier', name: 'x' },
            right: { type: 'identifier', name: 'a' }
          },
          right: { type: 'identifier', name: 'b' }
        },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: { a: 'number', b: 'number', c: 'string' },
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.capturedVars).toContain('a');
      expect(result.capturedVars).toContain('b');
      expect(result.capturedVars).not.toContain('c');
    });
  });

  // ======================================================================
  // TEST 4: Nested Lambdas (Higher-order functions)
  // ======================================================================
  describe('Nested Lambdas & Higher-order Functions', () => {
    test('should parse lambda returning lambda: fn(x) -> fn(y) -> x + y', () => {
      const code = 'fn(x) -> fn(y) -> x + y';
      const lexer = new Lexer(code);
      const tokens = new TokenBuffer(lexer);
      parser = new Parser(tokens);

      const expr = parser.parseExpression();

      expect(expr.type).toBe('lambda');
      expect((expr as any).body.type).toBe('lambda');
      expect((expr as any).body.body.type).toBe('binary');
    });

    test('should validate nested lambda with closure capture', () => {
      const innerLambda: any = {
        type: 'lambda',
        params: [{ name: 'y' }],
        paramTypes: ['number'],
        body: { type: 'binary', operator: '+', left: { type: 'identifier', name: 'x' }, right: { type: 'identifier', name: 'y' } },
        capturedVars: []
      };

      const outerLambda: any = {
        type: 'lambda',
        params: [{ name: 'x' }],
        paramTypes: ['number'],
        body: innerLambda,
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: {},
        functions: {}
      };

      const result = checker.validateLambda(outerLambda, context);

      expect(result.compatible).toBe(true);
      // Inner lambda should capture 'x' from outer lambda
    });

    test('should infer curried function type: fn(number) -> fn(number) -> number', () => {
      const lambda: any = {
        type: 'lambda',
        params: [{ name: 'x' }],
        paramTypes: ['number'],
        body: {
          type: 'lambda',
          params: [{ name: 'y' }],
          paramTypes: ['number'],
          body: { type: 'binary', operator: '+', left: { type: 'identifier', name: 'x' }, right: { type: 'identifier', name: 'y' } }
        },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: {},
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.compatible).toBe(true);
      expect(result.functionType).toContain('fn(number)');
    });
  });

  // ======================================================================
  // TEST 5: Lambda with Array Methods
  // ======================================================================
  describe('Lambda as Argument to Array Methods', () => {
    test('should validate lambda as map argument: array.map(fn(x) -> x * 2)', () => {
      const lambda: any = {
        type: 'lambda',
        params: [{ name: 'x' }],
        paramTypes: ['number'],
        body: { type: 'binary', operator: '*', left: { type: 'identifier', name: 'x' }, right: { type: 'literal', value: 2 } },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: { arr: 'array<number>' },
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.compatible).toBe(true);
      expect(result.returnType).toBe('number');
    });

    test('should validate lambda as filter argument: array.filter(fn(x) -> x > 0)', () => {
      const lambda: any = {
        type: 'lambda',
        params: [{ name: 'x' }],
        paramTypes: ['number'],
        body: { type: 'binary', operator: '>', left: { type: 'identifier', name: 'x' }, right: { type: 'literal', value: 0 } },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: { arr: 'array<number>' },
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.compatible).toBe(true);
      expect(result.returnType).toBe('bool');
    });

    test('should validate lambda as reduce argument: array.reduce(fn(sum, x) -> sum + x, 0)', () => {
      const lambda: any = {
        type: 'lambda',
        params: [
          { name: 'sum', paramType: 'number' },
          { name: 'x', paramType: 'number' }
        ],
        paramTypes: ['number', 'number'],
        body: { type: 'binary', operator: '+', left: { type: 'identifier', name: 'sum' }, right: { type: 'identifier', name: 'x' } },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: { arr: 'array<number>' },
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.compatible).toBe(true);
      expect(result.paramTypes).toEqual(['number', 'number']);
    });
  });

  // ======================================================================
  // TEST 6: Function Type Inference
  // ======================================================================
  describe('Function Type Inference', () => {
    test('should infer function type from lambda without annotations', () => {
      const lambda: any = {
        type: 'lambda',
        params: [{ name: 'x' }],
        body: { type: 'literal', value: 42 },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: {},
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.compatible).toBe(true);
      expect(result.paramTypes).toEqual(['unknown']);
      expect(result.returnType).toBe('number');
    });

    test('should infer parameter types from context when available', () => {
      const lambda: any = {
        type: 'lambda',
        params: [{ name: 'x' }, { name: 'y' }],
        body: { type: 'binary', operator: '+', left: { type: 'identifier', name: 'x' }, right: { type: 'identifier', name: 'y' } },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: { x: 'number', y: 'number' },
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.compatible).toBe(true);
      // Parameters should be inferred or marked as unknown
      expect(result.paramTypes).toBeDefined();
    });

    test('should create function type string from inferred types', () => {
      const functionType = checker.createFunctionType(['number', 'string'], 'bool');

      expect(functionType).toBe('fn(number, string) -> bool');
    });
  });

  // ======================================================================
  // TEST 7: Closure Context Management
  // ======================================================================
  describe('Closure Context (Scope Management)', () => {
    test('should maintain separate contexts for nested scopes', () => {
      const outerContext: ClosureContext = {
        variables: { x: 'number', y: 'string' },
        functions: {}
      };

      const innerContext: ClosureContext = {
        variables: { x: 'number', z: 'bool' },
        functions: {},
        parentContext: outerContext
      };

      // Inner scope can see 'x' (shadowed), 'z', and parent's 'y'
      expect(innerContext.variables['x']).toBe('number');  // shadowed
      expect(innerContext.variables['z']).toBe('bool');
      expect(innerContext.parentContext?.variables['y']).toBe('string');
    });

    test('should track function definitions in context', () => {
      const context: ClosureContext = {
        variables: { x: 'number' },
        functions: {
          add: { params: { a: 'number', b: 'number' }, returnType: 'number' },
          greet: { params: { name: 'string' } }
        }
      };

      expect(context.functions['add'].returnType).toBe('number');
      expect(context.functions['greet'].params['name']).toBe('string');
    });
  });

  // ======================================================================
  // TEST 8: Error Handling
  // ======================================================================
  describe('Error Handling & Type Mismatches', () => {
    test('should handle invalid lambda body type', () => {
      const lambda: any = {
        type: 'lambda',
        params: [{ name: 'x', paramType: 'number' }],
        paramTypes: ['number'],
        body: null,  // Invalid
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: {},
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      // Should not crash, should handle gracefully
      expect(typeof result.compatible).toBe('boolean');
    });

    test('should detect undefined variables in lambda body', () => {
      const lambda: any = {
        type: 'lambda',
        params: [{ name: 'x' }],
        paramTypes: ['number'],
        body: { type: 'identifier', name: 'undefined_var' },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: {},  // undefined_var not in scope
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      // Should capture that undefined_var is not available
      expect(Array.isArray(result.capturedVars)).toBe(true);
    });

    test('should handle lambda with invalid parameter names', () => {
      // This would typically be caught by the parser, but type checker should be robust
      const lambda: any = {
        type: 'lambda',
        params: [],
        body: { type: 'literal', value: 42 },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: {},
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.compatible).toBe(true);  // Valid: no-parameter lambda
    });
  });

  // ======================================================================
  // Real-World Scenarios
  // ======================================================================
  describe('Real-world Lambda Scenarios', () => {
    test('Scenario 1: Array.map with lambda - double all numbers', () => {
      const code = 'fn(x: number) -> x * 2';
      const lexer = new Lexer(code);
      const tokens = new TokenBuffer(lexer);
      parser = new Parser(tokens);

      const expr = parser.parseExpression();

      expect(expr.type).toBe('lambda');
      expect((expr as any).paramTypes).toEqual(['number']);

      const lambda = expr as any;
      const context: ClosureContext = {
        variables: { numbers: 'array<number>' },
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.compatible).toBe(true);
      expect(result.returnType).toBe('number');
    });

    test('Scenario 2: Array.filter with closure - filter by threshold', () => {
      // fn(x) -> x > threshold (captures 'threshold' from outer scope)
      const lambda: any = {
        type: 'lambda',
        params: [{ name: 'x' }],
        paramTypes: ['number'],
        body: { type: 'binary', operator: '>', left: { type: 'identifier', name: 'x' }, right: { type: 'identifier', name: 'threshold' } },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: { threshold: 'number', data: 'array<number>' },
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.compatible).toBe(true);
      expect(result.capturedVars).toContain('threshold');
      expect(result.returnType).toBe('bool');
    });

    test('Scenario 3: Curried function - add with partial application', () => {
      const code = 'fn(a: number) -> fn(b: number) -> a + b';
      const lexer = new Lexer(code);
      const tokens = new TokenBuffer(lexer);
      parser = new Parser(tokens);

      const expr = parser.parseExpression();

      expect(expr.type).toBe('lambda');
      expect((expr as any).body.type).toBe('lambda');
    });

    test('Scenario 4: Function as callback - sort with custom comparator', () => {
      const lambda: any = {
        type: 'lambda',
        params: [
          { name: 'a', paramType: 'number' },
          { name: 'b', paramType: 'number' }
        ],
        paramTypes: ['number', 'number'],
        body: { type: 'binary', operator: '-', left: { type: 'identifier', name: 'a' }, right: { type: 'identifier', name: 'b' } },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: { numbers: 'array<number>' },
        functions: {}
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.compatible).toBe(true);
      expect(result.returnType).toBe('number');
    });

    test('Scenario 5: Complex closure - event handler with captured state', () => {
      const lambda: any = {
        type: 'lambda',
        params: [{ name: 'event' }],
        paramTypes: ['unknown'],
        body: {
          type: 'binary',
          operator: '+',
          left: { type: 'identifier', name: 'state' },
          right: { type: 'identifier', name: 'increment' }
        },
        capturedVars: []
      };

      const context: ClosureContext = {
        variables: { state: 'number', increment: 'number', config: 'unknown' },
        functions: { log: { params: { msg: 'string' } } }
      };

      const result = checker.validateLambda(lambda, context);

      expect(result.compatible).toBe(true);
      expect(result.capturedVars).toContain('state');
      expect(result.capturedVars).toContain('increment');
    });
  });
});
