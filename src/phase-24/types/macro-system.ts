/**
 * Phase 24.4: Macro System
 * Meta-programming and code generation
 */

export interface Macro {
  name: string;
  parameters: string[];
  expansion: string;
  enabled: boolean;
}

export interface MacroContext {
  macro_name: string;
  arguments: Record<string, any>;
  invocation_site: string;
  timestamp: number;
}

export class MacroSystem {
  private macros: Map<string, Macro> = new Map();
  private invocations: MacroContext[] = [];

  defineMacro(name: string, parameters: string[], expansion: string): Macro {
    const macro: Macro = {
      name,
      parameters,
      expansion,
      enabled: true,
    };

    this.macros.set(name, macro);
    return macro;
  }

  getMacro(name: string): Macro | undefined {
    return this.macros.get(name);
  }

  expand(macro_name: string, args: Record<string, any>): string {
    const macro = this.getMacro(macro_name);
    if (!macro || !macro.enabled) {
      return '';
    }

    let expanded = macro.expansion;

    for (const [key, value] of Object.entries(args)) {
      expanded = expanded.replace(new RegExp(`\\$${key}`, 'g'), String(value));
    }

    this.invocations.push({
      macro_name,
      arguments: args,
      invocation_site: 'runtime',
      timestamp: Date.now(),
    });

    return expanded;
  }

  disableMacro(name: string): void {
    const macro = this.getMacro(name);
    if (macro) {
      macro.enabled = false;
    }
  }

  getInvocationHistory(): MacroContext[] {
    return this.invocations;
  }

  getAllMacros(): Macro[] {
    return Array.from(this.macros.values());
  }

  getStats() {
    return {
      total_macros: this.macros.size,
      invocations: this.invocations.length,
      enabled_macros: Array.from(this.macros.values()).filter((m) => m.enabled).length,
    };
  }
}

export default { MacroSystem };
