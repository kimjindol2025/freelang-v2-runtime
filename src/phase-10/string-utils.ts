/**
 * Phase 10: String Utilities
 *
 * 문자열 처리:
 * - split, join, trim
 * - contains, startsWith, endsWith
 * - replace, replaceAll
 * - substring, charAt, indexOf
 * - toUpperCase, toLowerCase
 * - regex matching
 */

/**
 * 문자열 유틸리티
 */
export class StringUtils {
  /**
   * 문자열 분할
   */
  static split(str: string, separator: string): string[] {
    if (!separator) return [str];
    return str.split(separator);
  }

  /**
   * 배열 결합
   */
  static join(arr: string[], separator: string = ''): string {
    return arr.join(separator);
  }

  /**
   * 공백 제거
   */
  static trim(str: string): string {
    return str.trim();
  }

  /**
   * 왼쪽 공백 제거
   */
  static trimStart(str: string): string {
    return str.trimStart();
  }

  /**
   * 오른쪽 공백 제거
   */
  static trimEnd(str: string): string {
    return str.trimEnd();
  }

  /**
   * 포함 여부 확인
   */
  static contains(str: string, substring: string): boolean {
    return str.includes(substring);
  }

  /**
   * 시작 확인
   */
  static startsWith(str: string, prefix: string): boolean {
    return str.startsWith(prefix);
  }

  /**
   * 종료 확인
   */
  static endsWith(str: string, suffix: string): boolean {
    return str.endsWith(suffix);
  }

  /**
   * 위치 검색
   */
  static indexOf(str: string, substring: string): number {
    return str.indexOf(substring);
  }

  /**
   * 역방향 위치 검색
   */
  static lastIndexOf(str: string, substring: string): number {
    return str.lastIndexOf(substring);
  }

  /**
   * 문자 추출
   */
  static charAt(str: string, index: number): string {
    return str.charAt(index);
  }

  /**
   * 부분 문자열
   */
  static substring(str: string, start: number, end?: number): string {
    return str.substring(start, end);
  }

  /**
   * 슬라이싱
   */
  static slice(str: string, start: number, end?: number): string {
    return str.slice(start, end);
  }

  /**
   * 문자 반복
   */
  static repeat(str: string, count: number): string {
    return str.repeat(count);
  }

  /**
   * 문자열 바꾸기 (첫 번째만)
   */
  static replace(str: string, from: string, to: string): string {
    return str.replace(from, to);
  }

  /**
   * 모든 문자열 바꾸기
   */
  static replaceAll(str: string, from: string, to: string): string {
    return str.split(from).join(to);
  }

  /**
   * 대문자 변환
   */
  static toUpperCase(str: string): string {
    return str.toUpperCase();
  }

  /**
   * 소문자 변환
   */
  static toLowerCase(str: string): string {
    return str.toLowerCase();
  }

  /**
   * 길이
   */
  static getLength(str: string): number {
    return str.length;
  }

  /**
   * 비어 있는지 확인
   */
  static isEmpty(str: string): boolean {
    return str.length === 0;
  }

  /**
   * 패딩 (왼쪽)
   */
  static padStart(str: string, length: number, padString: string = ' '): string {
    return str.padStart(length, padString);
  }

  /**
   * 패딩 (오른쪽)
   */
  static padEnd(str: string, length: number, padString: string = ' '): string {
    return str.padEnd(length, padString);
  }

  /**
   * 반복 제거
   */
  static removeRepeating(str: string, char: string): string {
    const regex = new RegExp(char + '+', 'g');
    return str.replace(regex, char);
  }

  /**
   * 캐멜케이스
   */
  static toCamelCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map((word, i) => (i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
      .join('');
  }

  /**
   * 스네이크케이스
   */
  static toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }

  /**
   * 케밥케이스
   */
  static toKebabCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  }

  /**
   * 역순
   */
  static reverse(str: string): string {
    return str.split('').reverse().join('');
  }

  /**
   * 단어 개수
   */
  static wordCount(str: string): number {
    return str.trim().split(/\s+/).length;
  }

  /**
   * 줄 개수
   */
  static lineCount(str: string): number {
    return str.split('\n').length;
  }

  /**
   * 각 줄 처리
   */
  static mapLines(str: string, fn: (line: string) => string): string {
    return str.split('\n').map(fn).join('\n');
  }

  /**
   * 각 단어 처리
   */
  static mapWords(str: string, fn: (word: string) => string): string {
    return str.split(/\s+/).map(fn).join(' ');
  }

  /**
   * 정규식 테스트
   */
  static test(str: string, regex: RegExp | string): boolean {
    const pattern = typeof regex === 'string' ? new RegExp(regex) : regex;
    return pattern.test(str);
  }

  /**
   * 정규식 매칭
   */
  static match(str: string, regex: RegExp | string): RegExpMatchArray | null {
    const pattern = typeof regex === 'string' ? new RegExp(regex) : regex;
    return str.match(pattern as RegExp);
  }

  /**
   * 정규식 매칭 (모두)
   */
  static matchAll(str: string, regex: string): string[] {
    const pattern = new RegExp(regex, 'g');
    const matches = str.match(pattern);
    return matches || [];
  }

  /**
   * 정규식 분할
   */
  static splitRegex(str: string, regex: RegExp | string): string[] {
    const pattern = typeof regex === 'string' ? new RegExp(regex) : regex;
    return str.split(pattern);
  }

  /**
   * 정규식 바꾸기
   */
  static replaceRegex(str: string, regex: RegExp | string, replacement: string): string {
    const pattern = typeof regex === 'string' ? new RegExp(regex, 'g') : regex;
    return str.replace(pattern, replacement);
  }
}

