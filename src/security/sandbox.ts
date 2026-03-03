/**
 * FreeLang Security Sandbox
 *
 * 신뢰할 수 없는 코드를 안전하게 실행
 * - OpCode 필터링
 * - 메모리 제한
 * - 사이클 제한
 * - Capability-based 보안
 */

import { Inst, Op, VMResult } from '../types';

/**
 * 보안 권한 (Capability)
 */
export type Capability =
  | 'filesystem.read'
  | 'filesystem.write'
  | 'network.outbound'
  | 'process.spawn'
  | 'network.inbound';

/**
 * 보안 정책
 */
export interface SecurityPolicy {
  memoryLimit: number;  // 바이트
  cycleLimit: number;   // 최대 실행 사이클
  allowedOps: Set<Op>;
  capabilities: Set<Capability>;
}

/**
 * 보안 위반 기록
 */
export interface SecurityViolation {
  type: 'memory_limit' | 'cycle_limit' | 'opcode_denied' | 'capability_denied';
  message: string;
  timestamp: number;
}

/**
 * 샌드박스 VM
 */
export class SandboxedVM {
  private policy: SecurityPolicy;
  private violations: SecurityViolation[] = [];
  private executionCycles: number = 0;
  private memoryUsage: number = 0;

  constructor(policy?: Partial<SecurityPolicy>) {
    this.policy = {
      memoryLimit: 32 * 1024 * 1024,  // 32MB
      cycleLimit: 1000000,             // 1M cycles
      allowedOps: this.getDefaultAllowedOps(),
      capabilities: new Set(),
      ...policy,
    };
  }

  /**
   * 기본 허용 OpCode
   */
  private getDefaultAllowedOps(): Set<Op> {
    return new Set([
      Op.PUSH,
      Op.POP,
      Op.ADD,
      Op.SUB,
      Op.MUL,
      Op.DIV,
      Op.MOD,
      Op.EQ,
      Op.NEQ,
      Op.LT,
      Op.GT,
      Op.LTE,
      Op.GTE,
      Op.AND,
      Op.OR,
      Op.NOT,
      Op.LOAD,
      Op.STORE,
      Op.JMP,
      Op.JMP_IF,
      Op.JMP_NOT,
      Op.RET,
      Op.HALT,
    ]);
  }

  /**
   * 권한 부여
   */
  grantCapability(cap: Capability): void {
    this.policy.capabilities.add(cap);
  }

  /**
   * 권한 확인
   */
  hasCapability(cap: Capability): boolean {
    return this.policy.capabilities.has(cap);
  }

  /**
   * OpCode 검증
   */
  private validateOp(op: Op): boolean {
    return this.policy.allowedOps.has(op);
  }

  /**
   * 메모리 사용량 검증
   */
  private validateMemory(size: number): boolean {
    if (this.memoryUsage + size > this.policy.memoryLimit) {
      this.recordViolation({
        type: 'memory_limit',
        message: `Memory limit exceeded: ${this.memoryUsage + size} > ${this.policy.memoryLimit}`,
        timestamp: Date.now(),
      });
      return false;
    }

    this.memoryUsage += size;
    return true;
  }

  /**
   * 사이클 검증
   */
  private validateCycles(): boolean {
    this.executionCycles++;

    if (this.executionCycles > this.policy.cycleLimit) {
      this.recordViolation({
        type: 'cycle_limit',
        message: `Execution cycle limit exceeded: ${this.executionCycles} > ${this.policy.cycleLimit}`,
        timestamp: Date.now(),
      });
      return false;
    }

    return true;
  }

  /**
   * 위반 기록
   */
  private recordViolation(violation: SecurityViolation): void {
    this.violations.push(violation);
  }

