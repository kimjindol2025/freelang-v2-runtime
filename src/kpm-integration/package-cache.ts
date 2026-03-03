/**
 * Package Cache Manager
 *
 * Cache downloaded packages locally for faster reinstalls
 * TTL: 30 days, Size limit: 1GB
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { readFileSync, writeFileSync, statSync, rmSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

export interface CacheEntry {
  name: string;
  version: string;
  hash: string;
  timestamp: number;
  size: number;
  etag?: string;
  lastAccessed: number;
}

export interface CacheStats {
  totalSize: number;
  totalPackages: number;
  oldestPackage: string | null;
  newestPackage: string | null;
  cacheDir: string;
}

/**
 * Package Cache Manager
 */
export class PackageCacheManager {
  private readonly cacheDir: string;
  private readonly indexPath: string;
  private readonly MAX_CACHE_SIZE = 1024 * 1024 * 1024; // 1GB
  private readonly CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
  private cacheIndex: Map<string, CacheEntry> = new Map();

  constructor(cacheDir: string = path.resolve(process.env.HOME || '/home/kimjin', '.kpm/cache')) {
    this.cacheDir = cacheDir;
    this.indexPath = path.join(cacheDir, '.cache-index.json');

    this.ensureDirectory();
    this.loadIndex();
  }

  /**
   * Add package to cache
   */
  async cache(name: string, version: string, content: Buffer): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(name, version);
      const cachePath = path.join(this.cacheDir, cacheKey);

