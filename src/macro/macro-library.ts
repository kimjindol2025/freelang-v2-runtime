/**
 * FreeLang Macro System: Standard Macro Library
 *
 * Provides commonly used macros for FreeLang development
 */

import {
  MacroDefinition,
  MacroParameter,
  MacroBuilder,
  MacroRegistry
} from './macro-definition';

/**
 * Standard Macros provided with FreeLang
 */
export class StandardMacroLibrary {
  /**
   * assert(condition, message) - Assert a condition at runtime
   *
   * Usage:
   *   assert(x > 0, "x must be positive")
   */
  public static get assert(): MacroDefinition {
    return new MacroBuilder('assert')
      .withParameter('condition', 'expression')
      .withParameter('message', 'expression')
      .withBody(`
        if !(condition) {
          throw Error(message)
        }
      `)
      .withDocs('Assert condition is true, throw error if false')
      .build();
  }

  /**
   * repeat(n, body) - Repeat code block n times
   *
   * Usage:
   *   repeat(3, { console.log("Hello") })
   */
  public static get repeat(): MacroDefinition {
    return new MacroBuilder('repeat')
      .withParameter('n', 'expression')
      .withParameter('body', 'statement')
      .withBody(`
        let __i = 0
        while __i < n {
          body
          __i = __i + 1
        }
      `)
      .withDocs('Repeat body statement n times')
      .build();
  }

  /**
   * times(n, callback) - Execute callback n times with index
   *
   * Usage:
   *   times(5, fn(i) { console.log(i) })
   */
  public static get times(): MacroDefinition {
    return new MacroBuilder('times')
      .withParameter('n', 'expression')
      .withParameter('callback', 'expression')
      .withBody(`
        for let __i in 0..n {
          callback(__i)
        }
      `)
      .withDocs('Execute callback n times with index 0..n-1')
      .build();
  }

  /**
   * trace(expr) - Print value and pass through
   *
   * Usage:
   *   let x = trace(calculate())
   */
  public static get trace(): MacroDefinition {
    return new MacroBuilder('trace')
      .withParameter('expr', 'expression')
      .withBody(`
        (function() {
          let __value = expr
          console.log("trace:", __value)
          return __value
        }())
      `)
      .withDocs('Print value for debugging and return it')
      .build();
  }

  /**
   * debug_print(label, expr) - Debug print with label
   *
   * Usage:
   *   debug_print("x", x + 1)
   */
  public static get debug_print(): MacroDefinition {
    return new MacroBuilder('debug_print')
      .withParameter('label', 'expression')
      .withParameter('expr', 'expression')
      .withBody(`
        console.log(label, "=", expr)
      `)
      .withDocs('Print labeled debug information')
      .build();
  }

  /**
   * unless(condition, body) - Execute body unless condition is true (inverse of if)
   *
   * Usage:
   *   unless(x > 10, { console.log("x is not greater than 10") })
   */
  public static get unless(): MacroDefinition {
    return new MacroBuilder('unless')
      .withParameter('condition', 'expression')
      .withParameter('body', 'statement')
      .withBody(`
        if !(condition) {
          body
        }
      `)
      .withDocs('Execute body if condition is false (inverse of if)');
  }

  /**
   * defer(body) - Execute body at end of scope
   *
   * Usage:
   *   fn cleanup() {
   *     file = open("test.txt")
   *     defer { file.close() }
   *   }
   */
  public static get defer(): MacroDefinition {
    return new MacroBuilder('defer')
      .withParameter('body', 'statement')
      .withBody(`
        try {
          // Nothing here, deferred body executed in finally
        } finally {
          body
        }
      `)
      .withDocs('Execute body at end of scope');
  }

  /**
   * with_lock(lock, body) - Execute body with lock held
   *
   * Usage:
   *   with_lock(mutex, { critical_section() })
   */
  public static get with_lock(): MacroDefinition {
    return new MacroBuilder('with_lock')
      .withParameter('lock', 'expression')
      .withParameter('body', 'statement')
      .withBody(`
        lock.acquire()
        try {
          body
        } finally {
          lock.release()
        }
      `)
      .withDocs('Execute body with lock held');
  }

  /**
   * min(a, b) - Return minimum of two values
   *
   * Usage:
   *   let smallest = min(x, y)
   */
  public static get min(): MacroDefinition {
    return new MacroBuilder('min')
      .withParameter('a', 'expression')
      .withParameter('b', 'expression')
      .withBody(`
        (a < b ? a : b)
      `)
      .withDocs('Return minimum of two values');
  }