/**
 * 정규식 헬퍼
 */
export class RegexUtils {
  /**
   * 이메일 검증
   */
  static isEmail(str: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(str);
  }

  /**
   * URL 검증
   */
  static isUrl(str: string): boolean {
    const regex = /^https?:\/\/.+/;
    return regex.test(str);
  }

  /**
   * IP 주소 검증
   */
  static isIpAddress(str: string): boolean {
    const regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    return regex.test(str);
  }

  /**
   * 숫자만
   */
  static isNumeric(str: string): boolean {
    return /^\d+$/.test(str);
  }

  /**
   * 알파벳만
   */
  static isAlpha(str: string): boolean {
    return /^[a-zA-Z]+$/.test(str);
  }

  /**
   * 영숫자만
   */
  static isAlphanumeric(str: string): boolean {
    return /^[a-zA-Z0-9]+$/.test(str);
  }

  /**
   * 금지된 문자 제거
   */
  static sanitize(str: string): string {
    return str.replace(/[<>\"'&]/g, '');
  }

  /**
   * HTML 이스케이프
   */
  static htmlEscape(str: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return str.replace(/[&<>"']/g, (c) => map[c]);
  }

  /**
   * CSV 파싱
   */
  static parseCSV(str: string): string[][] {
    const rows = str.trim().split('\n');
    return rows.map((row) => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < row.length; i++) {
        const char = row[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cells.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current);
      return cells;
    });
  }

  /**
   * 로그 파싱 (패턴: "LEVEL: message")
   */
  static parseLog(line: string): { level: string; message: string } | null {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (!match) return null;
    return { level: match[1], message: match[2] };
  }

  /**
   * 타임스탐프 추출
   */
  static extractTimestamp(line: string): string | null {
    const match = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    return match ? match[0] : null;
  }

  /**
   * IP 주소 추출
   */
  static extractIp(line: string): string | null {
    const match = line.match(/\b(\d{1,3}\.){3}\d{1,3}\b/);
    return match ? match[0] : null;
  }

  /**
   * JSON 유효성 확인
   */
  static isValidJson(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 테스트
 */
export function testStringUtils(): void {
  console.log('=== String Utilities Tests ===\n');

  // 1. 기본 문자열 함수
  console.log('1️⃣ Basic String Operations:');
  const text = 'hello world hello';
  console.log(`   split: ${StringUtils.split(text, ' ').join(',')}`);
  console.log(`   contains: ${StringUtils.contains(text, 'world')}`);
  console.log(`   replace: ${StringUtils.replace(text, 'hello', 'hi')}`);
  console.log(`   replaceAll: ${StringUtils.replaceAll(text, 'hello', 'hi')}`);

  // 2. 케이스 변환
  console.log('\n2️⃣ Case Conversion:');
  console.log(`   camelCase: ${StringUtils.toCamelCase('hello-world-test')}`);
  console.log(`   snake_case: ${StringUtils.toSnakeCase('helloWorldTest')}`);
  console.log(`   kebab-case: ${StringUtils.toKebabCase('helloWorldTest')}`);

  // 3. 정규식
  console.log('\n3️⃣ Regex Operations:');
  console.log(`   match: ${StringUtils.match('abc123def', /\d+/)}`);
  console.log(`   matchAll: ${StringUtils.matchAll('a1b2c3', '\\d')}`);
  console.log(`   isEmail: ${RegexUtils.isEmail('test@example.com')}`);

  // 4. 로그 파싱
  console.log('\n4️⃣ Log Parsing:');
  const logLine = 'ERROR: Database connection failed at 192.168.1.1';
  const parsed = RegexUtils.parseLog(logLine);
  console.log(`   parsed: ${JSON.stringify(parsed)}`);
  const ip = RegexUtils.extractIp(logLine);
  console.log(`   IP: ${ip}`);

  // 5. CSV 파싱
  console.log('\n5️⃣ CSV Parsing:');
  const csv = 'name,age,city\nAlice,30,NYC\nBob,25,LA';
  const rows = RegexUtils.parseCSV(csv);
  console.log(`   rows: ${rows.length}`);
  console.log(`   headers: ${rows[0].join(',')}`);

  console.log('\n✅ All string utils tests completed!');
}
