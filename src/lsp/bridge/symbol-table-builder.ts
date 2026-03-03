/**
 * Symbol Table Builder
 *
 * Builds symbol tables from AST and resolves symbols for
 * go-to-definition, rename, find-references, etc.
 */

import { Location, Range } from 'vscode-languageserver';
import { PositionResolver } from './position-resolver';
import type {
  TypeInfo,
  SymbolTable,
  Symbol,
  FunctionSymbol,
  VariableSymbol,
  TypeSymbol,
  ImportSymbol,
  ParameterInfo,
} from './lsp-compiler-bridge';

export class SymbolTableBuilder {
  private positionResolver: PositionResolver;

  constructor() {
    this.positionResolver = new PositionResolver();
  }

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

    // Collect all symbols from AST
    this.collectSymbols(ast, table, typeInfo);

    return table;
  }

  /**
   * Resolve symbol by name in table
   */
  public resolveSymbol(name: string, table: SymbolTable): Symbol | null {
    // Try each symbol table in order
    for (const symbolMap of [
      table.variables,
      table.functions,
      table.types,
      table.imports,
      table.global,
    ]) {
      const symbol = symbolMap.get(name);
      if (symbol) {
        return symbol;
      }
    }

    return null;
  }

  /**
   * Find all references to a symbol in AST
   */
  public findReferences(symbol: Symbol, ast: any, content: string): Location[] {
    const references: Location[] = [];
    const visited = new Set<any>();

    const walk = (node: any) => {
      if (!node || visited.has(node)) return;
      visited.add(node);

      // Check if this node references our symbol
      const nodeName = this.getNodeName(node);
      if (nodeName === symbol.name) {
        // Skip the definition itself (if different from reference)
        if (node !== symbol) {
          const range = this.getNodeRange(node, content);
          if (range) {
            references.push({
              uri: symbol.location.uri,
              range,
            });
          }
        }
      }

      // Recurse through children
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

  /**
   * Get all symbols of a given kind
   */
  public getSymbolsByKind(
    table: SymbolTable,
    kind: 'variable' | 'function' | 'type' | 'import'
  ): Symbol[] {
    const kindMap: { [key: string]: Map<string, Symbol> } = {
      variable: table.variables,
      function: table.functions,
      type: table.types,
      import: table.imports,
    };

    return Array.from(kindMap[kind]?.values() || []);
  }

  /**
   * Private helpers
   */

  private collectSymbols(ast: any, table: SymbolTable, typeInfo: Map<string, TypeInfo>): void {
    if (!ast) return;

    const visited = new Set<any>();

    const walk = (node: any) => {
      if (!node || visited.has(node)) return;
      visited.add(node);

      // Variable declaration
      if (node.type === 'VariableDeclaration' || node.varName) {
        this.collectVariableSymbol(node, table, typeInfo);
      }

      // Function declaration
      if (node.type === 'FunctionDeclaration' || node.fnName) {
        this.collectFunctionSymbol(node, table, typeInfo);
      }

      // Import/require
      if (node.type === 'ImportDeclaration' || node.type === 'RequireCall') {
        this.collectImportSymbol(node, table);
      }

      // Type definitions (classes, interfaces, etc.)
      if (node.type === 'ClassDeclaration' || node.type === 'InterfaceDeclaration') {
        this.collectTypeSymbol(node, table, typeInfo);
      }

      // Function parameters (create symbols for them)
      if (node.type === 'FunctionDeclaration' && node.params) {
        for (const param of node.params) {
          const paramName = param.name || param.paramName;
          if (paramName) {
            const paramSymbol: VariableSymbol = {
              name: paramName,
              kind: 'variable',
              type: param.paramType || 'any',
              confidence: param.paramType ? 1.0 : 0.5,
              mutable: false,
              location: this.createDefaultLocation(),
            };
            table.variables.set(paramName, paramSymbol);
          }
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
  }

  private collectVariableSymbol(
    node: any,
    table: SymbolTable,
    typeInfo: Map<string, TypeInfo>
  ): void {
    const varName = node.name || node.varName;
    if (!varName) return;

    // Check type info
    const info = typeInfo.get(varName);

    const varSymbol: VariableSymbol = {
      name: varName,
      kind: 'variable',
      type: info?.type || node.varType || 'any',
      confidence: info?.confidence || 0.5,
      mutable: node.mutable !== false,
      location: this.createDefaultLocation(),
    };

    table.variables.set(varName, varSymbol);
  }

  private collectFunctionSymbol(
    node: any,
    table: SymbolTable,
    typeInfo: Map<string, TypeInfo>
  ): void {
    const fnName = node.fnName || node.name;
    if (!fnName) return;

    const parameters: ParameterInfo[] = (node.params || []).map((p: any) => ({
      name: p.name || p.paramName || '',
      type: p.paramType || 'any',
      optional: p.optional || false,
      defaultValue: p.defaultValue,
    }));

    const funcSymbol: FunctionSymbol = {
      name: fnName,
      kind: 'function',
      location: this.createDefaultLocation(),
      parameters,
      returnType: node.returnType || 'any',
    };

    table.functions.set(fnName, funcSymbol);
  }

  private collectImportSymbol(node: any, table: SymbolTable): void {
    const importName = node.importedName || node.name || node.moduleName;
    const importPath = node.importPath || node.from || node.modulePath || '';

    if (!importName) return;

    const importSymbol: ImportSymbol = {
      name: importName,
      kind: 'import',
      location: this.createDefaultLocation(),
      importPath,
    };

    table.imports.set(importName, importSymbol);
  }

  private collectTypeSymbol(
    node: any,
    table: SymbolTable,
    typeInfo: Map<string, TypeInfo>
  ): void {
    const typeName = node.className || node.interfaceName || node.name;
    if (!typeName) return;

    // Collect members if they exist
    const members = new Map<string, any>();
    if (node.members) {
      for (const member of node.members) {
        const memberName = member.name || member.propertyName;
        if (memberName) {
          members.set(memberName, member);
        }
      }
    }

    const typeSymbol: TypeSymbol = {
      name: typeName,
      kind: 'type',
      location: this.createDefaultLocation(),
      members: members.size > 0 ? members : undefined,
    };

    table.types.set(typeName, typeSymbol);
  }

  private getNodeName(node: any): string | null {
    if (!node) return null;

    // Try various naming conventions
    const candidates = [
      node.name,
      node.identifier,
      node.varName,
      node.fnName,
      node.className,
      node.interfaceName,
      node.importedName,
      node.moduleName,
    ];

    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'string') {
        return candidate;
      }
    }

    return null;
  }

  private getNodeRange(node: any, content: string): Range | null {
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
        start: this.positionResolver.offsetToPosition(content, node.start),
        end: this.positionResolver.offsetToPosition(content, node.end),
      };
    }

    return null;
  }

  private createDefaultLocation(): Location {
    return {
      uri: 'file:///unknown',
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    };
  }
}
