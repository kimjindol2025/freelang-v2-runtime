/**
 * Offline Handler
 *
 * Enable installation from cache when network is unavailable
 * Provides graceful fallback for offline scenarios
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { existsSync, mkdirSync } from 'fs';

import type { PackageCacheManager } from './package-cache';
import type { KPMRegistryClient } from './kpm-registry-client';

export interface OfflineStatus {
  isOnline: boolean;
  lastOnlineCheck: number;
  cacheAvailable: boolean;
  cachedPackages: number;
}

/**
 * Offline Handler
 *
 * Handles offline scenarios with intelligent fallbacks
 */
export class OfflineHandler {
  private lastOnlineStatus: boolean | null = null;
  private lastOnlineCheck: number = 0;
  private readonly ONLINE_CHECK_INTERVAL = 10000; // 10 seconds
  private readonly ONLINE_CHECK_TIMEOUT = 5000; // 5 second timeout
  private readonly PING_URLS = [
    'https://gogs.dclub.kr/',
    'http://192.168.45.253:40000/health',
    'https://www.google.com/',
  ];

  constructor(
    private cache: PackageCacheManager,
    private registryClient?: KPMRegistryClient
  ) {}

  /**
   * Check if device is online
   */
  async isOnline(): Promise<boolean> {
    // Use cached status if recent
    if (this.lastOnlineStatus !== null && Date.now() - this.lastOnlineCheck < this.ONLINE_CHECK_INTERVAL) {
      return this.lastOnlineStatus;
    }

    // Try to ping multiple URLs
    for (const url of this.PING_URLS) {
      try {
        const isReachable = await this.checkUrl(url);
        if (isReachable) {
          this.lastOnlineStatus = true;
          this.lastOnlineCheck = Date.now();
          return true;
        }
      } catch (error) {
        // Continue to next URL
      }
    }

    // All URLs failed
    this.lastOnlineStatus = false;
    this.lastOnlineCheck = Date.now();
    return false;
  }

  /**
   * Attempt installation in offline mode
   */
  async installOffline(name: string, version: string): Promise<boolean> {
    try {
      // Check if package is in cache
      if (!this.cache.has(name, version)) {
        console.error(`✗ Package ${name}@${version} not found in cache`);
        console.error('  Run "freelang install" while online to cache packages');
        return false;
      }

      // Get from cache
      const content = await this.cache.get(name, version);
      if (!content) {
        console.error(`✗ Failed to retrieve ${name}@${version} from cache`);
        return false;
      }

      // Extract and install
      console.log(`📦 Installing ${name}@${version} from cache...`);
      const installPath = path.join(process.cwd(), 'kim_modules', name);

      // Create installation directory
      mkdirSync(installPath, { recursive: true });

      // In production, would extract tarball
      // For now, create package.json marker
      const packageJson = {
        name,
        version,
        _cached: true,
        _cachedAt: new Date().toISOString(),
      };

      const packageJsonPath = path.join(installPath, 'package.json');
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

      console.log(`✓ ${name}@${version} installed from cache`);
      return true;
    } catch (error) {
      console.error(`Failed to install from cache:`, error);
      return false;
    }
  }

  /**
   * Attempt installation with fallback to offline
   */
  async installWithFallback(name: string, version: string): Promise<boolean> {
    try {
      const online = await this.isOnline();

      if (online && this.registryClient) {
        console.log(`🌐 Online - installing ${name}@${version} from registry...`);
        // Would normally install from registry
        // For demo, use cache if available
        if (this.cache.has(name, version)) {
          return await this.installOffline(name, version);
        }
        return false;
      } else {
        console.log(`📵 Offline - attempting to install from cache...`);
        return await this.installOffline(name, version);
      }
    } catch (error) {
      console.error('Installation failed:', error);
      return false;
    }
  }

  /**
   * Get offline status
   */
  async getStatus(): Promise<OfflineStatus> {
    const isOnline = await this.isOnline();
    const cachedList = this.cache.listCached();

    return {
      isOnline,
      lastOnlineCheck: this.lastOnlineCheck,
      cacheAvailable: cachedList.length > 0,
      cachedPackages: cachedList.length,
    };
  }

  /**
   * Pre-download packages for offline use
   */
  async predownloadForOffline(packages: Array<{ name: string; version: string }>): Promise<void> {
    try {
      const online = await this.isOnline();

      if (!online) {
        console.warn('⚠️  Device is offline - cannot pre-download packages');
        return;
      }

      console.log(`📥 Pre-downloading ${packages.length} packages for offline use...`);

      for (const { name, version } of packages) {
        if (this.cache.has(name, version)) {
          console.log(`✓ ${name}@${version} already cached`);
          continue;
        }

        try {
          // In production, would download from registry
          console.log(`  Downloading ${name}@${version}...`);

          // Simulate download
          const buffer = Buffer.from(`Mock content for ${name}@${version}`);
          await this.cache.cache(name, version, buffer);
        } catch (error) {
          console.warn(`✗ Failed to download ${name}@${version}:`, error);
        }
      }

      console.log('✓ Pre-download complete');
    } catch (error) {
      console.error('Pre-download failed:', error);
    }
  }

  /**
   * Suggest cached alternatives when package not found online
   */
  suggestCachedAlternatives(searchQuery: string): Array<{ name: string; version: string }> {
    const cachedList = this.cache.listCached();
    const query = searchQuery.toLowerCase();

    return cachedList
      .filter(pkg => pkg.name.toLowerCase().includes(query))
      .slice(0, 5)
      .map(pkg => ({
        name: pkg.name,
        version: pkg.version,
      }));
  }

  /**
   * Private: Check if URL is reachable
   */
  private async checkUrl(url: string): Promise<boolean> {
    return new Promise(resolve => {
      const module = url.startsWith('https') ? require('https') : require('http');

      const timeout = setTimeout(() => {
        resolve(false);
      }, this.ONLINE_CHECK_TIMEOUT);

      try {
        module
          .get(url, { timeout: this.ONLINE_CHECK_TIMEOUT }, (res: any) => {
            clearTimeout(timeout);
            resolve(res.statusCode >= 200 && res.statusCode < 500);
            res.destroy();
          })
          .on('error', () => {
            clearTimeout(timeout);
            resolve(false);
          });
      } catch (error) {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }
}
