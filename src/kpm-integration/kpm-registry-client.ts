/**
 * KPM Registry Client
 *
 * HTTP client to query KPM registry (845 packages)
 * Supports searching, fetching package info, and downloading packages
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Package info from KPM registry
 */
export interface KPMPackage {
  name: string;
  version: string;
  description?: string;
  tags?: string[];
  url?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Detailed package information
 */
export interface KPMPackageInfo {
  name: string;
  versions: string[];
  latest: string;
  description: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  dependencies?: Record<string, string>;
  keywords?: string[];
  downloads?: number;
}

/**
 * Search options
 */
export interface SearchOptions {
  limit?: number;
  offset?: number;
  sort?: 'relevance' | 'downloads' | 'updated';
}

/**
 * KPM Registry Client
 *
 * Queries local and remote KPM registries
 */
export class KPMRegistryClient {
  private registryPath = '/home/kimjin/kpm-registry/registry.json';
  private userRegistryPath = '/home/kimjin/.kpm/registry.json';
  private cacheDir = '/home/kimjin/.kpm/cache/';
  private registryCache: Map<string, any> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private cacheTimes: Map<string, number> = new Map();

  constructor() {
    this.initializeCache();
  }

  /**
   * Search for packages by query
   */
  async search(query: string, options: SearchOptions = {}): Promise<KPMPackage[]> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    try {
      // Load registry
      const registry = await this.loadRegistry();

      // Parse registry - can be array or object with packages
      let packages: KPMPackage[] = [];

      if (Array.isArray(registry)) {
        packages = registry;
      } else if (registry.packages) {
        packages = registry.packages;
      } else if (registry.registry) {
        packages = Object.entries(registry.registry).map(([name, data]: [string, any]) => ({
          name,
          version: data.version || data.latest || '1.0.0',
          description: data.description,
          url: data.url || data.homepage,
          ...data,
        }));
      } else {
        // If it's an object with keys as package names
        packages = Object.entries(registry)
          .filter(([key]) => !['registry', 'packages', 'timestamp', 'version'].includes(key))
          .map(([name, data]: [string, any]) => ({
            name,
            version: Array.isArray(data.versions) ? data.versions[data.versions.length - 1] : data.version || '1.0.0',
            description: data.description,
            url: data.homepage,
            ...data,
          }));
      }

      // Filter by query (case-insensitive)
      const queryLower = query.toLowerCase();
      const filtered = packages.filter(
        pkg =>
          pkg.name.toLowerCase().includes(queryLower) ||
          pkg.description?.toLowerCase().includes(queryLower) ||
          pkg.tags?.some(tag => tag.toLowerCase().includes(queryLower))
      );

      // Sort
      let sorted = filtered;
      if (options.sort === 'downloads') {
        sorted.sort((a: any, b: any) => (b.downloads || 0) - (a.downloads || 0));
      } else if (options.sort === 'updated') {
        sorted.sort((a, b) => {
          const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
          const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
          return bTime - aTime;
        });
      }

      // Paginate
      return sorted.slice(offset, offset + limit);
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  /**
   * Get detailed package information
   */
  async getPackageInfo(name: string): Promise<KPMPackageInfo | null> {
    try {
      const registry = await this.loadRegistry();

      // Find package in registry
      let packageData: any = null;

      // Try different registry formats
      if (registry[name]) {
        packageData = registry[name];
      } else if (registry.packages && registry.packages[name]) {
        packageData = registry.packages[name];
      } else if (registry.registry && registry.registry[name]) {
        packageData = registry.registry[name];
      }

      if (!packageData) {
        return null;
      }

      // Normalize versions
      let versions: string[] = [];
      if (Array.isArray(packageData.versions)) {
        versions = packageData.versions;
      } else if (packageData.version) {
        versions = [packageData.version];
      } else if (packageData.latest) {
        versions = [packageData.latest];
      }

      const latest = versions[versions.length - 1] || packageData.version || '1.0.0';

      return {
        name,
        versions,
        latest,
        description: packageData.description || '',
        author: packageData.author,
        license: packageData.license,
        homepage: packageData.homepage || packageData.url,
        repository: packageData.repository,
        dependencies: packageData.dependencies,
        keywords: packageData.keywords || packageData.tags,
        downloads: packageData.downloads || 0,
      };
    } catch (error) {
      console.error(`Failed to get info for ${name}:`, error);
      return null;
    }
  }

  /**
   * Get available versions for a package
   */
  async getVersions(name: string): Promise<string[]> {
    const info = await this.getPackageInfo(name);
    return info?.versions || [];
  }

  /**
   * Check if package exists in registry
   */
  async exists(name: string): Promise<boolean> {
    const info = await this.getPackageInfo(name);
    return info !== null;
  }

  /**
   * Get package by name and version
   */
  async getPackage(name: string, version: string = 'latest'): Promise<KPMPackage | null> {
    const info = await this.getPackageInfo(name);
    if (!info) return null;

    // Resolve version
    let resolvedVersion = version;
    if (version === 'latest') {
      resolvedVersion = info.latest;
    }

    return {
      name,
      version: resolvedVersion,
      description: info.description,
      url: info.homepage,
    };
  }

  /**
   * List all packages in registry
   */
  async listAll(limit: number = 100, offset: number = 0): Promise<KPMPackage[]> {
    try {
      const registry = await this.loadRegistry();

      let packages: KPMPackage[] = [];

      if (Array.isArray(registry)) {
        packages = registry;
      } else if (registry.packages) {
        packages = registry.packages;
      } else if (registry.registry) {
        packages = Object.entries(registry.registry).map(([name, data]: [string, any]) => ({
          name,
          version: data.version || data.latest || '1.0.0',
          description: data.description,
        }));
      } else {
        packages = Object.entries(registry)
          .filter(([key]) => !['registry', 'packages', 'timestamp', 'version'].includes(key))
          .map(([name, data]: [string, any]) => ({
            name,
            version: Array.isArray(data.versions) ? data.versions[data.versions.length - 1] : data.version || '1.0.0',
            description: data.description,
          }));
      }

      return packages.slice(offset, offset + limit);
    } catch (error) {
      console.error('Failed to list packages:', error);
      return [];
    }
  }

  /**
   * Get registry statistics
   */
  async getStats(): Promise<{
    totalPackages: number;
    categories: Record<string, number>;
    lastUpdated: string;
  }> {
    try {
      const registry = await this.loadRegistry();
      const packages = await this.listAll(10000); // Get all

      // Count by category/tags
      const categories: Record<string, number> = {};
      for (const pkg of packages) {
        const tags = (pkg.tags || ['unknown']).slice(0, 1);
        for (const tag of tags) {
          categories[tag] = (categories[tag] || 0) + 1;
        }
      }

      return {
        totalPackages: packages.length,
        categories,
        lastUpdated: registry.timestamp || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        totalPackages: 0,
        categories: {},
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Private methods
   */

  private async loadRegistry(): Promise<any> {
    // Check cache first
    const cacheKey = 'main-registry';
    const cachedTime = this.cacheTimes.get(cacheKey) || 0;
    if (Date.now() - cachedTime < this.CACHE_TTL && this.registryCache.has(cacheKey)) {
      return this.registryCache.get(cacheKey);
    }

    try {
      // Try loading from main registry
      const content = fs.readFileSync(this.registryPath, 'utf-8');
      const registry = JSON.parse(content);

      // Cache it
      this.registryCache.set(cacheKey, registry);
      this.cacheTimes.set(cacheKey, Date.now());

      return registry;
    } catch (error) {
      // Fallback to user registry
      try {
        const content = fs.readFileSync(this.userRegistryPath, 'utf-8');
        const registry = JSON.parse(content);

        this.registryCache.set(cacheKey, registry);
        this.cacheTimes.set(cacheKey, Date.now());

        return registry;
      } catch (fallbackError) {
        console.error('Failed to load registry:', error);
        return {};
      }
    }
  }

  private initializeCache(): void {
    // Create cache directory if it doesn't exist
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (error) {
      console.warn('Could not create cache directory:', error);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.registryCache.clear();
    this.cacheTimes.clear();
  }
}
