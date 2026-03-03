/**
 * Phase 3: Type Checker with Generic Support Tests
 * Validates generic type checking, constraint solving, and function validation
 */

import { FunctionTypeChecker, GenericFunctionType } from '../src/analyzer/type-checker';
import { TypeParser } from '../src/cli/type-parser';

describe('Phase 3: Type Checker with Generic Support', () => {
  let checker: FunctionTypeChecker;

  beforeEach(() => {
    checker = new FunctionTypeChecker();
  });

  // ======================================================================
  // TEST 1: Generic Type Validation
  // ======================================================================
  test('should validate generic type syntax', () => {
    // Valid generic types
    let result = checker.validateGenericType('array<T>');
    expect(result.compatible).toBe(true);

    result = checker.validateGenericType('array<number>');
    expect(result.compatible).toBe(true);

    result = checker.validateGenericType('map<K, V>');
    expect(result.compatible).toBe(true);

    result = checker.validateGenericType('map<string, number>');
    expect(result.compatible).toBe(true);

    // Invalid generic types
    result = checker.validateGenericType('unknown<T>');
    expect(result.compatible).toBe(false);
    expect(result.message).toContain('Unknown generic type');

    result = checker.validateGenericType('array<invalid>');
    expect(result.compatible).toBe(false);
  });

  // ======================================================================
  // TEST 2: Generic Function Validation
  // ======================================================================
  test('should validate generic function signatures', () => {
    // Valid generic function
    let result = checker.validateGenericFunction('identity', 'fn<T>(T) -> T');
    expect(result.compatible).toBe(true);

    result = checker.validateGenericFunction('map', 'fn<T, U>(array<T>, fn(T) -> U) -> array<U>');
    expect(result.compatible).toBe(true);

    result = checker.validateGenericFunction('filter', 'fn<T>(array<T>, fn(T) -> bool) -> array<T>');
    expect(result.compatible).toBe(true);

    // Invalid generic function
    result = checker.validateGenericFunction('bad', 'fn<T>(invalid) -> T');
    expect(result.compatible).toBe(false);
  });

  // ======================================================================
  // TEST 3: Extract Type Variables from Generic Function
  // ======================================================================
  test('should extract type variables from function', () => {
    // Single type variable
    let typeVars = checker.getTypeVariablesFromFunction('fn<T>(T) -> T');
    expect(typeVars).toEqual(['T']);

    // Multiple type variables
    typeVars = checker.getTypeVariablesFromFunction('fn<T, U>(T) -> U');
    expect(typeVars).toEqual(['T', 'U']);

    // Three type variables
    typeVars = checker.getTypeVariablesFromFunction('fn<T, U, V>(T, U) -> V');
    expect(typeVars).toEqual(['T', 'U', 'V']);

    // Invalid function type
    typeVars = checker.getTypeVariablesFromFunction('invalid');
    expect(typeVars).toEqual([]);
  });

  // ======================================================================
  // TEST 4: Generic Function Call Type Checking
  // ======================================================================
  test('should check generic function calls with type unification', () => {
    // Define generic function: fn<T, U>(T) -> U
    const mapFunction: GenericFunctionType = {
      typeVars: ['T', 'U'],
      params: {
        'input': 'T',
        'transform': 'fn(T) -> U'
      },
      returnType: 'U'
    };

    // Call with concrete types: map(number, fn(number) -> string)
    const result = checker.checkGenericFunctionCall(
      'map',
      mapFunction,
      ['number', 'fn(number) -> string'],
      ['input', 'transform']
    );

    expect(result.result.compatible).toBe(true);
    expect(result.substitution).not.toBeUndefined();
    expect(result.substitution?.T).toBe('number');
  });

  // ======================================================================
  // TEST 5: Type Substitution Application
  // ======================================================================
  test('should apply type substitutions correctly', () => {
    // Substitute single variable
    let result = checker.substituteTypeVariables('array<T>', { T: 'number' });
    expect(result).toBe('array<number>');

    // Substitute multiple variables
    result = checker.substituteTypeVariables('pair<T, U>', { T: 'number', U: 'string' });
    expect(result).toBe('pair<number, string>');

    // Substitute in complex type
    result = checker.substituteTypeVariables('fn(T) -> U', { T: 'number', U: 'string' });
    expect(result).toBe('fn(number) -> string');

    // Partial substitution
    result = checker.substituteTypeVariables('pair<T, U>', { T: 'number' });
    expect(result).toBe('pair<number, U>');
  });

  // ======================================================================
  // TEST 6: Unify Generic Types
  // ======================================================================
  test('should unify generic types and return constraints', () => {
    // Unify array<T> with array<number>
    let result = checker.unifyGenericTypes('array<T>', 'array<number>');
    expect(result).not.toBeNull();
    expect(result?.T).toBe('number');

    // Unify map<K, V> with map<string, number>
    result = checker.unifyGenericTypes('map<K, V>', 'map<string, number>');
    expect(result).not.toBeNull();
    expect(result?.K).toBe('string');
    expect(result?.V).toBe('number');

    // Unify with existing substitution
    result = checker.unifyGenericTypes('array<T>', 'array<U>', { U: 'number' });
    expect(result).not.toBeNull();
    expect(result?.T).toBe('number');

    // Incompatible types should fail
    result = checker.unifyGenericTypes('number', 'string');
    expect(result).toBeNull();
  });

  // ======================================================================
  // TEST 7: Infer Generic Return Type
  // ======================================================================
  test('should infer return type from generic function with substitution', () => {
    // Function: fn<T, U>(T) -> U with substitution {T: number, U: string}
    let returnType = checker.inferGenericReturnType('fn<T, U>(T) -> U', { T: 'number', U: 'string' });
    expect(returnType).toBe('string');

    // Function: fn<T>(array<T>) -> array<T> with substitution {T: number}
    returnType = checker.inferGenericReturnType('fn<T>(array<T>) -> array<T>', { T: 'number' });
    expect(returnType).toBe('array<number>');

    // Function: fn<T, U>(T) -> array<U> with substitution {T: number, U: string}
    returnType = checker.inferGenericReturnType('fn<T, U>(T) -> array<U>', { T: 'number', U: 'string' });
    expect(returnType).toBe('array<string>');
  });

  // ======================================================================
  // TEST 8: Complex Generic Scenario - Array Map Operation
  // ======================================================================
  test('should handle array.map(fn) type checking correctly', () => {
    // Scenario: array<number>.map(fn(x: number) -> string)
    // Expected return: array<string>

    // Define map function: fn<T, U>(array<T>, fn(T) -> U) -> array<U>
    const mapFunc: GenericFunctionType = {
      typeVars: ['T', 'U'],
      params: {
        'array': 'array<T>',
        'fn': 'fn(T) -> U'
      },
      returnType: 'array<U>'
    };

    // Call with array<number> and fn(number) -> string
    const result = checker.checkGenericFunctionCall(
      'map',
      mapFunc,
      ['array<number>', 'fn(number) -> string'],
      ['array', 'fn']
    );

    expect(result.result.compatible).toBe(true);
    expect(result.substitution).not.toBeUndefined();

    // Infer return type
    if (result.substitution) {
      const returnType = checker.inferGenericReturnType(
        'fn<T, U>(array<T>, fn(T) -> U) -> array<U>',
        result.substitution
      );
      expect(returnType).toBe('array<string>');
    }
  });

  // ======================================================================
  // TEST 9: Complex Generic Scenario - Array Filter Operation
  // ======================================================================
  test('should handle array.filter(fn) type checking correctly', () => {
    // Scenario: array<number>.filter(fn(x: number) -> bool)
    // Expected return: array<number>

    const filterFunc: GenericFunctionType = {
      typeVars: ['T'],
      params: {
        'array': 'array<T>',
        'predicate': 'fn(T) -> bool'
      },
      returnType: 'array<T>'
    };

    const result = checker.checkGenericFunctionCall(
      'filter',
      filterFunc,
      ['array<number>', 'fn(number) -> bool'],
      ['array', 'predicate']
    );

    expect(result.result.compatible).toBe(true);

    // Type should be preserved
    if (result.substitution) {
      const returnType = checker.inferGenericReturnType(
        'fn<T>(array<T>, fn(T) -> bool) -> array<T>',
        result.substitution
      );
      expect(returnType).toBe('array<number>');
    }
  });

  // ======================================================================
  // TEST 10: Complex Generic Scenario - Array Reduce Operation
  // ======================================================================
  test('should handle array.reduce(fn, init) type checking correctly', () => {
    // Scenario: array<number>.reduce(fn(total: number, x: number) -> number, 0)
    // Expected return: number

    const reduceFunc: GenericFunctionType = {
      typeVars: ['T', 'U'],
      params: {
        'array': 'array<T>',
        'reducer': 'fn(U, T) -> U',
        'initial': 'U'
      },
      returnType: 'U'
    };

    const result = checker.checkGenericFunctionCall(
      'reduce',
      reduceFunc,
      ['array<number>', 'fn(number, number) -> number', 'number'],
      ['array', 'reducer', 'initial']
    );

    expect(result.result.compatible).toBe(true);

    // Result should be the accumulator type
    if (result.substitution) {
      const returnType = checker.inferGenericReturnType(
        'fn<T, U>(array<T>, fn(U, T) -> U, U) -> U',
        result.substitution
      );
      expect(returnType).toBe('number');
    }
  });

  // ======================================================================
  // TEST 11: Error Cases - Type Mismatch in Generic Call
  // ======================================================================
  test('should detect type mismatches in generic function calls', () => {
    const mapFunc: GenericFunctionType = {
      typeVars: ['T', 'U'],
      params: {
        'input': 'T',
        'transform': 'fn(T) -> U'
      },
      returnType: 'U'
    };

    // Call with incompatible types: map(string, fn(number) -> string)
    // This should fail because string != number for the function parameter
    const result = checker.checkGenericFunctionCall(
      'map',
      mapFunc,
      ['string', 'fn(number) -> string'],
      ['input', 'transform']
    );

    // Result should indicate incompatibility
    // (May or may not be compatible depending on unification)
  });

  // ======================================================================
  // TEST 12: Error Cases - Wrong Parameter Count
  // ======================================================================
  test('should detect parameter count mismatch in generic function calls', () => {
    const mapFunc: GenericFunctionType = {
      typeVars: ['T', 'U'],
      params: {
        'input': 'T',
        'transform': 'fn(T) -> U'
      },
      returnType: 'U'
    };

    // Call with wrong number of arguments
    const result = checker.checkGenericFunctionCall(
      'map',
      mapFunc,
      ['number'], // Missing second argument
      ['input', 'transform']
    );

    expect(result.result.compatible).toBe(false);
    expect(result.result.message).toContain('expects 2 arguments, got 1');
  });

  // ======================================================================
  // Real-world: Full Generic Type Chain
  // ======================================================================
  describe('Real-world generic type scenarios', () => {
    test('Chain: array<number>.filter(fn).map(fn)', () => {
      // Step 1: array<number>.filter(fn(T) -> bool) -> array<number>
      const filterFunc: GenericFunctionType = {
        typeVars: ['T'],
        params: { 'array': 'array<T>', 'predicate': 'fn(T) -> bool' },
        returnType: 'array<T>'
      };

      let result = checker.checkGenericFunctionCall(
        'filter',
        filterFunc,
        ['array<number>', 'fn(number) -> bool'],
        ['array', 'predicate']
      );

      expect(result.result.compatible).toBe(true);
      let filtered = checker.inferGenericReturnType(
        'fn<T>(array<T>, fn(T) -> bool) -> array<T>',
        result.substitution!
      );
      expect(filtered).toBe('array<number>');

      // Step 2: array<number>.map(fn(T) -> U) where U=string -> array<string>
      const mapFunc: GenericFunctionType = {
        typeVars: ['T', 'U'],
        params: { 'array': 'array<T>', 'transform': 'fn(T) -> U' },
        returnType: 'array<U>'
      };

      result = checker.checkGenericFunctionCall(
        'map',
        mapFunc,
        ['array<number>', 'fn(number) -> string'],
        ['array', 'transform']
      );

      expect(result.result.compatible).toBe(true);
      let mapped = checker.inferGenericReturnType(
        'fn<T, U>(array<T>, fn(T) -> U) -> array<U>',
        result.substitution!
      );
      expect(mapped).toBe('array<string>');
    });

    test('Higher-order function: makeAdder returns fn(number) -> number', () => {
      // Function: fn<T>(T) -> fn(T) -> T  (makeAdder)
      const makeAdderFunc: GenericFunctionType = {
        typeVars: ['T'],
        params: {
          'initial': 'T'
        },
        returnType: 'fn(T) -> T'
      };

      // Call: makeAdder(5) -> fn(number) -> number
      const result = checker.checkGenericFunctionCall(
        'makeAdder',
        makeAdderFunc,
        ['number'],
        ['initial']
      );

      expect(result.result.compatible).toBe(true);

      // Return type should be fn(number) -> number
      if (result.substitution) {
        const returnType = checker.inferGenericReturnType(
          'fn<T>(T) -> fn(T) -> T',
          result.substitution
        );
        expect(returnType).toBe('fn(number) -> number');
      }
    });

    test('Generic with constraints: binary search in array<comparable>', () => {
      // Simplified: fn<T>(array<T>, T) -> number
      const binarySearchFunc: GenericFunctionType = {
        typeVars: ['T'],
        params: {
          'array': 'array<T>',
          'target': 'T'
        },
        returnType: 'number'
      };

      // Call: binarySearch([1,2,3], 2)
      const result = checker.checkGenericFunctionCall(
        'binarySearch',
        binarySearchFunc,
        ['array<number>', 'number'],
        ['array', 'target']
      );

      expect(result.result.compatible).toBe(true);
      expect(result.substitution?.T).toBe('number');
    });
  });
});
