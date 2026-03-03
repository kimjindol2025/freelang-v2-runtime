/**
 * FreeLang Macro System: Macro Definition and Registration
 *
 * Defines macro structure, parsing, and registration system for compile-time code generation
 */

/**
 * Macro parameter kind
 */
export type MacroParameterKind = 'expression' | 'statement' | 'pattern' | 'type' | 'identifier';

/**
 * Macro parameter definition
 */
export interface MacroParameter {
  name: string;
  kind: MacroParameterKind;
  default?: string;  // Default value if not provided
}

/**
 * Macro token (part of macro body)
 */
export interface MacroToken {
  type: 'literal' | 'variable' | 'nested-macro';
  value: string;
  parameterName?: string;  // Which parameter this refers to
  line?: number;
  column?: number;
}

/**
 * Macro body definition
 */
export interface MacroBody {
  type: 'literal' | 'pattern';
  content: string;
  tokens: MacroToken[];
}

/**
 * Macro definition
 */
export interface MacroDefinition {
  kind: 'macro';
  name: string;
  parameters: MacroParameter[];
  body: MacroBody;
  isVariadic?: boolean;  // Accepts variable number of arguments
  scope?: MacroScope;
  docs?: string;  // Documentation
}

/**
 * Macro scope tracking
 */
export interface MacroScope {
  parentScope?: MacroScope;
  macros: Map<string, MacroDefinition>;
  symbols: Map<string, any>;
}

/**
 * Macro argument (at invocation time)
 */
export interface MacroArgument {
  name?: string;  // For named arguments
  value: string;  // String representation of argument
  kind?: MacroParameterKind;
}

/**
 * Macro call expression
 */
export interface MacroCallExpression {
  type: 'macro-call';
  macroName: string;
  arguments: MacroArgument[];
  line?: number;
  column?: number;
}

/**
 * Macro Parser
 */
