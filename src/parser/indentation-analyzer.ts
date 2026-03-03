/**
 * Phase 1 Task 1.2: Indentation Analyzer
 *
 * Analyzes indentation levels to support indentation-based blocks (Python-like)
 * without requiring braces { }
 *
 * Features:
 * - Track indentation levels per line
 * - Detect block start/end from indent changes
 * - Support mixed tabs and spaces (normalized to spaces)
 * - Convert indent sequences to INDENT/DEDENT tokens
 */

export interface IndentLevel {
  line: number;
  column: number;
  indent: number; // Normalized to spaces (1 tab = 2 spaces)
  type: 'INDENT' | 'SAME' | 'DEDENT';
  dedentLevels?: number; // Number of levels dedented
}

export class IndentationAnalyzer {
  private indentStack: number[] = [0]; // Stack of indentation levels
  private lines: string[] = [];
  private indentMap: Map<number, number> = new Map(); // line -> indent level

  constructor(source: string) {
    this.lines = source.split('\n');
    this.analyze();
  }

  /**
   * Analyze all lines and build indentation map
   */
  private analyze(): void {
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];

      // Skip empty lines and comments
      if (line.trim() === '' || line.trim().startsWith('//')) {
        continue;
      }

      const indent = this.getIndentLevel(line);
      this.indentMap.set(i, indent);
    }
  }

  /**
   * Get normalized indentation level (0, 1, 2, 3, ...)
   * Counts logical indents, not spaces/tabs
   */
  getIndentLevel(line: string): number {
    let spaces = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === ' ') {
        spaces++;
      } else if (line[i] === '\t') {
        spaces += 2; // 1 tab = 2 spaces
      } else {
        break;
      }
    }
    // Each indentation unit is 2 spaces
    return Math.floor(spaces / 2);
  }

  /**
   * Get indent level at specific line
   */
  getLineIndent(lineNum: number): number {
    return this.indentMap.get(lineNum) ?? 0;
  }

  /**
   * Analyze indentation changes (INDENT/SAME/DEDENT)
   */
  analyzeIndentChanges(): IndentLevel[] {
    const changes: IndentLevel[] = [];
    let prevIndent = 0;
    let lineNum = 0;

    for (const [line, indent] of this.indentMap) {
      if (indent > prevIndent) {
        // INDENT: increase in indentation
        changes.push({
          line,
          column: indent * 2,
          indent,
          type: 'INDENT'
        });
      } else if (indent < prevIndent) {
        // DEDENT: decrease in indentation
        const dedentLevels = prevIndent - indent;
        changes.push({
          line,
          column: 0,
          indent,
          type: 'DEDENT',
          dedentLevels
        });
      } else {
        // SAME: same indentation
        changes.push({
          line,
          column: indent * 2,
          indent,
          type: 'SAME'
        });
      }
      prevIndent = indent;
    }

    return changes;
  }

  /**
   * Check if a line starts a block (followed by more indented lines)
   */
  startsBlock(lineNum: number): boolean {
    const currentIndent = this.getLineIndent(lineNum);

    // Find next non-empty line
    for (let i = lineNum + 1; i < this.lines.length; i++) {
      const nextIndent = this.indentMap.get(i);
      if (nextIndent !== undefined) {
        return nextIndent > currentIndent;
      }
    }

    return false;
  }

  /**
   * Get all lines in a block (starting at lineNum)
   */
  getBlockLines(lineNum: number): number[] {
    const blockIndent = this.getLineIndent(lineNum);
    const blockLines: number[] = [lineNum];

    for (let i = lineNum + 1; i < this.lines.length; i++) {
      const lineIndent = this.indentMap.get(i);
      if (lineIndent === undefined) {
        continue; // Skip empty lines
      }

      if (lineIndent > blockIndent) {
        blockLines.push(i);
      } else {
        // Block ended
        break;
      }
    }

    return blockLines;
  }

  /**
   * Extract text content from block
   */
  getBlockContent(lineNum: number): string {
    const blockLines = this.getBlockLines(lineNum);
    const baseIndent = this.getLineIndent(lineNum);

    const content = blockLines
      .map(ln => {
        const line = this.lines[ln];
        const indent = this.getLineIndent(ln);
        const relativeIndent = indent - baseIndent - 1; // -1 for one level deeper
        const dedented = line.substring((indent - relativeIndent) * 2);
        return dedented.trim();
      })
      .join('\n');

    return content;
  }

  /**
   * Get source lines
   */
  getLines(): string[] {
    return this.lines;
  }

  /**
   * Get full indentation map
   */
  getIndentMap(): Map<number, number> {
    return new Map(this.indentMap);
  }
}
