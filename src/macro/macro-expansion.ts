/**
 * FreeLang Macro System: Macro Expansion and Hygiene
 *
 * Handles macro expansion in AST and maintains hygiene (variable name safety)
 */

import {
  MacroDefinition,
  MacroArgument,
  MacroCallExpression,
  MacroRegistry
} from './macro-definition';

/**
 * AST Node (simplified for macro expansion)
 */
export interface ASTNode {
  type: string;
  [key: string]: any;
}

/**
 * Block statement
 */
export interface BlockStatement extends ASTNode {
  type: 'block-statement';
  statements: ASTNode[];
}

/**
 * If statement
 */
export interface IfStatement extends ASTNode {
  type: 'if-statement';
  test: ASTNode;
  consequent: BlockStatement;
  alternate?: BlockStatement;
}

/**
 * Variable declaration
 */
export interface VariableDeclaration extends ASTNode {
  type: 'variable-declaration';
  name: string;
  value: ASTNode;
}

/**
 * Identifier expression
 */
export interface IdentifierExpression extends ASTNode {
  type: 'identifier';
  name: string;
}

/**
 * Macro expansion context
 */
export interface MacroExpansionContext {
  registry: MacroRegistry;
  expandedMacros: Set<string>;  // Prevent infinite recursion
  depth: number;
  maxDepth: number;
}

/**
 * Macro Expansion Engine
 */
export class MacroExpansionEngine {
  /**
   * Expand macros in AST
   */
  public static expandMacros(
    ast: ASTNode,
    registry: MacroRegistry
  ): ASTNode {
    const context: MacroExpansionContext = {
      registry,
      expandedMacros: new Set(),
      depth: 0,
      maxDepth: 100  // Prevent infinite recursion
    };

    return this.expandNode(ast, context);
  }

  /**
   * Expand macros in a node
   */
  private static expandNode(
    node: ASTNode,
    context: MacroExpansionContext
  ): ASTNode {
    // Check depth limit
    if (context.depth > context.maxDepth) {
      throw new Error('Macro expansion depth exceeded (possible infinite recursion)');
    }

    // Handle macro call
    if (node.type === 'macro-call') {
      return this.expandMacroCall(node as MacroCallExpression, context);
    }

    // Handle block statement
    if (node.type === 'block-statement') {
      const block = node as BlockStatement;
      return {
        ...block,
        statements: block.statements.map(stmt => this.expandNode(stmt, context))
      };
    }

    // Handle if statement
    if (node.type === 'if-statement') {
      const ifStmt = node as IfStatement;
      return {
        ...ifStmt,
        test: this.expandNode(ifStmt.test, context),
        consequent: this.expandNode(ifStmt.consequent, context) as BlockStatement,
        alternate: ifStmt.alternate
          ? this.expandNode(ifStmt.alternate, context) as BlockStatement
          : undefined
      };
    }

    // Handle while statement
    if (node.type === 'while-statement') {
      return {
        ...node,
        test: this.expandNode((node as any).test, context),
        body: this.expandNode((node as any).body, context)
      };
    }

    // Handle for statement
    if (node.type === 'for-statement') {
      return {
        ...node,
        init: (node as any).init ? this.expandNode((node as any).init, context) : undefined,
        test: (node as any).test ? this.expandNode((node as any).test, context) : undefined,
        update: (node as any).update ? this.expandNode((node as any).update, context) : undefined,
        body: this.expandNode((node as any).body, context)
      };
    }

    // Recursively expand in object properties
    const result: ASTNode = { ...node };

    for (const [key, value] of Object.entries(node)) {
      if (key === 'type' || key === 'line' || key === 'column') continue;

      if (this.isASTNode(value)) {
        result[key] = this.expandNode(value as ASTNode, context);
      } else if (Array.isArray(value)) {
        result[key] = (value as any[]).map(item =>
          this.isASTNode(item) ? this.expandNode(item as ASTNode, context) : item
        );
      }
    }

    return result;
  }

  /**
   * Expand a macro call
   */
  private static expandMacroCall(
    call: MacroCallExpression,
    context: MacroExpansionContext
  ): ASTNode {
    const macro = context.registry.get(call.macroName);

    if (!macro) {
      throw new Error(`Unknown macro: ${call.macroName}`);
    }

    // Prevent circular macro references
    if (context.expandedMacros.has(call.macroName)) {
      throw new Error(`Circular macro reference: ${call.macroName}`);
    }

    context.expandedMacros.add(call.macroName);
    context.depth++;

    try {
      // Expand the macro
      const expanded = this.expandMacro(macro, call.arguments, context);
      return expanded;
    } finally {
      context.expandedMacros.delete(call.macroName);
      context.depth--;
    }
  }

