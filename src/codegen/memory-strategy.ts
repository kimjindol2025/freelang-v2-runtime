// FreeLang v2 - Memory Strategy Pattern
// directive에 따라 C 코드 생성 전략 결정 (성능/안전성 트레이드오프)

export interface MemoryProfile {
  stackSize: number;           // 스택 크기 (bytes)
  boundaryChecks: boolean;     // 배열 경계 검사
  nullChecks: boolean;         // NULL 포인터 검사
  inlineThreshold: number;     // 인라인 함수 크기 제한 (bytes)
  optimization: string;        // GCC -O 레벨
  preAllocate: boolean;        // 메모리 사전 할당
}

/**
 * MemoryStrategy: directive별 메모리 관리 방식
 *
 * 3가지 프로필:
 * 1. SpeedStrategy: 최대 성능 (경계 검사 X)
 * 2. MemoryEfficientStrategy: 메모리 최소화 (작은 스택, 동적 할당)
 * 3. SafetyStrategy: 안전성 우선 (모든 검사 활성)
 */
export class MemoryStrategy {
  /**
   * directive에 따라 메모리 프로필 반환
   */
  static getProfile(directive: string): MemoryProfile {
    switch (directive) {
      case 'speed':
        return MemoryStrategy.speedProfile();
      case 'memory_efficient':
        return MemoryStrategy.memoryEfficientProfile();
      case 'safety':
        return MemoryStrategy.safetyProfile();
      default:
        return MemoryStrategy.standardProfile();
    }
  }

  /**
   * Speed Profile: 성능 최적화
   * - 큰 스택 (1MB)
   * - 경계 검사 비활성
   * - 인라인 공격적 (-O3)
   * - 사전 할당으로 런타임 오버헤드 제거
   */
  private static speedProfile(): MemoryProfile {
    return {
      stackSize: 1024 * 1024,      // 1MB
      boundaryChecks: false,
      nullChecks: false,
      inlineThreshold: 256,
      optimization: '-O3',
      preAllocate: true,
    };
  }

  /**
   * Memory Efficient Profile: 메모리 최소화
   * - 작은 스택 (64KB)
   * - 동적 할당 (스택 초과 시 힙 사용)
   * - 최소 인라인 (-O2)
   * - 경계 검사: 배열만 (변수는 검사 X)
   */
  private static memoryEfficientProfile(): MemoryProfile {
    return {
      stackSize: 64 * 1024,        // 64KB
      boundaryChecks: true,        // 배열은 검사
      nullChecks: false,           // 포인터는 검사 안 함
      inlineThreshold: 64,
      optimization: '-O2',
      preAllocate: false,
    };
  }

  /**
   * Safety Profile: 안전성 우선
   * - 중간 스택 (256KB)
   * - 모든 검사 활성
   * - 디버그 정보 포함 (-g)
   * - Sanitizer 지원
   */
  private static safetyProfile(): MemoryProfile {
    return {
      stackSize: 256 * 1024,       // 256KB
      boundaryChecks: true,
      nullChecks: true,
      inlineThreshold: 32,
      optimization: '-O2 -g -fsanitize=address',
      preAllocate: false,
    };
  }

  /**
   * Standard Profile: 기본값 (balanced)
   * - 중간 스택 (256KB)
   * - 배열 경계 검사만
   * - 표준 최적화 (-O2)
   */
  private static standardProfile(): MemoryProfile {
    return {
      stackSize: 256 * 1024,       // 256KB
      boundaryChecks: true,        // 배열만
      nullChecks: false,
      inlineThreshold: 128,
      optimization: '-O2',
      preAllocate: false,
    };
  }
}

/**
 * CodeEmitter: 전략에 따라 C 코드 생성
 *
 * 책임: 메모리 프로필 → C 매크로/함수 생성
 */
export class StrategyAwareEmitter {
  private profile: MemoryProfile;

  constructor(directive: string) {
    this.profile = MemoryStrategy.getProfile(directive);
  }

