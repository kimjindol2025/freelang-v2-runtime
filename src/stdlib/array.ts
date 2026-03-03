/**
 * FreeLang Standard Library: std/array
 *
 * Array manipulation and transformation utilities
 */

/**
 * Apply function to each element
 * @param arr Input array
 * @param fn Function to apply
 * @returns New array with transformed elements
 */
export function map<T, R>(arr: T[], fn: (item: T, index?: number) => R): R[] {
  return arr.map(fn);
}

/**
 * Filter array by predicate
 * @param arr Input array
 * @param predicate Filter function
 * @returns Filtered array
 */
export function filter<T>(arr: T[], predicate: (item: T, index?: number) => boolean): T[] {
  return arr.filter(predicate);
}

/**
 * Reduce array to single value
 * @param arr Input array
 * @param fn Reducer function
 * @param initial Initial value
 * @returns Reduced value
 */
export function reduce<T, R>(arr: T[], fn: (acc: R, item: T, index?: number) => R, initial: R): R {
  return arr.reduce(fn, initial);
}

/**
 * Execute function for each element
 * @param arr Input array
 * @param fn Function to execute
 */
export function forEach<T>(arr: T[], fn: (item: T, index?: number) => void): void {
  arr.forEach(fn);
}

/**
 * Find first element matching predicate
 * @param arr Input array
 * @param predicate Search function
 * @returns Found element or undefined
 */
export function find<T>(arr: T[], predicate: (item: T, index?: number) => boolean): T | undefined {
  return arr.find(predicate);
}

/**
 * Find index of first element matching predicate
 * @param arr Input array
 * @param predicate Search function
 * @returns Index or -1
 */
export function findIndex<T>(arr: T[], predicate: (item: T, index?: number) => boolean): number {
  return arr.findIndex(predicate);
}

/**
 * Check if any element matches predicate
 * @param arr Input array
 * @param predicate Check function
 * @returns true if any element matches
 */
export function some<T>(arr: T[], predicate: (item: T, index?: number) => boolean): boolean {
  return arr.some(predicate);
}

/**
 * Check if all elements match predicate
 * @param arr Input array
 * @param predicate Check function
 * @returns true if all elements match
 */
export function every<T>(arr: T[], predicate: (item: T, index?: number) => boolean): boolean {
  return arr.every(predicate);
}

/**
 * Sort array
 * @param arr Input array
 * @param compareFn Comparison function (optional)
 * @returns Sorted array (mutates original)
 */
export function sort<T>(arr: T[], compareFn?: (a: T, b: T) => number): T[] {
  return arr.sort(compareFn);
}

/**
 * Reverse array
 * @param arr Input array
 * @returns Reversed array (mutates original)
 */
export function reverse<T>(arr: T[]): T[] {
  return arr.reverse();
}

/**
 * Get slice of array
 * @param arr Input array
 * @param start Start index
 * @param end End index (optional)
 * @returns New array with slice
 */
export function slice<T>(arr: T[], start: number, end?: number): T[] {
  return arr.slice(start, end);
}

/**
 * Splice array (mutates)
 * @param arr Input array
 * @param start Start index
 * @param deleteCount Number of elements to delete
 * @param items Items to insert
 * @returns Deleted elements
 */
export function splice<T>(arr: T[], start: number, deleteCount?: number, ...items: T[]): T[] {
  return arr.splice(start, deleteCount, ...items);
}

/**
 * Add element to end
 * @param arr Input array
 * @param item Item to add
 * @returns New length
 */
export function push<T>(arr: T[], ...items: T[]): number {
  return arr.push(...items);
}

/**
 * Remove last element
 * @param arr Input array
 * @returns Removed element
 */
export function pop<T>(arr: T[]): T | undefined {
  return arr.pop();
}

/**
 * Remove first element
 * @param arr Input array
 * @returns Removed element
 */
export function shift<T>(arr: T[]): T | undefined {
  return arr.shift();
}

/**
 * Add element to start
 * @param arr Input array
 * @param items Items to add
 * @returns New length
 */
export function unshift<T>(arr: T[], ...items: T[]): number {
  return arr.unshift(...items);
}

/**
 * Check if array contains element
 * @param arr Input array
 * @param item Item to find
 * @returns true if contains
 */
export function includes<T>(arr: T[], item: T): boolean {
  return arr.includes(item);
}

/**
 * Find index of element
 * @param arr Input array
 * @param item Item to find
 * @returns Index or -1
 */
export function indexOf<T>(arr: T[], item: T): number {
  return arr.indexOf(item);
}

