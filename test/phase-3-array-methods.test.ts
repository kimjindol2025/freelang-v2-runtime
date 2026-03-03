/**
 * Phase 3 Step 2: Array Methods Type Checking Tests
 * Validates array method signatures, type checking, and result type inference
 */

import { FunctionTypeChecker, ArrayMethodResult } from '../src/analyzer/type-checker';

describe('Phase 3 Step 2: Array Methods Type Checking', () => {
  let checker: FunctionTypeChecker;

  beforeEach(() => {
    checker = new FunctionTypeChecker();
  });

  // ======================================================================
  // TEST 1: Array Type Detection
  // ======================================================================
  test('should detect array types correctly', () => {
    expect(checker.isArrayType('array<number>')).toBe(true);
    expect(checker.isArrayType('array<string>')).toBe(true);
    expect(checker.isArrayType('array<array<number>>')).toBe(true);
    expect(checker.isArrayType('number')).toBe(false);
    expect(checker.isArrayType('string')).toBe(false);
    expect(checker.isArrayType('object')).toBe(false);
  });

  // ======================================================================
  // TEST 2: Extract Element Type from Array
  // ======================================================================
  test('should extract element type from array type', () => {
    let elementType = checker.getArrayElementType('array<number>');
    expect(elementType).toBe('number');

    elementType = checker.getArrayElementType('array<string>');
    expect(elementType).toBe('string');

    elementType = checker.getArrayElementType('array<array<number>>');
    expect(elementType).toBe('array<number>');

    elementType = checker.getArrayElementType('number');
    expect(elementType).toBe('unknown');
  });

  // ======================================================================
  // TEST 3: Create Array Type from Element Type
  // ======================================================================
  test('should create array type from element type', () => {
    let arrayType = checker.createArrayType('number');
    expect(arrayType).toBe('array<number>');

    arrayType = checker.createArrayType('string');
    expect(arrayType).toBe('array<string>');

    arrayType = checker.createArrayType('array<number>');
    expect(arrayType).toBe('array<array<number>>');
  });

  // ======================================================================
  // TEST 4: Get Array Method Signature
  // ======================================================================
  test('should get correct signatures for array methods', () => {
    // map signature
    let sig = checker.getArrayMethodSignature('map');
    expect(sig).not.toBeNull();
    expect(sig?.typeVars).toEqual(['T', 'U']);
    expect(sig?.params['array']).toBe('array<T>');
    expect(sig?.params['transform']).toBe('fn(T) -> U');
    expect(sig?.returnType).toBe('array<U>');

    // filter signature
    sig = checker.getArrayMethodSignature('filter');
    expect(sig?.typeVars).toEqual(['T']);
    expect(sig?.params['predicate']).toBe('fn(T) -> bool');

    // reduce signature
    sig = checker.getArrayMethodSignature('reduce');
    expect(sig?.typeVars).toEqual(['T', 'U']);
    expect(sig?.params['reducer']).toBe('fn(U, T) -> U');

    // Unknown method
    sig = checker.getArrayMethodSignature('unknown');
    expect(sig).toBeNull();
  });

  // ======================================================================
  // TEST 5: Array.map() Type Checking
  // ======================================================================
  test('should validate array.map(fn) type correctly', () => {
    // map(fn(number) -> string) on array<number> -> array<string>
    let result = checker.checkArrayMethodCall(
      'map',
      'array<number>',
      ['fn(number) -> string']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('array<string>');

    // map(fn(number) -> number) on array<number> -> array<number>
    result = checker.checkArrayMethodCall(
      'map',
      'array<number>',
      ['fn(number) -> number']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('array<number>');

    // map on array of objects
    result = checker.checkArrayMethodCall(
      'map',
      'array<object>',
      ['fn(object) -> string']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('array<string>');
  });

  // ======================================================================
  // TEST 6: Array.filter() Type Checking
  // ======================================================================
  test('should validate array.filter(fn) type correctly', () => {
    // filter(fn(number) -> bool) on array<number> -> array<number>
    let result = checker.checkArrayMethodCall(
      'filter',
      'array<number>',
      ['fn(number) -> bool']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('array<number>');

    // filter on array<string>
    result = checker.checkArrayMethodCall(
      'filter',
      'array<string>',
      ['fn(string) -> bool']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('array<string>');

    // filter preserves element type
    result = checker.checkArrayMethodCall(
      'filter',
      'array<array<number>>',
      ['fn(array<number>) -> bool']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('array<array<number>>');
  });

  // ======================================================================
  // TEST 7: Array.reduce() Type Checking
  // ======================================================================
  test('should validate array.reduce(fn, init) type correctly', () => {
    // reduce(fn(number, number) -> number, 0) on array<number> -> number
    let result = checker.checkArrayMethodCall(
      'reduce',
      'array<number>',
      ['fn(number, number) -> number', 'number']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('number');

    // reduce with different accumulator type
    result = checker.checkArrayMethodCall(
      'reduce',
      'array<string>',
      ['fn(number, string) -> number', 'number']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('number');
  });

  // ======================================================================
  // TEST 8: Array.find() Type Checking
  // ======================================================================
  test('should validate array.find(fn) type correctly', () => {
    // find(fn(number) -> bool) on array<number> -> number
    let result = checker.checkArrayMethodCall(
      'find',
      'array<number>',
      ['fn(number) -> bool']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('number');

    // find on array<string>
    result = checker.checkArrayMethodCall(
      'find',
      'array<string>',
      ['fn(string) -> bool']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('string');
  });

  // ======================================================================
  // TEST 9: Array.any() and Array.all() Type Checking
  // ======================================================================
  test('should validate array.any() and array.all() type correctly', () => {
    // any and all return bool
    let result = checker.checkArrayMethodCall(
      'any',
      'array<number>',
      ['fn(number) -> bool']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('bool');

    result = checker.checkArrayMethodCall(
      'all',
      'array<string>',
      ['fn(string) -> bool']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('bool');
  });

  // ======================================================================
  // TEST 10: Array.concat() Type Checking
  // ======================================================================
  test('should validate array.concat(array) type correctly', () => {
    // concat(array<number>) on array<number> -> array<number>
    let result = checker.checkArrayMethodCall(
      'concat',
      'array<number>',
      ['array<number>']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('array<number>');

    // concat preserves element type
    result = checker.checkArrayMethodCall(
      'concat',
      'array<string>',
      ['array<string>']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('array<string>');
  });

  // ======================================================================
  // TEST 11: Array.flatten() Type Checking
  // ======================================================================
  test('should validate array.flatten() type correctly', () => {
    // flatten on array<array<number>> -> array<number>
    let result = checker.checkArrayMethodCall(
      'flatten',
      'array<array<number>>',
      []
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('array<number>');

    // flatten on array<array<string>>
    result = checker.checkArrayMethodCall(
      'flatten',
      'array<array<string>>',
      []
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('array<string>');

    // flatten on nested
    result = checker.checkArrayMethodCall(
      'flatten',
      'array<array<array<number>>>',
      []
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('array<array<number>>');
  });

  // ======================================================================
  // TEST 12: Array.sort() Type Checking
  // ======================================================================
  test('should validate array.sort(comparator) type correctly', () => {
    // sort(fn(number, number) -> number) -> array<number>
    let result = checker.checkArrayMethodCall(
      'sort',
      'array<number>',
      ['fn(number, number) -> number']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('array<number>');

    // sort preserves array type
    result = checker.checkArrayMethodCall(
      'sort',
      'array<string>',
      ['fn(string, string) -> number']
    );

    expect(result.compatible).toBe(true);
    expect(result.resultType).toBe('array<string>');
  });

  // ======================================================================
  // TEST 13: Error Cases - Type Mismatches
  // ======================================================================
  test('should detect type mismatches in array method calls', () => {
    // map with wrong function type
    let result = checker.checkArrayMethodCall(
      'map',
      'array<number>',
      ['fn(string) -> string']  // Expects fn(number) -> U
    );

    expect(result.compatible).toBe(false);
    expect(result.error).not.toBeUndefined();

    // filter with function returning wrong type
    result = checker.checkArrayMethodCall(
      'filter',
      'array<number>',
      ['fn(number) -> string']  // Expects fn(T) -> bool
    );

    expect(result.compatible).toBe(false);
  });

  // ======================================================================
  // TEST 14: Error Cases - Wrong Parameter Count
  // ======================================================================
  test('should detect parameter count mismatch', () => {
    // map with missing function argument
    let result = checker.checkArrayMethodCall(
      'map',
      'array<number>',
      []  // Missing function argument
    );

    expect(result.compatible).toBe(false);

    // reduce with missing initial value
    result = checker.checkArrayMethodCall(
      'reduce',
      'array<number>',
      ['fn(number, number) -> number']  // Missing initial value
    );

    expect(result.compatible).toBe(false);
  });

  // ======================================================================
  // TEST 15: Method Chaining - Sequential Operations
  // ======================================================================
  test('should validate method chains', () => {
    // array<number>.filter(...).map(...) -> array<string>
    let result = checker.validateMethodChain(
      'array<number>',
      [
        { method: 'filter', argTypes: ['fn(number) -> bool'] },
        { method: 'map', argTypes: ['fn(number) -> string'] }
      ]
    );

    expect(result.compatible).toBe(true);
    expect(result.type).toBe('array<string>');

    // array<string>.map(...).reduce(...) -> number
    result = checker.validateMethodChain(
      'array<string>',
      [
        { method: 'map', argTypes: ['fn(string) -> number'] },
        { method: 'reduce', argTypes: ['fn(number, number) -> number', 'number'] }
      ]
    );

    expect(result.compatible).toBe(true);
    expect(result.type).toBe('number');
  });

  // ======================================================================
  // TEST 16: Method Chaining - Error in Chain
  // ======================================================================
  test('should detect errors in method chains', () => {
    // array<number>.filter(...).concat(string) - type mismatch
    let result = checker.validateMethodChain(
      'array<number>',
      [
        { method: 'filter', argTypes: ['fn(number) -> bool'] },
        { method: 'concat', argTypes: ['array<string>'] }  // Type mismatch
      ]
    );

    expect(result.compatible).toBe(false);
    expect(result.error).toBeDefined();
  });

  // ======================================================================
  // Real-World Scenarios
  // ======================================================================
  describe('Real-world array method scenarios', () => {
    test('Filter > Map > Reduce: Process and aggregate', () => {
      // Filter numbers > 0, map to double, reduce to sum
      let result = checker.validateMethodChain(
        'array<number>',
        [
          { method: 'filter', argTypes: ['fn(number) -> bool'] },
          { method: 'map', argTypes: ['fn(number) -> number'] },
          { method: 'reduce', argTypes: ['fn(number, number) -> number', 'number'] }
        ]
      );

      expect(result.compatible).toBe(true);
      expect(result.type).toBe('number');
    });

    test('Map > Filter > Flatten: Transform and flatten', () => {
      // Map numbers to arrays, filter arrays, flatten result
      let result = checker.validateMethodChain(
        'array<number>',
        [
          { method: 'map', argTypes: ['fn(number) -> array<number>'] },
          { method: 'flatten', argTypes: [] }
        ]
      );

      expect(result.compatible).toBe(true);
      expect(result.type).toBe('array<number>');
    });

    test('Extract object fields > Filter > Join strings', () => {
      // Extract names from objects, filter by length, result is array<string>
      let result = checker.validateMethodChain(
        'array<object>',
        [
          { method: 'map', argTypes: ['fn(object) -> string'] },
          { method: 'filter', argTypes: ['fn(string) -> bool'] }
        ]
      );

      expect(result.compatible).toBe(true);
      expect(result.type).toBe('array<string>');
    });

    test('Find > Check existence', () => {
      // Find single matching element
      let result = checker.checkArrayMethodCall(
        'find',
        'array<object>',
        ['fn(object) -> bool']
      );

      expect(result.compatible).toBe(true);
      expect(result.resultType).toBe('object');
    });

    test('Any/All predicates', () => {
      // Check if any element matches
      let result = checker.checkArrayMethodCall(
        'any',
        'array<number>',
        ['fn(number) -> bool']
      );

      expect(result.compatible).toBe(true);
      expect(result.resultType).toBe('bool');

      // Check if all elements match
      result = checker.checkArrayMethodCall(
        'all',
        'array<number>',
        ['fn(number) -> bool']
      );

      expect(result.compatible).toBe(true);
      expect(result.resultType).toBe('bool');
    });

    test('Sort with custom comparator', () => {
      // Sort with number comparator
      let result = checker.checkArrayMethodCall(
        'sort',
        'array<number>',
        ['fn(number, number) -> number']
      );

      expect(result.compatible).toBe(true);
      expect(result.resultType).toBe('array<number>');
    });
  });
});
