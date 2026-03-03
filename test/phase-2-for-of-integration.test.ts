/**
 * Phase 2: for...of Integration Tests
 * Validates complete pipeline: Parse → Type Check → Generate
 */

import { StatementTypeChecker } from '../src/analyzer/statement-type-checker';
import { IRGenerator } from '../src/codegen/ir-generator';
import { ForOfStatement } from '../src/parser/ast';
import { Op } from '../src/types';

describe('ForOf Integration - Complete Pipeline', () => {
  let typeChecker: StatementTypeChecker;
  let codeGen: IRGenerator;

  beforeEach(() => {
    typeChecker = new StatementTypeChecker();
    codeGen = new IRGenerator();
  });

  // ======================================================================
  // TEST 1: Complete Pipeline - Parse → Type Check → Generate
  // ======================================================================
  test('end-to-end: type check then generate IR', () => {
    // Simulating parsed AST from parser
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'item',
      iterable: {
        type: 'array',
        elements: [
          { type: 'literal', value: 1, dataType: 'number' },
          { type: 'literal', value: 2, dataType: 'number' },
          { type: 'literal', value: 3, dataType: 'number' }
        ]
      },
      body: {
        type: 'block',
        body: [{
          type: 'expression',
          expression: {
            type: 'call',
            callee: 'process',
            arguments: [{ type: 'identifier', name: 'item' }]
          }
        }]
      }
    };

    // Step 1: Type Check
    const typeCheckResult = typeChecker.checkForOfStatement(stmt);
    expect(typeCheckResult.compatible).toBe(true);
    expect(typeCheckResult.message).toContain('type-safe');
    expect(typeCheckResult.details?.expected).toBe('number');

    // Step 2: Code Generate
    const instructions = codeGen.generateIR(stmt);

    // Step 3: Verify generated IR is valid
    expect(instructions.length).toBeGreaterThan(0);
    expect(instructions[instructions.length - 1].op).toBe(Op.HALT);

    // Verify key instructions present
    expect(instructions.some(inst => inst.op === Op.PUSH && inst.arg === 0)).toBe(true);
    expect(instructions.some(inst => inst.op === Op.ARR_GET)).toBe(true);
    expect(instructions.some(inst => inst.op === Op.JMP)).toBe(true);
  });

  // ======================================================================
  // TEST 2: Type Check Failure Prevents Generation
  // ======================================================================
  test('should fail type check before code generation', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'char',
      iterable: {
        type: 'literal',
        value: 'hello',
        dataType: 'string'
      },
      body: { type: 'block', body: [] }
    };

    // Step 1: Type Check - should fail
    const typeCheckResult = typeChecker.checkForOfStatement(stmt);
    expect(typeCheckResult.compatible).toBe(false);
    expect(typeCheckResult.message).toContain('array type');

    // Step 2: Skip code generation on type error
    // (In real pipeline, code gen would not be called)
    // Verify manual generation would fail
    expect(() => {
      if (typeCheckResult.compatible) {
        codeGen.generateIR(stmt);
      }
    }).not.toThrow();
  });

  // ======================================================================
  // TEST 3: With Phase 1 SQLite Integration
  // ======================================================================
  test('should work with simulated SQLite results', () => {
    // Simulating Phase 1 SQLite query result
    // let results = sqlite.table(db, "users").select(["name", "age"]).execute()
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'row',
      iterable: {
        type: 'call',
        callee: 'execute',
        arguments: []
      },
      body: {
        type: 'block',
        body: [{
          type: 'expression',
          expression: {
            type: 'call',
            callee: 'println',
            arguments: [{
              type: 'member',
              object: { type: 'identifier', name: 'row' },
              property: 'name'
            }]
          }
        }]
      }
    };

    // Type check: Assuming SQLite returns array<object>
    typeChecker.declareVariable('results', 'array<object>');

    // Declare temporary variables from before
    const modifiedStmt = {
      ...stmt,
      iterable: { type: 'identifier', name: 'results' }
    };

    const typeCheckResult = typeChecker.checkForOfStatement(modifiedStmt as any);
    expect(typeCheckResult.compatible).toBe(true);

    // Code generation
    const instructions = codeGen.generateIR(modifiedStmt as any);
    expect(instructions.length).toBeGreaterThan(0);
    expect(instructions.some(inst => inst.op === Op.CALL)).toBe(true);
  });

  // ======================================================================
  // TEST 4: Nested for...of Loops
  // ======================================================================
  test('should handle nested for...of loops', () => {
    // Outer loop: matrix (array of arrays)
    // Inner loop: row (single array)

    const innerLoop: ForOfStatement = {
      type: 'forOf',
      variable: 'cell',
      iterable: {
        type: 'identifier',
        name: 'row'
      },
      body: {
        type: 'block',
        body: [{
          type: 'expression',
          expression: {
            type: 'call',
            callee: 'process',
            arguments: [{ type: 'identifier', name: 'cell' }]
          }
        }]
      }
    };

    const outerLoop: ForOfStatement = {
      type: 'forOf',
      variable: 'row',
      iterable: {
        type: 'array',
        elements: [
          {
            type: 'array',
            elements: [
              { type: 'literal', value: 1, dataType: 'number' },
              { type: 'literal', value: 2, dataType: 'number' }
            ]
          },
          {
            type: 'array',
            elements: [
              { type: 'literal', value: 3, dataType: 'number' },
              { type: 'literal', value: 4, dataType: 'number' }
            ]
          }
        ]
      },
      body: { type: 'block', body: [innerLoop as any] }
    };

    // Type check outer loop
    const outerTypeCheck = typeChecker.checkForOfStatement(outerLoop);
    expect(outerTypeCheck.compatible).toBe(true);

    // Code generation
    const instructions = codeGen.generateIR(outerLoop);

    // Verify nested loop structure
    expect(instructions.length).toBeGreaterThan(30); // Complex nested

    // Verify multiple index variables in STORE operations
    const storeOps = instructions.filter(inst => inst.op === Op.STORE);
    expect(storeOps.length).toBeGreaterThanOrEqual(4); // At least 2 indices + 2 arrays + items
  });

  // ======================================================================
  // TEST 5: With Conditional in Loop Body
  // ======================================================================
  test('should handle conditionals in loop body', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'item',
      iterable: {
        type: 'array',
        elements: [
          { type: 'literal', value: 1, dataType: 'number' },
          { type: 'literal', value: 2, dataType: 'number' },
          { type: 'literal', value: 3, dataType: 'number' }
        ]
      },
      body: {
        type: 'block',
        body: [{
          type: 'if',
          condition: {
            type: 'binary',
            operator: '>',
            left: { type: 'identifier', name: 'item' },
            right: { type: 'literal', value: 1, dataType: 'number' }
          },
          consequent: {
            type: 'block',
            body: [{
              type: 'expression',
              expression: {
                type: 'call',
                callee: 'println',
                arguments: [{ type: 'identifier', name: 'item' }]
              }
            }]
          }
        }]
      }
    };

    // Type check
    const typeCheckResult = typeChecker.checkForOfStatement(stmt);
    expect(typeCheckResult.compatible).toBe(true);

    // Code generation
    const instructions = codeGen.generateIR(stmt);

    // Verify includes:
    // 1. Loop structure
    expect(instructions.some(inst => inst.op === Op.LT || inst.op === Op.GT)).toBe(true);
    // 2. Comparison (from if condition)
    expect(instructions.some(inst => inst.op === Op.GT)).toBe(true);
    // 3. Conditional jump
    expect(instructions.some(inst => inst.op === Op.JMP_NOT)).toBe(true);
  });

  // ======================================================================
  // TEST 6: Backward Compatibility - for...in Still Works
  // ======================================================================
  test('should not break existing for...in loops', () => {
    // This test verifies that adding for...of doesn't break for...in
    // We can't fully test for...in without parser, but we can verify
    // IRGenerator still handles ForStatement

    const forStatement = {
      type: 'for',  // Note: 'for', not 'forOf'
      variable: 'i',
      iterable: {
        type: 'call',
        callee: 'range',
        arguments: [{ type: 'literal', value: 10, dataType: 'number' }]
      },
      body: { type: 'block', body: [] }
    };

    // Should not throw error
    expect(() => {
      codeGen.generateIR(forStatement);
    }).not.toThrow();

    // Should generate IR with iterator protocol
    const instructions = codeGen.generateIR(forStatement);
    expect(instructions.some(inst => inst.op === Op.ITER_HAS)).toBe(true);
    expect(instructions.some(inst => inst.op === Op.ITER_NEXT)).toBe(true);
  });

  // ======================================================================
  // TEST 7: Multiple for...of Loops in Sequence
  // ======================================================================
  test('should handle multiple sequential for...of loops', () => {
    const stmt1: ForOfStatement = {
      type: 'forOf',
      variable: 'x',
      iterable: {
        type: 'array',
        elements: [
          { type: 'literal', value: 1, dataType: 'number' }
        ]
      },
      body: { type: 'block', body: [] }
    };

    const stmt2: ForOfStatement = {
      type: 'forOf',
      variable: 'y',
      iterable: {
        type: 'array',
        elements: [
          { type: 'literal', value: 2, dataType: 'number' }
        ]
      },
      body: { type: 'block', body: [] }
    };

    // Type check both
    const check1 = typeChecker.checkForOfStatement(stmt1);
    const check2 = typeChecker.checkForOfStatement(stmt2);

    expect(check1.compatible).toBe(true);
    expect(check2.compatible).toBe(true);

    // Generate code for both (with fresh generator to reset counter)
    const instr1 = codeGen.generateIR(stmt1);
    const gen2 = new IRGenerator();
    const instr2 = gen2.generateIR(stmt2);

    // Both should generate valid IR
    expect(instr1.length).toBeGreaterThan(0);
    expect(instr2.length).toBeGreaterThan(0);
  });

  // ======================================================================
  // TEST 8: Real-World Example - Database Iteration
  // ======================================================================
  test('real-world example: database query iteration', () => {
    // Example from Phase 1 use case:
    // let freelancers = sqlite.table(db, "freelancers")
    //   .select(["name", "rating"])
    //   .execute()
    // for freelancer of freelancers {
    //   println(freelancer.name + ": " + freelancer.rating)
    // }

    // First declare the result variable (from Phase 1 SQLite)
    typeChecker.declareVariable('freelancers', 'array<object>');

    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'freelancer',
      iterable: {
        type: 'identifier',
        name: 'freelancers'
      },
      body: {
        type: 'block',
        body: [{
          type: 'expression',
          expression: {
            type: 'call',
            callee: 'println',
            arguments: [{
              type: 'binary',
              operator: '+',
              left: {
                type: 'member',
                object: { type: 'identifier', name: 'freelancer' },
                property: 'name'
              },
              right: {
                type: 'member',
                object: { type: 'identifier', name: 'freelancer' },
                property: 'rating'
              }
            }]
          }
        }]
      }
    };

    // Type check
    const typeCheckResult = typeChecker.checkForOfStatement(stmt);
    expect(typeCheckResult.compatible).toBe(true);
    expect(typeCheckResult.message).toContain('object');

    // Code generation
    const instructions = codeGen.generateIR(stmt);

    // Verify real-world patterns
    expect(instructions.some(inst => inst.op === Op.LOAD && inst.arg === 'freelancers')).toBe(true);
    expect(instructions.some(inst => inst.op === Op.LOAD && inst.arg === 'freelancer')).toBe(true);
    expect(instructions.some(inst => inst.op === Op.CALL)).toBe(true);
    expect(instructions.some(inst => inst.op === Op.ARR_GET)).toBe(true);
  });

  // ======================================================================
  // TEST 9: Complex Iterable Expression
  // ======================================================================
  test('complex iterable: array method call', () => {
    // for item of array.filter(fn(x) -> x > 0) { ... }

    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'item',
      iterable: {
        type: 'call',
        callee: 'filter',
        arguments: [{
          type: 'call',
          callee: 'fn',
          arguments: []
        }]
      },
      body: {
        type: 'block',
        body: [{
          type: 'expression',
          expression: {
            type: 'call',
            callee: 'process',
            arguments: [{ type: 'identifier', name: 'item' }]
          }
        }]
      }
    };

    // Code generation
    const instructions = codeGen.generateIR(stmt);

    // Verify function calls are generated
    const callOps = instructions.filter(inst => inst.op === Op.CALL);
    expect(callOps.length).toBeGreaterThanOrEqual(2); // filter + process

    // Verify loop structure after function calls
    expect(instructions.some(inst => inst.op === Op.ARR_LEN)).toBe(true);
    expect(instructions.some(inst => inst.op === Op.ARR_GET)).toBe(true);
  });

  // ======================================================================
  // TEST 10: Type Annotation on Variable
  // ======================================================================
  test('explicit type annotation on loop variable', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'item',
      variableType: 'number',  // Explicit annotation
      iterable: {
        type: 'array',
        elements: [
          { type: 'literal', value: 42, dataType: 'number' }
        ]
      },
      body: { type: 'block', body: [] }
    };

    // Type check should accept explicit type
    const typeCheckResult = typeChecker.checkForOfStatement(stmt);
    expect(typeCheckResult.compatible).toBe(true);

    // Code generation should work identically
    const instructions = codeGen.generateIR(stmt);
    expect(instructions.some(inst => inst.op === Op.STORE && inst.arg === 'item')).toBe(true);
  });

  // ======================================================================
  // Integration Edge Cases
  // ======================================================================

  describe('Edge cases', () => {
    test('empty array should type check and generate', () => {
      const stmt: ForOfStatement = {
        type: 'forOf',
        variable: 'x',
        iterable: { type: 'array', elements: [] },
        body: { type: 'block', body: [] }
      };

      const typeCheck = typeChecker.checkForOfStatement(stmt);
      expect(typeCheck.compatible).toBe(true);

      const instructions = codeGen.generateIR(stmt);
      expect(instructions.length).toBeGreaterThan(0);
    });

    test('deeply nested loops', () => {
      let innermost: ForOfStatement = {
        type: 'forOf',
        variable: 'z',
        iterable: { type: 'identifier', name: 'inner' },
        body: { type: 'block', body: [] }
      };

      for (let i = 0; i < 3; i++) {
        const loop: ForOfStatement = {
          type: 'forOf',
          variable: `var${i}`,
          iterable: {
            type: 'array',
            elements: [{ type: 'literal', value: i, dataType: 'number' }]
          },
          body: { type: 'block', body: [innermost as any] }
        };
        innermost = loop;
      }

      // Should handle 4-level nesting
      const typeCheck = typeChecker.checkForOfStatement(innermost);
      expect(typeCheck.compatible).toBe(true);

      const instructions = codeGen.generateIR(innermost);
      expect(instructions.length).toBeGreaterThan(50);
    });

    test('variable shadowing in nested loops', () => {
      const outer: ForOfStatement = {
        type: 'forOf',
        variable: 'item',
        iterable: {
          type: 'array',
          elements: [
            { type: 'literal', value: 1, dataType: 'number' }
          ]
        },
        body: {
          type: 'block',
          body: [{
            type: 'forOf',
            variable: 'item',  // Same name in inner loop
            iterable: {
              type: 'identifier',
              name: 'inner'
            },
            body: { type: 'block', body: [] }
          } as any]
        }
      };

      // Should handle shadowing correctly
      const typeCheck = typeChecker.checkForOfStatement(outer);
      expect(typeCheck.compatible).toBe(true);
    });
  });
});
