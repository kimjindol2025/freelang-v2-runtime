/**
 * Phase 6.2 Week 2: BugDetector
 *
 * Claude가 생성한 FreeLang 코드의 버그를 자동으로 감지합니다.
 *
 * 감지 대상:
 * 1. 타입 에러 (Type Errors)
 * 2. Null 참조 (Null References)
 * 3. 메모리 오버플로우 (Memory Overflow)
 * 4. 무한 루프 (Infinite Loops)
 * 5. 배열 경계 초과 (Array Out of Bounds)
 * 6. 리소스 누수 (Resource Leaks)
 */

/**
 * 버그 타입 정의
 */
export enum BugType {
  // 타입 관련
  TYPE_MISMATCH = 'TYPE_MISMATCH',              // sum([1, "2", 3]) - 타입 불일치
  UNDEFINED_VARIABLE = 'UNDEFINED_VARIABLE',    // x를 정의하지 않고 사용
  WRONG_RETURN_TYPE = 'WRONG_RETURN_TYPE',      // number 반환 예상하는데 string 반환

  // Null 관련
  NULL_POINTER = 'NULL_POINTER',                // null.length 접근
  MISSING_NULL_CHECK = 'MISSING_NULL_CHECK',    // arr이 null일 수 있는데 arr[0] 접근

  // 메모리 관련
  INFINITE_LOOP = 'INFINITE_LOOP',              // while(true) 조건 없음
  STACK_OVERFLOW = 'STACK_OVERFLOW',            // 무제한 재귀
  MEMORY_LEAK = 'MEMORY_LEAK',                  // 할당 후 해제 안 함

  // 배열 관련
  ARRAY_OUT_OF_BOUNDS = 'ARRAY_OUT_OF_BOUNDS',  // arr[100]인데 arr 크기 5
  INVALID_ARRAY_INDEX = 'INVALID_ARRAY_INDEX',  // arr[x]인데 x가 number 아님
  EMPTY_ARRAY_ACCESS = 'EMPTY_ARRAY_ACCESS',    // []로 시작하는데 인덱스 접근

  // 로직 관련
  UNREACHABLE_CODE = 'UNREACHABLE_CODE',        // return 이후 코드
  DEAD_CODE = 'DEAD_CODE',                      // 사용되지 않는 변수/함수
  LOGIC_ERROR = 'LOGIC_ERROR',                  // i++ 빠짐 등

  // 성능 관련
  PERFORMANCE_WARNING = 'PERFORMANCE_WARNING',  // O(n²) 알고리즘 사용
}

/**
 * 버그 레코드
 */
export interface BugRecord {
  type: BugType;
  severity: 'critical' | 'high' | 'medium' | 'low'; // 심각도
  line?: number;
  column?: number;
  message: string;
  suggestion?: string;  // 수정 제안
  evidence: string;     // 버그 증거 (코드 조각)
}

/**
 * 코드 분석 결과
 */
export interface CodeAnalysisResult {
  code: string;
  bugs: BugRecord[];
  bugCount: number;
  hasCriticalBugs: boolean;
  isSafe: boolean;
  safetyScore: number; // 0-100 (100 = 안전)
  suggestions: string[];
}

/**
 * BugDetector: Claude 생성 코드의 버그 감지
 */
export class BugDetector {
  private code: string = '';
  private lines: string[] = [];
  private bugs: BugRecord[] = [];

  /**
   * 코드 분석 및 버그 감지
   */
  analyze(code: string): CodeAnalysisResult {
    this.code = code;
    this.lines = code.split('\n');
    this.bugs = [];

    // 각 버그 타입별 검사
    this.detectTypeErrors();
    this.detectNullReferences();
    this.detectInfiniteLoops();
    this.detectArrayBugs();
    this.detectMemoryLeaks();
    this.detectUnreachableCode();
    this.detectPerformanceIssues();

    // 결과 생성
    const hasCriticalBugs = this.bugs.some(b => b.severity === 'critical');
    const safetyScore = Math.max(0, 100 - this.bugs.length * 10);

    return {
      code,
      bugs: this.bugs,
      bugCount: this.bugs.length,
      hasCriticalBugs,
      isSafe: !hasCriticalBugs,
      safetyScore: Math.min(100, safetyScore),
      suggestions: this.generateSuggestions()
    };
  }

  /**
   * 타입 에러 감지
   */
  private detectTypeErrors(): void {
    // 패턴: 타입 불일치
    // sum([1, "2", 3]) - 숫자 배열이 아님
    const arrayLiterals = this.code.match(/\[([^\]]+)\]/g) || [];