/**
 * Find last index of element
 * @param arr Input array
 * @param item Item to find
 * @returns Last index or -1
 */
export function lastIndexOf<T>(arr: T[], item: T): number {
  return arr.lastIndexOf(item);
}

/**
 * Join array into string
 * @param arr Input array
 * @param separator Separator string
 * @returns Joined string
 */
export function join<T>(arr: T[], separator: string = ','): string {
  return arr.join(separator);
}

/**
 * Concatenate arrays
 * @param arr1 First array
 * @param arrs Other arrays
 * @returns Concatenated array
 */
export function concat<T>(arr1: T[], ...arrs: T[][]): T[] {
  return arr1.concat(...arrs);
}

/**
 * Flatten nested array
 * @param arr Input array (may be nested)
 * @param depth Depth to flatten (default: Infinity)
 * @returns Flattened array
 */
export function flatten<T>(arr: any[], depth: number = Infinity): T[] {
  return arr.flat(depth);
}

/**
 * Get unique elements
 * @param arr Input array
 * @returns Array with unique elements
 */
export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/**
 * Get unique elements by key
 * @param arr Input array
 * @param keyFn Function to extract key
 * @returns Array with unique elements by key
 */
export function uniqueBy<T>(arr: T[], keyFn: (item: T) => any): T[] {
  const seen = new Set();
  return arr.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Group array by key
 * @param arr Input array
 * @param keyFn Function to extract key
 * @returns Object with grouped elements
 */
export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

/**
 * Get array length
 * @param arr Input array
 * @returns Length
 */
export function length<T>(arr: T[]): number {
  return arr.length;
}

/**
 * Get element at index
 * @param arr Input array
 * @param index Index (supports negative)
 * @returns Element at index
 */
export function at<T>(arr: T[], index: number): T | undefined {
  return arr.at?.(index);
}

/**
 * Fill array with value
 * @param arr Input array
 * @param value Value to fill
 * @param start Start index
 * @param end End index
 * @returns Same array
 */
export function fill<T>(arr: T[], value: T, start?: number, end?: number): T[] {
  return arr.fill(value, start, end);
}

/**
 * Create array from range
 * @param start Start value
 * @param end End value (exclusive)
 * @param step Step size
 * @returns Array of values
 */
export function range(start: number, end: number, step: number = 1): number[] {
  const result: number[] = [];
  for (let i = start; i < end; i += step) {
    result.push(i);
  }
  return result;
}

/**
 * Repeat element n times
 * @param element Element to repeat
 * @param count Number of times
 * @returns Array with repeated element
 */
export function repeat<T>(element: T, count: number): T[] {
  return Array(count).fill(element);
}

/**
 * Transpose 2D array
 * @param arr 2D array
 * @returns Transposed array
 */
export function transpose<T>(arr: T[][]): T[][] {
  if (arr.length === 0) return [];
  const cols = arr[0].length;
  const result: T[][] = [];
  for (let i = 0; i < cols; i++) {
    result.push(arr.map(row => row[i]));
  }
  return result;
}

/**
 * Zip multiple arrays
 * @param arrs Arrays to zip
 * @returns Array of tuples
 */
export function zip<T>(...arrs: T[][]): T[][] {
  if (arrs.length === 0) return [];
  const minLength = Math.min(...arrs.map(arr => arr.length));
  const result: T[][] = [];
  for (let i = 0; i < minLength; i++) {
    result.push(arrs.map(arr => arr[i]));
  }
  return result;
}

/**
 * Get sum of numeric array
 * @param arr Numeric array
 * @returns Sum
 */
export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

/**
 * Get average of numeric array
 * @param arr Numeric array
 * @returns Average
 */
export function average(arr: number[]): number {
  return arr.length === 0 ? 0 : sum(arr) / arr.length;
}

/**
 * Get min value in array
 * @param arr Numeric array
 * @returns Minimum value
 */
export function min(arr: number[]): number {
  return Math.min(...arr);
}

/**
 * Get max value in array
 * @param arr Numeric array
 * @returns Maximum value
 */
export function max(arr: number[]): number {
  return Math.max(...arr);
}

/**
 * Export all array functions as default object
 */
export const array = {
  map,
  filter,
  reduce,
  forEach,
  find,
  findIndex,
  some,
  every,
  sort,
  reverse,
  slice,
  splice,
  push,
  pop,
  shift,
  unshift,
  includes,
  indexOf,
  lastIndexOf,
  join,
  concat,
  flatten,
  unique,
  uniqueBy,
  groupBy,
  length,
  at,
  fill,
  range,
  repeat,
  transpose,
  zip,
  sum,
  average,
  min,
  max
};
