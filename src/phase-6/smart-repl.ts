/**
 * Phase 6.2 Week 2: SmartREPL
 *
 * Interactive REPL with:
 * - Instant code execution (< 1ms)
 * - Partial code support (auto-stub generation)
 * - Real-time type inference
 * - Performance metrics (time, memory, type)
 * - Smart error handling
 * - Phase 8: Struct support
 */

import { structManager, StructDefinition } from '../phase-8/struct-system';
import { indexManager } from '../phase-8/indexing-system';
import { HTTPServer, HTTPClient, SimpleRouter } from '../phase-9/http-server';
import { AsyncUtils, Spawn, AsyncChain } from '../phase-9/async-concurrency';
import { MemoryMonitor, PerformanceProfiler } from '../phase-9/memory-monitor';
import { WebProxy, LoadBalancer } from '../phase-9/web-proxy';
import { StringUtils, RegexUtils } from '../phase-10/string-utils';
import { FileIO } from '../phase-10/file-io';
import { ThreadManager, ThreadPool, Mutex, Channel, parallelMap, parallelFilter } from '../phase-10/threading';
import { HashMap, HashSet, Queue, Stack, PriorityQueue } from '../phase-10/collections';
import { MathUtils, MathConstants, Random, Statistics } from '../phase-11/math-foundation';

/**
 * 내부 실행 결과
 */
interface InternalResult {
  success: boolean;
  value: any;
  error?: string;
  warnings: string[];
  partial: boolean;
}

/**
 * 실행 결과
 */
export interface ExecutionResult {
  success: boolean;
  result: any;
  executionTime: number;      // milliseconds
  memory: number;             // bytes (estimated)
  type: string;               // inferred type
  error?: string;
  warnings: string[];
  metadata: {
    linesExecuted: number;
    statementsExecuted: number;
    partial: boolean;         // 부분 실행 여부
  };
}

/**
 * 실행 환경
 */
export interface ExecutionContext {
  variables: Map<string, any>;
  functions: Map<string, Function>;
  globals: any;
}

/**
 * SmartREPL: 즉시 실행 인터랙티브 환경
 */
export class SmartREPL {
  private context: ExecutionContext;
  private history: Array<{ code: string; result: ExecutionResult }> = [];
  private startTime: number = 0;
  private startMemory: number = 0;

