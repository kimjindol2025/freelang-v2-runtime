/**
 * FreeLang Standard Library: std/math
 *
 * Mathematical functions and constants
 */

// Mathematical constants
export const PI = Math.PI;
export const E = Math.E;
export const LN2 = Math.LN2;
export const LN10 = Math.LN10;
export const LOG2E = Math.LOG2E;
export const LOG10E = Math.LOG10E;
export const SQRT1_2 = Math.SQRT1_2;
export const SQRT2 = Math.SQRT2;

/**
 * Absolute value
 * @param n Input number
 * @returns Absolute value
 */
export function abs(n: number): number {
  return Math.abs(n);
}

/**
 * Round to nearest integer
 * @param n Input number
 * @returns Rounded value
 */
export function round(n: number): number {
  return Math.round(n);
}

/**
 * Round down to integer
 * @param n Input number
 * @returns Floored value
 */
export function floor(n: number): number {
  return Math.floor(n);
}

/**
 * Round up to integer
 * @param n Input number
 * @returns Ceiling value
 */
export function ceil(n: number): number {
  return Math.ceil(n);
}

/**
 * Truncate to integer (remove decimals)
 * @param n Input number
 * @returns Truncated value
 */
export function trunc(n: number): number {
  return Math.trunc(n);
}

/**
 * Get sign of number (-1, 0, or 1)
 * @param n Input number
 * @returns Sign
 */
export function sign(n: number): number {
  return Math.sign(n);
}

/**
 * Power function
 * @param base Base number
 * @param exp Exponent
 * @returns base^exp
 */
export function pow(base: number, exp: number): number {
  return Math.pow(base, exp);
}

/**
 * Square root
 * @param n Input number
 * @returns Square root
 */
export function sqrt(n: number): number {
  return Math.sqrt(n);
}

/**
 * Cubic root
 * @param n Input number
 * @returns Cubic root
 */
export function cbrt(n: number): number {
  return Math.cbrt(n);
}

/**
 * Exponential function (e^x)
 * @param n Exponent
 * @returns e^n
 */
export function exp(n: number): number {
  return Math.exp(n);
}

/**
 * Natural logarithm
 * @param n Input number
 * @returns ln(n)
 */
export function log(n: number): number {
  return Math.log(n);
}

/**
 * Base 10 logarithm
 * @param n Input number
 * @returns log10(n)
 */
export function log10(n: number): number {
  return Math.log10(n);
}

/**
 * Base 2 logarithm
 * @param n Input number
 * @returns log2(n)
 */
export function log2(n: number): number {
  return Math.log2(n);
}

/**
 * Sine (in radians)
 * @param n Input angle in radians
 * @returns Sine value
 */
export function sin(n: number): number {
  return Math.sin(n);
}

/**
 * Cosine (in radians)
 * @param n Input angle in radians
 * @returns Cosine value
 */
export function cos(n: number): number {
  return Math.cos(n);
}

/**
 * Tangent (in radians)
 * @param n Input angle in radians
 * @returns Tangent value
 */
export function tan(n: number): number {
  return Math.tan(n);
}

/**
 * Arcsine
 * @param n Input value (-1 to 1)
 * @returns Angle in radians
 */
export function asin(n: number): number {
  return Math.asin(n);
}

/**
 * Arccosine
 * @param n Input value (-1 to 1)
 * @returns Angle in radians
 */
export function acos(n: number): number {
  return Math.acos(n);
}

/**
 * Arctangent
 * @param n Input value
 * @returns Angle in radians
 */
export function atan(n: number): number {
  return Math.atan(n);
}

/**
 * Arctangent of y/x
 * @param y Y value
 * @param x X value
 * @returns Angle in radians
 */
export function atan2(y: number, x: number): number {
  return Math.atan2(y, x);
}

/**
 * Hyperbolic sine
 * @param n Input number
 * @returns Hyperbolic sine
 */
export function sinh(n: number): number {
  return Math.sinh(n);
}

/**
 * Hyperbolic cosine
 * @param n Input number
 * @returns Hyperbolic cosine
 */
export function cosh(n: number): number {
  return Math.cosh(n);
}

/**
 * Hyperbolic tangent
 * @param n Input number
 * @returns Hyperbolic tangent
 */
export function tanh(n: number): number {
  return Math.tanh(n);
}

/**
 * Minimum value
 * @param args Numbers to compare
 * @returns Minimum
 */
export function min(...args: number[]): number {
  return Math.min(...args);
}

/**
 * Maximum value
 * @param args Numbers to compare
 * @returns Maximum
 */
export function max(...args: number[]): number {
  return Math.max(...args);
}

/**
 * Clamp value between min and max
 * @param n Value to clamp
 * @param min Minimum value
 * @param max Maximum value
 * @returns Clamped value
 */
export function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * Linear interpolation
 * @param a Start value
 * @param b End value
 * @param t Interpolation factor (0-1)
 * @returns Interpolated value
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Convert degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
export function toRadians(degrees: number): number {
  return degrees * (PI / 180);
}

/**
 * Convert radians to degrees
 * @param radians Angle in radians
 * @returns Angle in degrees
 */
export function toDegrees(radians: number): number {
  return radians * (180 / PI);
}

/**
 * Random number between 0 and 1
 * @returns Random number
 */
export function random(): number {
  return Math.random();
}

/**
 * Random integer between min (inclusive) and max (exclusive)
 * @param min Minimum value
 * @param max Maximum value
 * @returns Random integer
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
}

/**
 * Factorial
 * @param n Input number
 * @returns n!
 */
export function factorial(n: number): number {
  if (n < 0) throw new Error('Factorial is undefined for negative numbers');
  if (n === 0 || n === 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Permutations
 * @param n Total items
 * @param r Items to select
 * @returns nPr
 */
export function permutations(n: number, r: number): number {
  return factorial(n) / factorial(n - r);
}

/**
 * Combinations
 * @param n Total items
 * @param r Items to select
 * @returns nCr
 */
export function combinations(n: number, r: number): number {
  return factorial(n) / (factorial(r) * factorial(n - r));
}

/**
 * GCD (Greatest Common Divisor)
 * @param a First number
 * @param b Second number
 * @returns GCD
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

/**
 * LCM (Least Common Multiple)
 * @param a First number
 * @param b Second number
 * @returns LCM
 */
export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

/**
 * Check if number is prime
 * @param n Number to check
 * @returns true if prime
 */
export function isPrime(n: number): boolean {
  if (n <= 1) return false;
  if (n <= 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

/**
 * Check if number is even
 * @param n Number to check
 * @returns true if even
 */
export function isEven(n: number): boolean {
  return n % 2 === 0;
}

/**
 * Check if number is odd
 * @param n Number to check
 * @returns true if odd
 */
export function isOdd(n: number): boolean {
  return n % 2 !== 0;
}

/**
 * Export all math functions and constants as default object
 */
export const math = {
  PI,
  E,
  LN2,
  LN10,
  LOG2E,
  LOG10E,
  SQRT1_2,
  SQRT2,
  abs,
  round,
  floor,
  ceil,
  trunc,
  sign,
  pow,
  sqrt,
  cbrt,
  exp,
  log,
  log10,
  log2,
  sin,
  cos,
  tan,
  asin,
  acos,
  atan,
  atan2,
  sinh,
  cosh,
  tanh,
  min,
  max,
  clamp,
  lerp,
  toRadians,
  toDegrees,
  random,
  randomInt,
  factorial,
  permutations,
  combinations,
  gcd,
  lcm,
  isPrime,
  isEven,
  isOdd
};
