// FreeLang v2 - C Compiler bridge
// Calls GCC, returns structured result. No human output.

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { CompileResult } from './types';

const OUT_DIR = join(process.cwd(), '.freelang-ai-out');

export class Compiler {
  private outDir: string;

  constructor(outDir?: string) {
    this.outDir = outDir ?? OUT_DIR;
    if (!existsSync(this.outDir)) {
      mkdirSync(this.outDir, { recursive: true });
    }
  }

  compile(cCode: string, name: string): CompileResult {
    const cPath = join(this.outDir, `${name}.c`);
    const binPath = join(this.outDir, name);

    try {
      writeFileSync(cPath, cCode);
      const output = execSync(`gcc -O2 -o "${binPath}" "${cPath}" -lm 2>&1`, {
        encoding: 'utf-8',
        timeout: 10_000,
      });
      return { ok: true, c_code: cCode, binary_path: binPath, gcc_output: output };
    } catch (e: unknown) {
      const msg = e instanceof Error ? (e as any).stderr ?? e.message : String(e);
      return { ok: false, c_code: cCode, error: msg };
    }
  }

  run(binPath: string): { ok: boolean; stdout: string; exit_code: number } {
    try {
      const stdout = execSync(`"${binPath}"`, { encoding: 'utf-8', timeout: 5_000 });
      return { ok: true, stdout: stdout.trim(), exit_code: 0 };
    } catch (e: unknown) {
      const err = e as any;
      return { ok: false, stdout: err.stdout ?? '', exit_code: err.status ?? 1 };
    }
  }

  compileAndRun(cCode: string, name: string): { compile: CompileResult; run?: { ok: boolean; stdout: string; exit_code: number } } {
    const cr = this.compile(cCode, name);
    if (!cr.ok || !cr.binary_path) return { compile: cr };
    const rr = this.run(cr.binary_path);
    return { compile: cr, run: rr };
  }

  cleanup(name: string): void {
    const cPath = join(this.outDir, `${name}.c`);
    const binPath = join(this.outDir, name);
    try { if (existsSync(cPath)) unlinkSync(cPath); } catch { /* ignore */ }
    try { if (existsSync(binPath)) unlinkSync(binPath); } catch { /* ignore */ }
  }
}
