/**
 * Enhanced LSP Providers
 *
 * Bridge-aware implementations of LSP providers with full integration
 * to compiler infrastructure for accurate analysis
 */

import {
  Hover,
  CompletionItem,
  CompletionItemKind,
  Location,
  Diagnostic,
  DiagnosticSeverity,
  MarkupKind,
  Position,
  Range,
  SignatureHelp,
  SignatureInformation,
  ParameterInformation,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { LSPCompilerBridge, TypeInfo } from './lsp-compiler-bridge';
import { PositionResolver } from './position-resolver';

/**
 * Enhanced Hover Provider using Bridge
 */
export class EnhancedHoverProvider {
  private positionResolver: PositionResolver;

  constructor(private bridge: LSPCompilerBridge) {
    this.positionResolver = new PositionResolver();
  }

  provideHover(document: TextDocument, position: Position): Hover | null {
    const word = this.positionResolver.getWordAtPosition(document.getText(), position);
    if (!word) return null;

    const parsed = this.bridge.getDocument(document.uri);
    if (!parsed) return null;

    const typeInfo = parsed.typeInfo.get(word);
    if (!typeInfo) return null;

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: this.formatHover(word, typeInfo),
      },
    };
  }

  private formatHover(symbolName: string, typeInfo: TypeInfo): string {
    const lines: string[] = [];

    // Type signature
    lines.push(`**${symbolName}**: \`${typeInfo.type}\``);
    lines.push('');

    // Confidence
    const confidencePercent = (typeInfo.confidence * 100).toFixed(0);
    const confidenceBar = this.getConfidenceBar(typeInfo.confidence);
    lines.push(`${confidenceBar} ${confidencePercent}% confidence`);
    lines.push('');

    // Source
    const sourceLabel = {
      explicit: '명시적 타입 주석',
      inferred: '추론된 타입',
      context: '문맥 기반',
      'ai-inferred': 'AI 추론',
    }[typeInfo.source] || typeInfo.source;
    lines.push(`Source: *${sourceLabel}*`);
    lines.push('');

    // Reasoning
    if (typeInfo.reasoning.length > 0) {
      lines.push('**Reasoning**:');
      for (const reason of typeInfo.reasoning) {
        lines.push(`- ${reason}`);
      }
    }

    return lines.join('\n');
  }

  private getConfidenceBar(confidence: number): string {
    const filled = Math.round(confidence * 10);
    const empty = 10 - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }
}

/**
 * Enhanced Completion Provider using Bridge
 */
export class EnhancedCompletionProvider {
  private positionResolver: PositionResolver;
  private readonly KEYWORDS = [
    'let', 'return', 'extends', 'where', 'type', 'interface', 'class', 'enum',
    'break', 'continue', 'async', 'await', 'match', 'fn', 'trait', 'impl',
  ];
  private readonly BUILTIN_TYPES = [
    'number', 'string', 'boolean', 'null', 'undefined', 'any', 'void', 'object',
  ];

  constructor(private bridge: LSPCompilerBridge) {
    this.positionResolver = new PositionResolver();
  }

  provideCompletions(document: TextDocument, position: Position): CompletionItem[] {
    const completions: CompletionItem[] = [];
    const content = document.getText();
    const word = this.positionResolver.getWordAtPosition(content, position);
    const context = content.substring(Math.max(0, this.positionResolver.positionToOffset(content, position) - 50), this.positionResolver.positionToOffset(content, position));

    // 1. Keyword completions
    const keywords = this.KEYWORDS.filter(k => k.startsWith(word || ''));
    completions.push(...keywords.map(k => ({
      label: k,
      kind: CompletionItemKind.Keyword,
      sortText: `0${k}`,
    })));

    // 2. Type completions
    if (context.includes(':')) {
      const types = this.BUILTIN_TYPES.filter(t => t.startsWith(word || ''));
      completions.push(...types.map(t => ({
        label: t,
        kind: CompletionItemKind.TypeParameter,
        sortText: `1${t}`,
      })));
    }

    // 3. Symbol completions from bridge
    const parsed = this.bridge.getDocument(document.uri);
    if (parsed) {
      const symbols = this.bridge.getSymbols(document.uri);
      for (const symbol of symbols) {
        if (symbol.name.startsWith(word || '')) {
          completions.push({
            label: symbol.name,
            kind: this.symbolKindToCompletionKind(symbol.kind),
            detail: symbol.type || 'unknown',
            sortText: `2${symbol.name}`,
          });
        }
      }
    }

    // 4. Snippet completions
    const snippets = this.getSnippets(word);
    completions.push(...snippets);

    return completions;
  }

