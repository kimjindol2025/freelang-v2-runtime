/**
 * LSP-Compiler Bridge
 *
 * Connects LSP protocol layer to compiler infrastructure for accurate,
 * AST-based language server features (hover, completion, diagnostics, etc.)
 */

import {
  TextDocument,
  Position,
  Range,
  Location,
  Diagnostic,
  DiagnosticSeverity,
} from 'vscode-languageserver';
import { Parser } from '../../parser/parser';
import { TypeInferenceEngine } from '../../analyzer/type-inference';
import { SemanticAnalyzer } from '../../analyzer/semantic-analyzer';
// import { TypeChecker } from '../../analyzer/type-checker'; // Temporarily disabled

/**
 * Represents a parsed document with all analysis results
 */
export interface ParsedDocument {
  uri: string;
  version: number;
  content: string;
  ast: any; // ASTNode
  symbolTable: SymbolTable;
  diagnostics: Diagnostic[];
  typeInfo: Map<string, TypeInfo>;
  lastUpdateTime: number;
}

/**
 * Symbol table containing all symbols in a document
 */
export interface SymbolTable {
  global: Map<string, Symbol>;
  functions: Map<string, FunctionSymbol>;
  types: Map<string, TypeSymbol>;
  imports: Map<string, ImportSymbol>;
  variables: Map<string, VariableSymbol>;
}

/**
 * Base symbol information
 */
export interface Symbol {
  name: string;
  kind: 'variable' | 'function' | 'parameter' | 'type' | 'import' | 'class' | 'trait';
  location: Location;
  type?: string;
  documentation?: string;
  confidence?: number;
}

/**
 * Function symbol with signature information
 */
export interface FunctionSymbol extends Symbol {
  kind: 'function';
  parameters: ParameterInfo[];
  returnType?: string;
}

/**
 * Variable symbol with type information
 */
export interface VariableSymbol extends Symbol {
  kind: 'variable';
  type: string;
  confidence: number;
  mutable: boolean;
}

/**
 * Type symbol definition
 */
export interface TypeSymbol extends Symbol {
  kind: 'type';
  members?: Map<string, Symbol>;
}

/**
 * Import symbol
 */
export interface ImportSymbol extends Symbol {
  kind: 'import';
  importPath: string;
}

/**
 * Parameter information
 */
export interface ParameterInfo {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}

/**
 * Type information for a symbol
 */
export interface TypeInfo {
  type: string;
  confidence: number; // 0-1
  source: 'explicit' | 'inferred' | 'context' | 'ai-inferred';
  reasoning: string[];
  assignments: string[];
  usages: string[];
}

/**
 * LSP Compiler Bridge
 *
 * Main bridge class connecting LSP providers to compiler infrastructure
 */
export class LSPCompilerBridge {
  private documentCache: Map<string, ParsedDocument> = new Map();
  private parser: Parser;
  private typeInferenceEngine: TypeInferenceEngine;
  private semanticAnalyzer: SemanticAnalyzer;
  private typeChecker: TypeChecker;
  private positionResolver: PositionResolver;
  private symbolTableBuilder: SymbolTableBuilder;

  // Cache management
  private readonly MAX_CACHE_SIZE = 100;
  private readonly CACHE_TIMEOUT = 60000; // 60 seconds

  constructor() {
    this.parser = new Parser();
    this.typeInferenceEngine = new TypeInferenceEngine();
    this.semanticAnalyzer = new SemanticAnalyzer();
    this.typeChecker = new TypeChecker();
    this.positionResolver = new PositionResolver();
    this.symbolTableBuilder = new SymbolTableBuilder();
  }

