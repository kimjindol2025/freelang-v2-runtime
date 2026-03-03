/**
 * Phase 1 Task 1.3: Type Inference Engine
 *
 * Automatically infers types for:
 * - Function parameters
 * - Return values
 * - Variable assignments
 * - Expressions
 *
 * Features:
 * - Pattern-based inference (e.g., arr[0] = number → arr is array<number>)
 * - Operation-based inference (number + number = number)
 * - Context-based inference (for i in 0..10 → i is number)
 * - Nested type inference (array<array<number>>)
 */

export interface TypeInfo {
  name: string; // Variable or parameter name
  type: string; // Inferred type (number, string, bool, array, etc.)
  confidence: number; // 0.0 ~ 1.0 confidence level
  source: 'explicit' | 'inferred' | 'context'; // How type was determined
  examples?: unknown[]; // Example values seen
}

export interface InferenceContext {
  variables: Map<string, TypeInfo>;
  functions: Map<string, { params: TypeInfo[]; returns: string }>;
  loopVariables: Map<string, string>; // for i in 0..10 → i:number
  variableAssignments: Map<string, string>; // Track variable → type assignments
}

export class TypeInferenceEngine {
  private context: InferenceContext;
  private typePatterns: Map<string, string[]> = new Map();
  private intentPatterns: Map<string, string> = new Map(); // Intent → Type mapping
  private intentPatternsInitialized: boolean = false;

  constructor() {
    this.context = {
      variables: new Map(),
      functions: new Map(),
      loopVariables: new Map(),
      variableAssignments: new Map(),
    };
    this.initializePatterns();
    // Defer intent pattern initialization (lazy loading)
  }

  /**
   * Initialize intent-based type patterns
   * Maps natural language intent keywords to return types
   */
  private initializeIntentPatterns(): void {
    // Number operations
    this.intentPatterns.set('합', 'number');           // sum
    this.intentPatterns.set('합계', 'number');         // total
    this.intentPatterns.set('평균', 'number');         // average
    this.intentPatterns.set('카운트', 'number');       // count
    this.intentPatterns.set('길이', 'number');         // length
    this.intentPatterns.set('계산', 'number');         // calculate

    // String operations
    this.intentPatterns.set('문자열', 'string');       // string
    this.intentPatterns.set('연결', 'string');         // concatenate
    this.intentPatterns.set('포맷', 'string');         // format
    this.intentPatterns.set('변환', 'string');         // convert

    // Array operations
    this.intentPatterns.set('필터', 'array');          // filter
    this.intentPatterns.set('매핑', 'array');          // map
    this.intentPatterns.set('정렬', 'array');          // sort
    this.intentPatterns.set('목록', 'array');          // list
    this.intentPatterns.set('배열', 'array');          // array

    // Boolean/logic
    this.intentPatterns.set('검증', 'bool');           // validate
    this.intentPatterns.set('확인', 'bool');           // check
    this.intentPatterns.set('비교', 'bool');           // compare
  }

  /**
   * Initialize type pattern rules
   */
  private initializePatterns(): void {
    // Numbers
    this.typePatterns.set('number', [
      '\\d+(\\.\\d+)?',           // 42, 3.14
      '(number|int|float)',       // type keywords
      '(sum|count|length)',       // common number functions
      '(\\+|-|\\*|/|%)',          // arithmetic ops
    ]);

    // Strings
    this.typePatterns.set('string', [
      '"[^"]*"',                  // "hello"
      "'[^']*'",                  // 'world'
      '(string|str)',             // type keywords
      '(concat|substring|split)', // string functions
    ]);

    // Booleans
    this.typePatterns.set('bool', [
      '(true|false)',             // literal booleans
      '(bool|boolean)',           // type keywords
      '(&&|\\|\\||!)',            // logical ops
      '(>|<|==|!=|>=|<=)',        // comparison ops
    ]);

    // Arrays
    this.typePatterns.set('array', [
      '\\[.*\\]',                 // [1, 2, 3]
      '(array|list|vec)',         // type keywords
      '\\.(map|filter|reduce)',   // array methods
      '(for .* in)',              // for loops → array
    ]);
  }

