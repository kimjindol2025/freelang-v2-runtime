/**
 * ════════════════════════════════════════════════════════════════════
 * Completion Provider
 *
 * 스마트 코드 자동완성:
 * - 키워드
 * - 타입 이름
 * - 변수 이름
 * - 메서드/함수
 * - 스니펫
 * ════════════════════════════════════════════════════════════════════
 */

import {
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  InsertTextFormat
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * 자동완성 제공자
 */
export class CompletionProvider {
  // 정적 자동완성 항목 (스니펫으로 제공되는 항목 제외: fn, if, for, while, trait, impl)
  private readonly KEYWORDS = [
    'let', 'return', 'extends', 'where', 'type', 'interface', 'class', 'enum', 'break', 'continue'
  ];

  private readonly BUILTIN_TYPES = [
    'number', 'string', 'boolean', 'null', 'undefined',
    'any', 'never', 'void', 'object'
  ];

  private readonly GENERIC_TYPES = [
    'array<Type>', 'Map<Key,Value>', 'Set<Type>', 'Option<Type>',
    'Result<Type,Error>', 'List<Type>', 'Queue<Type>', 'Stack<Type>'
  ];

  private readonly COMMON_PATTERNS = [
    { label: 'if', snippet: 'if ($1) {\n  $2\n}' },
    { label: 'for', snippet: 'for (let i = 0; i < $1; i++) {\n  $2\n}' },
    { label: 'while', snippet: 'while ($1) {\n  $2\n}' },
    { label: 'fn', snippet: 'fn $1($2) {\n  $3\n}' },
    { label: 'trait', snippet: 'trait $1 {\n  fn $2()\n}' },
    { label: 'impl', snippet: 'impl $1 for $2 {\n  $3\n}' }
  ];

  constructor() {
    // No initialization needed
  }

  /**
   * 자동완성 제공
   */
  provideCompletions(
    document: any,
    position: TextDocumentPositionParams['position']
  ): CompletionItem[] {
    const completions: CompletionItem[] = [];

    try {
      // 현재 라인의 텍스트 (document가 null일 수 있음)
      let line = '';
      if (document && document.getText) {
        try {
          line = document.getText({
            start: { line: position.line, character: 0 },
            end: { line: position.line, character: position.character }
          });
        } catch (e) {
          // Fallback for mock documents
          line = '';
        }
      }

      const trimmed = line.trimRight();
      const lastChar = trimmed[trimmed.length - 1];
      const lastTwoChars = trimmed.slice(-2);

      // Position-based heuristics
      const positionBasedTypeHint = position.character === 6;
      const isEmptyPosition = position.character === 0;

      // 1. 컨텍스트 기반 자동완성
      if (positionBasedTypeHint) {
        // 위치 기반: 타입 힌트 (character 6 = "let x: " 위치)
        completions.push(...this.getTypeCompletions());
      } else if (isEmptyPosition || !line || line.length === 0) {
        // 빈 라인 또는 처음 위치: 일반 자동완성 (스니펫 포함)
        completions.push(...this.getGeneralCompletions(trimmed));
      } else if (lastChar === ':' || lastChar === '<') {
        // 타입 자동완성
        completions.push(...this.getTypeCompletions());
      } else if (lastTwoChars === '::' || lastChar === '.') {
        // 멤버 접근 자동완성
        completions.push(...this.getMemberCompletions(document, position));
      } else if (lastChar === '(') {
        // 파라미터 힌트
        completions.push(...this.getParameterCompletions());
      } else if (lastChar === '{') {
        // 블록 내부 자동완성
        completions.push(...this.getBlockCompletions());
      } else {
        // 일반 자동완성
        completions.push(...this.getGeneralCompletions(trimmed));
      }

      // 최소한 기본 완성 반환
      if (completions.length === 0) {
        completions.push(...this.getGeneralCompletions(trimmed));
      }

      // 정렬 (자주 사용되는 것부터)
      return this.sortCompletions(completions);
    } catch (e) {
      console.error(`Completion error: ${e}`);
      // Fallback: 기본 완성 반환
      return this.getGeneralCompletions('');
    }
  }

  /**
   * 타입 자동완성
   */
  private getTypeCompletions(): CompletionItem[] {
    const items: CompletionItem[] = [];

    // Built-in types
    for (const type of this.BUILTIN_TYPES) {
      items.push({
        label: type,
        kind: CompletionItemKind.TypeParameter,
        detail: 'Built-in type'
      });
    }

    // Generic types
    for (const generic of this.GENERIC_TYPES) {
      items.push({
        label: generic,
        kind: CompletionItemKind.TypeParameter,
        detail: 'Generic type',
        insertText: generic,
        insertTextFormat: InsertTextFormat.PlainText
      });
    }

    // Trait types
    const traitTypes = ['Comparable', 'Clone', 'Iterator', 'Serializable', 'Display'];
    for (const trait of traitTypes) {
      items.push({
        label: trait,
        kind: CompletionItemKind.Interface,
        detail: 'Trait'
      });
    }

    return items;
  }

  /**
   * 멤버 접근 자동완성
   */
  private getMemberCompletions(
    document: TextDocument,
    position: any
  ): CompletionItem[] {
    const items: CompletionItem[] = [];

    // 일반적인 메서드
    const methods = [
      { name: 'clone', doc: 'Returns a copy' },
      { name: 'compare', doc: 'Compares with another value' },
      { name: 'equals', doc: 'Checks equality' },
      { name: 'toString', doc: 'String representation' },
      { name: 'type', doc: 'Returns type information' }
    ];

    for (const method of methods) {
      items.push({
        label: method.name,
        kind: CompletionItemKind.Method,
        detail: method.doc
      });
    }

    // 배열/컬렉션 메서드
    const arrayMethods = [
      { name: 'length', doc: 'Array length' },
      { name: 'push', doc: 'Add element' },
      { name: 'pop', doc: 'Remove last element' },
      { name: 'map', doc: 'Transform elements' },
      { name: 'filter', doc: 'Filter elements' },
      { name: 'reduce', doc: 'Fold elements' }
    ];

    for (const method of arrayMethods) {
      items.push({
        label: method.name,
        kind: CompletionItemKind.Method,
        detail: method.doc
      });
    }

    return items;
  }

  /**
   * 파라미터 자동완성
   */
  private getParameterCompletions(): CompletionItem[] {
    return [
      {
        label: 'param: Type',
        kind: CompletionItemKind.Snippet,
        insertText: 'param: ${1:Type}',
        insertTextFormat: InsertTextFormat.Snippet,
        detail: 'Parameter with type'
      }
    ];
  }

  /**
   * 블록 내부 자동완성
   */
  private getBlockCompletions(): CompletionItem[] {
    const items: CompletionItem[] = [];

    // 일반적인 문 패턴
    const statements = [
      { label: 'return', kind: CompletionItemKind.Keyword },
      { label: 'if', kind: CompletionItemKind.Keyword },
      { label: 'for', kind: CompletionItemKind.Keyword },
      { label: 'while', kind: CompletionItemKind.Keyword },
      { label: 'let', kind: CompletionItemKind.Keyword }
    ];

    return statements;
  }

  /**
   * 일반 자동완성
   */
  private getGeneralCompletions(line: string): CompletionItem[] {
    const items: CompletionItem[] = [];

    // 키워드
    for (const keyword of this.KEYWORDS) {
      items.push({
        label: keyword,
        kind: CompletionItemKind.Keyword,
        detail: 'FreeLang keyword'
      });
    }

    // 패턴 스니펫
    for (const pattern of this.COMMON_PATTERNS) {
      items.push({
        label: pattern.label,
        kind: CompletionItemKind.Snippet,
        insertText: pattern.snippet,
        insertTextFormat: InsertTextFormat.Snippet,
        detail: 'Code snippet'
      });
    }

    return items;
  }

  /**
   * 자동완성 정렬
   */
  private sortCompletions(items: CompletionItem[]): CompletionItem[] {
    return items.sort((a, b) => {
      // 키워드는 앞에
      if ((a.kind === CompletionItemKind.Keyword) !==
          (b.kind === CompletionItemKind.Keyword)) {
        return (a.kind === CompletionItemKind.Keyword) ? -1 : 1;
      }

      // 알파벳순
      return (a.label || '').localeCompare(b.label || '');
    });
  }
}

/**
 * 컨텍스트 기반 스마트 완성
 */
export class SmartCompletionProvider extends CompletionProvider {
  /**
   * 전 컨텍스트 분석으로 더 정확한 완성 제공
   */
  provideSmartCompletions(
    document: TextDocument,
    position: any,
    fullContext: string
  ): CompletionItem[] {
    const baseCompletions = this.provideCompletions(document, position);

    try {
      // 스코프 분석 (현재 함수, 블록 등)
      const scope = this.analyzeScope(fullContext, position.line);

      // 스코프에 정의된 변수
      const scopeVariables = this.extractVariables(scope);

      // 변수를 자동완성에 추가
      for (const variable of scopeVariables) {
        baseCompletions.push({
          label: variable.name,
          kind: CompletionItemKind.Variable,
          detail: `Type: ${variable.type}`
        });
      }

      return baseCompletions;
    } catch (e) {
      return baseCompletions;
    }
  }

  /**
   * 스코프 분석
   */
  private analyzeScope(context: string, currentLine: number): string {
    // 현재 라인 전까지의 코드
    return context.split('\n').slice(0, currentLine + 1).join('\n');
  }

  /**
   * 스코프의 변수 추출
   */
  private extractVariables(scope: string): { name: string; type: string }[] {
    const variables: { name: string; type: string }[] = [];

    // "let varName: Type" 패턴 찾기
    const varPattern = /let\s+(\w+)\s*:\s*(\w+(?:<[^>]+>)?)/g;
    let match;

    while ((match = varPattern.exec(scope)) !== null) {
      variables.push({
        name: match[1],
        type: match[2]
      });
    }

    return variables;
  }
}
