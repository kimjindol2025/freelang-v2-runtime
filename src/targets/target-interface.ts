/**
 * FreeLang Multi-Target Compilation
 *
 * 지원 타겟:
 * 1. Bytecode (스택 VM 바이너리)
 * 2. WASM (WebAssembly)
 * 3. LLVM IR (LLVM 중간 표현)
 */

import { Inst, Op } from '../types';

/**
 * 컴파일 타겟 인터페이스
 */
export interface CompileTarget {
  name: string;
  compile(instrs: Inst[]): string | Uint8Array;
  link(modules: string[]): string;
}

/**
 * Bytecode 타겟 (현재 스택 VM 형식)
 * Inst[] → JSON 또는 바이너리
 */
export class BytecodeTarget implements CompileTarget {
  name: string = 'bytecode';

  /**
   * Inst[] → 바이트코드 (JSON 형식)
   */
  compile(instrs: Inst[]): string {
    return JSON.stringify(instrs, null, 2);
  }

  /**
   * 여러 모듈 링킹
   */
  link(modules: string[]): string {
    const merged: Inst[] = [];

    for (const module of modules) {
      try {
        const instrs = JSON.parse(module);
        merged.push(...instrs);
      } catch (e) {
        throw new Error(`Failed to parse module: ${e}`);
      }
    }

    return JSON.stringify(merged, null, 2);
  }
}

/**
 * WASM 타겟
 * Inst[] → WebAssembly Text (WAT) 형식
 */
export class WASMTarget implements CompileTarget {
  name: string = 'wasm';

  /**
   * Inst[] → WAT (WebAssembly Text Format)
   * 스택 기반 IR → WAT 변환
   */
  compile(instrs: Inst[]): string {
    const lines: string[] = [
      '(module',
      '  (memory 1)',  // 1 페이지 = 64KB
      '  (func $run',
    ];

    let stackDepth = 0;

    for (const instr of instrs) {
      switch (instr.op) {
        case Op.PUSH:
          if (typeof instr.arg === 'number') {
            lines.push(`    i32.const ${instr.arg}`);
          } else if (typeof instr.arg === 'string') {
            // 문자열은 메모리에 저장
            lines.push(`    i32.const 0  ;; string address`);
          }
          stackDepth++;
          break;

        case Op.ADD:
          lines.push('    i32.add');
          stackDepth--;
          break;

        case Op.SUB:
          lines.push('    i32.sub');
          stackDepth--;
          break;

        case Op.MUL:
          lines.push('    i32.mul');
          stackDepth--;
          break;

        case Op.DIV:
          lines.push('    i32.div_s');
          stackDepth--;
          break;

        case Op.MOD:
          lines.push('    i32.rem_s');
          stackDepth--;
          break;

        case Op.EQ:
          lines.push('    i32.eq');
          stackDepth--;
          break;

        case Op.NEQ:
          lines.push('    i32.ne');
          stackDepth--;
          break;

        case Op.LT:
          lines.push('    i32.lt_s');
          stackDepth--;
          break;

        case Op.GT:
          lines.push('    i32.gt_s');
          stackDepth--;
          break;

        case Op.RET:
          lines.push('  )');
          lines.push(')');
          break;

        // 기타 OpCode는 생략
        default:
          // 미지원 OpCode
          break;
      }
    }

    return lines.join('\n');
  }

  /**
   * WAT → WASM Binary (간소화 버전)
   */
  toBinary(wat: string): Uint8Array {
    // 실제 구현은 wabt 또는 binaryen 라이브러리 필요
    // 여기서는 stub
    const magic = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);  // \0asm
    const version = new Uint8Array([0x01, 0x00, 0x00, 0x00]);  // v1

    return new Uint8Array([...magic, ...version]);
  }

  /**
   * 여러 모듈 링킹
   */
  link(modules: string[]): string {
    const merged = modules.join('\n');
    return `(module\n${merged}\n)`;
  }
}

/**
 * LLVM IR 타겟
 * Inst[] → LLVM Intermediate Representation
 */
export class LLVMIRTarget implements CompileTarget {
  name: string = 'llvm';

  /**
   * Inst[] → LLVM IR
   * 예:
   *   i32 %0 = add i32 2, 3
   *   ret i32 %0
   */
  compile(instrs: Inst[]): string {
    const lines: string[] = [
      'define i32 @main() {',
      'entry:',
    ];

    let regCount = 0;
    const stack: string[] = [];

    for (const instr of instrs) {
      switch (instr.op) {
        case Op.PUSH:
          if (typeof instr.arg === 'number') {
            stack.push(instr.arg.toString());
          }
          break;

        case Op.ADD: {
          const b = stack.pop();
          const a = stack.pop();
          const reg = `%${regCount++}`;
          lines.push(`  ${reg} = add i32 ${a}, ${b}`);
          stack.push(reg);
          break;
        }

        case Op.SUB: {
          const b = stack.pop();
          const a = stack.pop();
          const reg = `%${regCount++}`;
          lines.push(`  ${reg} = sub i32 ${a}, ${b}`);
          stack.push(reg);
          break;
        }

        case Op.MUL: {
          const b = stack.pop();
          const a = stack.pop();
          const reg = `%${regCount++}`;
          lines.push(`  ${reg} = mul i32 ${a}, ${b}`);
          stack.push(reg);
          break;
        }

        case Op.RET:
          const result = stack.pop() || '0';
          lines.push(`  ret i32 ${result}`);
          break;

        default:
          break;
      }
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * 여러 모듈 링킹
   */
  link(modules: string[]): string {
    // LLVM IR 모듈들을 연결
    return modules.join('\n\n');
  }
}

/**
 * 타겟 팩토리
 */
export function createTarget(name: string): CompileTarget {
  switch (name.toLowerCase()) {
    case 'bytecode':
    case 'vm':
      return new BytecodeTarget();
    case 'wasm':
      return new WASMTarget();
    case 'llvm':
    case 'llvm-ir':
      return new LLVMIRTarget();
    default:
      throw new Error(`Unknown target: ${name}`);
  }
}

/**
 * 지원 타겟 목록
 */
export const SUPPORTED_TARGETS = ['bytecode', 'wasm', 'llvm'];

/**
 * 타겟 정보
 */
export interface TargetInfo {
  name: string;
  description: string;
  extension: string;
  binary: boolean;
}

export const TARGET_INFO: Record<string, TargetInfo> = {
  bytecode: {
    name: 'bytecode',
    description: 'Stack VM Bytecode',
    extension: '.flbc',
    binary: false,
  },
  wasm: {
    name: 'wasm',
    description: 'WebAssembly',
    extension: '.wasm',
    binary: true,
  },
  llvm: {
    name: 'llvm',
    description: 'LLVM Intermediate Representation',
    extension: '.ll',
    binary: false,
  },
};
