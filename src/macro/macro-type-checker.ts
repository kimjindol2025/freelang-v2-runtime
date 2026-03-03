/**
 * FreeLang Macro System: Macro Type Checker
 *
 * Validates macro definitions and invocations for type safety
 */

import {
  MacroDefinition,
  MacroParameter,
  MacroParameterKind,
  MacroCallExpression,
  MacroArgument
} from './macro-definition';

/**
 * Macro validation error
 */
export interface MacroValidationError {
  type: 'definition-error' | 'invocation-error' | 'type-error';
  message: string;
  location?: string;
}

/**
 * Macro validation result
 */
export interface MacroValidationResult {
  valid: boolean;
  errors: MacroValidationError[];
}

/**
 * Macro Type Checker
 */
export class MacroTypeChecker {
  /**
   * Validate macro definition
   */
  public static validateMacroDefinition(
    macro: MacroDefinition
  ): MacroValidationResult {
    const errors: MacroValidationError[] = [];

    // Check macro name
    if (!this.isValidIdentifier(macro.name)) {
      errors.push({
        type: 'definition-error',
        message: `Invalid macro name: '${macro.name}'`
      });
    }

    // Check for duplicate parameter names
    const paramNames = new Set<string>();
    for (const param of macro.parameters) {
      if (paramNames.has(param.name)) {
        errors.push({
          type: 'definition-error',
          message: `Duplicate parameter name: '${param.name}'`
        });
      }
      paramNames.add(param.name);
    }

    // Validate each parameter
    for (const param of macro.parameters) {
      const paramErrors = this.validateParameter(param);
      errors.push(...paramErrors);
    }

    // Check body
    if (!macro.body || !macro.body.content) {
      errors.push({
        type: 'definition-error',
        message: 'Macro body is empty'
      });
    }

    // Check variadic consistency
    if (macro.isVariadic && macro.parameters.length === 0) {
      errors.push({
        type: 'definition-error',
        message: 'Variadic macro must have at least one parameter'
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate macro invocation
   */
  public static validateMacroCall(
    call: MacroCallExpression,
    macro: MacroDefinition
  ): MacroValidationResult {
    const errors: MacroValidationError[] = [];

    // Check argument count
    const minArgs = macro.parameters.filter(p => !p.default).length;
    const maxArgs = macro.isVariadic ? Infinity : macro.parameters.length;

    if (call.arguments.length < minArgs) {
      errors.push({
        type: 'invocation-error',
        message: `Macro '${macro.name}' expects at least ${minArgs} arguments ` +
                 `but got ${call.arguments.length}`,
        location: `${call.macroName}(...)`
      });
    }

    if (call.arguments.length > maxArgs && maxArgs !== Infinity) {
      errors.push({
        type: 'invocation-error',
        message: `Macro '${macro.name}' expects at most ${maxArgs} arguments ` +
                 `but got ${call.arguments.length}`,
        location: `${call.macroName}(...)`
      });
    }

    // Type check arguments
    for (let i = 0; i < call.arguments.length && i < macro.parameters.length; i++) {
      const param = macro.parameters[i];
      const arg = call.arguments[i];

      const typeErrors = this.validateArgumentType(arg, param);
      errors.push(...typeErrors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate macro parameter
   */
  private static validateParameter(param: MacroParameter): MacroValidationError[] {
    const errors: MacroValidationError[] = [];

    // Check name
    if (!this.isValidIdentifier(param.name)) {
      errors.push({
        type: 'definition-error',
        message: `Invalid parameter name: '${param.name}'`
      });
    }

    // Check kind
    const validKinds: MacroParameterKind[] = ['expression', 'statement', 'pattern', 'type', 'identifier'];
    if (!validKinds.includes(param.kind)) {
      errors.push({
        type: 'definition-error',
        message: `Invalid parameter kind: '${param.kind}'`
      });
    }

    // Check default value syntax
    if (param.default) {
      if (param.kind === 'statement' && !param.default.includes('{')) {
        errors.push({
          type: 'definition-error',
          message: `Default value for statement parameter must be a block: '${param.default}'`
        });
      }
    }

    return errors;
  }

  /**
   * Validate argument type matches parameter
   */
  private static validateArgumentType(
    arg: MacroArgument,
    param: MacroParameter
  ): MacroValidationError[] {
    const errors: MacroValidationError[] = [];

    switch (param.kind) {
      case 'expression':
        // Should be a value expression
        if (this.isStatementArgument(arg.value)) {
          errors.push({
            type: 'type-error',
            message: `Parameter '${param.name}' expects expression but got statement`
          });
        }
        break;

      case 'statement':
        // Should be a statement
        if (!this.isStatementArgument(arg.value)) {
          errors.push({
            type: 'type-error',
            message: `Parameter '${param.name}' expects statement but got expression`
          });
        }
        break;

      case 'identifier':
        // Should be a simple identifier
        if (!this.isValidIdentifier(arg.value.trim())) {
          errors.push({
            type: 'type-error',
            message: `Parameter '${param.name}' expects identifier but got: '${arg.value}'`
          });
        }
        break;

      case 'type':
        // Should be a type annotation
        if (!this.isTypeAnnotation(arg.value)) {
          errors.push({
            type: 'type-error',
            message: `Parameter '${param.name}' expects type annotation but got: '${arg.value}'`
          });
        }
        break;

      case 'pattern':
        // Pattern is accepted as-is
        break;
    }

    return errors;
  }

  /**
   * Check if value looks like a statement
   */
  private static isStatementArgument(value: string): boolean {
    const trimmed = value.trim();

    // Statements typically start with keywords or have blocks
    const statementKeywords = ['if', 'while', 'for', 'let', 'const', 'var', 'fn', 'return', 'throw', 'try'];
    return statementKeywords.some(keyword => trimmed.startsWith(keyword)) || trimmed.includes('{');
  }

  /**
   * Check if value looks like a type annotation
   */
  private static isTypeAnnotation(value: string): boolean {
    const trimmed = value.trim();

    // Types are usually alphanumeric or contain [ ] for generics
    return /^[a-zA-Z_][\w\[\]<>,|]*$/.test(trimmed);
  }

  /**
   * Check if string is valid identifier
   */
  private static isValidIdentifier(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }
}

/**
 * Macro Constraint Validator
 */
export class MacroConstraintValidator {
  /**
   * Check if macro respects hygiene rules
   */
  public static checkHygiene(macro: MacroDefinition): MacroValidationError[] {
    const errors: MacroValidationError[] = [];
    const body = macro.body.content;

    // Check for unsafe variable names
    const unsafePatterns = [
      /\blet\s+__\w+/g,  // Avoid double underscore prefixes
      /\b([a-z]+__\w+)\b/g  // Unsafe naming convention
    ];

    for (const pattern of unsafePatterns) {
      if (pattern.test(body)) {
        errors.push({
          type: 'definition-error',
          message: 'Macro uses potentially unsafe variable names. Use single underscore prefix for internal variables.'
        });
      }
    }

    return errors;
  }

  /**
   * Check for parameter substitution issues
   */
  public static checkSubstitution(macro: MacroDefinition): MacroValidationError[] {
    const errors: MacroValidationError[] = [];
    const body = macro.body.content;
    const paramNames = macro.parameters.map(p => p.name);

    // Check if all parameter references are properly formed
    for (const paramName of paramNames) {
      const pattern = new RegExp(`\\b${paramName}\\b(?!\\s*[=:])`, 'g');
      const matches = body.match(pattern);

      if (!matches) {
        // Parameter not used in body - this is a warning but not an error
      }
    }

    // Check for potential variable shadowing
    const varDeclPattern = /let\s+(\w+)\s*=/g;
    let match;

    while ((match = varDeclPattern.exec(body)) !== null) {
      const declaredVar = match[1];

      if (paramNames.includes(declaredVar)) {
        errors.push({
          type: 'definition-error',
          message: `Macro variable '${declaredVar}' shadows parameter of same name`
        });
      }
    }

    return errors;
  }
}

/**
 * Macro Conflict Detector
 */
export class MacroConflictDetector {
  /**
   * Check if two macros conflict
   */
  public static checkConflict(macro1: MacroDefinition, macro2: MacroDefinition): boolean {
    // Same name is a conflict
    if (macro1.name === macro2.name) {
      return true;
    }

    // Same parameters might indicate similar functionality
    if (macro1.parameters.length === macro2.parameters.length) {
      const params1 = macro1.parameters.map(p => p.kind).join(',');
      const params2 = macro2.parameters.map(p => p.kind).join(',');

      if (params1 === params2) {
        return true;  // Potential naming conflict
      }
    }

    return false;
  }

  /**
   * Find conflicts in a list of macros
   */
  public static findConflicts(macros: MacroDefinition[]): Array<[MacroDefinition, MacroDefinition]> {
    const conflicts: Array<[MacroDefinition, MacroDefinition]> = [];

    for (let i = 0; i < macros.length; i++) {
      for (let j = i + 1; j < macros.length; j++) {
        if (this.checkConflict(macros[i], macros[j])) {
          conflicts.push([macros[i], macros[j]]);
        }
      }
    }

    return conflicts;
  }
}

/**
 * Comprehensive Macro Validator
 */
export class ComprehensiveMacroValidator {
  /**
   * Validate macro definition comprehensively
   */
  public static validate(macro: MacroDefinition): MacroValidationResult {
    const errors: MacroValidationError[] = [];

    // Basic validation
    const basicResult = MacroTypeChecker.validateMacroDefinition(macro);
    errors.push(...basicResult.errors);

    // Hygiene check
    const hygieneErrors = MacroConstraintValidator.checkHygiene(macro);
    errors.push(...hygieneErrors);

    // Substitution check
    const substitutionErrors = MacroConstraintValidator.checkSubstitution(macro);
    errors.push(...substitutionErrors);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Format errors for display
   */
  public static formatErrors(errors: MacroValidationError[]): string {
    if (errors.length === 0) {
      return 'No errors';
    }

    return errors
      .map((err, idx) => {
        let msg = `${idx + 1}. [${err.type.toUpperCase()}] ${err.message}`;
        if (err.location) {
          msg += ` at ${err.location}`;
        }
        return msg;
      })
      .join('\n');
  }
}
