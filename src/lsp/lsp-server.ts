/**
 * FreeLang Language Server Protocol (LSP) Implementation
 *
 * 지원 기능:
 * - Autocomplete (자동완성)
 * - Hover (정보 표시)
 * - Diagnostics (오류/경고)
 * - Go to Definition
 * - Rename
 */

/**
 * LSP Position
 */
export interface Position {
  line: number;
  character: number;
}

/**
 * LSP Range
 */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * LSP Location
 */
export interface Location {
  uri: string;
  range: Range;
}

/**
 * 자동완성 항목
 */
export interface CompletionItem {
  label: string;
  kind: 'Function' | 'Variable' | 'Keyword' | 'Type';
  detail?: string;
  documentation?: string;
  insertText: string;
}

/**
 * Hover 정보
 */
export interface Hover {
  contents: string;
  range?: Range;
}

/**
 * Diagnostic (오류/경고)
 */
export interface Diagnostic {
  range: Range;
  severity: 'Error' | 'Warning' | 'Information';
  message: string;
  code?: string;
}

/**
 * Edit 작업
 */
export interface Edit {
  range: Range;
  newText: string;
}

/**
 * Workspace Edit (이름 변경)
 */
export interface WorkspaceEdit {
  changes: Map<string, Edit[]>;
}

/**
 * 문서 심볼
 */
export interface DocumentSymbol {
  name: string;
  kind: 'Function' | 'Variable' | 'Class';
  location: Location;
}

/**
 * FreeLang LSP 서버
 */
export class FreeLangLSP {
  private documents: Map<string, string> = new Map();  // uri → content
  private symbols: Map<string, DocumentSymbol[]> = new Map();  // uri → symbols

  /**
   * 문서 열기
   */
  onOpen(uri: string, content: string): void {
    this.documents.set(uri, content);
    this.indexSymbols(uri, content);
  }

  /**
   * 문서 변경
   */
  onChange(uri: string, content: string): void {
    this.documents.set(uri, content);
    this.indexSymbols(uri, content);
  }

  /**
   * 문서 닫기
   */
  onClose(uri: string): void {
    this.documents.delete(uri);
    this.symbols.delete(uri);
  }

  /**
   * 자동완성
   */
  onCompletion(uri: string, position: Position): CompletionItem[] {
    const content = this.documents.get(uri) || '';
    const lines = content.split('\n');
    const line = lines[position.line] || '';
    const prefix = line.substring(0, position.character);

    const items: CompletionItem[] = [];

    // 키워드 자동완성
    const keywords = ['fn', 'let', 'if', 'else', 'while', 'for', 'return', 'true', 'false'];
    for (const kw of keywords) {
      if (kw.startsWith(prefix)) {
        items.push({
          label: kw,
          kind: 'Keyword',
          insertText: kw,
        });
      }
    }

    // 함수/변수 자동완성
    const symbols = this.symbols.get(uri) || [];
    for (const symbol of symbols) {
      if (symbol.name.startsWith(prefix)) {
        items.push({
          label: symbol.name,
          kind: symbol.kind === 'Function' ? 'Function' : 'Variable',
          insertText: symbol.name,
          detail: symbol.kind,
        });
      }
    }

    return items;
  }

  /**
   * Hover 정보
   */
  onHover(uri: string, position: Position): Hover | null {
    const content = this.documents.get(uri) || '';
    const lines = content.split('\n');
    const line = lines[position.line] || '';
    const word = this.extractWord(line, position.character);

    if (!word) {
      return null;
    }

    const symbol = this.findSymbol(uri, word);
    if (symbol) {
      return {
        contents: `${symbol.kind}: ${symbol.name}`,
        range: this.wordToRange(position),
      };
    }

    // 키워드 설명
    const keywordDocs: Record<string, string> = {
      fn: 'Define a function',
      let: 'Declare a variable',
      if: 'Conditional statement',
      while: 'Loop statement',
      for: 'Iteration statement',
      return: 'Return from function',
    };

    if (keywordDocs[word]) {
      return {
        contents: keywordDocs[word],
      };
    }

    return null;
  }

