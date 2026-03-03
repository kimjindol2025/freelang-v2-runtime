/**
 * FreeLang Standard Library: std/set
 *
 * Set operations and utilities for unique value collections
 */

/**
 * Create set from array
 * @param arr Input array
 * @returns Set with unique elements
 */
export function create<T>(arr: T[]): Set<T> {
  return new Set(arr);
}

/**
 * Add element to set
 * @param set Target set
 * @param element Element to add
 */
export function add<T>(set: Set<T>, element: T): void {
  set.add(element);
}

/**
 * Remove element from set
 * @param set Target set
 * @param element Element to remove
 * @returns true if element was removed
 */
export function remove<T>(set: Set<T>, element: T): boolean {
  return set.delete(element);
}

/**
 * Check if set contains element
 * @param set Target set
 * @param element Element to find
 * @returns true if contains
 */
export function has<T>(set: Set<T>, element: T): boolean {
  return set.has(element);
}

/**
 * Get size of set
 * @param set Target set
 * @returns Number of elements
 */
export function size<T>(set: Set<T>): number {
  return set.size;
}

/**
 * Clear all elements from set
 * @param set Target set
 */
export function clear<T>(set: Set<T>): void {
  set.clear();
}

/**
 * Convert set to array
 * @param set Target set
 * @returns Array of elements
 */
export function toArray<T>(set: Set<T>): T[] {
  return Array.from(set);
}

/**
 * Get union of two sets
 * @param set1 First set
 * @param set2 Second set
 * @returns New set with all elements
 */
export function union<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  return new Set([...set1, ...set2]);
}

/**
 * Get intersection of two sets
 * @param set1 First set
 * @param set2 Second set
 * @returns New set with common elements
 */
export function intersection<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  return new Set([...set1].filter(x => set2.has(x)));
}

/**
 * Get difference of two sets (elements in set1 but not set2)
 * @param set1 First set
 * @param set2 Second set
 * @returns New set with difference
 */
export function difference<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  return new Set([...set1].filter(x => !set2.has(x)));
}

/**
 * Get symmetric difference (elements in either but not both)
 * @param set1 First set
 * @param set2 Second set
 * @returns New set with symmetric difference
 */
export function symmetricDifference<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  const result = new Set<T>();

  for (const item of set1) {
    if (!set2.has(item)) {
      result.add(item);
    }
  }

  for (const item of set2) {
    if (!set1.has(item)) {
      result.add(item);
    }
  }

  return result;
}

/**
 * Check if set is subset of another (all elements in set1 are in set2)
 * @param set1 Potential subset
 * @param set2 Potential superset
 * @returns true if subset
 */
export function isSubset<T>(set1: Set<T>, set2: Set<T>): boolean {
  return [...set1].every(x => set2.has(x));
}

/**
 * Check if set is superset of another (all elements of set2 are in set1)
 * @param set1 Potential superset
 * @param set2 Potential subset
 * @returns true if superset
 */
export function isSuperset<T>(set1: Set<T>, set2: Set<T>): boolean {
  return [...set2].every(x => set1.has(x));
}

/**
 * Check if two sets are equal
 * @param set1 First set
 * @param set2 Second set
 * @returns true if equal
 */
export function equals<T>(set1: Set<T>, set2: Set<T>): boolean {
  if (set1.size !== set2.size) return false;
  return [...set1].every(x => set2.has(x));
}

/**
 * Map set to new set with transformed elements
 * @param set Source set
 * @param fn Transformation function
 * @returns New set with transformed elements
 */
export function map<T, R>(set: Set<T>, fn: (element: T) => R): Set<R> {
  return new Set([...set].map(fn));
}

/**
 * Filter set by predicate
 * @param set Source set
 * @param predicate Filter function
 * @returns New set with filtered elements
 */
export function filter<T>(set: Set<T>, predicate: (element: T) => boolean): Set<T> {
  return new Set([...set].filter(predicate));
}

/**
 * Export all set functions as default object
 */
export const setOps = {
  create,
  add,
  remove,
  has,
  size,
  clear,
  toArray,
  union,
  intersection,
  difference,
  symmetricDifference,
  isSubset,
  isSuperset,
  equals,
  map,
  filter
};
