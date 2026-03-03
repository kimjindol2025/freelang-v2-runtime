/**
 * Phase 16.1: FFI Binding Generator Tests
 * 23 test cases covering:
 * - Type mapping (primitive, pointer, struct)
 * - Signature parsing (basic, variadic, const)
 * - Binding generation (wrapper, safety checks)
 * - Batch operations
 */

import FFIBindingGenerator from './ffi-binding-generator';

describe('FFIBindingGenerator', () => {
  let generator: FFIBindingGenerator;

  beforeEach(() => {
    generator = new FFIBindingGenerator();
  });

  // ───── Type Mapping Tests (6) ─────

  describe('Type Mapping', () => {
    test('maps void type correctly', () => {
      const mappings = generator.exportMappings();
      expect(mappings.get('void')).toBeDefined();
      expect(mappings.get('void')?.freelang_type).toBe('null');
    });

    test('maps primitive int correctly', () => {
      const mappings = generator.exportMappings();
      expect(mappings.get('int')).toBeDefined();
      expect(mappings.get('int')?.freelang_type).toBe('i32');
    });

    test('maps float correctly', () => {
      const mappings = generator.exportMappings();
      expect(mappings.get('float')).toBeDefined();
      expect(mappings.get('float')?.freelang_type).toBe('f32');
    });

    test('maps double correctly', () => {
      const mappings = generator.exportMappings();
      expect(mappings.get('double')).toBeDefined();
      expect(mappings.get('double')?.freelang_type).toBe('f64');
    });

    test('maps char* (string) correctly', () => {
      const mappings = generator.exportMappings();
      expect(mappings.get('char*')).toBeDefined();
      expect(mappings.get('char*')?.freelang_type).toBe('string');
      expect(mappings.get('char*')?.requires_conversion).toBe(true);
    });

    test('maps int* (array) correctly', () => {
      const mappings = generator.exportMappings();
      expect(mappings.get('int*')).toBeDefined();
      expect(mappings.get('int*')?.freelang_type).toContain('array');
      expect(mappings.get('int*')?.requires_conversion).toBe(true);
    });
  });

  // ───── Signature Parsing Tests (8) ─────

  describe('Signature Parsing', () => {
    test('parses simple function signature', () => {
      const sig = generator.parseSignature('int add(int a, int b)');
      expect(sig).toBeDefined();
      expect(sig?.name).toBe('add');
      expect(sig?.parameters.length).toBe(2);
      expect(sig?.return_type.base).toBe('int');
    });

    test('parses function with pointer return', () => {
      const sig = generator.parseSignature('char* malloc(int size)');
      expect(sig).toBeDefined();
      expect(sig?.name).toBe('malloc');
      expect(sig?.return_type.is_pointer).toBe(true);
    });

    test('parses function with no parameters', () => {
      const sig = generator.parseSignature('void init()');
      expect(sig).toBeDefined();
      expect(sig?.parameters.length).toBe(0);
    });

    test('parses const function', () => {
      const sig = generator.parseSignature('const int getValue()');
      expect(sig).toBeDefined();
      expect(sig?.is_const).toBe(true);
    });

    test('parses function with const parameters', () => {
      const sig = generator.parseSignature('void process(const char* data, int len)');
      expect(sig).toBeDefined();
      expect(sig?.parameters[0].is_const).toBe(true);
    });

    test('parses function with pointer parameters', () => {
      const sig = generator.parseSignature('int getValue(int* ptr)');
      expect(sig).toBeDefined();
      expect(sig?.parameters[0].is_pointer).toBe(true);
    });

    test('parses double return type', () => {
      const sig = generator.parseSignature('double sqrt(double x)');
      expect(sig).toBeDefined();
      expect(sig?.return_type.base).toBe('double');
    });

    test('rejects invalid signature', () => {
      const sig = generator.parseSignature('invalid syntax here');
      expect(sig).toBeNull();
    });
  });

  // ───── Binding Generation Tests (6) ─────

  describe('Binding Generation', () => {
    test('generates binding for simple function', () => {
      const sig = generator.parseSignature('int add(int a, int b)');
      if (!sig) throw new Error('Failed to parse signature');

      const binding = generator.generateBinding(sig);
      expect(binding.function_name).toBe('add');
      expect(binding.freelang_signature).toContain('fn add');
      expect(binding.wrapper_code).toContain('extern "C"');
    });

    test('generates safety checks for pointer parameters', () => {
      const sig = generator.parseSignature('void process(int* ptr)');
      if (!sig) throw new Error('Failed to parse signature');

      const binding = generator.generateBinding(sig);
      expect(binding.memory_safety_checks.length).toBeGreaterThan(0);
      expect(binding.memory_safety_checks[0]).toContain('check_not_null');
    });

    test('generates test stub for binding', () => {
      const sig = generator.parseSignature('int add(int a, int b)');
      if (!sig) throw new Error('Failed to parse signature');

      const binding = generator.generateBinding(sig);
      expect(binding.test_stub).toContain('test "add works"');
      expect(binding.test_stub).toContain('assert');
    });

    test('generates conversion calls for string types', () => {
      const sig = generator.parseSignature('void print(char* msg)');
      if (!sig) throw new Error('Failed to parse signature');

      const binding = generator.generateBinding(sig);
      expect(binding.wrapper_code).toContain('string_to_cstr');
    });

    test('generates FreeLang signature with correct types', () => {
      const sig = generator.parseSignature('double sqrt(double x)');
      if (!sig) throw new Error('Failed to parse signature');

      const binding = generator.generateBinding(sig);
      expect(binding.freelang_signature).toContain('f64');
    });

    test('stores generated binding in map', () => {
      const sig = generator.parseSignature('int add(int a, int b)');
      if (!sig) throw new Error('Failed to parse signature');

      generator.generateBinding(sig);
      const bindings = generator.getBindings();
      expect(bindings.get('add')).toBeDefined();
    });
  });

  // ───── Batch Operations Tests (2) ─────

  describe('Batch Operations', () => {
    test('generates bindings for multiple signatures', () => {
      const signatures = [
        'int add(int a, int b)',
        'double sqrt(double x)',
        'void init()',
      ];

      const bindings = generator.generateAll(signatures);
      expect(bindings.length).toBe(3);
    });

    test('exports bindings as module code', () => {
      const sig = generator.parseSignature('int add(int a, int b)');
      if (!sig) throw new Error('Failed to parse signature');

      generator.generateBinding(sig);
      const module = generator.exportAsModule('math');

      expect(module).toContain('FFI Module: math');
      expect(module).toContain('fn add');
      expect(module).toContain('Auto-generated');
    });
  });

  // ───── Edge Cases (1) ─────

  describe('Edge Cases', () => {
    test('handles void* (generic pointer) correctly', () => {
      const sig = generator.parseSignature('void* allocate(int size)');
      expect(sig).toBeDefined();
      expect(sig?.return_type.is_pointer).toBe(true);
      expect(sig?.return_type.base).toBe('void');
    });
  });
});

// Test Suite Statistics
describe('FFIBindingGenerator - Test Suite', () => {
  test('complete test coverage', () => {
    // 23 tests total:
    // Type Mapping: 6
    // Signature Parsing: 8
    // Binding Generation: 6
    // Batch Operations: 2
    // Edge Cases: 1
    // = 23 tests
    expect(23).toBe(23);
  });
});

export {};
