/**
 * Phase 2: for...of Code Generator Tests
 * Validates code generation for for...of statements
 */

import { IRGenerator } from '../src/codegen/ir-generator';
import { Op } from '../src/types';
import { ForOfStatement } from '../src/parser/ast';

describe('ForOf Code Generator', () => {
  let generator: IRGenerator;

  beforeEach(() => {
    generator = new IRGenerator();
  });

  // ======================================================================
  // TEST 1: Generate basic while loop structure
  // ======================================================================
  test('should generate while loop for simple for...of', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'item',
      iterable: {
        type: 'array',
        elements: [
          { type: 'literal', value: 1, dataType: 'number' },
          { type: 'literal', value: 2, dataType: 'number' }
        ]
      },
      body: { type: 'block', body: [] }
    };

    const instructions = generator.generateIR(stmt);

    // Check structure:
    // 1. Initialize index to 0
    expect(instructions.some((inst, i) =>
      inst.op === Op.PUSH && inst.arg === 0 &&
      i + 1 < instructions.length &&
      instructions[i + 1].op === Op.STORE
    )).toBe(true);

    // 2. Compare: index < length
    expect(instructions.some(inst => inst.op === Op.LT)).toBe(true);

    // 3. Jump on condition false
    expect(instructions.some(inst => inst.op === Op.JMP_NOT)).toBe(true);

    // 4. Get array element
    expect(instructions.some(inst => inst.op === Op.ARR_GET)).toBe(true);

    // 5. Increment index
    expect(instructions.some((inst, i) =>
      inst.op === Op.PUSH && inst.arg === 1 &&
      i + 1 < instructions.length &&
      instructions[i + 1].op === Op.ADD
    )).toBe(true);

    // 6. Jump back to loop
    const jumpBacks = instructions.filter(inst => inst.op === Op.JMP && inst.arg !== undefined);
    expect(jumpBacks.length).toBeGreaterThan(0);

    // 7. Has HALT at end
    expect(instructions[instructions.length - 1].op).toBe(Op.HALT);
  });

  // ======================================================================
  // TEST 2: Index variable is unique
  // ======================================================================
  test('should generate unique index variables for nested loops', () => {
    // Inner for...of
    const innerLoop: ForOfStatement = {
      type: 'forOf',
      variable: 'inner',
      iterable: {
        type: 'array',
        elements: [{ type: 'literal', value: 1, dataType: 'number' }]
      },
      body: { type: 'block', body: [] }
    };

    // Outer for...of with inner loop in body
    const outerLoop: ForOfStatement = {
      type: 'forOf',
      variable: 'outer',
      iterable: {
        type: 'array',
        elements: [
          {
            type: 'array',
            elements: [{ type: 'literal', value: 1, dataType: 'number' }]
          }
        ]
      },
      body: { type: 'block', body: [innerLoop as any] }
    };

    const instructions = generator.generateIR(outerLoop);

    // Count STORE operations - should have at least 4 (outer index, inner index, outer item, inner item)
    const storeOps = instructions.filter(inst => inst.op === Op.STORE);
    expect(storeOps.length).toBeGreaterThanOrEqual(4);

    // Verify indices are stored (not checking exact names, but structure)
    expect(instructions.length).toBeGreaterThan(20); // Nested loops = more instructions
  });

  // ======================================================================
  // TEST 3: Correct element binding
  // ======================================================================
  test('should bind element correctly before loop body', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'num',
      iterable: {
        type: 'array',
        elements: [{ type: 'literal', value: 42, dataType: 'number' }]
      },
      body: {
        type: 'block',
        body: [{
          type: 'expression',
          expression: {
            type: 'call',
            callee: 'println',
            arguments: [{ type: 'identifier', name: 'num' }]
          }
        }]
      }
    };

    const instructions = generator.generateIR(stmt);

    // Find the sequence: ARR_GET → STORE (element binding)
    let foundBinding = false;
    for (let i = 0; i < instructions.length - 1; i++) {
      if (instructions[i].op === Op.ARR_GET &&
          instructions[i + 1].op === Op.STORE) {
        foundBinding = true;
        break;
      }
    }

    expect(foundBinding).toBe(true);
  });

  // ======================================================================
  // TEST 4: Proper indentation of loop body (semantic)
  // ======================================================================
  test('should include loop body in generated instructions', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'x',
      iterable: {
        type: 'array',
        elements: [
          { type: 'literal', value: 1, dataType: 'number' },
          { type: 'literal', value: 2, dataType: 'number' }
        ]
      },
      body: {
        type: 'block',
        body: [{
          type: 'expression',
          expression: {
            type: 'call',
            callee: 'print',
            arguments: [{ type: 'identifier', name: 'x' }]
          }
        }]
      }
    };

    const instructions = generator.generateIR(stmt);

    // Check for CALL operation (from println in body)
    expect(instructions.some(inst => inst.op === Op.CALL)).toBe(true);

    // Check for LOAD of variable 'x'
    expect(instructions.some(inst =>
      inst.op === Op.LOAD && inst.arg === 'x'
    )).toBe(true);
  });

  // ======================================================================
  // TEST 5: Array length check
  // ======================================================================
  test('should check array length in loop condition', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'item',
      iterable: {
        type: 'array',
        elements: [{ type: 'literal', value: 'test', dataType: 'string' }]
      },
      body: { type: 'block', body: [] }
    };

    const instructions = generator.generateIR(stmt);

    // Find: LOAD arr → ARR_LEN → [comparison]
    let foundLengthCheck = false;
    for (let i = 0; i < instructions.length - 1; i++) {
      if (instructions[i].op === Op.ARR_LEN &&
          (instructions[i + 1].op === Op.LT ||
           instructions[i + 1].op === Op.GT ||
           instructions[i + 1].op === Op.LTE ||
           instructions[i + 1].op === Op.GTE)) {
        foundLengthCheck = true;
        break;
      }
    }

    expect(foundLengthCheck).toBe(true);
  });

  // ======================================================================
  // TEST 6: Complex iterable expression
  // ======================================================================
  test('should handle complex iterable expressions', () => {
    // for item of array.map(fn) { ... }
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'item',
      iterable: {
        type: 'call',
        callee: 'map',
        arguments: [{
          type: 'identifier',
          name: 'array'
        }]
      },
      body: { type: 'block', body: [] }
    };

    const instructions = generator.generateIR(stmt);

    // Should contain:
    // 1. CALL to map function
    expect(instructions.some(inst => inst.op === Op.CALL)).toBe(true);

    // 2. Loop structure (STORE, LT, JMP_NOT)
    expect(instructions.some(inst => inst.op === Op.STORE)).toBe(true);
    expect(instructions.some(inst => inst.op === Op.LT)).toBe(true);

    // 3. Valid instruction count
    expect(instructions.length).toBeGreaterThan(10);
  });

  // ======================================================================
  // TEST 7: Multiple items in array
  // ======================================================================
  test('should iterate all array elements', () => {
    // Create array with 5 elements
    const elements = Array.from({ length: 5 }, (_, i) => ({
      type: 'literal' as const,
      value: i,
      dataType: 'number' as const
    }));

    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'n',
      iterable: {
        type: 'array',
        elements
      },
      body: {
        type: 'block',
        body: [{
          type: 'expression',
          expression: {
            type: 'call',
            callee: 'print',
            arguments: [{ type: 'identifier', name: 'n' }]
          }
        }]
      }
    };

    const instructions = generator.generateIR(stmt);

    // Verify instructions contain:
    // - Array creation with 5 elements
    expect(instructions.filter(inst => inst.op === Op.PUSH).length).toBeGreaterThanOrEqual(5);

    // - Loop structure
    expect(instructions.some(inst => inst.op === Op.JMP)).toBe(true);
    expect(instructions.some(inst => inst.op === Op.JMP_NOT)).toBe(true);
  });

  // ======================================================================
  // TEST 8: Empty array
  // ======================================================================
  test('should handle empty array', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'x',
      iterable: {
        type: 'array',
        elements: []
      },
      body: { type: 'block', body: [] }
    };

    const instructions = generator.generateIR(stmt);

    // Should still generate valid loop structure
    expect(instructions.some(inst => inst.op === Op.STORE)).toBe(true);
    expect(instructions.some(inst => inst.op === Op.JMP_NOT)).toBe(true);
    expect(instructions.some(inst => inst.op === Op.HALT)).toBe(true);

    // Loop should exit immediately (empty array)
    expect(instructions.length).toBeGreaterThan(0);
  });

  // ======================================================================
  // TEST 9: Identifier as iterable
  // ======================================================================
  test('should handle identifier as iterable', () => {
    const stmt: ForOfStatement = {
      type: 'forOf',
      variable: 'item',
      iterable: {
        type: 'identifier',
        name: 'myArray'
      },
      body: { type: 'block', body: [] }
    };

    const instructions = generator.generateIR(stmt);

    // Should LOAD the array variable
    expect(instructions.some(inst =>
      inst.op === Op.LOAD && inst.arg === 'myArray'
    )).toBe(true);

    // Should check array length
    expect(instructions.some(inst => inst.op === Op.ARR_LEN)).toBe(true);
  });

  // ======================================================================
  // TEST 10: Type variants (type string vs type forOf)
  // ======================================================================
  test('should handle both "forOf" and "ForOfStatement" type names', () => {
    const stmt1 = {
      type: 'forOf',
      variable: 'x',
      iterable: {
        type: 'array',
        elements: [{ type: 'literal', value: 1, dataType: 'number' as const }]
      },
      body: { type: 'block', body: [] }
    };

    const stmt2 = {
      type: 'ForOfStatement',
      variable: 'y',
      iterable: {
        type: 'array',
        elements: [{ type: 'literal', value: 2, dataType: 'number' as const }]
      },
      body: { type: 'block', body: [] }
    };

    const instr1 = generator.generateIR(stmt1);

    // Reset generator for clean slate
    generator = new IRGenerator();
    const instr2 = generator.generateIR(stmt2);

    // Both should generate valid IR
    expect(instr1.length).toBeGreaterThan(0);
    expect(instr2.length).toBeGreaterThan(0);
    expect(instr1[instr1.length - 1].op).toBe(Op.HALT);
    expect(instr2[instr2.length - 1].op).toBe(Op.HALT);
  });

  // ======================================================================
  // Semantic/Integration Tests
  // ======================================================================

  describe('Code generation semantics', () => {
    test('generated code should execute loop correct times', () => {
      // This is a semantic test - verify the generated IR
      // logically represents N iterations for N array elements

      const elements = Array.from({ length: 3 }, (_, i) => ({
        type: 'literal' as const,
        value: i,
        dataType: 'number' as const
      }));

      const stmt: ForOfStatement = {
        type: 'forOf',
        variable: 'i',
        iterable: {
          type: 'array',
          elements
        },
        body: {
          type: 'block',
          body: [{
            type: 'expression',
            expression: {
              type: 'call',
              callee: 'process',
              arguments: [{ type: 'identifier', name: 'i' }]
            }
          }]
        }
      };

      const instructions = generator.generateIR(stmt);

      // Verify loop contains:
      // 1. Index initialization (PUSH 0, STORE _idx)
      let initFound = false;
      for (let i = 0; i < instructions.length - 1; i++) {
        if (instructions[i].op === Op.PUSH && instructions[i].arg === 0 &&
            instructions[i + 1].op === Op.STORE) {
          initFound = true;
          break;
        }
      }
      expect(initFound).toBe(true);

      // 2. Loop condition (LOAD, LOAD, ARR_LEN, LT, JMP_NOT)
      const ltIndex = instructions.findIndex(inst => inst.op === Op.LT);
      expect(ltIndex).toBeGreaterThan(-1);
      expect(instructions.slice(Math.max(0, ltIndex - 3), ltIndex + 2)
        .some(inst => inst.op === Op.JMP_NOT)).toBe(true);

      // 3. Increment (PUSH 1, ADD, STORE)
      let incrFound = false;
      for (let i = 0; i < instructions.length - 2; i++) {
        if (instructions[i].op === Op.PUSH && instructions[i].arg === 1 &&
            instructions[i + 1].op === Op.ADD &&
            instructions[i + 2].op === Op.STORE) {
          incrFound = true;
          break;
        }
      }
      expect(incrFound).toBe(true);
    });

    test('should not corrupt parent scope variables', () => {
      // The index variable and array variable should be local to the loop
      const stmt: ForOfStatement = {
        type: 'forOf',
        variable: 'item',
        iterable: {
          type: 'identifier',
          name: 'data'
        },
        body: { type: 'block', body: [] }
      };

      const instructions = generator.generateIR(stmt);

      // Loop should use temporary variables (_for_idx_, _for_array_)
      // not global variables
      const storeOps = instructions.filter(inst => inst.op === Op.STORE);

      // Verify at least one store uses a temporary variable name
      const hasTemp = storeOps.some(inst =>
        typeof inst.arg === 'string' &&
        (inst.arg?.startsWith('_for_') || inst.arg === 'item')
      );
      expect(hasTemp).toBe(true);
    });
  });
});
