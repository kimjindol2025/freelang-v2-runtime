/**
 * ════════════════════════════════════════════════════════════════════
 * Diagnostics Engine
 *
 * 실시간 오류/경고 감지:
 * - 타입 오류
 * - 문법 오류
 * - 경고 (unused variables, potential issues)
 * - 정보성 메시지
 * ════════════════════════════════════════════════════════════════════
 */

import { Diagnostic, DiagnosticSeverity, Range, Position } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * 진단 엔진
 */
export class DiagnosticsEngine {
  constructor() {
    // Diagnostics engine initialization
  }

  /**
   * 문서 검증
   */
  validate(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();

    try {
      // 1. 문법 오류
      diagnostics.push(...this.checkSyntax(text, document));

      // 2. 타입 오류
      diagnostics.push(...this.checkTypes(text, document));

      // 3. 경고
      diagnostics.push(...this.checkWarnings(text, document));

      // 4. 정보성 메시지
      diagnostics.push(...this.checkInfo(text, document));

      return diagnostics;
    } catch (e) {
      console.error(`Validation error: ${e}`);
      return [];
    }
  }

  /**
   * 문법 오류 검사
   */
  private checkSyntax(text: string, document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');

    // 1. 매칭되지 않은 괄호
    diagnostics.push(...this.checkBraces(lines, document));

    // 2. 유효하지 않은 키워드 사용
    diagnostics.push(...this.checkKeywords(lines, document));

    // 3. 문 종료 확인
    diagnostics.push(...this.checkStatements(lines, document));

    return diagnostics;
  }

  /**
   * 괄호 검사
   */
  private checkBraces(lines: string[], document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    let braceCount = 0;
    let parenCount = 0;
    let bracketCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '(') parenCount++;
        else if (char === ')') parenCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;

