/**
 * Phase 23.6: Configuration Management
 *
 * Configuration management for cloud-native applications:
 * - ConfigMap (non-sensitive configuration)
 * - Secrets (sensitive credentials)
 * - Configuration validation
 * - Environment-specific overrides
 * - Configuration change detection
 */

export type ConfigLevel = 'GLOBAL' | 'NAMESPACE' | 'SERVICE' | 'POD';
export type SecretType = 'OPAQUE' | 'DOCKER_CONFIG' | 'TLS' | 'SSH_AUTH';

export interface ConfigEntry {
  key: string;
  value: any;
  level: ConfigLevel;
  mutable: boolean;
  updated_at: number;
}

export interface SecretEntry {
  key: string;
  value: string; // Should be encrypted in production
  type: SecretType;
  level: ConfigLevel;
  updated_at: number;
}

export interface ConfigSnapshot {
  timestamp: number;
  entries: ConfigEntry[];
  hash: string;
}

/**
 * ConfigMap
 * Manages non-sensitive configuration
 */
export class ConfigMap {
  private name: string;
  private namespace: string;
  private entries: Map<string, ConfigEntry> = new Map();
  private watchers: Set<(changes: ConfigEntry[]) => void> = new Set();

  constructor(name: string, namespace: string = 'default') {
    this.name = name;
    this.namespace = namespace;
  }

  /**
   * Set configuration
   */
  set(key: string, value: any, mutable: boolean = true): void {
    const entry: ConfigEntry = {
      key,
      value,
      level: 'SERVICE',
      mutable,
      updated_at: Date.now(),
    };

    const previous = this.entries.get(key);
    this.entries.set(key, entry);

    // Notify watchers only if value changed
    if (!previous || JSON.stringify(previous.value) !== JSON.stringify(value)) {
      this.notifyWatchers([entry]);
    }
  }

  /**
   * Get configuration
   */
  get(key: string): any {
    return this.entries.get(key)?.value;
  }

