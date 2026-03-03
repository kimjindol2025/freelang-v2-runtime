// FreeLang v2 - Main API
// AI imports this. No CLI. No human interface.
//
// Usage (by AI):
//   import { FreeLang, Op } from './index';
//   const fl = new FreeLang();
//   const result = fl.exec({ fn: 'sum', params: [{name:'arr', type:'array'}], ret:'number', body: [
//     { op: Op.ARR_SUM, arg: 'arr' },
//     { op: Op.RET }
//   ]});

import { AIIntent, VMResult, CompileResult, Op, Inst } from './types';
import { VM } from './vm';
import { CodeGen } from './codegen';
import { Compiler } from './compiler';
import { Corrector, CorrectionResult } from './correction';
import { Learner } from './learner';
import { AutoHeaderEngine, HeaderProposal } from './engine/auto-header';
import { Pipeline, PipelineInput, PipelineOutput } from './pipeline';

export { Op, Inst, AIIntent, VMResult, CompileResult };
export type { CorrectionResult, HeaderProposal, PipelineInput, PipelineOutput };
export { AutoHeaderEngine, Pipeline };

// Phase 12: Threading Exports
export {
  RealThreadManager,
  ThreadManager,
  createRealThreadManager,
  createThreadManager
} from './phase-12/thread-manager';

export {
  WorkerPool,
  getGlobalPool,
  runInWorker
} from './phase-12/worker-pool';

export {
  AtomicMutex,
  SharedAtomicMutex
} from './phase-12/atomic-mutex';

export {
  MessageChannel,
  RequestResponseChannel
} from './phase-12/message-channel';

export {
  runFreeLangInThread,
  runFreeLangInParallel,
  runFreeLangBatch,
  estimateSpeedup
} from './phase-12/freelang-worker';

export interface ExecResult {
  // VM execution
  vm: VMResult;
  // Self-correction (if needed)
  correction?: CorrectionResult;
  // C compilation (if requested)
  compile?: CompileResult;
  // Native run (if compiled)
  native?: { ok: boolean; stdout: string; exit_code: number };
  // Learning stats
  pattern_success_rate: number;
}

export interface ExecOptions {
  compile?: boolean;     // also generate + compile C code (default: false)
  run_native?: boolean;  // also run the compiled binary (default: false)
  auto_correct?: boolean;// enable self-correction loop (default: true)
  learn?: boolean;       // record pattern to learner (default: true)
}

export class FreeLang {
  private vm = new VM();
  private codegen = new CodeGen();
  private compiler: Compiler;
  private corrector = new Corrector();
  private learner = new Learner();

  constructor(outDir?: string) {
    this.compiler = new Compiler(outDir);
  }

  // ── Main entry point ──
  exec(intent: AIIntent, opts?: ExecOptions): ExecResult {
    const options: Required<ExecOptions> = {
      compile: opts?.compile ?? false,
      run_native: opts?.run_native ?? false,
      auto_correct: opts?.auto_correct ?? true,
      learn: opts?.learn ?? true,
    };

    let vmResult: VMResult;
    let correction: CorrectionResult | undefined;

    // Step 1: Try VM execution
    vmResult = this.vm.run(intent.body);

    // Step 2: Self-correction if failed
    if (!vmResult.ok && options.auto_correct) {
      correction = this.corrector.correct(intent);
      vmResult = correction.final_result;
      if (correction.ok) {
        intent = { ...intent, body: correction.final_body };
      }
    }

    // Step 3: Record to learner
    if (options.learn) {
      this.learner.record(intent, vmResult);
    }

    const result: ExecResult = {
      vm: vmResult,
      correction,
      pattern_success_rate: this.learner.successRate(intent),
    };

    // Step 4: C compilation (optional)
    if (options.compile || options.run_native) {
      const cCode = this.codegen.generate(intent);
      const cr = this.compiler.compile(cCode, intent.fn);
      result.compile = cr;

      // Step 5: Run native binary (optional)
      if (options.run_native && cr.ok && cr.binary_path) {
        result.native = this.compiler.run(cr.binary_path);
      }
    }

    return result;
  }

  // ── Convenience: VM-only execution ──
  run(intent: AIIntent): VMResult {
    return this.vm.run(intent.body);
  }

  // ── Convenience: Generate C code only ──
  toC(intent: AIIntent): string {
    return this.codegen.generate(intent);
  }

  // ── Convenience: Full pipeline (VM + C + native) ──
  full(intent: AIIntent): ExecResult {
    return this.exec(intent, { compile: true, run_native: true });
  }

  // ── Stats ──
  stats(): { patterns: ReturnType<Learner['stats']> } {
    return { patterns: this.learner.stats() };
  }
}