export class MacroParser {
  /**
   * Parse macro definition from string
   * @param macroStr Macro definition string
   */
  public static parseMacroDefinition(macroStr: string): MacroDefinition {
    const trimmed = macroStr.trim();

    // Match: macro name(param1, param2, ...) { body }
    const nameMatch = trimmed.match(/macro\s+(\w+)\s*\(/);
    if (!nameMatch) {
      throw new Error(`Invalid macro definition: ${macroStr}`);
    }

    const name = nameMatch[1];
    const openParen = trimmed.indexOf('(');
    const closeParen = trimmed.indexOf(')');

    if (closeParen === -1) {
      throw new Error(`Unclosed parenthesis in macro definition: ${macroStr}`);
    }

    const paramsStr = trimmed.substring(openParen + 1, closeParen);
    const parameters = this.parseParameters(paramsStr);

    const bodyStart = trimmed.indexOf('{', closeParen);
    const bodyEnd = trimmed.lastIndexOf('}');

    if (bodyStart === -1 || bodyEnd === -1) {
      throw new Error(`Missing macro body: ${macroStr}`);
    }

    const bodyStr = trimmed.substring(bodyStart + 1, bodyEnd);
    const body = this.parseBody(bodyStr, parameters);

    return {
      kind: 'macro',
      name,
      parameters,
      body
    };
  }

  /**
   * Parse macro parameters
   */
  private static parseParameters(paramsStr: string): MacroParameter[] {
    if (!paramsStr.trim()) {
      return [];
    }

    const params: MacroParameter[] = [];
    const paramStrs = paramsStr.split(',');

    for (const paramStr of paramStrs) {
      const trimmed = paramStr.trim();
      if (!trimmed) continue;

      const parts = trimmed.split(':').map(p => p.trim());
      const name = parts[0];
      let kind: MacroParameterKind = 'expression';
      let defaultValue: string | undefined;

      if (parts.length > 1) {
        const typeStr = parts[1].split('=')[0].trim();
        kind = this.parseParameterKind(typeStr);

        if (parts[1].includes('=')) {
          defaultValue = parts[1].split('=')[1].trim();
        }
      }

      if (!this.isValidIdentifier(name)) {
        throw new Error(`Invalid parameter name: ${name}`);
      }

      params.push({
        name,
        kind,
        default: defaultValue
      });
    }

    return params;
  }

  /**
   * Parse parameter kind
   */
  private static parseParameterKind(kindStr: string): MacroParameterKind {
    const kinds: MacroParameterKind[] = ['expression', 'statement', 'pattern', 'type', 'identifier'];

    if (kinds.includes(kindStr as MacroParameterKind)) {
      return kindStr as MacroParameterKind;
    }

    throw new Error(`Unknown parameter kind: ${kindStr}`);
  }

  /**
   * Parse macro body
   */
  private static parseBody(bodyStr: string, parameters: MacroParameter[]): MacroBody {
    const tokens = this.tokenizeBody(bodyStr, parameters);

    return {
      type: 'literal',
      content: bodyStr,
      tokens
    };
  }

  /**
   * Tokenize macro body to identify variables and literals
   */
  private static tokenizeBody(bodyStr: string, parameters: MacroParameter[]): MacroToken[] {
    const tokens: MacroToken[] = [];
    const paramNames = parameters.map(p => p.name);

    let i = 0;
    while (i < bodyStr.length) {
      const char = bodyStr[i];

      // Check for variable reference
      if (char === '$' || /[a-zA-Z_]/.test(char)) {
        let varName = '';
        let isEscape = false;

        if (char === '$') {
          i++;  // Skip $
          isEscape = true;
        }

        // Collect identifier
        while (i < bodyStr.length && /[a-zA-Z0-9_]/.test(bodyStr[i])) {
          varName += bodyStr[i];
          i++;
        }

        // Check if this is a parameter
        if (paramNames.includes(varName)) {
          tokens.push({
            type: 'variable',
            value: varName,
            parameterName: varName
          });
        } else {
          tokens.push({
            type: 'literal',
            value: (isEscape ? '$' : '') + varName
          });
        }
      } else {
        // Literal character
        let literal = '';
        while (i < bodyStr.length && bodyStr[i] !== '$' && !/[a-zA-Z_]/.test(bodyStr[i])) {
          literal += bodyStr[i];
          i++;
        }

        if (literal) {
          tokens.push({
            type: 'literal',
            value: literal
          });
        }
      }
    }

    return tokens;
  }

  /**
   * Parse macro call
   */
  public static parseMacroCall(callStr: string): MacroCallExpression {
    const match = callStr.match(/(\w+)\s*\((.*)\)/);

    if (!match) {
      throw new Error(`Invalid macro call: ${callStr}`);
    }

    const macroName = match[1];
    const argsStr = match[2];
    const arguments = this.parseMacroArguments(argsStr);

    return {
      type: 'macro-call',
      macroName,
      arguments
    };
  }

  /**
   * Parse macro arguments
   */
  private static parseMacroArguments(argsStr: string): MacroArgument[] {
    if (!argsStr.trim()) {
      return [];
    }

    // Simple argument parsing (doesn't handle nested parentheses in complex cases)
    const args: MacroArgument[] = [];
    const argStrs = argsStr.split(',');

    for (const argStr of argStrs) {
      const trimmed = argStr.trim();
      if (!trimmed) continue;

      args.push({
        value: trimmed
      });
    }

    return args;
  }

  /**
   * Check if string is valid identifier
   */
  private static isValidIdentifier(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }
}

/**
 * Macro Registry for storing and retrieving macros
 */
export class MacroRegistry {
  private macros: Map<string, MacroDefinition> = new Map();
  private scopes: MacroScope[] = [];

  constructor() {
    this.scopes.push({
      macros: this.macros,
      symbols: new Map()
    });
  }

  /**
   * Register a macro definition
   */
  public register(definition: MacroDefinition): void {
    if (this.macros.has(definition.name)) {
      throw new Error(`Macro '${definition.name}' is already defined`);
    }

    this.macros.set(definition.name, definition);
  }

