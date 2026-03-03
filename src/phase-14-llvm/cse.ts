/**
 * Phase 14.4: Common Subexpression Elimination (CSE)
 *
 * Eliminates redundant computations by tracking expressions
 * and reusing previously computed values.
 *
 * Example:
 *   a = x + y;
 *   b = x + y;  // Same expression, reuse 'a'
 *
 * Performance: Reduces code size and eliminates redundant operations
 */

import { Inst, Op } from '../types';

/**
 * Represents a computed expression
 */
interface Expression {
  operator: string;
  operands: string[];
}

/**
 * CSE Result
 */
export interface CSEResult {
  optimized: Inst[];
  eliminated: number; // number of redundant expressions eliminated
}

/**
 * Generate a unique key for an expression
 */
function expressionKey(expr: Expression): string {
  const sorted = [...expr.operands].sort();
  return `${expr.operator}(${sorted.join(',')})`;
}

/**
 * Check if two operands are equal (handles variable names and literals)
 */
function operandsEqual(a: any, b: any): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b;
  }
  return false;
}

/**
 * Extract expression from stack-based IR pattern
 * Pattern: PUSH a, PUSH b, BINOP → Expression(BINOP, [a, b])
 */
function extractBinaryExpression(instrs: Inst[], idx: number): Expression | null {
  // Look backwards for PUSH instructions
  if (idx < 2) return null;

  const opInstr = instrs[idx];
  const isBinOp =
    opInstr.op === Op.ADD ||
    opInstr.op === Op.SUB ||
    opInstr.op === Op.MUL ||
    opInstr.op === Op.DIV ||
    opInstr.op === Op.MOD ||
    opInstr.op === Op.EQ ||
    opInstr.op === Op.NEQ ||
    opInstr.op === Op.LT ||
    opInstr.op === Op.GT ||
    opInstr.op === Op.LTE ||
    opInstr.op === Op.GTE;

  if (!isBinOp) return null;

  // Try to find PUSH b (at idx-1) and PUSH a (at idx-2)
  const pushB = instrs[idx - 1];
  const pushA = instrs[idx - 2];

  if (pushB?.op !== Op.PUSH || pushA?.op !== Op.PUSH) {
    return null;
  }

  const opStr = Op[opInstr.op];
  const operands = [String(pushA.arg), String(pushB.arg)];

  return {
    operator: opStr,
    operands
  };
}

/**
 * CSE optimization: track expressions and eliminate redundant ones
 */
export function runCSE(instrs: Inst[]): CSEResult {
  const optimized: Inst[] = [];
  const expressionMap: Map<string, string> = new Map(); // expr key → variable name
  let eliminated = 0;

  // Track variables that store expressions
  const varExprMap: Map<string, Expression> = new Map();

  for (let i = 0; i < instrs.length; i++) {
    const instr = instrs[i];

    // Check for binary operation pattern: PUSH a, PUSH b, BINOP, STORE result
    if (
      instr.op === Op.ADD ||
      instr.op === Op.SUB ||
      instr.op === Op.MUL ||
      instr.op === Op.DIV ||
      instr.op === Op.MOD ||
      instr.op === Op.EQ ||
      instr.op === Op.NEQ ||
      instr.op === Op.LT ||
      instr.op === Op.GT ||
      instr.op === Op.LTE ||
      instr.op === Op.GTE
    ) {
      const expr = extractBinaryExpression(instrs, i);

      if (expr) {
        const exprKey = expressionKey(expr);
        const nextInstr = i + 1 < instrs.length ? instrs[i + 1] : null;

        // If next instruction is STORE, this computes and stores the expression
        if (nextInstr?.op === Op.STORE) {
          const varName = nextInstr.arg as string;

          // Check if we've seen this expression before
          if (expressionMap.has(exprKey)) {
            // Reuse previous computation
            const prevVar = expressionMap.get(exprKey)!;

            // Instead of: PUSH a, PUSH b, BINOP, STORE result
            // Use: PUSH prevVar, STORE result
            optimized.push({
              op: Op.PUSH,
              arg: prevVar
            });
            optimized.push({
              op: Op.STORE,
              arg: varName
            });

            eliminated++;
            i += 3; // Skip the original instructions (2 PUSH + 1 BINOP + 1 STORE)
            continue;
          } else {
            // First time seeing this expression
            expressionMap.set(exprKey, varName);
            varExprMap.set(varName, expr);
          }
        }
      }
    }

    // Copy instruction as-is
    optimized.push(instr);
  }

  return {
    optimized,
    eliminated
  };
}

/**
 * Advanced CSE: Handle LOAD/STORE patterns
 * Tracks variable value equivalence
 */
export function runAdvancedCSE(instrs: Inst[]): CSEResult {
  const optimized: Inst[] = [];
  const valueMap: Map<string, string> = new Map(); // var → equivalent var
  let eliminated = 0;

  for (let i = 0; i < instrs.length; i++) {
    const instr = instrs[i];

    if (instr.op === Op.STORE) {
      const targetVar = instr.arg as string;

      // Look backwards for what was pushed
      if (i > 0 && instrs[i - 1].op === Op.PUSH) {
        const sourceVal = String(instrs[i - 1].arg);

        // Check if sourceVal is already a stored variable
        if (valueMap.has(sourceVal)) {
          const equivalentVar = valueMap.get(sourceVal)!;
          valueMap.set(targetVar, equivalentVar);
        } else {
          valueMap.set(targetVar, sourceVal);
        }
      }
    }

    if (instr.op === Op.LOAD) {
      const varName = instr.arg as string;

      // Check if this variable has an equivalent
      if (valueMap.has(varName)) {
        const equivalent = valueMap.get(varName)!;

        // If equivalent is another variable (not a literal)
        if (isNaN(Number(equivalent))) {
          // Replace LOAD varName with LOAD equivalent
          const optimizedInstr: Inst = {
            op: Op.LOAD,
            arg: equivalent
          };
          optimized.push(optimizedInstr);
          eliminated++;
          continue;
        }
      }
    }

    optimized.push(instr);
  }

  return {
    optimized,
    eliminated
  };
}

/**
 * Convenience function: run full CSE optimization
 */
export function optimizeCSE(instrs: Inst[]): Inst[] {
  // Run basic CSE first
  const step1 = runCSE(instrs);

  // Then run advanced CSE on the result
  const step2 = runAdvancedCSE(step1.optimized);

  return step2.optimized;
}
