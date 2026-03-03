/**
 * Symbol Index
 *
 * Fast symbol lookup across all documents in the workspace
 */

import { Location } from 'vscode-languageserver';
import type { Symbol } from './lsp-compiler-bridge';

export class SymbolIndex {
  // Global index: symbolName → [Symbol]
  private globalIndex: Map<string, Symbol[]> = new Map();

  // Per-document index: uri → Map<symbolName, Symbol>
  private documentIndex: Map<string, Map<string, Symbol>> = new Map();

  // File kind index: kind → Set<symbolName>
  private kindIndex: Map<string, Set<string>> = new Map();

  private readonly MAX_INDEX_SIZE = 100000;

  /**
   * Index symbols from a document
   */
  public indexDocument(uri: string, symbols: Symbol[]): void {
    // Clear existing document index
    this.documentIndex.delete(uri);

    const docSymbols = new Map<string, Symbol>();

    for (const symbol of symbols) {
      // Add to document index
      docSymbols.set(symbol.name, symbol);

      // Add to global index
      if (!this.globalIndex.has(symbol.name)) {
        this.globalIndex.set(symbol.name, []);
      }
      const globalSymbols = this.globalIndex.get(symbol.name)!;
      // Remove old instance from same document
      const sameDocIndex = globalSymbols.findIndex(s => s.location.uri === uri);
      if (sameDocIndex >= 0) {
        globalSymbols.splice(sameDocIndex, 1);
      }
      globalSymbols.push(symbol);

      // Add to kind index
      if (!this.kindIndex.has(symbol.kind)) {
        this.kindIndex.set(symbol.kind, new Set());
      }
      this.kindIndex.get(symbol.kind)!.add(symbol.name);
    }

    this.documentIndex.set(uri, docSymbols);

    // Check size limits
    this.enforceIndexSize();
  }

  /**
   * Remove document from index
   */
  public unindexDocument(uri: string): void {
    const symbols = this.documentIndex.get(uri);
    if (!symbols) return;

    for (const [name, symbol] of symbols) {
      const globalSymbols = this.globalIndex.get(name) || [];
      const idx = globalSymbols.findIndex(s => s.location.uri === uri);
      if (idx >= 0) {
        globalSymbols.splice(idx, 1);
      }

      if (globalSymbols.length === 0) {
        this.globalIndex.delete(name);
      }
    }

    this.documentIndex.delete(uri);
  }

  /**
   * Find symbols by name globally
   */
  public findSymbol(name: string): Symbol[] {
    return this.globalIndex.get(name) || [];
  }

  /**
   * Find symbols in specific document
   */
  public findSymbolInDocument(uri: string, name: string): Symbol | null {
    const docIndex = this.documentIndex.get(uri);
    return docIndex?.get(name) || null;
  }

  /**
   * Find symbols in workspace by pattern
   */
  public findSymbolsByPattern(pattern: string): Symbol[] {
    const regex = new RegExp(pattern);
    const results: Symbol[] = [];

    for (const [name, symbols] of this.globalIndex) {
      if (regex.test(name)) {
        results.push(...symbols);
      }
    }

    return results.slice(0, 100); // Limit results
  }

  /**
   * Find all symbols of a specific kind
   */
  public findSymbolsByKind(kind: string): Symbol[] {
    const names = this.kindIndex.get(kind) || new Set();
    const results: Symbol[] = [];

    for (const name of names) {
      const symbols = this.globalIndex.get(name) || [];
      results.push(...symbols);
    }

    return results;
  }

  /**
   * Get all symbols in a document
   */
  public getDocumentSymbols(uri: string): Symbol[] {
    const docIndex = this.documentIndex.get(uri);
    return docIndex ? Array.from(docIndex.values()) : [];
  }

  /**
   * Get workspace statistics
   */
  public getStats(): {
    documents: number;
    globalSymbols: number;
    byKind: { [kind: string]: number };
  } {
    const byKind: { [kind: string]: number } = {};
    for (const [kind, names] of this.kindIndex) {
      byKind[kind] = names.size;
    }

    return {
      documents: this.documentIndex.size,
      globalSymbols: this.globalIndex.size,
      byKind,
    };
  }

  /**
   * Clear entire index
   */
  public clear(): void {
    this.globalIndex.clear();
    this.documentIndex.clear();
    this.kindIndex.clear();
  }

  /**
   * Enforce size limits
   */
  private enforceIndexSize(): void {
    // If global index exceeds limit, evict least recently used
    if (this.globalIndex.size > this.MAX_INDEX_SIZE) {
      // Simple strategy: remove entries with no document references
      const toRemove: string[] = [];

      for (const [name, symbols] of this.globalIndex) {
        if (symbols.length === 0) {
          toRemove.push(name);
        }
      }

      for (const name of toRemove) {
        this.globalIndex.delete(name);
      }

      // If still too large, evict oldest document
      while (this.globalIndex.size > this.MAX_INDEX_SIZE && this.documentIndex.size > 0) {
        let oldest: string | null = null;
        let oldestTime = Infinity;

        // This is simplified - real implementation would track access time
        for (const uri of this.documentIndex.keys()) {
          oldest = uri;
          break;
        }

        if (oldest) {
          this.unindexDocument(oldest);
        }
      }
    }
  }
}
