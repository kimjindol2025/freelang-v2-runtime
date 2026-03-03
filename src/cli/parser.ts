/**
 * FreeLang Program Parser
 * Parse function definitions and statements from source code
 */

export interface ParsedFunction {
  type: 'FunctionDefinition';
  name: string;
  params: string[];
  body: string;
}

export interface ParsedProgram {
  functionDefs: ParsedFunction[];
  source: string;
}

/**
 * FunctionParser: Extract function definitions from source code
 */
export class FunctionParser {
  /**
   * Parse function definitions from source code
   * Uses brace counting to handle nested braces correctly
   */
  static parseFunctionDefinitions(source: string): ParsedFunction[] {
    const functions: ParsedFunction[] = [];

    // Find all fn keyword positions
    // Pattern allows type annotations like "-> void" between ) and {
    const fnPattern = /fn\s+(\w+)\s*\(([^)]*)\)[^{]*\{/g;
    let match;

    while ((match = fnPattern.exec(source)) !== null) {
      const name = match[1];
      const paramsStr = match[2];

      // Find the opening brace position
      const openBracePos = match.index + match[0].length - 1;

      // Count braces to find matching closing brace
      let braceCount = 1;
      let pos = openBracePos + 1;

      while (pos < source.length && braceCount > 0) {
        if (source[pos] === '{') braceCount++;
        else if (source[pos] === '}') braceCount--;
        pos++;
      }

      // Extract body (between opening and closing braces)
      const bodyStr = source.substring(openBracePos + 1, pos - 1);

      // Parse parameters
      const params = paramsStr
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      functions.push({
        type: 'FunctionDefinition',
        name,
        params,
        body: bodyStr.trim()
      });
    }

    return functions;
  }

  /**
   * Parse complete program: extract functions and remaining statements
   */
  static parseProgram(source: string): ParsedProgram {
    const functionDefs = this.parseFunctionDefinitions(source);

    return {
      functionDefs,
      source
    };
  }

  /**
   * Check if source contains function definitions
   */
  static hasFunctionDefinitions(source: string): boolean {
    return /fn\s+\w+\s*\(.*?\)\s*\{/m.test(source);
  }

  /**
   * Get function names from source
   */
  static getFunctionNames(source: string): string[] {
    const functions = this.parseFunctionDefinitions(source);
    return functions.map(f => f.name);
  }

  /**
   * Extract all parameters across functions
   */
  static getAllParameters(source: string): Record<string, string[]> {
    const functions = this.parseFunctionDefinitions(source);
    const result: Record<string, string[]> = {};
    for (const fn of functions) {
      result[fn.name] = fn.params;
    }
    return result;
  }
}
