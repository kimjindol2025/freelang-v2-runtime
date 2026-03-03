// FreeLang v2 - Builtin Registry (단일 진실 공급원)
// 한 번 선언 → 3곳 자동 사용 (TypeChecker, Interpreter, CodeGen)

export interface BuiltinParam {
  name: string;
  type: string;  // "number", "array<number>", "...any"
}

export interface BuiltinSpec {
  name: string;
  params: BuiltinParam[];
  return_type: string;
  c_name: string;
  headers: string[];
  impl?: (...args: any[]) => any;  // interpreter용
}

// ────────────────────────────────────────
// Builtin 함수 정의 (단일 소스)
// ────────────────────────────────────────

export const BUILTINS: Record<string, BuiltinSpec> = {
  // Array aggregates
  sum: {
    name: 'sum',
    params: [{ name: 'arr', type: 'array<number>' }],
    return_type: 'number',
    c_name: 'sum_array',
    headers: ['stdlib.h'],
    impl: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
  },

  average: {
    name: 'average',
    params: [{ name: 'arr', type: 'array<number>' }],
    return_type: 'number',
    c_name: 'avg_array',
    headers: ['stdlib.h'],
    impl: (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0,
  },

  max: {
    name: 'max',
    params: [{ name: 'arr', type: 'array<number>' }],
    return_type: 'number',
    c_name: 'max_array',
    headers: ['stdlib.h'],
    impl: (arr: number[]) => (arr.length > 0 ? Math.max(...arr) : 0),
  },

  min: {
    name: 'min',
    params: [{ name: 'arr', type: 'array<number>' }],
    return_type: 'number',
    c_name: 'min_array',
    headers: ['stdlib.h'],
    impl: (arr: number[]) => (arr.length > 0 ? Math.min(...arr) : 0),
  },

  count: {
    name: 'count',
    params: [{ name: 'arr', type: 'array<number>' }],
    return_type: 'number',
    c_name: 'arr_len',
    headers: ['stdlib.h'],
    impl: (arr: number[]) => arr.length,
  },

  length: {
    name: 'length',
    params: [{ name: 'arr', type: 'array<number>' }],
    return_type: 'number',
    c_name: 'arr_len',
    headers: ['stdlib.h'],
    impl: (arr: number[]) => arr.length,
  },

  // Math functions
  sqrt: {
    name: 'sqrt',
    params: [{ name: 'x', type: 'number' }],
    return_type: 'number',
    c_name: 'sqrt',
    headers: ['math.h'],
    impl: Math.sqrt,
  },

  abs: {
    name: 'abs',
    params: [{ name: 'x', type: 'number' }],
    return_type: 'number',
    c_name: 'fabs',
    headers: ['math.h'],
    impl: Math.abs,
  },

  floor: {
    name: 'floor',
    params: [{ name: 'x', type: 'number' }],
    return_type: 'number',
    c_name: 'floor',
    headers: ['math.h'],
    impl: Math.floor,
  },

  ceil: {
    name: 'ceil',
    params: [{ name: 'x', type: 'number' }],
    return_type: 'number',
    c_name: 'ceil',
    headers: ['math.h'],
    impl: Math.ceil,
  },

  round: {
    name: 'round',
    params: [{ name: 'x', type: 'number' }],
    return_type: 'number',
    c_name: 'round',
    headers: ['math.h'],
    impl: Math.round,
  },

  // Logic
  not: {
    name: 'not',
    params: [{ name: 'x', type: 'boolean' }],
    return_type: 'boolean',
    c_name: '!',
    headers: [],
    impl: (x: boolean) => !x,
  },

  // I/O (stub - actual impl in VM)
  println: {
    name: 'println',
    params: [{ name: 'args', type: '...any' }],
    return_type: 'void',
    c_name: 'printf',
    headers: ['stdio.h'],
    impl: (...args: any[]) => console.log(...args),
  },

  // ────────────────────────────────────────
  // String operations (Project Ouroboros)
  // ────────────────────────────────────────

  charAt: {
    name: 'charAt',
    params: [
      { name: 'str', type: 'string' },
      { name: 'index', type: 'number' },
    ],
    return_type: 'string',
    c_name: 'char_at',
    headers: ['string.h'],
    impl: (str: string, index: number) => str[Math.floor(index)] || '',
  },

  // Override length for string (in addition to array)
  // Note: We'll handle both in the interpreter
  string_length: {
    name: 'string_length',
    params: [{ name: 'str', type: 'string' }],
    return_type: 'number',
    c_name: 'strlen',
    headers: ['string.h'],
    impl: (str: string) => (typeof str === 'string' ? str.length : 0),
  },

  substr: {
    name: 'substr',
    params: [
      { name: 'str', type: 'string' },
      { name: 'start', type: 'number' },
      { name: 'end', type: 'number' },
    ],
    return_type: 'string',
    c_name: 'substr',
    headers: ['string.h'],
    impl: (str: string, start: number, end: number) =>
      str.substring(Math.floor(start), Math.floor(end)),
  },

  isDigit: {
    name: 'isDigit',
    params: [{ name: 'ch', type: 'string' }],
    return_type: 'boolean',
    c_name: 'isdigit',
    headers: ['ctype.h'],
    impl: (ch: string) => /^\d$/.test(ch),
  },

  isLetter: {
    name: 'isLetter',
    params: [{ name: 'ch', type: 'string' }],
    return_type: 'boolean',
    c_name: 'isalpha',
    headers: ['ctype.h'],
    impl: (ch: string) => /^[a-zA-Z]$/.test(ch),
  },

  push: {
    name: 'push',
    params: [
      { name: 'arr', type: 'array<number>' },
      { name: 'element', type: 'number' },
    ],
    return_type: 'void',
    c_name: 'arr_push',
    headers: ['stdlib.h'],
    impl: (arr: any[], element: any) => {
      if (Array.isArray(arr)) arr.push(element);
    },
  },

  // ────────────────────────────────────────
  // HTTP Client (Phase 13)
  // ────────────────────────────────────────

  http_get: {
    name: 'http_get',
    params: [{ name: 'url', type: 'string' }],
    return_type: 'object',  // { status_code: number, body: string, headers: object, elapsed_ms: number }
    c_name: 'http_get',
    headers: ['curl.h'],
    impl: async (url: string) => {
      const { HttpWrapper } = await import('./http-wrapper');
      return await HttpWrapper.get(url);
    },
  },

  http_post: {
    name: 'http_post',
    params: [
      { name: 'url', type: 'string' },
      { name: 'body', type: 'string' },
    ],
    return_type: 'object',
    c_name: 'http_post',
    headers: ['curl.h'],
    impl: async (url: string, body: string) => {
      const { HttpWrapper } = await import('./http-wrapper');
      return await HttpWrapper.post(url, body);
    },
  },

  http_json_get: {
    name: 'http_json_get',
    params: [{ name: 'url', type: 'string' }],
    return_type: 'object',
    c_name: 'http_json_get',
    headers: ['curl.h'],
    impl: async (url: string) => {
      const { HttpWrapper } = await import('./http-wrapper');
      return await HttpWrapper.getJSON(url);
    },
  },

  http_json_post: {
    name: 'http_json_post',
    params: [
      { name: 'url', type: 'string' },
      { name: 'data', type: 'object' },
    ],
    return_type: 'object',
    c_name: 'http_json_post',
    headers: ['curl.h'],
    impl: async (url: string, data: any) => {
      const { HttpWrapper } = await import('./http-wrapper');
      return await HttpWrapper.postJSON(url, data);
    },
  },

  http_head: {
    name: 'http_head',
    params: [{ name: 'url', type: 'string' }],
    return_type: 'object',
    c_name: 'http_head',
    headers: ['curl.h'],
    impl: async (url: string) => {
      const { HttpWrapper } = await import('./http-wrapper');
      return await HttpWrapper.head(url);
    },
  },

  http_patch: {
    name: 'http_patch',
    params: [
      { name: 'url', type: 'string' },
      { name: 'body', type: 'string' },
    ],
    return_type: 'object',
    c_name: 'http_patch',
    headers: ['curl.h'],
    impl: async (url: string, body: string) => {
      const { HttpWrapper } = await import('./http-wrapper');
      return await HttpWrapper.patch(url, body);
    },
  },

  // ────────────────────────────────────────
  // Advanced HTTP (Phase 13 Week 3)
  // ────────────────────────────────────────

  http_batch: {
    name: 'http_batch',
    params: [
      { name: 'urls', type: 'array<string>' },
      { name: 'limit', type: 'number' },
    ],
    return_type: 'array<object>',
    c_name: 'http_batch',
    headers: ['curl.h'],
    impl: async (urls: string[], limit: number = 10) => {
      const { HttpBatch } = await import('./http-batch');
      const { HttpWrapper } = await import('./http-wrapper');
      const result = await HttpBatch.withLimit(
        urls,
        Math.max(1, Math.floor(limit)),
        url => HttpWrapper.get(url),
        { continueOnError: true }
      );
      return result.results;
    },
  },

  http_get_with_retry: {
    name: 'http_get_with_retry',
    params: [
      { name: 'url', type: 'string' },
      { name: 'max_retries', type: 'number' },
    ],
    return_type: 'object',
    c_name: 'http_get_with_retry',
    headers: ['curl.h'],
    impl: async (url: string, maxRetries: number = 3) => {
      const { HttpRetry } = await import('./http-retry');
      const { HttpWrapper } = await import('./http-wrapper');
      return await HttpRetry.withRetry(
        () => HttpWrapper.get(url),
        {
          maxRetries: Math.max(0, Math.floor(maxRetries)),
          backoffMs: 1000,
          retryOn: (error: any) => {
            // 5xx 또는 네트워크 에러만 재시도
            return HttpRetry.isRetryableError(error);
          },
        }
      );
    },
  },

  // ────────────────────────────────────────
  // Timer API (Phase 16)
  // ────────────────────────────────────────

  timer_create: {
    name: 'timer_create',
    params: [],
    return_type: 'number',  // timer_id
    c_name: 'freelang_timer_create',
    headers: ['freelang_ffi.h', 'uv.h'],
    impl: () => {
      // Fallback: return a unique ID
      return Math.floor(Math.random() * 1000000);
    },
  },

  timer_start: {
    name: 'timer_start',
    params: [
      { name: 'timer_id', type: 'number' },
      { name: 'timeout_ms', type: 'number' },
      { name: 'callback_id', type: 'number' },
      { name: 'repeat', type: 'number' },
    ],
    return_type: 'number',  // 0 on success, -1 on error
    c_name: 'freelang_timer_start',
    headers: ['freelang_ffi.h', 'uv.h'],
    impl: (timerId: number, timeoutMs: number, callbackId: number, repeat: number) => {
      // Fallback: simulated timer
      return 0;
    },
  },

  timer_stop: {
    name: 'timer_stop',
    params: [{ name: 'timer_id', type: 'number' }],
    return_type: 'void',
    c_name: 'freelang_timer_stop',
    headers: ['freelang_ffi.h', 'uv.h'],
    impl: (timerId: number) => {
      // Stub
    },
  },

  timer_close: {
    name: 'timer_close',
    params: [{ name: 'timer_id', type: 'number' }],
    return_type: 'void',
    c_name: 'freelang_timer_close',
    headers: ['freelang_ffi.h', 'uv.h'],
    impl: (timerId: number) => {
      // Stub
    },
  },

  // ────────────────────────────────────────
  // Event Loop Control (Phase 16-17)
  // ────────────────────────────────────────

  event_loop_run: {
    name: 'event_loop_run',
    params: [{ name: 'timeout_ms', type: 'number' }],
    return_type: 'void',
    c_name: 'freelang_event_loop_run',
    headers: ['freelang_ffi.h', 'uv.h'],
    impl: (timeoutMs: number) => {
      // Stub: In real implementation, runs the libuv event loop
    },
  },

  event_loop_stop: {
    name: 'event_loop_stop',
    params: [],
    return_type: 'void',
    c_name: 'freelang_event_loop_stop',
    headers: ['freelang_ffi.h', 'uv.h'],
    impl: () => {
      // Stub
    },
  },

  // ────────────────────────────────────────
  // Redis Bindings (Phase 17 Week 2)
  // ────────────────────────────────────────

  redis_create: {
    name: 'redis_create',
    params: [
      { name: 'host', type: 'string' },
      { name: 'port', type: 'number' },
      { name: 'callback_ctx_id', type: 'number' },
    ],
    return_type: 'number',  // client_id
    c_name: 'freelang_redis_create',
    headers: ['redis_bindings.h'],
    impl: (host: string, port: number, _callbackCtxId: number) => {
      // Fallback: return a unique client ID
      return Math.floor(Math.random() * 1000000);
    },
  },

  redis_close: {
    name: 'redis_close',
    params: [{ name: 'client_id', type: 'number' }],
    return_type: 'void',
    c_name: 'freelang_redis_close',
    headers: ['redis_bindings.h'],
    impl: (_clientId: number) => {
      // Stub
    },
  },

  redis_get: {
    name: 'redis_get',
    params: [
      { name: 'client_id', type: 'number' },
      { name: 'key', type: 'string' },
      { name: 'callback_id', type: 'number' },
    ],
    return_type: 'void',
    c_name: 'freelang_redis_get',
    headers: ['redis_bindings.h'],
    impl: (_clientId: number, _key: string, _callbackId: number) => {
      // Stub
    },
  },

  redis_set: {
    name: 'redis_set',
    params: [
      { name: 'client_id', type: 'number' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
      { name: 'callback_id', type: 'number' },
    ],
    return_type: 'void',
    c_name: 'freelang_redis_set',
    headers: ['redis_bindings.h'],
    impl: (_clientId: number, _key: string, _value: string, _callbackId: number) => {
      // Stub
    },
  },

  redis_del: {
    name: 'redis_del',
    params: [
      { name: 'client_id', type: 'number' },
      { name: 'key', type: 'string' },
      { name: 'callback_id', type: 'number' },
    ],
    return_type: 'void',
    c_name: 'freelang_redis_del',
    headers: ['redis_bindings.h'],
    impl: (_clientId: number, _key: string, _callbackId: number) => {
      // Stub
    },
  },

  redis_exists: {
    name: 'redis_exists',
    params: [
      { name: 'client_id', type: 'number' },
      { name: 'key', type: 'string' },
      { name: 'callback_id', type: 'number' },
    ],
    return_type: 'void',
    c_name: 'freelang_redis_exists',
    headers: ['redis_bindings.h'],
    impl: (_clientId: number, _key: string, _callbackId: number) => {
      // Stub
    },
  },

  redis_incr: {
    name: 'redis_incr',
    params: [
      { name: 'client_id', type: 'number' },
      { name: 'key', type: 'string' },
      { name: 'callback_id', type: 'number' },
    ],
    return_type: 'void',
    c_name: 'freelang_redis_incr',
    headers: ['redis_bindings.h'],
    impl: (_clientId: number, _key: string, _callbackId: number) => {
      // Stub
    },
  },

  redis_expire: {
    name: 'redis_expire',
    params: [
      { name: 'client_id', type: 'number' },
      { name: 'key', type: 'string' },
      { name: 'seconds', type: 'number' },
      { name: 'callback_id', type: 'number' },
    ],
    return_type: 'void',
    c_name: 'freelang_redis_expire',
    headers: ['redis_bindings.h'],
    impl: (_clientId: number, _key: string, _seconds: number, _callbackId: number) => {
      // Stub
    },
  },

  redis_is_connected: {
    name: 'redis_is_connected',
    params: [{ name: 'client_id', type: 'number' }],
    return_type: 'number',
    c_name: 'freelang_redis_is_connected',
    headers: ['redis_bindings.h'],
    impl: (_clientId: number) => {
      return 0;  // Stub: not connected
    },
  },

  redis_ping: {
    name: 'redis_ping',
    params: [
      { name: 'client_id', type: 'number' },
      { name: 'callback_id', type: 'number' },
    ],
    return_type: 'number',
    c_name: 'freelang_redis_ping',
    headers: ['redis_bindings.h'],
    impl: (_clientId: number, _callbackId: number) => {
      return 0;
    },
  },

  // ────────────────────────────────────────
  // SQLite3 FFI Bindings (Phase 1C - FFI Activation)
  // ────────────────────────────────────────
  // Register native SQLite functions for database access
  // Compiled from stdlib/core/sqlite_binding.c
  // Linked as libfreelang_sqlite.so

  native_sqlite_open: {
    name: 'native_sqlite_open',
    params: [{ name: 'path', type: 'string' }],
    return_type: 'object',
    c_name: 'fl_sqlite_open',
    headers: ['sqlite_binding.h', 'sqlite3.h'],
    impl: (path: string) => {
      // Fallback: In-memory mock database connection
      return {
        path: path,
        handle: Math.floor(Math.random() * 1000000),
        isOpen: true,
        lastError: null,
      };
    },
  },

  native_sqlite_close: {
    name: 'native_sqlite_close',
    params: [{ name: 'conn', type: 'object' }],
    return_type: 'number',
    c_name: 'fl_sqlite_close',
    headers: ['sqlite_binding.h', 'sqlite3.h'],
    impl: (conn: any) => {
      // Fallback: Mark connection as closed
      if (conn) conn.isOpen = false;
      return 0;  // SQLITE_OK
    },
  },

  native_sqlite_execute: {
    name: 'native_sqlite_execute',
    params: [
      { name: 'conn', type: 'object' },
      { name: 'query', type: 'string' },
    ],
    return_type: 'object',
    c_name: 'fl_sqlite_execute',
    headers: ['sqlite_binding.h', 'sqlite3.h'],
    impl: (conn: any, query: string) => {
      // Fallback: Return empty result set
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        lastInsertRowid: 0,
      };
    },
  },

  native_sqlite_execute_update: {
    name: 'native_sqlite_execute_update',
    params: [
      { name: 'conn', type: 'object' },
      { name: 'query', type: 'string' },
    ],
    return_type: 'number',
    c_name: 'fl_sqlite_execute_update',
    headers: ['sqlite_binding.h', 'sqlite3.h'],
    impl: (conn: any, query: string) => {
      // Fallback: Return number of affected rows
      return 0;
    },
  },

  native_sqlite_fetch_row: {
    name: 'native_sqlite_fetch_row',
    params: [{ name: 'result', type: 'object' }],
    return_type: 'number',
    c_name: 'fl_sqlite_fetch_row',
    headers: ['sqlite_binding.h', 'sqlite3.h'],
    impl: (result: any) => {
      // Fallback: Return SQLITE_DONE (no more rows)
      return 101;  // SQLITE_DONE
    },
  },

  native_sqlite_get_column_text: {
    name: 'native_sqlite_get_column_text',
    params: [
      { name: 'result', type: 'object' },
      { name: 'idx', type: 'number' },
    ],
    return_type: 'string',
    c_name: 'fl_sqlite_get_column_text',
    headers: ['sqlite_binding.h', 'sqlite3.h'],
    impl: (result: any, idx: number) => {
      // Fallback: Return empty string
      return '';
    },
  },

  native_sqlite_get_column_int: {
    name: 'native_sqlite_get_column_int',
    params: [
      { name: 'result', type: 'object' },
      { name: 'idx', type: 'number' },
    ],
    return_type: 'number',
    c_name: 'fl_sqlite_get_column_int',
    headers: ['sqlite_binding.h', 'sqlite3.h'],
    impl: (result: any, idx: number) => {
      // Fallback: Return 0
      return 0;
    },
  },

  native_sqlite_get_column_double: {
    name: 'native_sqlite_get_column_double',
    params: [
      { name: 'result', type: 'object' },
      { name: 'idx', type: 'number' },
    ],
    return_type: 'number',
    c_name: 'fl_sqlite_get_column_double',
    headers: ['sqlite_binding.h', 'sqlite3.h'],
    impl: (result: any, idx: number) => {
      // Fallback: Return 0.0
      return 0.0;
    },
  },

  native_sqlite_get_error: {
    name: 'native_sqlite_get_error',
    params: [{ name: 'conn', type: 'object' }],
    return_type: 'string',
    c_name: 'fl_sqlite_get_error',
    headers: ['sqlite_binding.h', 'sqlite3.h'],
    impl: (conn: any) => {
      // Fallback: Return error from connection
      return conn?.lastError || 'no error';
    },
  },

  native_sqlite_get_error_code: {
    name: 'native_sqlite_get_error_code',
    params: [{ name: 'conn', type: 'object' }],
    return_type: 'number',
    c_name: 'fl_sqlite_get_error_code',
    headers: ['sqlite_binding.h', 'sqlite3.h'],
    impl: (conn: any) => {
      // Fallback: Return SQLITE_OK
      return 0;  // SQLITE_OK
    },
  },

  native_sqlite_begin: {
    name: 'native_sqlite_begin',
    params: [{ name: 'conn', type: 'object' }],
    return_type: 'number',
    c_name: 'fl_sqlite_begin',
    headers: ['sqlite_binding.h', 'sqlite3.h'],
    impl: (conn: any) => {
      // Fallback: Return success
      return 0;  // SQLITE_OK
    },
  },

  native_sqlite_commit: {
    name: 'native_sqlite_commit',
    params: [{ name: 'conn', type: 'object' }],
    return_type: 'number',
    c_name: 'fl_sqlite_commit',
    headers: ['sqlite_binding.h', 'sqlite3.h'],
    impl: (conn: any) => {
      // Fallback: Return success
      return 0;  // SQLITE_OK
    },
  },

  native_sqlite_rollback: {
    name: 'native_sqlite_rollback',
    params: [{ name: 'conn', type: 'object' }],
    return_type: 'number',
    c_name: 'fl_sqlite_rollback',
    headers: ['sqlite_binding.h', 'sqlite3.h'],
    impl: (conn: any) => {
      // Fallback: Return success
      return 0;  // SQLITE_OK
    },
  },

  // Threading Built-ins (Phase 12)
  spawn_thread: {
    name: 'spawn_thread',
    params: [{ name: 'task', type: 'function' }],
    return_type: 'thread_handle',
    c_name: 'freelang_spawn_thread',
    headers: ['freelang_ffi.h', 'uv.h'],
    impl: async (fn: any) => {
      // Simulated thread execution - return immediately with pending promise
      const id = `thread_${Math.random().toString(36).substr(2, 9)}`;
      const handle: any = {
        id,
        state: 'running',
        result: undefined,
      };

      // Execute the task and update handle when complete
      try {
        const result = fn();
        // Handle both Promise and regular return values
        if (result && typeof result.then === 'function') {
          result.then((val: any) => {
            handle.result = val;
            handle.state = 'completed';
          }).catch((error: any) => {
            handle.error = String(error);
            handle.state = 'failed';
          });
        } else {
          handle.result = result;
          handle.state = 'completed';
        }
      } catch (error) {
        handle.error = String(error);
        handle.state = 'failed';
      }

      return handle;
    },
  },

  join_thread: {
    name: 'join_thread',
    params: [
      { name: 'handle', type: 'thread_handle' },
      { name: 'timeout', type: 'number' },
    ],
    return_type: 'any',
    c_name: 'freelang_join_thread',
    headers: ['freelang_ffi.h', 'uv.h'],
    impl: async (handle: any, timeout?: number) => {
      // Wait for thread completion with timeout
      const startTime = Date.now();
      const timeoutMs = timeout || 5000;

      while (handle.state === 'running') {
        const elapsed = Date.now() - startTime;
        if (elapsed > timeoutMs) {
          throw new Error(`Thread join timeout after ${timeoutMs}ms`);
        }
        // Sleep 50ms to allow async tasks to complete
        await new Promise(r => setTimeout(r, 50));
      }

      if (handle.state === 'failed') {
        throw new Error(handle.error || 'Thread execution failed');
      }

      return handle.result || null;
    },
  },

  create_mutex: {
    name: 'create_mutex',
    params: [],
    return_type: 'mutex',
    c_name: 'freelang_create_mutex',
    headers: ['freelang_ffi.h', 'pthread.h'],
    impl: () => {
      const mutex = {
        id: `mutex_${Math.random().toString(36).substr(2, 9)}`,
        locked: false,
        lock: async function() {
          this.locked = true;
        },
        unlock: function() {
          this.locked = false;
        },
      };
      return mutex;
    },
  },

  mutex_lock: {
    name: 'mutex_lock',
    params: [{ name: 'mutex', type: 'mutex' }],
    return_type: 'void',
    c_name: 'freelang_mutex_lock',
    headers: ['freelang_ffi.h', 'pthread.h'],
    impl: async (mutex: any) => {
      if (mutex) {
        mutex.locked = true;
      }
    },
  },

  mutex_unlock: {
    name: 'mutex_unlock',
    params: [{ name: 'mutex', type: 'mutex' }],
    return_type: 'void',
    c_name: 'freelang_mutex_unlock',
    headers: ['freelang_ffi.h', 'pthread.h'],
    impl: (mutex: any) => {
      if (mutex) {
        mutex.locked = false;
      }
    },
  },

  create_channel: {
    name: 'create_channel',
    params: [],
    return_type: 'channel',
    c_name: 'freelang_create_channel',
    headers: ['freelang_ffi.h'],
    impl: () => {
      return {
        id: `channel_${Math.random().toString(36).substr(2, 9)}`,
        messages: [],
      };
    },
  },

  channel_send: {
    name: 'channel_send',
    params: [
      { name: 'channel', type: 'channel' },
      { name: 'message', type: 'any' },
    ],
    return_type: 'void',
    c_name: 'freelang_channel_send',
    headers: ['freelang_ffi.h'],
    impl: async (channel: any, message: any) => {
      if (channel) {
        channel.messages.push(message);
      }
    },
  },

  channel_recv: {
    name: 'channel_recv',
    params: [
      { name: 'channel', type: 'channel' },
      { name: 'timeout', type: 'number' },
    ],
    return_type: 'any',
    c_name: 'freelang_channel_recv',
    headers: ['freelang_ffi.h'],
    impl: async (channel: any, timeout?: number) => {
      if (channel && channel.messages.length > 0) {
        return channel.messages.shift();
      }
      return null;
    },
  },
};

// ────────────────────────────────────────
// TypeChecker용: 타입 정보 추출
// ────────────────────────────────────────

export function getBuiltinType(name: string): {
  params: BuiltinParam[];
  return_type: string;
} | null {
  const spec = BUILTINS[name];
  if (!spec) return null;
  return {
    params: spec.params,
    return_type: spec.return_type,
  };
}

// ────────────────────────────────────────
// Interpreter용: 함수 구현 가져오기
// ────────────────────────────────────────

export function getBuiltinImpl(name: string): Function | null {
  const spec = BUILTINS[name];
  return spec?.impl || null;
}

// ────────────────────────────────────────
// CodeGen용: C 함수 정보 가져오기
// ────────────────────────────────────────

export function getBuiltinC(name: string): {
  c_name: string;
  headers: string[];
} | null {
  const spec = BUILTINS[name];
  if (!spec) return null;
  return {
    c_name: spec.c_name,
    headers: spec.headers,
  };
}

// ────────────────────────────────────────
// 유틸: 사용 가능한 builtin 목록
// ────────────────────────────────────────

export function getBuiltinNames(): string[] {
  return Object.keys(BUILTINS);
}

export function isBuiltin(name: string): boolean {
  return name in BUILTINS;
}

// ────────────────────────────────────────
// 검증: 모든 builtin이 3곳 다 채워졌는지
// ────────────────────────────────────────

export function validateBuiltins(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [name, spec] of Object.entries(BUILTINS)) {
    // c_name 확인
    if (!spec.c_name) {
      errors.push(`${name}: missing c_name`);
    }
    // headers 확인
    if (!Array.isArray(spec.headers)) {
      errors.push(`${name}: headers not array`);
    }
    // impl 확인 (println 제외 - stub)
    if (name !== 'println' && !spec.impl) {
      errors.push(`${name}: missing impl`);
    }
    // return_type 확인
    if (!spec.return_type) {
      errors.push(`${name}: missing return_type`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
