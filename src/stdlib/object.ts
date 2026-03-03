/**
 * FreeLang Standard Library: std/object
 *
 * Object manipulation and utilities
 */

/**
 * Get object keys
 * @param obj Input object
 * @returns Array of keys
 */
export function keys(obj: Record<string, any>): string[] {
  return Object.keys(obj);
}

/**
 * Get object values
 * @param obj Input object
 * @returns Array of values
 */
export function values(obj: Record<string, any>): any[] {
  return Object.values(obj);
}

/**
 * Get object entries (key-value pairs)
 * @param obj Input object
 * @returns Array of [key, value] pairs
 */
export function entries(obj: Record<string, any>): [string, any][] {
  return Object.entries(obj);
}

/**
 * Check if object has property
 * @param obj Input object
 * @param key Property key
 * @returns true if has property
 */
export function has(obj: Record<string, any>, key: string): boolean {
  return key in obj;
}

/**
 * Get property value
 * @param obj Input object
 * @param key Property key
 * @returns Property value or undefined
 */
export function get(obj: Record<string, any>, key: string): any {
  return obj[key];
}

/**
 * Set property value
 * @param obj Input object
 * @param key Property key
 * @param value Property value
 */
export function set(obj: Record<string, any>, key: string, value: any): void {
  obj[key] = value;
}

/**
 * Delete property
 * @param obj Input object
 * @param key Property key
 * @returns true if deleted
 */
export function deleteProperty(obj: Record<string, any>, key: string): boolean {
  return delete obj[key];
}

/**
 * Check if object is empty
 * @param obj Input object
 * @returns true if empty
 */
export function isEmpty(obj: Record<string, any>): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Get object length (number of properties)
 * @param obj Input object
 * @returns Number of properties
 */
export function length(obj: Record<string, any>): number {
  return Object.keys(obj).length;
}

/**
 * Merge objects
 * @param target Target object
 * @param sources Objects to merge
 * @returns Merged object
 */
export function assign<T extends Record<string, any>>(
  target: T,
  ...sources: Record<string, any>[]
): T {
  return Object.assign(target, ...sources);
}

/**
 * Create shallow copy of object
 * @param obj Input object
 * @returns Shallow copy
 */
export function clone<T extends Record<string, any>>(obj: T): T {
  return { ...obj };
}

/**
 * Create deep copy of object
 * @param obj Input object
 * @returns Deep copy
 */
export function deepClone<T extends Record<string, any>>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;

  const cloned: Record<string, any> = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned as T;
}

/**
 * Map object values
 * @param obj Input object
 * @param fn Mapping function
 * @returns New object with mapped values
 */
export function mapValues<T extends Record<string, any>, R>(
  obj: T,
  fn: (value: any, key: string) => R
): Record<string, R> {
  const result: Record<string, R> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = fn(value, key);
  }
  return result;
}

/**
 * Filter object by keys
 * @param obj Input object
 * @param predicate Filter function
 * @returns New object with filtered properties
 */
export function filterKeys<T extends Record<string, any>>(
  obj: T,
  predicate: (key: string, value: any) => boolean
): Partial<T> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (predicate(key, value)) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

/**
 * Pick specific properties
 * @param obj Input object
 * @param keys Keys to pick
 * @returns New object with picked properties
 */
export function pick<T extends Record<string, any>>(
  obj: T,
  keys: string[]
): Partial<T> {
  const result: Record<string, any> = {};
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result as Partial<T>;
}

/**
 * Omit specific properties
 * @param obj Input object
 * @param keys Keys to omit
 * @returns New object without omitted properties
 */
export function omit<T extends Record<string, any>>(
  obj: T,
  keys: string[]
): Partial<T> {
  const result: Record<string, any> = {};
  const keySet = new Set(keys);
  for (const [key, value] of Object.entries(obj)) {
    if (!keySet.has(key)) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

/**
 * Invert object (swap keys and values)
 * @param obj Input object
 * @returns Inverted object
 */
export function invert(obj: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[value] = key;
  }
  return result;
}

/**
 * Group object by key function
 * @param obj Input object
 * @param groupFn Grouping function
 * @returns Grouped object
 */
export function groupBy<T extends Record<string, any>>(
  obj: T,
  groupFn: (key: string, value: any) => string
): Record<string, Record<string, any>> {
  const result: Record<string, Record<string, any>> = {};
  for (const [key, value] of Object.entries(obj)) {
    const group = groupFn(key, value);
    if (!result[group]) result[group] = {};
    result[group][key] = value;
  }
  return result;
}

/**
 * Convert object to array of objects
 * @param obj Input object
 * @param keyName Name of key property
 * @param valueName Name of value property
 * @returns Array of objects
 */
export function toArray<T extends Record<string, any>>(
  obj: T,
  keyName: string = 'key',
  valueName: string = 'value'
): Array<Record<string, any>> {
  return Object.entries(obj).map(([key, value]) => ({
    [keyName]: key,
    [valueName]: value
  }));
}

/**
 * Convert array of objects to object
 * @param arr Array of objects
 * @param keyName Property to use as key
 * @param valueName Property to use as value
 * @returns Object
 */
export function fromArray(
  arr: Record<string, any>[],
  keyName: string = 'key',
  valueName: string = 'value'
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const item of arr) {
    const key = item[keyName];
    const value = item[valueName];
    result[key] = value;
  }
  return result;
}

/**
 * Get nested property using dot notation
 * @param obj Input object
 * @param path Path like "user.profile.name"
 * @returns Property value
 */
export function getDeep(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Set nested property using dot notation
 * @param obj Input object
 * @param path Path like "user.profile.name"
 * @param value Value to set
 */
export function setDeep(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

/**
 * Check if objects are deeply equal
 * @param obj1 First object
 * @param obj2 Second object
 * @returns true if equal
 */
export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

/**
 * Export all object functions as default object
 */
export const object = {
  keys,
  values,
  entries,
  has,
  get,
  set,
  deleteProperty,
  isEmpty,
  length,
  assign,
  clone,
  deepClone,
  mapValues,
  filterKeys,
  pick,
  omit,
  invert,
  groupBy,
  toArray,
  fromArray,
  getDeep,
  setDeep,
  deepEqual
};