  /**
   * Get macro definition
   */
  public get(name: string): MacroDefinition | undefined {
    return this.macros.get(name);
  }

  /**
   * Check if macro is registered
   */
  public has(name: string): boolean {
    return this.macros.has(name);
  }

  /**
   * Get all registered macros
   */
  public getAll(): MacroDefinition[] {
    return Array.from(this.macros.values());
  }

  /**
   * Unregister a macro
   */
  public unregister(name: string): void {
    this.macros.delete(name);
  }

  /**
   * Clear all macros
   */
  public clear(): void {
    this.macros.clear();
  }

  /**
   * Enter new scope
   */
  public enterScope(): MacroScope {
    const newScope: MacroScope = {
      parentScope: this.scopes[this.scopes.length - 1],
      macros: new Map(),
      symbols: new Map()
    };

    this.scopes.push(newScope);
    return newScope;
  }

  /**
   * Exit current scope
   */
  public exitScope(): void {
    if (this.scopes.length > 1) {
      this.scopes.pop();
    }
  }

  /**
   * Get current scope
   */
  public getCurrentScope(): MacroScope {
    return this.scopes[this.scopes.length - 1];
  }
}

/**
 * Simple macro expansion engine
 */
export class MacroExpander {
  /**
   * Expand macro with arguments
   */
  public static expand(
    macro: MacroDefinition,
    args: MacroArgument[]
  ): string {
    // Validate argument count
    const minArgs = macro.parameters.filter(p => !p.default).length;
    const maxArgs = macro.isVariadic ? Infinity : macro.parameters.length;

    if (args.length < minArgs || args.length > maxArgs) {
      throw new Error(
        `Macro '${macro.name}' expects ${minArgs}-${maxArgs} arguments ` +
        `but got ${args.length}`
      );
    }

    // Create substitution map
    const substitutions = new Map<string, string>();

    for (let i = 0; i < macro.parameters.length; i++) {
      const param = macro.parameters[i];
      let value = '';

      if (i < args.length) {
        value = args[i].value;
      } else if (param.default) {
        value = param.default;
      } else {
        throw new Error(`Missing argument for parameter '${param.name}'`);
      }

      substitutions.set(param.name, value);
    }

    // Perform substitution
    return this.substituteTokens(macro.body.tokens, substitutions);
  }

  /**
   * Substitute tokens with arguments
   */
  private static substituteTokens(
    tokens: MacroToken[],
    substitutions: Map<string, string>
  ): string {
    let result = '';

    for (const token of tokens) {
      if (token.type === 'variable' && token.parameterName) {
        const value = substitutions.get(token.parameterName);
        if (value !== undefined) {
          result += value;
        }
      } else {
        result += token.value;
      }
    }

    return result;
  }
}

/**
 * Macro definition builder (fluent API)
 */
export class MacroBuilder {
  private definition: MacroDefinition;

  constructor(name: string) {
    this.definition = {
      kind: 'macro',
      name,
      parameters: [],
      body: {
        type: 'literal',
        content: '',
        tokens: []
      }
    };
  }

  /**
   * Add parameter
   */
  public withParameter(
    name: string,
    kind: MacroParameterKind = 'expression',
    defaultValue?: string
  ): this {
    this.definition.parameters.push({
      name,
      kind,
      default: defaultValue
    });

    return this;
  }

  /**
   * Set body
   */
  public withBody(content: string): this {
    const tokens = MacroParser['tokenizeBody'](
      content,
      this.definition.parameters
    );

    this.definition.body = {
      type: 'literal',
      content,
      tokens
    };

    return this;
  }

  /**
   * Mark as variadic
   */
  public variadic(): this {
    this.definition.isVariadic = true;
    return this;
  }

  /**
   * Set documentation
   */
  public withDocs(docs: string): this {
    this.definition.docs = docs;
    return this;
  }

  /**
   * Build the macro definition
   */
  public build(): MacroDefinition {
    return this.definition;
  }
}
