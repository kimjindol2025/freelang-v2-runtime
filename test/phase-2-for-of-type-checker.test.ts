/**
 * Phase 2: for...of Type Checker Tests
 * Validates type checking for for...of statements
 */

import { StatementTypeChecker } from '../src/analyzer/statement-type-checker';
import { FunctionTypeChecker } from '../src/analyzer/type-checker';
import { ForOfStatement } from '../src/parser/ast';

describe('ForOf Type Checker', () => {
  let checker: StatementTypeChecker;
  let funcTypeChecker: FunctionTypeChecker;

  beforeEach(() => {
    checker = new StatementTypeChecker();
    funcTypeChecker = new FunctionTypeChecker();
  });

  // ======================================================================
  // TEST 1: Accept array<string> type
  // ======================================================================
  test('should accept array<string> iterable', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'item',
      iterable: {
        type: 'array',
        elements: [
          { type: 'literal', value: 'hello', dataType: 'string' },
          { type: 'literal', value: 'world', dataType: 'string' }
        ]
      },
      body: { type: 'block', body: [] }
    };

    const result = checker.checkForOfStatement(stmt);

    expect(result.compatible).toBe(true);
    expect(result.message).toContain('type-safe');
    expect(result.message).toContain('item');
    expect(result.message).toContain('string');
  });

  // ======================================================================
  // TEST 2: Accept array<number> type
  // ======================================================================
  test('should accept array<number> iterable', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'num',
      iterable: {
        type: 'array',
        elements: [
          { type: 'literal', value: 1, dataType: 'number' },
          { type: 'literal', value: 2, dataType: 'number' },
          { type: 'literal', value: 3, dataType: 'number' }
        ]
      },
      body: { type: 'block', body: [] }
    };

    const result = checker.checkForOfStatement(stmt);

    expect(result.compatible).toBe(true);
    expect(result.message).toContain('array<number>');
    expect(result.details?.expected).toBe('number');
  });

  // ======================================================================
  // TEST 3: Reject non-array type (string)
  // ======================================================================
  test('should reject non-array type (string)', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'char',
      iterable: {
        type: 'literal',
        value: 'hello',
        dataType: 'string'
      },
      body: { type: 'block', body: [] }
    };

    const result = checker.checkForOfStatement(stmt);

    expect(result.compatible).toBe(false);
    expect(result.message).toContain('array type');
    expect(result.message).toContain('string');
    expect(result.details?.expected).toBe('array<T>');
    expect(result.details?.received).toBe('string');
  });

  // ======================================================================
  // TEST 4: Reject non-array type (number)
  // ======================================================================
  test('should reject non-array type (number)', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'x',
      iterable: {
        type: 'literal',
        value: 42,
        dataType: 'number'
      },
      body: { type: 'block', body: [] }
    };

    const result = checker.checkForOfStatement(stmt);

    expect(result.compatible).toBe(false);
    expect(result.message).toContain('array type');
    expect(result.message).toContain('number');
  });

  // ======================================================================
  // TEST 5: Extract element type correctly
  // ======================================================================
  test('should extract element type from array<T>', () => {
    // Test string elements
    let elementType = funcTypeChecker.extractElementType('array<string>');
    expect(elementType).toBe('string');

    // Test number elements
    elementType = funcTypeChecker.extractElementType('array<number>');
    expect(elementType).toBe('number');

    // Test bool elements
    elementType = funcTypeChecker.extractElementType('array<bool>');
    expect(elementType).toBe('bool');

    // Test object elements
    elementType = funcTypeChecker.extractElementType('array<object>');
    expect(elementType).toBe('object');

    // Test unknown on invalid input
    elementType = funcTypeChecker.extractElementType('string');
    expect(elementType).toBe('unknown');
  });

  // ======================================================================
  // TEST 6: Variable bound with correct type in scope
  // ======================================================================
  test('should bind loop variable in scope with correct type', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'item',
      iterable: {
        type: 'array',
        elements: [
          { type: 'literal', value: 'a', dataType: 'string' },
          { type: 'literal', value: 'b', dataType: 'string' }
        ]
      },
      body: { type: 'block', body: [] }
    };

    // Before check: scope depth should be 1 (global)
    expect(checker.getScopeDepth()).toBe(1);

    const result = checker.checkForOfStatement(stmt);

    // After check: scope depth should be back to 1 (loop scope is exited)
    expect(checker.getScopeDepth()).toBe(1);

    // Check succeeded
    expect(result.compatible).toBe(true);
  });

  // ======================================================================
  // TEST 7: Scope management - variables isolated to loop
  // ======================================================================
  test('should create isolated scope for loop body', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'x',
      iterable: {
        type: 'array',
        elements: [
          { type: 'literal', value: 1, dataType: 'number' }
        ]
      },
      body: { type: 'block', body: [] }
    };

    // Declare global variable
    checker.declareVariable('y', 'string');

    // Check global scope has 'y'
    const globalVars = checker.getCurrentScopeVariables();
    expect(globalVars['y']).toBe('string');
    expect(globalVars['x']).toBeUndefined();

    // After for...of check, global scope should still have 'y' but not 'x'
    checker.checkForOfStatement(stmt);
    const globalVarsAfter = checker.getCurrentScopeVariables();
    expect(globalVarsAfter['y']).toBe('string');
    expect(globalVarsAfter['x']).toBeUndefined();
  });

  // ======================================================================
  // TEST 8: Optional type annotation on loop variable
  // ======================================================================
  test('should respect explicit type annotation on loop variable', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'item',
      variableType: 'string',  // Explicit type annotation
      iterable: {
        type: 'array',
        elements: [
          { type: 'literal', value: 'x', dataType: 'string' }
        ]
      },
      body: { type: 'block', body: [] }
    };

    const result = checker.checkForOfStatement(stmt);

    expect(result.compatible).toBe(true);
    expect(result.message).toContain('string');
  });

  // ======================================================================
  // TEST 9: Empty array
  // ======================================================================
  test('should accept empty array', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'item',
      iterable: {
        type: 'array',
        elements: []
      },
      body: { type: 'block', body: [] }
    };

    const result = checker.checkForOfStatement(stmt);

    // Empty array infers to array<unknown>
    expect(result.compatible).toBe(true);
  });

  // ======================================================================
  // TEST 10: Identifier as iterable
  // ======================================================================
  test('should handle identifier as iterable', () => {
    // First declare a variable with array type
    checker.declareVariable('myArray', 'array<number>');

    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'num',
      iterable: {
        type: 'identifier',
        name: 'myArray'
      },
      body: { type: 'block', body: [] }
    };

    const result = checker.checkForOfStatement(stmt);

    expect(result.compatible).toBe(true);
    expect(result.message).toContain('number');
  });

  // ======================================================================
  // FunctionTypeChecker Tests
  // ======================================================================

  describe('FunctionTypeChecker ForOf methods', () => {
    test('checkForOfStatement should validate array type', () => {
      const result = funcTypeChecker.checkForOfStatement(
        'item',
        'array<string>'
      );
      expect(result.compatible).toBe(true);
    });

    test('checkForOfStatement should reject non-array', () => {
      const result = funcTypeChecker.checkForOfStatement(
        'item',
        'string'
      );
      expect(result.compatible).toBe(false);
    });

    test('getForOfVariableType should return element type', () => {
      const type = funcTypeChecker.getForOfVariableType('array<number>');
      expect(type).toBe('number');
    });

    test('getForOfVariableType should return unknown for non-array', () => {
      const type = funcTypeChecker.getForOfVariableType('string');
      expect(type).toBe('unknown');
    });
  });

  // ======================================================================
  // Complex Nested Scenarios
  // ======================================================================

  describe('Complex scenarios', () => {
    test('should handle nested for...of with multiple variables', () => {
      // Outer for...of
      const outerStmt: ForOfStatement = {
        type: 'forOf',
        variable: 'row',
        iterable: {
          type: 'array',
          elements: [
            {
              type: 'array',
              elements: [
                { type: 'literal', value: 1, dataType: 'number' },
                { type: 'literal', value: 2, dataType: 'number' }
              ]
            }
          ]
        },
        body: { type: 'block', body: [] }
      };

      const result = checker.checkForOfStatement(outerStmt);
      expect(result.compatible).toBe(true);
    });

    test('should handle array of objects', () => {
      const stmt: ForOfStatement = {
        type: 'forOf',
        variable: 'user',
        iterable: {
          type: 'array',
          elements: [
            { type: 'literal', value: { name: 'Alice' }, dataType: 'object' },
            { type: 'literal', value: { name: 'Bob' }, dataType: 'object' }
          ]
        },
        body: { type: 'block', body: [] }
      };

      const result = checker.checkForOfStatement(stmt);
      expect(result.compatible).toBe(true);
    });

    test('should handle array of booleans', () => {
      const stmt: ForOfStatement = {
        type: 'forOf',
        variable: 'flag',
        iterable: {
          type: 'array',
          elements: [
            { type: 'literal', value: true, dataType: 'bool' },
            { type: 'literal', value: false, dataType: 'bool' }
          ]
        },
        body: { type: 'block', body: [] }
      };

      const result = checker.checkForOfStatement(stmt);
      expect(result.compatible).toBe(true);
      expect(result.message).toContain('bool');
    });
  });
});
