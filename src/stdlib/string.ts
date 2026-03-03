/**
 * FreeLang Standard Library: std/string
 *
 * String manipulation and formatting utilities
 */

/**
 * Convert string to uppercase
 * @param str Input string
 * @returns Uppercase string
 */
export function toUpperCase(str: string): string {
  return str.toUpperCase();
}

/**
 * Convert string to lowercase
 * @param str Input string
 * @returns Lowercase string
 */
export function toLowerCase(str: string): string {
  return str.toLowerCase();
}

/**
 * Trim whitespace from both ends
 * @param str Input string
 * @returns Trimmed string
 */
export function trim(str: string): string {
  return str.trim();
}

/**
 * Trim whitespace from start
 * @param str Input string
 * @returns Trimmed string
 */
export function trimStart(str: string): string {
  return str.trimStart();
}

/**
 * Trim whitespace from end
 * @param str Input string
 * @returns Trimmed string
 */
export function trimEnd(str: string): string {
  return str.trimEnd();
}

/**
 * Split string by separator
 * @param str Input string
 * @param separator Separator string
 * @returns Array of substrings
 */
export function split(str: string, separator: string): string[] {
  return str.split(separator);
}

/**
 * Join array of strings with separator
 * @param parts Array of strings
 * @param separator Separator string
 * @returns Joined string
 */
export function join(parts: string[], separator: string = ''): string {
  return parts.join(separator);
}

/**
 * Replace first occurrence
 * @param str Input string
 * @param find String to find
 * @param replace Replacement string
 * @returns Modified string
 */
export function replace(str: string, find: string, replace: string): string {
  return str.replace(find, replace);
}

/**
 * Replace all occurrences
 * @param str Input string
 * @param find String to find
 * @param replace Replacement string
 * @returns Modified string
 */
export function replaceAll(str: string, find: string, replace: string): string {
  return str.split(find).join(replace);
}

/**
 * Check if string starts with prefix
 * @param str Input string
 * @param prefix Prefix to check
 * @returns true if starts with prefix
 */
export function startsWith(str: string, prefix: string): boolean {
  return str.startsWith(prefix);
}

/**
 * Check if string ends with suffix
 * @param str Input string
 * @param suffix Suffix to check
 * @returns true if ends with suffix
 */
export function endsWith(str: string, suffix: string): boolean {
  return str.endsWith(suffix);
}

/**
 * Check if string contains substring
 * @param str Input string
 * @param substring Substring to find
 * @returns true if contains substring
 */
export function includes(str: string, substring: string): boolean {
  return str.includes(substring);
}

/**
 * Get substring
 * @param str Input string
 * @param start Start index
 * @param end End index (optional)
 * @returns Substring
 */
export function substring(str: string, start: number, end?: number): string {
  return str.substring(start, end);
}

/**
 * Find index of substring
 * @param str Input string
 * @param substring Substring to find
 * @returns Index of substring, or -1 if not found
 */
export function indexOf(str: string, substring: string): number {
  return str.indexOf(substring);
}

/**
 * Find last index of substring
 * @param str Input string
 * @param substring Substring to find
 * @returns Last index of substring, or -1 if not found
 */
export function lastIndexOf(str: string, substring: string): number {
  return str.lastIndexOf(substring);
}

/**
 * Get character at index
 * @param str Input string
 * @param index Character index
 * @returns Character at index
 */
export function charAt(str: string, index: number): string {
  return str.charAt(index);
}

/**
 * Get character code at index
 * @param str Input string
 * @param index Character index
 * @returns Character code
 */
export function charCodeAt(str: string, index: number): number {
  return str.charCodeAt(index);
}

/**
 * Repeat string n times
 * @param str Input string
 * @param count Number of times to repeat
 * @returns Repeated string
 */
export function repeat(str: string, count: number): string {
  return str.repeat(count);
}

/**
 * Capitalize first character
 * @param str Input string
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
  if (str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Capitalize every word
 * @param str Input string
 * @returns Title case string
 */
export function capitalizeWords(str: string): string {
  return str
    .split(' ')
    .map(word => capitalize(word))
    .join(' ');
}

/**
 * Reverse string
 * @param str Input string
 * @returns Reversed string
 */
export function reverse(str: string): string {
  return str.split('').reverse().join('');
}

/**
 * Convert to camelCase
 * @param str Input string
 * @returns camelCase string
 */
export function camelCase(str: string): string {
  return str
    .toLowerCase()
    .split(/[-_\s]/)
    .map((word, index) =>
      index === 0 ? word : capitalize(word)
    )
    .join('');
}

/**
 * Convert to snake_case
 * @param str Input string
 * @returns snake_case string
 */
export function snakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

/**
 * Convert to PascalCase
 * @param str Input string
 * @returns PascalCase string
 */
export function pascalCase(str: string): string {
  return str
    .toLowerCase()
    .split(/[-_\s]/)
    .map(word => capitalize(word))
    .join('');
}

/**
 * Convert to kebab-case
 * @param str Input string
 * @returns kebab-case string
 */
export function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

/**
 * Pad string at start
 * @param str Input string
 * @param length Target length
 * @param pad Padding character
 * @returns Padded string
 */
export function padStart(str: string, length: number, pad: string = ' '): string {
  return str.padStart(length, pad);
}

/**
 * Pad string at end
 * @param str Input string
 * @param length Target length
 * @param pad Padding character
 * @returns Padded string
 */
export function padEnd(str: string, length: number, pad: string = ' '): string {
  return str.padEnd(length, pad);
}

/**
 * Format string with placeholders
 * @param template Template string with {0}, {1}, etc
 * @param values Values to substitute
 * @returns Formatted string
 */
export function format(template: string, values: any[]): string {
  let result = template;
  for (let i = 0; i < values.length; i++) {
    result = result.replace(new RegExp(`\\{${i}\\}`, 'g'), String(values[i]));
  }
  return result;
}

/**
 * Get string length
 * @param str Input string
 * @returns String length
 */
export function length(str: string): number {
  return str.length;
}

/**
 * Get string similarity (0-1)
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score
 */
export function similarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1;

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Get Levenshtein distance between two strings
 * @param str1 First string
 * @param str2 Second string
 * @returns Edit distance
 */
function getEditDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      const cost = str1[j - 1] === str2[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i][j - 1] + 1,
        matrix[i - 1][j] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Export all string functions as default object
 */
export const string = {
  toUpperCase,
  toLowerCase,
  trim,
  trimStart,
  trimEnd,
  split,
  join,
  replace,
  replaceAll,
  startsWith,
  endsWith,
  includes,
  substring,
  indexOf,
  lastIndexOf,
  charAt,
  charCodeAt,
  repeat,
  capitalize,
  capitalizeWords,
  reverse,
  camelCase,
  snakeCase,
  pascalCase,
  kebabCase,
  padStart,
  padEnd,
  format,
  length,
  similarity
};
