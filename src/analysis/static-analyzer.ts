/**
 * FreeLang Static Analyzer
 *
 * 컴파일 타임에 다음을 감지:
 * - 데이터 흐름 분석 (정의-사용)
 * - 미초기화 변수 사용
 * - 미사용 변수
 * - 도달 불가능 코드
 * - 이탈 분석 (Escape Analysis)
 */

import { Inst, Op } from '../types';

/**
 * 변수 정보
 */
export interface VariableInfo {
  name: string;
  definedAt: number;  // 라인 번호
  usedAt: number[];   // 라인 번호들
  isInitialized: boolean;
  isEscaped: boolean;  // 힙으로 이탈
}

/**
 * 정의-사용 정보
 */
export interface DefUseInfo {
  variable: string;
  defs: number[];  // 정의된 라인들
  uses: number[];  // 사용된 라인들
  isUsed: boolean;
  isInitialized: boolean;
}

/**
 * 분석 경고
 */
export interface AnalysisWarning {
  type: 'uninitialized' | 'unused' | 'unreachable' | 'lint' | 'escape';
  message: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
}

/**
 * 데이터 흐름 분석 (Data Flow Analysis)
 */
export class DataFlowAnalyzer {
  private variables: Map<string, VariableInfo> = new Map();
  private instrs: Inst[];
  private warnings: AnalysisWarning[] = [];

  constructor(instrs: Inst[]) {
    this.instrs = instrs;
  }

  /**
   * 정의-사용 정보 계산
   */
  computeDefUse(): Map<string, DefUseInfo> {
    const defUse = new Map<string, DefUseInfo>();

    for (let i = 0; i < this.instrs.length; i++) {
      const instr = this.instrs[i];

      // STORE: 변수 정의
      if (instr.op === Op.STORE) {
        const varName = instr.arg as string;
        const info = defUse.get(varName) || {
          variable: varName,
          defs: [],
          uses: [],
          isUsed: false,
          isInitialized: true,
        };
        info.defs.push(i);
        defUse.set(varName, info);
      }

      // LOAD: 변수 사용
      if (instr.op === Op.LOAD) {
        const varName = instr.arg as string;
        const info = defUse.get(varName) || {
          variable: varName,
          defs: [],
          uses: [],
          isUsed: false,
          isInitialized: false,
        };
        info.uses.push(i);
        info.isUsed = true;

        // 정의 전에 사용되는지 확인
        if (info.defs.length === 0) {
          this.warnings.push({
            type: 'uninitialized',
            message: `Variable '${varName}' may be used before initialization`,
            line: i,
            severity: 'error',
          });
        }

        defUse.set(varName, info);
      }
    }

    return defUse;
  }

  /**
   * 미사용 변수 찾기
   */
  findUnused(): string[] {
    const defUse = this.computeDefUse();
    const unused: string[] = [];

    for (const [name, info] of Array.from(defUse.entries())) {
      if (!info.isUsed && info.defs.length > 0) {
        unused.push(name);
        this.warnings.push({
          type: 'unused',
          message: `Variable '${name}' is defined but never used`,
          line: info.defs[0],
          severity: 'warning',
        });
      }
    }

    return unused;
  }

  /**
   * 미초기화 변수 사용 찾기
   */
  findUninitializedUse(): AnalysisWarning[] {
    const defUse = this.computeDefUse();
    const uninitialized: AnalysisWarning[] = [];

    for (const [name, info] of Array.from(defUse.entries())) {
      if (info.defs.length === 0 && info.uses.length > 0) {
        uninitialized.push({
          type: 'uninitialized',
          message: `Variable '${name}' used without initialization`,
          line: info.uses[0],
          severity: 'error',
        });
      }
    }

    return uninitialized;
  }

  /**
   * 도달 불가능 코드 찾기
   */
  findUnreachableCode(): AnalysisWarning[] {
    const unreachable: AnalysisWarning[] = [];

    for (let i = 0; i < this.instrs.length; i++) {
      const instr = this.instrs[i];

      // RET 또는 HALT 이후 코드는 도달 불가능
      if (instr.op === Op.RET || instr.op === Op.HALT) {
        if (i + 1 < this.instrs.length) {
          unreachable.push({
            type: 'unreachable',
            message: 'Unreachable code after return/halt',
            line: i + 1,
            severity: 'warning',
          });
        }
      }
    }

    return unreachable;
  }

  /**
   * 모든 경고 조회
   */
  getWarnings(): AnalysisWarning[] {
    return this.warnings;
  }
}