  private getSnippets(word: string | null): CompletionItem[] {
    const snippets = [
      { label: 'fn', insertText: 'fn ${1:name}(${2:params}) {\n  ${3:body}\n}' },
      { label: 'if', insertText: 'if ${1:condition} {\n  ${2:body}\n}' },
      { label: 'for', insertText: 'for ${1:i} in ${2:range} {\n  ${3:body}\n}' },
      { label: 'while', insertText: 'while ${1:condition} {\n  ${2:body}\n}' },
      { label: 'match', insertText: 'match ${1:expr} {\n  ${2:pattern} => ${3:expr},\n}' },
      { label: 'trait', insertText: 'trait ${1:Name} {\n  fn ${2:method}();\n}' },
    ];

    return snippets
      .filter(s => !word || s.label.startsWith(word))
      .map(s => ({
        label: s.label,
        kind: CompletionItemKind.Snippet,
        insertText: s.insertText,
        insertTextFormat: 2, // Snippet format
        sortText: `3${s.label}`,
      }));
  }

  private symbolKindToCompletionKind(kind: string): CompletionItemKind {
    const mapping: { [key: string]: CompletionItemKind } = {
      variable: CompletionItemKind.Variable,
      function: CompletionItemKind.Function,
      type: CompletionItemKind.TypeParameter,
      import: CompletionItemKind.Module,
      class: CompletionItemKind.Class,
      trait: CompletionItemKind.Interface,
    };
    return mapping[kind] || CompletionItemKind.Text;
  }
}

/**
 * Enhanced Definition Provider using Bridge
 */
export class EnhancedDefinitionProvider {
  private positionResolver: PositionResolver;

  constructor(private bridge: LSPCompilerBridge) {
    this.positionResolver = new PositionResolver();
  }

  provideDefinition(document: TextDocument, position: Position): Location | null {
    const word = this.positionResolver.getWordAtPosition(document.getText(), position);
    if (!word) return null;

    const parsed = this.bridge.getDocument(document.uri);
    if (!parsed) return null;

    // Try to find symbol in table
    const symbols = this.bridge.getSymbols(document.uri);
    const symbol = symbols.find(s => s.name === word);

    if (symbol) {
      return symbol.location;
    }

    return null;
  }

  provideReferences(document: TextDocument, position: Position): Location[] {
    const word = this.positionResolver.getWordAtPosition(document.getText(), position);
    if (!word) return [];

    const parsed = this.bridge.getDocument(document.uri);
    if (!parsed || !parsed.ast) return [];

    const symbols = this.bridge.getSymbols(document.uri);
    const symbol = symbols.find(s => s.name === word);

    if (!symbol) return [];

    return this.bridge.findReferences(symbol, document);
  }
}

/**
 * Enhanced Diagnostics Engine
 */
export class EnhancedDiagnosticsEngine {
  constructor(private bridge: LSPCompilerBridge) {}

  validateDocument(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const uri = document.uri;

    // Update document in bridge (triggers parsing and analysis)
    const parsed = this.bridge.updateDocument(uri, document.getText());

    // 1. Parsing errors from diagnostics
    diagnostics.push(...parsed.diagnostics);

    // 2. Type errors from type info
    for (const [name, typeInfo] of parsed.typeInfo) {
      if (typeInfo.confidence < 0.4) {
        const content = document.getText();
        const offset = this.findSymbolOffset(content, name);
        if (offset >= 0) {
          const positionResolver = new PositionResolver();
          const pos = positionResolver.offsetToPosition(content, offset);
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: {
              start: pos,
              end: { line: pos.line, character: pos.character + name.length },
            },
            message: `Low confidence type inference: ${typeInfo.type}`,
            source: 'FreeLang Type Inference',
            code: 'low-confidence',
          });
        }
      }
    }

    return diagnostics;
  }

  private findSymbolOffset(content: string, symbolName: string): number {
    const match = content.match(new RegExp(`\\b${symbolName}\\b`));
    return match?.index ?? -1;
  }
}

/**
 * Enhanced Signature Help Provider
 */
export class EnhancedSignatureHelpProvider {
  private positionResolver: PositionResolver;

  constructor(private bridge: LSPCompilerBridge) {
    this.positionResolver = new PositionResolver();
  }

  provideSignatureHelp(document: TextDocument, position: Position): SignatureHelp | null {
    const word = this.positionResolver.getWordAtPosition(document.getText(), position);
    if (!word) return null;

    const parsed = this.bridge.getDocument(document.uri);
    if (!parsed) return null;

    const symbols = this.bridge.getSymbols(document.uri);
    const symbol = symbols.find(s => s.name === word && s.kind === 'function');

    if (!symbol || symbol.kind !== 'function') return null;

    const func = symbol as any;
    const parameters = (func.parameters || []).map(
      (p: any) =>
        ({
          label: `${p.name}: ${p.type || 'any'}`,
          documentation: p.documentation,
        } as ParameterInformation)
    );

    const signature: SignatureInformation = {
      label: `${symbol.name}(${parameters.map(p => p.label).join(', ')}) → ${func.returnType || 'any'}`,
      parameters,
      documentation: symbol.documentation,
    };

    return {
      signatures: [signature],
      activeSignature: 0,
      activeParameter: 0,
    };
  }
}
