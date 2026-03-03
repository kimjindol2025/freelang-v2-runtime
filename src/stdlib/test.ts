/**
 * FreeLang Test Framework (Phase 27)
 *
 * Provides testing utilities for FreeLang programs.
 *
 * Features:
 * - Assertion-based testing
 * - Test grouping with clear names
 * - Automatic result tracking
 * - Summary reports
 *
 * Usage:
 *   const test = require("std/test");
 *   test.test("addition", () => {
 *     test.assertEqual(1 + 1, 2, "1+1 should equal 2");
 *   });
 *   const result = test.run();
 *   // { total: 1, passed: 1, failed: 0, results: [...] }
 */

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
  duration: number;
}

/**
 * Test Runner: Manages test execution and reporting
 */
export class TestRunner {
  private results: TestResult[] = [];
  private tests: Array<{ name: string; fn: () => void }> = [];
  private startTime = 0;

  /**
   * Register a test case
   * @param name Test name
   * @param fn Test function
   */
  test(name: string, fn: () => void): void {
    this.tests.push({ name, fn });
  }

  /**
   * Assert that a condition is true
   * @param condition Condition to check
   * @param message Error message if condition is false
   */
  assert(condition: boolean, message: string = 'assertion failed'): void {
    if (!condition) {
      throw new Error(message);
    }
  }

  /**
   * Assert that two values are equal
   * @param actual Actual value
   * @param expected Expected value
   * @param message Optional error message
   */
  assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      const msg = message || `Expected ${expected}, got ${actual}`;
      throw new Error(msg);
    }
  }

  /**
   * Assert that two values are not equal
   * @param actual Actual value
   * @param notExpected Value that should not match
   * @param message Optional error message
   */
  assertNotEqual<T>(actual: T, notExpected: T, message?: string): void {
    if (actual === notExpected) {
      const msg = message || `Expected not to equal ${notExpected}`;
      throw new Error(msg);
    }
  }

  /**
   * Assert that a value is truthy
   * @param value Value to check
   * @param message Optional error message
   */
  assertTrue(value: any, message?: string): void {
    if (!value) {
      const msg = message || `Expected truthy value, got ${value}`;
      throw new Error(msg);
    }
  }

  /**
   * Assert that a value is falsy
   * @param value Value to check
   * @param message Optional error message
   */
  assertFalse(value: any, message?: string): void {
    if (value) {
      const msg = message || `Expected falsy value, got ${value}`;
      throw new Error(msg);
    }
  }

  /**
   * Assert that a value is null
   * @param value Value to check
   * @param message Optional error message
   */
  assertNull(value: any, message?: string): void {
    if (value !== null) {
      const msg = message || `Expected null, got ${value}`;
      throw new Error(msg);
    }
  }

  /**
   * Assert that a value is undefined
   * @param value Value to check
   * @param message Optional error message
   */
  assertUndefined(value: any, message?: string): void {
    if (value !== undefined) {
      const msg = message || `Expected undefined, got ${value}`;
      throw new Error(msg);
    }
  }

  /**
   * Assert that a function throws an error
   * @param fn Function to execute
   * @param message Optional error message
   */
  assertThrows(fn: () => void, message?: string): void {
    try {
      fn();
      const msg = message || 'Expected function to throw an error';
      throw new Error(msg);
    } catch (e) {
      // Expected: function threw an error
    }
  }

  /**
   * Report a manual test result
   * @param name Test name
   * @param passed Whether the test passed
   * @param error Error message if failed
   */
  reportResult(name: string, passed: boolean, error?: string): void {
    this.results.push({
      name,
      passed,
      error,
      duration: 0
    });
  }

  /**
   * Run all registered tests
   * @returns Test summary with results
   */
  run(): TestSummary {
    this.startTime = Date.now();
    this.results = [];

    for (const { name, fn } of this.tests) {
      const t0 = Date.now();
      let passed = true;
      let error: string | undefined;

      try {
        fn();
      } catch (e: unknown) {
        passed = false;
        error = e instanceof Error ? e.message : String(e);
      }

      const duration = Date.now() - t0;
      this.results.push({
        name,
        passed,
        error,
        duration
      });
    }

    const totalDuration = Date.now() - this.startTime;

    return {
      total: this.results.length,
      passed: this.results.filter(r => r.passed).length,
      failed: this.results.filter(r => !r.passed).length,
      results: this.results,
      duration: totalDuration
    };
  }

  /**
   * Get current test results
   */
  getResults(): TestResult[] {
    return [...this.results];
  }

  /**
   * Clear all test results
   */
  clear(): void {
    this.results = [];
    this.tests = [];
  }

  /**
   * Format test results as human-readable string
   */
  formatResults(summary: TestSummary): string {
    let output = `\n===== Test Results =====\n`;
    output += `Total:  ${summary.total}\n`;
    output += `Passed: ${summary.passed} ✅\n`;
    output += `Failed: ${summary.failed} ❌\n`;
    output += `Time:   ${summary.duration}ms\n\n`;

    for (const result of summary.results) {
      const icon = result.passed ? '✅' : '❌';
      output += `${icon} ${result.name}`;
      if (result.error) {
        output += ` - ${result.error}`;
      }
      output += ` (${result.duration}ms)\n`;
    }

    output += `========================\n`;
    return output;
  }
}

/**
 * Global test runner instance
 */
const globalRunner = new TestRunner();

/**
 * Shorthand functions for global usage
 */
export const test = (name: string, fn: () => void) => globalRunner.test(name, fn);
export const assert = (condition: boolean, msg?: string) => globalRunner.assert(condition, msg);
export const assertEqual = <T>(actual: T, expected: T, msg?: string) => globalRunner.assertEqual(actual, expected, msg);
export const assertThrows = (fn: () => void, msg?: string) => globalRunner.assertThrows(fn, msg);
export const run = () => globalRunner.run();
export const clear = () => globalRunner.clear();

/**
 * Export the TestRunner class for advanced usage
 */
export { TestRunner };