  /**
   * Update or create parsed document for given URI
   */
  public updateDocument(uri: string, content: string): ParsedDocument {
    const existing = this.documentCache.get(uri);
    const version = existing ? existing.version + 1 : 1;

    try {
      // Parse source code to AST
      const ast = this.parser.parse(content);

      // Run semantic analysis
      const variableLifecycle = this.semanticAnalyzer.analyzeVariableLifecycle(content);
      const typeConstraints = this.semanticAnalyzer.collectTypeConstraints(content);

      // Infer types
      const typeInfo = this.inferTypeInfo(ast, content, variableLifecycle);

      // Build symbol table
      const symbolTable = this.symbolTableBuilder.build(ast, typeInfo);

      // Collect diagnostics
      const diagnostics = this.collectDiagnostics(ast, content, typeInfo);

      const parsed: ParsedDocument = {
        uri,
        version,
        content,
        ast,
        symbolTable,
        diagnostics,
        typeInfo,
        lastUpdateTime: Date.now(),
      };

      // Update cache
      this.updateCache(uri, parsed);

      return parsed;
    } catch (error: any) {
      // Return cached version on error, or create minimal document
      if (existing) {
        return existing;
      }

      return {
        uri,
        version,
        content,
        ast: null,
        symbolTable: this.createEmptySymbolTable(),
        diagnostics: [
          {
            severity: DiagnosticSeverity.Error,
            message: `Parse error: ${error.message}`,
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
          },
        ],
        typeInfo: new Map(),
        lastUpdateTime: Date.now(),
      };
    }
  }

  /**
   * Get previously parsed document from cache
   */
  public getDocument(uri: string): ParsedDocument | null {
    const doc = this.documentCache.get(uri);

    if (!doc) {
      return null;
    }

    // Check if cache is stale
    if (Date.now() - doc.lastUpdateTime > this.CACHE_TIMEOUT) {
      this.documentCache.delete(uri);
      return null;
    }

    return doc;
  }

  /**
   * Find symbol at given position in document
   */
  public findSymbolAtPosition(document: TextDocument, position: Position): Symbol | null {
    const parsed = this.getDocument(document.uri);
    if (!parsed) {
      return null;
    }

    // Find AST node at position
    const node = this.positionResolver.findNodeAtPosition(parsed.ast, position, document.getText());
    if (!node) {
      return null;
    }

    // Get node name (identifier)
    const nodeName = this.getNodeName(node);
    if (!nodeName) {
      return null;
    }

    // Look up symbol in table
    return this.findSymbolInTable(parsed.symbolTable, nodeName, position, parsed.ast);
  }

  /**
   * Find all references to a symbol
   */
  public findReferences(symbol: Symbol, document: TextDocument): Location[] {
    const parsed = this.getDocument(document.uri);
    if (!parsed || !parsed.ast) {
      return [];
    }

    return this.symbolTableBuilder.findReferences(symbol, parsed.ast, document.getText());
  }

  /**
   * Get all symbols in a document
   */
  public getSymbols(uri: string): Symbol[] {
    const parsed = this.getDocument(uri);
    if (!parsed) {
      return [];
    }

    const symbols: Symbol[] = [];
    for (const symbolMap of [
      parsed.symbolTable.global,
      parsed.symbolTable.functions,
      parsed.symbolTable.types,
      parsed.symbolTable.imports,
      parsed.symbolTable.variables,
    ]) {
      symbols.push(...symbolMap.values());
    }

    return symbols;
  }

  /**
   * Get type information for a symbol
   */
  public getTypeInfo(symbolName: string, uri: string): TypeInfo | null {
    const parsed = this.getDocument(uri);
    if (!parsed) {
      return null;
    }

    return parsed.typeInfo.get(symbolName) || null;
  }

  /**
   * Clear cache for a document
   */
  public invalidateDocument(uri: string): void {
    this.documentCache.delete(uri);
  }

  /**
   * Clear all cached documents
   */
  public clearCache(): void {
    this.documentCache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    cachedDocuments: number;
    totalSymbols: number;
    cacheSize: string;
  } {
    let totalSymbols = 0;
    for (const doc of this.documentCache.values()) {
      totalSymbols += this.countSymbols(doc.symbolTable);
    }

    return {
      cachedDocuments: this.documentCache.size,
      totalSymbols,
      cacheSize: `${(this.documentCache.size * 1000).toFixed(0)}B estimated`,
    };
  }

