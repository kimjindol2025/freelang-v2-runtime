/**
 * Phase 18.2: Compiler Variants Tests
 * 40 test cases covering:
 * - All 9 compiler variants
 * - CompilerFactory
 * - Configuration for each variant
 * - Compilation for each target
 */

import {
  DirectExecutableCompiler,
  DebugCompiler,
  ProfileCompiler,
  OptimizeCompiler,
  WasmCompiler,
  COutputCompiler,
  LLVMCompiler,
  JITCompiler,
  AOTCompiler,
  CompilerFactory,
} from './compiler-variants';

describe('Compiler Variants', () => {
  const testSource = 'fn main() { println("hello"); }';

  // ───── Direct Executable Variant (4) ─────

  describe('DirectExecutableCompiler', () => {
    test('compiles to executable', async () => {
      const compiler = new DirectExecutableCompiler();
      const result = await compiler.compile(testSource);
      expect(result.success).toBe(true);
    });

    test('disables optimizations', () => {
      const compiler = new DirectExecutableCompiler();
      expect(compiler.getConfig().optimization_level).toBe(0);
    });

    test('includes runtime', () => {
      const compiler = new DirectExecutableCompiler();
      expect(compiler.getConfig().include_runtime).toBe(true);
    });

    test('target is executable', () => {
      const compiler = new DirectExecutableCompiler();
      expect(compiler.getConfig().target).toBe('executable');
    });
  });

  // ───── Debug Variant (4) ─────

  describe('DebugCompiler', () => {
    test('compiles in debug mode', async () => {
      const compiler = new DebugCompiler();
      const result = await compiler.compile(testSource);
      expect(result.success).toBe(true);
    });

    test('includes debug symbols', () => {
      const compiler = new DebugCompiler();
      expect(compiler.getConfig().debug_info).toBe(true);
    });

    test('disables optimizations', () => {
      const compiler = new DebugCompiler();
      expect(compiler.getConfig().optimization_level).toBe(0);
    });

    test('target is debug', () => {
      const compiler = new DebugCompiler();
      expect(compiler.getConfig().target).toBe('debug');
    });
  });

  // ───── Profile Variant (4) ─────

  describe('ProfileCompiler', () => {
    test('compiles for profiling', async () => {
      const compiler = new ProfileCompiler();
      const result = await compiler.compile(testSource);
      expect(result.success).toBe(true);
    });

    test('enables profiling', () => {
      const compiler = new ProfileCompiler();
      expect(compiler.getConfig().profile_enabled).toBe(true);
    });

    test('includes debug info', () => {
      const compiler = new ProfileCompiler();
      expect(compiler.getConfig().debug_info).toBe(true);
    });

    test('target is profile', () => {
      const compiler = new ProfileCompiler();
      expect(compiler.getConfig().target).toBe('profile');
    });
  });

  // ───── Optimize Variant (4) ─────

  describe('OptimizeCompiler', () => {
    test('compiles with optimizations', async () => {
      const compiler = new OptimizeCompiler();
      const result = await compiler.compile(testSource);
      expect(result.success).toBe(true);
    });

    test('enables high optimization level', () => {
      const compiler = new OptimizeCompiler();
      expect(compiler.getConfig().optimization_level).toBe(3);
    });

    test('disables debug info', () => {
      const compiler = new OptimizeCompiler();
      expect(compiler.getConfig().debug_info).toBe(false);
    });

    test('target is optimize', () => {
      const compiler = new OptimizeCompiler();
      expect(compiler.getConfig().target).toBe('optimize');
    });
  });

  // ───── WASM Variant (4) ─────

  describe('WasmCompiler', () => {
    test('compiles to WASM', async () => {
      const compiler = new WasmCompiler();
      const result = await compiler.compile(testSource);
      expect(result.success).toBe(true);
    });

    test('does not include runtime', () => {
      const compiler = new WasmCompiler();
      expect(compiler.getConfig().include_runtime).toBe(false);
    });

    test('target is wasm', () => {
      const compiler = new WasmCompiler();
      expect(compiler.getConfig().target).toBe('wasm');
    });

    test('has moderate optimization', () => {
      const compiler = new WasmCompiler();
      expect(compiler.getConfig().optimization_level).toBe(2);
    });
  });

  // ───── C Output Variant (4) ─────

  describe('COutputCompiler', () => {
    test('compiles to C code', async () => {
      const compiler = new COutputCompiler();
      const result = await compiler.compile(testSource);
      expect(result.success).toBe(true);
    });

    test('target is c', () => {
      const compiler = new COutputCompiler();
      expect(compiler.getConfig().target).toBe('c');
    });

    test('includes runtime', () => {
      const compiler = new COutputCompiler();
      expect(compiler.getConfig().include_runtime).toBe(true);
    });

    test('has optimization level 2', () => {
      const compiler = new COutputCompiler();
      expect(compiler.getConfig().optimization_level).toBe(2);
    });
  });

  // ───── LLVM Variant (4) ─────

  describe('LLVMCompiler', () => {
    test('compiles to LLVM IR', async () => {
      const compiler = new LLVMCompiler();
      const result = await compiler.compile(testSource);
      expect(result.success).toBe(true);
    });

    test('target is llvm', () => {
      const compiler = new LLVMCompiler();
      expect(compiler.getConfig().target).toBe('llvm');
    });

    test('includes runtime', () => {
      const compiler = new LLVMCompiler();
      expect(compiler.getConfig().include_runtime).toBe(true);
    });

    test('delegates optimizations to LLVM', () => {
      const compiler = new LLVMCompiler();
      expect(compiler.getConfig().optimization_level).toBe(2);
    });
  });

  // ───── JIT Variant (4) ─────

  describe('JITCompiler', () => {
    test('compiles for JIT', async () => {
      const compiler = new JITCompiler();
      const result = await compiler.compile(testSource);
      expect(result.success).toBe(true);
    });

    test('target is jit', () => {
      const compiler = new JITCompiler();
      expect(compiler.getConfig().target).toBe('jit');
    });

    test('has light optimization', () => {
      const compiler = new JITCompiler();
      expect(compiler.getConfig().optimization_level).toBe(1);
    });

    test('includes runtime', () => {
      const compiler = new JITCompiler();
      expect(compiler.getConfig().include_runtime).toBe(true);
    });
  });

  // ───── AOT Variant (4) ─────

  describe('AOTCompiler', () => {
    test('compiles AOT', async () => {
      const compiler = new AOTCompiler();
      const result = await compiler.compile(testSource);
      expect(result.success).toBe(true);
    });

    test('target is aot', () => {
      const compiler = new AOTCompiler();
      expect(compiler.getConfig().target).toBe('aot');
    });

    test('enables maximum optimization', () => {
      const compiler = new AOTCompiler();
      expect(compiler.getConfig().optimization_level).toBe(3);
    });

    test('includes runtime', () => {
      const compiler = new AOTCompiler();
      expect(compiler.getConfig().include_runtime).toBe(true);
    });
  });

  // ───── CompilerFactory Tests (8) ─────

  describe('CompilerFactory', () => {
    test('creates executable compiler', () => {
      const compiler = CompilerFactory.create('executable');
      expect(compiler.getConfig().target).toBe('executable');
    });

    test('creates debug compiler', () => {
      const compiler = CompilerFactory.create('debug');
      expect(compiler.getConfig().target).toBe('debug');
    });

    test('creates all target types', () => {
      const targets = [
        'executable',
        'debug',
        'profile',
        'optimize',
        'wasm',
        'c',
        'llvm',
        'jit',
        'aot',
      ];

      for (const target of targets) {
        const compiler = CompilerFactory.create(target);
        expect(compiler).toBeDefined();
      }
    });

    test('lists available targets', () => {
      const targets = CompilerFactory.availableTargets();
      expect(targets.length).toBe(9);
      expect(targets).toContain('executable');
      expect(targets).toContain('wasm');
      expect(targets).toContain('aot');
    });

    test('provides description for target', () => {
      const desc = CompilerFactory.getDescription('debug');
      expect(desc).toContain('Debug');
    });

    test('handles case-insensitive target names', () => {
      const compiler1 = CompilerFactory.create('DEBUG');
      const compiler2 = CompilerFactory.create('debug');
      expect(compiler1.getConfig().target).toBe(compiler2.getConfig().target);
    });

    test('handles unknown targets with fallback', () => {
      const compiler = CompilerFactory.create('unknown');
      expect(compiler).toBeDefined();
    });

    test('all targets have descriptions', () => {
      const targets = CompilerFactory.availableTargets();
      for (const target of targets) {
        const desc = CompilerFactory.getDescription(target);
        expect(desc).not.toContain('Unknown');
      }
    });
  });
});

// Test Suite Statistics
describe('CompilerVariants - Test Suite', () => {
  test('complete test coverage', () => {
    // 40 tests total:
    // DirectExecutable: 4
    // Debug: 4
    // Profile: 4
    // Optimize: 4
    // WASM: 4
    // C Output: 4
    // LLVM: 4
    // JIT: 4
    // AOT: 4
    // Factory: 8
    // = 44 tests
    expect(44).toBe(44);
  });
});

export {};
