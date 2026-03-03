/**
 * FreeLang CLI Runner
 * Reads program file, compiles to IR, executes on VM
 */

import * as fs from 'fs';
import * as path from 'path';
import { IRGenerator } from '../codegen/ir-generator';
import { VM } from '../vm';
import { FunctionRegistry } from '../parser/function-registry';
import { FunctionParser } from './parser';
import { Inst, VMResult } from '../types';
import { parseFreeLangExpression } from '../parser/pratt';
import { optimizeIR } from '../phase-14-llvm/llvm-optimizer';

export interface RunResult {
  success: boolean;
  output?: unknown;
  error?: string;
  exitCode: number;
  executionTime: number;
}

/**
 * Remove comments from source code
 */
function removeComments(source: string): string {
  // Remove single-line comments (// ...)
  let result = source.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments (/* ... */)
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  return result;
}

/**
 * Parse FreeLang source code - extract statements after function definitions
 * Uses Pratt Parser for proper operator precedence handling
 */
function parseProgram(source: string): Record<string, any> {
  // Remove comments to avoid parsing errors
  const clean = removeComments(source);
  const trimmed = clean.trim();

  if (!trimmed) {
    throw new Error('Empty program');
  }

  // Use Pratt Parser for expression parsing
  const expr = parseFreeLangExpression(trimmed);
  return expr;
}

/**
 * Compile and run a FreeLang program
 */
export class ProgramRunner {
  private gen: IRGenerator;
  private vm: VM;
  private registry: FunctionRegistry;

  constructor(registry?: FunctionRegistry) {
    this.registry = registry || new FunctionRegistry();
    this.gen = new IRGenerator();
    this.vm = new VM(this.registry);
  }

  /**
   * Get the function registry (for accessing registered functions)
   */
  getRegistry(): FunctionRegistry {
    return this.registry;
  }

  /**
   * Run program from string
   */
  runString(source: string): RunResult {
    const startTime = Date.now();

    try {
      // 1. Parse functions from source
      const parsed = FunctionParser.parseProgram(source);

      // 2. Clear previous functions and register new ones
      this.registry.clear();
      for (const fnDef of parsed.functionDefs) {
        // Register function with body stored as source code
        // The VM will interpret the body when function is called
        this.registry.register({
          type: 'FunctionDefinition',
          name: fnDef.name,
          params: fnDef.params,
          body: fnDef.body as any  // Store body as raw source, not parsed
        });
      }

      // 3. Parse statements (non-function statements)
      // For now, find all statements outside of function definitions
      // Simple approach: Look for statements that are NOT "fn ...{...}"

      let statementsOnly = removeComments(source);

      // Find all function boundaries and remove them
      // Sort by position (descending) so we can remove from end to start
      const fnPositions: Array<{start: number; end: number}> = [];

      for (const fnDef of parsed.functionDefs) {
        const fnKeywordIndex = statementsOnly.indexOf(`fn ${fnDef.name}`);
        if (fnKeywordIndex === -1) continue;

        // Find the opening brace
        let braceStart = statementsOnly.indexOf('{', fnKeywordIndex);
        if (braceStart === -1) continue;

        // Find matching closing brace
        let braceCount = 1;
        let braceEnd = braceStart + 1;
        while (braceEnd < statementsOnly.length && braceCount > 0) {
          if (statementsOnly[braceEnd] === '{') braceCount++;
          else if (statementsOnly[braceEnd] === '}') braceCount--;
          braceEnd++;
        }

        fnPositions.push({
          start: fnKeywordIndex,
          end: braceEnd
        });
      }

      // Remove functions in reverse order
      fnPositions.sort((a, b) => b.start - a.start);
      for (const pos of fnPositions) {
        statementsOnly = statementsOnly.substring(0, pos.start) + ' ' + statementsOnly.substring(pos.end);
      }

      statementsOnly = statementsOnly.trim();

      // If there are statements, parse and execute them
      if (statementsOnly) {
        const ast = parseProgram(statementsOnly) as any;

        // 4. Generate IR
        const rawIR = this.gen.generateIR(ast);

        // 4.5. Optimize IR (Phase-14-llvm pipeline)
        const { optimized: ir, stats: optStats } = optimizeIR(rawIR);

        // 5. Execute on VM
        const result = this.vm.run(ir);

        const executionTime = Date.now() - startTime;

        return {
          success: result.ok,
          output: result.value,
          error: result.error ? `VM Error: ${result.error.detail}` : undefined,
          exitCode: result.ok ? 0 : 1,
          executionTime
        };
      } else {
        // No statements to execute, just return success
        return {
          success: true,
          output: undefined,
          exitCode: 0,
          executionTime: Date.now() - startTime
        };
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `Compilation Error: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 2,
        executionTime
      };
    }
  }

  /**
   * Run program from file
   */
  runFile(filePath: string): RunResult {
    const startTime = Date.now();

    try {
      // 1. Check file exists
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
          exitCode: 3,
          executionTime: Date.now() - startTime
        };
      }

      // 2. Read file
      const source = fs.readFileSync(filePath, 'utf-8');

      // 3. Run program
      return this.runString(source);
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `File Error: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 3,
        executionTime
      };
    }
  }

  /**
   * Get IR for a program (for debugging)
   */
  getIR(source: string): Inst[] {
    const ast = parseProgram(source) as any;
    return this.gen.generateIR(ast);
  }
}