  /**
   * Private helper methods
   */

  private inferTypeInfo(ast: any, content: string, variableLifecycle: any): Map<string, TypeInfo> {
    const typeInfo = new Map<string, TypeInfo>();

    try {
      // Use semantic analyzer results
      const tokens = content.split(/\s+/);

      // Try type inference engine
      const inferredTypes = this.typeInferenceEngine.inferFromTokens(tokens);

      for (const varInfo of inferredTypes) {
        if (variableLifecycle && variableLifecycle.has(varInfo.name)) {
          const lifecycle = variableLifecycle.get(varInfo.name);
          typeInfo.set(varInfo.name, {
            type: varInfo.type,
            confidence: varInfo.confidence,
            source: varInfo.source || 'inferred',
            reasoning: [
              `Inferred from tokens: ${varInfo.type}`,
              `Confidence: ${(varInfo.confidence * 100).toFixed(0)}%`,
            ],
            assignments: lifecycle.assignments || [],
            usages: lifecycle.usages || [],
          });
        }
      }

      // Add explicit type annotations from AST
      this.collectExplicitTypes(ast, typeInfo);
    } catch (error) {
      // Silently fail - type info is optional
    }

    return typeInfo;
  }

  private collectExplicitTypes(ast: any, typeInfo: Map<string, TypeInfo>): void {
    if (!ast) {
      return;
    }

    // Walk AST and collect type annotations
    const walk = (node: any) => {
      if (!node) return;

      // Variable declarations with type annotations
      if (node.type === 'VariableDeclaration' && node.varType) {
        typeInfo.set(node.name, {
          type: node.varType,
          confidence: 1.0,
          source: 'explicit',
          reasoning: ['Type annotation in source code'],
          assignments: [node.name],
          usages: [],
        });
      }

      // Function parameters
      if (node.type === 'FunctionDeclaration' && node.params) {
        for (const param of node.params) {
          if (param.paramType) {
            typeInfo.set(param.name, {
              type: param.paramType,
              confidence: 1.0,
              source: 'explicit',
              reasoning: [`Parameter type annotation in function ${node.fnName}`],
              assignments: [],
              usages: [],
            });
          }
        }
      }

      // Recurse
      for (const key in node) {
        if (key !== 'parent' && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            for (const item of node[key]) {
              walk(item);
            }
          } else {
            walk(node[key]);
          }
        }
      }
    };

    walk(ast);
  }

  private collectDiagnostics(ast: any, content: string, typeInfo: Map<string, TypeInfo>): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Type mismatches
    for (const [varName, info] of typeInfo) {
      if (info.confidence < 0.5) {
        // Find variable in content
        const match = content.match(new RegExp(`\\b${varName}\\b`));
        if (match && match.index !== undefined) {
          const pos = this.positionResolver.offsetToPosition(content, match.index);
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            message: `Low confidence type inference for '${varName}': ${info.type}`,
            range: {
              start: pos,
              end: { line: pos.line, character: pos.character + varName.length },
            },
            source: 'FreeLang',
            code: 'low-confidence-type',
          });
        }
      }
    }

    return diagnostics;
  }

  private updateCache(uri: string, parsed: ParsedDocument): void {
    // Evict oldest document if cache is full
    if (this.documentCache.size >= this.MAX_CACHE_SIZE) {
      let oldest: string | null = null;
      let oldestTime = Infinity;

      for (const [key, doc] of this.documentCache) {
        if (doc.lastUpdateTime < oldestTime) {
          oldestTime = doc.lastUpdateTime;
          oldest = key;
        }
      }

      if (oldest) {
        this.documentCache.delete(oldest);
      }
    }

    this.documentCache.set(uri, parsed);
  }

  private createEmptySymbolTable(): SymbolTable {
    return {
      global: new Map(),
      functions: new Map(),
      types: new Map(),
      imports: new Map(),
      variables: new Map(),
    };
  }

  private getNodeName(node: any): string | null {
    if (!node) return null;
    if (node.name) return node.name;
    if (node.identifier) return node.identifier;
    if (node.varName) return node.varName;
    if (node.fnName) return node.fnName;
    return null;
  }

  private findSymbolInTable(
    table: SymbolTable,
    name: string,
    position: Position,
    ast: any
  ): Symbol | null {
    // Try each symbol table
    for (const symbolMap of [
      table.global,
      table.functions,
      table.types,
      table.imports,
      table.variables,
    ]) {
      const symbol = symbolMap.get(name);
      if (symbol) {
        return symbol;
      }
    }

    return null;
  }

  private countSymbols(table: SymbolTable): number {
    return (
      table.global.size +
      table.functions.size +
      table.types.size +
      table.imports.size +
      table.variables.size
    );
  }
}

