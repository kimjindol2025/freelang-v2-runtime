/**
 * FreeLang Macro System: Conditional Compilation
 *
 * Support for compile-time conditional directives (#ifdef, #ifndef, #if)
 */

/**
 * Conditional directive type
 */
export type ConditionalDirectiveType = 'ifdef' | 'ifndef' | 'if' | 'elif' | 'else' | 'endif';

/**
 * Conditional directive
 */
export interface ConditionalDirective {
  type: ConditionalDirectiveType;
  condition?: string;
  body?: any[];
  line?: number;
}

/**
 * Conditional Compiler for handling #ifdef, #ifndef, #if directives
 */
export class ConditionalCompiler {
  private symbols: Map<string, any> = new Map();
  private stack: boolean[] = [true];  // Stack of condition results

  constructor(symbols?: Map<string, any>) {
    if (symbols) {
      this.symbols = new Map(symbols);
    }
  }

  /**
   * Set a compilation symbol
   */
  public setSymbol(name: string, value: any = true): void {
    this.symbols.set(name, value);
  }

  /**
   * Get a compilation symbol
   */
  public getSymbol(name: string): any {
    return this.symbols.get(name);
  }

  /**
   * Check if symbol is defined
   */
  public isDefined(name: string): boolean {
    return this.symbols.has(name);
  }

  /**
   * Get all symbols
   */
  public getAllSymbols(): Map<string, any> {
    return new Map(this.symbols);
  }

  /**
   * Process directives in code array
   */
  public processDirectives(nodes: any[]): any[] {
    this.stack = [true];
    return this.processDirectivesInternal(nodes);
  }

  /**
   * Recursively process directives
   */
  private processDirectivesInternal(nodes: any[]): any[] {
    const result: any[] = [];

    for (const node of nodes) {
      if (this.isConditionalDirective(node)) {
        const directive = node as ConditionalDirective;

        switch (directive.type) {
          case 'ifdef':
            this.handleIfdef(directive, result);
            break;

          case 'ifndef':
            this.handleIfndef(directive, result);
            break;

          case 'if':
            this.handleIf(directive, result);
            break;

          case 'else':
            this.handleElse(result);
            break;

          case 'endif':
            this.handleEndif();
            break;
        }
      } else if (this.shouldInclude()) {
        // Include this node if current condition is true
        result.push(node);
      }
    }

    return result;
  }

  /**
   * Handle #ifdef directive
   */
  private handleIfdef(directive: ConditionalDirective, result: any[]): void {
    const condition = directive.condition || '';
    const isDefined = this.isDefined(condition);

    this.stack.push(isDefined && this.getCurrentCondition());

    if (this.shouldInclude() && directive.body) {
      result.push(...this.processDirectivesInternal(directive.body));
    }
  }

  /**
   * Handle #ifndef directive
   */
  private handleIfndef(directive: ConditionalDirective, result: any[]): void {
    const condition = directive.condition || '';
    const isNotDefined = !this.isDefined(condition);

    this.stack.push(isNotDefined && this.getCurrentCondition());

    if (this.shouldInclude() && directive.body) {
      result.push(...this.processDirectivesInternal(directive.body));
    }
  }

  /**
   * Handle #if directive
   */
  private handleIf(directive: ConditionalDirective, result: any[]): void {
    const condition = directive.condition || '';
    const conditionValue = this.evaluateCondition(condition);

    this.stack.push(conditionValue && this.getCurrentCondition());

    if (this.shouldInclude() && directive.body) {
      result.push(...this.processDirectivesInternal(directive.body));
    }
  }

  /**
   * Handle #else directive
   */
  private handleElse(result: any[]): void {
    if (this.stack.length < 1) {
      throw new Error('#else without matching #if');
    }

    // Pop current condition and push inverted one
    const currentCondition = this.stack.pop();
    this.stack.push(!currentCondition && this.getCurrentCondition());
  }

  /**
   * Handle #endif directive
   */
  private handleEndif(): void {
    if (this.stack.length <= 1) {
      throw new Error('#endif without matching #if');
    }

    this.stack.pop();
  }

  /**
   * Check if we should include current code
   */
  private shouldInclude(): boolean {
    return this.getCurrentCondition();
  }

  /**
   * Get current condition state
   */
  private getCurrentCondition(): boolean {
    return this.stack[this.stack.length - 1] || false;
  }

