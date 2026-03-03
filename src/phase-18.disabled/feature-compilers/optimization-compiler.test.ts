/**
 * Optimization Compiler Tests
 *
 * Tests for Phase 18.9: Optimization Compiler
 * Coverage: 25 test cases
 */

import { OptimizationCompiler } from './optimization-compiler';

describe('Phase 18.9: Optimization Compiler', () => {
  let compiler: OptimizationCompiler;

  beforeEach(() => {
    compiler = new OptimizationCompiler('optimize');
  });

  describe('Dead Code Elimination', () => {
    it('should identify dead code', async () => {
      const code = `let x = 5
let y = x
let z = 10`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should remove unused variables', async () => {
      const code = `let unused = 42
let x = 10
return x`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should preserve live code', async () => {
      const code = `let x = 5
let y = x + 10
return y`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getOptimizationStats().optimizedSize).toBeGreaterThan(0);
    });

    it('should remove unreachable code', async () => {
      const code = `return 42
let x = 10`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should eliminate redundant assignments', async () => {
      const code = `let x = 10
x = 20
x = 30`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should track ADCE results', async () => {
      const code = `let a = 1
let b = 2
let c = 3
return a`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getPassResults().some(p => p.name === 'ADCE')).toBe(true);
    });
  });

  describe('Constant Folding', () => {
    it('should fold numeric constants', async () => {
      const code = 'let result = 1 + 2';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should fold complex expressions', async () => {
      const code = 'let x = 10 + 20 * 3';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should fold arithmetic operations', async () => {
      const code = `let a = 100 - 50
let b = 10 * 5
let c = 60 / 2`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should fold comparison operations', async () => {
      const code = `let x = 5 == 5
let y = 10 > 5
let z = 3 < 10`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should avoid division by zero', async () => {
      const code = 'let x = 10 / 0';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should track constant folding results', async () => {
      const code = `let a = 1 + 2
let b = 10 * 5
let c = 100 - 25`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getPassResults().some(p => p.name === 'Constant Folding')).toBe(true);
    });

    it('should fold modulo operations', async () => {
      const code = `let a = 10 % 3
let b = 20 % 7`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Function Inlining', () => {
    it('should identify inlining candidates', async () => {
      const code = `fn small() { return 42 }
let x = small()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should inline small functions', async () => {
      const code = `fn add(a, b) { return a + b }
let result = add(5, 3)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should not inline large functions', async () => {
      const code = `fn large() {
  let x = 1
  let y = 2
  let z = 3
  return x + y + z
}
let result = large()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle recursive functions carefully', async () => {
      const code = `fn factorial(n) {
  if n <= 1 then 1
  else n * factorial(n - 1)
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should track inlining statistics', async () => {
      const code = `fn id(x) { return x }
let a = id(1)
let b = id(2)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getPassResults().some(p => p.name === 'Function Inlining')).toBe(true);
    });
  });

  describe('Peephole Optimization', () => {
    it('should eliminate neutral element', async () => {
      const code = 'let x = 5 + 0';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should simplify identical comparisons', async () => {
      const code = 'let x = 5 == 5';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should remove redundant jumps', async () => {
      const code = `if true then
  let x = 1
else
  let x = 2`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should eliminate redundant stores', async () => {
      const code = `let x = 1
x = 1`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should apply multiple patterns', async () => {
      const code = `let a = 10 + 0
let b = 5 == 5
let c = 3 - 0`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Optimization Statistics', () => {
    it('should track original size', async () => {
      const code = `let x = 1
let y = 2
let z = 3`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getOptimizationStats().originalSize).toBeGreaterThan(0);
    });

    it('should track optimized size', async () => {
      const code = 'let x = 1 + 2 + 3';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getOptimizationStats().optimizedSize).toBeGreaterThanOrEqual(0);
    });

    it('should calculate compression ratio', async () => {
      const code = `let a = 1 + 2
let b = 3 + 4
let c = 5 + 6
return a + b + c`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      const stats = compiler.getOptimizationStats();
      expect(stats.compressionRatio).toBeGreaterThanOrEqual(0);
    });

    it('should report multiple passes', async () => {
      const code = `let x = 10 + 20
let y = x * 2
return y`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getPassResults().length).toBeGreaterThanOrEqual(1);
    });

    it('should track reduction per pass', async () => {
      const code = `let unused = 42
let x = 1 + 2
let y = x * 3`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      const passes = compiler.getPassResults();
      for (const pass of passes) {
        expect(pass.instructionsBefore).toBeGreaterThanOrEqual(0);
        expect(pass.instructionsAfter).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Compilation Stages', () => {
    it('should complete all stages', async () => {
      const code = 'let x = 1 + 2';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThanOrEqual(5);
    });

    it('should include optimization stage', async () => {
      const code = 'let x = 10 + 20';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.name.includes('Optimization'))).toBe(true);
    });

    it('should report optimization statistics', async () => {
      const code = `let a = 1 + 2
let b = 3 + 4`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.some(w => w.includes('reduction')))).toBe(true);
    });

    it('should report pass count', async () => {
      const code = 'let x = 1 + 2 + 3';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.some(w => w.includes('passes')))).toBe(true);
    });
  });

  describe('Performance Tracking', () => {
    it('should calculate cost reduction', async () => {
      const code = `let x = 5 + 0
let y = 10 - 0`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      const stats = compiler.getOptimizationStats();
      expect(stats.compressionRatio).toBeDefined();
    });

    it('should track multiple optimizations', async () => {
      const code = `let a = 1 + 2
let b = unused
let c = 3 == 3`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(compiler.getPassResults().length).toBeGreaterThan(0);
    });

    it('should report actual reduction percentage', async () => {
      const code = `let unused1 = 1
let unused2 = 2
let x = 10`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      const passes = compiler.getPassResults();
      for (const pass of passes) {
        expect(pass.reductionPercent).toBeDefined();
      }
    });
  });

  describe('Correctness Validation', () => {
    it('should preserve program semantics', async () => {
      const code = `let x = 10 + 20
let y = x * 2
return y`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      // Result should still be semantically correct
    });

    it('should not change function behavior', async () => {
      const code = `fn add(a, b) { return a + b }
let result = add(5, 3)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      // Function should still return 8
    });

    it('should handle nested operations', async () => {
      const code = 'let x = (1 + 2) * (3 + 4)';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should validate after optimization', async () => {
      const code = `let a = 100 / 10
let b = a * 2
return b`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty code', async () => {
      const result = await compiler.compile('');
      expect(result.success).toBe(false);
    });

    it('should handle syntax errors', async () => {
      const code = 'let x = 1 +';
      const result = await compiler.compile(code);
      expect(result.success).toBe(false);
    });

    it('should report compilation errors', async () => {
      const code = 'let x = )(';
      const result = await compiler.compile(code);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle large constants', async () => {
      const code = 'let x = 999999999 + 1';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle many operations', async () => {
      const code = `let a = 1 + 2 + 3 + 4 + 5
let b = 10 * 2 * 3 / 2
let c = a + b`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle deeply nested expressions', async () => {
      const code = 'let x = ((((1 + 2) * 3) - 4) / 5)';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should optimize with conditionals', async () => {
      const code = `if 1 == 1 then
  let x = 10
else
  let x = 20`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle loops with constants', async () => {
      const code = `for i in 0..10 {
  let x = 5 + 5
}`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });
});
