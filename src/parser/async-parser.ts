/**
 * FreeLang Parser Extension: Async/Await Support
 *
 * Parses async function declarations and await expressions
 */

import {
  AsyncFunctionDeclaration,
  AsyncFunctionParameter,
  AsyncReturnType,
  AwaitExpression,
  BlockStatement,
  createAsyncFunction,
  createAwaitExpression
} from '../ast/async-await';

/**
 * Parser extension for async/await
 */
export class AsyncParser {
  /**
   * Parse async function declaration
   * @example
   * async fn fetchData(url: string): Promise<string> {
   *   ...
   * }
   */
  parseAsyncFunctionDeclaration(
    tokens: Token[],
    position: number
  ): { node: AsyncFunctionDeclaration; nextPosition: number } {
    let pos = position;

    // Consume 'async' keyword
    if (tokens[pos].type !== 'keyword' || tokens[pos].value !== 'async') {
      throw new ParseError('Expected "async" keyword');
    }
    pos++;

    // Consume 'fn' keyword
    if (tokens[pos].type !== 'keyword' || tokens[pos].value !== 'fn') {
      throw new ParseError('Expected "fn" keyword after "async"');
    }
    pos++;

    // Parse function name
    if (tokens[pos].type !== 'identifier') {
      throw new ParseError('Expected function name');
    }
    const functionName = tokens[pos].value;
    pos++;

    // Parse type parameters (optional)
    let typeParams: string[] = [];
    if (tokens[pos].type === 'operator' && tokens[pos].value === '<') {
      pos++;
      typeParams = [];
      while (tokens[pos].type !== 'operator' || tokens[pos].value !== '>') {
        if (tokens[pos].type !== 'identifier') {
          throw new ParseError('Expected type parameter name');
        }
        typeParams.push(tokens[pos].value);
        pos++;

        if (tokens[pos].type === 'operator' && tokens[pos].value === ',') {
          pos++;
        }
      }
      pos++; // consume '>'
    }

    // Parse parameters
    const params = this.parseAsyncFunctionParameters(tokens, pos);
    pos = params.nextPosition;

    // Parse return type (must be Promise<T>)
    const returnType = this.parseAsyncReturnType(tokens, pos);
    pos = returnType.nextPosition;

    // Parse function body
    const body = this.parseFunctionBody(tokens, pos);
    pos = body.nextPosition;

    const node = createAsyncFunction(
      functionName,
      params.parameters,
      returnType.elementType,
      body.body,
      typeParams
    );

    return { node, nextPosition: pos };
  }

  /**
   * Parse async function parameters
   * @example
   * (url: string, timeout: number)
   */
  private parseAsyncFunctionParameters(
    tokens: Token[],
    position: number
  ): { parameters: AsyncFunctionParameter[]; nextPosition: number } {
    let pos = position;

    // Expect '('
    if (tokens[pos].type !== 'operator' || tokens[pos].value !== '(') {
      throw new ParseError('Expected "(" for parameters');
    }
    pos++;

    const params: AsyncFunctionParameter[] = [];

    while (tokens[pos].type !== 'operator' || tokens[pos].value !== ')') {
      // Parse parameter name
      if (tokens[pos].type !== 'identifier') {
        throw new ParseError('Expected parameter name');
      }
      const paramName = tokens[pos].value;
      pos++;

      // Expect ':'
      if (tokens[pos].type !== 'operator' || tokens[pos].value !== ':') {
        throw new ParseError('Expected ":" after parameter name');
      }
      pos++;

      // Parse parameter type
      const paramType = this.parseType(tokens, pos);
      pos = paramType.nextPosition;

      params.push({
        name: paramName,
        type: paramType.type,
        optional: false
      });

      // Handle comma
      if (tokens[pos].type === 'operator' && tokens[pos].value === ',') {
        pos++;
      }
    }

    // Consume ')'
    pos++;

    return { parameters: params, nextPosition: pos };
  }

  /**
   * Parse async return type (Promise<T>)
   * @example
   * : Promise<string>
   */
  private parseAsyncReturnType(
    tokens: Token[],
    position: number
  ): { elementType: string; nextPosition: number } {
    let pos = position;

    // Expect ':'
    if (tokens[pos].type !== 'operator' || tokens[pos].value !== ':') {
      throw new ParseError('Expected ":" for return type');
    }
    pos++;

    // Expect 'Promise'
    if (tokens[pos].type !== 'identifier' || tokens[pos].value !== 'Promise') {
      throw new ParseError('Async function must return Promise<T>');
    }
    pos++;

    // Expect '<'
    if (tokens[pos].type !== 'operator' || tokens[pos].value !== '<') {
      throw new ParseError('Expected "<" in Promise type');
    }
    pos++;

    // Parse element type
    const elementType = this.parseType(tokens, pos);
    pos = elementType.nextPosition;

    // Expect '>'
    if (tokens[pos].type !== 'operator' || tokens[pos].value !== '>') {
      throw new ParseError('Expected ">" in Promise type');
    }
    pos++;

    return { elementType: elementType.type, nextPosition: pos };
  }

