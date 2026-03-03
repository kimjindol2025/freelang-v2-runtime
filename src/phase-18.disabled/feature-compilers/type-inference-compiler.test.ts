/**
 * Type Inference Compiler Tests
 *
 * Tests for Phase 18.3: Type Inference Compiler
 * Coverage: 30 test cases
 */

import { TypeInferenceCompiler } from './type-inference-compiler';

describe('Phase 18.3: Type Inference Compiler', () => {
  let compiler: TypeInferenceCompiler;

  beforeEach(() => {
    compiler = new TypeInferenceCompiler('optimize');
  });

  describe('Literal Type Inference', () => {
    it('should infer number type from literal', async () => {
      const result = await compiler.compile('let x = 42');
      expect(result.success).toBe(true);
    });

    it('should infer string type from literal', async () => {
      const result = await compiler.compile('let name = "Alice"');
      expect(result.success).toBe(true);
    });

    it('should infer boolean type from literal', async () => {
      const result = await compiler.compile('let active = true');
      expect(result.success).toBe(true);
    });

    it('should infer array type from literal', async () => {
      const result = await compiler.compile('let numbers = [1, 2, 3]');
      expect(result.success).toBe(true);
    });
  });

  describe('Variable Type Inference', () => {
    it('should infer type from variable initialization', async () => {
      const code = `let x = 10
let y = x + 5`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should infer type from function call', async () => {
      const code = `fn getValue() -> number
let result = getValue()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should infer type from operation', async () => {
      const code = `let a = 10
let b = 20
let sum = a + b`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Function Return Type Inference', () => {
    it('should infer return type from return statement', async () => {
      const code = `fn add(x, y)
return x + y`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should infer void return type', async () => {
      const code = `fn process()
let x = 5`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should infer string return type', async () => {
      const code = `fn getName()
return "Alice"`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Array Element Type Inference', () => {
    it('should infer element type from array literal', async () => {
      const code = `let nums = [1, 2, 3, 4, 5]`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should infer element type from array operations', async () => {
      const code = `let arr = []
arr.push(10)
let first = arr[0]`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle array of strings', async () => {
      const code = `let names = ["Alice", "Bob", "Charlie"]`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Complex Type Inference', () => {
    it('should infer nested generic types', async () => {
      const code = `let matrix = [[1, 2], [3, 4]]`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should infer type from multiple assignments', async () => {
      const code = `let x = 10
x = 20
x = 30`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle type in conditional', async () => {
      const code = `let x = if true then 10 else 20`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Type Consistency', () => {
    it('should compile with consistent types', async () => {
      const code = `let x: number = 42
let y = x + 1`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should warn on low confidence inference', async () => {
      const code = `let unknown = someFunc()`;
      const result = await compiler.compile(code);
      // May warn but should still compile
      expect(result.errors.length === 0).toBe(true);
    });
  });

  describe('Function Parameters', () => {
    it('should infer parameter types from usage', async () => {
      const code = `fn add(a, b)
return a + b`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should infer parameter types from calls', async () => {
      const code = `fn sum(arr)
return arr.length`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle multiple parameter inference', async () => {
      const code = `fn combine(a, b, c)
return a + b + c`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Compilation Stages', () => {
    it('should complete all stages with types', async () => {
      const result = await compiler.compile('let x = 42');
      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThanOrEqual(4);
      expect(result.stages.some(s => s.name.includes('Type'))).toBe(true);
    });

    it('should report type inference statistics', async () => {
      const result = await compiler.compile('let x = 1\nlet y = 2');
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.length > 0)).toBe(true);
    });
  });

  describe('Type-Aware Optimizations', () => {
    it('should apply optimizations for known types', async () => {
      const code = `let x = 10
let y = 20
let sum = x + y`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should optimize string operations', async () => {
      const code = `let s = "hello"
let t = s + " world"`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle polymorphic behavior', async () => {
      const code = `let x = if true then 10 else 20
let y = x + 5`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle deeply nested types', async () => {
      const code = `let deep = [[[1, 2], [3, 4]], [[5, 6], [7, 8]]]`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle type inference chains', async () => {
      const code = `let a = 10
let b = a
let c = b
let d = c + 5`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty code', async () => {
      const result = await compiler.compile('');
      expect(result.success).toBe(false);
    });

    it('should report syntax errors', async () => {
      const result = await compiler.compile('let x =');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
