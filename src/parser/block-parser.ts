/**
 * Phase 1 Task 1.2: Block Parser with Indentation-Based Syntax
 *
 * Parses blocks without requiring braces { }
 * Uses indentation (whitespace) to define block boundaries
 *
 * Supported syntax:
 * - Function definitions: fn name input type output type
 * - If/else blocks:
 *     if (condition)
 *       statement1
 *       statement2
 *     else
 *       statement3
 * - For/while loops:
 *     for i in 0..10
 *       sum = sum + i
 * - Function bodies (multi-line without braces):
 *     fn calculate(x, y)
 *       temp = x * 2
 *       result = temp + y
 *       return result
 *
 * Key features:
 * - Automatic block detection from indentation
 * - Support for nested blocks
 * - Conversion between indent-based and brace-based syntax
 */

import { Statement } from './statement-parser';
import { IndentationAnalyzer } from './indentation-analyzer';

export interface BlockStatement {
  type: 'if' | 'else' | 'for' | 'while' | 'function' | 'loop' | 'match';
  header: string; // if condition, for loop definition, etc.
  body: Statement[]; // Statements inside the block
  indent: number; // Indentation level
  line: number; // Starting line number
  hasElse?: BlockStatement; // For if-else chains
}

export interface ConvertedBlock {
  indent_based: string; // Original indentation-based syntax
  brace_based: string; // Converted to { } syntax
}

export class BlockParser {
  private analyzer: IndentationAnalyzer;
  private statements: Statement[] = [];
  private blocks: BlockStatement[] = [];
  private source: string;  // FIXED: Store source code for line tracking
  private sourceLines: string[];  // FIXED: Cache source lines

  constructor(source: string, statements: Statement[]) {
    this.source = source;
    this.sourceLines = source.split('\n');
    this.analyzer = new IndentationAnalyzer(source);
    this.statements = statements;
    this.parseBlocks();
  }

  /**
   * Parse all blocks in the source
   */
  private parseBlocks(): void {
    this.blocks = [];

    for (let i = 0; i < this.statements.length; i++) {
      const stmt = this.statements[i];

      if (this.isBlockStarter(stmt)) {
        const block = this.parseBlock(stmt, i);
        if (block) {
          this.blocks.push(block);
        }
      }
    }
  }

  /**
   * Check if statement starts a block
   */
  private isBlockStarter(stmt: Statement): boolean {
    return (
      stmt.type === 'if' ||
      stmt.type === 'for' ||
      stmt.type === 'while' ||
      stmt.type === 'match' ||
      stmt.text.startsWith('fn ') ||
      stmt.text.includes('else')
    );
  }

  /**
   * Get block type from statement
   */
  private getBlockType(stmt: Statement): BlockStatement['type'] {
    if (stmt.type === 'if') return 'if';
    if (stmt.type === 'for') return 'for';
    if (stmt.type === 'while') return 'while';
    if (stmt.type === 'match') return 'match';
    if (stmt.text.startsWith('fn ')) return 'function';
    if (stmt.text.includes('else')) return 'else';
    return 'loop';
  }

