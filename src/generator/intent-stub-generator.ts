/**
 * Phase 2 Task 2.3: Stub Generator
 *
 * Generates code stubs from intent descriptions:
 * - Function skeleton generation
 * - Parameter type inference
 * - Default body generation
 * - Documentation generation
 *
 * Example:
 * ```
 * Intent: "배열의 합을 구하는 함수"
 * ↓
 * fn sum_array(arr)
 *   // 배열의 합을 구하는 함수
 *   total = 0
 *   for i in 0..arr.length
 *     total = total + arr[i]
 *   total
 * ```
 */

export interface StubGenerationOptions {
  indent?: number;
  includeDocumentation?: boolean;
  includeTodos?: boolean;
  inferTypes?: boolean;
}

export interface GeneratedStub {
  functionName: string;
  parameters: Array<{
    name: string;
    type: string;
    inferredFrom?: string;
  }>;
  returnType: string;
  body: string;
  fullCode: string;
  confidence: number; // 0.0 ~ 1.0
}

export class StubGenerator {
  private parameterPatterns: Map<string, string> = new Map();
  private returnTypePatterns: Map<string, string> = new Map();
  private intentPatterns: Map<string, string[]> = new Map();

  constructor() {
    this.initializePatterns();
  }

  /**
   * Initialize pattern matching for intent analysis
   */
  private initializePatterns(): void {
    // Parameter patterns - what keywords indicate parameter names/types
    this.parameterPatterns.set('배열', 'array');
    this.parameterPatterns.set('문자열', 'string');
    this.parameterPatterns.set('숫자', 'number');
    this.parameterPatterns.set('리스트', 'array');
    this.parameterPatterns.set('데이터', 'any');
    this.parameterPatterns.set('입력', 'any');
    this.parameterPatterns.set('값', 'any');
    this.parameterPatterns.set('길이', 'number');
    this.parameterPatterns.set('크기', 'number');
    this.parameterPatterns.set('개수', 'number');

    // Return type patterns
    this.returnTypePatterns.set('합', 'number');
    this.returnTypePatterns.set('곱', 'number');
    this.returnTypePatterns.set('개수', 'number');
    this.returnTypePatterns.set('합계', 'number');
    this.returnTypePatterns.set('결과', 'any');
    this.returnTypePatterns.set('값', 'any');
    this.returnTypePatterns.set('배열', 'array');
    this.returnTypePatterns.set('문자열', 'string');
    this.returnTypePatterns.set('여부', 'bool');
    this.returnTypePatterns.set('확인', 'bool');

    // Intent patterns - what keywords trigger specific body generation
    this.intentPatterns.set('합', ['sum', 'total = 0', 'for i in', 'total = total +']);
    this.intentPatterns.set('필터', ['filter', 'result = []', 'for x in', 'if condition']);
    this.intentPatterns.set('찾기', ['find', 'for x in', 'if condition', 'return x']);
    this.intentPatterns.set('개수', ['count', 'count = 0', 'for x in', 'count = count + 1']);
    this.intentPatterns.set('길이', ['length', 'if arr', 'return arr.length']);
    this.intentPatterns.set('매핑', ['map', 'result = []', 'for x in', 'result.push(transform(x))']);
  }

  /**
   * Generate stub from intent description
   *
   * Intent analysis:
   * - Extract function name from intent
   * - Infer parameters and their types
   * - Determine return type
   * - Generate appropriate body
   */
  public generateFromIntent(
    intent: string,
    options: StubGenerationOptions = {}
  ): GeneratedStub {
    const {
      indent = 2,
      includeDocumentation = true,
      includeTodos = true,
      inferTypes = true,
    } = options;

    // Step 1: Extract function name from intent
    const functionName = this.extractFunctionName(intent);

    // Step 2: Infer parameters
    const parameters = this.inferParameters(intent, inferTypes);

    // Step 3: Infer return type
    const returnType = this.inferReturnType(intent);

    // Step 4: Generate body
    const body = this.generateBody(intent, parameters, returnType, indent, includeTodos);

    // Step 5: Generate full code
    const fullCode = this.formatCode(
      functionName,
      parameters,
      body,
      indent,
      includeDocumentation ? intent : undefined
    );

    // Calculate confidence based on pattern matches
    const confidence = this.calculateConfidence(intent, parameters, returnType, body);

    return {
      functionName,
      parameters,
      returnType,
      body,
      fullCode,
      confidence,
    };
  }