  constructor() {
    this.context = {
      variables: new Map(),
      functions: new Map(),
      globals: {
        // ==================== 배열 함수 ====================
        sum: (arr: number[]) => arr.reduce((a: number, b: number) => a + b, 0),
        avg: (arr: number[]) => arr.reduce((a: number, b: number) => a + b, 0) / arr.length,
        min: (arr: number[]) => Math.min(...arr),
        max: (arr: number[]) => Math.max(...arr),
        len: (arr: any[]) => arr.length,
        map: (arr: any[], fn: (value: any) => any) => arr.map(fn),
        filter: (arr: any[], fn: (value: any) => boolean) => arr.filter(fn),
        reduce: (arr: any[], init: any, fn: (acc: any, val: any) => any) =>
          arr.reduce(fn, init),
        fold: (arr: any[], init: any, fn: (acc: any, val: any) => any) =>
          arr.reduce(fn, init),
        first: (arr: any[]) => arr[0],
        last: (arr: any[]) => arr[arr.length - 1],
        slice: (arr: any[], start: number, end?: number) => arr.slice(start, end),
        concat: (arr: any[], ...items: any[]) => arr.concat(...items),
        reverse: (arr: any[]) => [...arr].reverse(),
        sort: (arr: any[], fn?: (a: any, b: any) => number) =>
          fn ? [...arr].sort(fn) : [...arr].sort(),
        unique: (arr: any[]) => [...new Set(arr)],
        flatten: (arr: any[], depth: number = 1) => {
          const flat = (a: any[], d: number): any[] =>
            d <= 0 ? a : a.reduce((acc, val) => acc.concat(Array.isArray(val) ? flat(val, d - 1) : val), []);
          return flat(arr, depth);
        },
        join: (arr: any[], sep: string = ',') => arr.join(sep),

        // ==================== 수학 함수 ====================
        abs: (n: number) => Math.abs(n),
        sqrt: (n: number) => Math.sqrt(n),
        pow: (base: number, exp: number) => Math.pow(base, exp),
        round: (n: number, decimals: number = 0) =>
          Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals),
        floor: (n: number) => Math.floor(n),
        ceil: (n: number) => Math.ceil(n),
        sign: (n: number) => Math.sign(n),

        // ==================== 문자열 함수 ====================
        toUpperCase: (s: string) => s.toUpperCase(),
        toLowerCase: (s: string) => s.toLowerCase(),
        split: (s: string, sep: string = '') => s.split(sep),
        trim: (s: string) => s.trim(),
        substring: (s: string, start: number, end?: number) => s.substring(start, end),
        includes: (s: string, search: string) => s.includes(search),
        startsWith: (s: string, prefix: string) => s.startsWith(prefix),
        endsWith: (s: string, suffix: string) => s.endsWith(suffix),
        replace: (s: string, search: string, replace: string) => s.replace(new RegExp(search, 'g'), replace),

        // ==================== 객체/맵 함수 ====================
        keys: (obj: any) => Object.keys(obj),
        values: (obj: any) => Object.values(obj),
        entries: (obj: any) => Object.entries(obj),

        // ==================== 타입 함수 ====================
        typeof: (v: any) => typeof v,
        isArray: (v: any) => Array.isArray(v),
        isNumber: (v: any) => typeof v === 'number',
        isString: (v: any) => typeof v === 'string',
        isObject: (v: any) => typeof v === 'object' && v !== null,
        isNull: (v: any) => v === null,
        isUndefined: (v: any) => v === undefined,

        // ==================== 범위/생성 함수 ====================
        range: (start: number, end: number, step: number = 1) =>
          Array.from(
            { length: Math.ceil((end - start) / step) },
            (_, i) => start + i * step
          ),
        repeat: (value: any, count: number) =>
          Array.from({ length: count }, () => value),
        times: (count: number, fn: (i: number) => any) =>
          Array.from({ length: count }, (_, i) => fn(i)),

        // ==================== 통계 함수 ====================
        median: (arr: number[]) => {
          const sorted = [...arr].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        },
        variance: (arr: number[]) => {
          const mean = arr.reduce((a, b) => a + b) / arr.length;
          return arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
        },
        stdDev: (arr: number[]) => {
          const mean = arr.reduce((a, b) => a + b) / arr.length;
          const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
          return Math.sqrt(variance);
        },

        // ==================== Iterator 고급 함수 ====================
        any: (arr: any[], fn: (value: any) => boolean) => arr.some(fn),
        all: (arr: any[], fn: (value: any) => boolean) => arr.every(fn),
        find: (arr: any[], fn: (value: any) => boolean) => arr.find(fn),
        findIndex: (arr: any[], fn: (value: any) => boolean) => arr.findIndex(fn),
        enumerate: (arr: any[]) => arr.map((v, i) => [i, v]),
        zip: (...arrs: any[][]) => {
          const len = Math.min(...arrs.map(a => a.length));
          return Array.from({ length: len }, (_, i) => arrs.map(a => a[i]));
        },
        chunk: (arr: any[], size: number) => {
          const chunks: any[] = [];
          for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
          }
          return chunks;
        },
        partition: (arr: any[], fn: (value: any) => boolean) => {
          const yes: any[] = [], no: any[] = [];
          for (const item of arr) {
            (fn(item) ? yes : no).push(item);
          }
          return [yes, no];
        },
        groupBy: (arr: any[], fn: (value: any) => any) => {
          const groups: any = {};
          for (const item of arr) {
            const key = fn(item);
            (groups[key] = groups[key] || []).push(item);
          }
          return groups;
        },
        take: (arr: any[], n: number) => arr.slice(0, n),
        skip: (arr: any[], n: number) => arr.slice(n),
        compact: (arr: any[]) => arr.filter(v => v != null && v !== false && v !== 0 && v !== ''),
        contains: (arr: any[], item: any) => arr.includes(item),
        indexOf: (arr: any[], item: any) => arr.indexOf(item),
        lastIndexOf: (arr: any[], item: any) => arr.lastIndexOf(item),
        product: (arr: number[]) => arr.reduce((a, b) => a * b, 1),
        nth: (arr: any[], n: number) => arr[n],
        distinct: (arr: any[]) => [...new Set(arr)],

        // ==================== String 고급 함수 ====================
        chars: (s: string) => s.split(''),
        lines: (s: string) => s.split('\n'),
        words: (s: string) => s.trim().split(/\s+/),
        capitalize: (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
        padStart: (s: string, width: number, fill: string = ' ') => s.padStart(width, fill),
        padEnd: (s: string, width: number, fill: string = ' ') => s.padEnd(width, fill),
        reverseStr: (s: string) => s.split('').reverse().join(''),
        toNumber: (s: string) => Number(s),
        toPascalCase: (s: string) => s.split(/[-_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''),
        toSnakeCase: (s: string) => s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''),
        toCamelCase: (s: string) => s.split(/[-_\s]+/).map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(''),
        toKebabCase: (s: string) => s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''),
        truncate: (s: string, len: number, suffix: string = '...') => s.length > len ? s.slice(0, len - suffix.length) + suffix : s,

        // ==================== Math 고급 함수 ====================
        sin: (x: number) => Math.sin(x),
        cos: (x: number) => Math.cos(x),
        tan: (x: number) => Math.tan(x),
        asin: (x: number) => Math.asin(x),
        acos: (x: number) => Math.acos(x),
        atan: (x: number) => Math.atan(x),
        exp: (x: number) => Math.exp(x),
        logBase: (x: number, base: number = Math.E) => Math.log(x) / Math.log(base),
        log10: (x: number) => Math.log10(x),
        log2: (x: number) => Math.log2(x),
        ln: (x: number) => Math.log(x),
        random: (min: number = 0, max: number = 1) => Math.random() * (max - min) + min,
        randomInt: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
        gcd: (a: number, b: number): number => b === 0 ? a : (exports.gcd || module.exports?.gcd)(b, a % b),
        lcm: (a: number, b: number) => Math.abs(a * b) / ((exports.gcd || module.exports?.gcd)(a, b) || 1),
        clamp: (x: number, min: number, max: number) => Math.max(min, Math.min(max, x)),

        // ==================== Object 고급 함수 ====================
        assign: (...objs: any[]) => Object.assign({}, ...objs),
        isEmpty: (obj: any) => {
          if (Array.isArray(obj)) return obj.length === 0;
          if (typeof obj === 'object' && obj !== null) return Object.keys(obj).length === 0;
          if (typeof obj === 'string') return obj.length === 0;
          return !obj;
        },
        isEqual: (a: any, b: any): boolean => {
          if (a === b) return true;
          if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
          const keysA = Object.keys(a), keysB = Object.keys(b);
          if (keysA.length !== keysB.length) return false;
          return keysA.every(key => (exports.isEqual || module.exports?.isEqual)(a[key], b[key]));
        },
        clone: (obj: any) => Array.isArray(obj) ? [...obj] : { ...obj },
        deepClone: (obj: any): any => {
          if (obj === null || typeof obj !== 'object') return obj;
          if (Array.isArray(obj)) return obj.map((v: any) => (exports.deepClone || module.exports?.deepClone)(v));
          const cloned: any = {};
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              cloned[key] = (exports.deepClone || module.exports?.deepClone)(obj[key]);
            }
          }
          return cloned;
        },
        fromEntries: (entries: any[]) => {
          const obj: any = {};
          for (const [k, v] of entries) obj[k] = v;
          return obj;
        },
        pick: (obj: any, keys: string[]) => {
          const result: any = {};
          for (const key of keys) {
            if (key in obj) result[key] = obj[key];
          }
          return result;
        },
        omit: (obj: any, keys: string[]) => {
          const result: any = {};
          for (const key in obj) {
            if (!keys.includes(key)) result[key] = obj[key];
          }
          return result;
        },
        invert: (obj: any) => {
          const result: any = {};
          for (const key in obj) result[obj[key]] = key;
          return result;
        },

        // ==================== 함수형 프로그래밍 ====================
        pipe: (...fns: any[]) => (value: any) => fns.reduce((acc, fn) => fn(acc), value),
        compose: (...fns: any[]) => (value: any) => fns.reduceRight((acc, fn) => fn(acc), value),
        partial: (fn: Function, ...args: any[]) => (...moreArgs: any[]) => fn(...args, ...moreArgs),
        once: (fn: Function) => {
          let called = false, result: any;
          return (...args: any[]) => {
            if (!called) {
              called = true;
              result = fn(...args);
            }
            return result;
          };
        },

        // ==================== Struct 함수 (Phase 8) ====================
        create_struct: (name: string, fields: Array<{ name: string; type: string; optional?: boolean; default?: any }>) => {
          structManager.defineStruct({
            name,
            fields,
          });
          return { success: true, message: `Struct '${name}' created` };
        },

        new_instance: (name: string, values: Record<string, any>) => {
          try {
            return structManager.createInstance(name, values);
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        get_field: (instance: any, fieldName: string) => {
          try {
            if (instance._type !== 'struct') {
              throw new Error('Not a struct instance');
            }
            return structManager.getField(instance, fieldName);
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        set_field: (instance: any, fieldName: string, value: any) => {
          try {
            if (instance._type !== 'struct') {
              throw new Error('Not a struct instance');
            }
            return structManager.setField(instance, fieldName, value);
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        struct_info: (name: string) => {
          try {
            const info = structManager.getStructInfo(name);
            if (!info) {
              throw new Error(`Struct '${name}' not found`);
            }
            return info;
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        list_structs: () => {
          return structManager.listStructs();
        },

        struct_access: (instance: any, fieldName: string) => {
          // Shorthand: instance.fieldName
          try {
            if (instance._type !== 'struct') {
              throw new Error('Not a struct instance');
            }
            return structManager.getField(instance, fieldName);
          } catch (error) {
            return undefined;
          }
        },

        // ==================== 인덱싱 함수 (Phase 8.2) ====================
        create_index: (structName: string, fieldName: string, isPrimary: boolean = false) => {
          try {
            indexManager.createIndex(structName, fieldName, isPrimary);
            return { success: true, message: `Index '${structName}.${fieldName}' created (${isPrimary ? 'primary' : 'secondary'})` };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        add_to_index: (structName: string, fieldName: string, key: any, value: any) => {
          try {
            indexManager.addToIndex(structName, fieldName, key, value);
            return { success: true };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        search_by_index: (structName: string, fieldName: string, key: any) => {
          try {
            return indexManager.searchByIndex(structName, fieldName, key);
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        range_search: (structName: string, fieldName: string, minKey: any, maxKey: any) => {
          try {
            return indexManager.rangeSearch(structName, fieldName, minKey, maxKey);
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        get_all_sorted: (structName: string, fieldName: string) => {
          try {
            return indexManager.getAllSorted(structName, fieldName);
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        list_indexes: () => {
          try {
            return indexManager.listIndexes();
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        drop_index: (structName: string, fieldName: string) => {
          try {
            indexManager.dropIndex(structName, fieldName);
            return { success: true, message: `Index '${structName}.${fieldName}' dropped` };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        get_index_stats: (structName: string, fieldName: string) => {
          try {
            return indexManager.getStats(structName, fieldName);
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        // ==================== HTTP & 프록시 함수 (Phase 9) ====================
        create_server: (port: number) => {
          try {
            const server = new HTTPServer(port);
            (this.context.variables as Map<string, any>).set(`__server_${port}`, server);
            return { success: true, message: `Server created on port ${port}` };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        start_server: async (port: number) => {
          try {
            const server = (this.context.variables as Map<string, any>).get(`__server_${port}`);
            if (!server) throw new Error(`Server on port ${port} not found`);
            await server.start();
            return { success: true, message: 'Server started' };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        register_route: (port: number, path: string, handler: (req: any) => any) => {
          try {
            const server = (this.context.variables as Map<string, any>).get(`__server_${port}`);
            if (!server) throw new Error(`Server on port ${port} not found`);
            server.route(path, handler);
            return { success: true, message: `Route ${path} registered` };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        http_get: async (url: string) => {
          try {
            return await HTTPClient.get(url);
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        http_post: async (url: string, body: string) => {
          try {
            return await HTTPClient.post(url, body);
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        http_json_get: async (url: string) => {
          try {
            return await HTTPClient.getJSON(url);
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        // ==================== 비동기 & 병렬 함수 (Phase 9) ====================
        async_delay: (ms: number) => {
          return AsyncUtils.delay(ms);
        },

        async_retry: async (fn: () => Promise<any>, maxRetries: number = 3) => {
          try {
            return await AsyncUtils.retry(fn, maxRetries, 1000);
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        spawn_task: async (fn: () => Promise<any>) => {
          return Spawn.run(fn);
        },

        spawn_parallel: async (tasks: Array<() => Promise<any>>, concurrency: number = 5) => {
          return Spawn.runMany(tasks, concurrency);
        },

        spawn_map: async (
          items: any[],
          fn: (item: any) => Promise<any>,
          concurrency: number = 5
        ) => {
          return Spawn.map(items, fn, concurrency);
        },

        async_timeout: async (promise: Promise<any>, ms: number) => {
          try {
            return await AsyncUtils.withTimeout(promise, ms);
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        // ==================== 메모리 & 성능 함수 (Phase 9) ====================
        memory_usage: () => {
          const usage = MemoryMonitor.getMemoryUsage();
          return {
            rss: MemoryMonitor.formatBytes(usage.rss),
            heapTotal: MemoryMonitor.formatBytes(usage.heapTotal),
            heapUsed: MemoryMonitor.formatBytes(usage.heapUsed),
            external: MemoryMonitor.formatBytes(usage.external),
          };
        },

        memory_report: () => {
          return MemoryMonitor.getReport();
        },

        memory_formatted: () => {
          const usage = MemoryMonitor.getMemoryUsage();
          return {
            rss: MemoryMonitor.formatBytes(usage.rss),
            heap: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB / ${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
            percent: `${((usage.heapUsed / usage.heapTotal) * 100).toFixed(1)}%`,
          };
        },

        performance_start: (label: string) => {
          const profiler = (this.context.variables as Map<string, any>).get('__profiler') || new PerformanceProfiler();
          (this.context.variables as Map<string, any>).set('__profiler', profiler);
          profiler.start(label);
          return { success: true };
        },

        performance_end: (label: string) => {
          const profiler = (this.context.variables as Map<string, any>).get('__profiler');
          if (!profiler) return { success: false, error: 'Profiler not initialized' };
          const duration = profiler.end(label);
          return { duration: `${duration.toFixed(2)}ms` };
        },

        performance_stats: (label: string) => {
          const profiler = (this.context.variables as Map<string, any>).get('__profiler');
          if (!profiler) return null;
          return profiler.getStats(label);
        },

        // ==================== 웹 프록시 함수 (Phase 9) ====================
        create_proxy: (port: number, targets: string[]) => {
          try {
            const proxy = new WebProxy({
              port,
              targets,
              cacheEnabled: true,
              cacheTTL: 60000,
              timeout: 5000,
              maxRetries: 3,
            });
            (this.context.variables as Map<string, any>).set(`__proxy_${port}`, proxy);
            return { success: true, message: `Proxy created on port ${port}` };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        start_proxy: async (port: number) => {
          try {
            const proxy = (this.context.variables as Map<string, any>).get(`__proxy_${port}`);
            if (!proxy) throw new Error(`Proxy on port ${port} not found`);
            await proxy.start();
            return { success: true, message: 'Proxy started' };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        proxy_stats: (port: number) => {
          try {
            const proxy = (this.context.variables as Map<string, any>).get(`__proxy_${port}`);
            if (!proxy) throw new Error(`Proxy on port ${port} not found`);
            return proxy.getStats();
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        create_router: () => {
          const router = new SimpleRouter();
          const routerId = `__router_${Date.now()}`;
          (this.context.variables as Map<string, any>).set(routerId, router);
          return { success: true, routerId };
        },

        router_get: (routerId: string, path: string, handler: (req: any) => any) => {
          try {
            const router = (this.context.variables as Map<string, any>).get(routerId);
            if (!router) throw new Error('Router not found');
            router.get(path, handler);
            return { success: true };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        router_post: (routerId: string, path: string, handler: (req: any) => any) => {
          try {
            const router = (this.context.variables as Map<string, any>).get(routerId);
            if (!router) throw new Error('Router not found');
            router.post(path, handler);
            return { success: true };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },

        // ==================== Phase 10: String Utils ====================
        str_split: (str: string, sep: string) => StringUtils.split(str, sep),
        str_join: (arr: string[], sep: string = '') => StringUtils.join(arr, sep),
        str_trim: (str: string) => StringUtils.trim(str),
        str_contains: (str: string, substr: string) => StringUtils.contains(str, substr),
        str_startsWith: (str: string, prefix: string) => StringUtils.startsWith(str, prefix),
        str_endsWith: (str: string, suffix: string) => StringUtils.endsWith(str, suffix),
        str_indexOf: (str: string, substr: string) => StringUtils.indexOf(str, substr),
        str_replace: (str: string, from: string, to: string) => StringUtils.replace(str, from, to),
        str_replaceAll: (str: string, from: string, to: string) => StringUtils.replaceAll(str, from, to),
        str_toUpperCase: (str: string) => StringUtils.toUpperCase(str),
        str_toLowerCase: (str: string) => StringUtils.toLowerCase(str),
        str_length: (str: string) => StringUtils.getLength(str),
        str_isEmpty: (str: string) => StringUtils.isEmpty(str),
        str_toCamelCase: (str: string) => StringUtils.toCamelCase(str),
        str_toSnakeCase: (str: string) => StringUtils.toSnakeCase(str),
        str_toKebabCase: (str: string) => StringUtils.toKebabCase(str),
        str_reverse: (str: string) => StringUtils.reverse(str),
        str_repeat: (str: string, count: number) => StringUtils.repeat(str, count),

        // ==================== Phase 10: Regex Utils ====================
        regex_isEmail: (str: string) => RegexUtils.isEmail(str),
        regex_isUrl: (str: string) => RegexUtils.isUrl(str),
        regex_isIp: (str: string) => RegexUtils.isIpAddress(str),
        regex_isNumeric: (str: string) => RegexUtils.isNumeric(str),
        regex_isAlpha: (str: string) => RegexUtils.isAlpha(str),
        regex_isAlphanumeric: (str: string) => RegexUtils.isAlphanumeric(str),
        regex_sanitize: (str: string) => RegexUtils.sanitize(str),
        regex_htmlEscape: (str: string) => RegexUtils.htmlEscape(str),
        regex_parseCSV: (str: string) => RegexUtils.parseCSV(str),
        regex_parseLog: (line: string) => RegexUtils.parseLog(line),
        regex_extractTimestamp: (line: string) => RegexUtils.extractTimestamp(line),
        regex_extractIp: (line: string) => RegexUtils.extractIp(line),
        regex_isValidJson: (str: string) => RegexUtils.isValidJson(str),

        // ==================== Phase 10: File I/O ====================
        file_read: (path: string) => {
          const io = new FileIO();
          return io.readFile(path);
        },
        file_write: (path: string, content: string) => {
          const io = new FileIO();
          io.writeFile(path, content);
          return { success: true };
        },
        file_append: (path: string, content: string) => {
          const io = new FileIO();
          io.appendFile(path, content);
          return { success: true };
        },
        file_exists: (path: string) => {
          const io = new FileIO();
          return io.exists(path);
        },
        file_stat: (path: string) => {
          const io = new FileIO();
          return io.stat(path);
        },
        file_delete: (path: string) => {
          const io = new FileIO();
          io.deleteFile(path);
          return { success: true };
        },
        file_copy: (from: string, to: string) => {
          const io = new FileIO();
          io.copyFile(from, to);
          return { success: true };
        },
        file_move: (from: string, to: string) => {
          const io = new FileIO();
          io.moveFile(from, to);
          return { success: true };
        },
        file_list: (dir: string) => {
          const io = new FileIO();
          return io.listFiles(dir);
        },
        file_listRecursive: (dir: string) => {
          const io = new FileIO();
          return io.listFilesRecursive(dir);
        },
        file_mkdir: (dir: string) => {
          const io = new FileIO();
          io.createDirectory(dir);
          return { success: true };
        },
        file_readLines: (path: string) => {
          const io = new FileIO();
          return io.readLines(path);
        },

        // ==================== Phase 10: Threading ====================
        spawn_thread: async (fn: () => Promise<any>) => {
          const manager = new ThreadManager();
          const thread = await manager.spawnThread(fn);
          (this.context.variables as Map<string, any>).set(`__thread_${thread.id}`, thread);
          return { id: thread.id, state: thread.state };
        },
        spawn_join: async (threadId: string) => {
          const manager = new ThreadManager();
          const thread = (this.context.variables as Map<string, any>).get(`__thread_${threadId}`);
          if (!thread) throw new Error('Thread not found');
          return await manager.join(thread);
        },
        spawn_threadPool: (size: number) => {
          const pool = new ThreadPool(size);
          const poolId = `__pool_${Date.now()}`;
          (this.context.variables as Map<string, any>).set(poolId, pool);
          return { poolId };
        },
        spawn_addTask: (poolId: string, fn: () => Promise<any>) => {
          const pool = (this.context.variables as Map<string, any>).get(poolId);
          if (!pool) throw new Error('Pool not found');
          pool.addTask(fn);
          return { success: true };
        },
        spawn_runPool: async (poolId: string) => {
          const pool = (this.context.variables as Map<string, any>).get(poolId);
          if (!pool) throw new Error('Pool not found');
          return await pool.run();
        },

        // ==================== Phase 10: Collections ====================
        map_new: () => {
          const map = new HashMap<any, any>();
          const mapId = `__map_${Date.now()}`;
          (this.context.variables as Map<string, any>).set(mapId, map);
          return { mapId };
        },
        map_set: (mapId: string, key: any, value: any) => {
          const map = (this.context.variables as Map<string, any>).get(mapId);
          if (!map) throw new Error('Map not found');
          map.set(key, value);
          return { success: true };
        },
        map_get: (mapId: string, key: any) => {
          const map = (this.context.variables as Map<string, any>).get(mapId);
          if (!map) throw new Error('Map not found');
          return map.get(key);
        },
        map_has: (mapId: string, key: any) => {
          const map = (this.context.variables as Map<string, any>).get(mapId);
          if (!map) throw new Error('Map not found');
          return map.has(key);
        },
        map_keys: (mapId: string) => {
          const map = (this.context.variables as Map<string, any>).get(mapId);
          if (!map) throw new Error('Map not found');
          return map.keys();
        },
        map_size: (mapId: string) => {
          const map = (this.context.variables as Map<string, any>).get(mapId);
          if (!map) throw new Error('Map not found');
          return map.size();
        },

        set_new: () => {
          const set = new HashSet<any>();
          const setId = `__set_${Date.now()}`;
          (this.context.variables as Map<string, any>).set(setId, set);
          return { setId };
        },
        set_add: (setId: string, item: any) => {
          const set = (this.context.variables as Map<string, any>).get(setId);
          if (!set) throw new Error('Set not found');
          set.add(item);
          return { success: true };
        },
        set_has: (setId: string, item: any) => {
          const set = (this.context.variables as Map<string, any>).get(setId);
          if (!set) throw new Error('Set not found');
          return set.has(item);
        },
        set_size: (setId: string) => {
          const set = (this.context.variables as Map<string, any>).get(setId);
          if (!set) throw new Error('Set not found');
          return set.size();
        },

        queue_new: () => {
          const queue = new Queue<any>();
          const queueId = `__queue_${Date.now()}`;
          (this.context.variables as Map<string, any>).set(queueId, queue);
          return { queueId };
        },
        queue_enqueue: (queueId: string, item: any) => {
          const queue = (this.context.variables as Map<string, any>).get(queueId);
          if (!queue) throw new Error('Queue not found');
          queue.enqueue(item);
          return { success: true };
        },
        queue_dequeue: (queueId: string) => {
          const queue = (this.context.variables as Map<string, any>).get(queueId);
          if (!queue) throw new Error('Queue not found');
          return queue.dequeue();
        },
        queue_peek: (queueId: string) => {
          const queue = (this.context.variables as Map<string, any>).get(queueId);
          if (!queue) throw new Error('Queue not found');
          return queue.peek();
        },

        stack_new: () => {
          const stack = new Stack<any>();
          const stackId = `__stack_${Date.now()}`;
          (this.context.variables as Map<string, any>).set(stackId, stack);
          return { stackId };
        },
        stack_push: (stackId: string, item: any) => {
          const stack = (this.context.variables as Map<string, any>).get(stackId);
          if (!stack) throw new Error('Stack not found');
          stack.push(item);
          return { success: true };
        },
        stack_pop: (stackId: string) => {
          const stack = (this.context.variables as Map<string, any>).get(stackId);
          if (!stack) throw new Error('Stack not found');
          return stack.pop();
        },
        stack_peek: (stackId: string) => {
          const stack = (this.context.variables as Map<string, any>).get(stackId);
          if (!stack) throw new Error('Stack not found');
          return stack.peek();
        },

        // ==================== Phase 11: Math & Random (MT19937) ====================
        // Phase 11은 고품질 난수(MT19937), 통계, 과학 함수를 제공함
        // 기존 함수 (random, sin, cos, etc.)는 이미 정의되어 있으므로,
        // Phase 11 특화 기능은 직접 import해서 사용하면 됨

        // Phase 11 특화: 고품질 난수 (MT19937 Mersenne Twister)
        random_mt: () => Random.random(),
        random_normal: (mu: number = 0, sigma: number = 1) => Random.normal(mu, sigma),
        random_int_mt: (min: number, max: number) => Random.int(min, max),
        random_choice: (arr: any[]) => Random.choice(arr),
        random_shuffle: (arr: any[]) => Random.shuffle(arr),
        random_seed: (seed: number) => Random.seed(seed),

        // Phase 11 특화: 쌍곡함수
        sinh: (x: number) => MathUtils.sinh(x),
        cosh: (x: number) => MathUtils.cosh(x),
        tanh: (x: number) => MathUtils.tanh(x),

        // Phase 11 특화: 고급 수학
        distance: (x1: number, y1: number, x2: number, y2: number) => MathUtils.distance(x1, y1, x2, y2),
        lerp: (a: number, b: number, t: number) => MathUtils.lerp(a, b, t),

        // Phase 11 특화: 통계 (median, variance, stdDev은 이미 정의됨)
        percentile: (arr: number[], p: number) => Statistics.percentile(arr, p),

        // ==================== I/O 함수 ====================
        print: (...args: any[]) => {
          console.log(...args);
          return args.length === 1 ? args[0] : args;
        },
        log: console.log,
        stringify: (v: any) => JSON.stringify(v, null, 2),
        parse: (s: string) => JSON.parse(s),

        // ==================== Phase 13: HTTP Client ====================
        http: {
          get: async (url: string) => {
            const { HttpWrapper } = await import('../engine/http-wrapper');
            return await HttpWrapper.get(url);
          },
          post: async (url: string, body: string) => {
            const { HttpWrapper } = await import('../engine/http-wrapper');
            return await HttpWrapper.post(url, body);
          },
          json_get: async (url: string) => {
            const { HttpWrapper } = await import('../engine/http-wrapper');
            return await HttpWrapper.getJSON(url);
          },
          json_post: async (url: string, data: any) => {
            const { HttpWrapper } = await import('../engine/http-wrapper');
            return await HttpWrapper.postJSON(url, data);
          },
          head: async (url: string) => {
            const { HttpWrapper } = await import('../engine/http-wrapper');
            return await HttpWrapper.head(url);
          },
          patch: async (url: string, body: string) => {
            const { HttpWrapper } = await import('../engine/http-wrapper');
            return await HttpWrapper.patch(url, body);
          },
        },
      },
    };
  }

  /**
   * 메인 실행 함수
   */
  execute(code: string): ExecutionResult {
    this.startTime = performance.now();
    this.startMemory = (global as any).gc ? (global as any).gc.getHeapUsed?.() : 0;

    const result = this.executeCode(code);

    const endTime = performance.now();
    const endMemory = (global as any).gc ? (global as any).gc.getHeapUsed?.() : 0;

    const executionTime = endTime - this.startTime;
    const memoryUsed = Math.max(0, endMemory - this.startMemory);

    const finalResult: ExecutionResult = {
      success: result.success,
      result: result.value,
      executionTime,
      memory: Math.ceil(memoryUsed),
      type: this.inferType(result.value),
      error: result.error,
      warnings: result.warnings,
      metadata: {
        linesExecuted: code.split('\n').length,
        statementsExecuted: code.split(';').length,
        partial: result.partial,
      },
    };

    this.history.push({ code, result: finalResult });
    return finalResult;
  }

  /**
   * 코드 실행 로직
   */
  private executeCode(code: string): InternalResult {
    const warnings: string[] = [];

    try {
      // 1. 정규화 (공백 제거)
      const normalized = code.trim();

      if (!normalized) {
        return {
          success: true,
          value: undefined,
          warnings: [],
          partial: false,
        };
      }

      // 2. 부분 코드 감지
      const isPartial = normalized.includes('???') || normalized.includes('...');

      if (isPartial) {
        return this.executePartialCode(normalized);
      }

      // 3. 단순 할당 (let x = 5)
      if (normalized.includes('=') && !normalized.includes('==')) {
        return this.executeAssignment(normalized);
      }

      // 4. 함수 호출 (sum([1,2,3]))
      if (normalized.includes('(') && normalized.includes(')')) {
        return this.executeFunctionCall(normalized);
      }

      // 5. 표현식 평가
      return this.evaluateExpression(normalized);
    } catch (error) {
      return {
        success: false,
        value: undefined,
        error: String(error),
        warnings,
        partial: false,
      };
    }
  }

  /**
   * 할당문 실행
   */
  private executeAssignment(code: string): InternalResult {
    // let x = 5 또는 x = 5
    const cleanCode = code.replace(/^let\s+/, '');
    const [varName, ...rest] = cleanCode.split('=');
    const expression = rest.join('=').trim();

    try {
      const value = eval(this.replaceGlobals(expression));
      this.context.variables.set(varName.trim(), value);

      return {
        success: true,
        value,
        warnings: [],
        partial: false,
      };
    } catch (error) {
      return {
        success: false,
        value: undefined,
        error: String(error),
        warnings: [],
        partial: false,
      };
    }
  }

  /**
   * 함수 호출 실행
   */
  private executeFunctionCall(code: string): InternalResult {
    try {
      this.replaceGlobals(code);

      // Arrow function 처리: x => x * 2 형태
      let processedCode = code;

      // 간단한 arrow function을 Function 생성자로 변환
      // e.g., "map([1,2,3], x => x * 2)" → "map([1,2,3], new Function('x', 'return x * 2'))"
      processedCode = processedCode.replace(
        /(\w+)\s*=>\s*(.+?)(?=[),\s]|$)/g,
        (match, param, body) => {
          return `new Function('${param}', 'return ${body}')`;
        }
      );

      const value = eval(processedCode);

      return {
        success: true,
        value,
        warnings: [],
        partial: false,
      };
    } catch (error) {
      return {
        success: false,
        value: undefined,
        error: String(error),
        warnings: [],
        partial: false,
      };
    }
  }

  /**
   * 표현식 평가
   */
  private evaluateExpression(code: string): InternalResult {
    try {
      const replaced = this.replaceGlobals(code);
      const value = eval(replaced);

      return {
        success: true,
        value,
        warnings: [],
        partial: false,
      };
    } catch (error) {
      return {
        success: false,
        value: undefined,
        error: String(error),
        warnings: [],
        partial: false,
      };
    }
  }

  /**
   * 부분 코드 실행 (???, ... 포함)
   */
  private executePartialCode(code: string): InternalResult {
    const warnings: string[] = [];

    // ??? 이전까지만 실행
    const lines = code.split('\n');
    let lastSuccessValue: any = undefined;

    for (const line of lines) {
      if (line.includes('???') || line.includes('...')) {
        warnings.push(`⚠️ Partial execution: stopped at '${line.trim()}'`);
        break;
      }

      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//')) {
        const result = this.executeCode(trimmed);
        if (!result.success) {
          warnings.push(`⚠️ Error on line: ${line}`);
          break;
        }
        lastSuccessValue = result.value;
      }
    }

    return {
      success: true,
      value: lastSuccessValue,
      warnings,
      partial: true,
    };
  }

  /**
   * 글로벌 함수 치환
   */
  private replaceGlobals(code: string): string {
    // 글로벌 함수들 등록
    for (const [key, value] of Object.entries(this.context.globals)) {
      (global as any)[key] = value;
    }

    // 변수들 등록
    for (const [name, value] of this.context.variables) {
      (global as any)[name] = value;
    }

    return code;
  }

  /**
   * 타입 추론
   */
  private inferType(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'array<unknown>';
      const first = value[0];
      const itemType = typeof first;
      return `array<${itemType}>`;
    }
    if (typeof value === 'object') return 'object';
    if (typeof value === 'function') return 'function';
    return 'unknown';
  }

  /**
   * 히스토리 조회
   */
  getHistory(limit: number = 10): Array<{ code: string; result: ExecutionResult }> {
    return this.history.slice(-limit);
  }

  /**
   * 변수 조회
   */
  getVariables(): Map<string, any> {
    return new Map(this.context.variables);
  }

  /**
   * 변수 설정
   */
  setVariable(name: string, value: any): void {
    this.context.variables.set(name, value);
  }

  /**
   * 히스토리 초기화
   */
  clear(): void {
    this.history = [];
    this.context.variables.clear();
  }

  /**
   * 현재 상태 조회
   */
  getState(): {
    history: number;
    variables: number;
    executionTime: number;
  } {
    const lastResult = this.history[this.history.length - 1];
    return {
      history: this.history.length,
      variables: this.context.variables.size,
      executionTime: lastResult?.result.executionTime ?? 0,
    };
  }
}

/**
 * 글로벌 인스턴스
 */
export const globalSmartREPL = new SmartREPL();
