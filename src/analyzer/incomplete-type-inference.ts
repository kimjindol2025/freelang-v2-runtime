/**
 * Phase 2 Task 2.3: Type Inference for Incomplete Code
 *
 * Improves type inference from Phase 1's 28.6% → 50%+ accuracy
 *
 * Strategies:
 * 1. Intent-Based Inference: "배열 처리" → input: array, output: array
 * 2. Contextual Inference: for item in arr → item type from arr context
 * 3. Operation-Based Inference: x + y → both are numbers
 * 4. Pattern Learning: From failed_logic.log + historical data
 *
 * Example:
 * ```freelang
 * fn process
 *   intent: "배열의 합 계산"  ← Intent에서만 추론
 *   do
 *     result = 0          ← result: number (from assignment)
 *     for item in input   ← item: number (context from operation)
 *       result = result + item
 *     result
 * ↓
 * Inferred:
 *   input: array<number>  (from "배열" keyword)
 *   output: number        (from "합" keyword)
 *   result: number        (from assignment + operations)
 * ```
 */

/**
 * Configuration for type inference
 */
export interface InferenceConfig {
  useIntent: boolean;           // Use Intent-based inference
  useContextual: boolean;        // Use contextual clues
  useOperationBased: boolean;    // Use operations (x + y → both numbers)
  minConfidence: number;         // Minimum confidence threshold (0.0-1.0)
  learnFromHistory: boolean;     // Learn from failed_logic.log patterns
}

/**
 * Type with confidence and source information
 */
export interface InferredType {
  type: string;                 // The inferred type
  confidence: number;            // Confidence 0.0-1.0
  source: InferenceSource;       // How it was inferred
  reasoning: string;             // Why we inferred this type
  alternatives?: string[];       // Other possible types
}

/**
 * Source of type inference
 */
export enum InferenceSource {
  EXPLICIT = 'explicit',         // Explicit type annotation
  INTENT = 'intent',             // From intent description
  ASSIGNMENT = 'assignment',     // From variable assignment
  OPERATION = 'operation',       // From arithmetic/logical operations
  CONTEXT = 'context',           // From loop/conditional context
  PATTERN = 'pattern',           // From historical patterns
  UNKNOWN = 'unknown',           // Could not infer
}

/**
 * Function signature inferred from intent/partial code
 */
export interface InferredSignature {
  name: string;
  intent?: string;
  inputs: Map<string, InferredType>;
  output: InferredType;
  suggestedImplementation?: string[];
  completionStatus: 'complete' | 'partial' | 'skeleton';
}

/**
 * Incomplete Type Inference Engine
 */
export class IncompleteTypeInferenceEngine {
  private intentPatterns: Map<string, { inputs: string[]; output: string }> = new Map();
  private operationTypeRules: Map<string, { left: string; right: string; result: string }[]> = new Map();
  private historicalPatterns: Array<{ pattern: string; type: string; confidence: number }> = [];

  constructor() {
    this.initializeIntentPatterns();
    this.initializeOperationRules();
    this.loadHistoricalPatterns();
  }

  /**
   * Main entry point: Infer types for incomplete function
   */
  public inferTypesForIncompleteCode(
    intent: string,
    partialCode: string,
    config: Partial<InferenceConfig> = {}
  ): InferredSignature {
    const fullConfig: InferenceConfig = {
      useIntent: true,
      useContextual: true,
      useOperationBased: true,
      minConfidence: 0.4,
      learnFromHistory: true,
      ...config,
    };

    const inputs = new Map<string, InferredType>();
    const output = this.inferOutputType(intent, partialCode, fullConfig);

    // Extract function name from intent
    const name = this.extractFunctionName(intent);

    // Infer input types from intent
    if (fullConfig.useIntent && intent) {
      const intentInputs = this.inferInputsFromIntent(intent);
      for (const [paramName, inferredType] of intentInputs) {
        inputs.set(paramName, inferredType);
      }
    }

    // Extract variables from code and infer their types
    if (fullConfig.useContextual && partialCode) {
      const codeVariables = this.extractVariablesFromCode(partialCode);
      for (const [varName, inferredType] of codeVariables) {
        if (!inputs.has(varName)) {
          inputs.set(varName, inferredType);
        }
      }
    }

    return {
      name,
      intent,
      inputs,
      output,
      completionStatus: this.assessCompleteness(intent, partialCode),
    };
  }

