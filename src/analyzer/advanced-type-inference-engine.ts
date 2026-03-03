/**
 * Phase 5 Stage 1: Advanced Type Inference Engine
 *
 * AST-based semantic type inference foundation
 * - Pattern-based type analysis (literals, arrays, operations)
 * - Function call return type inference
 * - Control flow analysis
 * - Transitive type inference
 *
 * Goals:
 * - Establish foundation for semantic type inference
 * - Support 6+ inference sources
 * - Integrate with Phase 4's multi-source architecture in Stage 2
 * - Achieve 70-75% accuracy (standalone)
 *
 * Key Capabilities:
 * 1. Literal pattern matching (10 → number, "text" → string, [] → array)
 * 2. Method call detection (arr.push → array)
 * 3. Operation-based inference (a + b → numeric)
 * 4. Control flow analysis (if/else branches)
 * 5. Function call return type inference
 * 6. Transitive inference (x=10; y=x → y is number)
 */

import { Expression, LiteralExpression, ArrayExpression } from '../parser/ast';

/**
 * Advanced type inference result
 */
export interface AdvancedTypeInfo {
  variableName: string;
  inferredType: string;
  confidence: number;        // 0.0-1.0
  source: 'assignment' | 'method' | 'operation' | 'transitive' | 'function_call' | 'control_flow';
  reasoning: string[];
  relatedVariables?: string[];
}

/**
 * Function call analysis result
 */
export interface FunctionCallAnalysis {
  functionName: string;
  returnType?: string;
  parameterTypes: Map<string, string>;
  confidence: number;
  reasoning: string[];
}

/**
 * Advanced Type Inference Engine
 *
 * This engine performs AST-based pattern matching to infer types
 * without relying on keyword dictionaries.  It will be integrated
 * with Phase 3's SemanticAnalyzer and ContextTracker in Stage 2.
 */
export class AdvancedTypeInferenceEngine {
  // Cache for inferred types
  private inferredTypes: Map<string, string> = new Map();
  private typeConfidence: Map<string, number> = new Map();

  // Function call cache
  private functionCalls: Map<string, FunctionCallAnalysis> = new Map();

  /**
   * Main inference method
   * Analyzes code patterns to infer variable types
   */
  public infer(code: string, functionName?: string): Map<string, AdvancedTypeInfo> {
    this.inferredTypes.clear();
    this.typeConfidence.clear();
    this.functionCalls.clear();

    const results = new Map<string, AdvancedTypeInfo>();

    // Step 1: Apply control flow analysis FIRST (so conditionals are marked before general assignment)
    this.applyControlFlowAnalysis(results, code);

    // Step 2: Extract and analyze variable assignments
    this.analyzeAssignments(code, results);

    // Step 3: Apply operation-based inference (adds reasoning)
    this.applyOperationInference(results, code);

    // Step 4: Apply method call detection
    this.applyMethodCallDetection(results, code);

    // Step 5: Apply transitive inference
    this.applyTransitiveInference(results, code);

    return results;
  }

  /**
   * Analyze variable assignments to extract types
   * Note: Only processes global-scope assignments (not within if/else)
   */
  private analyzeAssignments(code: string, results: Map<string, AdvancedTypeInfo>): void {
    // Remove if/else blocks temporarily to find only global assignments
    let codeWithoutConditionals = code;
    const ifElsePattern = /if\s*\(.*?\)\s*(?:do\s*)?([\s\S]*?)(?:else\s*(?:do\s*)?([\s\S]*?))?(?=\nif|\n[a-z]|$)/gi;
    codeWithoutConditionals = codeWithoutConditionals.replace(ifElsePattern, '');

    // Pattern: variable = value (on one line, simplified)
    const assignmentPattern = /(\w+)\s*=\s*([^;\n]+)/g;
    let match;

    while ((match = assignmentPattern.exec(codeWithoutConditionals)) !== null) {
      const [, varName, valueStr] = match;
      const valueType = this.inferTypeFromValue(valueStr.trim());

      if (valueType && !results.has(varName)) {
        results.set(varName, {
          variableName: varName,
          inferredType: valueType.type,
          confidence: valueType.confidence,
          source: 'assignment',
          reasoning: [`Assignment: Literal value of type ${valueType.type}`],
        });
      }
    }
  }

  /**
   * Infer type from value string (literal pattern matching)
   */
  private inferTypeFromValue(value: string): { type: string; confidence: number } | null {
    // Number literal: 10, 3.14, -5
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return { type: 'number', confidence: 0.95 };
    }

    // String literal: "text", 'text'
    if (/^["'].*["']$/.test(value)) {
      return { type: 'string', confidence: 0.95 };
    }

    // Boolean: true, false
    if (/^(true|false)$/.test(value)) {
      return { type: 'boolean', confidence: 0.95 };
    }

    // Array literal: [], [1, 2, 3]
    if (/^\[.*\]$/.test(value)) {
      return { type: 'array<unknown>', confidence: 0.85 };
    }

    return null;
  }

