/**
 * Phase 2 Task 2.2: Expression Completer for Partial Syntax
 *
 * Handles:
 * 1. Incomplete expressions: "total =" → "total = stub(unknown)"
 * 2. Empty blocks: "if x do" → "if x do stub(void)"
 * 3. Auto-complete tokens: Missing parens, brackets, semicolons
 *
 * Example:
 * ```freelang
 * fn process
 *   do
 *     total = total +     // ← incomplete
 *     if x               // ← missing do block
 *     for i in range     // ← missing do body
 * ↓
 * fn process
 *   do
 *     total = total + 0  // ← completed
 *     if x do stub()     // ← block added
 *     for i in range do stub()  // ← body added
 * ```
 */

/**
 * Token interface for lexical analysis
 */
interface Token {
  type: string;
  value: string;
  line: number;
  column: number;
}

/**
 * Type of completion suggestion
 */
export enum CompletionType {
  BINARY_OPERATOR = 'BINARY_OPERATOR',      // "x +" needs right operand
  UNARY_OPERATOR = 'UNARY_OPERATOR',        // "- x" needs continuation
  FUNCTION_CALL = 'FUNCTION_CALL',          // "foo(" needs args + ")"
  ARRAY_ACCESS = 'ARRAY_ACCESS',            // "arr[" needs index + "]"
  MEMBER_ACCESS = 'MEMBER_ACCESS',          // "obj." needs property
  ASSIGNMENT = 'ASSIGNMENT',                // "x =" needs value
  CONDITIONAL = 'CONDITIONAL',              // "if" needs condition
  LOOP = 'LOOP',                             // "for" needs iterator + body
  BLOCK = 'BLOCK',                           // Missing block body
  MISSING_PAREN = 'MISSING_PAREN',          // Missing closing )
  MISSING_BRACKET = 'MISSING_BRACKET',      // Missing closing ]
  MISSING_BRACE = 'MISSING_BRACE',          // Missing closing }
  MISSING_SEMICOLON = 'MISSING_SEMICOLON',  // Missing ;
}

/**
 * Completion suggestion for incomplete code
 */
export interface CompletionSuggestion {
  type: CompletionType;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  originalText: string;
  suggestedCompletion: string;
  description: string;
  severity: 'ERROR' | 'WARNING';
  autoFix: boolean;
}

/**
 * Result of expression completion analysis
 */
export interface CompletionResult {
  completions: CompletionSuggestion[];
  modifiedTokens: Token[];
  modifiedText: string;
  hadErrors: boolean;
}

/**
 * Expression Completer - Analyzes and fixes incomplete expressions/blocks
 */
export class ExpressionCompleter {
  private tokens: Token[] = [];
  private pos: number = 0;
  private completions: CompletionSuggestion[] = [];
  private modifiedTokens: Token[] = [];

  /**
   * Main entry point: analyze and complete partial code
   */
  public analyzeAndComplete(tokens: Token[]): CompletionResult {
    this.tokens = tokens;
    this.pos = 0;
    this.completions = [];
    this.modifiedTokens = [];

    // First pass: identify all incomplete patterns
    this.identifyIncompletePatterns();

    // Second pass: build modified token stream
    this.modifiedTokens = this.buildModifiedTokens();

    return {
      completions: this.completions,
      modifiedTokens: this.modifiedTokens,
      modifiedText: this.tokensToText(this.modifiedTokens),
      hadErrors: this.completions.length > 0,
    };
  }