  /**
   * Extract function name from intent
   *
   * Strategies:
   * 1. Look for "함수" or "메서드" keyword
   * 2. Extract first meaningful noun
   * 3. Convert to snake_case
   */
  private extractFunctionName(intent: string): string {
    // Remove common prefixes
    let name = intent
      .replace(/^(이|그|그것을|것을|함수|메서드)\s*/gi, '')
      .replace(/의\s*함수$/, '')
      .replace(/를?\s*구하(는|는)?(\s*함수)?$/, '')
      .trim();

    // Extract first 1-3 words
    const words = name.split(/[\s\-_()【】]/).filter(w => w.length > 0);

    if (words.length === 0) {
      return 'process';
    }

    // Convert to snake_case
    const funcName = words
      .slice(0, 3)
      .join('_')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');

    return funcName || 'process';
  }

  /**
   * Infer parameters from intent
   *
   * Looks for parameter keywords and types
   */
  private inferParameters(
    intent: string,
    inferTypes: boolean
  ): Array<{ name: string; type: string; inferredFrom?: string }> {
    const parameters: Array<{ name: string; type: string; inferredFrom?: string }> = [];

    // Common parameter patterns
    const patterns = [
      { name: 'arr', keywords: ['배열', '리스트', '어레이'] },
      { name: 'data', keywords: ['데이터', '입력'] },
      { name: 'str', keywords: ['문자열', '스트링', '텍스트'] },
      { name: 'x', keywords: ['값', '요소', '항목', '원소'] },
      { name: 'n', keywords: ['숫자', '개수', '수', '길이', '크기'] },
      { name: 'condition', keywords: ['조건', '필터', '판별'] },
      { name: 'fn', keywords: ['함수', '변환', '매핑'] },
    ];

    for (const { name, keywords } of patterns) {
      for (const keyword of keywords) {
        if (intent.includes(keyword)) {
          let type = 'any';

          if (inferTypes) {
            // Infer type from keyword
            type = this.parameterPatterns.get(keyword) || 'any';

            // Special cases
            if (keyword.includes('배열') || keyword.includes('리스트')) {
              type = 'array';
            } else if (keyword.includes('문자열')) {
              type = 'string';
            } else if (keyword.includes('숫자') || keyword.includes('개수')) {
              type = 'number';
            }
          }

          if (!parameters.find(p => p.name === name)) {
            parameters.push({
              name,
              type,
              inferredFrom: keyword,
            });
          }
          break;
        }
      }
    }

    // Default parameter if none inferred
    if (parameters.length === 0) {
      parameters.push({ name: 'input', type: 'any', inferredFrom: 'default' });
    }

    return parameters;
  }

  /**
   * Infer return type from intent
   */
  private inferReturnType(intent: string): string {
    for (const [keyword, type] of this.returnTypePatterns) {
      if (intent.includes(keyword)) {
        return type;
      }
    }

    // Default to any
    return 'any';
  }