/**
 * Position Resolver
 *
 * Converts between LSP positions and AST node locations
 */
export class PositionResolver {
  /**
   * Convert LSP Position to character offset in document
   */
  public positionToOffset(content: string, position: Position): number {
    const lines = content.split('\n');
    let offset = 0;

    for (let i = 0; i < position.line && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }

    if (position.line < lines.length) {
      offset += Math.min(position.character, lines[position.line].length);
    }

    return offset;
  }

  /**
   * Convert character offset to LSP Position
   */
  public offsetToPosition(content: string, offset: number): Position {
    const lines = content.split('\n');
    let currentOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1;
      if (currentOffset + lineLength > offset) {
        return {
          line: i,
          character: offset - currentOffset,
        };
      }
      currentOffset += lineLength;
    }

    return { line: 0, character: 0 };
  }

  /**
   * Find AST node at given position
   */
  public findNodeAtPosition(ast: any, position: Position, content: string): any | null {
    if (!ast) return null;

    const offset = this.positionToOffset(content, position);
    return this.findNodeByOffset(ast, offset);
  }

  /**
   * Get range for AST node
   */
  public getNodeRange(node: any, content: string): Range | null {
    if (!node || !node.start || !node.end) {
      return null;
    }

    return {
      start: this.offsetToPosition(content, node.start),
      end: this.offsetToPosition(content, node.end),
    };
  }

  /**
   * Get context information at position
   */
  public getContextAtPosition(
    ast: any,
    position: Position,
    content: string
  ): {
    scope: 'global' | 'function' | 'block' | 'unknown';
    nearestNode: any | null;
    parentNodes: any[];
  } {
    const nearestNode = this.findNodeAtPosition(ast, position, content);

    return {
      scope: this.detectScope(nearestNode),
      nearestNode,
      parentNodes: this.getParentNodes(ast, nearestNode),
    };
  }

  private findNodeByOffset(node: any, offset: number): any | null {
    if (!node) return null;

    // Simple depth-first search for matching offset
    if (node.start !== undefined && node.end !== undefined) {
      if (offset >= node.start && offset <= node.end) {
        // Check children first (more specific match)
        for (const key in node) {
          if (key !== 'parent' && typeof node[key] === 'object') {
            const childResult = Array.isArray(node[key])
              ? (node[key] as any[]).find(child => this.findNodeByOffset(child, offset))
              : this.findNodeByOffset(node[key], offset);

            if (childResult) {
              return childResult;
            }
          }
        }

        return node;
      }
    }

    return null;
  }

  private detectScope(node: any): 'global' | 'function' | 'block' | 'unknown' {
    if (!node) return 'unknown';

    let current = node;
    while (current) {
      if (current.type === 'FunctionDeclaration') {
        return 'function';
      }
      if (current.type === 'BlockStatement') {
        return 'block';
      }
      current = current.parent;
    }

    return 'global';
  }

  private getParentNodes(ast: any, target: any): any[] {
    const parents: any[] = [];

    const walk = (node: any) => {
      if (node === target) {
        return true;
      }

      for (const key in node) {
        if (key !== 'parent' && typeof node[key] === 'object' && node[key] !== null) {
          let found = false;
          if (Array.isArray(node[key])) {
            found = (node[key] as any[]).some(child => walk(child));
          } else {
            found = walk(node[key]);
          }

          if (found) {
            parents.unshift(node);
            return true;
          }
        }
      }

      return false;
    };

    walk(ast);
    return parents;
  }
}