    arrayLiterals.forEach(literal => {
      // 배열 내 항목 타입 검사
      const items = literal.slice(1, -1).split(',');
      const types = new Set<string>();

      items.forEach(item => {
        const trimmed = item.trim();
        if (/^\d+$/.test(trimmed)) types.add('number');
        else if (/^"[^"]*"$/.test(trimmed)) types.add('string');
        else if (/^true|false$/.test(trimmed)) types.add('boolean');
        else types.add('unknown');
      });

      // 혼합 타입 감지
      if (types.size > 1 && !types.has('unknown')) {
        this.bugs.push({
          type: BugType.TYPE_MISMATCH,
          severity: 'high',
          message: `Array contains mixed types: ${Array.from(types).join(', ')}`,
          suggestion: `Use consistent types in array. Found: [${Array.from(types).join(', ')}]`,
          evidence: literal
        });
      }
    });

    // 패턴: 정의되지 않은 변수 사용
    const varUsages = this.code.match(/\b([a-zA-Z_]\w*)\b/g) || [];
    const declared = new Set<string>();
    const builtins = new Set(['sum', 'map', 'filter', 'reduce', 'array', 'number', 'string', 'boolean', 'true', 'false', 'null', 'undefined', 'fn', 'return', 'for', 'in', 'if', 'else', 'do', 'end', 'let']);

    // 선언 찾기
    const declarations = this.code.match(/(?:let|fn)\s+(\w+)/g) || [];
    declarations.forEach(decl => {
      const name = decl.split(/\s+/)[1];
      if (name) declared.add(name);
    });