  /**
   * Infer return type from intent (natural language)
   * Maps Korean intent keywords to return types
   * Uses lazy loading for intent patterns
   */
  public inferFromIntent(intent: string): { type: string; confidence: number } {
    if (!intent) {
      return { type: 'any', confidence: 0 };
    }

    // Lazy initialize intent patterns on first use
    if (!this.intentPatternsInitialized) {
      this.initializeIntentPatterns();
      this.intentPatternsInitialized = true;
    }

    const lowerIntent = intent.toLowerCase();

    // Check each intent pattern
    for (const [keyword, returnType] of this.intentPatterns) {
      if (lowerIntent.includes(keyword)) {
        return { type: returnType, confidence: 0.75 };
      }
    }

    // Try English keywords as fallback
    if (lowerIntent.includes('sum') || lowerIntent.includes('total')) {
      return { type: 'number', confidence: 0.75 };
    }
    if (lowerIntent.includes('concat') || lowerIntent.includes('format')) {
      return { type: 'string', confidence: 0.75 };
    }
    if (lowerIntent.includes('filter') || lowerIntent.includes('map')) {
      return { type: 'array', confidence: 0.75 };
    }
    if (lowerIntent.includes('check') || lowerIntent.includes('validate')) {
      return { type: 'bool', confidence: 0.75 };
    }

    return { type: 'any', confidence: 0 };
  }

  /**
   * Infer type from code tokens
   */
  public inferFromTokens(tokens: string[]): TypeInfo[] {
    const inferred: TypeInfo[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Look for assignment: var = value
      if (i + 2 < tokens.length && tokens[i + 1] === '=') {
        const varName = token;
        const value = tokens[i + 2];
        const type = this.inferTypeFromValue(value);

        if (type) {
          // IMPROVED: Confidence based on how certain the inference is
          let confidence = 0.8;
          if (type === 'number' || type === 'string' || type === 'bool') {
            confidence = 0.9; // High confidence for simple literals
          } else if (type === 'array' || type === 'object') {
            confidence = 0.75; // Moderate for complex types
          }

          inferred.push({
            name: varName,
            type,
            confidence,
            source: 'inferred',
          });
          // Track assignment for context-aware inference
          this.context.variableAssignments.set(varName, type);
        } else {
          // IMPROVED: Record assignment attempt but mark as very uncertain
          inferred.push({
            name: varName,
            type: 'any',  // Unknown type
            confidence: 0.15,  // Very low confidence for unknown value assignments
            source: 'inferred',
          });
          this.context.variableAssignments.set(varName, 'any');
        }
      }

      // Look for type annotations: var: type
      if (i + 2 < tokens.length && tokens[i + 1] === ':') {
        const varName = token;
        const type = tokens[i + 2];

        inferred.push({
          name: varName,
          type,
          confidence: 1.0,
          source: 'explicit',
        });
      }

      // Look for for loops: for var in range (must be at least 4 tokens away)
      if (token === 'for' && i + 3 < tokens.length) {
        if (tokens[i + 2] === 'in') {
          const loopVar = tokens[i + 1];
          this.context.loopVariables.set(loopVar, 'number');

          inferred.push({
            name: loopVar,
            type: 'number',
            confidence: 1.0,
            source: 'context',
          });
        }
      }
    }

    return inferred;
  }

  /**
   * Infer type from a value string
   */
  private inferTypeFromValue(value: string): string | null {
    // Check each type pattern
    for (const [type, patterns] of this.typePatterns) {
      for (const pattern of patterns) {
        const regex = new RegExp(pattern);
        if (regex.test(value)) {
          return type;
        }
      }
    }

    return null;
  }

  /**
   * Lookup variable type from context
   * IMPROVED: Context-aware type inference instead of always returning 'any'
   */
  private lookupVariableType(varName: string): { type: string; confidence: number } {
    // Check if this variable was assigned a type
    if (this.context.variableAssignments.has(varName)) {
      const assignedType = this.context.variableAssignments.get(varName)!;
      if (assignedType !== 'any') {
        return { type: assignedType, confidence: 0.7 }; // Good confidence if we tracked it
      }
    }

    // Check loop variables
    if (this.context.loopVariables.has(varName)) {
      return { type: this.context.loopVariables.get(varName)!, confidence: 1.0 };
    }

    // Check declared variables
    if (this.context.variables.has(varName)) {
      const info = this.context.variables.get(varName)!;
      return { type: info.type, confidence: info.confidence };
    }

    // Unknown variable
    return { type: 'any', confidence: 0.1 }; // Very low confidence for completely unknown
  }

  /**
   * Infer return type from function body
   * IMPROVED: Better priority, avoid false positives
   *
   * Strategies (in priority order):
   * 1. Explicit return statements
   * 2. Method calls on returned values
   * 3. Array/string operations
   * 4. Comparison/logical operations
   */
  public inferReturnType(body: string): string {
    const lines = body.split('\n');

    // Strategy 1: Explicit return statements (highest priority)
    let returnedVar: string | null = null;
    for (const line of lines) {
      const returnMatch = line.match(/return\s+(.+)/);
      if (returnMatch) {
        const value = returnMatch[1].trim();

        // Use our improved expression type inference
        const type = this.inferExpressionType(value);
        if (type !== 'any') {
          return type;  // Known type from return expression
        }

        // IMPROVED: If return expression is a variable that's 'any',
        // check if it's assigned somewhere in the body
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
          returnedVar = value;
        } else {
          // For complex expressions that return 'any', continue checking
          return type;
        }
      }
    }

