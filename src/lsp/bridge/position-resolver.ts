/**
 * Position Resolver
 *
 * Converts between LSP positions (line/character) and
 * character offsets in document content
 */

import { Position, Range } from 'vscode-languageserver';

export class PositionResolver {
  /**
   * Convert LSP Position to character offset in document
   *
   * Example:
   *   Line 0: "let x = 10;"
   *   Line 1: "print(x);"
   *
   *   Position {line: 1, character: 6} → offset 20 (points to 'x')
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
   *
   * Inverse of positionToOffset
   */
  public offsetToPosition(content: string, offset: number): Position {
    const lines = content.split('\n');
    let currentOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1; // +1 for newline
      if (currentOffset + lineLength > offset) {
        return {
          line: i,
          character: offset - currentOffset,
        };
      }
      currentOffset += lineLength;
    }

    // Offset beyond document - return last position
    const lastLine = lines.length - 1;
    return {
      line: Math.max(0, lastLine),
      character: lastLine >= 0 ? lines[lastLine].length : 0,
    };
  }

  /**
   * Find AST node at given position by offset matching
   */
  public findNodeAtPosition(ast: any, position: Position, content: string): any | null {
    if (!ast) return null;

    const offset = this.positionToOffset(content, position);
    return this.findNodeByOffset(ast, offset);
  }

  /**
   * Get Range for AST node if it has position info
   */
  public getNodeRange(node: any, content: string): Range | null {
    if (!node) {
      return null;
    }

    // If node has explicit range
    if (node.range) {
      return node.range;
    }

    // Try to compute from offsets
    if (node.start !== undefined && node.end !== undefined) {
      return {
        start: this.offsetToPosition(content, node.start),
        end: this.offsetToPosition(content, node.end),
      };
    }

    return null;
  }

  /**
   * Get context information at position in AST
   *
   * Returns:
   *   - scope: What scope we're in (global, function, block)
   *   - nearestNode: The AST node closest to this position
   *   - parentNodes: Parent nodes up to root
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

  /**
   * Check if position is in a context (e.g., after member access)
   */
  public isAfterMemberAccess(content: string, position: Position): boolean {
    const offset = this.positionToOffset(content, position);
    const beforeText = content.substring(Math.max(0, offset - 2), offset);
    return beforeText.includes('.');
  }

  /**
   * Check if position is after type annotation colon
   */
  public isAfterTypeAnnotation(content: string, position: Position): boolean {
    const offset = this.positionToOffset(content, position);
    const beforeText = content.substring(Math.max(0, offset - 5), offset);
    return /:\s*$/.test(beforeText);
  }

  /**
   * Get the word/identifier at given position
   */
  public getWordAtPosition(content: string, position: Position): string | null {
    const offset = this.positionToOffset(content, position);

    // Expand left and right from offset to find word boundaries
    let start = offset;
    let end = offset;

    // Expand left
    while (start > 0 && /[a-zA-Z0-9_]/.test(content[start - 1])) {
      start--;
    }

    // Expand right
    while (end < content.length && /[a-zA-Z0-9_]/.test(content[end])) {
      end++;
    }

    if (start === end) {
      return null;
    }

    return content.substring(start, end);
  }

  /**
   * Get line content at given line number
   */
  public getLineContent(content: string, line: number): string | null {
    const lines = content.split('\n');
    if (line < 0 || line >= lines.length) {
      return null;
    }
    return lines[line];
  }

  /**
   * Private helpers
   */

  private findNodeByOffset(node: any, offset: number): any | null {
    if (!node) return null;

    // Check if this node contains the offset
    if (node.start !== undefined && node.end !== undefined) {
      if (offset >= node.start && offset <= node.end) {
        // Check children first (more specific match)
        const childResult = this.findChildByOffset(node, offset);
        if (childResult) {
          return childResult;
        }

        return node;
      }
    }

    // Try children even if parent doesn't have offset info
    return this.findChildByOffset(node, offset);
  }

  private findChildByOffset(node: any, offset: number): any | null {
    for (const key in node) {
      if (key !== 'parent' && typeof node[key] === 'object' && node[key] !== null) {
        let result = null;

        if (Array.isArray(node[key])) {
          result = (node[key] as any[]).find(child => {
            const found = this.findNodeByOffset(child, offset);
            return !!found;
          });
        } else {
          result = this.findNodeByOffset(node[key], offset);
        }

        if (result) {
          return result;
        }
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
    if (!target) return [];

    const parents: any[] = [];

    const walk = (node: any): boolean => {
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
