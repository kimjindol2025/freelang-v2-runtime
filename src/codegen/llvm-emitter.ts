// FreeLang v2 - LLVM IR Emitter
// AIIntent → LLVM IR 텍스트 (JIT 컴파일 준비)

import { AIIntent, Op, Inst } from '../types';

/**
 * LLVM IR Emitter
 *
 * Strategy:
 * 1. AIIntent를 LLVM IR 텍스트로 변환
 * 2. 스택 기반 → SSA 형식
 * 3. sum, average 구현 (프로토타입)
 * 4. 향후: llc/lli로 JIT 컴파일
 *
 * Example IR (sum):
 *   define double @sum(double* %arr, i32 %len) {
 *   entry:
 *     %result = alloca double
 *     store double 0.0, double* %result
 *     ...
 *   }
 */

export class LLVMEmitter {
  private nextVar = 0;
  private lines: string[] = [];
  private blockName = 'entry';

  /**
   * AIIntent → LLVM IR 텍스트
   *
   * 예시:
   *   input: { fn: "sum", params: [{name: "arr", type: "array"}], ...}
   *   output: LLVM IR text
   */
  generate(intent: AIIntent): string {
    this.nextVar = 0;
    this.lines = [];
    this.blockName = 'entry';

    // 함수 시그니처
    const fnSig = this.emitSignature(intent);
    this.lines.push(fnSig);

    // 진입 블록
    this.lines.push('entry:');

    // 구현별 처리
    if (intent.fn === 'sum') {
      this.emitSum(intent);
    } else if (intent.fn === 'average') {
      this.emitAverage(intent);
    } else {
      // 기본: IR body 직접 생성
      this.emitGeneric(intent);
    }

    this.lines.push('}');
    this.lines.push('');

    return this.lines.join('\n');
  }

  /**
   * 함수 시그니처 생성
   *
   * C: double sum(double* arr, int len)
   * LLVM: define double @sum(double* %arr, i32 %len) {
   */
  private emitSignature(intent: AIIntent): string {
    const params = intent.params
      .map((p) => {
        const type = this.typeToLLVM(p.type);
        return `${type} %${p.name}`;
      })
      .join(', ');

    const retType = this.typeToLLVM(intent.ret);
    return `define ${retType} @${intent.fn}(${params}) {`;
  }

  /**
   * 타입 매핑: AI 타입 → LLVM 타입
   */
  private typeToLLVM(type: string): string {
    switch (type) {
      case 'number':
        return 'double';
      case 'array':
        return 'double*';
      case 'bool':
        return 'i1';
      case 'int':
        return 'i32';
      default:
        return 'double';
    }
  }

  /**
   * sum 구현: sum(arr, len) = arr[0] + arr[1] + ... + arr[len-1]
   *
   * LLVM IR:
   *   %result = alloca double
   *   store double 0.0, double* %result
   *   %i = alloca i32
   *   store i32 0, i32* %i
   *   br label %loop.condition
   * loop.condition:
   *   %i.val = load i32, i32* %i
   *   %cmp = icmp slt i32 %i.val, %len
   *   br i1 %cmp, label %loop.body, label %loop.end
   * loop.body:
   *   ... accumulate ...
   * loop.end:
   *   ret double ...
   */
  private emitSum(intent: AIIntent): void {
    // Allocate result and counter
    this.emit('%result = alloca double');
    this.emit('store double 0.0, double* %result');
    this.emit('%i = alloca i32');
    this.emit('store i32 0, i32* %i');
    this.emit('br label %loop.condition');

    // Loop condition block
    this.lines.push('');
    this.lines.push('loop.condition:');
    this.emit('%i.val = load i32, i32* %i');
    this.emit('%cmp = icmp slt i32 %i.val, %len');
    this.emit('br i1 %cmp, label %loop.body, label %loop.end');

    // Loop body
    this.lines.push('');
    this.lines.push('loop.body:');
    this.emit('%i.val2 = load i32, i32* %i');
    this.emit('%arr.ptr = getelementptr double, double* %arr, i32 %i.val2');
    this.emit('%elem = load double, double* %arr.ptr');
    this.emit('%result.val = load double, double* %result');
    this.emit('%sum = fadd double %result.val, %elem');
    this.emit('store double %sum, double* %result');
    this.emit('%i.next = add i32 %i.val2, 1');
    this.emit('store i32 %i.next, i32* %i');
    this.emit('br label %loop.condition');

    // Loop end
    this.lines.push('');
    this.lines.push('loop.end:');
    this.emit('%result.final = load double, double* %result');
    this.emit('ret double %result.final');
  }

