/**
 * Incremental Parser for LSP
 *
 * Optimizes parsing performance by only re-parsing changed regions
 * instead of full document re-parse on every keystroke
 */

import { Range } from 'vscode-languageserver';

export interface ParseChange {
  range: Range;
  text: string;
  rangeLength: number;
}

export class IncrementalParser {
  private cache: Map<string, ParseCache> = new Map();
  private readonly MAX_CACHE_SIZE = 50;

  /**
   * Parse incrementally based on document changes
   */
  public parseIncremental(
    uri: string,
    previousAST: any,
    changes: ParseChange[],
    fullContent: string
  ): any {
    // For now, return full parse (full incremental parsing is complex)
    // In production, would cache and only re-parse affected nodes

    const cacheKey = `${uri}:${fullContent.length}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.ast && !this.needsFullReparse(changes)) {
      return cached.ast;
    }

    // Return null to signal full reparse needed
    return null;
  }

  /**
   * Invalidate cache for specific range
   */
  public invalidateRange(uri: string, range: Range): void {
    // Clear any cached parse info for this document
    const cacheKey = uri;
    this.cache.delete(cacheKey);
  }

  /**
   * Get cached node if available
   */
  public getCachedNode(uri: string, nodeKey: string): any | null {
    const cache = this.cache.get(uri);
    return cache?.nodeCache.get(nodeKey) || null;
  }

  /**
   * Cache a parsed node
   */
  public cacheNode(uri: string, nodeKey: string, node: any): void {
    let cache = this.cache.get(uri);
    if (!cache) {
      cache = {
        ast: null,
        nodeCache: new Map(),
        timestamp: Date.now(),
      };
      this.cache.set(uri, cache);
    }

    // Evict old entries if cache grows too large
    if (cache.nodeCache.size > 1000) {
      const firstKey = cache.nodeCache.keys().next().value;
      cache.nodeCache.delete(firstKey);
    }

    cache.nodeCache.set(nodeKey, node);
    cache.timestamp = Date.now();
  }

  /**
   * Clear stale cache entries (older than 5 minutes)
   */
  public clearStaleCache(): void {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    for (const [uri, cache] of this.cache) {
      if (now - cache.timestamp > timeout) {
        this.cache.delete(uri);
      }
    }

    // Also evict oldest if cache is too large
    while (this.cache.size > this.MAX_CACHE_SIZE) {
      let oldest: string | null = null;
      let oldestTime = Infinity;

      for (const [uri, cache] of this.cache) {
        if (cache.timestamp < oldestTime) {
          oldestTime = cache.timestamp;
          oldest = uri;
        }
      }

      if (oldest) {
        this.cache.delete(oldest);
      }
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    cacheSize: number;
    totalNodes: number;
  } {
    let totalNodes = 0;
    for (const cache of this.cache.values()) {
      totalNodes += cache.nodeCache.size;
    }

    return {
      cacheSize: this.cache.size,
      totalNodes,
    };
  }

  private needsFullReparse(changes: ParseChange[]): boolean {
    // If multiple changes or large changes, do full reparse
    if (changes.length > 5) {
      return true;
    }

    let totalChangeSize = 0;
    for (const change of changes) {
      totalChangeSize += change.rangeLength + change.text.length;
    }

    // If changes exceed threshold, full reparse
    return totalChangeSize > 500;
  }
}

interface ParseCache {
  ast: any;
  nodeCache: Map<string, any>;
  timestamp: number;
}