  /**
   * Diagnostics (정적 분석 결과)
   */
  onDiagnostics(uri: string): Diagnostic[] {
    const content = this.documents.get(uri) || '';
    const diagnostics: Diagnostic[] = [];

    // 간단한 검사: 미초기화 변수 사용
    const lines = content.split('\n');
    const defined = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // let 선언 찾기
      const letMatch = line.match(/let\s+(\w+)/);
      if (letMatch) {
        defined.add(letMatch[1]);
      }

      // 변수 사용 찾기
      const usageMatches = line.matchAll(/\b([a-z_]\w*)\b/g);
      for (const match of usageMatches) {
        const varName = match[1];

        // 예약어는 제외
        const keywords = ['fn', 'let', 'if', 'else', 'while', 'for', 'return', 'true', 'false'];
        if (!keywords.includes(varName) && !defined.has(varName)) {
          diagnostics.push({
            range: {
              start: { line: i, character: match.index || 0 },
              end: { line: i, character: (match.index || 0) + varName.length },
            },
            severity: 'Error',
            message: `Undefined variable: ${varName}`,
            code: 'undefined-var',
          });
        }
      }
    }

    return diagnostics;
  }

  /**
   * Go to Definition
   */
  onDefinition(uri: string, position: Position): Location | null {
    const content = this.documents.get(uri) || '';
    const lines = content.split('\n');
    const line = lines[position.line] || '';
    const word = this.extractWord(line, position.character);

    if (!word) {
      return null;
    }

    // 심볼 찾기
    const symbol = this.findSymbol(uri, word);
    if (symbol) {
      return symbol.location;
    }

    return null;
  }

  /**
   * Rename Symbol
   */
  onRename(uri: string, position: Position, newName: string): WorkspaceEdit {
    const content = this.documents.get(uri) || '';
    const lines = content.split('\n');
    const line = lines[position.line] || '';
    const oldName = this.extractWord(line, position.character);

    const changes = new Map<string, Edit[]>();
    const edits: Edit[] = [];

    if (!oldName) {
      return { changes };
    }

    // 모든 발생 위치 찾기
    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];
      const regex = new RegExp(`\\b${oldName}\\b`, 'g');
      let match;

      while ((match = regex.exec(currentLine)) !== null) {
        edits.push({
          range: {
            start: { line: i, character: match.index },
            end: { line: i, character: match.index + oldName.length },
          },
          newText: newName,
        });
      }
    }

    changes.set(uri, edits);
    return { changes };
  }

  /**
   * 문서 심볼 추출
   */
  private indexSymbols(uri: string, content: string): void {
    const symbols: DocumentSymbol[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 함수 정의
      const fnMatch = line.match(/fn\s+(\w+)\s*\(/);
      if (fnMatch) {
        symbols.push({
          name: fnMatch[1],
          kind: 'Function',
          location: {
            uri,
            range: {
              start: { line: i, character: 0 },
              end: { line: i, character: line.length },
            },
          },
        });
      }

      // 변수 선언
      const letMatch = line.match(/let\s+(\w+)/);
      if (letMatch) {
        symbols.push({
          name: letMatch[1],
          kind: 'Variable',
          location: {
            uri,
            range: {
              start: { line: i, character: 0 },
              end: { line: i, character: line.length },
            },
          },
        });
      }
    }

    this.symbols.set(uri, symbols);
  }

  /**
   * 심볼 찾기
   */
  private findSymbol(uri: string, name: string): DocumentSymbol | null {
    const symbols = this.symbols.get(uri) || [];
    return symbols.find(s => s.name === name) || null;
  }

  /**
   * 위치에서 단어 추출
   */
  private extractWord(line: string, character: number): string {
    let start = character;
    let end = character;

    while (start > 0 && /\w/.test(line[start - 1])) {
      start--;
    }

    while (end < line.length && /\w/.test(line[end])) {
      end++;
    }

    return line.substring(start, end);
  }

  /**
   * 단어를 Range로 변환
   */
  private wordToRange(position: Position): Range {
    return {
      start: { line: position.line, character: Math.max(0, position.character - 1) },
      end: { line: position.line, character: position.character + 1 },
    };
  }
}

/**
 * LSP 서버 팩토리
 */
export function createLSPServer(): FreeLangLSP {
  return new FreeLangLSP();
}

/**
 * JSON-RPC 메서드 매핑
 */
export const LSP_METHODS = {
  'textDocument/completion': 'onCompletion',
  'textDocument/hover': 'onHover',
  'textDocument/diagnostics': 'onDiagnostics',
  'textDocument/definition': 'onDefinition',
  'textDocument/rename': 'onRename',
};