        // 닫기가 많으면 오류
        if (braceCount < 0 || parenCount < 0 || bracketCount < 0) {
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: Range.create(
              Position.create(i, Math.max(0, line.indexOf(char))),
              Position.create(i, line.indexOf(char) + 1)
            ),
            message: 'Unexpected closing bracket',
            source: 'FreeLang Syntax'
          });

          // 리셋
          if (braceCount < 0) braceCount = 0;
          if (parenCount < 0) parenCount = 0;
          if (bracketCount < 0) bracketCount = 0;
        }
      }
    }

    // 최종 카운트 검사
    if (braceCount > 0) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: Range.create(
          Position.create(lines.length - 1, 0),
          Position.create(lines.length - 1, lines[lines.length - 1].length)
        ),
        message: `Unclosed brace: expected ${braceCount} more closing braces`,
        source: 'FreeLang Syntax'
      });
    }

    if (parenCount > 0) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: Range.create(
          Position.create(lines.length - 1, 0),
          Position.create(lines.length - 1, lines[lines.length - 1].length)
        ),
        message: `Unclosed parenthesis: expected ${parenCount} more closing parens`,
        source: 'FreeLang Syntax'
      });
    }

    return diagnostics;
  }

  /**
   * 키워드 검사
   */
  private checkKeywords(lines: string[], document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const validKeywords = [
      'trait', 'impl', 'fn', 'let', 'if', 'else', 'while', 'for', 'return',
      'extends', 'where', 'type', 'interface', 'class', 'enum'
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 잘못된 키워드 패턴 찾기
      const invalidPattern = /\b(func|function|def|var|const|const )\b/g;
      let match;

      while ((match = invalidPattern.exec(line)) !== null) {
        const keyword = match[1];
        const suggestion = keyword === 'func' || keyword === 'function' ? 'fn' :
                          keyword === 'def' ? 'fn' :
                          keyword === 'var' || keyword === 'const' ? 'let' : '?';

        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: Range.create(
            Position.create(i, match.index),
            Position.create(i, match.index + keyword.length)
          ),
          message: `Invalid keyword '${keyword}', did you mean '${suggestion}'?`,
          source: 'FreeLang Syntax'
        });
      }
    }

    return diagnostics;
  }

  /**
   * 문 검사
   */
  private checkStatements(lines: string[], document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // return 문이 블록 밖에 있는지 확인
      if (line.startsWith('return ') && !this.isInFunction(lines, i)) {
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: Range.create(
            Position.create(i, 0),
            Position.create(i, line.length)
          ),
          message: 'return statement outside of function',
          source: 'FreeLang Syntax'
        });
      }
    }

    return diagnostics;
  }

  /**
   * 타입 오류 검사
   */
  private checkTypes(text: string, document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');

    // 타입 명시가 필요한 경우
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 모호한 타입 추론
      const ambiguousPattern = /let\s+(\w+)\s*=\s*\[\s*\]/; // empty array
      const match = ambiguousPattern.exec(line);

      if (match) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: Range.create(
            Position.create(i, match.index),
            Position.create(i, match.index + match[0].length)
          ),
          message: `Cannot infer type of '${match[1]}'. Please provide explicit type.`,
          source: 'FreeLang Type Checker'
        });
      }
    }

    return diagnostics;
  }

  /**
   * 경고 검사
   */
  private checkWarnings(text: string, document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');

    // 사용하지 않는 변수
    const unusedVars = this.findUnusedVariables(text);
    for (const varInfo of unusedVars) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: Range.create(
          Position.create(varInfo.line, varInfo.column),
          Position.create(varInfo.line, varInfo.column + varInfo.name.length)
        ),
        message: `Variable '${varInfo.name}' is declared but never used`,
        source: 'FreeLang Linter'
      });
    }

    // 사용하지 않는 파라미터
    const unusedParams = this.findUnusedParameters(text);
    for (const paramInfo of unusedParams) {
      diagnostics.push({
        severity: DiagnosticSeverity.Hint,
        range: Range.create(
          Position.create(paramInfo.line, paramInfo.column),
          Position.create(paramInfo.line, paramInfo.column + paramInfo.name.length)
        ),
        message: `Parameter '${paramInfo.name}' is never used`,
        source: 'FreeLang Linter'
      });
    }

    return diagnostics;
  }

  /**
   * 정보성 메시지
   */
  private checkInfo(text: string, document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // 성능 관련 조언
    if (text.includes('let result = []') && text.length > 5000) {
      diagnostics.push({
        severity: DiagnosticSeverity.Information,
        range: Range.create(Position.create(0, 0), Position.create(0, 10)),
        message: 'Tip: Pre-allocate array if size is known for better performance',
        source: 'FreeLang Hints'
      });
    }

    return diagnostics;
  }

  /**
   * 사용하지 않는 변수 찾기
   */
  private findUnusedVariables(text: string): { name: string; line: number; column: number }[] {
    const unused: { name: string; line: number; column: number }[] = [];
    const lines = text.split('\n');
    const varPattern = /let\s+(\w+)\s*:/;

    for (let i = 0; i < lines.length; i++) {
      const match = varPattern.exec(lines[i]);
      if (match) {
        const varName = match[1];

        // 이 변수가 다른 곳에서 사용되는지 확인
        let isUsed = false;
        for (let j = i + 1; j < lines.length; j++) {
          if (new RegExp(`\\b${varName}\\b`).test(lines[j])) {
            isUsed = true;
            break;
          }
        }

        if (!isUsed) {
          unused.push({
            name: varName,
            line: i,
            column: match.index + match[0].indexOf(varName)
          });
        }
      }
    }

    return unused;
  }

  /**
   * 사용하지 않는 파라미터 찾기
   */
  private findUnusedParameters(text: string): { name: string; line: number; column: number }[] {
    const unused: { name: string; line: number; column: number }[] = [];
    const lines = text.split('\n');

    // 함수 선언에서 파라미터 추출
    const fnPattern = /fn\s+\w+\s*\(([^)]*)\)/;

    for (let i = 0; i < lines.length; i++) {
      const match = fnPattern.exec(lines[i]);
      if (match && match[1]) {
        const params = match[1].split(',');

        for (const param of params) {
          const paramName = param.split(':')[0].trim();
          if (!paramName) continue;

          // 함수 본문에서 파라미터 사용 확인
          let isUsed = false;
          for (let j = i + 1; j < lines.length; j++) {
            if (new RegExp(`\\b${paramName}\\b`).test(lines[j])) {
              isUsed = true;
              break;
            }
          }

          if (!isUsed) {
            unused.push({
              name: paramName,
              line: i,
              column: lines[i].indexOf(paramName)
            });
          }
        }
      }
    }

    return unused;
  }

  /**
   * 함수 내부에 있는지 확인
   */
  private isInFunction(lines: string[], lineIndex: number): boolean {
    let braceCount = 0;

    // 역방향으로 스캔
    for (let i = lineIndex - 1; i >= 0; i--) {
      const line = lines[i];

      for (let j = line.length - 1; j >= 0; j--) {
        if (line[j] === '}') braceCount++;
        else if (line[j] === '{') {
          braceCount--;
          if (braceCount < 0) {
            // 함수 정의인지 확인
            return /\bfn\b/.test(line);
          }
        }
      }
    }

    return false;
  }
}
