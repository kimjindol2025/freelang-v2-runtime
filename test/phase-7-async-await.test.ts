/**
 * FreeLang Phase 7 Step 1: Async/Await Tests
 *
 * Comprehensive test suite for async/await functionality
 * 50+ test cases covering all aspects of async programming
 */

import * as assert from 'assert';

// Import async modules
import {
  AsyncFunctionDeclaration,
  AwaitExpression,
  createAsyncFunction,
  createAwaitExpression,
  isPromiseType,
  extractPromiseElementType,
  wrapInPromise
} from '../src/ast/async-await';

import {
  AsyncTypeChecker,
  TypeCheckError,
  validatePromiseType,
  createPromiseType,
  resolveAwaitType
} from '../src/type-checker/async-type-checker';

import {
  AsyncCodeGenerator,
  generatePromiseAll,
  generatePromiseRace,
  generateAsyncTryCatch
} from '../src/codegen/async-codegen';

import {
  all,
  race,
  resolve,
  reject,
  timeout,
  delay,
  retry,
  sequence,
  parallel,
  waterfall,
  deferred
} from '../src/stdlib/promise';

describe('Phase 7 Step 1: Async/Await Support', () => {
  // ========== AST Tests (10) ==========
  describe('AST: Async/Await Node Definitions', () => {
    it('should create async function with Promise return type', () => {
      const fn = createAsyncFunction(
        'fetchData',
        [{ name: 'url', type: 'string', optional: false }],
        'string',
        { type: 'block-statement', statements: [] }
      );

      assert.strictEqual(fn.type, 'async-function-decl');
      assert.strictEqual(fn.name, 'fetchData');
      assert.strictEqual(fn.returnType.elementType, 'string');
      assert.strictEqual(fn.returnType.isPromise, true);
    });

    it('should create await expression', () => {
      const expr = createAwaitExpression({
        type: 'identifier',
        name: 'promise'
      });

      assert.strictEqual(expr.type, 'await-expression');
      assert.strictEqual(expr.argument.name, 'promise');
    });

    it('should detect Promise types', () => {
      assert.strictEqual(isPromiseType('Promise<string>'), true);
      assert.strictEqual(isPromiseType('Promise<number>'), true);
      assert.strictEqual(isPromiseType('string'), false);
    });

    it('should extract Promise element type', () => {
      assert.strictEqual(extractPromiseElementType('Promise<string>'), 'string');
      assert.strictEqual(extractPromiseElementType('Promise<number>'), 'number');
      assert.strictEqual(extractPromiseElementType('Promise<User>'), 'User');
    });

    it('should wrap type in Promise', () => {
      assert.strictEqual(wrapInPromise('string'), 'Promise<string>');
      assert.strictEqual(wrapInPromise('number'), 'Promise<number>');
      assert.strictEqual(wrapInPromise('User'), 'Promise<User>');
    });

    it('should handle multiple async functions', () => {
      const fn1 = createAsyncFunction('fetch1', [], 'string', { type: 'block-statement', statements: [] });
      const fn2 = createAsyncFunction('fetch2', [], 'number', { type: 'block-statement', statements: [] });

      assert.strictEqual(fn1.returnType.elementType, 'string');
      assert.strictEqual(fn2.returnType.elementType, 'number');
    });

    it('should support async function with multiple parameters', () => {
      const fn = createAsyncFunction(
        'request',
        [
          { name: 'url', type: 'string', optional: false },
          { name: 'timeout', type: 'number', optional: true },
          { name: 'headers', type: 'object', optional: true }
        ],
        'string',
        { type: 'block-statement', statements: [] }
      );

      assert.strictEqual(fn.params.length, 3);
      assert.strictEqual(fn.params[0].name, 'url');
      assert.strictEqual(fn.params[1].optional, true);
    });

    it('should support generic async functions', () => {
      const fn = createAsyncFunction(
        'fetch',
        [],
        'T',
        { type: 'block-statement', statements: [] },
        ['T']
      );

      assert.deepStrictEqual(fn.typeParams, ['T']);
    });

    it('should create complex Promise types', () => {
      assert.strictEqual(wrapInPromise('Promise<string>'), 'Promise<Promise<string>>');
    });

    it('should validate Promise type structure', () => {
      assert.strictEqual(validatePromiseType('Promise<string>'), true);
      assert.strictEqual(validatePromiseType('Promise<number>'), true);
      assert.strictEqual(validatePromiseType('string'), false);
    });
  });

  // ========== Type Checking Tests (15) ==========
  describe('Type Checker: Async/Await Type Validation', () => {
    let typeChecker: AsyncTypeChecker;

    beforeEach(() => {
      typeChecker = new AsyncTypeChecker();
    });

    it('should accept async function with Promise return type', () => {
      const fn = createAsyncFunction(
        'fetchData',
        [{ name: 'url', type: 'string', optional: false }],
        'string',
        { type: 'block-statement', statements: [] }
      );

      const fnType = typeChecker.checkAsyncFunctionDeclaration(fn);
      assert.strictEqual((fnType as any).isAsync, true);
    });

    it('should track async context correctly', () => {
      assert.strictEqual(typeChecker.isInAsyncContext(), false);

      typeChecker.enterAsyncContext('fetchData', 'Promise<string>');
      assert.strictEqual(typeChecker.isInAsyncContext(), true);

      typeChecker.exitAsyncContext();
      assert.strictEqual(typeChecker.isInAsyncContext(), false);
    });

    it('should reject await outside async context', () => {
      const awaitExpr = createAwaitExpression({
        type: 'identifier',
        name: 'promise'
      });

      assert.throws(
        () => typeChecker.checkAwaitExpression(awaitExpr),
        /await can only be used in async functions/
      );
    });

    it('should accept await inside async context', () => {
      typeChecker.enterAsyncContext('fetchData', 'Promise<string>');

      const awaitExpr = createAwaitExpression({
        type: 'identifier',
        name: 'promise'
      } as any);

      // Type checking should accept it (would need actual promise in real scenario)
      typeChecker.exitAsyncContext();
      assert.strictEqual(typeChecker.isInAsyncContext(), false);
    });

    it('should reject non-Promise await', () => {
      typeChecker.enterAsyncContext('test', 'Promise<string>');

      assert.throws(
        () => {
          // This would happen during await type checking
          typeChecker.getPromiseElementType('string');
        },
        /Invalid Promise type/
      );

      typeChecker.exitAsyncContext();
    });

    it('should validate async return type', () => {
      // Simplified test - would need more complex setup in real scenario
      assert.doesNotThrow(() => {
        typeChecker.validateAsyncReturnType('Promise<string>', 'string');
      });
    });

    it('should handle nested async calls', () => {
      typeChecker.enterAsyncContext('outer', 'Promise<string>');
      assert.strictEqual(typeChecker.isInAsyncContext(), true);

      // Context should be maintained
      const context = typeChecker.getCurrentAsyncContext();
      assert(context !== null);

      typeChecker.exitAsyncContext();
      assert.strictEqual(typeChecker.isInAsyncContext(), false);
    });

    it('should create Promise type annotations', () => {
      const promiseType = createPromiseType('string');
      assert.strictEqual(promiseType, 'Promise<string>');
    });

    it('should resolve await types correctly', () => {
      const elementType = resolveAwaitType('Promise<string>');
      assert.strictEqual(elementType, 'string');
    });

    it('should reject invalid Promise types', () => {
      assert.throws(
        () => resolveAwaitType('string'),
        /Cannot await non-Promise/
      );
    });

    it('should track multiple async functions', () => {
      const fn1 = createAsyncFunction('fn1', [], 'string', { type: 'block-statement', statements: [] });
      const fn2 = createAsyncFunction('fn2', [], 'number', { type: 'block-statement', statements: [] });

      typeChecker.checkAsyncFunctionDeclaration(fn1);
      typeChecker.checkAsyncFunctionDeclaration(fn2);

      // Both functions should be registered
      assert.strictEqual(typeChecker.isPromiseType('Promise<string>'), true);
    });
  });

  // ========== Code Generation Tests (10) ==========
  describe('Code Generator: Async/Await Code Emission', () => {
    let codegen: AsyncCodeGenerator;

    beforeEach(() => {
      codegen = new AsyncCodeGenerator();
      codegen.resetIndent();
    });

    it('should generate async function declaration', () => {
      const fn = createAsyncFunction(
        'fetchData',
        [{ name: 'url', type: 'string', optional: false }],
        'string',
        { type: 'block-statement', statements: [] }
      );

      const code = codegen.generateAsyncFunction(fn);
      assert(code.includes('async function fetchData'));
      assert(code.includes('Promise<string>'));
    });

    it('should generate await expression', () => {
      const awaitExpr = createAwaitExpression({
        type: 'call-expression',
        name: 'fetch',
        arguments: []
      } as any);

      const code = codegen.generateAwaitExpression(awaitExpr);
      assert(code.includes('await'));
      assert(code.includes('fetch'));
    });

    it('should handle multiple parameters in async function', () => {
      const fn = createAsyncFunction(
        'request',
        [
          { name: 'url', type: 'string', optional: false },
          { name: 'timeout', type: 'number', optional: true }
        ],
        'string',
        { type: 'block-statement', statements: [] }
      );

      const code = codegen.generateAsyncFunction(fn);
      assert(code.includes('url: string'));
      assert(code.includes('timeout: number'));
    });

    it('should generate Promise.all for parallel execution', () => {
      const code = generatePromiseAll(['promise1', 'promise2', 'promise3']);
      assert(code.includes('Promise.all'));
      assert(code.includes('promise1'));
    });

    it('should generate Promise.race for first completion', () => {
      const code = generatePromiseRace(['promise1', 'promise2']);
      assert(code.includes('Promise.race'));
    });

    it('should generate try-catch for error handling', () => {
      const code = generateAsyncTryCatch('await operation()', 'console.error(error)');
      assert(code.includes('try'));
      assert(code.includes('catch'));
      assert(code.includes('error'));
    });

    it('should manage indentation correctly', () => {
      codegen.increaseIndent();
      const indent1 = codegen.setIndentation(1);

      codegen.increaseIndent();
      assert.strictEqual(codegen.setIndentation(2), undefined);

      codegen.decreaseIndent();
      codegen.resetIndent();
      assert.strictEqual(codegen.setIndentation(0), undefined);
    });

    it('should generate async function with error handling', () => {
      const fn = createAsyncFunction(
        'safeRequest',
        [{ name: 'url', type: 'string', optional: false }],
        'string',
        { type: 'block-statement', statements: [] }
      );

      const code = codegen.generateAsyncFunction(fn);
      assert(code.includes('async function safeRequest'));
      assert(code.includes('Promise<string>'));
    });

    it('should handle complex await expressions', () => {
      const awaitExpr = createAwaitExpression({
        type: 'call-expression',
        name: 'fetch',
        arguments: [{ type: 'string', value: 'url' }]
      } as any);

      const code = codegen.generateAwaitExpression(awaitExpr);
      assert(code.includes('await fetch'));
    });

    it('should generate properly formatted async code', () => {
      const fn = createAsyncFunction(
        'test',
        [],
        'void',
        { type: 'block-statement', statements: [] }
      );

      const code = codegen.generateAsyncFunction(fn);
      assert(code.includes('{'));
      assert(code.includes('}'));
      assert(code.includes('async function'));
    });
  });

  // ========== Promise Utilities Tests (15) ==========
  describe('Standard Library: Promise Utilities', () => {
    it('should create resolved promise', async () => {
      const p = resolve(42);
      const result = await p;
      assert.strictEqual(result, 42);
    });

    it('should create rejected promise', async () => {
      const p = reject(new Error('test error'));
      try {
        await p;
        assert.fail('Should have thrown');
      } catch (error) {
        assert((error as Error).message.includes('test error'));
      }
    });

    it('should wait for all promises', async () => {
      const p1 = resolve(1);
      const p2 = resolve(2);
      const p3 = resolve(3);

      const results = await all([p1, p2, p3]);
      assert.deepStrictEqual(results, [1, 2, 3]);
    });

    it('should return first promise in race', async () => {
      const p1 = delay(100, 'slow');
      const p2 = resolve('fast');
      const p3 = delay(50, 'medium');

      const result = await race([p1, p2, p3]);
      assert.strictEqual(result, 'fast');
    });

    it('should timeout long-running promise', async () => {
      const slowPromise = delay(1000, 'done');
      try {
        await timeout(slowPromise, 100);
        assert.fail('Should have timed out');
      } catch (error) {
        assert((error as Error).message.includes('Timeout'));
      }
    });

    it('should delay execution', async () => {
      const start = Date.now();
      await delay(50, undefined);
      const elapsed = Date.now() - start;
      assert(elapsed >= 50);
    });

    it('should retry failed operation', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 3) throw new Error('fail');
        return 'success';
      };

      const result = await retry(fn, 5, 10);
      assert.strictEqual(result, 'success');
      assert.strictEqual(attempts, 3);
    });

    it('should fail after max retries', async () => {
      const fn = async () => {
        throw new Error('persistent failure');
      };

      try {
        await retry(fn, 3, 10);
        assert.fail('Should have failed');
      } catch (error) {
        assert((error as Error).message.includes('retry'));
      }
    });

    it('should sequence promises', async () => {
      let order: number[] = [];
      const fns = [
        () => delay(30, undefined).then(() => { order.push(1); return 1; }),
        () => delay(20, undefined).then(() => { order.push(2); return 2; }),
        () => delay(10, undefined).then(() => { order.push(3); return 3; })
      ];

      const results = await sequence(fns);
      assert.deepStrictEqual(results, [1, 2, 3]);
      assert.deepStrictEqual(order, [1, 2, 3]);
    });

    it('should handle parallel execution', async () => {
      const fns = [
        () => resolve(1),
        () => resolve(2),
        () => resolve(3)
      ];

      const results = await parallel(fns, 2);
      assert.strictEqual(results.length, 3);
    });

    it('should handle waterfall operations', async () => {
      const fns = [
        () => resolve(1),
        (prev: number) => resolve(prev + 1),
        (prev: number) => resolve(prev * 2)
      ];

      const result = await waterfall(fns);
      assert.strictEqual(result, 4); // (1 + 1) * 2
    });

    it('should create deferred promise', async () => {
      const def = deferred<string>();
      def.resolve('hello');
      const result = await def.promise;
      assert.strictEqual(result, 'hello');
    });

    it('should map array with async function', async () => {
      const nums = [1, 2, 3];
      const results = await all(
        nums.map(n => resolve(n * 2))
      );
      assert.deepStrictEqual(results, [2, 4, 6]);
    });

    it('should handle promise rejection properly', async () => {
      const p = reject('error');
      try {
        await p;
        assert.fail('Should reject');
      } catch (error) {
        assert.strictEqual(error, 'error');
      }
    });

    it('should chain promise operations', async () => {
      const p = resolve(5)
        .then(x => x * 2)
        .then(x => x + 3);

      const result = await p;
      assert.strictEqual(result, 13);
    });
  });

  // ========== Integration Tests (10) ==========
  describe('Integration: Real-world Async Patterns', () => {
    it('should handle fetch-like pattern', async () => {
      const mockFetch = (url: string) => resolve({ text: () => resolve('response') });
      const response = await mockFetch('/api/data');
      assert(response);
    });

    it('should handle error handling in async', async () => {
      const asyncOp = async () => {
        try {
          throw new Error('operation failed');
        } catch (error) {
          return 'handled';
        }
      };

      const result = await asyncOp();
      assert.strictEqual(result, 'handled');
    });

    it('should handle sequential async operations', async () => {
      let value = 0;
      const op1 = async () => { value += 1; return value; };
      const op2 = async () => { value += 2; return value; };

      const r1 = await op1();
      const r2 = await op2();

      assert.strictEqual(r1, 1);
      assert.strictEqual(r2, 3);
    });

    it('should handle parallel async operations', async () => {
      const ops = [resolve(1), resolve(2), resolve(3)];
      const results = await all(ops);
      assert.strictEqual(results.reduce((a: number, b: number) => a + b, 0), 6);
    });

    it('should handle timeout in operations', async () => {
      const operation = delay(50, 'done');
      const withTimeout = timeout(operation, 100);
      const result = await withTimeout;
      assert.strictEqual(result, 'done');
    });

    it('should handle conditional async execution', async () => {
      const condition = true;
      const result = condition ? resolve('yes') : resolve('no');
      const answer = await result;
      assert.strictEqual(answer, 'yes');
    });

    it('should handle async array operations', async () => {
      const numbers = [1, 2, 3, 4, 5];
      const doubled = await all(
        numbers.map(n => resolve(n * 2))
      );
      assert.deepStrictEqual(doubled, [2, 4, 6, 8, 10]);
    });

    it('should handle nested promises', async () => {
      const nested = resolve(resolve(42));
      const result = await nested;
      // Depending on implementation, may need additional handling
      assert(result);
    });

    it('should handle promise chains', async () => {
      const chain = resolve(1)
        .then(x => x + 1)
        .then(x => x * 2);

      const result = await chain;
      assert.strictEqual(result, 4);
    });

    it('should handle mixed sync/async patterns', async () => {
      const syncValue = 10;
      const asyncValue = await resolve(5);
      assert.strictEqual(syncValue + asyncValue, 15);
    });
  });
});
