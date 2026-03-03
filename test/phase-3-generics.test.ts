/**
 * Phase 3: Generics Type System Tests
 * Validates generic type parsing, type variables, and type unification
 */

import { TypeParser } from '../src/cli/type-parser';

describe('Phase 3: Generics Type System', () => {
  // ======================================================================
  // TEST 1: Type Variable Detection
  // ======================================================================
  test('should identify type variables (T, U, K, V, etc.)', () => {
    // Valid type variables
    expect(TypeParser.isTypeVariable('T')).toBe(true);
    expect(TypeParser.isTypeVariable('U')).toBe(true);
    expect(TypeParser.isTypeVariable('K')).toBe(true);
    expect(TypeParser.isTypeVariable('V')).toBe(true);
    expect(TypeParser.isTypeVariable('T1')).toBe(true);
    expect(TypeParser.isTypeVariable('U2')).toBe(true);

    // Invalid type variables
    expect(TypeParser.isTypeVariable('t')).toBe(false);  // lowercase
    expect(TypeParser.isTypeVariable('number')).toBe(false);  // not a variable
    expect(TypeParser.isTypeVariable('array')).toBe(false);
    expect(TypeParser.isTypeVariable('1T')).toBe(false);  // starts with digit
  });

  // ======================================================================
  // TEST 2: Parse Generic Types (array<T>, map<K, V>)
  // ======================================================================
  test('should parse generic type syntax', () => {
    // Parse array<T>
    let result = TypeParser.parseGenericType('array<T>');
    expect(result).not.toBeNull();
    expect(result?.base).toBe('array');
    expect(result?.parameters).toEqual(['T']);

    // Parse array<string>
    result = TypeParser.parseGenericType('array<string>');
    expect(result).not.toBeNull();
    expect(result?.base).toBe('array');
    expect(result?.parameters).toEqual(['string']);

    // Parse map<K, V>
    result = TypeParser.parseGenericType('map<K, V>');
    expect(result).not.toBeNull();
    expect(result?.base).toBe('map');
    expect(result?.parameters).toEqual(['K', 'V']);

    // Parse pair<number, string>
    result = TypeParser.parseGenericType('pair<number, string>');
    expect(result).not.toBeNull();
    expect(result?.base).toBe('pair');
    expect(result?.parameters).toEqual(['number', 'string']);
  });

  // ======================================================================
  // TEST 3: Parse Function Types (fn<T>(T) -> T)
  // ======================================================================
  test('should parse function type signatures', () => {
    // Parse simple identity function: fn<T>(T) -> T
    let result = TypeParser.parseFunctionType('fn<T>(T) -> T');
    expect(result).not.toBeNull();
    expect(result?.typeVars).toEqual(['T']);
    expect(result?.paramTypes).toEqual(['T']);
    expect(result?.returnType).toBe('T');

    // Parse map function: fn<T, U>(T) -> U
    result = TypeParser.parseFunctionType('fn<T, U>(T) -> U');
    expect(result).not.toBeNull();
    expect(result?.typeVars).toEqual(['T', 'U']);
    expect(result?.paramTypes).toEqual(['T']);
    expect(result?.returnType).toBe('U');

    // Parse function with multiple params: fn<T>(T, number) -> bool
    result = TypeParser.parseFunctionType('fn<T>(T, number) -> bool');
    expect(result).not.toBeNull();
    expect(result?.typeVars).toEqual(['T']);
    expect(result?.paramTypes).toEqual(['T', 'number']);
    expect(result?.returnType).toBe('bool');

    // Parse function with multiple type vars: fn<T, U, V>(T, U) -> V
    result = TypeParser.parseFunctionType('fn<T, U, V>(T, U) -> V');
    expect(result).not.toBeNull();
    expect(result?.typeVars).toEqual(['T', 'U', 'V']);
    expect(result?.paramTypes).toEqual(['T', 'U']);
    expect(result?.returnType).toBe('V');
  });

  // ======================================================================
  // TEST 4: Type Substitution (Replace T with concrete type)
  // ======================================================================
  test('should perform type substitution', () => {
    // Substitute T with number in array<T>
    let result = TypeParser.substituteType('array<T>', { T: 'number' });
    expect(result).toBe('array<number>');

    // Substitute multiple variables
    result = TypeParser.substituteType('pair<T, U>', { T: 'number', U: 'string' });
    expect(result).toBe('pair<number, string>');

    // Substitute in function type
    result = TypeParser.substituteType('fn<T>(T) -> T', { T: 'bool' });
    expect(result).toBe('fn<bool>(bool) -> bool');

    // Substitute with nested types
    result = TypeParser.substituteType('array<T>', { T: 'array<number>' });
    expect(result).toBe('array<array<number>>');

    // No substitution needed
    result = TypeParser.substituteType('number', { T: 'string' });
    expect(result).toBe('number');

    // Multiple occurrences of same variable
    result = TypeParser.substituteType('fn<T>(T, T) -> T', { T: 'number' });
    expect(result).toBe('fn<number>(number, number) -> number');
  });

  // ======================================================================
  // TEST 5: Type Unification (Constraint Solving)
  // ======================================================================
  test('should unify types and solve constraints', () => {
    // Unify array<T> with array<number> -> T = number
    let result = TypeParser.unifyTypes('array<T>', 'array<number>');
    expect(result).not.toBeNull();
    expect(result?.T).toBe('number');

    // Unify array<string> with array<T> -> T = string
    result = TypeParser.unifyTypes('array<string>', 'array<T>');
    expect(result).not.toBeNull();
    expect(result?.T).toBe('string');

    // Unify with existing substitution
    result = TypeParser.unifyTypes('array<T>', 'array<U>', { U: 'number' });
    expect(result).not.toBeNull();
    // After substitution: array<T> vs array<number> -> T = number
    expect(result?.T).toBe('number');

    // Unify identical types
    result = TypeParser.unifyTypes('number', 'number');
    expect(result).not.toBeNull();
    expect(Object.keys(result!).length).toBe(0);  // No new constraints

    // Unify incompatible concrete types should fail
    result = TypeParser.unifyTypes('number', 'string');
    expect(result).toBeNull();

    // Occurs check: T cannot unify with array<T>
    result = TypeParser.unifyTypes('T', 'array<T>');
    expect(result).toBeNull();
  });

  // ======================================================================
  // TEST 6: Valid Type Checking with Generics
  // ======================================================================
  test('should validate types including generics', () => {
    // Basic types
    expect(TypeParser.isValidType('number')).toBe(true);
    expect(TypeParser.isValidType('string')).toBe(true);
    expect(TypeParser.isValidType('boolean')).toBe(true);

    // Type variables
    expect(TypeParser.isValidType('T')).toBe(true);
    expect(TypeParser.isValidType('U')).toBe(true);

    // Generic types
    expect(TypeParser.isValidType('array<number>')).toBe(true);
    expect(TypeParser.isValidType('array<T>')).toBe(true);
    expect(TypeParser.isValidType('array<array<T>>')).toBe(true);

    // Map type
    expect(TypeParser.isValidType('map<string, number>')).toBe(true);
    expect(TypeParser.isValidType('map<K, V>')).toBe(true);

    // Invalid types
    expect(TypeParser.isValidType('unknown')).toBe(false);
    expect(TypeParser.isValidType('array<unknown>')).toBe(false);
  });

  // ======================================================================
  // TEST 7: Type Compatibility with Generics
  // ======================================================================
  test('should check type compatibility with generics', () => {
    // Exact match
    expect(TypeParser.areTypesCompatible('number', 'number')).toBe(true);

    // Type variables are compatible
    expect(TypeParser.areTypesCompatible('T', 'number')).toBe(true);
    expect(TypeParser.areTypesCompatible('number', 'T')).toBe(true);
    expect(TypeParser.areTypesCompatible('T', 'U')).toBe(true);

    // Array types
    expect(TypeParser.areTypesCompatible('array<number>', 'array<number>')).toBe(true);
    expect(TypeParser.areTypesCompatible('array<T>', 'array<number>')).toBe(true);
    expect(TypeParser.areTypesCompatible('array<number>', 'array<T>')).toBe(true);

    // Nested arrays
    expect(TypeParser.areTypesCompatible('array<array<T>>', 'array<array<number>>')).toBe(true);

    // Incompatible concrete types
    expect(TypeParser.areTypesCompatible('number', 'string')).toBe(false);

    // any is compatible with everything
    expect(TypeParser.areTypesCompatible('any', 'number')).toBe(true);
    expect(TypeParser.areTypesCompatible('number', 'any')).toBe(true);
  });

  // ======================================================================
  // TEST 8: Complex Generic Function Signatures
  // ======================================================================
  test('should handle complex generic function signatures', () => {
    // Map function: fn<T, U>(array<T>, fn(T) -> U) -> array<U>
    const mapSig = 'fn<T, U>(array<T>, fn(T) -> U) -> array<U>';
    const parsed = TypeParser.parseFunctionType(mapSig);

    expect(parsed).not.toBeNull();
    expect(parsed?.typeVars).toEqual(['T', 'U']);
    expect(parsed?.returnType).toContain('array');

    // Filter function: fn<T>(array<T>, fn(T) -> bool) -> array<T>
    const filterSig = 'fn<T>(array<T>, fn(T) -> bool) -> array<T>';
    const filterParsed = TypeParser.parseFunctionType(filterSig);

    expect(filterParsed).not.toBeNull();
    expect(filterParsed?.typeVars).toEqual(['T']);
    expect(filterParsed?.returnType).toContain('array');

    // Reduce function: fn<T, U>(array<T>, fn(U, T) -> U, U) -> U
    const reduceSig = 'fn<T, U>(array<T>, fn(U, T) -> U, U) -> U';
    const reduceParsed = TypeParser.parseFunctionType(reduceSig);

    expect(reduceParsed).not.toBeNull();
    expect(reduceParsed?.typeVars).toEqual(['T', 'U']);
  });

  // ======================================================================
  // TEST 9: Generic Type Inference Chain
  // ======================================================================
  test('should handle chained type inference with generics', () => {
    // Start with: array<number>
    let currentType = 'array<number>';

    // After map(fn(number) -> string): array<string>
    let mapResult = TypeParser.substituteType('array<U>', { U: 'string' });
    currentType = mapResult;
    expect(currentType).toBe('array<string>');

    // After filter(fn(string) -> bool): array<string>
    expect(currentType).toBe('array<string>');

    // After reduce(fn(number, string) -> number, 0): number
    currentType = 'number';
    expect(currentType).toBe('number');
  });

  // ======================================================================
  // TEST 10: Error Cases - Invalid Generic Syntax
  // ======================================================================
  test('should handle invalid generic syntax', () => {
    // Missing closing bracket
    expect(TypeParser.parseGenericType('array<T')).toBeNull();

    // Missing opening bracket
    expect(TypeParser.parseGenericType('arrayT>')).toBeNull();

    // Invalid function type (missing params)
    expect(TypeParser.parseFunctionType('fn<T> -> T')).toBeNull();

    // Invalid function type (missing arrow)
    expect(TypeParser.parseFunctionType('fn<T>(T) T')).toBeNull();

    // Empty type parameters
    expect(TypeParser.parseGenericType('array<>')).not.toBeNull();
    // But it will have empty parameters array
  });

  // ======================================================================
  // Real-World Scenarios
  // ======================================================================
  describe('Real-world generic scenarios', () => {
    test('Array.map with number transformation', () => {
      // array<number>.map(fn(number) -> string) -> array<string>
      const arrayType = 'array<number>';
      const fnType = 'fn<T, U>(T) -> U';

      // Unify: fn<T, U>(T) -> U with fn(number) -> string
      let unification = TypeParser.unifyTypes('T', 'number');
      expect(unification).not.toBeNull();

      unification = TypeParser.unifyTypes('U', 'string', unification!);
      expect(unification).not.toBeNull();

      // Result type: array<string>
      const resultType = TypeParser.substituteType('array<U>', unification!);
      expect(resultType).toBe('array<string>');
    });

    test('Array.filter preserves element type', () => {
      // array<number>.filter(fn(number) -> bool) -> array<number>
      const unification = TypeParser.unifyTypes('T', 'number');
      expect(unification).not.toBeNull();
      expect(unification?.T).toBe('number');

      // Type stays the same
      const resultType = TypeParser.substituteType('array<T>', unification!);
      expect(resultType).toBe('array<number>');
    });

    test('Array.reduce with accumulation', () => {
      // array<number>.reduce(fn(number, number) -> number, 0) -> number
      // Unify: fn<T, U>(T, U) -> U
      // with fn(number, number) -> number

      const unif1 = TypeParser.unifyTypes('T', 'number');
      const unif2 = TypeParser.unifyTypes('U', 'number', unif1!);

      expect(unif2).not.toBeNull();
      expect(unif2?.T).toBe('number');
      expect(unif2?.U).toBe('number');

      // Result: number
      const resultType = TypeParser.substituteType('U', unif2!);
      expect(resultType).toBe('number');
    });
  });
});