  /**
   * Parse type annotation
   * @example
   * string, number, User, Promise<string>
   */
  private parseType(
    tokens: Token[],
    position: number
  ): { type: string; nextPosition: number } {
    let pos = position;
    let typeStr = '';

    if (tokens[pos].type === 'identifier') {
      typeStr = tokens[pos].value;
      pos++;

      // Handle generic types like User<T>
      if (tokens[pos].type === 'operator' && tokens[pos].value === '<') {
        typeStr += '<';
        pos++;
        while (tokens[pos].type !== 'operator' || tokens[pos].value !== '>') {
          if (tokens[pos].type === 'identifier') {
            typeStr += tokens[pos].value;
          } else if (tokens[pos].type === 'operator' && tokens[pos].value === ',') {
            typeStr += ',';
          }
          pos++;
        }
        typeStr += '>';
        pos++; // consume '>'
      }
    }

    if (!typeStr) {
      throw new ParseError('Expected type annotation');
    }

    return { type: typeStr, nextPosition: pos };
  }

  /**
   * Parse function body (shared with sync functions)
   */
  private parseFunctionBody(
    tokens: Token[],
    position: number
  ): { body: BlockStatement; nextPosition: number } {
    let pos = position;

    // Expect '{'
    if (tokens[pos].type !== 'operator' || tokens[pos].value !== '{') {
      throw new ParseError('Expected "{" for function body');
    }
    pos++;

    const statements: any[] = [];

    while (tokens[pos].type !== 'operator' || tokens[pos].value !== '}') {
      // Simple statement parsing (can be extended)
      statements.push({ type: 'placeholder' });
      pos++;

      if (pos >= tokens.length) {
        throw new ParseError('Unexpected end of file in function body');
      }
    }

    // Consume '}'
    pos++;

    return {
      body: {
        type: 'block-statement',
        statements
      },
      nextPosition: pos
    };
  }

  /**
   * Parse await expression
   * @example
   * await fetch(url)
   * let data = await promise
   */
  parseAwaitExpression(
    tokens: Token[],
    position: number
  ): { node: AwaitExpression; nextPosition: number } {
    let pos = position;

    // Consume 'await' keyword
    if (tokens[pos].type !== 'keyword' || tokens[pos].value !== 'await') {
      throw new ParseError('Expected "await" keyword');
    }
    pos++;

    // Parse the awaited expression
    // For now, simple parsing; can be extended for complex expressions
    if (tokens[pos].type !== 'identifier') {
      throw new ParseError('Expected expression after "await"');
    }

    const exprName = tokens[pos].value;
    pos++;

    // Handle function calls like await fetch(url)
    let isCall = false;
    if (tokens[pos].type === 'operator' && tokens[pos].value === '(') {
      isCall = true;
      // Skip parameters for now
      pos++;
      while (tokens[pos].type !== 'operator' || tokens[pos].value !== ')') {
        pos++;
      }
      pos++; // consume ')'
    }

    const awaitExpr = createAwaitExpression({
      type: isCall ? 'call-expression' : 'identifier',
      name: exprName,
      arguments: isCall ? [] : undefined
    } as any);

    return { node: awaitExpr, nextPosition: pos };
  }
}

/**
 * Token type for parser
 */
export interface Token {
  type: 'keyword' | 'identifier' | 'operator' | 'literal' | 'string';
  value: string;
  line?: number;
  column?: number;
}

/**
 * Parse error
 */
export class ParseError extends Error {
  constructor(message: string) {
    super(`Parse Error: ${message}`);
  }
}

/**
 * Export helper to detect async functions
 */
export function isAsyncFunctionStart(tokens: Token[], position: number): boolean {
  return (
    tokens[position]?.type === 'keyword' &&
    tokens[position]?.value === 'async' &&
    tokens[position + 1]?.type === 'keyword' &&
    tokens[position + 1]?.value === 'fn'
  );
}

/**
 * Export helper to detect await expressions
 */
export function isAwaitExpressionStart(tokens: Token[], position: number): boolean {
  return (
    tokens[position]?.type === 'keyword' &&
    tokens[position]?.value === 'await'
  );
}