    // 미선언 변수 감지
    varUsages.forEach(usage => {
      if (!declared.has(usage) && !builtins.has(usage) && usage.length > 1) {
        if (!declared.has(usage)) {
          // 첫 미선언만 보고
          if (this.bugs.filter(b => b.type === BugType.UNDEFINED_VARIABLE).length === 0) {
            this.bugs.push({
              type: BugType.UNDEFINED_VARIABLE,
              severity: 'critical',
              message: `Variable '${usage}' is used but never declared`,
              suggestion: `Add: let ${usage} = ...`,
              evidence: usage
            });
          }
        }
      }
    });
  }

  /**
   * Null 참조 감지
   */
  private detectNullReferences(): void {
    // 패턴: null 체크 없이 접근
    // arr[i] - arr이 null일 수 있음
    const arrayAccess = this.code.match(/(\w+)\[(\w+)\]/g) || [];

    arrayAccess.forEach(access => {
      const varName = access.split('[')[0];

      // null 체크 있는지 확인
      const hasNullCheck = this.code.includes(`if ${varName}`) ||
                          this.code.includes(`if (${varName})`);

      if (!hasNullCheck) {
        this.bugs.push({
          type: BugType.MISSING_NULL_CHECK,
          severity: 'high',
          message: `Array access without null check: ${access}`,
          suggestion: `Add: if ${varName} { ... }`,
          evidence: access
        });
      }
    });

    // 패턴: null.xxx 직접 접근
    const nullAccess = this.code.match(/null\.\w+/g) || [];
    nullAccess.forEach(access => {
      this.bugs.push({
        type: BugType.NULL_POINTER,
        severity: 'critical',
        message: `Cannot access property on null: ${access}`,
        suggestion: `Check for null first`,
        evidence: access
      });
    });
  }

  /**
   * 무한 루프 감지
   */
  private detectInfiniteLoops(): void {
    // 패턴 1: while(true)
    if (this.code.includes('while true') || this.code.includes('while(true)')) {
      // break 있는지 확인
      const hasBreak = this.code.includes('break');
      if (!hasBreak) {
        this.bugs.push({
          type: BugType.INFINITE_LOOP,
          severity: 'critical',
          message: 'Infinite loop detected: while(true) without break',
          suggestion: 'Add break condition or use for loop instead',
          evidence: 'while(true)'
        });
      }
    }

    // 패턴 2: for 루프에서 i++ 없음
    const forLoops = this.code.match(/for\s+\w+\s+in\s+[^\{]+\{[^\}]*\}/g) || [];
    forLoops.forEach(loop => {
      // range 체크 (1..10 형태)
      const isRange = /for\s+\w+\s+in\s+\d+\.\.\d+/.test(loop);
      if (!isRange) {
        // 반복 컬렉션이 변경되는지 확인
        const hasModify = loop.includes('.push') || loop.includes('.pop') || loop.includes('=');
        if (!hasModify && loop.includes('for')) {
          this.bugs.push({
            type: BugType.INFINITE_LOOP,
            severity: 'high',
            message: 'Potential infinite loop: collection not modified in loop',
            suggestion: 'Ensure loop variable or collection changes',
            evidence: loop.substring(0, 50)
          });
        }
      }
    });
  }

  /**
   * 배열 버그 감지
   */
  private detectArrayBugs(): void {
    // 패턴 1: 빈 배열로 시작 후 인덱스 접근
    if (this.code.includes('[]') && this.code.match(/arr\[0\]|arr\[1\]/)) {
      this.bugs.push({
        type: BugType.EMPTY_ARRAY_ACCESS,
        severity: 'high',
        message: 'Accessing index on empty array',
        suggestion: 'Initialize array with values or use push instead of direct indexing',
        evidence: '[]'
      });
    }

    // 패턴 2: 고정 크기 배열 접근
    const arrayInit = this.code.match(/\[([0-9, ]+)\]/);
    if (arrayInit) {
      const size = arrayInit[1].split(',').length;
      const maxAccess = this.code.match(/\[(\d+)\]/);

      if (maxAccess) {
        const index = parseInt(maxAccess[1]);
        if (index >= size) {
          this.bugs.push({
            type: BugType.ARRAY_OUT_OF_BOUNDS,
            severity: 'critical',
            message: `Array index ${index} out of bounds (array size: ${size})`,
            suggestion: `Use index < ${size}`,
            evidence: `arr[${index}]`
          });
        }
      }
    }
  }

  /**
   * 메모리 누수 감지
   */
  private detectMemoryLeaks(): void {
    // 패턴: 할당 후 해제 안 함
    const allocations = this.code.match(/let\s+\w+\s*=/g) || [];
    const deallocations = this.code.match(/\bfree\b|\bdelete\b/g) || [];

    if (allocations.length > deallocations.length) {
      // 누수 가능성
      if (allocations.length - deallocations.length > 2) {
        this.bugs.push({
          type: BugType.MEMORY_LEAK,
          severity: 'medium',
          message: `Potential memory leak: ${allocations.length} allocations, ${deallocations.length} deallocations`,
          suggestion: 'Ensure all allocated variables are properly freed',
          evidence: `Mismatch: ${allocations.length} alloc vs ${deallocations.length} free`
        });
      }
    }
  }

  /**
   * 도달 불가능 코드 감지
   */
  private detectUnreachableCode(): void {
    const lines = this.code.split('\n');
    let foundReturn = false;

    lines.forEach((line, idx) => {
      if (line.includes('return')) {
        foundReturn = true;
      } else if (foundReturn && line.trim().length > 0 && !line.includes('end') && !line.includes('do')) {
        this.bugs.push({
          type: BugType.UNREACHABLE_CODE,
          severity: 'medium',
          line: idx + 1,
          message: `Unreachable code after return statement`,
          suggestion: 'Remove or reorganize code after return',
          evidence: line.trim()
        });
        foundReturn = false; // 한 번만 보고
      }
    });
  }

  /**
   * 성능 문제 감지
   */
  private detectPerformanceIssues(): void {
    // 패턴: 중첩 루프
    const nestedLoops = (this.code.match(/for/g) || []).length >= 2;
    if (nestedLoops) {
      this.bugs.push({
        type: BugType.PERFORMANCE_WARNING,
        severity: 'low',
        message: 'Nested loops detected - potential O(n²) complexity',
        suggestion: 'Consider using built-in functions like map, filter, reduce',
        evidence: 'for...for'
      });
    }

    // 패턴: 반복적인 배열 생성
    const arrayCreations = (this.code.match(/\[\]/g) || []).length;
    if (arrayCreations > 5) {
      this.bugs.push({
        type: BugType.PERFORMANCE_WARNING,
        severity: 'low',
        message: `Multiple array allocations (${arrayCreations}) - consider caching`,
        suggestion: 'Reuse arrays where possible',
        evidence: `${arrayCreations} array creations`
      });
    }
  }

  /**
   * 수정 제안 생성
   */
  private generateSuggestions(): string[] {
    const suggestions: string[] = [];

    // 버그별 제안
    const bugTypes = new Set(this.bugs.map(b => b.type));

    if (bugTypes.has(BugType.TYPE_MISMATCH)) {
      suggestions.push('Use consistent types in arrays and operations');
    }

    if (bugTypes.has(BugType.UNDEFINED_VARIABLE)) {
      suggestions.push('Declare all variables before using them');
    }

    if (bugTypes.has(BugType.NULL_POINTER)) {
      suggestions.push('Add null checks before accessing properties');
    }

    if (bugTypes.has(BugType.INFINITE_LOOP)) {
      suggestions.push('Ensure loop termination conditions are correct');
    }

    if (bugTypes.has(BugType.MEMORY_LEAK)) {
      suggestions.push('Free allocated memory when no longer needed');
    }

    if (bugTypes.has(BugType.PERFORMANCE_WARNING)) {
      suggestions.push('Consider using built-in functions for better performance');
    }

    return suggestions;
  }

  /**
   * 버그 요약
   */
  getSummary(result: CodeAnalysisResult): string {
    return `
Bugs: ${result.bugCount}
Safety Score: ${result.safetyScore}/100
Status: ${result.isSafe ? '✅ SAFE' : '🐛 UNSAFE'}

Critical: ${result.bugs.filter(b => b.severity === 'critical').length}
High: ${result.bugs.filter(b => b.severity === 'high').length}
Medium: ${result.bugs.filter(b => b.severity === 'medium').length}
Low: ${result.bugs.filter(b => b.severity === 'low').length}
    `.trim();
  }
}

/**
 * 글로벌 인스턴스
 */
export const globalBugDetector = new BugDetector();
