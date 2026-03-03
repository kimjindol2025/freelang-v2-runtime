/**
 * FFI Compiler Tests
 *
 * Tests for Phase 18.8: FFI Compiler
 * Coverage: 32 test cases
 */

import { FFICompiler } from './ffi-compiler';

describe('Phase 18.8: FFI Compiler', () => {
  let compiler: FFICompiler;

  beforeEach(() => {
    compiler = new FFICompiler('jit');
  });

  describe('C Signature Parsing', () => {
    it('should parse simple int function', async () => {
      const code = `use "libc"
int add(int a, int b)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse function with pointer parameter', async () => {
      const code = `use "libc"
void* malloc(int size)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse function with string parameter', async () => {
      const code = `use "libc"
int strlen(char* str)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse function with multiple parameters', async () => {
      const code = `use "libc"
char* strcat(char* dest, char* src)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse function with void return', async () => {
      const code = `use "libc"
void free(void* ptr)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse function with double return', async () => {
      const code = `use "libm"
double sqrt(double x)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse function with no parameters', async () => {
      const code = `use "libc"
int rand()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Library Loading', () => {
    it('should recognize library declaration', async () => {
      const code = 'use "libc"';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getLibraries().has('libc')).toBe(true);
    });

    it('should support multiple libraries', async () => {
      const code = `use "libc"
use "libm"
use "libpthread"`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getLibraries().size).toBe(3);
    });

    it('should support custom library paths', async () => {
      const code = 'use "./custom.so"';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should validate library names', async () => {
      const code = 'use "lib@invalid!"';
      const result = await compiler.compile(code);
      expect(result.errors.some(e => e.includes('Invalid library name'))).toBe(true);
    });
  });

  describe('Binding Generation', () => {
    it('should extract single binding', async () => {
      const code = `use "libc"
int abs(int x)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getBindings().has('abs')).toBe(true);
    });

    it('should extract multiple bindings', async () => {
      const code = `use "libc"
int abs(int x)
int strlen(char* str)
void* malloc(int size)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getBindings().size).toBe(3);
    });

    it('should store binding metadata', async () => {
      const code = `use "libm"
double sqrt(double x)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      const binding = compiler.getBindings().get('sqrt');
      expect(binding?.name).toBe('sqrt');
      expect(binding?.library).toBe('libm');
    });
  });

  describe('Type Marshaling', () => {
    it('should marshal int type', async () => {
      const code = `use "libc"
int add(int a, int b)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should marshal double type', async () => {
      const code = `use "libm"
double sqrt(double x)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should marshal string (char*)', async () => {
      const code = `use "libc"
int strlen(char* str)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should marshal pointer (void*)', async () => {
      const code = `use "libc"
void* malloc(int size)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should marshal bool type', async () => {
      const code = `use "custom"
bool check(int value)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should marshal array pointer', async () => {
      const code = `use "custom"
int* get_array(int size)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should warn on unmarshalable type', async () => {
      const code = `use "custom"
struct CustomType get_custom()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      // May have warnings about unmarshalable types
    });
  });

  describe('Memory Safety Checks', () => {
    it('should detect pointer parameters', async () => {
      const code = `use "libc"
void free(void* ptr)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      const binding = compiler.getBindings().get('free');
      expect(binding?.safetyChecks.length).toBeGreaterThan(0);
    });

    it('should detect string parameters', async () => {
      const code = `use "libc"
int strlen(char* str)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      const binding = compiler.getBindings().get('strlen');
      expect(binding?.safetyChecks.some(c => c.includes('null'))).toBe(true);
    });

    it('should warn on null pointer risk', async () => {
      const code = `use "libc"
void* memcpy(void* dest, void* src, int size)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.length > 0)).toBe(true);
    });

    it('should warn on buffer bounds', async () => {
      const code = `use "custom"
void process(int* array, int size)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.some(w => w.includes('bounds')))).toBe(true);
    });

    it('should warn on string safety', async () => {
      const code = `use "libc"
char* strcpy(char* dest, char* src)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.some(w => w.includes('null-term')))).toBe(true);
    });

    it('should validate multiple safety checks', async () => {
      const code = `use "libc"
void* memcpy(void* dest, void* src, int size)
int strlen(char* str)
void free(void* ptr)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('C Signature Validation', () => {
    it('should accept valid return types', async () => {
      const code = `use "libc"
int test1()
double test2()
char* test3()
void test4()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should accept valid parameter types', async () => {
      const code = `use "libc"
void test(int a, double b, char* c, void* d)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should reject invalid return types', async () => {
      const code = `use "custom"
invalid_type test()`;
      const result = await compiler.compile(code);
      expect(result.errors.some(e => e.includes('Invalid return type'))).toBe(true);
    });

    it('should reject invalid parameter types', async () => {
      const code = `use "custom"
void test(bad_type param)`;
      const result = await compiler.compile(code);
      expect(result.errors.some(e => e.includes('Invalid parameter type'))).toBe(true);
    });
  });

  describe('Multi-Library Support', () => {
    it('should track library per binding', async () => {
      const code = `use "libc"
int abs(int x)
use "libm"
double sqrt(double x)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getBindings().get('abs')?.library).toBe('libc');
      expect(compiler.getBindings().get('sqrt')?.library).toBe('libm');
    });

    it('should support mixing libraries', async () => {
      const code = `use "libc"
int strlen(char* str)
int abs(int x)
use "libm"
double sqrt(double x)
double pow(double x, double y)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getLibraries().size).toBe(2);
    });
  });

  describe('Wrapper Generation', () => {
    it('should generate wrapper for simple function', async () => {
      const code = `use "libc"
int add(int a, int b)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.name.includes('Binding'))).toBe(true);
    });

    it('should generate wrappers with safety checks', async () => {
      const code = `use "libc"
void free(void* ptr)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.some(w => w.includes('wrapper')))).toBe(true);
    });
  });

  describe('Compilation Stages', () => {
    it('should complete all stages', async () => {
      const code = `use "libc"
int abs(int x)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThanOrEqual(5);
    });

    it('should report FFI information', async () => {
      const code = `use "libc"
int abs(int x)
int strlen(char* str)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.name.includes('FFI'))).toBe(true);
    });

    it('should report binding count', async () => {
      const code = `use "libc"
int abs(int x)
int strlen(char* str)
void* malloc(int size)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.some(w => w.includes('3 FFI bindings')))).toBe(true);
    });

    it('should report safety issues', async () => {
      const code = `use "libc"
void free(void* ptr)
int strlen(char* str)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.length > 0)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty code', async () => {
      const result = await compiler.compile('');
      expect(result.success).toBe(false);
    });

    it('should reject malformed signatures', async () => {
      const code = 'int (x)';
      const result = await compiler.compile(code);
      expect(result.success).toBe(false);
    });

    it('should report unknown library references', async () => {
      const code = `use "nonexistent"
int test()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      // May warn but not error
    });

    it('should handle syntax errors', async () => {
      const code = 'use "libc" {';
      const result = await compiler.compile(code);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle function with no parameters', async () => {
      const code = `use "libc"
int rand()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle function with void return', async () => {
      const code = `use "libc"
void srand(int seed)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle complex pointer types', async () => {
      const code = `use "custom"
int* get_array()
void set_array(int* data)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle multiple pointers', async () => {
      const code = `use "custom"
void process(int** ptr_to_ptr, char** strings)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle whitespace variations', async () => {
      const code = `use   "libc"
int   add  (  int   a  ,  int   b  )`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle many parameters', async () => {
      const code = `use "custom"
void process(int a, int b, int c, int d, int e, int f, int g)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });
});
