/**
 * FreeLang Standard Library: std/regex
 *
 * Regular expression utilities for pattern matching, validation, and text processing
 */

/**
 * Compiled regular expression with utilities
 */
export interface CompiledRegex {
  pattern: string;
  regex: RegExp;
  flags: string;
}

/**
 * Match result with position information
 */
export interface MatchResult {
  match: string;
  index: number;
  groups?: string[];
}

/**
 * Create a compiled regex from pattern
 * @param pattern Regex pattern string
 * @param flags Optional flags (g, i, m, s, u, y)
 * @returns Compiled regex object
 */
export function compile(pattern: string, flags: string = ''): CompiledRegex {
  try {
    const regex = new RegExp(pattern, flags);
    return {
      pattern,
      regex,
      flags
    };
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${pattern}`);
  }
}

/**
 * Test if string matches pattern
 * @param str Input string
 * @param pattern Regex pattern string
 * @param flags Optional flags
 * @returns true if matches
 */
export function test(str: string, pattern: string, flags: string = ''): boolean {
  try {
    const regex = new RegExp(pattern, flags);
    return regex.test(str);
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${pattern}`);
  }
}

/**
 * Find first match in string
 * @param str Input string
 * @param pattern Regex pattern string
 * @param flags Optional flags
 * @returns Match result or undefined
 */
export function match(str: string, pattern: string, flags: string = ''): MatchResult | undefined {
  try {
    const regex = new RegExp(pattern, flags);
    const result = regex.exec(str);

    if (!result) return undefined;

    return {
      match: result[0],
      index: result.index,
      groups: result.slice(1)
    };
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${pattern}`);
  }
}

/**
 * Find all matches in string
 * @param str Input string
 * @param pattern Regex pattern string
 * @param flags Optional flags
 * @returns Array of match results
 */
export function matchAll(str: string, pattern: string, flags: string = 'g'): MatchResult[] {
  try {
    // Ensure global flag is set
    const finalFlags = flags.includes('g') ? flags : flags + 'g';
    const regex = new RegExp(pattern, finalFlags);
    const results: MatchResult[] = [];
    let match;

    while ((match = regex.exec(str)) !== null) {
      results.push({
        match: match[0],
        index: match.index,
        groups: match.slice(1)
      });
    }

    return results;
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${pattern}`);
  }
}

/**
 * Split string by regex pattern
 * @param str Input string
 * @param pattern Regex pattern string
 * @param limit Maximum number of parts
 * @returns Array of parts
 */
export function split(str: string, pattern: string, limit?: number): string[] {
  try {
    const regex = new RegExp(pattern);
    return str.split(regex, limit);
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${pattern}`);
  }
}

/**
 * Replace first match
 * @param str Input string
 * @param pattern Regex pattern string
 * @param replacement Replacement string
 * @returns Modified string
 */
export function replace(str: string, pattern: string, replacement: string): string {
  try {
    const regex = new RegExp(pattern);
    return str.replace(regex, replacement);
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${pattern}`);
  }
}

/**
 * Replace all matches
 * @param str Input string
 * @param pattern Regex pattern string
 * @param replacement Replacement string
 * @returns Modified string
 */
export function replaceAll(str: string, pattern: string, replacement: string): string {
  try {
    const flags = 'g';
    const regex = new RegExp(pattern, flags);
    return str.replace(regex, replacement);
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${pattern}`);
  }
}

/**
 * Escape special regex characters in string
 * @param str Input string
 * @returns Escaped string safe for regex
 */
export function escape(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if email is valid
 * @param email Email address
 * @returns true if valid email format
 */
export function isEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if string is valid URL
 * @param url URL string
 * @returns true if valid URL format
 */
export function isUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if string contains only alphanumeric characters
 * @param str Input string
 * @returns true if alphanumeric only
 */
export function isAlphanumeric(str: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(str);
}

/**
 * Extract email addresses from text
 * @param text Input text
 * @returns Array of found email addresses
 */
export function extractEmails(text: string): string[] {
  const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
  return text.match(emailRegex) || [];
}

/**
 * Extract URLs from text
 * @param text Input text
 * @returns Array of found URLs
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/g;
  return text.match(urlRegex) || [];
}

/**
 * Export all regex functions as default object
 */
export const regex = {
  compile,
  test,
  match,
  matchAll,
  split,
  replace,
  replaceAll,
  escape,
  isEmail,
  isUrl,
  isAlphanumeric,
  extractEmails,
  extractUrls
};
