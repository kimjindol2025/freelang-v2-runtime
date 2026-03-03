// FreeLang v2 - Library Resolver
// directive 기반으로 필요한 헤더 자동 결정

import { HeaderProposal } from '../engine/auto-header';
import { getBuiltinC, getBuiltinNames } from '../engine/builtins';

export interface LibraryProfile {
  headers: Set<string>;
  linkerFlags: Set<string>;
}

export class LibraryResolver {
  /**
   * directive에 따라 필요한 라이브러리 결정
   *
   * directive: "memory" → stdlib.h만 (최소 의존성)
   * directive: "speed" → math.h, stdio.h (성능 최적화)
   * directive: "safety" → assert.h, errno.h (안전성 검사)
   */
  resolveFromDirective(directive: string): LibraryProfile {
    const profile: LibraryProfile = {
      headers: new Set<string>(['stdio.h', 'stdlib.h']),
      linkerFlags: new Set<string>(),
    };

    switch (directive) {
      case 'memory':
        // 최소 의존성 (메모리 효율)
        profile.headers.clear();
        profile.headers.add('stdlib.h');
        break;

      case 'speed':
        // 수학 함수 추가 (성능 최적화)
        profile.headers.add('math.h');
        profile.headers.add('float.h');
        profile.linkerFlags.add('-lm'); // math library
        break;

      case 'safety':
        // 검증 함수 추가 (안전성 우선)
        profile.headers.add('assert.h');
        profile.headers.add('errno.h');
        break;

      default:
        // 기본: stdio, stdlib만
        profile.headers.add('stdio.h');
        profile.headers.add('stdlib.h');
        break;
    }

    return profile;
  }

  /**
   * 헤더 제안에 따라 필요한 라이브러리 결정
   * (향후: 사용된 함수를 분석해서 자동 결정)
   */
  resolveFromHeader(header: HeaderProposal): LibraryProfile {
    const profile = this.resolveFromDirective(header.directive);

    // 향후: 연산 타입에 따라 추가 헤더 결정
    switch (header.matched_op) {
      case 'sum':
      case 'average':
      case 'max':
      case 'min':
        // 배열 연산은 stdlib 필요
        profile.headers.add('stdlib.h');
        break;

      case 'sqrt':
      case 'abs':
      case 'floor':
      case 'ceil':
      case 'round':
        // 수학 연산은 math.h 필요
        profile.headers.add('math.h');
        profile.linkerFlags.add('-lm');
        break;
    }

    return profile;
  }

  /**
   * 사용할 수 있는 builtin 중에서 필요한 헤더 수집
   * (향후: 실제 사용된 함수만 필터링)
   */
  resolveFromBuiltins(usedBuiltins: string[]): LibraryProfile {
    const profile: LibraryProfile = {
      headers: new Set<string>(),
      linkerFlags: new Set<string>(),
    };

    for (const builtinName of usedBuiltins) {
      const c = getBuiltinC(builtinName);
      if (c) {
        c.headers.forEach(h => profile.headers.add(h));
        // 향후: linker flags도 추가
      }
    }

    return profile;
  }

  /**
   * 모든 directive 조합 생성 (테스트용)
   *
   * 현재 지원하는 directive: memory, speed, safety
   */
  getAllProfiles(): Record<string, LibraryProfile> {
    return {
      memory: this.resolveFromDirective('memory'),
      speed: this.resolveFromDirective('speed'),
      safety: this.resolveFromDirective('safety'),
    };
  }
}

// ────────────────────────────────────────
// 학습: 사용된 라이브러리 기록
// ────────────────────────────────────────

export interface LibraryUsage {
  directive: string;
  headers: string[];
  builtins_used: string[];
  timestamp: number;
}

export class LibraryLearner {
  private history: LibraryUsage[] = [];

  record(directive: string, profile: LibraryProfile, builtins: string[]) {
    this.history.push({
      directive,
      headers: Array.from(profile.headers),
      builtins_used: builtins,
      timestamp: Date.now(),
    });
  }

  /**
   * 가장 자주 사용되는 헤더 조합 (향후: 최적화)
   */
  getCommonPatterns(): Record<string, number> {
    const patterns: Record<string, number> = {};

    for (const usage of this.history) {
      const key = usage.headers.sort().join(',');
      patterns[key] = (patterns[key] || 0) + 1;
    }

    return patterns;
  }

  getHistory(): LibraryUsage[] {
    return [...this.history];
  }
}
