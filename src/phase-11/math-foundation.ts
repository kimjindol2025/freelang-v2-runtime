/**
 * Phase 11: Math Foundation & Random Numbers
 *
 * 필수 기능:
 * - 난수 생성 (균등분포, 정규분포)
 * - 기본 수학 함수 (sqrt, pow, exp, log, sin, cos, tan)
 * - 수학 상수 (PI, E)
 * - 통계 함수 (min, max, sum, mean, variance)
 */

/**
 * 난수 생성기 (MT19937 - Mersenne Twister)
 * 높은 품질의 의사난수
 */
export class RandomGenerator {
  private mt: number[] = new Array(624);
  private index = 0;

  constructor(seed: number = Date.now()) {
    this.mt[0] = seed >>> 0;
    for (let i = 1; i < 624; i++) {
      const s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((((s & 0xffff0000) >>> 16) * 1812433253) << 16) +
        (s & 0xffff) * 1812433253 + i;
      this.mt[i] = this.mt[i] >>> 0;
    }
  }

  /**
   * 내부 트위스트 함수
   */
  private twist(): void {
    for (let i = 0; i < 624; i++) {
      const y = (this.mt[i] & 0x80000000) + (this.mt[(i + 1) % 624] & 0x7fffffff);
      this.mt[i] = this.mt[(i + 397) % 624] ^ (y >>> 1) ^ (y % 2 !== 0 ? 0x9908b0df : 0);
    }
    this.index = 0;
  }

  /**
   * 0 ~ 1 사이의 균등분포 난수
   */
  random(): number {
    if (this.index === 0) {
      this.twist();
    }

    let y = this.mt[this.index];
    y = y ^ (y >>> 11);
    y = y ^ ((y << 7) & 0x9d2c5680);
    y = y ^ ((y << 15) & 0xefc60000);
    y = y ^ (y >>> 18);

    this.index = (this.index + 1) % 624;
    return (y >>> 0) / 4294967296;
  }

  /**
   * 정규분포 난수 (Box-Muller)
   */
  randomNormal(mu: number = 0, sigma: number = 1): number {
    const u1 = this.random();
    const u2 = this.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mu + sigma * z0;
  }

  /**
   * 정수 난수 [min, max)
   */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min)) + min;
  }

  /**
   * 배열에서 무작위 선택
   */
  randomChoice<T>(arr: T[]): T {
    return arr[this.randomInt(0, arr.length)];
  }

  /**
   * 배열 셔플 (Fisher-Yates)
   */
  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/**
 * 글로벌 난수 생성기
 */
const globalRng = new RandomGenerator();

/**
 * 수학 상수
 */
export const MathConstants = {
  PI: 3.14159265358979323846,
  E: 2.71828182845904523536,
  LN2: 0.69314718055994530942,
  LN10: 2.30258509299404568402,
  LOG2E: 1.44269504088896340736,
  LOG10E: 0.43429448190325182765,
  SQRT1_2: 0.70710678118654752440,
  SQRT2: 1.41421356237309504880,
} as const;

/**
 * 수학 유틸리티
 */
export class MathUtils {
  /**
   * 제곱근
   */
  static sqrt(x: number): number {
    if (x < 0) throw new Error('Cannot take sqrt of negative number');
    return Math.sqrt(x);
  }

  /**
   * 거듭제곱
   */
  static pow(base: number, exp: number): number {
    return Math.pow(base, exp);
  }

  /**
   * 지수 함수 (e^x)
   */
  static exp(x: number): number {
    return Math.exp(x);
  }

  /**
   * 자연로그 (ln(x))
   */
  static log(x: number): number {
    if (x <= 0) throw new Error('log of non-positive number');
    return Math.log(x);
  }

  /**
   * 로그베이스10
   */
  static log10(x: number): number {
    return Math.log10(x);
  }

  /**
   * 로그베이스2
   */
  static log2(x: number): number {
    return Math.log2(x);
  }

  /**
   * 절댓값
   */
  static abs(x: number): number {
    return Math.abs(x);
  }

  /**
   * 내림 (floor)
   */
  static floor(x: number): number {
    return Math.floor(x);
  }

  /**
   * 올림 (ceiling)
   */
  static ceil(x: number): number {
    return Math.ceil(x);
  }

  /**
   * 반올림
   */
  static round(x: number, decimals: number = 0): number {
    const factor = Math.pow(10, decimals);
    return Math.round(x * factor) / factor;
  }

  /**
   * 최소값
   */
  static min(...numbers: number[]): number {
    return Math.min(...numbers);
  }

  /**
   * 최대값
   */
  static max(...numbers: number[]): number {
    return Math.max(...numbers);
  }

  /**
   * 삼각함수: 사인
   */
  static sin(x: number): number {
    return Math.sin(x);
  }

  /**
   * 삼각함수: 코사인
   */
  static cos(x: number): number {
    return Math.cos(x);
  }

  /**
   * 삼각함수: 탄젠트
   */
  static tan(x: number): number {
    return Math.tan(x);
  }

  /**
   * 역삼각함수: 아크사인
   */
  static asin(x: number): number {
    return Math.asin(x);
  }

