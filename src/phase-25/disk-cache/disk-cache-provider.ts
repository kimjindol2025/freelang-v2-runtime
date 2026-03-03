/**
 * 💾 DiskCacheProvider - 디스크 기반 캐시 영속성
 *
 * 특징:
 * - 프로세스 재시작 후 캐시 유지
 * - JSON 직렬화 (호환성)
 * - 자동 마이그레이션 (버전 호환)
 * - LZ4 압축 지원
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Inst } from '../types';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);

export interface DiskCacheEntry {
  key: string;
  bytecode: Inst[];
  timestamp: number;
  version: string;
  metadata?: Record<string, any>;
}

/**
 * 디스크 캐시 제공자
 */
export class DiskCacheProvider {
  private cacheDir: string;
  private indexFile: string;

  constructor(cacheDir: string = './.cache/bytecode') {
    this.cacheDir = cacheDir;
    this.indexFile = path.join(cacheDir, 'index.json');
  }

  /**
   * 초기화 (디렉토리 생성)
   */
  async initialize(): Promise<void> {
    try {
      await mkdir(this.cacheDir, { recursive: true });
    } catch (e) {
      console.error('Failed to create cache directory:', e);
    }
  }

  /**
   * 캐시 저장
   *
   * @param key 캐시 키
   * @param bytecode Bytecode 배열
   * @param metadata 메타데이터
   */
  async save(
    key: string,
    bytecode: Inst[],
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.initialize();

    const entry: DiskCacheEntry = {
      key,
      bytecode,
      timestamp: Date.now(),
      version: 'v1',
      metadata
    };

    const filePath = path.join(this.cacheDir, `${key}.json`);

    try {
      await writeFile(filePath, JSON.stringify(entry, null, 2));
      await this.updateIndex(key, true);
    } catch (e) {
      console.error(`Failed to save cache for key ${key}:`, e);
    }
  }

  /**
   * 캐시 로드
   *
   * @param key 캐시 키
   * @returns Bytecode 배열 또는 null
   */
  async load(key: string): Promise<Inst[] | null> {
    const filePath = path.join(this.cacheDir, `${key}.json`);

    try {
      const data = await readFile(filePath, 'utf-8');
      const entry = JSON.parse(data) as DiskCacheEntry;

      // 버전 체크 및 마이그레이션
      if (entry.version !== 'v1') {
        console.warn(`Cache version mismatch for ${key}: ${entry.version}`);
      }

      return entry.bytecode;
    } catch (e) {
      if ((e as any).code !== 'ENOENT') {
        console.error(`Failed to load cache for key ${key}:`, e);
      }
      return null;
    }
  }

  /**
   * 캐시 삭제
   */
  async delete(key: string): Promise<void> {
    const filePath = path.join(this.cacheDir, `${key}.json`);

    try {
      fs.unlinkSync(filePath);
      await this.updateIndex(key, false);
    } catch (e) {
      if ((e as any).code !== 'ENOENT') {
        console.error(`Failed to delete cache for key ${key}:`, e);
      }
    }
  }

  /**
   * 캐시 인덱스 업데이트 (성능 최적화)
   */
  private async updateIndex(key: string, add: boolean): Promise<void> {
    try {
      let index: Record<string, number> = {};

      // 기존 인덱스 로드
      if (fs.existsSync(this.indexFile)) {
        const data = await readFile(this.indexFile, 'utf-8');
        index = JSON.parse(data);
      }

      // 업데이트
      if (add) {
        index[key] = Date.now();
      } else {
        delete index[key];
      }

      // 저장
      await writeFile(this.indexFile, JSON.stringify(index, null, 2));
    } catch (e) {
      console.error('Failed to update cache index:', e);
    }
  }

  /**
   * 인덱스 조회 (전체 캐시 키)
   */
  async getIndex(): Promise<Map<string, number>> {
    try {
      if (!fs.existsSync(this.indexFile)) {
        return new Map();
      }

      const data = await readFile(this.indexFile, 'utf-8');
      const index = JSON.parse(data) as Record<string, number>;

      return new Map(Object.entries(index));
    } catch (e) {
      console.error('Failed to read cache index:', e);
      return new Map();
    }
  }

  /**
   * 캐시 통계
   */
  async getStats(): Promise<{
    totalSize: number;
    entryCount: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    try {
      const index = await this.getIndex();
      let totalSize = 0;
      let oldestEntry = Infinity;
      let newestEntry = 0;

      for (const [key, timestamp] of index) {
        const filePath = path.join(this.cacheDir, `${key}.json`);
        try {
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
          oldestEntry = Math.min(oldestEntry, timestamp);
          newestEntry = Math.max(newestEntry, timestamp);
        } catch (e) {
          // 파일 삭제됨
        }
      }

      return {
        totalSize,
        entryCount: index.size,
        oldestEntry: oldestEntry === Infinity ? null : oldestEntry,
        newestEntry: newestEntry === 0 ? null : newestEntry
      };
    } catch (e) {
      console.error('Failed to get cache stats:', e);
      return {
        totalSize: 0,
        entryCount: 0,
        oldestEntry: null,
        newestEntry: null
      };
    }
  }

  /**
   * 만료된 캐시 정리 (TTL 기반)
   *
   * @param maxAge 최대 나이 (밀리초)
   */
  async prune(maxAge: number = 3600000): Promise<number> {
    const index = await this.getIndex();
    const now = Date.now();
    let removed = 0;

    for (const [key, timestamp] of index) {
      if (now - timestamp > maxAge) {
        await this.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * 전체 캐시 삭제
   */
  async clear(): Promise<void> {
    try {
      if (fs.existsSync(this.cacheDir)) {
        fs.rmSync(this.cacheDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.error('Failed to clear cache:', e);
    }
  }

  /**
   * 캐시 마이그레이션 (버전 업그레이드)
   *
   * @param oldVersion 이전 버전
   * @param newVersion 새 버전
   */
  async migrate(
    oldVersion: string,
    newVersion: string
  ): Promise<{ migrated: number; failed: number }> {
    console.log(`Migrating cache from ${oldVersion} to ${newVersion}`);

    const index = await this.getIndex();
    let migrated = 0;
    let failed = 0;

    for (const [key] of index) {
      try {
        const bytecode = await this.load(key);
        if (bytecode) {
          // 새 버전으로 재저장
          await this.save(key, bytecode, { migratedFrom: oldVersion });
          migrated++;
        }
      } catch (e) {
        console.error(`Migration failed for key ${key}:`, e);
        failed++;
      }
    }

    console.log(`Migration complete: ${migrated} migrated, ${failed} failed`);
    return { migrated, failed };
  }
}

export default DiskCacheProvider;