    // If we found a returned variable, try to infer its type from assignment
    if (returnedVar) {
      const assignmentMatch = body.match(new RegExp(`${returnedVar}\\s*=\\s*(.+?)(?:\n|$)`));
      if (assignmentMatch) {
        const assignedExpr = assignmentMatch[1].trim();
        const type = this.inferExpressionType(assignedExpr);
        if (type !== 'any') {
          return type;
        }
      }
    }

    // Strategy 2: Array methods (.map, .filter, etc.) return arrays
    if (body.includes('.map') || body.includes('.filter') || body.includes('.reduce')) {
      return 'array';
    }

    // Strategy 3: String methods return strings
    if (body.includes('.substring') || body.includes('.concat') ||
        body.includes('.toUpperCase') || body.includes('.toLowerCase') ||
        body.includes('.trim')) {
      return 'string';
    }

    // Strategy 4: Array literal or array operations
    if (body.includes('[]') || body.includes('.push') || body.includes('.pop')) {
      return 'array';
    }

    // Strategy 5: Logical/comparison operations (must check BEFORE arithmetic)
    if (body.includes('&&') || body.includes('||') || body.includes('==') ||
        body.includes('!=') || body.includes('>') || body.includes('<')) {
      // Check if these are in return statements
      for (const line of lines) {
        if (line.includes('return') &&
            (line.includes('>') || line.includes('<') || line.includes('==') ||
             line.includes('!=') || line.includes('&&') || line.includes('||'))) {
          return 'bool';
        }
      }
    }

    // Strategy 6: Arithmetic operations (- * / for sure number, + might be string)
    if (body.includes('-') || body.includes('*') || body.includes('/') || body.includes('%')) {
      return 'number';
    }