  /**
   * max(a, b) - Return maximum of two values
   *
   * Usage:
   *   let largest = max(x, y)
   */
  public static get max(): MacroDefinition {
    return new MacroBuilder('max')
      .withParameter('a', 'expression')
      .withParameter('b', 'expression')
      .withBody(`
        (a > b ? a : b)
      `)
      .withDocs('Return maximum of two values');
  }

  /**
   * clamp(value, min, max) - Clamp value to range
   *
   * Usage:
   *   let clamped = clamp(x, 0, 100)
   */
  public static get clamp(): MacroDefinition {
    return new MacroBuilder('clamp')
      .withParameter('value', 'expression')
      .withParameter('min', 'expression')
      .withParameter('max', 'expression')
      .withBody(`
        (value < min ? min : (value > max ? max : value))
      `)
      .withDocs('Clamp value to range [min, max]');
  }

  /**
   * swap(a, b) - Swap values of two variables
   *
   * Usage:
   *   swap(x, y)
   */
  public static get swap(): MacroDefinition {
    return new MacroBuilder('swap')
      .withParameter('a', 'identifier')
      .withParameter('b', 'identifier')
      .withBody(`
        let __temp = a
        a = b
        b = __temp
      `)
      .withDocs('Swap values of two variables');
  }

  /**
   * strlen(str) - Get string length (compatibility macro)
   *
   * Usage:
   *   let len = strlen("hello")
   */
  public static get strlen(): MacroDefinition {
    return new MacroBuilder('strlen')
      .withParameter('str', 'expression')
      .withBody(`
        str.length
      `)
      .withDocs('Get length of string');
  }

  /**
   * Get all standard macros as registry
   */
  public static getRegistry(): MacroRegistry {
    const registry = new MacroRegistry();

    const macros = [
      this.assert,
      this.repeat,
      this.times,
      this.trace,
      this.debug_print,
      this.unless,
      this.defer,
      this.with_lock,
      this.min,
      this.max,
      this.clamp,
      this.swap,
      this.strlen
    ];

    for (const macro of macros) {
      registry.register(macro);
    }

    return registry;
  }
}

/**
 * Macro library categories
 */
export class MacroLibraryCategories {
  /**
   * Control flow macros
   */
  public static get controlFlow(): MacroDefinition[] {
    return [
      StandardMacroLibrary.unless,
      StandardMacroLibrary.defer,
      StandardMacroLibrary.repeat,
      StandardMacroLibrary.times
    ];
  }

  /**
   * Synchronization macros
   */
  public static get synchronization(): MacroDefinition[] {
    return [
      StandardMacroLibrary.with_lock
    ];
  }

  /**
   * Debugging macros
   */
  public static get debugging(): MacroDefinition[] {
    return [
      StandardMacroLibrary.trace,
      StandardMacroLibrary.debug_print,
      StandardMacroLibrary.assert
    ];
  }

  /**
   * Utility macros
   */
  public static get utilities(): MacroDefinition[] {
    return [
      StandardMacroLibrary.min,
      StandardMacroLibrary.max,
      StandardMacroLibrary.clamp,
      StandardMacroLibrary.swap,
      StandardMacroLibrary.strlen
    ];
  }

  /**
   * All macros organized by category
   */
  public static get allByCategory(): Map<string, MacroDefinition[]> {
    return new Map([
      ['control-flow', this.controlFlow],
      ['synchronization', this.synchronization],
      ['debugging', this.debugging],
      ['utilities', this.utilities]
    ]);
  }
}

/**
 * Macro Documentation Generator
 */
export class MacroDocumentation {
  /**
   * Get documentation for a macro
   */
  public static getDoc(macroName: string): string | undefined {
    const macro = StandardMacroLibrary[macroName as keyof typeof StandardMacroLibrary];

    if (typeof macro === 'function') {
      return undefined;
    }

    if (macro && typeof macro === 'object' && 'docs' in macro) {
      return (macro as any).docs;
    }

    return undefined;
  }

  /**
   * Generate markdown documentation
   */
  public static generateMarkdown(): string {
    let md = '# FreeLang Standard Macro Library\n\n';

    const categories = MacroLibraryCategories.allByCategory;

    for (const [categoryName, macros] of categories) {
      md += `## ${this.categoryToTitle(categoryName)}\n\n`;

      for (const macro of macros) {
        md += `### \`${macro.name}\`\n\n`;
        md += `${macro.docs || 'No documentation'}\n\n`;

        // Parameter documentation
        if (macro.parameters.length > 0) {
          md += 'Parameters:\n';
          for (const param of macro.parameters) {
            md += `- \`${param.name}\`: ${param.kind}`;
            if (param.default) {
              md += ` (default: \`${param.default}\`)`;
            }
            md += '\n';
          }
          md += '\n';
        }
      }
    }

    return md;
  }

  /**
   * Convert category name to title case
   */
  private static categoryToTitle(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
