/**
 * FreeLang Standard Library: std/io
 *
 * File I/O and console operations
 * - Console logging
 * - File reading/writing
 * - File system operations
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

/**
 * Console namespace - Console operations
 */
export const console = {
  /**
   * Print to stdout
   * @param args Arguments to print
   */
  log: (...args: any[]): void => {
    process.stdout.write(args.map(a => String(a)).join(' ') + '\n');
  },

  /**
   * Print to stderr
   * @param args Arguments to print
   */
  error: (...args: any[]): void => {
    process.stderr.write(args.map(a => String(a)).join(' ') + '\n');
  },

  /**
   * Print without newline
   * @param args Arguments to print
   */
  write: (...args: any[]): void => {
    process.stdout.write(args.map(a => String(a)).join(''));
  },

  /**
   * Clear the console
   */
  clear: (): void => {
    console.clear?.();
  }
};

/**
 * File namespace - File operations
 */
export const file = {
  /**
   * Read file contents
   * @param filePath Path to file
   * @returns File contents as string
   */
  read: (filePath: string): string => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file: ${filePath}`);
    }
  },

  /**
   * Write content to file
   * @param filePath Path to file
   * @param content Content to write
   */
  write: (filePath: string, content: string): void => {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write file: ${filePath}`);
    }
  },

  /**
   * Append content to file
   * @param filePath Path to file
   * @param content Content to append
   */
  append: (filePath: string, content: string): void => {
    try {
      fs.appendFileSync(filePath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to append to file: ${filePath}`);
    }
  },

  /**
   * Check if file exists
   * @param filePath Path to file
   * @returns true if file exists
   */
  exists: (filePath: string): boolean => {
    return fs.existsSync(filePath);
  },

  /**
   * Delete a file
   * @param filePath Path to file
   */
  delete: (filePath: string): void => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      throw new Error(`Failed to delete file: ${filePath}`);
    }
  },

  /**
   * Get file size in bytes
   * @param filePath Path to file
   * @returns File size
   */
  size: (filePath: string): number => {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      throw new Error(`Failed to get file size: ${filePath}`);
    }
  },

  /**
   * Get file extension
   * @param filePath Path to file
   * @returns File extension
   */
  extension: (filePath: string): string => {
    return path.extname(filePath);
  },

  /**
   * Get file name without extension
   * @param filePath Path to file
   * @returns File name
   */
  basename: (filePath: string): string => {
    return path.basename(filePath);
  },

  /**
   * Get directory name
   * @param filePath Path to file
   * @returns Directory path
   */
  dirname: (filePath: string): string => {
    return path.dirname(filePath);
  }
};

/**
 * Directory namespace - Directory operations
 */
export const dir = {
  /**
   * Create a directory
   * @param dirPath Path to directory
   */
  create: (dirPath: string): void => {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    } catch (error) {
      throw new Error(`Failed to create directory: ${dirPath}`);
    }
  },

  /**
   * Check if directory exists
   * @param dirPath Path to directory
   * @returns true if directory exists
   */
  exists: (dirPath: string): boolean => {
    try {
      const stats = fs.statSync(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  },

  /**
   * List directory contents
   * @param dirPath Path to directory
   * @returns Array of file/directory names
   */
  list: (dirPath: string): string[] => {
    try {
      return fs.readdirSync(dirPath);
    } catch (error) {
      throw new Error(`Failed to list directory: ${dirPath}`);
    }
  },

  /**
   * Delete a directory
   * @param dirPath Path to directory
   * @param recursive Delete recursively
   */
  delete: (dirPath: string, recursive: boolean = false): void => {
    try {
      if (fs.existsSync(dirPath)) {
        if (recursive) {
          fs.rmSync(dirPath, { recursive: true, force: true });
        } else {
          fs.rmdirSync(dirPath);
        }
      }
    } catch (error) {
      throw new Error(`Failed to delete directory: ${dirPath}`);
    }
  },

  /**
   * Get current working directory
   * @returns Current directory path
   */
  cwd: (): string => {
    return process.cwd();
  },

  /**
   * Change current working directory
   * @param dirPath Path to directory
   */
  chdir: (dirPath: string): void => {
    try {
      process.chdir(dirPath);
    } catch (error) {
      throw new Error(`Failed to change directory: ${dirPath}`);
    }
  }
};

/**
 * Path namespace - Path operations
 */
export const path_ops = {
  /**
   * Join path segments
   * @param segments Path segments
   * @returns Joined path
   */
  join: (...segments: string[]): string => {
    return path.join(...segments);
  },

  /**
   * Resolve path to absolute
   * @param filePath Path to resolve
   * @returns Absolute path
   */
  resolve: (filePath: string): string => {
    return path.resolve(filePath);
  },

  /**
   * Get relative path between two paths
   * @param from Source path
   * @param to Target path
   * @returns Relative path
   */
  relative: (from: string, to: string): string => {
    return path.relative(from, to);
  },

  /**
   * Normalize path
   * @param filePath Path to normalize
   * @returns Normalized path
   */
  normalize: (filePath: string): string => {
    return path.normalize(filePath);
  }
};

/**
 * Read user input from stdin
 * @param prompt Prompt to display
 * @returns Promise that resolves to user input
 */
export async function input(prompt: string = ''): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Read lines from stdin
 * @returns Promise that resolves to array of lines
 */
export async function readLines(): Promise<string[]> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.on('line', (line) => {
      lines.push(line);
    });

    rl.on('close', () => {
      resolve(lines);
    });
  });
}

/**
 * Export all io functions as default object
 */
export const io = {
  console,
  file,
  dir,
  path: path_ops,
  input,
  readLines
};