  /**
   * 안전한 실행
   */
  run(instrs: Inst[]): VMResult {
    this.violations = [];
    this.executionCycles = 0;
    this.memoryUsage = 0;

    const stack: number[] = [];

    for (const instr of instrs) {
      // 사이클 검증
      if (!this.validateCycles()) {
        return {
          ok: false,
          value: 0,
          error: {
            code: 1,
            op: instr.op,
            pc: 0,
            stack_depth: stack.length,
            detail: 'Execution cycle limit exceeded',
          },
          cycles: this.executionCycles,
          ms: 0,
        };
      }

      // OpCode 검증
      if (!this.validateOp(instr.op)) {
        this.recordViolation({
          type: 'opcode_denied',
          message: `OpCode not allowed: ${Op[instr.op]}`,
          timestamp: Date.now(),
        });
        return {
          ok: false,
          value: 0,
          error: {
            code: 2,
            op: instr.op,
            pc: 0,
            stack_depth: stack.length,
            detail: `OpCode denied: ${Op[instr.op]}`,
          },
          cycles: this.executionCycles,
          ms: 0,
        };
      }

      // 메모리 검증 (PUSH, STORE)
      if (instr.op === Op.PUSH || instr.op === Op.STORE) {
        if (!this.validateMemory(8)) {
          return {
            ok: false,
            value: 0,
            error: {
              code: 3,
              op: instr.op,
              pc: 0,
              stack_depth: stack.length,
              detail: 'Memory limit exceeded',
            },
            cycles: this.executionCycles,
            ms: 0,
          };
        }
      }

      // 명령어 실행 (간소화)
      switch (instr.op) {
        case Op.PUSH:
          stack.push(typeof instr.arg === 'number' ? instr.arg : 0);
          break;

        case Op.POP:
          stack.pop();
          break;

        case Op.ADD: {
          const b = stack.pop() || 0;
          const a = stack.pop() || 0;
          stack.push(a + b);
          break;
        }

        case Op.RET:
        case Op.HALT:
          return {
            ok: true,
            value: stack[stack.length - 1] || 0,
            cycles: this.executionCycles,
            ms: 0,
          };

        default:
          break;
      }
    }

    return {
      ok: true,
      value: stack[stack.length - 1] || 0,
      cycles: this.executionCycles,
      ms: 0,
    };
  }

  /**
   * 위반 조회
   */
  getViolations(): SecurityViolation[] {
    return this.violations;
  }

  /**
   * 통계
   */
  getStats() {
    return {
      executionCycles: this.executionCycles,
      memoryUsage: this.memoryUsage,
      memoryLimit: this.policy.memoryLimit,
      violationCount: this.violations.length,
      violations: this.violations,
    };
  }
}

/**
 * 보안 분석기 (컴파일 타임)
 */
export class SecurityAnalyzer {
  /**
   * 위험 패턴 탐지
   */
  detect(instrs: Inst[]): SecurityWarning[] {
    const warnings: SecurityWarning[] = [];

    // 1. 무한 루프 감지
    for (let i = 0; i < instrs.length; i++) {
      if (instrs[i].op === Op.JMP) {
        // 뒤로 점프하는 경우
        let hasExit = false;
        for (let j = i + 1; j < instrs.length; j++) {
          if (instrs[j].op === Op.JMP_IF || instrs[j].op === Op.RET) {
            hasExit = true;
            break;
          }
        }

        if (!hasExit) {
          warnings.push({
            type: 'infinite_loop',
            message: 'Possible infinite loop detected',
            line: i,
            severity: 'error',
          });
        }
      }
    }

    // 2. 과도한 메모리 할당 감지
    let pushCount = 0;
    for (const instr of instrs) {
      if (instr.op === Op.PUSH) {
        pushCount++;
        if (pushCount > 10000) {
          warnings.push({
            type: 'memory_exhaustion',
            message: 'Excessive memory allocation detected',
            line: 0,
            severity: 'error',
          });
          break;
        }
      }
    }

    return warnings;
  }
}

/**
 * 보안 경고
 */
export interface SecurityWarning {
  type: 'infinite_loop' | 'memory_exhaustion' | 'dangerous_pattern';
  message: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
}

/**
 * 보안 정책 사전 설정
 */
export const SECURITY_POLICIES = {
  /**
   * 완전 신뢰 (제한 없음)
   */
  TRUSTED: {
    memoryLimit: Number.MAX_VALUE,
    cycleLimit: Number.MAX_VALUE,
    allowedOps: new Set(Object.values(Op).filter(v => typeof v === 'number')),
    capabilities: new Set<Capability>([
      'filesystem.read',
      'filesystem.write',
      'network.outbound',
      'network.inbound',
      'process.spawn',
    ]),
  } as SecurityPolicy,

  /**
   * 읽기 전용
   */
  READONLY: {
    memoryLimit: 32 * 1024 * 1024,
    cycleLimit: 1000000,
    allowedOps: new Set([
      Op.PUSH,
      Op.POP,
      Op.ADD,
      Op.SUB,
      Op.MUL,
      Op.DIV,
      Op.LOAD,
      Op.RET,
    ]),
    capabilities: new Set<Capability>(['filesystem.read']),
  } as SecurityPolicy,

  /**
   * 계산 전용
   */
  COMPUTE_ONLY: {
    memoryLimit: 16 * 1024 * 1024,
    cycleLimit: 100000,
    allowedOps: new Set([
      Op.PUSH,
      Op.POP,
      Op.ADD,
      Op.SUB,
      Op.MUL,
      Op.DIV,
      Op.MOD,
      Op.RET,
    ]),
    capabilities: new Set<Capability>(),
  } as SecurityPolicy,
};