  /**
   * Generate function body based on intent
   *
   * Pattern-based generation:
   * - "합" → summation loop
   * - "필터" → filter loop
   * - "찾기" → search loop
   * - etc.
   */
  private generateBody(
    intent: string,
    parameters: Array<{ name: string; type: string }>,
    returnType: string,
    indent: number,
    includeTodos: boolean
  ): string {
    const indentStr = ' '.repeat(indent);
    let body = '';

    // Match intent patterns
    if (intent.includes('합') || intent.includes('합계') || intent.includes('더하')) {
      // Summation pattern
      const arrParam = parameters.find(p => p.type === 'array')?.name || 'arr';
      body = [
        `${indentStr}total = 0`,
        `${indentStr}for i in 0..${arrParam}.length`,
        `${indentStr}  total = total + ${arrParam}[i]`,
        `${indentStr}total`,
      ].join('\n');
    } else if (intent.includes('필터') || intent.includes('거르')) {
      // Filter pattern
      const arrParam = parameters.find(p => p.type === 'array')?.name || 'arr';
      body = [
        `${indentStr}result = []`,
        `${indentStr}for x in ${arrParam}`,
        `${indentStr}  if condition(x)`,
        `${indentStr}    result.push(x)`,
        `${indentStr}result`,
      ].join('\n');
    } else if (intent.includes('찾') || intent.includes('검색')) {
      // Find/search pattern
      const arrParam = parameters.find(p => p.type === 'array')?.name || 'arr';
      body = [
        `${indentStr}for x in ${arrParam}`,
        `${indentStr}  if condition(x)`,
        `${indentStr}    return x`,
        `${indentStr}return null`,
      ].join('\n');
    } else if (intent.includes('개수') || intent.includes('세')) {
      // Count pattern
      const arrParam = parameters.find(p => p.type === 'array')?.name || 'arr';
      body = [
        `${indentStr}count = 0`,
        `${indentStr}for x in ${arrParam}`,
        `${indentStr}  if condition(x)`,
        `${indentStr}    count = count + 1`,
        `${indentStr}count`,
      ].join('\n');
    } else if (intent.includes('변환') || intent.includes('매핑')) {
      // Map pattern
      const arrParam = parameters.find(p => p.type === 'array')?.name || 'arr';
      body = [
        `${indentStr}result = []`,
        `${indentStr}for x in ${arrParam}`,
        `${indentStr}  result.push(transform(x))`,
        `${indentStr}result`,
      ].join('\n');
    } else {
      // Default pattern
      body = [
        `${indentStr}// TODO: Implement logic`,
        `${indentStr}// Parameters: ${parameters.map(p => `${p.name}: ${p.type}`).join(', ')}`,
        `${indentStr}// Return: ${returnType}`,
      ].join('\n');

      if (includeTodos) {
        body += `\n${indentStr}result = null`;
        body += `\n${indentStr}result`;
      }
    }

    return body;
  }

  /**
   * Format code with proper structure
   */
  private formatCode(
    funcName: string,
    parameters: Array<{ name: string; type: string }>,
    body: string,
    indent: number,
    documentation?: string
  ): string {
    let code = '';

    // Documentation comment
    if (documentation) {
      code += `// ${documentation}\n`;
    }

    // Function signature
    const paramStr = parameters.map(p => p.name).join(', ');
    code += `fn ${funcName}(${paramStr})\n`;

    // Body
    code += body;

    return code;
  }

  /**
   * Calculate confidence score (0.0 ~ 1.0)
   *
   * Based on:
   * - Pattern matches
   * - Parameter inference success
   * - Type inference success
   * - Body generation quality
   */
  private calculateConfidence(
    intent: string,
    parameters: Array<{ name: string; type: string }>,
    returnType: string,
    body: string
  ): number {
    let score = 0.7; // Base confidence

    // Check for clear intent keywords
    const intentKeywords = [
      '합',
      '필터',
      '찾',
      '변환',
      '개수',
      '정렬',
      '중복',
      '비교',
    ];
    const hasIntentKeyword = intentKeywords.some(k => intent.includes(k));
    if (hasIntentKeyword) score += 0.15;

    // Check parameter inference
    if (parameters.length > 0) score += 0.05;

    // Check return type inference
    if (returnType !== 'any') score += 0.05;

    // Check body has implementation (not just TODO)
    if (!body.includes('TODO') || body.split('\n').length > 3) {
      score += 0.05;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Generate multiple stub variants
   */
  public generateVariants(
    intent: string,
    count: number = 3
  ): GeneratedStub[] {
    const variants: GeneratedStub[] = [];

    // Generate with different options
    const options: StubGenerationOptions[] = [
      { includeDocumentation: true, includeTodos: true },
      { includeDocumentation: false, includeTodos: true },
      { includeDocumentation: true, includeTodos: false },
    ];

    for (let i = 0; i < Math.min(count, options.length); i++) {
      variants.push(this.generateFromIntent(intent, options[i]));
    }

    return variants;
  }

  /**
   * Quick stub - minimal version
   */
  public generateQuickStub(intent: string): string {
    const stub = this.generateFromIntent(intent, {
      includeDocumentation: false,
      includeTodos: false,
    });

    return stub.fullCode;
  }

  /**
   * Full stub - maximum documentation
   */
  public generateFullStub(intent: string): string {
    const stub = this.generateFromIntent(intent, {
      includeDocumentation: true,
      includeTodos: true,
      indent: 2,
    });

    return stub.fullCode;
  }
}
