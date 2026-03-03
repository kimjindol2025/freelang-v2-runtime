/**
 * FreeLang Standard Library: std/json
 *
 * JSON serialization and parsing
 */

/**
 * Convert object to JSON string
 * @param obj Object to stringify
 * @param replacer Optional replacer function
 * @param space Number of spaces for indentation
 * @returns JSON string
 */
export function stringify(
  obj: any,
  replacer?: (key: string, value: any) => any,
  space?: number
): string {
  try {
    return JSON.stringify(obj, replacer, space);
  } catch (error) {
    throw new Error(`Failed to stringify: ${error}`);
  }
}

/**
 * Parse JSON string to object
 * @param json JSON string
 * @param reviver Optional reviver function
 * @returns Parsed object
 */
export function parse(
  json: string,
  reviver?: (key: string, value: any) => any
): any {
  try {
    return JSON.parse(json, reviver);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error}`);
  }
}

/**
 * Prettify JSON string
 * @param json JSON string or object
 * @param space Number of spaces
 * @returns Prettified JSON string
 */
export function prettify(json: string | object, space: number = 2): string {
  try {
    const obj = typeof json === 'string' ? parse(json) : json;
    return stringify(obj, undefined, space);
  } catch (error) {
    throw new Error(`Failed to prettify JSON: ${error}`);
  }
}

/**
 * Minify JSON string
 * @param json JSON string or object
 * @returns Minified JSON string
 */
export function minify(json: string | object): string {
  try {
    const obj = typeof json === 'string' ? parse(json) : json;
    return stringify(obj);
  } catch (error) {
    throw new Error(`Failed to minify JSON: ${error}`);
  }
}

/**
 * Check if string is valid JSON
 * @param str String to validate
 * @returns true if valid JSON
 */
export function isValid(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Deep merge JSON objects
 * @param obj1 First object
 * @param obj2 Second object
 * @returns Merged object
 */
export function merge(obj1: any, obj2: any): any {
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    return obj2;
  }

  const result = Array.isArray(obj1) ? [...obj1] : { ...obj1 };

  for (const key in obj2) {
    if (obj2.hasOwnProperty(key)) {
      if (typeof obj2[key] === 'object' && obj2[key] !== null) {
        result[key] = merge(result[key], obj2[key]);
      } else {
        result[key] = obj2[key];
      }
    }
  }

  return result;
}

/**
 * Create JSON schema from object
 * @param obj Input object
 * @returns JSON schema
 */
export function schema(obj: any): any {
  if (obj === null) return { type: 'null' };
  if (Array.isArray(obj)) {
    return {
      type: 'array',
      items: obj.length > 0 ? schema(obj[0]) : {}
    };
  }

  const type = typeof obj;

  if (type === 'object') {
    const properties: Record<string, any> = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        properties[key] = schema(obj[key]);
      }
    }
    return {
      type: 'object',
      properties,
      required: Object.keys(properties)
    };
  }

  return { type };
}

/**
 * Validate object against schema (basic validation)
 * @param obj Object to validate
 * @param sch Schema to validate against
 * @returns true if valid
 */
export function validate(obj: any, sch: any): boolean {
  if (sch.type === 'null') return obj === null;
  if (sch.type === 'array') return Array.isArray(obj);
  if (sch.type === 'object') return typeof obj === 'object' && obj !== null;
  return typeof obj === sch.type;
}

/**
 * Export all json functions as default object
 */
export const json = {
  stringify,
  parse,
  prettify,
  minify,
  isValid,
  merge,
  schema,
  validate
};
