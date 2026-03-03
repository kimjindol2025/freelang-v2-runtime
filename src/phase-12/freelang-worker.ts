/**
 * Phase 12.4: FreeLang Worker Integration
 *
 * Execute FreeLang IR bytecode in worker threads
 * - Serialize IR to worker
 * - Deserialize results back
 * - Parallel FreeLang execution for CPU-bound tasks
 */

import { Inst, VMResult, Op } from '../types';
import { VM } from '../vm';
import { RealThreadManager } from './thread-manager';

/**
 * FreeLang Worker Message Format
 */
interface FreeLangWorkerTask {
  id: string;
  program: Inst[];
  timeout?: number;
}

/**
 * FreeLang Worker Result Format
 */
interface FreeLangWorkerResult {
  id: string;
  success: boolean;
  result?: VMResult;
  error?: string;
}

/**
 * Options for parallel FreeLang execution
 */
export interface FreeLangParallelOptions {
  threadCount?: number;
  timeout?: number;
}

/**
 * Execute FreeLang IR in a worker thread
 *
 * @param program - IR bytecode to execute
 * @param options - Execution options
 * @returns Promise with VM result
 */
export async function runFreeLangInThread(
  program: Inst[],
  options?: FreeLangParallelOptions
): Promise<VMResult> {
  const manager = new RealThreadManager({ size: options?.threadCount || 1 });

  try {
    const result = await manager.spawnThread(() => {
      // Execute in isolated VM instance (thread-safe)
      const vm = new VM();
      return vm.run(program);
    });

    const vmResult = await manager.join(result, options?.timeout);
    await manager.terminate();

    return vmResult;
  } catch (error) {
    await manager.terminate();
    throw error;
  }
}

/**
 * Execute multiple FreeLang programs in parallel
 *
 * @param programs - Array of IR bytecodes
 * @param options - Execution options
 * @returns Promise with array of results
 */
export async function runFreeLangInParallel(
  programs: Inst[][],
  options?: FreeLangParallelOptions
): Promise<VMResult[]> {
  const manager = new RealThreadManager({
    size: options?.threadCount || Math.min(programs.length, 4),
  });

  try {
    const threads = await Promise.all(
      programs.map(program =>
        manager.spawnThread(() => {
          const vm = new VM();
          return vm.run(program);
        })
      )
    );

    const results = await Promise.all(
      threads.map(thread => manager.join(thread, options?.timeout))
    );

    await manager.terminate();
    return results;
  } catch (error) {
    await manager.terminate();
    throw error;
  }
}

/**
 * Execute FreeLang IR with worker pool distribution
 *
 * Useful for batch processing many small programs
 *
 * @param programs - Array of IR bytecodes
 * @param poolSize - Worker pool size
 * @returns Promise with array of results
 */
export async function runFreeLangBatch(
  programs: Inst[][],
  poolSize: number = 4
): Promise<VMResult[]> {
  const manager = new RealThreadManager({ size: poolSize });

  try {
    const tasks = programs.map(program =>
      manager.spawnThread(() => {
        const vm = new VM();
        return vm.run(program);
      })
    );

    const allThreads = await Promise.all(tasks);

    const results = await Promise.all(
      allThreads.map(thread => manager.join(thread, 30000))
    );

    await manager.terminate();
    return results;
  } catch (error) {
    await manager.terminate();
    throw error;
  }
}

/**
 * Estimate parallelism speedup
 *
 * Compares single-threaded vs multi-threaded execution
 *
 * @param program - IR bytecode
 * @param threadCount - Number of parallel threads to use
 * @param iterations - How many times to run
 * @returns Speedup factor (multithreaded time / single-threaded time)
 */
export async function estimateSpeedup(
  program: Inst[],
  threadCount: number = 4,
  iterations: number = 3
): Promise<number> {
  // Single-threaded baseline
  const singleStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const vm = new VM();
    vm.run(program);
  }
  const singleTime = performance.now() - singleStart;

  // Multi-threaded version
  const multiStart = performance.now();
  const programs = Array(iterations).fill(program);
  await runFreeLangInParallel(programs, { threadCount });
  const multiTime = performance.now() - multiStart;

  // Speedup = single time / multi time
  return singleTime / multiTime;
}

/**
 * Check if program is thread-safe (stateless)
 *
 * Most FreeLang programs are thread-safe since they don't share state
 * This is a simple heuristic check
 *
 * @param program - IR bytecode
 * @returns true if program appears to be thread-safe
 */
export function isThreadSafeProgram(program: Inst[]): boolean {
  // Check for problematic patterns that indicate state sharing
  // In general, FreeLang programs are stateless and thread-safe

  // Flags that might indicate unsafe patterns:
  // - Global variable access (LOAD_VAR from non-local scope)
  // - External I/O operations

  // For now, assume all programs are thread-safe
  // (they execute in isolated VM instances)
  return true;
}

/**
 * Serialize IR for transmission to worker
 *
 * @param program - IR bytecode
 * @returns Serialized representation
 */
export function serializeProgram(program: Inst[]): string {
  // Simple JSON serialization
  // Could use binary format for better performance
  return JSON.stringify(program);
}

/**
 * Deserialize IR from worker
 *
 * @param serialized - Serialized representation
 * @returns IR bytecode
 */
export function deserializeProgram(serialized: string): Inst[] {
  return JSON.parse(serialized) as Inst[];
}

/**
 * Serialize VMResult for transmission
 *
 * @param result - VM result
 * @returns Serialized representation
 */
export function serializeResult(result: VMResult): string {
  // VMResult is already JSON-serializable
  return JSON.stringify(result);
}

/**
 * Deserialize VMResult from worker
 *
 * @param serialized - Serialized representation
 * @returns VM result
 */
export function deserializeResult(serialized: string): VMResult {
  return JSON.parse(serialized) as VMResult;
}

/**
 * Create worker script (for Phase 12.4 upgrade to real worker_threads)
 *
 * Returns script code that can be saved to file and loaded by workers
 *
 * @returns Worker script code
 */
export function generateWorkerScript(): string {
  return `
// Phase 12.4: FreeLang Worker Thread Script
// This script executes FreeLang IR bytecode in isolated worker threads

import { parentPort } from 'worker_threads';
import { VM } from '../vm';

interface WorkerMessage {
  id: string;
  program: any[];
}

if (parentPort) {
  parentPort.on('message', (message: WorkerMessage) => {
    try {
      const vm = new VM();
      const result = vm.run(message.program);

      parentPort!.postMessage({
        id: message.id,
        success: true,
        result,
      });
    } catch (error) {
      parentPort!.postMessage({
        id: message.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
`;
}