  /**
   * Evaluate condition expression
   */
  private evaluateCondition(condition: string): boolean {
    const trimmed = condition.trim();

    // Check for 'defined(name)' or 'defined name'
    if (trimmed.startsWith('defined')) {
      const match = trimmed.match(/defined\s*\(?([a-zA-Z_]\w*)\)?/);
      if (match) {
        return this.isDefined(match[1]);
      }
    }

    // Check for 'name == value' comparisons
    if (trimmed.includes('==')) {
      const [left, right] = trimmed.split('==').map(s => s.trim());
      const leftValue = this.isDefined(left) ? this.getSymbol(left) : left;
      const rightValue = this.isDefined(right) ? this.getSymbol(right) : right.replace(/['"]/g, '');

      return String(leftValue) === String(rightValue);
    }

    // Check for logical operators
    if (trimmed.includes('&&')) {
      const parts = trimmed.split('&&').map(p => p.trim());
      return parts.every(part => this.evaluateCondition(part));
    }

    if (trimmed.includes('||')) {
      const parts = trimmed.split('||').map(p => p.trim());
      return parts.some(part => this.evaluateCondition(part));
    }

    // Simple symbol check
    return this.isDefined(trimmed);
  }

  /**
   * Check if node is a conditional directive
   */
  private isConditionalDirective(node: any): boolean {
    if (!node || typeof node !== 'object') return false;

    const validTypes = ['ifdef', 'ifndef', 'if', 'elif', 'else', 'endif'];
    return validTypes.includes(node.type);
  }
}

/**
 * Directive Parser
 */
export class DirectiveParser {
  /**
   * Parse conditional directive from text
   */
  public static parseDirective(text: string): ConditionalDirective | null {
    const match = text.match(/^#(\w+)(?:\s+(.+))?$/);

    if (!match) {
      return null;
    }

    const directiveType = match[1];
    const condition = match[2];

    const validTypes = ['ifdef', 'ifndef', 'if', 'elif', 'else', 'endif'];
    if (!validTypes.includes(directiveType)) {
      return null;
    }

    return {
      type: directiveType as ConditionalDirectiveType,
      condition
    };
  }

  /**
   * Parse all directives in code
   */
  public static parseDirectivesInCode(code: string): ConditionalDirective[] {
    const directives: ConditionalDirective[] = [];
    const lines = code.split('\n');
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const trimmed = line.trim();

      if (trimmed.startsWith('#')) {
        const directive = this.parseDirective(trimmed);
        if (directive) {
          directive.line = lineNumber;
          directives.push(directive);
        }
      }
    }

    return directives;
  }
}

/**
 * Configuration-aware Compiler
 */
export class ConfigurableCompiler {
  private compiler: ConditionalCompiler;

  constructor(config: Map<string, any> = new Map()) {
    this.compiler = new ConditionalCompiler(config);
  }

  /**
   * Add configuration preset
   */
  public addPreset(presetName: string): void {
    switch (presetName) {
      case 'debug':
        this.compiler.setSymbol('debug', true);
        this.compiler.setSymbol('release', false);
        this.compiler.setSymbol('optimization', 0);
        break;

      case 'release':
        this.compiler.setSymbol('debug', false);
        this.compiler.setSymbol('release', true);
        this.compiler.setSymbol('optimization', 2);
        break;

      case 'profile':
        this.compiler.setSymbol('debug', true);
        this.compiler.setSymbol('profile', true);
        this.compiler.setSymbol('optimization', 1);
        break;
    }
  }

  /**
   * Set feature flag
   */
  public setFeature(name: string, enabled: boolean = true): void {
    this.compiler.setSymbol(`feature_${name}`, enabled);
  }

  /**
   * Set version
   */
  public setVersion(major: number, minor: number = 0, patch: number = 0): void {
    this.compiler.setSymbol('version_major', major);
    this.compiler.setSymbol('version_minor', minor);
    this.compiler.setSymbol('version_patch', patch);
    this.compiler.setSymbol('version', `${major}.${minor}.${patch}`);
  }

  /**
   * Get underlying compiler
   */
  public getCompiler(): ConditionalCompiler {
    return this.compiler;
  }

  /**
   * Process code with directives
   */
  public processCode(nodes: any[]): any[] {
    return this.compiler.processDirectives(nodes);
  }
}
