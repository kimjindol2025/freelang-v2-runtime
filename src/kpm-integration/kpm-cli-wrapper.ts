/**
 * KPM CLI Wrapper
 *
 * Execute KPM CLI commands programmatically
 * Wraps /home/kimjin/scripts/kpm-cli.js
 */

import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface KPMSearchResult {
  name: string;
  version: string;
  description?: string;
  downloads?: number;
}

export interface InstalledPackage {
  name: string;
  version: string;
  location: string;
}

export interface InstallOptions {
  version?: string;
  force?: boolean;
  offline?: boolean;
}

export interface KPMListResult {
  [packageName: string]: {
    version: string;
    location: string;
  };
}

/**
 * KPM CLI Wrapper
 *
 * Executes KPM CLI commands and parses results
 */
export class KPMCLIWrapper {
  private readonly kpmBinary = '/home/kimjin/scripts/kpm-cli.js';
  private readonly timeout = 30000; // 30 seconds
  private readonly maxRetries = 3;

  /**
   * Execute KPM search command
   */
  async search(query: string, limit: number = 20): Promise<KPMSearchResult[]> {
    try {
      const result = await this.executeCommand(`search "${query}" --limit ${limit}`);
      return this.parseSearchResults(result);
    } catch (error) {
      console.error(`KPM search failed for "${query}":`, error);
      return [];
    }
  }

  /**
   * Execute KPM info command
   */
  async info(packageName: string): Promise<any> {
    try {
      const result = await this.executeCommand(`info "${packageName}"`);
      return this.parseInfoResult(result);
    } catch (error) {
      console.error(`KPM info failed for "${packageName}":`, error);
      return null;
    }
  }

  /**
   * Execute KPM install command
   */
  async install(packageName: string, options: InstallOptions = {}): Promise<boolean> {
    try {
      let cmd = `install "${packageName}"`;
      if (options.version) {
        cmd += ` @${options.version}`;
      }
      if (options.force) {
        cmd += ' --force';
      }
      if (options.offline) {
        cmd += ' --offline';
      }

      const result = await this.executeCommand(cmd);
      return this.parseSuccess(result);
    } catch (error) {
      console.error(`KPM install failed for "${packageName}":`, error);
      return false;
    }
  }

  /**
   * Execute KPM uninstall command
   */
  async uninstall(packageName: string): Promise<boolean> {
    try {
      const result = await this.executeCommand(`uninstall "${packageName}"`);
      return this.parseSuccess(result);
    } catch (error) {
      console.error(`KPM uninstall failed for "${packageName}":`, error);
      return false;
    }
  }

  /**
   * Execute KPM list command
   */
  async list(): Promise<InstalledPackage[]> {
    try {
      const result = await this.executeCommand('list');
      return this.parseListResult(result);
    } catch (error) {
      console.error('KPM list failed:', error);
      return [];
    }
  }

  /**
   * Execute KPM update command
   */
  async update(packageName?: string): Promise<boolean> {
    try {
      let cmd = 'update';
      if (packageName) {
        cmd += ` "${packageName}"`;
      }

      const result = await this.executeCommand(cmd);
      return this.parseSuccess(result);
    } catch (error) {
      console.error(`KPM update failed:`, error);
      return false;
    }
  }

  /**
   * Execute KPM cache clear command
   */
  async clearCache(): Promise<boolean> {
    try {
      const result = await this.executeCommand('cache clear');
      return this.parseSuccess(result);
    } catch (error) {
      console.error('KPM cache clear failed:', error);
      return false;
    }
  }

  /**
   * Get KPM version
   */
  async getVersion(): Promise<string> {
    try {
      const result = await this.executeCommand('--version');
      return result.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Check if KPM is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.executeCommand('--version');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Private: Execute command with retry and timeout
   */
  private async executeCommand(args: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const cmd = `node "${this.kpmBinary}" ${args}`;
        const { stdout, stderr } = await execAsync(cmd, {
          timeout: this.timeout,
          maxBuffer: 10 * 1024 * 1024, // 10MB output buffer
        });

        if (stderr) {
          throw new Error(stderr);
        }

        return stdout;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on some errors
        if (error instanceof Error && error.message.includes('not found')) {
          throw error;
        }

        // Wait before retry
        if (attempt < this.maxRetries - 1) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }

    throw lastError || new Error('KPM command failed after retries');
  }

  /**
   * Private: Parse search results
   */
  private parseSearchResults(output: string): KPMSearchResult[] {
    try {
      // Try JSON format first
      const data = JSON.parse(output);
      if (Array.isArray(data)) {
        return data.map(item => ({
          name: item.name || '',
          version: item.version || '',
          description: item.description,
          downloads: item.downloads || 0,
        }));
      }
    } catch (e) {
      // Fall back to parsing text output
    }

    // Parse text output format
    const lines = output.split('\n');
    const results: KPMSearchResult[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      // Expected format: name@version description
      const match = line.match(/^([\w\-@\.\/]+)@([\w\.\-]+)\s+(.+)?$/);
      if (match) {
        results.push({
          name: match[1],
          version: match[2],
          description: match[3],
        });
      }
    }

    return results;
  }

  /**
   * Private: Parse info result
   */
  private parseInfoResult(output: string): any {
    try {
      return JSON.parse(output);
    } catch (e) {
      // Parse text format
      const result: any = {};
      const lines = output.split('\n');

      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const value = valueParts.join(':').trim();
          result[key.toLowerCase().replace(/\s+/g, '_')] = value;
        }
      }

      return result;
    }
  }

  /**
   * Private: Parse list result
   */
  private parseListResult(output: string): InstalledPackage[] {
    try {
      const data = JSON.parse(output);
      if (typeof data === 'object' && data !== null) {
        return Object.entries(data).map(([name, pkg]: [string, any]) => ({
          name,
          version: pkg.version || 'unknown',
          location: pkg.location || '',
        }));
      }
    } catch (e) {
      // Fall back to text parsing
    }

    const packages: InstalledPackage[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      // Expected format: name@version path/to/package
      const match = line.match(/^([\w\-@\.\/]+)@([\w\.\-]+)\s+(.+)$/);
      if (match) {
        packages.push({
          name: match[1],
          version: match[2],
          location: match[3],
        });
      }
    }

    return packages;
  }

  /**
   * Private: Check if output indicates success
   */
  private parseSuccess(output: string): boolean {
    const successPatterns = [
      /success/i,
      /installed/i,
      /updated/i,
      /removed/i,
      /complete/i,
      /done/i,
    ];

    const errorPatterns = [
      /error/i,
      /failed/i,
      /cannot/i,
      /not found/i,
    ];

    const lowerOutput = output.toLowerCase();

    // Check for explicit error
    for (const pattern of errorPatterns) {
      if (pattern.test(lowerOutput)) {
        return false;
      }
    }

    // Check for success indicators
    for (const pattern of successPatterns) {
      if (pattern.test(lowerOutput)) {
        return true;
      }
    }

    // No error and no success = consider it success
    return !output.includes('Error');
  }

  /**
   * Private: Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
