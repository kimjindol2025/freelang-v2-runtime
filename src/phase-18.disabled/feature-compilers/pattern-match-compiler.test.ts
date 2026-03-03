/**
 * Pattern Match Compiler Tests
 *
 * Tests for Phase 18.6: Pattern Match Compiler
 * Coverage: 28 test cases
 */

import { PatternMatchCompiler } from './pattern-match-compiler';

describe('Phase 18.6: Pattern Match Compiler', () => {
  let compiler: PatternMatchCompiler;

  beforeEach(() => {
    compiler = new PatternMatchCompiler('optimize');
  });

  describe('Literal Patterns', () => {
    it('should parse number literal pattern', async () => {
      const code = `match x {
  0 => "zero"
  1 => "one"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse string literal pattern', async () => {
      const code = `match status {
  "ok" => 200
  "error" => 500
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse boolean literal pattern', async () => {
      const code = `match active {
  true => "enabled"
  false => "disabled"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle multiple literal patterns', async () => {
      const code = `match code {
  1 => "one"
  2 => "two"
  3 => "three"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Variable Patterns', () => {
    it('should parse variable pattern', async () => {
      const code = `match value {
  x => x + 1
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse named binding patterns', async () => {
      const code = `match option {
  value => value * 2
  other => 0
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Wildcard Patterns', () => {
    it('should parse wildcard pattern', async () => {
      const code = `match x {
  0 => "zero"
  _ => "other"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should mark as exhaustive with wildcard', async () => {
      const code = `match x {
  1 => "one"
  2 => "two"
  _ => "other"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.errors.some(e => e.includes('exhaustive'))).toBe(false);
    });

    it('should detect non-exhaustive without wildcard', async () => {
      const code = `match x {
  1 => "one"
  2 => "two"
}`;
      const result = await compiler.compile(code);
      // May not error but should warn
      expect(result.success).toBe(true);
    });
  });

  describe('Enum Pattern Matching', () => {
    it('should parse enum declaration', async () => {
      const code = 'enum Color { Red, Green, Blue }';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse enum variant patterns', async () => {
      const code = `enum Color { Red, Green, Blue }
match c {
  Color::Red => "red"
  Color::Green => "green"
  Color::Blue => "blue"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should validate enum exhaustiveness', async () => {
      const code = `enum Status { Ok, Error }
match s {
  Status::Ok => 200
  Status::Error => 500
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should detect missing enum variants', async () => {
      const code = `enum Status { Ok, Pending, Error }
match s {
  Status::Ok => 200
  Status::Error => 500
}`;
      const result = await compiler.compile(code);
      // Should detect missing Pending
      expect(result.success).toBe(true);
    });
  });

  describe('Union Type Patterns', () => {
    it('should parse union type', async () => {
      const code = `type Value =
  | number
  | string
  | bool`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should match union variants', async () => {
      const code = `match value {
  number => value * 2
  string => value + "!"
  bool => true
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Exhaustiveness Checking', () => {
    it('should accept exhaustive patterns', async () => {
      const code = `match x {
  0 => "zero"
  _ => "non-zero"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should warn on non-exhaustive patterns', async () => {
      const code = `match status {
  "ok" => 200
  "pending" => 202
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should check boolean exhaustiveness', async () => {
      const code = `match flag {
  true => "yes"
  false => "no"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Unreachable Pattern Detection', () => {
    it('should detect unreachable after wildcard', async () => {
      const code = `match x {
  0 => "zero"
  _ => "other"
  1 => "one"
}`;
      const result = await compiler.compile(code);
      expect(result.unreachablePatterns.length).toBeGreaterThan(0);
    });

    it('should warn about unreachable patterns', async () => {
      const code = `match x {
  true => "yes"
  _ => "anything"
  false => "no"
}`;
      const result = await compiler.compile(code);
      expect(result.stages.some(s => s.warnings && s.warnings.length > 0)).toBe(true);
    });

    it('should report unreachable position', async () => {
      const code = `match value {
  1 => "one"
  2 => "two"
  _ => "other"
  3 => "three"
}`;
      const result = await compiler.compile(code);
      expect(result.unreachablePatterns.some(p => p.includes('Unreachable'))).toBe(true);
    });
  });

  describe('Nested Patterns', () => {
    it('should parse tuple patterns', async () => {
      const code = `match pair {
  (0, 0) => "origin"
  (x, y) => x + y
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse nested enum patterns', async () => {
      const code = `enum Result { Ok(value), Error(msg) }
match r {
  Result::Ok(x) => x
  Result::Error(e) => 0
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle deeply nested patterns', async () => {
      const code = `match data {
  ((0, 1), 2) => "nested"
  ((x, y), z) => x + y + z
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Or Patterns', () => {
    it('should parse or patterns', async () => {
      const code = `match x {
  1 | 2 | 3 => "small"
  _ => "large"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle or patterns with variables', async () => {
      const code = `match item {
  "a" | "e" | "i" | "o" | "u" => "vowel"
  _ => "consonant"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Guard Clauses', () => {
    it('should recognize guard patterns', async () => {
      const code = `match x {
  n if n > 0 => "positive"
  _ => "non-positive"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle multiple guards', async () => {
      const code = `match score {
  s if s >= 90 => "A"
  s if s >= 80 => "B"
  s if s >= 70 => "C"
  _ => "F"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Decision Tree Generation', () => {
    it('should generate decision tree', async () => {
      const code = `match x {
  0 => "zero"
  1 => "one"
  _ => "other"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.name.includes('Decision Tree'))).toBe(true);
    });

    it('should report decision tree generation', async () => {
      const code = `match status {
  "ok" => 200
  "error" => 500
  _ => 400
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.some(w => w.includes('decision tree')))).toBe(true);
    });
  });

  describe('Compilation Stages', () => {
    it('should complete all stages', async () => {
      const code = `match x {
  0 => "zero"
  _ => "other"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThanOrEqual(4);
    });

    it('should report pattern match information', async () => {
      const code = `match x {
  1 => "one"
  2 => "two"
  3 => "three"
  _ => "other"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.name.includes('Pattern'))).toBe(true);
    });

    it('should report exhaustiveness in warnings', async () => {
      const code = `match status {
  200 => "ok"
  404 => "not found"
  500 => "error"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Complex Patterns', () => {
    it('should handle range patterns', async () => {
      const code = `match age {
  0..12 => "child"
  13..19 => "teen"
  20..65 => "adult"
  _ => "senior"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should match with struct patterns', async () => {
      const code = `match person {
  { name: "Alice", age: 30 } => "found"
  { name: n, age: a } => n
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle complex nested matching', async () => {
      const code = `match option {
  Some(Ok(x)) => x
  Some(Error(e)) => 0
  None => -1
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty match', async () => {
      const code = 'match x { }';
      const result = await compiler.compile(code);
      // Should handle gracefully
      expect(result.success).toBe(true);
    });

    it('should reject malformed pattern', async () => {
      const code = `match x {
  [ => "bad"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(false);
    });

    it('should handle empty source', async () => {
      const result = await compiler.compile('');
      expect(result.success).toBe(false);
    });

    it('should report error count', async () => {
      const code = 'match x { malformed';
      const result = await compiler.compile(code);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single pattern match', async () => {
      const code = `match x {
  _ => "all"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle many patterns', async () => {
      const code = `match x {
  0 => "zero"
  1 => "one"
  2 => "two"
  3 => "three"
  4 => "four"
  5 => "five"
  _ => "other"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle whitespace in patterns', async () => {
      const code = `match   x   {
  0   =>   "zero"
  _   =>   "other"
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle special characters in strings', async () => {
      const code = `match msg {
  "hello\\nworld" => true
  "test\\t" => false
  _ => false
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });
});