      // Ensure directory exists
      const dir = path.dirname(cachePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Calculate hash
      const hash = this.calculateHash(content);

      // Write file
      await writeFile(cachePath, content);

      // Get file stats
      const stats = await stat(cachePath);

      // Update index
      const entry: CacheEntry = {
        name,
        version,
        hash,
        timestamp: Date.now(),
        size: stats.size,
        lastAccessed: Date.now(),
      };

      this.cacheIndex.set(cacheKey, entry);

      // Check and enforce size limits
      await this.enforceSize();

      // Save index
      await this.saveIndex();

      console.log(`✓ Cached ${name}@${version} (${this.formatSize(stats.size)})`);
    } catch (error) {
      console.error(`Failed to cache ${name}@${version}:`, error);
    }
  }

  /**
   * Get package from cache
   */
  async get(name: string, version: string): Promise<Buffer | null> {
    try {
      const cacheKey = this.getCacheKey(name, version);
      const entry = this.cacheIndex.get(cacheKey);

      if (!entry) {
        return null;
      }

      // Check if expired
      if (Date.now() - entry.timestamp > this.CACHE_TTL) {
        await this.remove(name, version);
        return null;
      }

      const cachePath = path.join(this.cacheDir, cacheKey);

      if (!existsSync(cachePath)) {
        this.cacheIndex.delete(cacheKey);
        return null;
      }

      // Update last accessed time
      entry.lastAccessed = Date.now();
      await this.saveIndex();

      const content = await readFile(cachePath);

      // Verify integrity
      const hash = this.calculateHash(content);
      if (hash !== entry.hash) {
        console.warn(`Cache integrity check failed for ${name}@${version}`);
        await this.remove(name, version);
        return null;
      }

      return content;
    } catch (error) {
      console.error(`Failed to read from cache:`, error);
      return null;
    }
  }

  /**
   * Check if package is in cache
   */
  has(name: string, version: string): boolean {
    const cacheKey = this.getCacheKey(name, version);
    return this.cacheIndex.has(cacheKey);
  }

  /**
   * Remove package from cache
   */
  async remove(name: string, version: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(name, version);
      const cachePath = path.join(this.cacheDir, cacheKey);

      if (existsSync(cachePath)) {
        rmSync(cachePath, { recursive: true, force: true });
      }

      this.cacheIndex.delete(cacheKey);
      await this.saveIndex();

      console.log(`✓ Removed ${name}@${version} from cache`);
    } catch (error) {
      console.error(`Failed to remove from cache:`, error);
    }
  }

  /**
   * Clear entire cache
   */
  async clear(olderThan?: Date): Promise<void> {
    try {
      const cutoffTime = olderThan ? olderThan.getTime() : 0;
      const keysToRemove: string[] = [];

      for (const [key, entry] of this.cacheIndex) {
        if (cutoffTime === 0 || entry.timestamp < cutoffTime) {
          const cachePath = path.join(this.cacheDir, key);
          if (existsSync(cachePath)) {
            rmSync(cachePath, { recursive: true, force: true });
          }
          keysToRemove.push(key);
        }
      }

      for (const key of keysToRemove) {
        this.cacheIndex.delete(key);
      }

      await this.saveIndex();

      const count = keysToRemove.length;
      console.log(`✓ Cleared ${count} packages from cache`);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    let totalSize = 0;
    let oldestPackage: string | null = null;
    let newestPackage: string | null = null;
    let oldestTime = Infinity;
    let newestTime = 0;

    for (const [, entry] of this.cacheIndex) {
      totalSize += entry.size;

      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestPackage = `${entry.name}@${entry.version}`;
      }

      if (entry.timestamp > newestTime) {
        newestTime = entry.timestamp;
        newestPackage = `${entry.name}@${entry.version}`;
      }
    }

    return {
      totalSize,
      totalPackages: this.cacheIndex.size,
      oldestPackage,
      newestPackage,
      cacheDir: this.cacheDir,
    };
  }

  /**
   * List cached packages
   */
  listCached(): Array<{ name: string; version: string; size: number; age: number }> {
    const now = Date.now();
    const packages: Array<{ name: string; version: string; size: number; age: number }> = [];

    for (const entry of this.cacheIndex.values()) {
      packages.push({
        name: entry.name,
        version: entry.version,
        size: entry.size,
        age: now - entry.timestamp,
      });
    }

    return packages.sort((a, b) => b.age - a.age);
  }

  /**
   * Private: Get cache key for package
   */
  private getCacheKey(name: string, version: string): string {
    // Handle scoped packages
    const normalized = name.replace(/[@\/]/g, '_');
    return path.join(normalized, version, `${normalized}-${version}.tar.gz`);
  }

  /**
   * Private: Calculate content hash
   */
  private calculateHash(content: Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Private: Enforce cache size limit
   */
  private async enforceSize(): Promise<void> {
    let totalSize = 0;

    for (const entry of this.cacheIndex.values()) {
      totalSize += entry.size;
    }

    if (totalSize > this.MAX_CACHE_SIZE) {
      console.log('Cache size limit exceeded, evicting oldest packages...');

      // Sort by last accessed time
      const sorted = Array.from(this.cacheIndex.entries()).sort(
        (a, b) => a[1].lastAccessed - b[1].lastAccessed
      );

      // Evict oldest until under limit
      for (const [key, entry] of sorted) {
        if (totalSize <= this.MAX_CACHE_SIZE) break;

        await this.remove(entry.name, entry.version);
        totalSize -= entry.size;
      }
    }
  }

  /**
   * Private: Load cache index from disk
   */
  private loadIndex(): void {
    try {
      if (existsSync(this.indexPath)) {
        const content = readFileSync(this.indexPath, 'utf-8');
        const data = JSON.parse(content);

        for (const entry of data) {
          const key = this.getCacheKey(entry.name, entry.version);
          this.cacheIndex.set(key, entry);
        }
      }
    } catch (error) {
      console.warn('Failed to load cache index:', error);
      this.cacheIndex.clear();
    }
  }

  /**
   * Private: Save cache index to disk
   */
  private async saveIndex(): Promise<void> {
    try {
      const data = Array.from(this.cacheIndex.values());
      await writeFile(this.indexPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('Failed to save cache index:', error);
    }
  }

  /**
   * Private: Ensure cache directory exists
   */
  private ensureDirectory(): void {
    try {
      if (!existsSync(this.cacheDir)) {
        mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (error) {
      console.warn('Failed to create cache directory:', error);
    }
  }

  /**
   * Private: Format bytes as human-readable size
   */
  private formatSize(bytes: number): string {
    if (bytes === 0) return '0B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + sizes[i];
  }
}
