/**
 * FreeLang CLI - Command Line Interface
 * Usage: freelang <command> [options]
 */

import * as path from 'path';
import { ProgramRunner } from './runner';

interface CLIOptions {
  verbose?: boolean;
  showIR?: boolean;
  debug?: boolean;
}

export class FreeLangCLI {
  private runner: ProgramRunner;

  constructor() {
    this.runner = new ProgramRunner();
  }

  /**
   * Parse command line arguments
   */
  private parseArgs(args: string[]): {
    command: string;
    file?: string;
    options: CLIOptions;
  } {
    const command = args[0];
    const restArgs = args.slice(1);
    const options: CLIOptions = {};

    let file: string | undefined;

    for (const arg of restArgs) {
      if (arg === '--verbose' || arg === '-v') {
        options.verbose = true;
      } else if (arg === '--show-ir') {
        options.showIR = true;
      } else if (arg === '--debug') {
        options.debug = true;
      } else if (!arg.startsWith('-')) {
        file = arg;
      }
    }

    return { command, file, options };
  }

  /**
   * Print help message
   */
  private printHelp(): void {
    console.log(`
FreeLang v2.0.0 - AI-Only Programming Language

Usage:
  freelang run <file>     Run a FreeLang program
  freelang eval <code>    Evaluate FreeLang code
  freelang ir <code>      Show IR for code (debug)
  freelang help          Show this help message
  freelang version       Show version

Options:
  -v, --verbose          Show detailed output
  --show-ir              Display generated IR
  --debug                Enable debug mode

Examples:
  freelang run program.free
  freelang eval "5 + 3"
  freelang ir "10 + 20" --show-ir
`);
  }

  /**
   * Print version
   */
  private printVersion(): void {
    console.log('FreeLang v2.0.0-beta (Phase 18 Day 6)');
  }

  /**
   * Run command
   */
  run(args: string[]): number {
    if (args.length === 0) {
      this.printHelp();
      return 0;
    }

    const { command, file, options } = this.parseArgs(args);

    try {
      switch (command) {
        case 'run': {
          if (!file) {
            console.error('Error: run requires a file path');
            return 1;
          }

          const result = this.runner.runFile(file);

          if (options.verbose) {
            console.log(`[run] ${path.basename(file)}`);
            console.log(`[time] ${result.executionTime}ms`);
          }

          if (result.error) {
            console.error(`Error: ${result.error}`);
          } else if (result.output !== undefined) {
            console.log(result.output);
          }

          return result.exitCode;
        }

        case 'eval': {
          if (!file) {
            console.error('Error: eval requires code');
            return 1;
          }

          const result = this.runner.runString(file);

          if (options.verbose) {
            console.log(`[eval] "${file}"`);
            console.log(`[time] ${result.executionTime}ms`);
          }

          if (result.error) {
            console.error(`Error: ${result.error}`);
          } else if (result.output !== undefined) {
            console.log(result.output);
          }

          return result.exitCode;
        }

        case 'ir': {
          if (!file) {
            console.error('Error: ir requires code');
            return 1;
          }

          try {
            const ir = this.runner.getIR(file);

            console.log(`IR for: "${file}"`);
            console.log(`Instructions: ${ir.length}`);
            console.log('');

            ir.forEach((inst, idx) => {
              let line = `  [${idx}] ${inst.op}`;
              if (inst.arg !== undefined) {
                line += ` arg=${JSON.stringify(inst.arg)}`;
              }
              if (inst.sub) {
                line += ` sub=${inst.sub.length} instructions`;
              }
              console.log(line);
            });

            return 0;
          } catch (error) {
            console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
            return 2;
          }
        }

        case 'help':
          this.printHelp();
          return 0;

        case 'version':
          this.printVersion();
          return 0;

        default:
          console.error(`Unknown command: ${command}`);
          console.log('Use "freelang help" for usage information');
          return 1;
      }
    } catch (error) {
      console.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
      return 127;
    }
  }
}

/**
 * Main entry point (called by bin/freelang)
 */
export function main(args: string[]): void {
  const cli = new FreeLangCLI();
  const exitCode = cli.run(args);
  process.exit(exitCode);
}
