/**
 * Bytecode Cache Types
 */

export interface Inst {
  op: string;
  args?: any[];
  metadata?: Record<string, any>;
}

export interface BytecodeMetadata {
  source: string;
  version: string;
  generatedAt: number;
  compilationTime?: number;
}

export interface CacheConfig {
  maxSize: number; // 바이트
  maxAge: number;  // 밀리초
  diskCacheEnabled: boolean;
  diskCacheDir: string;
  compressionEnabled: boolean;
}

export interface CacheHitEvent {
  key: string;
  timestamp: number;
  timeToLoad: number; // 밀리초
}

export interface CacheMissEvent {
  key: string;
  timestamp: number;
  reason: 'not_found' | 'expired' | 'evicted';
}