  /**
   * Parse incomplete expression with recovery
   *
   * Handles:
   * - "x +" → detects missing right operand
   * - "arr[" → detects missing index
   * - "func(" → detects missing arguments
   */
  public parseIncompleteExpression(tokens: Token[]): {
    isComplete: boolean;
    missingParts: string[];
    suggestion: string;
  } {
    this.tokens = tokens;
    this.pos = 0;

    const missingParts: string[] = [];

    // Check for trailing binary operators (ends with operator)
    // Filter out NEWLINE, INDENT, DEDENT tokens
    const meaningful = tokens.filter(t => !['NEWLINE', 'INDENT', 'DEDENT'].includes(t.type));

    if (meaningful.length > 0) {
      const lastToken = meaningful[meaningful.length - 1];
      if (this.isBinaryOperator(lastToken.type)) {
        missingParts.push('right_operand');
        return {
          isComplete: false,
          missingParts,
          suggestion: this.buildOperatorCompletion(tokens),
        };
      }

      // Check for trailing member access (ends with dot)
      if (lastToken.type === 'DOT') {
        missingParts.push('member_name');
        return {
          isComplete: false,
          missingParts,
          suggestion: 'property() // incomplete member access',
        };
      }
    }

    // Check for unmatched parentheses and brackets (forward scan)
    let parenDepth = 0;
    let bracketDepth = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'LPAREN') parenDepth++;
      else if (token.type === 'RPAREN') parenDepth--;
      else if (token.type === 'LBRACKET') bracketDepth++;
      else if (token.type === 'RBRACKET') bracketDepth--;
    }

    // Add missing parts if unbalanced
    if (parenDepth > 0) {
      for (let i = 0; i < parenDepth; i++) {
        missingParts.push('closing_paren');
      }
    }

    if (bracketDepth > 0) {
      for (let i = 0; i < bracketDepth; i++) {
        missingParts.push('closing_bracket');
        missingParts.push('index_expression');  // Also need index value
      }
    }

    return {
      isComplete: missingParts.length === 0,
      missingParts,
      suggestion: this.buildSuggestion(tokens, missingParts),
    };
  }

  /**
   * Handle empty block (if/for/while statements)
   *
   * Example:
   * - "if condition do" → "if condition do stub(void)"
   * - "for x in arr do" → "for x in arr do stub(void)"
   * - "if x { }" → "if x { stub(void) }"
   */
  public handleEmptyBlock(tokens: Token[]): {
    isEmpty: boolean;
    suggestion: string;
    insertPoint: number;
  } {
    // Case 1: Look for "do" keyword first
    const doIndex = tokens.findIndex(t => t.type === 'DO');
    if (doIndex !== -1) {
      // Check if anything follows "do"
      const afterDo = tokens.slice(doIndex + 1);

      // Filter out whitespace/newline tokens
      const meaningful = afterDo.filter(t => !['NEWLINE', 'INDENT', 'DEDENT'].includes(t.type));

      if (meaningful.length === 0) {
        return {
          isEmpty: true,
          suggestion: 'stub(void)  // empty block',
          insertPoint: doIndex + 1,
        };
      }

      // Check if block only contains closing tokens
      if (meaningful.every(t => ['RBRACE', 'DEDENT', 'EOF'].includes(t.type))) {
        return {
          isEmpty: true,
          suggestion: 'stub(void)  // empty block',
          insertPoint: doIndex + 1,
        };
      }
    }

    // Case 2: Look for empty { } braces
    const lbraceIndex = tokens.findIndex(t => t.type === 'LBRACE');
    if (lbraceIndex !== -1) {
      // Find matching RBRACE
      const rbraceIndex = tokens.findIndex((t, i) => i > lbraceIndex && t.type === 'RBRACE');

      if (rbraceIndex !== -1) {
        // Check if anything is between { and }
        const between = tokens.slice(lbraceIndex + 1, rbraceIndex);
        const meaningful = between.filter(t => !['NEWLINE', 'INDENT', 'DEDENT'].includes(t.type));

        if (meaningful.length === 0) {
          return {
            isEmpty: true,
            suggestion: 'stub(void)  // empty block',
            insertPoint: lbraceIndex + 1,
          };
        }
      }
    }

    return { isEmpty: false, suggestion: '', insertPoint: -1 };
  }

  /**
   * Auto-complete missing tokens
   *
   * Adds:
   * - Missing closing parentheses
   * - Missing closing brackets
   * - Missing semicolons (if needed)
   * - Missing closing braces
   */
  public autoCompleteTokens(tokens: Token[]): Token[] {
    const result = [...tokens];
    let parenDepth = 0;
    let bracketDepth = 0;
    let braceDepth = 0;

    // Scan for unmatched tokens
    for (let i = 0; i < result.length; i++) {
      const token = result[i];

      if (token.type === 'LPAREN') parenDepth++;
      else if (token.type === 'RPAREN') parenDepth--;
      else if (token.type === 'LBRACKET') bracketDepth++;
      else if (token.type === 'RBRACKET') bracketDepth--;
      else if (token.type === 'LBRACE') braceDepth++;
      else if (token.type === 'RBRACE') braceDepth--;
    }

    // Add missing closing tokens at end
    if (parenDepth > 0) {
      for (let i = 0; i < parenDepth; i++) {
        result.push({
          type: 'RPAREN',
          value: ')',
          line: result[result.length - 1].line,
          column: result[result.length - 1].column + 1,
        });
      }
    }

    if (bracketDepth > 0) {
      for (let i = 0; i < bracketDepth; i++) {
        result.push({
          type: 'RBRACKET',
          value: ']',
          line: result[result.length - 1].line,
          column: result[result.length - 1].column + 1,
        });
      }
    }

    if (braceDepth > 0) {
      for (let i = 0; i < braceDepth; i++) {
        result.push({
          type: 'RBRACE',
          value: '}',
          line: result[result.length - 1].line,
          column: result[result.length - 1].column + 1,
        });
      }
    }

    return result;
  }

  /**
   * Identify all incomplete patterns in token stream
   */
  private identifyIncompletePatterns(): void {
    for (let i = 0; i < this.tokens.length; i++) {
      const token = this.tokens[i];
      const nextToken = i + 1 < this.tokens.length ? this.tokens[i + 1] : null;
      const prevToken = i > 0 ? this.tokens[i - 1] : null;

      // Pattern 1: Trailing binary operator
      if (this.isBinaryOperator(token.type)) {
        if (!nextToken || ['NEWLINE', 'SEMICOLON', 'RBRACE', 'EOF'].includes(nextToken.type)) {
          this.completions.push({
            type: CompletionType.BINARY_OPERATOR,
            startLine: token.line,
            startCol: token.column,
            endLine: token.line,
            endCol: token.column + token.value.length,
            originalText: token.value,
            suggestedCompletion: token.value + ' 0',
            description: `Binary operator '${token.value}' needs right operand`,
            severity: 'ERROR',
            autoFix: true,
          });
        }
      }

      // Pattern 2: Unclosed parenthesis
      if (token.type === 'LPAREN') {
        const closeIdx = this.findMatchingClosing(i, 'LPAREN', 'RPAREN');
        if (closeIdx === -1) {
          this.completions.push({
            type: CompletionType.MISSING_PAREN,
            startLine: token.line,
            startCol: token.column,
            endLine: this.tokens[this.tokens.length - 1].line,
            endCol: this.tokens[this.tokens.length - 1].column,
            originalText: '(',
            suggestedCompletion: ') // auto-inserted',
            description: 'Missing closing parenthesis',
            severity: 'ERROR',
            autoFix: true,
          });
        }
      }

      // Pattern 3: Unclosed bracket
      if (token.type === 'LBRACKET') {
        const closeIdx = this.findMatchingClosing(i, 'LBRACKET', 'RBRACKET');
        if (closeIdx === -1) {
          this.completions.push({
            type: CompletionType.MISSING_BRACKET,
            startLine: token.line,
            startCol: token.column,
            endLine: this.tokens[this.tokens.length - 1].line,
            endCol: this.tokens[this.tokens.length - 1].column,
            originalText: '[',
            suggestedCompletion: '] // auto-inserted',
            description: 'Missing closing bracket',
            severity: 'ERROR',
            autoFix: true,
          });
        }
      }

      // Pattern 4: Trailing member access
      if (token.type === 'DOT') {
        if (!nextToken || !['IDENT'].includes(nextToken.type)) {
          this.completions.push({
            type: CompletionType.MEMBER_ACCESS,
            startLine: token.line,
            startCol: token.column,
            endLine: token.line,
            endCol: token.column + 1,
            originalText: '.',
            suggestedCompletion: '.property',
            description: 'Incomplete member access',
            severity: 'WARNING',
            autoFix: true,
          });
        }
      }

      // Pattern 5: Assignment without value
      if (token.type === 'ASSIGN' || token.value === '=') {
        if (!nextToken || ['NEWLINE', 'SEMICOLON', 'RBRACE'].includes(nextToken.type)) {
          this.completions.push({
            type: CompletionType.ASSIGNMENT,
            startLine: token.line,
            startCol: token.column,
            endLine: token.line,
            endCol: token.column + 1,
            originalText: '=',
            suggestedCompletion: '= 0',
            description: 'Assignment needs value',
            severity: 'ERROR',
            autoFix: true,
          });
        }
      }

      // Pattern 6: if/while without body
      if (['IF', 'WHILE'].includes(token.type)) {
        // Look for "do" keyword
        const doIdx = this.findNext(i, 'DO');
        if (doIdx !== -1) {
          const afterDo = this.tokens.slice(doIdx + 1);
          const meaningful = afterDo.filter(t => !['NEWLINE', 'INDENT', 'DEDENT'].includes(t.type));
          if (meaningful.length === 0 || meaningful[0].type === 'RBRACE') {
            this.completions.push({
              type: CompletionType.BLOCK,
              startLine: this.tokens[doIdx].line,
              startCol: this.tokens[doIdx].column,
              endLine: this.tokens[doIdx].line,
              endCol: this.tokens[doIdx].column + 2,
              originalText: 'do',
              suggestedCompletion: 'do\n  stub(void)',
              description: `'${token.value}' block is empty`,
              severity: 'WARNING',
              autoFix: true,
            });
          }
        }
      }

      // Pattern 7: for without body
      if (token.type === 'FOR') {
        const doIdx = this.findNext(i, 'DO');
        if (doIdx !== -1) {
          const afterDo = this.tokens.slice(doIdx + 1);
          const meaningful = afterDo.filter(t => !['NEWLINE', 'INDENT', 'DEDENT'].includes(t.type));
          if (meaningful.length === 0 || meaningful[0].type === 'RBRACE') {
            this.completions.push({
              type: CompletionType.BLOCK,
              startLine: this.tokens[doIdx].line,
              startCol: this.tokens[doIdx].column,
              endLine: this.tokens[doIdx].line,
              endCol: this.tokens[doIdx].column + 2,
              originalText: 'do',
              suggestedCompletion: 'do\n  stub(void)',
              description: 'for loop body is empty',
              severity: 'WARNING',
              autoFix: true,
            });
          }
        }
      }
    }
  }

  /**
   * Build modified token stream with completions applied
   */
  private buildModifiedTokens(): Token[] {
    const result = [...this.tokens];

    // Apply auto-completions
    result.push(...this.getAutoCompleteTokens());

    return result;
  }

  /**
   * Get tokens needed for auto-completion
   */
  private getAutoCompleteTokens(): Token[] {
    const tokens: Token[] = [];

    // Count unmatched parentheses
    let parenBalance = 0;
    let bracketBalance = 0;

    for (const token of this.tokens) {
      if (token.type === 'LPAREN') parenBalance++;
      else if (token.type === 'RPAREN') parenBalance--;
      else if (token.type === 'LBRACKET') bracketBalance++;
      else if (token.type === 'RBRACKET') bracketBalance--;
    }

    // Add closing tokens
    const lastToken = this.tokens[this.tokens.length - 1] || {
      line: 1,
      column: 1,
    };

    for (let i = 0; i < parenBalance; i++) {
      tokens.push({
        type: 'RPAREN',
        value: ')',
        line: lastToken.line,
        column: lastToken.column + i,
      });
    }

    for (let i = 0; i < bracketBalance; i++) {
      tokens.push({
        type: 'RBRACKET',
        value: ']',
        line: lastToken.line,
        column: lastToken.column + parenBalance + i,
      });
    }

    return tokens;
  }

  /**
   * Helper: Check if token type is binary operator
   */
  private isBinaryOperator(type: string): boolean {
    return [
      'PLUS',
      'MINUS',
      'MULTIPLY',
      'DIVIDE',
      'MODULO',
      'EQUAL',
      'NOT_EQUAL',
      'LESS_THAN',
      'GREATER_THAN',
      'LESS_EQUAL',
      'GREATER_EQUAL',
      'AND',
      'OR',
      'ASSIGN',
      'PLUS_ASSIGN',
      'MINUS_ASSIGN',
    ].includes(type);
  }

  /**
   * Helper: Find matching closing token
   */
  private findMatchingClosing(
    startIdx: number,
    openType: string,
    closeType: string
  ): number {
    let depth = 1;
    for (let i = startIdx + 1; i < this.tokens.length; i++) {
      if (this.tokens[i].type === openType) depth++;
      else if (this.tokens[i].type === closeType) {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /**
   * Helper: Find next token of type
   */
  private findNext(startIdx: number, type: string): number {
    for (let i = startIdx + 1; i < this.tokens.length; i++) {
      if (this.tokens[i].type === type) return i;
    }
    return -1;
  }

  /**
   * Helper: Build operator completion suggestion
   */
  private buildOperatorCompletion(tokens: Token[]): string {
    const lastOp = tokens[tokens.length - 1];
    return `${lastOp.value} 0`;
  }

  /**
   * Helper: Build suggestion string
   */
  private buildSuggestion(tokens: Token[], missing: string[]): string {
    const parts: string[] = [];

    for (const part of missing) {
      if (part === 'closing_paren') parts.push(')');
      else if (part === 'closing_bracket') parts.push(']');
      else if (part === 'right_operand') parts.push('0');
      else if (part === 'index_expression') parts.push('0');
      else if (part === 'member_name') parts.push('property');
    }

    return parts.join('');
  }

  /**
   * Helper: Convert tokens back to text
   */
  private tokensToText(tokens: Token[]): string {
    return tokens.map(t => t.value || t.type).join('');
  }
}

// Convenience function
export function createExpressionCompleter(): ExpressionCompleter {
  return new ExpressionCompleter();
}
