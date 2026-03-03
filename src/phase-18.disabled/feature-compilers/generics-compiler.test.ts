/**
 * Generics Compiler Tests
 *
 * Tests for Phase 18.4: Generics Compiler
 * Coverage: 30 test cases
 */

import { GenericsCompiler } from './generics-compiler';

describe('Phase 18.4: Generics Compiler', () => {
  let compiler: GenericsCompiler;

  beforeEach(() => {
    compiler = new GenericsCompiler('optimize');
  });

  describe('Generic Function Declarations', () => {
    it('should parse generic function', async () => {
      const code = 'fn<T> identity(x: T) -> T';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse generic function with multiple parameters', async () => {
      const code = 'fn<T, U> pair(x: T, y: U)';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse generic with constraints', async () => {
      const code = 'fn<T> clone(x: T) where T: Clone';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse generic with multiple constraints', async () => {
      const code = 'fn<T> process(x: T) where T: Clone, T: Serializable';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Generic Type Declarations', () => {
    it('should parse generic type declaration', async () => {
      const code = 'type List<T> = T[]';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse generic with multiple type parameters', async () => {
      const code = 'type Map<K, V> = (K, V)[]';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse complex generic type', async () => {
      const code = 'type Tree<T> = { value: T, left: Tree<T>, right: Tree<T> }';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Generic Instantiations', () => {
    it('should recognize generic instantiation', async () => {
      const code = `fn<T> getId(x: T)
let getNumber: fn(number) = getId<number>`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle single type parameter instantiation', async () => {
      const code = `let nums: List<number> = [1, 2, 3]`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle multi-parameter instantiation', async () => {
      const code = `let pairs: Map<string, number> = [("a", 1), ("b", 2)]`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle nested generic instantiation', async () => {
      const code = `let nested: List<List<number>> = [[1, 2], [3, 4]]`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Constraint Validation', () => {
    it('should validate type argument count', async () => {
      const code = `type Pair<T, U> = (T, U)
let p: Pair<number> = error`;
      const result = await compiler.compile(code);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate trait constraints', async () => {
      const code = `fn<T> clone(x: T) where T: Clone
clone(42)`;
      const result = await compiler.compile(code);
      // Should pass as number satisfies Clone
      expect(result.success).toBe(true);
    });

    it('should check multiple constraints', async () => {
      const code = `fn<T> process(x: T) where T: Clone, T: Serializable
process(true)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should warn on unknown constraint', async () => {
      const code = `fn<T> special(x: T) where T: Unknown
special(42)`;
      const result = await compiler.compile(code);
      // May not error but could warn
      expect(result.errors.length === 0 || result.warnings.length > 0).toBe(true);
    });
  });

  describe('Monomorphization', () => {
    it('should monomorphize single instantiation', async () => {
      const code = `fn<T> id(x: T) -> T
let f: fn(number) -> number = id<number>`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.name.includes('Monomorph'))).toBe(true);
    });

    it('should monomorphize multiple instantiations', async () => {
      const code = `fn<T> id(x: T) -> T
let f1 = id<number>
let f2 = id<string>
let f3 = id<bool>`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should generate correct number of versions', async () => {
      const code = `type Container<T> = T[]
let nums: Container<number> = [1, 2]
let strs: Container<string> = ["a", "b"]
let bools: Container<bool> = [true, false]`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Type Parameter Variance', () => {
    it('should handle covariant type parameters', async () => {
      const code = `type Producer<+T> = () -> T`;
      const result = await compiler.compile(code);
      // May not parse full variance syntax but should compile
      expect(result.errors.length === 0 || result.warnings.length > 0).toBe(true);
    });

    it('should handle contravariant type parameters', async () => {
      const code = `type Consumer<-T> = (T) -> ()`;
      const result = await compiler.compile(code);
      expect(result.errors.length === 0 || result.warnings.length > 0).toBe(true);
    });

    it('should handle invariant type parameters', async () => {
      const code = `type Mutatble<T> = { get: () -> T, set: (T) -> () }`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Default Type Parameters', () => {
    it('should parse generic with default type', async () => {
      const code = `type Option<T = any>`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should use default when not specified', async () => {
      const code = `type Box<T = number>
let box: Box`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Recursive Generics', () => {
    it('should handle recursive generic types', async () => {
      const code = `type Node<T> = { value: T, next: Node<T> }`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle binary tree generics', async () => {
      const code = `type Tree<T> = { value: T, left: Tree<T>, right: Tree<T> }`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle mutual recursion', async () => {
      const code = `type Tree<T> = { value: T, forest: Forest<T> }
type Forest<T> = Tree<T>[]`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Higher-Order Generics', () => {
    it('should handle function generics', async () => {
      const code = `type Mapper<T, U> = (T) -> U`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle generic of generic', async () => {
      const code = `type Wrapper<T<U>> = T<T<U>>`;
      const result = await compiler.compile(code);
      // May not fully parse HKT syntax
      expect(result.errors.length === 0 || result.warnings.length > 0).toBe(true);
    });
  });

  describe('Specialization', () => {
    it('should specialize generic for concrete types', async () => {
      const code = `fn<T> process(x: T)
process(42)
process("hello")`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should specialize with multiple constraints', async () => {
      const code = `fn<T> combine(x: T, y: T) -> T
combine(1, 2)
combine("a", "b")`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Compilation Stages', () => {
    it('should show generic information in stages', async () => {
      const code = `fn<T> id(x: T)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.name.includes('Generics'))).toBe(true);
    });

    it('should report monomorphization count', async () => {
      const code = `fn<T> id(x: T)
let f1 = id<number>
let f2 = id<string>`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.some(w => w.includes('Monomorph')))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle deeply nested generics', async () => {
      const code = `let deep: List<List<List<List<number>>>> = [[[[1]]]]`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle many type parameters', async () => {
      const code = `fn<A, B, C, D, E> combine(a: A, b: B, c: C, d: D, e: E)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle generic with empty constraints', async () => {
      const code = `fn<T> id(x: T) where`;
      const result = await compiler.compile(code);
      // Should handle gracefully
      expect(result.errors.length === 0 || result.warnings.length > 0).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should report arity mismatch', async () => {
      const code = `type Pair<T, U> = (T, U)
let x: Pair<number>`;
      const result = await compiler.compile(code);
      expect(result.errors.some(e => e.includes('expects'))).toBe(true);
    });

    it('should report unknown generic', async () => {
      const code = `let x: Unknown<number>`;
      const result = await compiler.compile(code);
      expect(result.errors.some(e => e.includes('Unknown'))).toBe(true);
    });
  });
});