  /**
   * average 구현: average(arr, len) = sum(arr, len) / len
   */
  private emitAverage(intent: AIIntent): void {
    // Same as sum but with division
    this.emit('%result = alloca double');
    this.emit('store double 0.0, double* %result');
    this.emit('%i = alloca i32');
    this.emit('store i32 0, i32* %i');
    this.emit('br label %loop.condition');

    this.lines.push('');
    this.lines.push('loop.condition:');
    this.emit('%i.val = load i32, i32* %i');
    this.emit('%cmp = icmp slt i32 %i.val, %len');
    this.emit('br i1 %cmp, label %loop.body, label %loop.end');

    this.lines.push('');
    this.lines.push('loop.body:');
    this.emit('%i.val2 = load i32, i32* %i');
    this.emit('%arr.ptr = getelementptr double, double* %arr, i32 %i.val2');
    this.emit('%elem = load double, double* %arr.ptr');
    this.emit('%result.val = load double, double* %result');
    this.emit('%sum = fadd double %result.val, %elem');
    this.emit('store double %sum, double* %result');
    this.emit('%i.next = add i32 %i.val2, 1');
    this.emit('store i32 %i.next, i32* %i');
    this.emit('br label %loop.condition');

    this.lines.push('');
    this.lines.push('loop.end:');
    this.emit('%result.sum = load double, double* %result');
    this.emit('%len.double = sitofp i32 %len to double');
    this.emit('%avg = fdiv double %result.sum, %len.double');
    this.emit('ret double %avg');
  }

  /**
   * 일반 IR 코드 생성 (향후 확장)
   */
  private emitGeneric(intent: AIIntent): void {
    // Placeholder: 정수 0 반환
    this.emit('ret double 0.0');
  }

  /**
   * IR 줄 추가 (자동 들여쓰기)
   */
  private emit(code: string): void {
    this.lines.push('  ' + code);
  }

  /**
   * 새 변수 생성 (SSA 형식)
   */
  private newVar(): string {
    return `%v${this.nextVar++}`;
  }
}

/**
 * LLVM IR 컴파일러
 *
 * 책임: IR 텍스트 → 바이너리 (외부 도구 사용)
 * - 로컬: llc, llvm-as, lli
 * - 원격: LLVM REST API
 */
export class LLVMCompiler {
  /**
   * IR 텍스트를 object 파일로 컴파일
   *
   * 요청 흐름:
   *   IR text → llvm-as → .bc (bitcode) → llc → .o (object)
   */
  static compileBitcode(irText: string, outputPath: string): boolean {
    // 향후 구현: child_process로 llc 호출
    // const result = execSync(`llc -o ${outputPath}.o ${irPath}`);
    return true;
  }

  /**
   * IR 텍스트를 LLVM bitcode로 변환
   *
   * 명령어: llvm-as input.ll -o output.bc
   */
  static generateBitcode(irText: string, outputPath: string): boolean {
    // 향후 구현
    return true;
  }

  /**
   * Bitcode를 JIT로 실행
   *
   * 명령어: lli input.bc
   */
  static jitExecute(bitcodeFile: string): unknown {
    // 향후 구현
    return undefined;
  }
}

/**
 * 학습: LLVM IR 생성 성능 추적
 */
export interface LLVMMetric {
  fnName: string;
  irSize: number;           // IR 텍스트 크기
  irLines: number;          // IR 줄 수
  compilationTime?: number; // 컴파일 시간
  bitcodeSize?: number;     // bitcode 크기
  execTime?: number;        // JIT 실행 시간
  timestamp: number;
}

export class LLVMLearner {
  private metrics: LLVMMetric[] = [];

  record(
    fnName: string,
    irText: string,
    compilationTime?: number,
    bitcodeSize?: number,
    execTime?: number
  ): void {
    this.metrics.push({
      fnName,
      irSize: irText.length,
      irLines: irText.split('\n').length,
      compilationTime,
      bitcodeSize,
      execTime,
      timestamp: Date.now(),
    });
  }

  /**
   * 평균 IR 크기
   */
  getAverageIRSize(): number {
    if (this.metrics.length === 0) return 0;
    const sum = this.metrics.reduce((acc, m) => acc + m.irSize, 0);
    return Math.round(sum / this.metrics.length);
  }

  /**
   * 평균 IR 줄 수
   */
  getAverageIRLines(): number {
    if (this.metrics.length === 0) return 0;
    const sum = this.metrics.reduce((acc, m) => acc + m.irLines, 0);
    return Math.round(sum / this.metrics.length);
  }

  /**
   * 함수별 통계
   */
  getStatsByFunction(fnName: string): {
    count: number;
    avgIRSize: number;
    avgCompileTime?: number;
  } | null {
    const filtered = this.metrics.filter((m) => m.fnName === fnName);
    if (filtered.length === 0) return null;

    const avgSize = Math.round(
      filtered.reduce((sum, m) => sum + m.irSize, 0) / filtered.length
    );
    const avgCompile =
      filtered.filter((m) => m.compilationTime).length > 0
        ? Math.round(
            filtered.reduce(
              (sum, m) => sum + (m.compilationTime || 0),
              0
            ) / filtered.filter((m) => m.compilationTime).length
          )
        : undefined;

    return {
      count: filtered.length,
      avgIRSize: avgSize,
      avgCompileTime: avgCompile,
    };
  }

  getMetrics(): LLVMMetric[] {
    return [...this.metrics];
  }
}
