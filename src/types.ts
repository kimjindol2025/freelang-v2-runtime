// FreeLang v2 - AI-Only Types
// No human functions. No human strings. Pure machine interface.

// ── IR Opcodes ──────────────────────────────────────────────
export enum Op {
  // Stack
  PUSH      = 0x01,
  POP       = 0x02,
  DUP       = 0x03,

  // Arithmetic
  ADD       = 0x10,
  SUB       = 0x11,
  MUL       = 0x12,
  DIV       = 0x13,
  MOD       = 0x14,
  NEG       = 0x15,

  // Comparison
  EQ        = 0x20,
  NEQ       = 0x21,
  LT        = 0x22,
  GT        = 0x23,
  LTE       = 0x24,
  GTE       = 0x25,

  // Logic
  AND       = 0x30,
  OR        = 0x31,
  NOT       = 0x32,

  // Variables
  STORE     = 0x40,
  LOAD      = 0x41,

  // Control
  JMP       = 0x50,
  JMP_IF    = 0x51,
  JMP_NOT   = 0x52,
  CALL      = 0x53,
  RET       = 0x54,
  HALT      = 0x5F,

  // Array
  ARR_NEW   = 0x60,
  ARR_PUSH  = 0x61,
  ARR_GET   = 0x62,
  ARR_SET   = 0x63,
  ARR_LEN   = 0x64,
  ARR_DUP   = 0x65,  // Duplicate top array on stack
  ARR_CONCAT= 0x66,  // Concatenate two arrays

  // Array aggregate ops (AI shorthand)
  ARR_SUM   = 0x70,
  ARR_AVG   = 0x71,
  ARR_MAX   = 0x72,
  ARR_MIN   = 0x73,
  ARR_MAP   = 0x74,
  ARR_FILTER= 0x75,
  ARR_SORT  = 0x76,
  ARR_REV   = 0x77,

  // Stack manipulation
  SWAP      = 0x78,  // Swap top two stack values

  // Iterator (lazy evaluation)
  ITER_INIT = 0x80,  // stack: [start, end] → [iterator]
  ITER_NEXT = 0x81,  // stack: [iterator] → [value, iterator]
  ITER_HAS  = 0x82,  // stack: [iterator] → [bool]

  // String operations (Project Ouroboros)
  STR_NEW   = 0x90,  // arg: string → push to stack
  STR_LEN   = 0x91,  // stack: [str] → [length]
  STR_AT    = 0x92,  // stack: [str, index] → [char]
  STR_SUB   = 0x93,  // stack: [str, start, end] → [substr]
  STR_CONCAT= 0x94,  // stack: [str1, str2] → [str1+str2]
  STR_EQ    = 0x95,  // stack: [str1, str2] → [bool]
  STR_NEQ   = 0x96,  // stack: [str1, str2] → [bool]

  // Character operations
  CHAR_NEW  = 0x97,  // arg: char → push to stack
  CHAR_CODE = 0x98,  // stack: [char] → [code]
  CHAR_FROM = 0x99,  // stack: [code] → [char]

  // Phase 3 Step 3: Lambda & Closure operations
  LAMBDA_NEW      = 0xA0,  // Create new lambda object
  LAMBDA_CAPTURE  = 0xA1,  // arg: varname → capture variable into lambda
  LAMBDA_SET_BODY = 0xA2,  // arg: param_count, sub: body instructions

  // Function & Comment metadata
  FUNC_DEF  = 0xA3,  // Define function (metadata)
  COMMENT   = 0xA4,  // Comment/metadata (non-executable)

  // Threading (Phase 12 - Worker Threads)
  SPAWN_THREAD = 0xB0,   // spawn_thread(fn) → thread_handle
  JOIN_THREAD = 0xB1,    // join_thread(handle, timeout) → result
  MUTEX_CREATE = 0xB2,   // create_mutex() → mutex_handle
  MUTEX_LOCK = 0xB3,     // mutex_lock(mutex)
  MUTEX_UNLOCK = 0xB4,   // mutex_unlock(mutex)
  CHANNEL_CREATE = 0xB5, // create_channel() → channel_handle
  CHANNEL_SEND = 0xB6,   // channel_send(channel, message)
  CHANNEL_RECV = 0xB7,   // channel_recv(channel, timeout) → message

  // Network (Phase 26 - HTTP 독립)
  SOCKET_CREATE  = 0xC0, // socket_create() → socket_fd
  SOCKET_BIND    = 0xC1, // socket_bind(socket_fd, port)
  SOCKET_LISTEN  = 0xC2, // socket_listen(socket_fd, backlog)
  TCP_ACCEPT     = 0xC3, // tcp_accept(socket_fd) → client_fd
  TCP_READ       = 0xC4, // tcp_read(client_fd, size) → buffer
  TCP_WRITE      = 0xC5, // tcp_write(client_fd, buffer)
  SOCKET_CLOSE   = 0xC6, // socket_close(fd)
  HTTP_PARSE     = 0xC7, // http_parse(buffer) → {method, path, headers}

  // Test Framework (Phase 27 - Testing 독립)
  TEST_ASSERT    = 0xD0, // assert(condition, message)
  TEST_REPORT    = 0xD1, // report_test_result(name, passed, error)

  // Debug (AI reads structured output)
  DUMP      = 0xF0,
}

// ── IR Instruction ──────────────────────────────────────────
export interface Inst {
  op: Op;
  arg?: number | string | number[];
  sub?: Inst[];  // sub-program for ARR_MAP/ARR_FILTER, CALL
}

// ── AI Intent (what AI sends) ───────────────────────────────
export interface AIIntent {
  fn: string;                    // function name
  params: Param[];               // input parameters
  ret: string;                   // return type: "number" | "array" | "bool"
  body: Inst[];                  // IR instructions
  meta?: Record<string, unknown>;// optional metadata
}

export interface Param {
  name: string;
  type: string;  // "number" | "array" | "bool" | "string"
}

// ── VM Result ───────────────────────────────────────────────
export interface VMResult {
  ok: boolean;
  value?: unknown;  // Can be number, array, iterator, boolean, etc.
  error?: VMError;
  cycles: number;                // instructions executed
  ms: number;                    // execution time
}

export interface VMError {
  code: number;
  op: Op;
  pc: number;                    // program counter where error occurred
  stack_depth: number;
  detail: string;                // machine-readable error detail
}

// ── Compile Result ──────────────────────────────────────────
export interface CompileResult {
  ok: boolean;
  c_code?: string;
  binary_path?: string;
  gcc_output?: string;
  error?: string;
}

// ── Correction ──────────────────────────────────────────────
export interface CorrectionReport {
  attempt: number;
  original: Inst[];
  error: VMError;
  fix_applied: string;           // machine-readable fix description
  fixed: Inst[];
}

// ── Learning ────────────────────────────────────────────────
export interface PatternEntry {
  fn: string;
  params_hash: string;           // deterministic hash of param types
  body_hash: string;             // hash of IR body
  success_count: number;
  fail_count: number;
  avg_cycles: number;
  last_used: number;             // unix timestamp ms
}

// ── Threading Types (Phase 12) ──────────────────────────────
export interface ThreadHandle {
  id: string;
  state: 'pending' | 'completed' | 'failed' | 'terminated';
  startTime: number;
  result?: any;
  error?: Error;
  duration?: number;
}

export interface Mutex {
  lock(): Promise<void>;
  unlock(): void;
  tryLock(): boolean;
  withLock<T>(fn: () => Promise<T>): Promise<T>;
}

export interface Channel<T = any> {
  send(message: T): Promise<void>;
  receive(timeout?: number): Promise<T>;
  close(): void;
}
