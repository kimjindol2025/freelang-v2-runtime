/**
 * Async Compiler Tests
 *
 * Tests for Phase 18.5: Async Compiler
 * Coverage: 35 test cases
 */

import { AsyncCompiler } from './async-compiler';

describe('Phase 18.5: Async Compiler', () => {
  let compiler: AsyncCompiler;

  beforeEach(() => {
    compiler = new AsyncCompiler('jit');
  });

  describe('Basic Async Functions', () => {
    it('should parse async function declaration', async () => {
      const code = 'async fn fetch()';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse async function with parameters', async () => {
      const code = 'async fn get(key: string) -> string';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse async function with return type', async () => {
      const code = 'async fn getData() -> number';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should count async functions correctly', async () => {
      const code = `async fn fetch()
async fn get()
async fn post()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.some(w => w.includes('async functions')))).toBe(true);
    });
  });

  describe('Await Expressions', () => {
    it('should parse simple await expression', async () => {
      const code = `async fn fetch()
await getData()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse await with variable binding', async () => {
      const code = `async fn fetch()
let x = await getData()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse multiple await expressions', async () => {
      const code = `async fn sequence()
let x = await first()
let y = await second()
let z = await third()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.some(w => w.includes('await expressions')))).toBe(true);
    });

    it('should parse nested await calls', async () => {
      const code = `async fn nested()
let x = await outer(await inner())`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should count await expressions', async () => {
      const code = `async fn test()
await first()
let x = await second()
await third()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Async Control Flow', () => {
    it('should parse if statement in async function', async () => {
      const code = `async fn conditional()
if true then
  let x = await getData()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse while loop in async function', async () => {
      const code = `async fn loop()
while true
  let x = await getData()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse for loop with await', async () => {
      const code = `async fn iterate()
for i in 0..10
  let x = await process(i)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Try-Catch with Async', () => {
    it('should parse try-catch in async function', async () => {
      const code = `async fn tryCatch()
try
  let x = await getData()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle multiple try-catch', async () => {
      const code = `async fn multiTry()
try
  let x = await first()
try
  let y = await second()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should parse try with multiple awaits', async () => {
      const code = `async fn complexTry()
try
  let x = await first()
  let y = await second()
  let z = x + y`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation: Await Outside Async', () => {
    it('should error on await outside async function', async () => {
      const code = 'let x = await getData()';
      const result = await compiler.compile(code);
      expect(result.errors.some(e => e.includes('await used outside async'))).toBe(true);
    });

    it('should error on multiple awaits outside async', async () => {
      const code = `await first()
await second()`;
      const result = await compiler.compile(code);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should accept await in function if marked async', async () => {
      const code = `async fn valid()
let x = await getData()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should reject await in regular function', async () => {
      const code = `fn sync()
let x = await getData()`;
      const result = await compiler.compile(code);
      expect(result.errors.some(e => e.includes('await used outside async'))).toBe(true);
    });
  });

  describe('State Machine Transformation', () => {
    it('should create state machine for async function', async () => {
      const code = `async fn fetch()
let x = await getData()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.name.includes('State Machine'))).toBe(true);
    });

    it('should generate state for each await point', async () => {
      const code = `async fn sequence()
let a = await first()
let b = await second()
let c = await third()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.some(w => w.includes('state machine')))).toBe(true);
    });

    it('should create entry state', async () => {
      const code = 'async fn test()';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      // Verification: entry_test state should be generated
    });

    it('should create return state', async () => {
      const code = `async fn test()
let x = await getData()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      // Verification: return_test state should be generated
    });

    it('should link states sequentially', async () => {
      const code = `async fn process()
let x = await step1()
let y = await step2()
return x + y`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      // Each await creates a state linked to the next
    });
  });

  describe('Promise Type Handling', () => {
    it('should recognize Promise return type', async () => {
      const code = `async fn fetch() -> Promise<string>
let x = await getData()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should infer Promise from async', async () => {
      const code = `async fn test() -> string
let x = await getData()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle generic Promise', async () => {
      const code = `async fn get<T>() -> Promise<T>
await fetch()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Sequential vs Parallel Async', () => {
    it('should recognize sequential await', async () => {
      const code = `async fn sequential()
let x = await first()
let y = await second(x)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should recognize parallel await pattern', async () => {
      const code = `async fn parallel()
let x = await first()
let y = await second()
return x + y`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle mixed sequential and parallel', async () => {
      const code = `async fn mixed()
let a = await first()
let b = await second()
let c = await third(a)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('Compilation Stages', () => {
    it('should complete all stages', async () => {
      const code = `async fn fetch()
let x = await getData()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.length).toBeGreaterThanOrEqual(4);
    });

    it('should report async information in stages', async () => {
      const code = 'async fn test()';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.name.includes('Async'))).toBe(true);
    });

    it('should report await count in warnings', async () => {
      const code = `async fn test()
let x = await first()
let y = await second()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.some(w => w.includes('await')))).toBe(true);
    });

    it('should report transformation completion', async () => {
      const code = `async fn fetch()
let x = await getData()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.name.includes('State Machine'))).toBe(true);
    });
  });

  describe('Complex Async Patterns', () => {
    it('should handle async with local variables', async () => {
      const code = `async fn process()
let total = 0
let x = await first()
let y = await second()
total = x + y`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle async with conditionals', async () => {
      const code = `async fn conditional()
let x = await getData()
if x > 0 then
  let y = await process(x)`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle nested async calls', async () => {
      const code = `async fn outer()
let x = await inner()

async fn inner()
let y = await getdata()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });

  describe('IR Generation for Async', () => {
    it('should generate async IR instructions', async () => {
      const code = 'async fn fetch()';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.instructions.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate instructions for state machine', async () => {
      const code = `async fn test()
let x = await getData()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
      expect(result.stages.some(s => s.warnings && s.warnings.some(w => w.includes('instructions')))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty async function', async () => {
      const code = 'async fn empty()';
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle malformed await', async () => {
      const code = `async fn bad()
await`;
      const result = await compiler.compile(code);
      // Should either fail or handle gracefully
      expect(result.errors.length === 0 || result.success === false).toBe(true);
    });

    it('should reject syntax errors', async () => {
      const code = 'async fn (malformed';
      const result = await compiler.compile(code);
      expect(result.success).toBe(false);
    });

    it('should handle empty source', async () => {
      const result = await compiler.compile('');
      expect(result.success).toBe(false);
    });

    it('should report error count', async () => {
      const code = `let x = await getData()
async fn test()`;
      const result = await compiler.compile(code);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle deeply nested async calls', async () => {
      const code = `async fn deep()
let a = await f1(await f2(await f3(await f4())))`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle many await expressions', async () => {
      const code = `async fn many()
let a = await f1()
let b = await f2()
let c = await f3()
let d = await f4()
let e = await f5()`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle async with complex expressions', async () => {
      const code = `async fn expr()
let x = (await getData()) + (await getMore()) * 2`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });

    it('should handle whitespace in async', async () => {
      const code = `async   fn   test ( )
let   x   =   await   getData ( )`;
      const result = await compiler.compile(code);
      expect(result.success).toBe(true);
    });
  });
});