  /**
   * Get multiple configurations
   */
  getMultiple(keys: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Watch configuration changes
   */
  watch(callback: (changes: ConfigEntry[]) => void): () => void {
    this.watchers.add(callback);
    return () => {
      this.watchers.delete(callback);
    };
  }

  /**
   * Get all entries
   */
  getAll(): ConfigEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Create snapshot
   */
  snapshot(): ConfigSnapshot {
    const entries = this.getAll();
    const hash = this.calculateHash(entries);
    return {
      timestamp: Date.now(),
      entries,
      hash,
    };
  }

  /**
   * Private: Notify watchers
   */
  private notifyWatchers(changes: ConfigEntry[]): void {
    for (const watcher of this.watchers) {
      watcher(changes);
    }
  }

  /**
   * Private: Calculate hash
   */
  private calculateHash(entries: ConfigEntry[]): string {
    let hash = 0;
    const str = JSON.stringify(entries.map((e) => ({ k: e.key, v: e.value })));
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Delete configuration
   */
  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  /**
   * Get metadata
   */
  getMetadata() {
    return {
      name: this.name,
      namespace: this.namespace,
      entries_count: this.entries.size,
      created_at: Math.min(...Array.from(this.entries.values()).map((e) => e.updated_at)),
    };
  }
}

/**
 * SecretsManager
 * Manages sensitive credentials
 */
export class SecretsManager {
  private name: string;
  private namespace: string;
  private secrets: Map<string, SecretEntry> = new Map();
  private watchers: Set<(changes: SecretEntry[]) => void> = new Set();

  constructor(name: string, namespace: string = 'default') {
    this.name = name;
    this.namespace = namespace;
  }

  /**
   * Set secret
   */
  set(key: string, value: string, type: SecretType = 'OPAQUE'): void {
    const entry: SecretEntry = {
      key,
      value, // In production, should be encrypted
      type,
      level: 'SERVICE',
      updated_at: Date.now(),
    };

    const previous = this.secrets.get(key);
    this.secrets.set(key, entry);

    // Notify watchers
    if (!previous || previous.value !== value) {
      this.notifyWatchers([entry]);
    }
  }

  /**
   * Get secret (decrypted in production)
   */
  get(key: string): string | undefined {
    return this.secrets.get(key)?.value;
  }

  /**
   * Get secret with type validation
   */
  getWithType(key: string, expected_type: SecretType): string | undefined {
    const secret = this.secrets.get(key);
    if (!secret) return undefined;
    if (secret.type !== expected_type) {
      throw new Error(`Secret ${key} has type ${secret.type}, expected ${expected_type}`);
    }
    return secret.value;
  }

  /**
   * Has secret
   */
  has(key: string): boolean {
    return this.secrets.has(key);
  }

  /**
   * Delete secret
   */
  delete(key: string): boolean {
    return this.secrets.delete(key);
  }

  /**
   * Watch secret changes
   */
  watch(callback: (changes: SecretEntry[]) => void): () => void {
    this.watchers.add(callback);
    return () => {
      this.watchers.delete(callback);
    };
  }

  /**
   * Rotate secret
   */
  rotate(key: string, new_value: string): void {
    const secret = this.secrets.get(key);
    if (!secret) {
      throw new Error(`Secret ${key} not found`);
    }
    secret.value = new_value;
    secret.updated_at = Date.now();
    this.notifyWatchers([secret]);
  }

  /**
   * Private: Notify watchers
   */
  private notifyWatchers(changes: SecretEntry[]): void {
    for (const watcher of this.watchers) {
      watcher(changes);
    }
  }

  /**
   * Get metadata (without secret values)
   */
  getMetadata() {
    return {
      name: this.name,
      namespace: this.namespace,
      secrets_count: this.secrets.size,
      secret_types: Array.from(new Set(Array.from(this.secrets.values()).map((s) => s.type))),
    };
  }
}

/**
 * Configuration Manager
 * Manages ConfigMaps and Secrets across environments
 */
export class ConfigurationManager {
  private config_maps: Map<string, ConfigMap> = new Map();
  private secrets: Map<string, SecretsManager> = new Map();
  private environment: string;
  private overrides: Map<string, any> = new Map();

  constructor(environment: string = 'development') {
    this.environment = environment;
  }

  /**
   * Create config map
   */
  createConfigMap(name: string, namespace: string = 'default'): ConfigMap {
    const key = `${namespace}/${name}`;
    if (!this.config_maps.has(key)) {
      this.config_maps.set(key, new ConfigMap(name, namespace));
    }
    return this.config_maps.get(key)!;
  }

  /**
   * Get config map
   */
  getConfigMap(name: string, namespace: string = 'default'): ConfigMap | undefined {
    return this.config_maps.get(`${namespace}/${name}`);
  }

  /**
   * Create secrets manager
   */
  createSecretsManager(name: string, namespace: string = 'default'): SecretsManager {
    const key = `${namespace}/${name}`;
    if (!this.secrets.has(key)) {
      this.secrets.set(key, new SecretsManager(name, namespace));
    }
    return this.secrets.get(key)!;
  }

  /**
   * Get secrets manager
   */
  getSecretsManager(name: string, namespace: string = 'default'): SecretsManager | undefined {
    return this.secrets.get(`${namespace}/${name}`);
  }

  /**
   * Set environment override
   */
  setOverride(key: string, value: any): void {
    this.overrides.set(key, value);
  }

  /**
   * Get with environment overrides
   */
  get(key: string, config_map: ConfigMap): any {
    // Check overrides first
    if (this.overrides.has(key)) {
      return this.overrides.get(key);
    }

    // Check environment-specific config
    const env_key = `${key}__${this.environment}`;
    const env_value = config_map.get(env_key);
    if (env_value !== undefined) {
      return env_value;
    }

    // Check default config
    return config_map.get(key);
  }

  /**
   * Set environment
   */
  setEnvironment(environment: string): void {
    this.environment = environment;
  }

  /**
   * Get current environment
   */
  getEnvironment(): string {
    return this.environment;
  }

  /**
   * Validate configuration schema
   */
  validate(schema: Record<string, any>, config_map: ConfigMap): boolean {
    for (const [key, rules] of Object.entries(schema)) {
      const value = config_map.get(key);

      if (rules.required && value === undefined) {
        throw new Error(`Required configuration key missing: ${key}`);
      }

      if (value !== undefined && rules.type) {
        const actual_type = typeof value;
        if (actual_type !== rules.type) {
          throw new Error(`Configuration ${key}: expected ${rules.type}, got ${actual_type}`);
        }
      }

      if (value !== undefined && rules.pattern && typeof value === 'string') {
        if (!new RegExp(rules.pattern).test(value)) {
          throw new Error(`Configuration ${key} does not match pattern: ${rules.pattern}`);
        }
      }
    }

    return true;
  }

  /**
   * Export configuration
   */
  export(namespace: string = 'default'): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, config_map] of this.config_maps) {
      if (key.startsWith(namespace)) {
        const entries = config_map.getAll();
        for (const entry of entries) {
          result[entry.key] = entry.value;
        }
      }
    }

    return result;
  }

  /**
   * Import configuration
   */
  import(data: Record<string, any>, name: string, namespace: string = 'default'): void {
    const config_map = this.createConfigMap(name, namespace);
    for (const [key, value] of Object.entries(data)) {
      config_map.set(key, value);
    }
  }
}

export default { ConfigMap, SecretsManager, ConfigurationManager };