  /**
   * Apply operation-based inference
   * Infer that operands in arithmetic operations are numeric
   */
  private applyOperationInference(results: Map<string, AdvancedTypeInfo>, code: string): void {
    // Arithmetic operations: +, -, *, /
    const operationPatterns = [
      /(\w+)\s*[\+\-\*\/]\s*(\w+)/g,  // x + y, x - y, x * y, x / y
    ];

    operationPatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const [operationStr, var1, var2] = match;

        // Both operands in arithmetic must be numeric
        if (results.has(var1)) {
          const info = results.get(var1)!;
          // Always add arithmetic reasoning (don't just replace, enhance)
          info.reasoning.push(`Operation: ${operationStr} → arithmetic operand`);
          if (info.inferredType === 'unknown' || !info.inferredType) {
            info.inferredType = 'number';
            info.confidence = 0.80;
            info.source = 'operation';
          }
        } else {
          results.set(var1, {
            variableName: var1,
            inferredType: 'number',
            confidence: 0.75,
            source: 'operation',
            reasoning: [`Operation: ${operationStr} → arithmetic operand`],
          });
        }

        if (results.has(var2)) {
          const info = results.get(var2)!;
          // Always add arithmetic reasoning (don't just replace, enhance)
          info.reasoning.push(`Operation: ${operationStr} → arithmetic operand`);
          if (info.inferredType === 'unknown' || !info.inferredType) {
            info.inferredType = 'number';
            info.confidence = 0.80;
            info.source = 'operation';
          }
        } else {
          results.set(var2, {
            variableName: var2,
            inferredType: 'number',
            confidence: 0.75,
            source: 'operation',
            reasoning: [`Operation: ${operationStr} → arithmetic operand`],
          });
        }
      }
    });
  }

  /**
   * Apply method call detection
   * arr.push() → arr is array
   */
  private applyMethodCallDetection(results: Map<string, AdvancedTypeInfo>, code: string): void {
    // Pattern: variable.method(...)
    const methodPattern = /(\w+)\.(\w+)\s*\(/g;
    let match;

    // Track method counts per variable
    const methodCounts = new Map<string, number>();

    while ((match = methodPattern.exec(code)) !== null) {
      const [, varName, methodName] = match;

      // Count method calls
      methodCounts.set(varName, (methodCounts.get(varName) || 0) + 1);

      // Any method call suggests the variable is an object/array
      // Specific array methods: push, pop, shift, unshift, map, filter, forEach, length
      const isArrayMethod = ['push', 'pop', 'shift', 'unshift', 'map', 'filter', 'forEach', 'length'].includes(methodName);

      if (results.has(varName)) {
        const info = results.get(varName)!;
        // Override source to 'method' if we detected a method call
        if (isArrayMethod || info.inferredType === 'unknown' || !info.inferredType) {
          info.inferredType = 'array<unknown>';
          info.confidence = 0.80;
          info.source = 'method';
          info.reasoning.push(`Method: ${methodName}() → array type`);
        } else if (info.source !== 'method') {
          // Add method detection reason even if type is already known
          info.reasoning.push(`Method: ${methodName}() detected`);
        }
      } else {
        results.set(varName, {
          variableName: varName,
          inferredType: 'array<unknown>',
          confidence: 0.75,
          source: 'method',
          reasoning: [`Method: ${methodName}() → array type`],
        });
      }
    }

    // Add method frequency tracking
    methodCounts.forEach((count, varName) => {
      if (count > 1 && results.has(varName)) {
        const info = results.get(varName)!;
        // Add summary reasoning for multiple method calls
        info.reasoning.push(`Method calls detected (${count} calls)`);
      }
    });
  }

  /**
   * Apply control flow analysis
   * Detect conditional assignments that may create union types
   */
  private applyControlFlowAnalysis(results: Map<string, AdvancedTypeInfo>, code: string): void {
    // Simple pattern: find if statements with content until else or next keyword
    const ifPattern = /if\s+(\w+).*?\n([\s\S]*?)(?=\n\s*(?:else|if|fn|for|return|$))/g;
    let match;

    while ((match = ifPattern.exec(code)) !== null) {
      const [fullIfMatch, condition, ifBranch] = match;

      // Look for corresponding else clause after this if block
      const afterIfIndex = match.index + fullIfMatch.length;
      const restOfCode = code.substring(afterIfIndex);
      const elseMatch = restOfCode.match(/^\s*else\s*(?:do)?\s*\n([\s\S]*?)(?=\n\s*(?:if|fn|for|return|$))/);

      if (ifBranch) {
        const ifVars = this.extractVariablesFromBranch(ifBranch);

        ifVars.forEach((type, varName) => {
          if (!results.has(varName)) {
            // First assignment from if branch (conditional assignment)
            results.set(varName, {
              variableName: varName,
              inferredType: type,
              confidence: 0.65, // Lower confidence for conditional
              source: 'control_flow',
              reasoning: [`Control flow: Conditional assignment in if branch`],
            });
          }

          // Check if else branch has different type for same variable
          if (elseMatch && elseMatch[1]) {
            const elseVars = this.extractVariablesFromBranch(elseMatch[1]);
            const elseType = elseVars.get(varName);

            if (elseType) {
              const info = results.get(varName)!;

              if (elseType !== type) {
                // Union type detected: conflicting types in branches
                info.confidence = Math.min(info.confidence * 0.8, 0.65);
                info.reasoning.push(`Control flow: Possible union (if: ${type}, else: ${elseType})`);
              } else {
                // Same type in both branches - confidence boost
                info.confidence = Math.min(info.confidence + 0.15, 0.85);
              }
            }
          }
        });

        // Also check else branch variables
        if (elseMatch && elseMatch[1]) {
          const elseVars = this.extractVariablesFromBranch(elseMatch[1]);
          elseVars.forEach((type, varName) => {
            if (!results.has(varName)) {
              results.set(varName, {
                variableName: varName,
                inferredType: type,
                confidence: 0.65,
                source: 'control_flow',
                reasoning: [`Control flow: Conditional assignment in else branch`],
              });
            }
          });
        }
      }
    }
  }

  /**
   * Extract variables from a code branch
   */
  private extractVariablesFromBranch(branch: string): Map<string, string> {
    const vars = new Map<string, string>();
    const assignmentPattern = /(\w+)\s*=\s*([^;\n]+)/g;
    let match;

    while ((match = assignmentPattern.exec(branch)) !== null) {
      const [, varName, value] = match;
      const type = this.inferTypeFromValue(value.trim());
      if (type) {
        vars.set(varName, type.type);
      }
    }

    return vars;
  }

  /**
   * Apply transitive inference
   * x=10; y=x → y is also number
   */
  private applyTransitiveInference(results: Map<string, AdvancedTypeInfo>, code: string): void {
    const assignmentPattern = /(\w+)\s*=\s*(\w+)/g;
    let match;

    while ((match = assignmentPattern.exec(code)) !== null) {
      const [, target, source] = match;

      // If source has known type, propagate to target
      if (results.has(source) && !results.has(target)) {
        const sourceInfo = results.get(source)!;
        results.set(target, {
          variableName: target,
          inferredType: sourceInfo.inferredType,
          confidence: Math.max(sourceInfo.confidence * 0.95, 0.70),
          source: 'transitive',
          reasoning: [`Transitive: Derived from ${source} (${sourceInfo.inferredType})`],
          relatedVariables: [source],
        });
      }
    }
  }

  /**
   * Analyze function call and infer return type
   */
  public analyzeFunctionCall(
    functionName: string,
    arguments_: string[],
    context: string
  ): FunctionCallAnalysis {
    // Cache hit
    if (this.functionCalls.has(functionName)) {
      return this.functionCalls.get(functionName)!;
    }

    const reasoning: string[] = [];
    const parameterTypes = new Map<string, string>();

    // Infer return type from function name patterns
    let returnType = 'unknown';
    if (functionName.startsWith('is') || functionName.startsWith('has') || functionName.startsWith('can')) {
      returnType = 'boolean';
      reasoning.push(`Predicate: ${functionName} → boolean`);
    } else if (
      functionName.includes('count') ||
      functionName.includes('length') ||
      functionName.includes('size')
    ) {
      returnType = 'number';
      reasoning.push(`Metric: ${functionName} → number`);
    } else if (
      functionName.includes('string') ||
      functionName.includes('text') ||
      functionName.includes('string')
    ) {
      returnType = 'string';
      reasoning.push(`String: ${functionName} → string`);
    } else if (
      functionName.includes('filter') ||
      functionName.includes('map') ||
      functionName.includes('select')
    ) {
      returnType = 'array<unknown>';
      reasoning.push(`Collection: ${functionName} → array`);
    } else if (functionName.startsWith('calculate') || functionName.startsWith('compute')) {
      returnType = 'number';
      reasoning.push(`Computation: ${functionName} → number`);
    }

    const analysis: FunctionCallAnalysis = {
      functionName,
      returnType,
      parameterTypes,
      confidence: returnType !== 'unknown' ? 0.75 : 0.40,
      reasoning,
    };

    this.functionCalls.set(functionName, analysis);
    return analysis;
  }

  /**
   * Get cached inference result
   */
  public getInferredType(varName: string): string | null {
    return this.inferredTypes.get(varName) || null;
  }

  /**
   * Get inference confidence
   */
  public getConfidence(varName: string): number {
    return this.typeConfidence.get(varName) || 0;
  }
}