  /**
   * 역삼각함수: 아크코사인
   */
  static acos(x: number): number {
    return Math.acos(x);
  }

  /**
   * 역삼각함수: 아크탄젠트
   */
  static atan(x: number): number {
    return Math.atan(x);
  }

  /**
   * 쌍곡함수: 하이퍼볼릭 사인
   */
  static sinh(x: number): number {
    return Math.sinh(x);
  }

  /**
   * 쌍곡함수: 하이퍼볼릭 코사인
   */
  static cosh(x: number): number {
    return Math.cosh(x);
  }

  /**
   * 쌍곡함수: 하이퍼볼릭 탄젠트
   */
  static tanh(x: number): number {
    return Math.tanh(x);
  }

  /**
   * 부호 함수 (-1, 0, 1)
   */
  static sign(x: number): number {
    return Math.sign(x);
  }

  /**
   * 클램프 (min~max 범위)
   */
  static clamp(x: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, x));
  }

  /**
   * 선형 보간
   */
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * 거리 계산 (피타고라스)
   */
  static distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

/**
 * 난수 함수들 (글로벌)
 */
export class Random {
  /**
   * 0~1 균등분포
   */
  static random(): number {
    return globalRng.random();
  }

  /**
   * 정규분포
   */
  static normal(mu: number = 0, sigma: number = 1): number {
    return globalRng.randomNormal(mu, sigma);
  }

  /**
   * 정수 난수 [min, max)
   */
  static int(min: number, max: number): number {
    return globalRng.randomInt(min, max);
  }

  /**
   * 배열 셔플
   */
  static shuffle<T>(arr: T[]): T[] {
    return globalRng.shuffle(arr);
  }

  /**
   * 배열에서 선택
   */
  static choice<T>(arr: T[]): T {
    return globalRng.randomChoice(arr);
  }

  /**
   * 시드 설정
   */
  static seed(value: number): void {
    // Reset global RNG with new seed
    const newRng = new RandomGenerator(value);
    Object.assign(globalRng, newRng);
  }
}

/**
 * 배열 통계
 */
export class Statistics {
  /**
   * 합계
   */
  static sum(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0);
  }

  /**
   * 평균
   */
  static mean(arr: number[]): number {
    return arr.length === 0 ? 0 : this.sum(arr) / arr.length;
  }

  /**
   * 중앙값
   */
  static median(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * 분산
   */
  static variance(arr: number[]): number {
    if (arr.length === 0) return 0;
    const mean = this.mean(arr);
    const squaredDiffs = arr.map((x) => Math.pow(x - mean, 2));
    return this.sum(squaredDiffs) / arr.length;
  }

  /**
   * 표준편차
   */
  static stdDev(arr: number[]): number {
    return Math.sqrt(this.variance(arr));
  }

  /**
   * 최소값
   */
  static min(arr: number[]): number {
    return Math.min(...arr);
  }

  /**
   * 최대값
   */
  static max(arr: number[]): number {
    return Math.max(...arr);
  }

  /**
   * 범위 (max - min)
   */
  static range(arr: number[]): number {
    return this.max(arr) - this.min(arr);
  }

  /**
   * 백분위수
   */
  static percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
}

/**
 * 테스트
 */
export function testMathFoundation(): void {
  console.log('=== Math Foundation Tests ===\n');

  // 1. 상수
  console.log('1️⃣ Math Constants:');
  console.log(`   PI: ${MathConstants.PI.toFixed(10)}`);
  console.log(`   E: ${MathConstants.E.toFixed(10)}`);

  // 2. 기본 함수
  console.log('\n2️⃣ Basic Functions:');
  console.log(`   sqrt(16): ${MathUtils.sqrt(16)}`);
  console.log(`   pow(2, 10): ${MathUtils.pow(2, 10)}`);
  console.log(`   exp(1): ${MathUtils.exp(1).toFixed(5)}`);
  console.log(`   log(${MathConstants.E}): ${MathUtils.log(MathConstants.E).toFixed(5)}`);

  // 3. 삼각함수
  console.log('\n3️⃣ Trigonometric:');
  console.log(`   sin(PI/2): ${MathUtils.sin(MathConstants.PI / 2).toFixed(5)}`);
  console.log(`   cos(0): ${MathUtils.cos(0)}`);
  console.log(`   tan(PI/4): ${MathUtils.tan(MathConstants.PI / 4).toFixed(5)}`);

  // 4. 난수
  console.log('\n4️⃣ Random Numbers:');
  console.log(`   Uniform [0,1]: ${Random.random().toFixed(3)}`);
  console.log(`   Normal (μ=0, σ=1): ${Random.normal().toFixed(3)}`);
  console.log(`   Int [1, 100]: ${Random.int(1, 100)}`);

  // 5. 통계
  console.log('\n5️⃣ Statistics:');
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  console.log(`   Data: ${data}`);
  console.log(`   Mean: ${Statistics.mean(data)}`);
  console.log(`   Median: ${Statistics.median(data)}`);
  console.log(`   StdDev: ${Statistics.stdDev(data).toFixed(3)}`);

  console.log('\n✅ All math foundation tests completed!');
}
