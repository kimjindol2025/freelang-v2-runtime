// FreeLang v2 - Self-Correction Engine
// AI generates IR → VM runs → error → auto-fix → retry
// No human intervention. Pure machine loop.

import { Op, Inst, AIIntent, VMResult, VMError, CorrectionReport } from './types';
import { VM } from './vm';

const MAX_ATTEMPTS = 5;

export interface CorrectionResult {
  ok: boolean;
  attempts: number;
  final_result: VMResult;
  corrections: CorrectionReport[];
  final_body: Inst[];
}

export class Corrector {
  private vm = new VM();

  correct(intent: AIIntent): CorrectionResult {
    let body = [...intent.body];
    const corrections: CorrectionReport[] = [];

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const result = this.vm.run(body);

      if (result.ok) {
        return { ok: true, attempts: attempt + 1, final_result: result, corrections, final_body: body };
      }

      const error = result.error!;
      const fix = this.applyFix(body, error, intent);

      if (!fix) {
        // Can't auto-fix
        return { ok: false, attempts: attempt + 1, final_result: result, corrections, final_body: body };
      }

      corrections.push({
        attempt: attempt + 1,
        original: [...body],
        error,
        fix_applied: fix.description,
        fixed: fix.body,
      });

      body = fix.body;
    }

    const finalResult = this.vm.run(body);
    return { ok: finalResult.ok, attempts: MAX_ATTEMPTS, final_result: finalResult, corrections, final_body: body };
  }

  private applyFix(body: Inst[], error: VMError, intent: AIIntent): { body: Inst[]; description: string } | null {
    const detail = error.detail;

    // Fix 1: Stack underflow → insert missing PUSH before the operation
    if (detail.startsWith('stack_underflow')) {
      const pc = error.pc;
      if (pc >= 0 && pc < body.length) {
        const newBody = [...body];
        // Insert PUSH 0 before the failing instruction
        newBody.splice(pc, 0, { op: Op.PUSH, arg: 0 });
        return { body: newBody, description: 'insert_push_0_at_' + pc };
      }
    }

    // Fix 2: Division by zero → replace divisor with 1
    if (detail === 'div_zero') {
      const pc = error.pc;
      // Find the PUSH before DIV and change 0 to 1
      for (let i = pc - 1; i >= 0; i--) {
        if (body[i].op === Op.PUSH && body[i].arg === 0) {
          const newBody = [...body];
          newBody[i] = { op: Op.PUSH, arg: 1 };
          return { body: newBody, description: 'fix_div_zero_push_1_at_' + i };
        }
      }
      // Fallback: insert guard
      const newBody = [...body];
      newBody.splice(pc, 0, { op: Op.POP }, { op: Op.PUSH, arg: 1 });
      return { body: newBody, description: 'guard_div_zero_at_' + pc };
    }

    // Fix 3: Undefined variable → initialize it
    if (detail.startsWith('undef_var:')) {
      const varName = detail.split(':')[1];
      const newBody = [{ op: Op.PUSH, arg: 0 }, { op: Op.STORE, arg: varName }, ...body];
      return { body: newBody, description: 'init_var_' + varName };
    }

    // Fix 4: Not array → create empty array
    if (detail.startsWith('not_array:')) {
      const arrName = detail.split(':')[1];
      // Check if it's a param
      const param = intent.params.find(p => p.name === arrName);
      if (param) {
        // Can't fix param type mismatch
        return null;
      }
      const newBody = [{ op: Op.ARR_NEW, arg: arrName }, ...body];
      return { body: newBody, description: 'init_array_' + arrName };
    }

    // Fix 5: Array out of bounds → clamp index
    if (detail.startsWith('oob:')) {
      // Replace ARR_GET with bounds-checked version
      // For now, just return null - complex fix
      return null;
    }

    // Fix 6: Empty array aggregate → add guard
    if (detail.startsWith('empty_arr_')) {
      const pc = error.pc;
      // Insert a check: if arr_len == 0, push 0 and skip
      const newBody = [...body];
      newBody.splice(pc, 1, { op: Op.PUSH, arg: 0 }); // Replace with push 0
      return { body: newBody, description: 'guard_empty_arr_at_' + pc };
    }

    // Fix 7: Stack overflow → remove redundant DUPs
    if (detail === 'stack_overflow') {
      const newBody = body.filter(inst => inst.op !== Op.DUP);
      if (newBody.length < body.length) {
        return { body: newBody, description: 'remove_dups' };
      }
    }

    // Fix 8: Cycle limit → add HALT at reasonable point
    if (detail === 'cycle_limit') {
      // Likely infinite loop - find JMP that causes loop and remove it
      for (let i = body.length - 1; i >= 0; i--) {
        if (body[i].op === Op.JMP && (body[i].arg as number) <= i) {
          const newBody = [...body];
          newBody[i] = { op: Op.HALT };
          return { body: newBody, description: 'break_loop_at_' + i };
        }
      }
    }

    return null; // No fix available
  }
}