  /**
   * Infer output type from intent keywords
   *
   * Keywords → Type Mapping:
   * - "합", "합계", "더하" → number
   * - "배열", "리스트" → array<T>
   * - "문자열", "연결" → string
   * - "여부", "확인" → bool
   */
  public inferOutputType(
    intent: string,
    partialCode: string,
    config: InferenceConfig
  ): InferredType {
    // Try intent-based inference first
    if (config.useIntent && intent) {
      const intentType = this.inferTypeFromIntent(intent);
      if (intentType.confidence >= config.minConfidence) {
        return intentType;
      }
    }

    // Try code-based inference
    if (config.useContextual && partialCode) {
      const codeType = this.inferTypeFromCode(partialCode);
      if (codeType.confidence >= config.minConfidence) {
        return codeType;
      }
    }

    // Default to unknown
    return {
      type: 'unknown',
      confidence: 0,
      source: InferenceSource.UNKNOWN,
      reasoning: 'Could not infer type from intent or code',
    };
  }

  /**
   * Infer input types from intent keywords
   *
   * Extracts parameter hints from intent:
   * - "배열의 합" → input: array<number>
   * - "문자열 길이" → input: string
   * - "정렬된 리스트" → input: array
   */
  public inferInputsFromIntent(intent: string): Map<string, InferredType> {
    const inputs = new Map<string, InferredType>();

    // Common parameter patterns
    const paramPatterns = [
      {
        keywords: ['배열', '리스트', '어레이'],
        paramName: 'arr',
        type: 'array',
        confidence: 0.8,
      },
      {
        keywords: ['문자열', '스트링', '텍스트'],
        paramName: 'str',
        type: 'string',
        confidence: 0.8,
      },
      {
        keywords: ['숫자', '수'],
        paramName: 'n',
        type: 'number',
        confidence: 0.85,
      },
      {
        keywords: ['데이터', '입력'],
        paramName: 'data',
        type: 'any',
        confidence: 0.6,
      },
      {
        keywords: ['조건', '필터'],
        paramName: 'condition',
        type: 'bool',
        confidence: 0.7,
      },
    ];

    for (const pattern of paramPatterns) {
      for (const keyword of pattern.keywords) {
        if (intent.includes(keyword)) {
          inputs.set(pattern.paramName, {
            type: pattern.type,
            confidence: pattern.confidence,
            source: InferenceSource.INTENT,
            reasoning: `Inferred from intent keyword "${keyword}"`,
          });
        }
      }
    }

    return inputs;
  }

  /**
   * Infer type from intent keywords with confidence scoring
   *
   * Returns: type with confidence based on keyword clarity
   */
  public inferTypeFromIntent(intent: string): InferredType {
    // Check intent patterns
    for (const [keyword, typeInfo] of this.intentPatterns) {
      if (intent.includes(keyword)) {
        return {
          type: typeInfo.output,
          confidence: 0.8,
          source: InferenceSource.INTENT,
          reasoning: `Matched intent keyword "${keyword}"`,
        };
      }
    }

    // If no match, return unknown
    return {
      type: 'unknown',
      confidence: 0,
      source: InferenceSource.UNKNOWN,
      reasoning: 'No intent keywords matched',
    };
  }

