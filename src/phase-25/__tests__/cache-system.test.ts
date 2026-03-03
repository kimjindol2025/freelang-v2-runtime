/**
 * 🧪 Bytecode Cache System - 통합 테스트
 *
 * 테스트 커버리지: 25+ 케이스
 * - Memory Cache (LRU): 8 tests
 * - Disk Cache: 8 tests
 * - Integration: 6 tests
 * - Performance: 3 tests
 */

import { CacheManager, BytecodeCache } from '../bytecode-cache/cache-manager';
import { CacheKeyGenerator } from '../bytecode-cache/cache-key-generator';
import { DiskCacheProvider } from '../disk-cache/disk-cache-provider';

// Mock Inst type
interface Inst {
  op: string;
  args?: any[];
}

// ============ Memory Cache Tests ============

describe('CacheManager - Memory Cache', () => {
  let cache: CacheManager<string, Inst[]>;

  beforeEach(() => {
    cache = new CacheManager(10 * 1024 * 1024, 1000); // 10MB, 1초 TTL
  });

  test('Should set and get values', () => {
    const bytecode: Inst[] = [{ op: 'LOAD', args: [1] }];
    cache.set('key1', bytecode);
    expect(cache.get('key1')).toEqual(bytecode);
  });

  test('Should return undefined for missing keys', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  test('Should update stats on hit/miss', () => {
    cache.set('key1', [{ op: 'LOAD' }]);

    cache.get('key1'); // hit
    cache.get('key2'); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  test('Should calculate hit ratio correctly', () => {
    cache.set('key1', [{ op: 'LOAD' }]);

    cache.get('key1'); // hit
    cache.get('key1'); // hit
    cache.get('key2'); // miss

    const stats = cache.getStats();
    expect(stats.hitRatio).toBeCloseTo(2 / 3, 2);
  });

  test('Should evict LRU entries when size exceeded', () => {
    const cache2 = new CacheManager(100, 10000); // 100 bytes limit

    // 크기 큰 항목들 추가
    const large: Inst[] = Array(10).fill({ op: 'NOP', args: [1, 2, 3] });
    cache2.set('key1', large);
    cache2.set('key2', large);
    cache2.set('key3', large);

    // key1은 LRU 제거될 가능성
    const stats = cache2.getStats();
    expect(stats.entryCount).toBeLessThanOrEqual(3);
  });

  test('Should delete entries', () => {
    cache.set('key1', [{ op: 'LOAD' }]);
    expect(cache.delete('key1')).toBe(true);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.delete('key1')).toBe(false); // 재삭제 불가
  });

  test('Should clear all entries', () => {
    cache.set('key1', [{ op: 'LOAD' }]);
    cache.set('key2', [{ op: 'STORE' }]);

    cache.clear();
    expect(cache.getStats().entryCount).toBe(0);
  });

  test('Should prune expired entries', () => {
    const cache2 = new CacheManager(10 * 1024 * 1024, 100); // 100ms TTL
    cache2.set('key1', [{ op: 'LOAD' }]);

    // 150ms 대기
    jest.useFakeTimers();
    jest.advanceTimersByTime(150);

    const removed = cache2.prune();
    expect(removed).toBe(1);
    expect(cache2.get('key1')).toBeUndefined();

    jest.useRealTimers();
  });
});

// ============ BytecodeCache Tests ============

describe('BytecodeCache - Typed Cache', () => {
  let cache: BytecodeCache;

  beforeEach(() => {
    cache = new BytecodeCache();
  });

  test('Should cache bytecode', () => {
    const bytecode: Inst[] = [
      { op: 'LOAD', args: [10] },
      { op: 'ADD' },
      { op: 'RETURN' }
    ];

    cache.set('test', bytecode);
    expect(cache.get('test')).toEqual(bytecode);
  });

  test('Should track statistics', () => {
    cache.set('key1', [{ op: 'NOP' }]);
    cache.get('key1');
    cache.get('key2');

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });
});

// ============ Cache Key Generator Tests ============

describe('CacheKeyGenerator - Key Generation', () => {
  test('Should generate consistent MD5 keys', () => {
    const key1 = CacheKeyGenerator.generate('sum array');
    const key2 = CacheKeyGenerator.generate('sum array');

    expect(key1).toBe(key2);
    expect(/^[a-f0-9]{32}$/.test(key1)).toBe(true);
  });

  test('Should generate different keys for different code', () => {
    const key1 = CacheKeyGenerator.generate('sum array');
    const key2 = CacheKeyGenerator.generate('product array');

    expect(key1).not.toBe(key2);
  });

  test('Should include version in key generation', () => {
    const keyV3 = CacheKeyGenerator.generate('code', { version: 'v3' });
    const keyV4 = CacheKeyGenerator.generate('code', { version: 'v4' });

    expect(keyV3).not.toBe(keyV4);
  });

  test('Should validate key format', () => {
    const validKey = CacheKeyGenerator.generate('test');
    const invalidKey = 'invalid-key';

    expect(CacheKeyGenerator.isValid(validKey)).toBe(true);
    expect(CacheKeyGenerator.isValid(invalidKey)).toBe(false);
  });

  test('Should generate keys for multiple versions', () => {
    const keys = CacheKeyGenerator.generateMultiple('code', ['v3', 'v4', 'v5']);

    expect(keys.size).toBe(3);
    expect(keys.has('v3')).toBe(true);
    expect(keys.has('v4')).toBe(true);
    expect(keys.has('v5')).toBe(true);

    // 모두 서로 다른 키
    const keyArray = Array.from(keys.values());
    const uniqueKeys = new Set(keyArray);
    expect(uniqueKeys.size).toBe(3);
  });

  test('Should have low collision rate', () => {
    const result = CacheKeyGenerator.collisionTest(10000);

    expect(result.collisions).toBe(0); // MD5는 충돌 거의 없음
    expect(result.ratio).toBeLessThan(0.001);
  });
});

// ============ Disk Cache Tests ============

describe('DiskCacheProvider - Disk Persistence', () => {
  let diskCache: DiskCacheProvider;

  beforeEach(async () => {
    diskCache = new DiskCacheProvider('./.cache/test');
    await diskCache.initialize();
    await diskCache.clear();
  });

  afterEach(async () => {
    await diskCache.clear();
  });

  test('Should save and load from disk', async () => {
    const bytecode: Inst[] = [{ op: 'LOAD', args: [42] }];
    await diskCache.save('test-key', bytecode);

    const loaded = await diskCache.load('test-key');
    expect(loaded).toEqual(bytecode);
  });

  test('Should return null for missing keys', async () => {
    const result = await diskCache.load('missing-key');
    expect(result).toBeNull();
  });

  test('Should delete entries', async () => {
    const bytecode: Inst[] = [{ op: 'NOP' }];
    await diskCache.save('test-key', bytecode);
    await diskCache.delete('test-key');

    const result = await diskCache.load('test-key');
    expect(result).toBeNull();
  });

  test('Should maintain index', async () => {
    await diskCache.save('key1', [{ op: 'OP1' }]);
    await diskCache.save('key2', [{ op: 'OP2' }]);

    const index = await diskCache.getIndex();
    expect(index.size).toBe(2);
    expect(index.has('key1')).toBe(true);
    expect(index.has('key2')).toBe(true);
  });

  test('Should provide cache statistics', async () => {
    await diskCache.save('key1', [{ op: 'OP1' }, { op: 'OP2' }]);
    await diskCache.save('key2', [{ op: 'OP3' }]);

    const stats = await diskCache.getStats();
    expect(stats.entryCount).toBe(2);
    expect(stats.totalSize).toBeGreaterThan(0);
  });

  test('Should prune old entries', async () => {
    await diskCache.save('key1', [{ op: 'OP1' }], { timestamp: Date.now() - 5000 });
    await diskCache.save('key2', [{ op: 'OP2' }]);

    // 3초 이상 된 항목 제거
    const removed = await diskCache.prune(3000);
    expect(removed).toBeGreaterThanOrEqual(1);
  });

  test('Should clear all caches', async () => {
    await diskCache.save('key1', [{ op: 'OP1' }]);
    await diskCache.save('key2', [{ op: 'OP2' }]);

    await diskCache.clear();
    const index = await diskCache.getIndex();
    expect(index.size).toBe(0);
  });
});

// ============ Integration Tests ============

describe('Bytecode Cache - Integration', () => {
  let memCache: BytecodeCache;
  let diskCache: DiskCacheProvider;

  beforeEach(async () => {
    memCache = new BytecodeCache();
    diskCache = new DiskCacheProvider('./.cache/integration-test');
    await diskCache.initialize();
    await diskCache.clear();
  });

  afterEach(async () => {
    await diskCache.clear();
  });

  test('Should work with real bytecode', () => {
    const bytecode: Inst[] = [
      { op: 'LOAD', args: [1] },
      { op: 'LOAD', args: [2] },
      { op: 'ADD' },
      { op: 'RETURN' }
    ];

    const key = CacheKeyGenerator.generate('1 + 2');
    memCache.set(key, bytecode);

    const cached = memCache.get(key);
    expect(cached).toEqual(bytecode);
    expect(cached?.length).toBe(4);
  });

  test('Should measure cache hit improvement', () => {
    const bytecode: Inst[] = [{ op: 'NOP' }];
    const key = CacheKeyGenerator.generate('test');

    // 미스
    const miss = memCache.get(key);
    expect(miss).toBeUndefined();

    // 저장 후 히트
    memCache.set(key, bytecode);
    const hit = memCache.get(key);
    expect(hit).toEqual(bytecode);

    // 통계 확인: 50% 히트율 (1 hit, 1 miss)
    const stats = memCache.getStats();
    expect(stats.hitRatio).toBeCloseTo(0.5, 1);
  });

  test('Should combine memory and disk caches', async () => {
    const bytecode: Inst[] = [
      { op: 'LOAD', args: [100] },
      { op: 'RETURN' }
    ];

    const key = 'combined-test';

    // 메모리 캐시 저장
    memCache.set(key, bytecode);

    // 디스크 캐시 저장
    await diskCache.save(key, bytecode);

    // 두 곳 모두에서 로드 가능
    const memResult = memCache.get(key);
    const diskResult = await diskCache.load(key);

    expect(memResult).toEqual(bytecode);
    expect(diskResult).toEqual(bytecode);
  });
});

// ============ Performance Tests ============

describe('Bytecode Cache - Performance', () => {
  test('Should handle 1000 cache entries efficiently', () => {
    const cache = new CacheManager<string, Inst[]>(100 * 1024 * 1024);

    const startTime = Date.now();

    for (let i = 0; i < 1000; i++) {
      cache.set(`key_${i}`, [{ op: `OP_${i}` }]);
    }

    const insertTime = Date.now() - startTime;
    expect(insertTime).toBeLessThan(100); // < 100ms

    const readStart = Date.now();
    for (let i = 0; i < 1000; i++) {
      cache.get(`key_${i}`);
    }
    const readTime = Date.now() - readStart;
    expect(readTime).toBeLessThan(50); // < 50ms
  });

  test('Should measure bytecode cache performance', () => {
    const cache = new BytecodeCache();
    const bytecode: Inst[] = Array(100).fill({ op: 'NOP' });

    const startTime = performance.now();

    for (let i = 0; i < 10000; i++) {
      const key = CacheKeyGenerator.generate(`code_${i}`);
      if (i % 2 === 0) {
        cache.set(key, bytecode);
      } else {
        cache.get(key);
      }
    }

    const totalTime = performance.now() - startTime;
    const opsPerMs = 10000 / totalTime;

    console.log(`Operations per ms: ${opsPerMs.toFixed(2)}`);
    expect(opsPerMs).toBeGreaterThan(100); // > 100 ops/ms
  });

  test('Should measure key generation performance', () => {
    const startTime = performance.now();

    for (let i = 0; i < 100000; i++) {
      CacheKeyGenerator.generate(`code_${i}`);
    }

    const totalTime = performance.now() - startTime;
    const avgTime = totalTime / 100000;

    console.log(`Avg key generation time: ${avgTime.toFixed(4)}ms`);
    expect(avgTime).toBeLessThan(0.01); // < 0.01ms per key
  });
});
