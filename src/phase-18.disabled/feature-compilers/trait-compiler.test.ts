/**
 * Trait Compiler Tests
 *
 * Tests for Phase 18.7: Trait Compiler
 * Coverage: 25 test cases
 */

import { TraitCompiler } from './trait-compiler';

describe('Phase 18.7: Trait Compiler', () => {
  let compiler: TraitCompiler;

  beforeEach(() => {
    compiler = new TraitCompiler('optimize');
  });

  describe('Trait Definition Parsing', () => {
    it('should parse simple trait', async () => {
      const code = `trait Iterator {
  fn next() -> Option
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse trait with multiple methods', async () => {
      const code = `trait Collection {
  fn len() -> number
  fn is_empty() -> bool
  fn clear()
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse trait with method parameters', async () => {
      const code = `trait Container {
  fn add(value)
  fn remove(value) -> bool
  fn contains(value) -> bool
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse trait with return types', async () => {
      const code = `trait Serializable {
  fn to_string() -> string
  fn to_json() -> string
  fn size() -> number
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should recognize trait declarations', async () => {
      const code = `trait Reader {
  fn read(size) -> string
}
trait Writer {
  fn write(data)
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getTraits().size).toBeGreaterThan(0);
    });
  });

  describe('Trait Implementation Parsing', () => {
    it('should parse trait implementation', async () => {
      const code = `trait Drawable {
  fn draw()
}
impl Drawable for Circle {
  fn draw() { }
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse multiple implementations', async () => {
      const code = `trait Show {
  fn show() -> string
}
impl Show for Number {
  fn show() { }
}
impl Show for String {
  fn show() { }
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getImplementations().length).toBeGreaterThan(0);
    });

    it('should parse implementation with method bodies', async () => {
      const code = `trait Add {
  fn add(other) -> number
}
impl Add for Vector {
  fn add(other) { }
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Missing Method Detection', () => {
    it('should detect missing method in implementation', async () => {
      const code = `trait Iterator {
  fn next() -> Option
  fn has_next() -> bool
}
impl Iterator for ListIterator {
  fn next() { }
}`;
      const result = await compiler.compile(code);
      expect(result.errors.some(e => e.includes('missing methods'))).toBe(true);
    });

    it('should report specific missing methods', async () => {
      const code = `trait Collection {
  fn len() -> number
  fn is_empty() -> bool
  fn clear()
}
impl Collection for List {
  fn len() { }
}`;
      const result = await compiler.compile(code);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should accept complete implementations', async () => {
      const code = `trait Show {
  fn show() -> string
}
impl Show for Number {
  fn show() { }
}`;
      const result = await compiler.compile(code);
      expect(result.errors.filter(e => e.includes('missing')).length).toBe(0);
    });

    it('should list missing methods for multiple traits', async () => {
      const code = `trait Read {
  fn read() -> string
}
trait Write {
  fn write(data)
}
impl Read for File {
  fn read() { }
}
impl Write for File {
}`;
      const result = await compiler.compile(code);
      expect(result.errors.some(e => e.includes('Write'))).toBe(true);
    });
  });

  describe('Associated Types', () => {
    it('should recognize associated types', async () => {
      const code = `trait Iterator {
  type Item
  fn next() -> Item
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should validate associated type binding', async () => {
      const code = `trait Iterator {
  type Item
}
impl Iterator for VecIterator {
  type Item = number
  fn next() { }
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should warn on missing associated type', async () => {
      const code = `trait Container {
  type Element
}
impl Container for Bag {
  fn add(e) { }
}`;
      const result = await compiler.compile(code);
      expect(result.stages.some(s => s.warnings && s.warnings.length > 0)).toBe(true);
    });
  });

  describe('Default Methods', () => {
    it('should recognize default method', async () => {
      const code = `trait Clone {
  fn clone() {
    self
  }
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should allow skipping default methods in impl', async () => {
      const code = `trait Eq {
  fn eq(other) -> bool {
    true
  }
}
impl Eq for Value {
}`;
      const result = await compiler.compile(code);
      // Should be valid if eq has default
      expect(result.success).toBe(true);
    });

    it('should override default methods', async () => {
      const code = `trait Display {
  fn display() -> string {
    "default"
  }
}
impl Display for Custom {
  fn display() -> string {
    "custom"
  }
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Super Traits', () => {
    it('should recognize super trait', async () => {
      const code = `trait Comparable {
  fn compare(other) -> number
}
trait Ordered : Comparable {
  fn min() -> number
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should validate super trait exists', async () => {
      const code = `trait Derived : NonExistent {
  fn method()
}`;
      const result = await compiler.compile(code);
      expect(result.errors.some(e => e.includes('Unknown super trait'))).toBe(true);
    });

    it('should handle multiple inheritance', async () => {
      const code = `trait A {
  fn a()
}
trait B {
  fn b()
}
trait C : A, B {
  fn c()
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should enforce super trait methods in impl', async () => {
      const code = `trait Base {
  fn base()
}
trait Derived : Base {
  fn derived()
}
impl Derived for Type {
  fn derived() { }
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Trait Objects', () => {
    it('should recognize trait object', async () => {
      const code = `trait Shape {
  fn area() -> number
}
let s: Shape = circle`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should validate trait object assignment', async () => {
      const code = `trait Drawable {
  fn draw()
}
impl Drawable for Circle {
  fn draw() { }
}
let obj: Drawable = Circle()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Compilation Stages', () => {
    it('should complete all stages', async () => {
      const code = `trait Show {
  fn show() -> string
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThanOrEqual(4);
    });

    it('should report trait information', async () => {
      const code = `trait A { fn a() }
trait B { fn b() }
impl A for Type { fn a() { } }`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.name.includes('Trait'))).toBe(true);
    });

    it('should report trait count in warnings', async () => {
      const code = `trait Show { fn show() }
trait Debug { fn debug() }`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.some(w => w.includes('traits')))).toBe(true);
    });
  });

  describe('Complex Trait Scenarios', () => {
    it('should handle trait bounds in functions', async () => {
      const code = `fn print<T: Show>(value: T) {
  value.show()
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should validate multiple trait bounds', async () => {
      const code = `fn compare<T: Eq, T: Ord>(a: T, b: T) -> number {
  a.compare(b)
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle trait in struct', async () => {
      const code = `struct Container<T: Serializable> {
  data: T
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty trait', async () => {
      const code = 'trait Empty { }';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should reject malformed trait', async () => {
      const code = 'trait Bad [';
      const result = await compiler.compile(code);
      expect(result.success).toBe(false);
    });

    it('should handle empty source', async () => {
      const result = await compiler.compile('');
      expect(result.success).toBe(false);
    });

    it('should report unknown trait in impl', async () => {
      const code = 'impl UnknownTrait for Type { }';
      const result = await compiler.compile(code);
      expect(result.errors.some(e => e.includes('Unknown trait'))).toBe(true);
    });

    it('should report error count', async () => {
      const code = `impl NotFound for Type {
  fn x() { }
}`;
      const result = await compiler.compile(code);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle trait with many methods', async () => {
      const code = `trait API {
  fn a()
  fn b()
  fn c()
  fn d()
  fn e()
  fn f()
  fn g()
  fn h()
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle deeply nested trait bounds', async () => {
      const code = `trait A { fn a() }
trait B: A { fn b() }
trait C: B { fn c() }
trait D: C { fn d() }`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle whitespace in trait definition', async () => {
      const code = `trait   Show   {
  fn   show ( )   ->   string
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle special method names', async () => {
      const code = `trait Operators {
  fn __add__(other)
  fn __mul__(other)
  fn __eq__(other) -> bool
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });
});
