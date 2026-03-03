/**
 * FreeLang Standard Library: std/map
 *
 * Map operations and utilities for key-value pair collections
 */

/**
 * Map entry type
 */
export interface MapEntry<K, V> {
  key: K;
  value: V;
}

/**
 * Create map from array of [key, value] pairs
 * @param entries Array of [key, value] pairs
 * @returns Map object
 */
export function create<K, V>(entries?: Array<[K, V]>): Map<K, V> {
  return new Map(entries);
}

/**
 * Create map from object
 * @param obj Object to convert
 * @returns Map with object properties as entries
 */
export function fromObject<V>(obj: Record<string, V>): Map<string, V> {
  return new Map(Object.entries(obj));
}

/**
 * Create object from map
 * @param map Map to convert
 * @returns Object with map entries as properties
 */
export function toObject<V>(map: Map<string, V>): Record<string, V> {
  const obj: Record<string, V> = {};
  for (const [key, value] of map) {
    obj[key] = value;
  }
  return obj;
}

/**
 * Set value in map
 * @param map Target map
 * @param key Key
 * @param value Value
 */
export function set<K, V>(map: Map<K, V>, key: K, value: V): void {
  map.set(key, value);
}

/**
 * Get value from map
 * @param map Target map
 * @param key Key
 * @returns Value or undefined
 */
export function get<K, V>(map: Map<K, V>, key: K): V | undefined {
  return map.get(key);
}

/**
 * Check if map contains key
 * @param map Target map
 * @param key Key to find
 * @returns true if contains
 */
export function has<K, V>(map: Map<K, V>, key: K): boolean {
  return map.has(key);
}

/**
 * Delete entry from map
 * @param map Target map
 * @param key Key to delete
 * @returns true if key was deleted
 */
export function delete_<K, V>(map: Map<K, V>, key: K): boolean {
  return map.delete(key);
}

/**
 * Clear all entries from map
 * @param map Target map
 */
export function clear<K, V>(map: Map<K, V>): void {
  map.clear();
}

/**
 * Get size of map
 * @param map Target map
 * @returns Number of entries
 */
export function size<K, V>(map: Map<K, V>): number {
  return map.size;
}

/**
 * Get all keys in map
 * @param map Target map
 * @returns Array of keys
 */
export function keys<K, V>(map: Map<K, V>): K[] {
  return Array.from(map.keys());
}

/**
 * Get all values in map
 * @param map Target map
 * @returns Array of values
 */
export function values<K, V>(map: Map<K, V>): V[] {
  return Array.from(map.values());
}

/**
 * Get all entries in map
 * @param map Target map
 * @returns Array of [key, value] pairs
 */
export function entries<K, V>(map: Map<K, V>): Array<[K, V]> {
  return Array.from(map.entries());
}

/**
 * Execute function for each entry
 * @param map Target map
 * @param fn Function to execute
 */
export function forEach<K, V>(map: Map<K, V>, fn: (value: V, key: K) => void): void {
  map.forEach(fn);
}

/**
 * Map values to new map
 * @param map Source map
 * @param fn Transformation function
 * @returns New map with transformed values
 */
export function mapValues<K, V, R>(map: Map<K, V>, fn: (value: V, key: K) => R): Map<K, R> {
  const result = new Map<K, R>();
  for (const [key, value] of map) {
    result.set(key, fn(value, key));
  }
  return result;
}

/**
 * Filter map by predicate
 * @param map Source map
 * @param predicate Filter function
 * @returns New map with filtered entries
 */
export function filter<K, V>(map: Map<K, V>, predicate: (value: V, key: K) => boolean): Map<K, V> {
  const result = new Map<K, V>();
  for (const [key, value] of map) {
    if (predicate(value, key)) {
      result.set(key, value);
    }
  }
  return result;
}

/**
 * Merge two maps (second map values override first)
 * @param map1 First map
 * @param map2 Second map
 * @returns New merged map
 */
export function merge<K, V>(map1: Map<K, V>, map2: Map<K, V>): Map<K, V> {
  const result = new Map(map1);
  for (const [key, value] of map2) {
    result.set(key, value);
  }
  return result;
}

/**
 * Check if two maps are equal
 * @param map1 First map
 * @param map2 Second map
 * @returns true if equal
 */
export function equals<K, V>(map1: Map<K, V>, map2: Map<K, V>): boolean {
  if (map1.size !== map2.size) return false;

  for (const [key, value] of map1) {
    if (!map2.has(key) || map2.get(key) !== value) {
      return false;
    }
  }

  return true;
}

/**
 * Clone map
 * @param map Map to clone
 * @returns Shallow copy of map
 */
export function clone<K, V>(map: Map<K, V>): Map<K, V> {
  return new Map(map);
}

/**
 * Group array elements into map
 * @param arr Input array
 * @param keyFn Function to extract key
 * @returns Map with grouped elements
 */
export function groupBy<T, K>(arr: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const result = new Map<K, T[]>();
  for (const item of arr) {
    const key = keyFn(item);
    if (!result.has(key)) {
      result.set(key, []);
    }
    result.get(key)!.push(item);
  }
  return result;
}

/**
 * Create map from array indexed by key
 * @param arr Input array
 * @param keyFn Function to extract key
 * @returns Map with array items as values
 */
export function indexBy<T, K>(arr: T[], keyFn: (item: T) => K): Map<K, T> {
  const result = new Map<K, T>();
  for (const item of arr) {
    const key = keyFn(item);
    result.set(key, item);
  }
  return result;
}

/**
 * Export all map functions as default object
 */
export const mapOps = {
  create,
  fromObject,
  toObject,
  set,
  get,
  has,
  delete: delete_,
  clear,
  size,
  keys,
  values,
  entries,
  forEach,
  mapValues,
  filter,
  merge,
  equals,
  clone,
  groupBy,
  indexBy
};