  /**
   * Expand macro with arguments
   */
  private static expandMacro(
    macro: MacroDefinition,
    args: MacroArgument[],
    context: MacroExpansionContext
  ): ASTNode {
    // Apply hygiene to macro body
    const hygieneManager = new HygieneManager();
    const macroBody = macro.body.content;

    // Parse and expand macro body as code
    // This is a simplified version - in reality you'd parse the body into AST
    const expandedStr = this.substituteArguments(macroBody, macro, args);
    const hygienicStr = hygieneManager.makeHygienic(expandedStr, macro.name);

    // Return as expression statement or block
    return {
      type: 'expanded-macro',
      macroName: macro.name,
      content: hygienicStr,
      originalContent: expandedStr
    };
  }

  /**
   * Substitute arguments into macro body
   */
  private static substituteArguments(
    body: string,
    macro: MacroDefinition,
    args: MacroArgument[]
  ): string {
    let result = body;

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

      // Replace parameter references ($param or param depending on syntax)
      result = result.replaceAll(new RegExp(`\\$?${param.name}\\b`, 'g'), value);
    }

    return result;
  }

  /**
   * Check if value is an AST node
   */
  private static isASTNode(value: any): boolean {
    return value && typeof value === 'object' && typeof value.type === 'string';
  }
}

/**
 * Macro Hygiene Manager
 *
 * Prevents variable name collisions by renaming variables in macro expansions
 */
export class HygieneManager {
  private counter: number = 0;

  /**
   * Make macro code hygienic
   *
   * Renames variables to avoid collisions with surrounding scope
   */
  public makeHygienic(code: string, macroName: string): string {
    const suffix = `__macro_${macroName}_${this.counter++}`;
    return this.renameVariables(code, suffix);
  }

  /**
   * Rename all variables in code
   */
  private renameVariables(code: string, suffix: string): string {
    // Pattern to match variable declarations and references
    // This is a simplified version - a full implementation would use proper parsing

    // Match: let x = ..., var y = ..., fn z(...), etc.
    let result = code;

    // Rename variable declarations
    result = result.replace(
      /\b(let|var|const|fn)\s+([a-zA-Z_]\w*)/g,
      (match, keyword, varName) => {
        // Don't rename special variables like __i, __lock, etc.
        if (varName.startsWith('__')) {
          return match;
        }
        return `${keyword} ${varName}${suffix}`;
      }
    );

    // Rename variable references
    // This is tricky without full AST parsing, so we use a heuristic:
    // Don't rename builtin functions and known symbols
    const builtins = ['console', 'print', 'log', 'throw', 'return', 'if', 'while', 'for'];

    result = result.replace(
      /([^a-zA-Z_])([a-zA-Z_]\w*)(?!\s*[\(\:])/g,
      (match, prefix, varName) => {
        if (builtins.includes(varName) || varName.startsWith('__')) {
          return match;
        }

        // This is a variable reference
        return prefix + varName + suffix;
      }
    );

    return result;
  }

  /**
   * Make AST node hygienic
   */
  public makeASTHygienic(node: ASTNode, macroName: string): ASTNode {
    const suffix = `__macro_${macroName}_${this.counter++}`;
    return this.renameInAST(node, suffix);
  }

  /**
   * Rename variables in AST
   */
  private renameInAST(node: ASTNode, suffix: string): ASTNode {
    if (node.type === 'identifier') {
      const ident = node as IdentifierExpression;
      return {
        ...node,
        name: ident.name + suffix
      };
    }

    if (node.type === 'variable-declaration') {
      const decl = node as VariableDeclaration;
      return {
        ...node,
        name: decl.name + suffix,
        value: this.renameInAST(decl.value, suffix)
      };
    }

    if (node.type === 'block-statement') {
      const block = node as BlockStatement;
      return {
        ...node,
        statements: block.statements.map(stmt => this.renameInAST(stmt, suffix))
      };
    }

    // Recursively process child nodes
    const result: ASTNode = { ...node };

    for (const [key, value] of Object.entries(node)) {
      if (key === 'type' || key === 'line' || key === 'column') continue;

      if (this.isASTNode(value)) {
        result[key] = this.renameInAST(value as ASTNode, suffix);
      } else if (Array.isArray(value)) {
        result[key] = (value as any[]).map(item =>
          this.isASTNode(item) ? this.renameInAST(item as ASTNode, suffix) : item
        );
      }
    }

    return result;
  }

  /**
   * Check if value is an AST node
   */
  private isASTNode(value: any): boolean {
    return value && typeof value === 'object' && typeof value.type === 'string';
  }
}

/**
 * Macro expansion result
 */
export interface MacroExpansionResult {
  success: boolean;
  expandedAST?: ASTNode;
  expandedCode?: string;
  error?: string;
}

/**
 * Safe macro expansion wrapper
 */
export class SafeMacroExpander {
  /**
   * Safely expand macros with error handling
   */
  public static safeExpand(
    ast: ASTNode,
    registry: MacroRegistry
  ): MacroExpansionResult {
    try {
      const expandedAST = MacroExpansionEngine.expandMacros(ast, registry);

      return {
        success: true,
        expandedAST
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