  /**
   * 프로로그 생성: 스택/메모리 초기화
   *
   * speed: 스택만 할당
   * memory_efficient: 동적 할당 함수 정의
   * safety: 경계 검사 매크로 포함
   */
  genProlog(): string[] {
    const lines: string[] = [];

    // 메모리 보호 매크로 (safety일 때만)
    if (this.profile.nullChecks) {
      lines.push('#define CHECK_NULL(ptr) \\');
      lines.push('  do { \\');
      lines.push('    if ((ptr) == NULL) { \\');
      lines.push('      fprintf(stderr, "NULL pointer at %s:%d\\\\n", __FILE__, __LINE__); \\');
      lines.push('      exit(1); \\');
      lines.push('    } \\');
      lines.push('  } while(0)');
      lines.push('');
    }

    if (this.profile.boundaryChecks) {
      lines.push('#define CHECK_BOUNDS(index, size) \\');
      lines.push('  do { \\');
      lines.push('    if ((index) < 0 || (index) >= (size)) { \\');
      lines.push('      fprintf(stderr, "Index out of bounds: %d >= %d at %s:%d\\\\n", \\');
      lines.push('        (index), (size), __FILE__, __LINE__); \\');
      lines.push('      exit(1); \\');
      lines.push('    } \\');
      lines.push('  } while(0)');
      lines.push('');
    }

    // 스택 선언
    lines.push(`#define STACK_SIZE ${this.profile.stackSize}`);
    if (this.profile.preAllocate) {
      lines.push('static double _stack[STACK_SIZE];  // 사전 할당');
    } else {
      lines.push('static double* _stack = NULL;  // 동적 할당');
      lines.push('static size_t _stack_capacity = STACK_SIZE;');
    }
    lines.push('static int _sp = 0;');
    lines.push('');

    return lines;
  }

  /**
   * 배열 접근 코드 생성
   *
   * speed: 경계 검사 없음 (arr[i] 직접 접근)
   * memory_efficient: 배열만 경계 검사
   * safety: 경계 + NULL 검사
   */
  genArrayAccess(arrName: string, indexVar: string, isSafe: boolean): string {
    if (!isSafe || !this.profile.boundaryChecks) {
      return `${arrName}[${indexVar}]`;
    }

    // Safe access: CHECK_BOUNDS 매크로 호출
    return `(CHECK_BOUNDS(${indexVar}, ${arrName}_len), ${arrName}[${indexVar}])`;
  }

  /**
   * 스택 접근 코드 생성
   *
   * memory_efficient: 동적 확장 체크
   * others: 단순 배열 접근
   */
  genStackPush(valueExpr: string): string {
    if (!this.profile.preAllocate) {
      // 동적 할당 모드: 스택 초과 시 재할당
      const code = [
        `if (_sp >= _stack_capacity) {`,
        `  _stack_capacity *= 2;`,
        `  _stack = (double*)realloc(_stack, _stack_capacity * sizeof(double));`,
        `}`,
        `_stack[_sp++] = ${valueExpr};`,
      ].join('\n    ');
      return code;
    }

    // 사전 할당 모드: 크기 검사만
    return `_stack[_sp++] = ${valueExpr};`;
  }

  /**
   * 최적화 플래그 반환
   */
  getOptimizationFlags(): string {
    return this.profile.optimization;
  }

  /**
   * 프로필 정보 (디버그용)
   */
  getProfileInfo(): Record<string, any> {
    return this.profile;
  }
}

/**
 * 학습: 각 directive의 성능 특성 기록
 */
export interface StrategyMetric {
  directive: string;
  compilationTime: number;   // 컴파일 시간 (ms)
  binarySize: number;        // 바이너리 크기 (bytes)
  peakMemory: number;        // 피크 메모리 (bytes)
  execTime: number;          // 실행 시간 (μs)
  timestamp: number;
}

export class StrategyLearner {
  private metrics: StrategyMetric[] = [];

  record(
    directive: string,
    compilationTime: number,
    binarySize: number,
    peakMemory: number,
    execTime: number
  ): void {
    this.metrics.push({
      directive,
      compilationTime,
      binarySize,
      peakMemory,
      execTime,
      timestamp: Date.now(),
    });
  }

  /**
   * directive별 평균 성능 계산
   */
  getAverages(directive: string): {
    avgCompileTime: number;
    avgBinarySize: number;
    avgMemory: number;
    avgExecTime: number;
    count: number;
  } | null {
    const filtered = this.metrics.filter(m => m.directive === directive);
    if (filtered.length === 0) return null;

    const sum = filtered.reduce(
      (acc, m) => ({
        compile: acc.compile + m.compilationTime,
        binary: acc.binary + m.binarySize,
        memory: acc.memory + m.peakMemory,
        exec: acc.exec + m.execTime,
      }),
      { compile: 0, binary: 0, memory: 0, exec: 0 }
    );

    const count = filtered.length;
    return {
      avgCompileTime: sum.compile / count,
      avgBinarySize: sum.binary / count,
      avgMemory: sum.memory / count,
      avgExecTime: sum.exec / count,
      count,
    };
  }

  /**
   * 모든 directive 비교
   */
  compareAll(): Record<string, any> {
    const directives = ['speed', 'memory_efficient', 'safety', 'standard'];
    const results: Record<string, any> = {};

    for (const dir of directives) {
      results[dir] = this.getAverages(dir);
    }

    return results;
  }

  getMetrics(): StrategyMetric[] {
    return [...this.metrics];
  }
}