  /**
   * Parse a single block starting at statement index
   * Returns the block and updates the index to skip consumed statements
   */
  private parseBlock(stmt: Statement, startIdx: number): BlockStatement {
    const type = this.getBlockType(stmt);

    // Get the actual indentation level from the source
    const lines = this.analyzer.getLines();
    const indentMap = this.analyzer.getIndentMap();

    // Find the base indent level (the header's indentation)
    let baseIndent = 0;
    let actualBlockLine = stmt.line; // FIXED: Track the actual source line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === stmt.text || line.startsWith(stmt.text)) {
        baseIndent = this.analyzer.getLineIndent(i);
        actualBlockLine = i; // FIXED: Save the actual line number
        break;
      }
    }

    // Collect body statements (more indented than header)
    const bodyStatements: Statement[] = [];
    let idx = startIdx + 1;
    const bodyIndent = baseIndent + 1; // Body should be indented one level more

    while (idx < this.statements.length) {
      const nextStmt = this.statements[idx];

      // Find the actual indent of this statement in source
      let stmtIndent = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes(nextStmt.text)) {
          stmtIndent = this.analyzer.getLineIndent(i);
          break;
        }
      }

      // If statement is not more indented than body indent, block ends
      if (stmtIndent <= baseIndent) {
        break;
      }

      // If statement is in the right indent range, it's part of this block
      if (stmtIndent > baseIndent) {
        bodyStatements.push(nextStmt);
      }

      idx++;
    }

    return {
      type,
      header: stmt.text,
      body: bodyStatements,
      indent: baseIndent,
      line: actualBlockLine, // FIXED: Use actual source line number
    };
  }

  /**
   * Convert indent-based code to brace-based code
   *
   * Example:
   * INPUT:
   *   if x > 5
   *     print(x)
   *     x = x - 1
   *   else
   *     print("x is small")
   *
   * OUTPUT:
   *   if (x > 5) {
   *     print(x)
   *     x = x - 1
   *   } else {
   *     print("x is small")
   *   }
   */
  public convertToBraces(source: string): ConvertedBlock {
    const lines = source.split('\n');
    const result: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const indent = this.getLineIndent(line);
      const trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // Check for block starters
      if (this.startsBlock(trimmed)) {
        const { converted, nextIdx } = this.convertBlockWithBraces(
          lines,
          i,
          indent
        );
        result.push(converted);
        i = nextIdx;
      } else {
        result.push(line);
        i++;
      }
    }

    return {
      indent_based: source,
      brace_based: result.join('\n'),
    };
  }

  /**
   * Convert a single block to brace-based syntax
   */
  private convertBlockWithBraces(
    lines: string[],
    startIdx: number,
    baseIndent: number
  ): { converted: string; nextIdx: number } {
    const line = lines[startIdx].trim();
    const result: string[] = [];

    // Add header with opening brace
    const header = this.normalizeHeader(line);
    result.push(header + ' {');

    // Collect and convert body
    let i = startIdx + 1;
    while (i < lines.length) {
      const currentLine = lines[i];
      const currentIndent = this.getLineIndent(currentLine);
      const trimmed = currentLine.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // If indent is not greater than base, block ends
      if (currentIndent <= baseIndent) {
        break;
      }

      // Add body line with normalized indent
      const relativeIndent = currentIndent - baseIndent - 1;
      const bodyIndent = '  '.repeat(Math.max(0, relativeIndent + 1));
      result.push(bodyIndent + trimmed);

      i++;
    }

    // Add closing brace
    result.push('}');

    return {
      converted: result.join('\n'),
      nextIdx: i,
    };
  }

  /**
   * Normalize header syntax for brace-based blocks
   * - if x > 5  →  if (x > 5)
   * - for i in 0..10  →  for (i in 0..10)
   */
  private normalizeHeader(header: string): string {
    if (header.startsWith('if ')) {
      const condition = header.substring(3);
      return `if (${condition})`;
    }

    if (header.startsWith('for ')) {
      const loopDef = header.substring(4);
      return `for (${loopDef})`;
    }

    if (header.startsWith('while ')) {
      const condition = header.substring(6);
      return `while (${condition})`;
    }

    if (header.startsWith('fn ')) {
      // Function declaration stays mostly the same
      return header;
    }

    return header;
  }

  /**
   * Check if a line starts a block
   */
  private startsBlock(line: string): boolean {
    return (
      line.startsWith('if ') ||
      line.startsWith('for ') ||
      line.startsWith('while ') ||
      line.startsWith('match ') ||
      line.startsWith('fn ') ||
      line === 'else'
    );
  }

  /**
   * Get normalized indentation level from a line
   */
  private getLineIndent(line: string): number {
    let spaces = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === ' ') {
        spaces++;
      } else if (line[i] === '\t') {
        spaces += 2;
      } else {
        break;
      }
    }
    return Math.floor(spaces / 2);
  }

  /**
   * Get parsed blocks
   */
  public getBlocks(): BlockStatement[] {
    return [...this.blocks];
  }

  /**
   * Get block at specific line number (block header line)
   * Returns the block whose header is at the specified line number
   */
  public getBlockAt(line: number): BlockStatement | undefined {
    // FIXED: Use actual source line stored in block.line
    return this.blocks.find(b => b.line === line);
  }

  /**
   * Check if a line is inside a block
   * FIXED: Look for block header with strictly less indentation
   */
  public isInBlock(line: number): boolean {
    if (line >= this.sourceLines.length) return false;

    const targetLine = this.sourceLines[line];
    const targetIndent = this.getLineIndent(targetLine);

    // Skip empty lines
    if (targetLine.trim() === '') return false;

    // Look backwards for a line with STRICTLY LESS indentation
    for (let i = line - 1; i >= 0; i--) {
      const checkLine = this.sourceLines[i];
      if (checkLine.trim() === '') continue;

      const checkIndent = this.getLineIndent(checkLine);
      const checkText = checkLine.trim();

      // If we find a line with LESS indentation
      if (checkIndent < targetIndent) {
        // Check if it's a block starter
        if (checkText.startsWith('if ') || checkText.startsWith('for ') ||
            checkText.startsWith('while ') || checkText.startsWith('fn ') ||
            checkText.startsWith('match ')) {
          // This line is inside the block
          return true;
        } else {
          // Found a less-indented non-block line, so target is NOT in any block
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Find the actual source line where block starts
   */
  private findActualBlockStartLine(block: BlockStatement): number | undefined {
    const headerStart = block.header.split(/\s+/)[0];  // 'if', 'for', 'while', 'fn'

    for (let i = 0; i < this.sourceLines.length; i++) {
      const line = this.sourceLines[i].trim();
      if (line.startsWith(headerStart) &&
          (line === block.header || block.header.includes(line.split(/\s+/)[0]))) {
        const lineIndent = this.getLineIndent(this.sourceLines[i]);
        if (lineIndent === block.indent) {
          return i;
        }
      }
    }

    return undefined;
  }

  /**
   * Get parent block of a line
   * Fixed: Use actual statement lines instead of body.length
   */
  public getParentBlock(line: number): BlockStatement | undefined {
    // Find the innermost block containing this line
    let parent: BlockStatement | undefined;
    for (const block of this.blocks) {
      if (block.line >= line) continue;

      // Get actual last line of block
      if (block.body.length === 0) continue;
      const lastStmtLine = block.body[block.body.length - 1]?.line ?? block.line;

      if (line <= lastStmtLine) {
        if (!parent || block.indent > parent.indent) {
          parent = block;
        }
      }
    }
    return parent;
  }

  /**
   * Validate block structure
   * Returns array of errors if any
   */
  public validate(): string[] {
    const errors: string[] = [];

    for (const block of this.blocks) {
      // Check for unmatched braces in header
      const openBraces = (block.header.match(/\{/g) || []).length;
      const closeBraces = (block.header.match(/\}/g) || []).length;

      if (openBraces !== closeBraces) {
        errors.push(`Line ${block.line}: Unmatched braces in block header`);
      }

      // Check if block has body
      if (
        block.type !== 'else' &&
        block.body.length === 0
      ) {
        errors.push(`Line ${block.line}: Block '${block.type}' has empty body`);
      }
    }

    return errors;
  }
}
