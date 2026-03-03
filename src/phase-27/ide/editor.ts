/**
 * 🎨 Phase 27: Online IDE - Web-based Editor
 *
 * Ace.js 기반 실시간 편집 + 컴파일
 */

export interface EditorConfig {
  theme: 'dark' | 'light';
  fontSize: number;
  language: 'freelang' | 'typescript';
  tabSize: number;
  enableAutoCompletion: boolean;
}

export interface CompileResult {
  success: boolean;
  bytecode?: any[];
  errors: CompileError[];
  warnings: CompileWarning[];
  executionTime: number;
}

export interface CompileError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface CompileWarning {
  line: number;
  message: string;
}

/**
 * 온라인 IDE 편집기 클래스
 */
export class OnlineIDE {
  private code: string = '';
  private config: EditorConfig;
  private compileCache: Map<string, CompileResult> = new Map();
  private autoSaveEnabled: boolean = true;
  private lastCompileTime: number = 0;

  constructor(config: Partial<EditorConfig> = {}) {
    this.config = {
      theme: 'dark',
      fontSize: 14,
      language: 'freelang',
      tabSize: 2,
      enableAutoCompletion: true,
      ...config
    };
  }

  /**
   * 코드 편집
   */
  setCode(code: string): void {
    this.code = code;
    if (this.autoSaveEnabled) {
      this.autoSave();
    }
  }

  getCode(): string {
    return this.code;
  }

  /**
   * 실시간 컴파일 (WASM 시뮬레이션)
   */
  async compile(): Promise<CompileResult> {
    const startTime = performance.now();

    // 캐시 확인
    const cacheKey = this.getCacheKey(this.code);
    if (this.compileCache.has(cacheKey)) {
      return this.compileCache.get(cacheKey)!;
    }

    try {
      // 기본 문법 검사
      const errors = this.validateSyntax(this.code);
      if (errors.length > 0) {
        const result: CompileResult = {
          success: false,
          errors,
          warnings: [],
          executionTime: performance.now() - startTime
        };
        this.compileCache.set(cacheKey, result);
        return result;
      }

      // 컴파일 (실제로는 WASM으로 연결)
      const bytecode = this.generateBytecode(this.code);
      const result: CompileResult = {
        success: true,
        bytecode,
        errors: [],
        warnings: this.validateWarnings(this.code),
        executionTime: performance.now() - startTime
      };

      this.compileCache.set(cacheKey, result);
      this.lastCompileTime = result.executionTime;
      return result;
    } catch (error) {
      return {
        success: false,
        errors: [{
          line: 1,
          column: 0,
          message: String(error),
          severity: 'error'
        }],
        warnings: [],
        executionTime: performance.now() - startTime
      };
    }
  }

  /**
   * 기본 문법 검사
   */
  private validateSyntax(code: string): CompileError[] {
    const errors: CompileError[] = [];
    const lines = code.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // 닫지 않은 괄호 확인
      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        errors.push({
          line: lineNum,
          column: 0,
          message: `Mismatched parentheses (${openParens} open, ${closeParens} close)`,
          severity: 'error'
        });
      }

      // 빈 함수 정의 확인
      if (line.includes('fn ') && !/fn\s+\w+/.test(line)) {
        errors.push({
          line: lineNum,
          column: line.indexOf('fn'),
          message: 'Invalid function definition',
          severity: 'error'
        });
      }
    });

    return errors;
  }

  /**
   * 경고 검사
   */
  private validateWarnings(code: string): CompileWarning[] {
    const warnings: CompileWarning[] = [];
    const lines = code.split('\n');

    lines.forEach((line, idx) => {
      // 미사용 변수 감지
      if (line.includes('let ') && !code.includes(line.split('=')[0].trim())) {
        warnings.push({
          line: idx + 1,
          message: 'Unused variable declaration'
        });
      }
    });

    return warnings;
  }

  /**
   * 바이트코드 생성 (시뮬레이션)
   */
  private generateBytecode(code: string): any[] {
    const bytecode = [];
    const lines = code.split('\n').filter(l => l.trim());

    lines.forEach((line) => {
      if (line.includes('fn ')) {
        bytecode.push({ op: 'FUNC_DEF', args: [line.split('fn')[1].trim()] });
      } else if (line.includes('return')) {
        bytecode.push({ op: 'RETURN', args: [line.split('return')[1].trim()] });
      } else if (line.includes('=')) {
        const [varName, value] = line.split('=').map(s => s.trim());
        bytecode.push({ op: 'ASSIGN', args: [varName, value] });
      }
    });

    return bytecode;
  }

  /**
   * 캐시 키 생성 (MD5 해시)
   */
  private getCacheKey(code: string): string {
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * 자동 저장
   */
  private autoSave(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('freelang_code', this.code);
    }
  }

  /**
   * 자동 저장 복원
   */
  loadAutoSave(): boolean {
    if (typeof localStorage === 'undefined') return false;
    const saved = localStorage.getItem('freelang_code');
    if (saved) {
      this.code = saved;
      return true;
    }
    return false;
  }

  /**
   * 캐시 정리
   */
  clearCache(): void {
    this.compileCache.clear();
  }

  /**
   * 마지막 컴파일 시간 조회
   */
  getLastCompileTime(): number {
    return this.lastCompileTime;
  }

  /**
   * 설정 조회
   */
  getConfig(): EditorConfig {
    return { ...this.config };
  }

  /**
   * 설정 업데이트
   */
  updateConfig(updates: Partial<EditorConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
