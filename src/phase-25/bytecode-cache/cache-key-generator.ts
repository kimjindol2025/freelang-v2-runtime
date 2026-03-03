/**
 * 🔑 CacheKeyGenerator - Bytecode 캐시 키 생성
 *
 * MD5 해시로 유니크한 캐시 키 생성
 * - Source code → 해시
 * - 버전/옵션 포함
 * - 충돌 가능성 < 0.001%
 */

import { createHash } from 'crypto';

export interface CacheKeyOptions {
  sourceCode: string;
  version?: string;
  targetArch?: string;
  optimizationLevel?: 'O0' | 'O1' | 'O2' | 'O3';
}

/**
 * 캐시 키 생성기
 */
export class CacheKeyGenerator {
  /**
   * Source code 기반 해시 키 생성
   *
   * @param code 소스 코드
   * @param options 추가 옵션
   * @returns MD5 해시 키
   *
   * @example
   * const key = CacheKeyGenerator.generate("sum array", {
   *   version: "v4",
   *   optimizationLevel: "O2"
   * });
   * // => "a1b2c3d4e5f6... (32 char)"
   */
  static generate(code: string, options?: Partial<CacheKeyOptions>): string {
    const opts = {
      version: options?.version || 'v4',
      targetArch: options?.targetArch || 'fl-v4-stack-vm',
      optimizationLevel: options?.optimizationLevel || 'O2',
      ...options
    };

    // 캐시 키 구성 요소
    const components = [
      code,
      opts.version,
      opts.targetArch,
      opts.optimizationLevel
    ].join('|');

    // MD5 해시
    return createHash('md5').update(components).digest('hex');
  }

  /**
   * Intent 기반 캐시 키 생성
   *
   * @param intent Intent 객체 (body 포함)
   * @returns 캐시 키
   */
  static fromIntent(intent: { body: string; version?: string }): string {
    return this.generate(intent.body, {
      version: intent.version || 'v4'
    });
  }

  /**
   * 버전별 캐시 키 생성 (다중 버전 지원)
   *
   * @example
   * const keys = CacheKeyGenerator.generateMultiple(code, ['v3', 'v4', 'v5']);
   * // => ['hash_v3', 'hash_v4', 'hash_v5']
   */
  static generateMultiple(
    code: string,
    versions: string[]
  ): Map<string, string> {
    const keys = new Map<string, string>();
    for (const version of versions) {
      keys.set(version, this.generate(code, { version }));
    }
    return keys;
  }

  /**
   * 캐시 키 형식 검증
   *
   * @param key 캐시 키
   * @returns true if valid MD5 hash
   */
  static isValid(key: string): boolean {
    return /^[a-f0-9]{32}$/.test(key);
  }

  /**
   * 충돌 테스트 (성능: 1000000 해시 생성)
   *
   * @example
   * const result = CacheKeyGenerator.collisionTest(1000000);
   * console.log(result);
   * // => { total: 1000000, unique: 1000000, collisions: 0, ratio: 0 }
   */
  static collisionTest(iterations: number = 1000000): {
    total: number;
    unique: number;
    collisions: number;
    ratio: number;
  } {
    const keys = new Set<string>();
    let collisions = 0;

    for (let i = 0; i < iterations; i++) {
      const code = `test_${i}_${Math.random()}`;
      const key = this.generate(code);

      if (keys.has(key)) {
        collisions++;
      } else {
        keys.add(key);
      }
    }

    return {
      total: iterations,
      unique: keys.size,
      collisions,
      ratio: collisions / iterations
    };
  }

  /**
   * 캐시 키에서 버전 추출 (역변환 불가, 메타데이터만)
   *
   * @param code 소스 코드
   * @param targetKey 목표 해시
   * @returns 일치하는 옵션 또는 null
   */
  static findMatchingOptions(
    code: string,
    targetKey: string
  ): Partial<CacheKeyOptions> | null {
    // 가능한 옵션 조합 시도 (Brute force)
    const versions = ['v3', 'v4', 'v5'];
    const archs = ['fl-v4-stack-vm', 'fl-v5-jit', 'native'];
    const opts = ['O0', 'O1', 'O2', 'O3'];

    for (const version of versions) {
      for (const arch of archs) {
        for (const opt of opts) {
          const key = this.generate(code, {
            version,
            targetArch: arch,
            optimizationLevel: opt as any
          });

          if (key === targetKey) {
            return { version, targetArch: arch, optimizationLevel: opt as any };
          }
        }
      }
    }

    return null;
  }
}

export default CacheKeyGenerator;