    // Default: assume number (most common return type in loops/arithmetic)
    return 'number';
  }

  /**
   * Infer parameter types from function usage
   *
   * Analyzes how parameters are used:
   * - arr[0] → arr is array
   * - x + 5 → x is number
   * - str.length → str is string
   */
  public inferParamTypes(paramNames: string[], body: string): Map<string, string> {
    const types = new Map<string, string>();

    for (const param of paramNames) {
      let inferredType = 'any'; // default (avoid false positives)

      // Priority 1: Array detection (must check BEFORE string methods)
      // FIXED: Check array access FIRST because arr.length is both array and string method

      // Array access: param[...]
      if (new RegExp(`${param}\\[`).test(body)) {
        inferredType = 'array';
      }
      // Array methods: param.map, param.filter, param.reduce, etc.
      else if (new RegExp(`${param}\\.(map|filter|reduce|forEach|push|pop|slice)`).test(body)) {
        inferredType = 'array';
      }
      // Priority 2: String-only methods (not shared with array)
      // NOTE: .length is on both arrays and strings, but if we reach here without array detection,
      // .length should be treated as string. Array access/methods are checked first.
      else if (new RegExp(`${param}\\.(substring|concat|split|toUpperCase|toLowerCase|trim|includes|length)`).test(body)) {
        inferredType = 'string';
      }
      // Priority 3: Operations
      else {
        // Arithmetic operations: before or after the operator
        // param - x, x - param, param * x, x * param, etc.
        if (new RegExp(`${param}\\s*[\\-*/%]|[\\-*/%]\\s*${param}`).test(body)) {
          inferredType = 'number';
        }
        // Addition: could be string or number (param + x or x + param)
        else if (new RegExp(`${param}\\s*\\+|\\+\\s*${param}`).test(body)) {
          // Check context: if appears with string literals, it's string
          const addContext = body.match(new RegExp(`[^\\n]*${param}[^\\n]*\\+[^\\n]*|[^\\n]*\\+[^\\n]*${param}[^\\n]*`));
          if (addContext && /["']/.test(addContext[0])) {
            inferredType = 'string';
          } else {
            inferredType = 'number';
          }
        }
        // Comparison/logical operations
        else if (new RegExp(`${param}\\s*(&&|\\|\\||!|==|!=|>|<|>=|<=)`).test(body)) {
          // IMPROVED: Logical ops (&&, ||, !) indicate boolean
          // Comparison ops (>, <, ==, etc.) indicate the param is likely number or comparable
          if (new RegExp(`${param}\\s*(&&|\\|\\||!)`).test(body)) {
            inferredType = 'bool';  // Used in boolean context
          } else {
            // Comparison operators - check if param is being compared with numbers
            const comparisonMatch = body.match(new RegExp(`${param}\\s*(>|<|>=|<=|==|!=)\\s*([0-9]+)`));
            if (comparisonMatch) {
              inferredType = 'number';  // Compared with number literal
            } else {
              // Could be comparing strings too, but number is more common
              inferredType = 'any';  // Uncertain without more context
            }
          }
        }
      }

      types.set(param, inferredType);
    }

    return types;
  }

  /**
   * Infer type of an expression
   * IMPROVED: Context-aware inference, better edge case handling
   *
   * Handles:
   * - Literals (highest priority, 100% confidence)
   * - Method calls (high priority)
   * - Function calls
   * - Binary/unary operations with variable context lookup
   * - Comparison/logical operations
   */
  public inferExpressionType(expr: string): string {
    if (!expr || expr.trim() === '') return 'any';

    expr = expr.trim();

    // 1. Check literals first (most reliable, 100% confidence)

    // Array literals: [1, 2, 3]
    if (expr.startsWith('[') && expr.endsWith(']')) {
      return 'array';
    }

    // String literals: "hello" or 'world'
    if ((expr.startsWith('"') && expr.endsWith('"')) ||
        (expr.startsWith("'") && expr.endsWith("'"))) {
      return 'string';
    }

    // Boolean literals
    if (expr === 'true' || expr === 'false') {
      return 'bool';
    }

    // Number literals (including negative)
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
      return 'number';
    }

    // 2. Handle parentheses - unwrap and re-analyze (edge case)
    if (expr.startsWith('(') && expr.endsWith(')')) {
      const inner = expr.slice(1, -1);
      return this.inferExpressionType(inner);
    }

    // 3. Check method calls (high priority - methods strongly determine type)

    // Array methods return arrays
    if (expr.includes('.map') || expr.includes('.filter') || expr.includes('.slice') ||
        expr.includes('.reduce') || expr.includes('.forEach')) {
      return 'array';
    }

    // String methods return strings
    if (expr.includes('.substring') || expr.includes('.concat') || expr.includes('.split') ||
        expr.includes('.toUpperCase') || expr.includes('.toLowerCase') || expr.includes('.trim') ||
        expr.includes('.repeat') || expr.includes('.padStart')) {
      return 'string';
    }

    // 4. Check function calls

    // Built-in functions
    if (expr.includes('parseInt') || expr.includes('parseFloat') || expr.includes('Number(')) {
      return 'number';
    }
    if (expr.includes('Math.')) return 'number';
    if (expr.includes('JSON.parse')) return 'object';
    if (expr.includes('String(')) return 'string';
    if (expr.includes('Array.')) return 'array';
    if (expr.includes('Boolean(')) return 'bool';

    // User-defined function calls: funcName(...)
    const funcCallMatch = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
    if (funcCallMatch) {
      const funcName = funcCallMatch[1];
      if (this.context.functions.has(funcName)) {
        const funcInfo = this.context.functions.get(funcName)!;
        return funcInfo.returns;
      }
      // If function not registered, try pattern matching on function name
      if (funcName.includes('get') || funcName.includes('sum') || funcName.includes('count')) {
        return 'number';
      }
      if (funcName.includes('format') || funcName.includes('toString')) {
        return 'string';
      }
      if (funcName.includes('filter') || funcName.includes('map')) {
        return 'array';
      }
      if (funcName.includes('is') || funcName.includes('has') || funcName.includes('check')) {
        return 'bool';
      }
    }

    // 5. Check binary operations with IMPROVED context awareness

    // String concatenation: "text" + "more" or "text" + variable
    if (expr.includes('+')) {
      const hasStringLiteral = /["']/.test(expr);
      if (hasStringLiteral) {
        return 'string';  // String concatenation
      }

      // If there are other arithmetic operators (*, /, -), likely number arithmetic
      if (/[\-*/%]/.test(expr)) {
        return 'number';
      }

      // Check if both sides are number literals (e.g., 10 + 5)
      const parts = expr.split('+').map(s => s.trim());
      if (parts.length === 2 && /^\d+(\.\d+)?$/.test(parts[0]) && /^\d+(\.\d+)?$/.test(parts[1])) {
        return 'number';
      }

      // IMPROVED: Check variable context for operands
      if (parts.length === 2) {
        const leftLookup = this.lookupVariableType(parts[0]);
        const rightLookup = this.lookupVariableType(parts[1]);

        // If both sides are known to be numbers
        if (leftLookup.type === 'number' && rightLookup.type === 'number') {
          return 'number';
        }
        // If both sides are known to be strings
        if (leftLookup.type === 'string' && rightLookup.type === 'string') {
          return 'string';
        }
        // If at least one side is known to be string, treat as string concat
        if (leftLookup.type === 'string' || rightLookup.type === 'string') {
          return 'string';
        }
      }

      // Otherwise uncertain (mixed or unknown types)
      return 'any';
    }

    // Arithmetic operators: *, / (more reliably numeric)
    if (/[\*/%]/.test(expr) && !expr.includes('.')) {
      const withoutOps = expr.replace(/[\*/%()]/g, ' ').trim();
      const tokens = withoutOps.split(/\s+/).filter(t => t !== '');

      // If all tokens are numeric literals
      const allNumeric = tokens.every(t => /^-?\d+(\.\d+)?$/.test(t));
      if (allNumeric && tokens.length > 0) {
        return 'number';
      }

      // IMPROVED: Check if all tokens are known-numeric variables
      const allKnownNumeric = tokens.every(t => {
        const lookup = this.lookupVariableType(t);
        return lookup.type === 'number';
      });
      if (allKnownNumeric && tokens.length > 0) {
        return 'number';
      }

      return 'any';  // Mixed or unknown types
    }

    // Subtraction (-) - be careful (negative number vs subtraction)
    if (expr.includes('-') && !expr.includes('.')) {
      // Check if it's a negative number at the start
      if (/^-\d+(\.\d+)?$/.test(expr.trim())) {
        return 'number';
      }

      // Check if it's subtraction of two numbers
      const parts = expr.split('-').map(s => s.trim()).filter(s => s !== '');
      if (parts.length >= 2) {
        const allNumeric = parts.every(t => /^-?\d+(\.\d+)?$/.test(t));
        if (allNumeric) {
          return 'number';
        }

        // IMPROVED: Check context
        const allKnownNumeric = parts.every(t => this.lookupVariableType(t).type === 'number');
        if (allKnownNumeric) {
          return 'number';
        }
      }

      return 'any';
    }

    // 6. Check comparison/logical operations

    if (/[><=!]=?/.test(expr) && !expr.includes('++') && !expr.includes('--')) {
      return 'bool';  // Comparison returns boolean
    }

    if (/&&|\|\||!/.test(expr)) {
      return 'bool';  // Logical operations return boolean
    }

    // 7. Single variable - use context lookup
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expr)) {
      const lookup = this.lookupVariableType(expr);
      return lookup.type;  // Return tracked type or 'any' with low confidence
    }

    // 8. Default - return 'any'
    return 'any';
  }

  /**
   * Register a function with inferred signature
   */
  public registerFunction(
    name: string,
    params: TypeInfo[],
    returnType: string
  ): void {
    this.context.functions.set(name, {
      params,
      returns: returnType,
    });
  }

  /**
   * Get inference context
   */
  public getContext(): InferenceContext {
    return this.context;
  }

  /**
   * Reset context
   */
  public reset(): void {
    this.context = {
      variables: new Map(),
      functions: new Map(),
      loopVariables: new Map(),
      variableAssignments: new Map(),
    };
    // Keep intent patterns initialized (no need to reset)
  }

  /**
   * Generate type annotation from inferred types
   */
  public generateTypeAnnotation(
    varName: string,
    type: string,
    confidence: number
  ): string {
    if (confidence >= 0.9) {
      return `${varName}: ${type}`;
    } else if (confidence >= 0.7) {
      return `${varName}: ${type} // inferred`;
    } else {
      return `${varName}: ${type}? // uncertain`;
    }
  }

  /**
   * Parse and handle generic types like array<number> or array<array<string>>
   */
  public parseGenericType(typeStr: string): string {
    // Handle nested generics: array<array<number>> → stays as is
    // Handle simple generics: array<number> → stays as is
    // This is a placeholder for full generic type support

    typeStr = typeStr.trim();

    // Check if it's a generic type
    if (typeStr.includes('<') && typeStr.includes('>')) {
      // Already a generic type, keep as is
      return typeStr;
    }

    // Check if it's a simple type that could have generics
    if (typeStr === 'array') {
      return 'array<any>';  // Default element type
    }

    return typeStr;
  }

  /**
   * Merge type information from multiple sources
   */
  public mergeTypes(...types: string[]): string {
    // If all types are the same, return that type
    if (new Set(types).size === 1) {
      return types[0];
    }

    // If mixed, return union type
    return types.join(' | ');
  }
}