/**
 * 이탈 분석 (Escape Analysis)
 * 객체가 메모리 스택/힙으로 이탈하는지 결정
 */
export class EscapeAnalyzer {
  private instrs: Inst[];

  constructor(instrs: Inst[]) {
    this.instrs = instrs;
  }

  /**
   * 변수별 할당 위치 분석
   */
  analyze(): Map<string, 'stack' | 'heap'> {
    const allocation = new Map<string, 'stack' | 'heap'>();

    for (const instr of this.instrs) {
      // STORE된 변수는 초기에 스택에 할당
      if (instr.op === Op.STORE) {
        const varName = instr.arg as string;
        if (!allocation.has(varName)) {
          allocation.set(varName, 'stack');
        }
      }
    }

    // 간소화: 모든 변수를 스택에 할당 (실제는 이탈 추적 필요)
    return allocation;
  }
}

/**
 * Lint 규칙
 */
export interface LintRule {
  name: string;
  check(instrs: Inst[]): AnalysisWarning[];
}

/**
 * 기본 Lint 규칙들
 */
const LINT_RULES: LintRule[] = [
  {
    name: 'no-infinite-loop',
    check: (instrs: Inst[]) => {
      const warnings: AnalysisWarning[] = [];

      for (let i = 0; i < instrs.length; i++) {
        // 무한 루프: JMP_IF 없이 JMP만 있는 경우
        if (instrs[i].op === Op.JMP) {
          // 뒤로 점프하는 경우
          let isInfinite = true;
          for (let j = i + 1; j < instrs.length; j++) {
            if (instrs[j].op === Op.JMP_IF || instrs[j].op === Op.RET) {
              isInfinite = false;
              break;
            }
          }

          if (isInfinite) {
            warnings.push({
              type: 'lint',
              message: 'Possible infinite loop detected',
              line: i,
              severity: 'warning',
            });
          }
        }
      }

      return warnings;
    },
  },
  {
    name: 'stack-depth-warning',
    check: (instrs: Inst[]) => {
      const warnings: AnalysisWarning[] = [];
      let stackDepth = 0;
      const maxDepth = 1000;

      for (let i = 0; i < instrs.length; i++) {
        const instr = instrs[i];

        if (instr.op === Op.PUSH) {
          stackDepth++;
        } else if (
          instr.op === Op.ADD ||
          instr.op === Op.SUB ||
          instr.op === Op.MUL ||
          instr.op === Op.DIV
        ) {
          stackDepth--;
        }

        if (stackDepth > maxDepth) {
          warnings.push({
            type: 'lint',
            message: `Stack depth exceeds ${maxDepth}`,
            line: i,
            severity: 'warning',
          });
        }
      }

      return warnings;
    },
  },
];

/**
 * Lint 검사기
 */
export class LintChecker {
  rules: LintRule[];

  constructor(rules?: LintRule[]) {
    this.rules = rules || LINT_RULES;
  }

  /**
   * 모든 규칙 검사
   */
  check(instrs: Inst[]): AnalysisWarning[] {
    const warnings: AnalysisWarning[] = [];

    for (const rule of this.rules) {
      warnings.push(...rule.check(instrs));
    }

    return warnings;
  }
}

/**
 * 통합 정적 분석기
 */
export class StaticAnalyzer {
  private dataFlow: DataFlowAnalyzer;
  private escape: EscapeAnalyzer;
  private lint: LintChecker;

  constructor(instrs: Inst[]) {
    this.dataFlow = new DataFlowAnalyzer(instrs);
    this.escape = new EscapeAnalyzer(instrs);
    this.lint = new LintChecker();
  }

  /**
   * 전체 분석 실행
   */
  analyze(): AnalysisWarning[] {
    const warnings: AnalysisWarning[] = [];

    // 1. 데이터 흐름 분석
    this.dataFlow.computeDefUse();
    this.dataFlow.findUnused();
    this.dataFlow.findUninitializedUse();
    warnings.push(...this.dataFlow.getWarnings());

    // 2. 도달 불가능 코드 찾기
    warnings.push(...this.dataFlow.findUnreachableCode());

    // 3. Lint 검사
    warnings.push(...this.lint.check(this.dataFlow['instrs']));

    // 심각도별 정렬
    warnings.sort((a, b) => {
      const severity = { error: 0, warning: 1, info: 2 };
      return severity[a.severity] - severity[b.severity];
    });

    return warnings;
  }

  /**
   * 이탈 분석 결과
   */
  getEscapeAnalysis(): Map<string, 'stack' | 'heap'> {
    return this.escape.analyze();
  }
}
