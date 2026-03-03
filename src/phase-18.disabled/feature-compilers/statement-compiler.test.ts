/**
 * Statement Compiler Tests
 *
 * Tests for Phase 18.2: Statement Compiler
 * Coverage: 25 test cases
 */

import { StatementCompiler } from './statement-compiler';

describe('Phase 18.2: Statement Compiler', () => {
  let compiler: StatementCompiler;

  beforeEach(() => {
    compiler = new StatementCompiler('executable');
  });

  describe('Variable Declarations', () => {
    it('should compile simple variable declaration', async () => {
      const result = await compiler.compile('let x = 5');
      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should compile typed variable declaration', async () => {
      const result = await compiler.compile('let message: string = "hello"');
      expect(result.success).toBe(true);
    });

    it('should compile multiple declarations', async () => {
      const code = `let x = 1
let y = 2
let z = x + y`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('If/Else Statements', () => {
    it('should compile if statement', async () => {
      const result = await compiler.compile('if (x > 0)');
      expect(result.success).toBe(true);
    });

    it('should compile if-else statement', async () => {
      const code = `if (x > 0)
else`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should compile nested if statements', async () => {
      const code = `if (x > 0)
if (x > 10)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should compile if with multiple conditions', async () => {
      const code = `if (x > 0 && y < 10)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Loops', () => {
    it('should compile while loop', async () => {
      const result = await compiler.compile('while (i < 10)');
      expect(result.success).toBe(true);
    });

    it('should compile for loop', async () => {
      const result = await compiler.compile('for (let i = 0; i < 10; i++)');
      expect(result.success).toBe(true);
    });

    it('should compile for-of loop', async () => {
      const result = await compiler.compile('for (let item in array)');
      expect(result.success).toBe(true);
    });

    it('should compile nested loops', async () => {
      const code = `for (let i = 0; i < 10; i++)
while (j < 10)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Function Declarations', () => {
    it('should compile function declaration', async () => {
      const result = await compiler.compile('fn add(x, y) -> number');
      expect(result.success).toBe(true);
    });

    it('should compile function without return type', async () => {
      const result = await compiler.compile('fn processData(input)');
      expect(result.success).toBe(true);
    });

    it('should compile function with multiple parameters', async () => {
      const result = await compiler.compile('fn calculate(a, b, c) -> number');
      expect(result.success).toBe(true);
    });

    it('should compile function with no parameters', async () => {
      const result = await compiler.compile('fn getData() -> string');
      expect(result.success).toBe(true);
    });
  });

  describe('Return Statements', () => {
    it('should compile return statement in function', async () => {
      const code = `fn getValue() -> number
return 42`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should compile return without value', async () => {
      const code = `fn doWork()
return`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should warn about return outside function', async () => {
      const result = await compiler.compile('return 42');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Break and Continue', () => {
    it('should allow break in loop', async () => {
      const code = `while (true)
break`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should allow continue in loop', async () => {
      const code = `while (i < 10)
continue`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should error on break outside loop', async () => {
      const result = await compiler.compile('break');
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('break'))).toBe(true);
    });

    it('should error on continue outside loop', async () => {
      const result = await compiler.compile('continue');
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('continue'))).toBe(true);
    });

    it('should allow break in nested loop', async () => {
      const code = `for (let i = 0; i < 10; i++)
while (j < 10)
break`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Control Flow Validation', () => {
    it('should validate control flow in complex program', async () => {
      const code = `let x = 0
while (x < 10)
  if (x == 5)
    break
  x = x + 1
return x`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle function with multiple returns', async () => {
      const code = `fn findValue(arr, target)
for (let i = 0; i < 10; i++)
  if (arr[i] == target)
    return i
return -1`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Comments', () => {
    it('should ignore single-line comments', async () => {
      const code = `let x = 5
// This is a comment
let y = 10`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Compilation Stages', () => {
    it('should complete all stages for simple statements', async () => {
      const result = await compiler.compile('let x = 1');
      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThanOrEqual(4);
      expect(result.stages.every(s => s.success)).toBe(true);
    });

    it('should track compilation time', async () => {
      const result = await compiler.compile(`let x = 0
while (x < 100)
  x = x + 1`);
      expect(result.success).toBe(true);
      expect(result.compilation_time_ms).toBeGreaterThan(0);
    });

    it('should generate IR instructions', async () => {
      const result = await compiler.compile('let x = 5');
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.name === 'Code Generation')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty program', async () => {
      const result = await compiler.compile('');
      expect(result.success).toBe(false);
    });

    it('should handle statements with extra whitespace', async () => {
      const result = await compiler.compile('let   x   =   5');
      expect(result.success).toBe(true);
    });

    it('should handle complex nested control flow', async () => {
      const code = `for (let i = 0; i < 10; i++)
  for (let j = 0; j < 10; j++)
    if (i == j)
      break
    if (i > 5)
      continue`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle function with complex body', async () => {
      const code = `fn process(data)
let result = 0
for (let item in data)
  if (item > 0)
    result = result + item
return result`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should report syntax errors', async () => {
      const result = await compiler.compile('let x = ');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should report control flow errors', async () => {
      const result = await compiler.compile('break');
      expect(result.success).toBe(false);
    });
  });
});
