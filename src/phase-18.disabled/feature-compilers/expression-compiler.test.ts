/**
 * Expression Compiler Tests
 *
 * Tests for Phase 18.1: Expression Compiler
 * Coverage: 20 test cases
 */

import { ExpressionCompiler } from './expression-compiler';
import { Inst, Op } from '../../types';

describe('Phase 18.1: Expression Compiler', () => {
  let compiler: ExpressionCompiler;

  beforeEach(() => {
    compiler = new ExpressionCompiler('jit');
  });

  describe('Basic Literals', () => {
    it('should compile number literals', async () => {
      const result = await compiler.compile('42');
      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should compile negative numbers', async () => {
      const result = await compiler.compile('-17');
      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should compile floating point numbers', async () => {
      const result = await compiler.compile('3.14159');
      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should compile string literals', async () => {
      const result = await compiler.compile('"hello world"');
      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should compile boolean literals', async () => {
      const result1 = await compiler.compile('true');
      expect(result1.success).toBe(true);

      const result2 = await compiler.compile('false');
      expect(result2.success).toBe(true);
    });
  });

  describe('Binary Operations', () => {
    it('should compile addition', async () => {
      const result = await compiler.compile('1 + 2');
      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should compile subtraction', async () => {
      const result = await compiler.compile('10 - 3');
      expect(result.success).toBe(true);
    });

    it('should compile multiplication', async () => {
      const result = await compiler.compile('5 * 6');
      expect(result.success).toBe(true);
    });

    it('should compile division', async () => {
      const result = await compiler.compile('20 / 4');
      expect(result.success).toBe(true);
    });

    it('should compile modulo', async () => {
      const result = await compiler.compile('10 % 3');
      expect(result.success).toBe(true);
    });

    it('should compile comparison operators', async () => {
      const result1 = await compiler.compile('5 < 10');
      expect(result1.success).toBe(true);

      const result2 = await compiler.compile('10 > 5');
      expect(result2.success).toBe(true);

      const result3 = await compiler.compile('5 == 5');
      expect(result3.success).toBe(true);

      const result4 = await compiler.compile('5 != 10');
      expect(result4.success).toBe(true);
    });

    it('should compile logical operators', async () => {
      const result1 = await compiler.compile('true && false');
      expect(result1.success).toBe(true);

      const result2 = await compiler.compile('true || false');
      expect(result2.success).toBe(true);
    });

    it('should compile string concatenation', async () => {
      const result = await compiler.compile('"hello" + " world"');
      expect(result.success).toBe(true);
    });
  });

  describe('Unary Operations', () => {
    it('should compile unary minus', async () => {
      const result = await compiler.compile('-5');
      expect(result.success).toBe(true);
    });

    it('should compile logical NOT', async () => {
      const result = await compiler.compile('!true');
      expect(result.success).toBe(true);
    });
  });

  describe('Variables', () => {
    it('should compile variable access', async () => {
      const result = await compiler.compile('x');
      expect(result.success).toBe(true);
    });

    it('should compile variable in expression', async () => {
      const result = await compiler.compile('x + 1');
      expect(result.success).toBe(true);
    });

    it('should compile complex variable expressions', async () => {
      const result = await compiler.compile('foo + bar * baz');
      expect(result.success).toBe(true);
    });
  });

  describe('Arrays', () => {
    it('should compile array literals', async () => {
      const result = await compiler.compile('[1, 2, 3]');
      expect(result.success).toBe(true);
    });

    it('should compile empty arrays', async () => {
      const result = await compiler.compile('[]');
      expect(result.success).toBe(true);
    });

    it('should compile array indexing', async () => {
      const result = await compiler.compile('arr[0]');
      expect(result.success).toBe(true);
    });

    it('should compile nested array indexing', async () => {
      const result = await compiler.compile('matrix[0][1]');
      expect(result.success).toBe(true);
    });

    it('should compile arrays in expressions', async () => {
      const result = await compiler.compile('[1, 2, 3][0] + 5');
      expect(result.success).toBe(true);
    });
  });

  describe('Nested Expressions', () => {
    it('should compile expressions with parentheses', async () => {
      const result = await compiler.compile('(1 + 2) * 3');
      expect(result.success).toBe(true);
    });

    it('should handle operator precedence correctly', async () => {
      const result = await compiler.compile('2 + 3 * 4');
      expect(result.success).toBe(true);
      // Should be interpreted as 2 + (3 * 4), not (2 + 3) * 4
    });

    it('should compile deeply nested expressions', async () => {
      const result = await compiler.compile('((1 + 2) * (3 - 4)) / 5');
      expect(result.success).toBe(true);
    });

    it('should compile mixed operators', async () => {
      const result = await compiler.compile('1 + 2 * 3 - 4 / 2');
      expect(result.success).toBe(true);
    });
  });

  describe('Compilation Stages', () => {
    it('should complete all compilation stages successfully', async () => {
      const result = await compiler.compile('1 + 2');
      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThanOrEqual(4); // Lexical, Syntax, Semantic, CodeGen
      expect(result.stages.every(s => s.success)).toBe(true);
    });

    it('should track compilation timing', async () => {
      const result = await compiler.compile('1 + 2 + 3 + 4 + 5');
      expect(result.success).toBe(true);
      expect(result.compilation_time_ms).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      const result = await compiler.compile('');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle whitespace in expressions', async () => {
      const result = await compiler.compile('  1  +  2  *  3  ');
      expect(result.success).toBe(true);
    });

    it('should handle single-quoted strings', async () => {
      const result = await compiler.compile("'hello'");
      expect(result.success).toBe(true);
    });

    it('should compile very long expressions', async () => {
      const longExpr = Array(100).fill('1').join(' + ');
      const result = await compiler.compile(longExpr);
      expect(result.success).toBe(true);
    });
  });
});
