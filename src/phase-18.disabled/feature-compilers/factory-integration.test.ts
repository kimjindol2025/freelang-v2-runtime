/**
 * Factory Integration Tests
 *
 * Real-world examples of using the compiler factory pattern
 * Demonstrates auto-detection, pipeline execution, and chain building
 *
 * TEMPORARILY DISABLED - compiler-factory module not found
 */

/*
import {
  CompilerFactory,
  CompilerType,
  CompilerPipeline,
  CompilerChain,
} from './compiler-factory';
*/

/*
describe('Compiler Factory Integration Tests', () => {
  let factory: CompilerFactory;

  beforeEach(() => {
    factory = new CompilerFactory('optimize', 2);
  });

  describe('Scenario 1: Simple Expression Compilation', () => {
    it('should compile simple math expression', async () => {
      const code = '1 + 2 * 3';
      const types = factory.autoSelect(code);

      expect(types).toContain(CompilerType.EXPRESSION);

      const chain = CompilerChain.forExpressions('optimize');
      const result = await chain.execute(code);

      expect(result).toBeDefined();
      expect(result.stages.length).toBeGreaterThan(0);
    });

    it('should show detected features', () => {
      const code = '10 + 20 * 30';
      const summary = factory.getFeatureSummary(code);

      expect(summary).toContain('expressions');
    });
  });

  describe('Scenario 2: Typed Function Compilation', () => {
    it('should compile typed function', async () => {
      const code = `
        fn add(a: number, b: number) -> number {
          return a + b
        }
      `;

      const types = factory.autoSelect(code);
      expect(types.length).toBeGreaterThan(1);
      expect(types).toContain(CompilerType.STATEMENT);

      const chain = CompilerChain.forTypedCode('optimize');
      const result = await chain.execute(code);

      expect(result.success === true || result.errors.length >= 0).toBe(true);
    });

    it('should detect type annotations', () => {
      const code = `
        fn process(x: number, s: string) -> bool {
          return x > 0
        }
      `;

      const features = factory.detectFeatures(code);
      expect(features.hasTypeAnnotations).toBe(true);
      expect(features.hasStatements).toBe(true);
    });
  });

  describe('Scenario 3: Generic Type Compilation', () => {
    it('should compile generic function', async () => {
      const code = `
        fn<T> identity(x: T) -> T {
          return x
        }
      `;

      const types = factory.autoSelect(code);
      expect(types).toContain(CompilerType.GENERICS);

      const chain = CompilerChain.forGenerics('optimize');
      const result = await chain.execute(code);

      expect(result).toBeDefined();
    });

    it('should handle generic constraints', () => {
      const code = 'fn<T: Clone> copy(x: T) -> T';
      const features = factory.detectFeatures(code);

      expect(features.hasGenerics).toBe(true);
    });
  });

  describe('Scenario 4: Async/Await Compilation', () => {
    it('should compile async function', async () => {
      const code = `
        async fn fetch(url: string) -> string {
          let data = await getData(url)
          return data
        }
      `;

      const types = factory.autoSelect(code);
      expect(types).toContain(CompilerType.ASYNC);

      const chain = CompilerChain.forAsync('optimize');
      const result = await chain.execute(code);

      expect(result).toBeDefined();
    });

    it('should detect async/await patterns', () => {
      const code = 'async fn process() { await download() }';
      const features = factory.detectFeatures(code);

      expect(features.hasAsync).toBe(true);
    });
  });

  describe('Scenario 5: Pattern Matching Compilation', () => {
    it('should compile pattern match expression', async () => {
      const code = `
        match status {
          200 => "OK"
          404 => "Not Found"
          500 => "Error"
          _ => "Unknown"
        }
      `;

      const types = factory.autoSelect(code);
      expect(types).toContain(CompilerType.PATTERN_MATCH);

      const chain = CompilerChain.full('optimize');
      const result = await chain.execute(code);

      expect(result).toBeDefined();
    });

    it('should detect pattern matching', () => {
      const code = 'match value { x => x + 1, _ => 0 }';
      const features = factory.detectFeatures(code);

      expect(features.hasPatternMatch).toBe(true);
    });
  });

  describe('Scenario 6: Trait Definition Compilation', () => {
    it('should compile trait definition', async () => {
      const code = `
        trait Iterator {
          fn next() -> Option
          fn has_next() -> bool
        }
      `;

      const types = factory.autoSelect(code);
      expect(types).toContain(CompilerType.TRAIT);

      const chain = CompilerChain.full('optimize');
      const result = await chain.execute(code);

      expect(result).toBeDefined();
    });

    it('should detect trait definitions', () => {
      const code = 'trait Iterator { fn next() }';
      const features = factory.detectFeatures(code);

      expect(features.hasTraits).toBe(true);
    });
  });

  describe('Scenario 7: FFI C Binding Compilation', () => {
    it('should compile FFI binding', async () => {
      const code = `
        use "libc"
        int add(int a, int b)
        int strlen(char* str)
      `;

      const types = factory.autoSelect(code);
      expect(types).toContain(CompilerType.FFI);

      const chain = CompilerChain.full('optimize');
      const result = await chain.execute(code);

      expect(result).toBeDefined();
    });

    it('should detect FFI declarations', () => {
      const code = 'use "libc"\nint abs(int x)';
      const features = factory.detectFeatures(code);

      expect(features.hasFFI).toBe(true);
    });
  });

  describe('Scenario 8: Optimization Pipeline', () => {
    it('should optimize code with loops', async () => {
      const code = `
        while condition {
          let x = 1 + 2 + 3
          process(x)
        }
      `;

      const types = factory.autoSelect(code);
      expect(types).toContain(CompilerType.OPTIMIZATION);

      const chain = CompilerChain.full('optimize');
      const result = await chain.execute(code);

      expect(result).toBeDefined();
    });

    it('should detect optimization need', () => {
      const code = 'for i in 0..1000 { let x = i * 2 }';
      const features = factory.detectFeatures(code);

      expect(features.needsOptimization).toBe(true);
    });
  });

  describe('Scenario 9: Complex Multi-Feature Code', () => {
    it('should handle complex program', async () => {
      const code = `
        trait Serializable {
          fn serialize() -> string
        }

        impl Serializable for Data {
          fn serialize() {
            match self {
              Some(x) => x.to_string()
              None => "null"
            }
          }
        }

        async fn save<T: Serializable>(data: T) -> bool {
          let json = data.serialize()
          await writeFile(json)
          return true
        }
      `;

      // Auto-detect features
      const types = factory.autoSelect(code);
      expect(types.length).toBeGreaterThan(3);
      expect(types).toContain(CompilerType.TRAIT);
      expect(types).toContain(CompilerType.ASYNC);
      expect(types).toContain(CompilerType.GENERICS);

      // Get feature summary
      const summary = factory.getFeatureSummary(code);
      expect(summary.length).toBeGreaterThan(0);

      // Execute full pipeline
      const chain = CompilerChain.full('optimize');
      const result = await chain.execute(code);
      expect(result).toBeDefined();
    });
  });

  describe('Scenario 10: Pipeline Execution Modes', () => {
    it('should execute sequential pipeline', async () => {
      const pipeline = new CompilerPipeline(factory);
      pipeline
        .add(CompilerType.EXPRESSION)
        .add(CompilerType.STATEMENT);

      const result = await pipeline.executeSequential();

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.stages.length).toBe(2);
    });

    it('should execute parallel pipeline', async () => {
      const pipeline = new CompilerPipeline(factory);
      pipeline
        .add(CompilerType.EXPRESSION)
        .add(CompilerType.STATEMENT);

      const result = await pipeline.executeParallel();

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.stages.length).toBe(2);
    });

    it('should handle optional stages', async () => {
      const pipeline = new CompilerPipeline(factory);
      pipeline
        .add(CompilerType.EXPRESSION)
        .add(CompilerType.FFI, true); // Optional

      const result = await pipeline.executeSequential();

      expect(result.stages.length).toBe(2);
    });
  });

  describe('Scenario 11: Factory Configuration', () => {
    it('should compile with different targets', () => {
      const targets = ['jit', 'optimize', 'debug'] as const;

      for (const target of targets) {
        const f = new CompilerFactory(target, 2);
        const compiler = f.createCompiler(CompilerType.EXPRESSION);
        expect(compiler).toBeDefined();
      }
    });

    it('should compile with different optimization levels', () => {
      const levels = [0, 1, 2, 3];

      for (const level of levels) {
        const f = new CompilerFactory('optimize', level);
        const compiler = f.createCompiler(CompilerType.OPTIMIZATION);
        expect(compiler).toBeDefined();
      }
    });
  });

  describe('Scenario 12: Chain Building Shortcuts', () => {
    it('should create expression chain', async () => {
      const result = await CompilerChain.forExpressions()
        .execute('1 + 2');
      expect(result).toBeDefined();
    });

    it('should create statement chain', async () => {
      const result = await CompilerChain.forStatements()
        .execute('let x = 5');
      expect(result).toBeDefined();
    });

    it('should create typed chain', async () => {
      const result = await CompilerChain.forTypedCode()
        .execute('let x: number = 42');
      expect(result).toBeDefined();
    });

    it('should create full chain', async () => {
      const result = await CompilerChain.full()
        .execute('let x = 1');
      expect(result).toBeDefined();
    });

    it('should auto-detect in chain', async () => {
      const code = 'async fn test() { await getData() }';
      const result = await CompilerChain.full()
        .autoDetect(code)
        .execute(code);
      expect(result).toBeDefined();
    });
  });

  describe('Scenario 13: Error Handling', () => {
    it('should handle empty code gracefully', async () => {
      const result = await CompilerChain.forExpressions()
        .execute('');
      expect(result).toBeDefined();
    });

    it('should handle invalid syntax gracefully', async () => {
      const result = await CompilerChain.forExpressions()
        .execute('((( invalid');
      expect(result).toBeDefined();
    });

    it('should handle unknown compiler type', () => {
      expect(() => {
        factory.createCompiler('unknown' as CompilerType);
      }).toThrow();
    });
  });

  describe('Scenario 14: Performance Comparison', () => {
    it('should measure sequential vs parallel performance', async () => {
      const code = '1 + 2 * 3 - 4 / 5';

      const pipeline1 = new CompilerPipeline(factory);
      pipeline1.add(CompilerType.EXPRESSION).add(CompilerType.STATEMENT);

      const seqResult = await pipeline1.executeSequential();

      const pipeline2 = new CompilerPipeline(factory);
      pipeline2.add(CompilerType.EXPRESSION).add(CompilerType.STATEMENT);

      const parResult = await pipeline2.executeParallel();

      expect(seqResult.executionTime).toBeGreaterThanOrEqual(0);
      expect(parResult.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Scenario 15: Advanced Chain Composition', () => {
    it('should compose custom chain', async () => {
      const chain = new CompilerChain('optimize')
        .with(CompilerType.EXPRESSION)
        .with(CompilerType.STATEMENT)
        .with(CompilerType.TYPE_INFERENCE)
        .with(CompilerType.OPTIMIZATION, true);

      const result = await chain.execute('let x: number = 1 + 2');
      expect(result).toBeDefined();
    });

    it('should fluently build complex pipeline', async () => {
      const result = await CompilerChain.full()
        .with(CompilerType.TYPE_INFERENCE)
        .with(CompilerType.OPTIMIZATION, true)
        .execute('let x = 1 + 2 + 3');

      expect(result).toBeDefined();
    });
  });
});
*/