/**
 * Symbol Table Builder
 *
 * Builds symbol tables and resolves symbols
 */
export class SymbolTableBuilder {
  /**
   * Build symbol table from AST and type information
   */
  public build(ast: any, typeInfo: Map<string, TypeInfo>): SymbolTable {
    const table: SymbolTable = {
      global: new Map(),
      functions: new Map(),
      types: new Map(),
      imports: new Map(),
      variables: new Map(),
    };

    if (!ast) {
      return table;
    }

    // Walk AST and collect symbols
    this.collectSymbols(ast, table, typeInfo, null);

    return table;
  }

  /**
   * Find all references to a symbol
   */
  public findReferences(symbol: Symbol, ast: any, content: string): Location[] {
    const references: Location[] = [];
    const posResolver = new PositionResolver();

    const walk = (node: any) => {
      if (!node) return;

      const nodeName = this.getNodeName(node);
      if (nodeName === symbol.name) {
        if (node.start !== undefined && node.end !== undefined) {
          const start = posResolver.offsetToPosition(content, node.start);
          const end = posResolver.offsetToPosition(content, node.end);
          references.push({
            uri: symbol.location.uri,
            range: { start, end },
          });
        }
      }

      // Recurse
      for (const key in node) {
        if (key !== 'parent' && typeof node[key] === 'object' && node[key] !== null) {
          if (Array.isArray(node[key])) {
            (node[key] as any[]).forEach(child => walk(child));
          } else {
            walk(node[key]);
          }
        }
      }
    };

    walk(ast);
    return references;
  }

  private collectSymbols(ast: any, table: SymbolTable, typeInfo: Map<string, TypeInfo>, parent: any): void {
    if (!ast) return;

    const walk = (node: any) => {
      if (!node) return;

      // Variable declaration
      if (node.type === 'VariableDeclaration') {
        const varType = typeInfo.get(node.name)?.type || 'any';
        const confidence = typeInfo.get(node.name)?.confidence || 0;

        const varSymbol: VariableSymbol = {
          name: node.name,
          kind: 'variable',
          type: varType,
          confidence,
          mutable: node.mutable !== false,
          location: {
            uri: 'file:///unknown',
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
          },
        };

        table.variables.set(node.name, varSymbol);
      }

      // Function declaration
      if (node.type === 'FunctionDeclaration') {
        const funcSymbol: FunctionSymbol = {
          name: node.fnName,
          kind: 'function',
          location: {
            uri: 'file:///unknown',
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
          },
          parameters: node.params?.map((p: any) => ({
            name: p.name || p.paramName,
            type: p.paramType || 'any',
            optional: p.optional || false,
          })) || [],
          returnType: node.returnType || 'any',
        };

        table.functions.set(node.fnName, funcSymbol);
      }

      // Recurse
      for (const key in node) {
        if (key !== 'parent' && typeof node[key] === 'object' && node[key] !== null) {
          if (Array.isArray(node[key])) {
            (node[key] as any[]).forEach(child => walk(child));
          } else {
            walk(node[key]);
          }
        }
      }
    };

    walk(ast);
  }

  private getNodeName(node: any): string | null {
    if (!node) return null;
    if (node.name) return node.name;
    if (node.identifier) return node.identifier;
    if (node.varName) return node.varName;
    if (node.fnName) return node.fnName;
    return null;
  }
}
