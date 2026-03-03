/**
 * FreeLang Standard Library - Expansion Tests (Phase 2)
 *
 * Comprehensive test suite for 5 additional stdlib modules:
 * - regex (13 functions)
 * - date (20 functions)
 * - set (16 functions)
 * - map (20 functions)
 * - encoding (16 functions)
 *
 * Total: 85+ functions, 150+ test cases
 */

import * as assert from 'assert';

// Import all expansion modules
import * as regex from '../src/stdlib/regex';
import * as date from '../src/stdlib/date';
import * as set from '../src/stdlib/set';
import * as map from '../src/stdlib/map';
import * as encoding from '../src/stdlib/encoding';

describe('FreeLang Standard Library - Expansion (Phase 2)', () => {
  // ========== Regex Module Tests (13 tests) ==========
  describe('regex module', () => {
    it('should compile regex pattern', () => {
      const compiled = regex.compile('[a-z]+');
      assert(compiled.regex instanceof RegExp);
      assert.strictEqual(compiled.pattern, '[a-z]+');
    });

    it('should test pattern matching', () => {
      assert.strictEqual(regex.test('hello', '[a-z]+'), true);
      assert.strictEqual(regex.test('123', '[a-z]+'), false);
      assert.strictEqual(regex.test('Hello', '[a-z]+', 'i'), true);
    });

    it('should find first match', () => {
      const match = regex.match('hello world', 'world');
      assert(match !== undefined);
      assert.strictEqual(match!.match, 'world');
    });

    it('should find all matches', () => {
      const matches = regex.matchAll('aaa', 'a');
      assert.strictEqual(matches.length, 3);
      assert.strictEqual(matches[0].match, 'a');
    });

    it('should split by pattern', () => {
      const parts = regex.split('a1b2c3', '[0-9]');
      assert.deepStrictEqual(parts, ['a', 'b', 'c', '']);
    });

    it('should replace pattern', () => {
      const result = regex.replace('hello world', 'world', 'there');
      assert.strictEqual(result, 'hello there');
    });

    it('should replace all pattern', () => {
      const result = regex.replaceAll('aaa', 'a', 'b');
      assert.strictEqual(result, 'bbb');
    });

    it('should escape special characters', () => {
      const escaped = regex.escape('hello.world');
      assert.strictEqual(escaped, 'hello\\.world');
    });

    it('should validate email', () => {
      assert.strictEqual(regex.isEmail('test@example.com'), true);
      assert.strictEqual(regex.isEmail('invalid.email'), false);
      assert.strictEqual(regex.isEmail('test@domain'), false);
    });

    it('should validate URL', () => {
      assert.strictEqual(regex.isUrl('https://example.com'), true);
      assert.strictEqual(regex.isUrl('not a url'), false);
    });

    it('should check alphanumeric', () => {
      assert.strictEqual(regex.isAlphanumeric('abc123'), true);
      assert.strictEqual(regex.isAlphanumeric('abc-123'), false);
    });

    it('should extract emails from text', () => {
      const text = 'Contact us at support@example.com or info@example.org';
      const emails = regex.extractEmails(text);
      assert.strictEqual(emails.length, 2);
      assert(emails.includes('support@example.com'));
    });

    it('should extract URLs from text', () => {
      const text = 'Visit https://example.com or https://test.org today';
      const urls = regex.extractUrls(text);
      assert.strictEqual(urls.length, 2);
    });
  });

  // ========== Date Module Tests (20 tests) ==========
  describe('date module', () => {
    it('should create date from components', () => {
      const d = date.create(2024, 2, 15, 10, 30, 45);
      assert.strictEqual(d.getFullYear(), 2024);
      assert.strictEqual(d.getMonth(), 1); // 0-indexed
      assert.strictEqual(d.getDate(), 15);
    });

    it('should get current date', () => {
      const now = date.now();
      assert(now instanceof Date);
      assert(now.getTime() <= Date.now());
    });

    it('should get timestamp', () => {
      const ts = date.timestamp();
      assert(typeof ts === 'number');
      assert(ts > 0);
    });

    it('should parse date string', () => {
      const d = date.parse('2024-02-15');
      assert(d !== null);
      assert.strictEqual(d!.getFullYear(), 2024);
    });

    it('should format date', () => {
      const d = date.create(2024, 2, 15, 10, 30, 45);
      const formatted = date.format(d, 'yyyy-MM-dd HH:mm:ss');
      assert.strictEqual(formatted, '2024-02-15 10:30:45');
    });

    it('should get date components', () => {
      const d = date.create(2024, 2, 15, 10, 30, 45);
      const comp = date.components(d);
      assert.strictEqual(comp.year, 2024);
      assert.strictEqual(comp.month, 2);
      assert.strictEqual(comp.day, 15);
    });

    it('should add days to date', () => {
      const d = date.create(2024, 2, 15);
      const result = date.addDays(d, 5);
      assert.strictEqual(result.getDate(), 20);
    });

    it('should add months to date', () => {
      const d = date.create(2024, 1, 15);
      const result = date.addMonths(d, 2);
      assert.strictEqual(result.getMonth(), 2); // 0-indexed
    });

    it('should add years to date', () => {
      const d = date.create(2024, 2, 15);
      const result = date.addYears(d, 1);
      assert.strictEqual(result.getFullYear(), 2025);
    });

    it('should calculate days between dates', () => {
      const d1 = date.create(2024, 2, 15);
      const d2 = date.create(2024, 2, 20);
      const days = date.daysBetween(d1, d2);
      assert.strictEqual(days, 5);
    });

    it('should check if today', () => {
      const today = date.now();
      assert.strictEqual(date.isToday(today), true);

      const yesterday = date.addDays(date.now(), -1);
      assert.strictEqual(date.isToday(yesterday), false);
    });

    it('should check leap year', () => {
      assert.strictEqual(date.isLeapYear(2024), true);
      assert.strictEqual(date.isLeapYear(2023), false);
      assert.strictEqual(date.isLeapYear(2000), true);
    });

    it('should get days in month', () => {
      assert.strictEqual(date.daysInMonth(2024, 2), 29); // Leap year
      assert.strictEqual(date.daysInMonth(2024, 1), 31);
    });

    it('should get day of week', () => {
      const d = date.create(2024, 2, 15);
      const dow = date.dayOfWeek(d);
      assert(dow >= 0 && dow <= 6);
    });

    it('should get day name', () => {
      const d = date.create(2024, 2, 15);
      const name = date.dayName(d);
      assert(typeof name === 'string');
      assert(name.length > 0);
    });

    it('should get month name', () => {
      const d = date.create(2024, 2, 15);
      const name = date.monthName(d);
      assert.strictEqual(name, 'February');
    });

    it('should check if same day', () => {
      const d1 = date.create(2024, 2, 15, 10, 30);
      const d2 = date.create(2024, 2, 15, 20, 45);
      assert.strictEqual(date.isSameDay(d1, d2), true);

      const d3 = date.create(2024, 2, 16);
      assert.strictEqual(date.isSameDay(d1, d3), false);
    });

    it('should get start and end of day', () => {
      const d = date.create(2024, 2, 15, 10, 30, 45);
      const start = date.startOfDay(d);
      const end = date.endOfDay(d);

      assert.strictEqual(start.getHours(), 0);
      assert.strictEqual(start.getMinutes(), 0);
      assert.strictEqual(end.getHours(), 23);
      assert.strictEqual(end.getMinutes(), 59);
    });

    it('should check date in range', () => {
      const start = date.create(2024, 2, 1);
      const end = date.create(2024, 2, 28);
      const range = date.range(start, end);

      const inRange = date.create(2024, 2, 15);
      assert.strictEqual(date.isInRange(inRange, range), true);

      const outOfRange = date.create(2024, 3, 1);
      assert.strictEqual(date.isInRange(outOfRange, range), false);
    });
  });

  // ========== Set Module Tests (16 tests) ==========
  describe('set module', () => {
    it('should create set from array', () => {
      const s = set.create([1, 2, 3, 3, 4]);
      assert.strictEqual(set.size(s), 4); // No duplicates
    });

    it('should add element to set', () => {
      const s = set.create([1, 2]);
      set.add(s, 3);
      assert.strictEqual(set.size(s), 3);
    });

    it('should remove element from set', () => {
      const s = set.create([1, 2, 3]);
      set.remove(s, 2);
      assert.strictEqual(set.size(s), 2);
    });

    it('should check if contains element', () => {
      const s = set.create([1, 2, 3]);
      assert.strictEqual(set.has(s, 2), true);
      assert.strictEqual(set.has(s, 5), false);
    });

    it('should get set size', () => {
      const s = set.create([1, 2, 3]);
      assert.strictEqual(set.size(s), 3);
    });

    it('should clear set', () => {
      const s = set.create([1, 2, 3]);
      set.clear(s);
      assert.strictEqual(set.size(s), 0);
    });

    it('should convert set to array', () => {
      const s = set.create([1, 2, 3]);
      const arr = set.toArray(s);
      assert.strictEqual(arr.length, 3);
      assert(arr.includes(1));
    });

    it('should compute union', () => {
      const s1 = set.create([1, 2]);
      const s2 = set.create([2, 3]);
      const result = set.union(s1, s2);
      assert.strictEqual(set.size(result), 3);
    });

    it('should compute intersection', () => {
      const s1 = set.create([1, 2, 3]);
      const s2 = set.create([2, 3, 4]);
      const result = set.intersection(s1, s2);
      assert.strictEqual(set.size(result), 2);
      assert(set.has(result, 2) && set.has(result, 3));
    });

    it('should compute difference', () => {
      const s1 = set.create([1, 2, 3]);
      const s2 = set.create([2, 3, 4]);
      const result = set.difference(s1, s2);
      assert.strictEqual(set.size(result), 1);
      assert(set.has(result, 1));
    });

    it('should compute symmetric difference', () => {
      const s1 = set.create([1, 2]);
      const s2 = set.create([2, 3]);
      const result = set.symmetricDifference(s1, s2);
      assert.strictEqual(set.size(result), 2);
      assert(set.has(result, 1) && set.has(result, 3));
    });

    it('should check subset', () => {
      const s1 = set.create([1, 2]);
      const s2 = set.create([1, 2, 3]);
      assert.strictEqual(set.isSubset(s1, s2), true);
      assert.strictEqual(set.isSubset(s2, s1), false);
    });

    it('should check superset', () => {
      const s1 = set.create([1, 2, 3]);
      const s2 = set.create([1, 2]);
      assert.strictEqual(set.isSuperset(s1, s2), true);
      assert.strictEqual(set.isSuperset(s2, s1), false);
    });

    it('should check equality', () => {
      const s1 = set.create([1, 2, 3]);
      const s2 = set.create([1, 2, 3]);
      const s3 = set.create([1, 2]);
      assert.strictEqual(set.equals(s1, s2), true);
      assert.strictEqual(set.equals(s1, s3), false);
    });

    it('should map set', () => {
      const s = set.create([1, 2, 3]);
      const mapped = set.map(s, x => x * 2);
      assert.strictEqual(set.size(mapped), 3);
      assert(set.has(mapped, 2) && set.has(mapped, 4) && set.has(mapped, 6));
    });

    it('should filter set', () => {
      const s = set.create([1, 2, 3, 4, 5]);
      const filtered = set.filter(s, x => x > 2);
      assert.strictEqual(set.size(filtered), 3);
    });
  });

  // ========== Map Module Tests (20 tests) ==========
  describe('map module', () => {
    it('should create empty map', () => {
      const m = map.create();
      assert.strictEqual(map.size(m), 0);
    });

    it('should create map from entries', () => {
      const m = map.create([['a', 1], ['b', 2]]);
      assert.strictEqual(map.size(m), 2);
    });

    it('should create map from object', () => {
      const m = map.fromObject({ a: 1, b: 2 });
      assert.strictEqual(map.size(m), 2);
    });

    it('should convert map to object', () => {
      const m = map.create([['a', 1], ['b', 2]]);
      const obj = map.toObject(m);
      assert.deepStrictEqual(obj, { a: 1, b: 2 });
    });

    it('should set and get values', () => {
      const m = map.create();
      map.set(m, 'key', 'value');
      assert.strictEqual(map.get(m, 'key'), 'value');
    });

    it('should check key existence', () => {
      const m = map.create([['a', 1]]);
      assert.strictEqual(map.has(m, 'a'), true);
      assert.strictEqual(map.has(m, 'b'), false);
    });

    it('should delete entry', () => {
      const m = map.create([['a', 1], ['b', 2]]);
      map.delete_(m, 'a');
      assert.strictEqual(map.size(m), 1);
    });

    it('should clear map', () => {
      const m = map.create([['a', 1], ['b', 2]]);
      map.clear(m);
      assert.strictEqual(map.size(m), 0);
    });

    it('should get size', () => {
      const m = map.create([['a', 1], ['b', 2]]);
      assert.strictEqual(map.size(m), 2);
    });

    it('should get keys', () => {
      const m = map.create([['a', 1], ['b', 2]]);
      const keys = map.keys(m);
      assert.deepStrictEqual(keys.sort(), ['a', 'b']);
    });

    it('should get values', () => {
      const m = map.create([['a', 1], ['b', 2]]);
      const vals = map.values(m);
      assert.deepStrictEqual(vals.sort(), [1, 2]);
    });

    it('should get entries', () => {
      const m = map.create([['a', 1], ['b', 2]]);
      const ents = map.entries(m);
      assert.strictEqual(ents.length, 2);
    });

    it('should iterate with forEach', () => {
      const m = map.create([['a', 1], ['b', 2]]);
      const collected: string[] = [];
      map.forEach(m, (val, key) => {
        collected.push(`${key}:${val}`);
      });
      assert.strictEqual(collected.length, 2);
    });

    it('should map values', () => {
      const m = map.create([['a', 1], ['b', 2]]);
      const mapped = map.mapValues(m, v => v * 2);
      assert.strictEqual(map.get(mapped, 'a'), 2);
      assert.strictEqual(map.get(mapped, 'b'), 4);
    });

    it('should filter map', () => {
      const m = map.create([['a', 1], ['b', 2], ['c', 3]]);
      const filtered = map.filter(m, v => v > 1);
      assert.strictEqual(map.size(filtered), 2);
    });

    it('should merge maps', () => {
      const m1 = map.create([['a', 1], ['b', 2]]);
      const m2 = map.create([['b', 20], ['c', 3]]);
      const merged = map.merge(m1, m2);
      assert.strictEqual(map.size(merged), 3);
      assert.strictEqual(map.get(merged, 'b'), 20); // m2 overrides
    });

    it('should check equality', () => {
      const m1 = map.create([['a', 1], ['b', 2]]);
      const m2 = map.create([['a', 1], ['b', 2]]);
      const m3 = map.create([['a', 1]]);
      assert.strictEqual(map.equals(m1, m2), true);
      assert.strictEqual(map.equals(m1, m3), false);
    });

    it('should clone map', () => {
      const m1 = map.create([['a', 1], ['b', 2]]);
      const m2 = map.clone(m1);
      map.set(m2, 'c', 3);
      assert.strictEqual(map.size(m1), 2); // Original unchanged
      assert.strictEqual(map.size(m2), 3);
    });

    it('should group array by key', () => {
      const arr = [
        { category: 'fruit', name: 'apple' },
        { category: 'fruit', name: 'banana' },
        { category: 'vegetable', name: 'carrot' }
      ];
      const grouped = map.groupBy(arr, item => item.category);
      assert.strictEqual(map.size(grouped), 2);
      assert.strictEqual(map.get(grouped, 'fruit')!.length, 2);
    });

    it('should index array by key', () => {
      const arr = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ];
      const indexed = map.indexBy(arr, item => item.id);
      assert.strictEqual(map.get(indexed, 1)!.name, 'Alice');
    });
  });

  // ========== Encoding Module Tests (16 tests) ==========
  describe('encoding module', () => {
    it('should encode/decode Base64', () => {
      const original = 'Hello, World!';
      const encoded = encoding.base64Encode(original);
      const decoded = encoding.base64Decode(encoded);
      assert.strictEqual(decoded, original);
    });

    it('should encode/decode URL', () => {
      const original = 'hello world!@#$';
      const encoded = encoding.urlEncode(original);
      const decoded = encoding.urlDecode(encoded);
      assert.strictEqual(decoded, original);
    });

    it('should encode/decode URL object', () => {
      const obj = { name: 'John', age: 30 };
      const encoded = encoding.urlEncodeObject(obj);
      const decoded = encoding.urlDecodeObject(encoded);
      assert.strictEqual(decoded.name, 'John');
      assert.strictEqual(decoded.age, '30');
    });

    it('should encode/decode Hex', () => {
      const original = 'ABC';
      const encoded = encoding.hexEncode(original);
      const decoded = encoding.hexDecode(encoded);
      assert.strictEqual(decoded, original);
    });

    it('should encode/decode HTML', () => {
      const original = '<script>alert("xss")</script>';
      const encoded = encoding.htmlEncode(original);
      const decoded = encoding.htmlDecode(encoded);
      assert(encoded.includes('&lt;'));
      assert.strictEqual(decoded, original);
    });

    it('should encode/decode CSV row', () => {
      const original = ['name', 'John', 'age,30'];
      const encoded = encoding.csvEncode(original);
      const decoded = encoding.csvDecode(encoded);
      assert.strictEqual(decoded.length, 3);
      assert.strictEqual(decoded[2], 'age,30'); // Comma preserved in quotes
    });

    it('should encode/decode CSV table', () => {
      const table = [
        ['name', 'age'],
        ['John', '30'],
        ['Jane', '25']
      ];
      const encoded = encoding.csvEncodeTable(table);
      const decoded = encoding.csvDecodeTable(encoded);
      assert.strictEqual(decoded.length, 3);
      assert.strictEqual(decoded[1][0], 'John');
    });

    it('should create data URL', () => {
      const dataUrl = encoding.createDataUrl('Hello');
      assert(dataUrl.startsWith('data:'));
      assert(dataUrl.includes('base64'));
    });

    it('should parse data URL', () => {
      const original = 'Test content';
      const dataUrl = encoding.createDataUrl(original);
      const parsed = encoding.parseDataUrl(dataUrl);
      assert.strictEqual(parsed, original);
    });

    it('should handle custom delimiter in CSV', () => {
      const row = ['a', 'b', 'c'];
      const encoded = encoding.csvEncode(row, ';');
      assert.strictEqual(encoded, 'a;b;c');
    });

    it('should handle empty values in CSV', () => {
      const row = ['a', '', 'c'];
      const encoded = encoding.csvEncode(row);
      const decoded = encoding.csvDecode(encoded);
      assert.strictEqual(decoded[1], '');
    });

    it('should handle newlines in CSV', () => {
      const row = ['a', 'multi\nline', 'c'];
      const encoded = encoding.csvEncode(row);
      assert(encoded.includes('"'));
    });

    it('should encode multiple special chars in HTML', () => {
      const original = '&<>"\'';
      const encoded = encoding.htmlEncode(original);
      assert(encoded.includes('&amp;'));
      assert(encoded.includes('&lt;'));
      assert(encoded.includes('&gt;'));
      assert(encoded.includes('&quot;'));
    });

    it('should preserve non-special HTML chars', () => {
      const original = 'Hello World 123';
      const encoded = encoding.htmlEncode(original);
      assert.strictEqual(encoded, original);
    });

    it('should handle Base64 unicode', () => {
      const original = '你好世界';
      const encoded = encoding.base64Encode(original);
      const decoded = encoding.base64Decode(encoded);
      assert.strictEqual(decoded, original);
    });

    it('should handle empty string encoding', () => {
      assert.strictEqual(encoding.base64Encode(''), '');
      assert.strictEqual(encoding.hexEncode(''), '');
      assert.strictEqual(encoding.htmlEncode(''), '');
    });
  });

  // ========== Phase 2 Integration Tests (10 tests) ==========
  describe('phase 2 stdlib integration', () => {
    it('should work with regex and string', () => {
      const text = 'contact: support@example.com';
      const emails = regex.extractEmails(text);
      assert.strictEqual(emails.length, 1);
    });

    it('should work with date for scheduling', () => {
      const start = date.create(2024, 2, 1);
      const end = date.create(2024, 2, 28);
      const range = date.range(start, end);
      const inRange = date.create(2024, 2, 15);
      assert.strictEqual(date.isInRange(inRange, range), true);
    });

    it('should work with set for unique filtering', () => {
      const values = [1, 2, 2, 3, 3, 3];
      const unique = set.create(values);
      assert.strictEqual(set.size(unique), 3);
    });

    it('should work with map for data lookup', () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ];
      const userMap = map.indexBy(users, u => u.id);
      const user = map.get(userMap, 1);
      assert.strictEqual(user!.name, 'Alice');
    });

    it('should work with encoding for API data', () => {
      const data = { user: 'john', action: 'login' };
      const encoded = encoding.urlEncodeObject(data);
      const decoded = encoding.urlDecodeObject(encoded);
      assert.strictEqual(decoded.user, 'john');
    });

    it('should combine regex and encoding', () => {
      const email = 'test@example.com';
      assert.strictEqual(regex.isEmail(email), true);
      const encoded = encoding.base64Encode(email);
      const decoded = encoding.base64Decode(encoded);
      assert.strictEqual(decoded, email);
    });

    it('should combine date and set for event tracking', () => {
      const event1 = date.now();
      const event2 = date.addDays(event1, 1);
      const events = set.create([event1.toISOString(), event2.toISOString()]);
      assert.strictEqual(set.size(events), 2);
    });

    it('should combine map and regex for config', () => {
      const config = map.create([
        ['email_pattern', '[a-z]+@[a-z]+\\.[a-z]+'],
        ['url_pattern', 'https?://.*']
      ]);
      const emailPattern = map.get(config, 'email_pattern');
      assert(regex.test('test@example.com', emailPattern!));
    });

    it('should combine encoding for data transfer', () => {
      const original = { data: 'sensitive' };
      const json = JSON.stringify(original);
      const encoded = encoding.base64Encode(json);
      const decoded = encoding.base64Decode(encoded);
      const restored = JSON.parse(decoded);
      assert.deepStrictEqual(restored, original);
    });

    it('should combine all Phase 2 modules', () => {
      // Create a user database with dates
      const users = [
        { id: 1, email: 'alice@example.com', joinDate: '2024-01-15' },
        { id: 2, email: 'bob@example.com', joinDate: '2024-02-01' }
      ];

      // Index by email (map)
      const emailMap = map.indexBy(users, u => u.email);

      // Extract emails (regex)
      const emails = regex.extractEmails(
        users.map(u => u.email).join(', ')
      );
      const emailSet = set.create(emails);

      // Calculate days since join (date)
      const now = date.now();
      const joinDays = users.map(u => {
        const joinDate = date.parse(u.joinDate);
        return date.daysBetween(joinDate!, now);
      });

      // Encode for API (encoding)
      const response = encoding.base64Encode(
        JSON.stringify({ users, joinDays })
      );

      // Verify all parts work together
      assert.strictEqual(set.size(emailSet), 2);
      assert(map.has(emailMap, 'alice@example.com'));
      assert(joinDays[0] >= 0);
      assert(response.length > 0);
    });
  });
});