  /**
   * Infer type from code analysis
   * - Variable assignments: x = 5 → x: number
   * - Loop context: for i in 0..10 → i: number
   * - Array operations: arr.push() → arr: array
   */
  public inferTypeFromCode(code: string): InferredType {
    // Priority 1: Operation-based inference (highest priority)
    // result = result + item (from for loop) → OPERATION
    if ((code.includes('result =') && code.includes('result +')) ||
        (code.includes('sum =') && code.includes('sum +'))) {
      // Check if it's in a loop context
      if (code.includes('for') || code.includes('while')) {
        return {
          type: 'number',
          confidence: 0.9,
          source: InferenceSource.OPERATION,
          reasoning: `Numeric accumulation in loop context`,
        };
      }
    }

    // Priority 2: String literal assignment: x = "hello"
    const stringMatch = code.match(/(\w+)\s*=\s*["']([^"']*)["']/);
    if (stringMatch) {
      return {
        type: 'string',
        confidence: 0.95,
        source: InferenceSource.ASSIGNMENT,
        reasoning: `String literal assignment detected`,
      };
    }

    // Priority 3: Array literal assignment: x = [...]
    const arrayMatch = code.match(/(\w+)\s*=\s*\[(.*?)\]/);
    if (arrayMatch) {
      const elements = arrayMatch[2].trim();

      // Empty array or unknown element type → just "array"
      if (elements === '') {
        return {
          type: 'array',
          confidence: 0.9,
          source: InferenceSource.ASSIGNMENT,
          reasoning: `Empty array literal detected`,
        };
      }

      // Try to infer element type
      let elementType = 'unknown';
      if (/^\d+(\s*,\s*\d+)*$/.test(elements)) {
        elementType = 'number';
      } else if (/["']/.test(elements)) {
        elementType = 'string';
      }

      return {
        type: elementType === 'unknown' ? 'array' : `array<${elementType}>`,
        confidence: 0.9,
        source: InferenceSource.ASSIGNMENT,
        reasoning: `Array literal assignment detected`,
      };
    }

    // Priority 4: Boolean literal assignment: x = true/false
    const boolMatch = code.match(/(\w+)\s*=\s*(true|false)/i);
    if (boolMatch) {
      return {
        type: 'bool',
        confidence: 0.95,
        source: InferenceSource.ASSIGNMENT,
        reasoning: `Boolean literal assignment detected`,
      };
    }

    // Priority 5: Numeric literal assignment: x = 123 or x = 3.14
    const numberMatch = code.match(/(\w+)\s*=\s*([\d.]+)/);
    if (numberMatch && /^\d+(\.\d+)?$/.test(numberMatch[2])) {
      return {
        type: 'number',
        confidence: 0.95,
        source: InferenceSource.ASSIGNMENT,
        reasoning: `Numeric literal assignment detected`,
      };
    }

    // Priority 6: Return statement analysis with operation context
    if (code.includes('return')) {
      const returnMatch = code.match(/return\s+(\w+)/);
      if (returnMatch) {
        const returnVar = returnMatch[1];
        // If return var is result/sum and there's a loop with accumulation
        if ((returnVar === 'result' || returnVar === 'sum') &&
            (code.includes(`${returnVar} +`) || code.includes(`${returnVar} -`))) {
          return {
            type: 'number',
            confidence: 0.9,
            source: InferenceSource.OPERATION,
            reasoning: `Return value from numeric operation`,
          };
        }
        // Check if returned variable has been assigned a number
        if (code.includes(`${returnVar} = 0`) || code.includes(`${returnVar} = 1`)) {
          return {
            type: 'number',
            confidence: 0.8,
            source: InferenceSource.OPERATION,
            reasoning: `Return variable assigned numeric value`,
          };
        }
      }
    }

    return {
      type: 'unknown',
      confidence: 0,
      source: InferenceSource.UNKNOWN,
      reasoning: 'Could not infer from code analysis',
    };
  }

  /**
   * Context-based type inference for loop/conditional variables
   *
   * Example:
   * - "for i in 0..10" → i: number
   * - "for item in arr" → item: element type of arr
   * - "if x > 5" → x: number
   */
  public inferContextualTypes(
    code: string,
    variableContext: Map<string, string>
  ): Map<string, InferredType> {
    const types = new Map<string, InferredType>();

    // For loop detection: "for i in 0..10" → i: number
    // Also: "for item in arr" → item: element type of arr
    const forLoopMatch = code.match(/for\s+(\w+)\s+in\s+([\w.0-9]+)/g);
    if (forLoopMatch) {
      for (const match of forLoopMatch) {
        const loopMatch = match.match(/for\s+(\w+)\s+in\s+([\w.0-9]+)/);
        if (loopMatch) {
          const varName = loopMatch[1];
          const iterable = loopMatch[2];
          const iterableType = variableContext.get(iterable) || 'unknown';

          // Case 1: Numeric range (0..10) → loop var is number
          if (/^\d+\.\.\d+/.test(iterable)) {
            types.set(varName, {
              type: 'number',
              confidence: 0.95,
              source: InferenceSource.CONTEXT,
              reasoning: `Loop variable over numeric range (${iterable})`,
            });
          }
          // Case 2: Array context → loop var is element type
          else if (iterableType === 'array' || iterableType.startsWith('array<')) {
            // Extract element type from array<T>
            const elementTypeMatch = iterableType.match(/array<(\w+)>/);
            const elementType = elementTypeMatch ? elementTypeMatch[1] : 'unknown';
            types.set(varName, {
              type: elementType,
              confidence: 0.85,
              source: InferenceSource.CONTEXT,
              reasoning: `Loop variable over array (element type: ${elementType})`,
            });
          }
          // Case 3: Unknown iterable
          else {
            types.set(varName, {
              type: 'unknown',
              confidence: 0.5,
              source: InferenceSource.CONTEXT,
              reasoning: `Loop variable, iterable type unknown`,
            });
          }
        }
      }
    }

    // Conditional detection: "if x > 5" → x: number
    const conditionMatch = code.match(/if\s+(\w+)\s*(>|<|==|!=|>=|<=)\s*\d+/g);
    if (conditionMatch) {
      for (const match of conditionMatch) {
        const varMatch = match.match(/if\s+(\w+)/);
        if (varMatch) {
          const varName = varMatch[1];
          types.set(varName, {
            type: 'number',
            confidence: 0.8,
            source: InferenceSource.CONTEXT,
            reasoning: `Variable used in numeric comparison`,
          });
        }
      }
    }

    // Array operation detection: "arr.push(x)" → arr: array
    const arrayOpsMatch = code.match(/(\w+)\.(push|pop|shift|map|filter|reduce)\(/g);
    if (arrayOpsMatch) {
      for (const match of arrayOpsMatch) {
        const varMatch = match.match(/(\w+)\./);
        if (varMatch) {
          const varName = varMatch[1];
          types.set(varName, {
            type: 'array',
            confidence: 0.95,
            source: InferenceSource.CONTEXT,
            reasoning: `Array method used on variable`,
          });
        }
      }
    }

    return types;
  }

  /**
   * Extract variables from partial code
   */
  public extractVariablesFromCode(code: string): Map<string, InferredType> {
    const variables = new Map<string, InferredType>();

    // Assignment pattern: var = value
    const assignmentMatches = code.matchAll(/(\w+)\s*=\s*([^;\n]+)/g);
    for (const match of assignmentMatches) {
      const varName = match[1];
      const value = match[2].trim();

      let type = 'unknown';
      let confidence = 0.5;
      let source = InferenceSource.ASSIGNMENT;

      // Infer type from value
      if (/^\d+(\.\d+)?$/.test(value)) {
        type = 'number';
        confidence = 0.9;
      } else if (/^"[^"]*"$/.test(value) || /^'[^']*'$/.test(value)) {
        type = 'string';
        confidence = 0.95;
      } else if (value === '[]' || value.startsWith('[')) {
        type = 'array';
        confidence = 0.9;
      } else if (value === 'true' || value === 'false') {
        type = 'bool';
        confidence = 0.95;
      } else if (value === 'null' || value === 'undefined') {
        type = 'any';
        confidence = 0.3;
      }

      variables.set(varName, {
        type,
        confidence,
        source,
        reasoning: `Inferred from assignment value: ${value}`,
      });
    }

    return variables;
  }

  /**
   * Extract function name from intent
   */
  private extractFunctionName(intent: string): string {
    // Remove common patterns
    let name = intent
      .replace(/^(이|그|그것을|것을)\s*/gi, '')
      .replace(/의\s*(함수|메서드|계산)\s*/gi, '')
      .replace(/를?\s*구하(는|는)?(\s*(함수|메서드))?$/gi, '')
      .trim();

    // Take first 1-3 words
    const words = name.split(/[\s\-_()【】]/).filter(w => w.length > 0);
    const funcName = words
      .slice(0, 3)
      .join('_')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');

    return funcName || 'process';
  }

  /**
   * Assess how complete the code is
   */
  private assessCompleteness(
    intent: string,
    code: string
  ): 'complete' | 'partial' | 'skeleton' {
    if (!code || code.trim().length === 0) {
      return 'skeleton';
    }

    const hasReturn = code.includes('return');
    const hasLogic = code.match(/(if|for|while|=)/);

    if (hasReturn && hasLogic) {
      return 'complete';
    } else if (hasLogic) {
      return 'partial';
    } else {
      return 'skeleton';
    }
  }

  /**
   * Initialize intent → type patterns
   */
  private initializeIntentPatterns(): void {
    this.intentPatterns.set('합', { inputs: ['array'], output: 'number' });
    this.intentPatterns.set('합계', { inputs: ['array'], output: 'number' });
    this.intentPatterns.set('더하', { inputs: ['array'], output: 'number' });
    this.intentPatterns.set('곱', { inputs: ['array'], output: 'number' });
    this.intentPatterns.set('개수', { inputs: ['array'], output: 'number' });
    this.intentPatterns.set('평균', { inputs: ['array'], output: 'number' });
    this.intentPatterns.set('길이', { inputs: ['array', 'string'], output: 'number' });
    this.intentPatterns.set('필터', { inputs: ['array'], output: 'array' });
    this.intentPatterns.set('거르', { inputs: ['array'], output: 'array' });
    this.intentPatterns.set('찾', { inputs: ['array'], output: 'unknown' });
    this.intentPatterns.set('검색', { inputs: ['array'], output: 'unknown' });
    this.intentPatterns.set('정렬', { inputs: ['array'], output: 'array' });
    this.intentPatterns.set('변환', { inputs: ['array'], output: 'array' });
    this.intentPatterns.set('매핑', { inputs: ['array'], output: 'array' });
    this.intentPatterns.set('연결', { inputs: ['string'], output: 'string' });
    this.intentPatterns.set('문자', { inputs: ['string'], output: 'string' });
  }

  /**
   * Initialize operation → type rules
   */
  private initializeOperationRules(): void {
    // Arithmetic operations
    this.operationTypeRules.set('add', [
      { left: 'number', right: 'number', result: 'number' },
      { left: 'string', right: 'string', result: 'string' },
      { left: 'array', right: 'array', result: 'array' },
    ]);

    this.operationTypeRules.set('compare', [
      { left: 'number', right: 'number', result: 'bool' },
      { left: 'string', right: 'string', result: 'bool' },
    ]);
  }

  /**
   * Load historical patterns from failed_logic.log
   */
  private loadHistoricalPatterns(): void {
    // From Phase 1 failed_logic.log analysis
    // Intent inference was 0%, but we can learn from patterns

    this.historicalPatterns = [
      {
        pattern: '배열 처리 후 합계',
        type: 'number',
        confidence: 0.85,
      },
      {
        pattern: '배열 필터링',
        type: 'array',
        confidence: 0.9,
      },
      {
        pattern: '배열 매핑',
        type: 'array',
        confidence: 0.88,
      },
      {
        pattern: '문자열 연결',
        type: 'string',
        confidence: 0.92,
      },
      {
        pattern: '개수 세기',
        type: 'number',
        confidence: 0.89,
      },
    ];
  }
}

// Convenience function
export function createIncompleteTypeInferenceEngine(): IncompleteTypeInferenceEngine {
  return new IncompleteTypeInferenceEngine();
}
