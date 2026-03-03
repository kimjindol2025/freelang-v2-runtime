/**
 * FreeLang Standard Library: std/encoding
 *
 * Encoding and decoding utilities for various formats
 */

/**
 * Encode string to Base64
 * @param str Input string
 * @returns Base64 encoded string
 */
export function base64Encode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64');
}

/**
 * Decode Base64 string
 * @param encoded Base64 encoded string
 * @returns Decoded string
 */
export function base64Decode(encoded: string): string {
  try {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  } catch (error) {
    throw new Error('Invalid Base64 string');
  }
}

/**
 * Encode string to URL safe format (percent encoding)
 * @param str Input string
 * @returns URL encoded string
 */
export function urlEncode(str: string): string {
  return encodeURIComponent(str);
}

/**
 * Decode URL encoded string
 * @param encoded URL encoded string
 * @returns Decoded string
 */
export function urlDecode(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch (error) {
    throw new Error('Invalid URL encoded string');
  }
}

/**
 * Encode object to URL query string
 * @param obj Object to encode
 * @returns Query string (key=value&key=value)
 */
export function urlEncodeObject(obj: Record<string, any>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    params.append(key, String(value));
  }
  return params.toString();
}

/**
 * Decode URL query string to object
 * @param query Query string
 * @returns Decoded object
 */
export function urlDecodeObject(query: string): Record<string, string> {
  const params = new URLSearchParams(query);
  const obj: Record<string, string> = {};
  for (const [key, value] of params) {
    obj[key] = value;
  }
  return obj;
}

/**
 * Encode string to Hex
 * @param str Input string
 * @returns Hex encoded string
 */
export function hexEncode(str: string): string {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Decode Hex string
 * @param hex Hex encoded string
 * @returns Decoded string
 */
export function hexDecode(hex: string): string {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
}

/**
 * Encode HTML special characters
 * @param str Input string
 * @returns HTML encoded string
 */
export function htmlEncode(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Decode HTML encoded string
 * @param encoded HTML encoded string
 * @returns Decoded string
 */
export function htmlDecode(encoded: string): string {
  const map: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'"
  };
  return encoded.replace(/&[^;]+;/g, entity => map[entity] || entity);
}

/**
 * Encode object to CSV row
 * @param arr Array of values
 * @param delimiter Column delimiter (default: comma)
 * @returns CSV row string
 */
export function csvEncode(arr: any[], delimiter: string = ','): string {
  return arr
    .map(value => {
      const str = String(value);
      // Quote if contains delimiter, newline, or quote
      if (str.includes(delimiter) || str.includes('\n') || str.includes('"')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    })
    .join(delimiter);
}

/**
 * Decode CSV row to array
 * @param row CSV row string
 * @param delimiter Column delimiter (default: comma)
 * @returns Array of values
 */
export function csvDecode(row: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Encode array of arrays to CSV string
 * @param rows Array of rows (each row is array of values)
 * @param delimiter Column delimiter (default: comma)
 * @returns CSV string
 */
export function csvEncodeTable(rows: any[][], delimiter: string = ','): string {
  return rows.map(row => csvEncode(row, delimiter)).join('\n');
}

/**
 * Decode CSV string to array of arrays
 * @param csv CSV string
 * @param delimiter Column delimiter (default: comma)
 * @returns Array of rows
 */
export function csvDecodeTable(csv: string, delimiter: string = ','): string[][] {
  return csv.split('\n').map(row => csvDecode(row, delimiter));
}

/**
 * Create Base64 data URL
 * @param str String content
 * @param mimeType MIME type (default: text/plain)
 * @returns Data URL
 */
export function createDataUrl(str: string, mimeType: string = 'text/plain'): string {
  const encoded = base64Encode(str);
  return `data:${mimeType};base64,${encoded}`;
}

/**
 * Parse Base64 data URL
 * @param dataUrl Data URL
 * @returns Decoded string
 */
export function parseDataUrl(dataUrl: string): string {
  const base64 = dataUrl.split(',')[1];
  if (!base64) {
    throw new Error('Invalid data URL');
  }
  return base64Decode(base64);
}

/**
 * Export all encoding functions as default object
 */
export const encoding = {
  base64Encode,
  base64Decode,
  urlEncode,
  urlDecode,
  urlEncodeObject,
  urlDecodeObject,
  hexEncode,
  hexDecode,
  htmlEncode,
  htmlDecode,
  csvEncode,
  csvDecode,
  csvEncodeTable,
  csvDecodeTable,
  createDataUrl,
  parseDataUrl
};
