# Phase 21: Runtime System Integration

## Overview

Phase 21 implements a comprehensive runtime system for executing compiled code with multiple backend support. The system provides:

- **7 Runtime Implementations**: Native, JVM, WASM, Bytecode VM, LLVM, Custom, Hybrid
- **Memory Management**: Heap allocation, stack management, garbage collection
- **Module Loading**: Code linking, symbol extraction, function registration
- **Exception Handling**: Registered handlers with finally blocks
- **Standard Library**: I/O and math functions built-in
- **Performance Monitoring**: Metrics tracking and statistics

## Components

### RuntimeSystemBase (src/phase-21/runtime-base/runtime-system-base.ts)

Core base class for all runtime systems.

**Key Features**:
- Memory management with configurable GC strategies
- Module loading and symbol linking
- Exception handling with registered handlers
- Standard library with I/O and math functions
- Stack-based execution model
- Performance metrics tracking

**Configuration Options**:
```typescript
interface RuntimeConfig {
  target: RuntimeTarget;           // 'native', 'jvm', 'wasm-runtime', etc
  gc_strategy: GCStrategy;         // 'mark-sweep', 'generational', 'incremental', 'concurrent', 'none'
  heap_size: number;               // in MB
  stack_size: number;              // in MB
  max_threads: number;             // for threading support
  enable_jit: boolean;             // JIT compilation
  enable_profiling: boolean;       // performance tracking
  verbose: boolean;                // debug output
}
```

**Key Methods**:
- `linkModule(name, code)` - Load and validate code module
- `allocate(size)` / `deallocate(addr, size)` - Memory management
- `collectGarbage()` - Trigger GC based on strategy
- `registerExceptionHandler(type, handler)` - Register exception handler
- `handleException(type, error)` - Execute registered handler
- `callStdlib(func, args)` - Call stdlib function
- `execute(entry_point, args)` - Execute code

**Standard Library Functions**:
- **I/O**: `println(text)`, `print(text)`, `readln()`
- **Math**: `add(a,b)`, `subtract(a,b)`, `multiply(a,b)`, `divide(a,b)`
- **String**: `strlen(s)`, `strcpy(src,dst)`, `strcat(s1,s2)`

### Runtime Implementations (src/phase-21/runtimes/runtime-systems.ts)

#### 1. NativeRuntime
Direct execution with machine code semantics.

**Characteristics**:
- GC Strategy: Mark-sweep
- Heap: 256 MB
- Stack: 8 MB
- JIT: Disabled
- Profiling: Enabled
- Additional Functions: `syscall`, `mmap`

**Use Case**: Direct native code execution, system programming

#### 2. JVMRuntime
Java Virtual Machine style execution with class loading.

**Characteristics**:
- GC Strategy: Generational (young/old generation)
- Heap: 512 MB
- Stack: 16 MB
- JIT: Enabled (HotSpot style)
- Profiling: Enabled
- Class Loading: `loadClass(name, bytecode)`
- Get Loaded Classes: `getLoadedClasses()`

**Use Case**: Java compatibility, bytecode-based execution

#### 3. WASMRuntime
WebAssembly execution environment.

**Characteristics**:
- GC Strategy: Incremental (pause-free collection)
- Heap: 64 MB (WebAssembly memory)
- Stack: 4 MB
- JIT: Disabled
- Profiling: Disabled
- WASM Memory: `getWASMMemory()`
- Module Loading: `loadWASMModule(module, imports)`

**Use Case**: Web execution, sandboxed environments, portable bytecode

#### 4. BytecodeVMRuntime
Register-based virtual machine with bytecode execution.

**Characteristics**:
- GC Strategy: Mark-sweep
- Heap: 128 MB
- Stack: 8 MB
- JIT: Enabled (simple JIT)
- Profiling: Enabled
- Accumulator Register: for computation
- Opcode Execution: 0x01 (PUSH), 0x02 (ADD), 0x03 (SUB)

**Use Case**: Portable bytecode, educational purposes

#### 5. LLVMRuntime
LLVM IR execution with JIT compilation.

**Characteristics**:
- GC Strategy: Concurrent (background collection)
- Heap: 512 MB
- Stack: 16 MB
- JIT: Enabled (LLVM JIT)
- Profiling: Enabled
- IR Loading: `loadLLVMIR(ir_code)`
- Compilation: `compileLLVMModule()`

**Use Case**: Performance-critical code, LLVM integration

#### 6. CustomRuntime
Domain-specific runtime with custom handlers.

**Characteristics**:
- GC Strategy: None (custom)
- Heap: 256 MB
- Stack: 8 MB
- JIT: Disabled
- Profiling: Disabled
- Domains: 'ml', 'gpu', 'crypto', 'generic'
- Custom Handlers: `registerCustomHandler(name, fn)`

**Use Case**: ML frameworks, GPU computation, domain-specific languages

#### 7. HybridRuntime
Multi-runtime support with dynamic runtime switching.

**Characteristics**:
- GC Strategy: Concurrent (coordinates across runtimes)
- Heap: 1024 MB (shared)
- Stack: 32 MB
- JIT: Enabled
- Profiling: Enabled
- Available Runtimes: Native, JVM, WASM, Bytecode, LLVM
- Runtime Switching: `selectRuntime(target)` → `getCurrentRuntime()`
- Execute on Runtime: `executeOnRuntime(target, entry_point, args)`

**Use Case**: Polyglot execution, runtime selection based on workload

### RuntimeFactory

Factory pattern for runtime instantiation.

**Methods**:
- `create(target)` - Create runtime by target name
- `availableRuntimes()` - List available runtime types
- `getDescription(target)` - Get runtime description

**Example**:
```typescript
const runtime = RuntimeFactory.create('native');
const runtimes = RuntimeFactory.availableRuntimes();  // ['native', 'jvm', 'wasm', ...]
```

## GC Strategies

### Mark-Sweep
- Traditional two-phase collection
- Mark reachable objects, sweep unreachable
- Pauses execution during collection
- Simple and predictable

### Generational
- Divides objects into young and old generations
- Collects young generation frequently
- Collects old generation rarely
- Reduces pause times

### Incremental
- Performs collection in small steps
- No long pauses
- Useful for real-time systems
- WebAssembly uses this

### Concurrent
- Runs GC alongside application
- Minimal pause times
- More complex implementation
- Used by LLVM and Hybrid runtimes

## Memory Management

### Allocation
```typescript
const address = runtime.allocate(1024);  // 1KB
```

### Deallocation
```typescript
runtime.deallocate(address, 1024);
```

### GC Trigger
Automatic when heap is full:
```typescript
runtime.collectGarbage();
```

### Statistics
```typescript
const stats = runtime.getMemoryStats();
// {
//   heap_used: 512000,
//   heap_total: 268435456,
//   heap_free: 267923456,
//   gc_count: 3,
//   gc_time_ms: 45,
//   allocation_count: 1024
// }
```

## Exception Handling

### Register Handler
```typescript
runtime.registerExceptionHandler('TypeError', {
  exception_type: 'TypeError',
  handler_fn: (error) => {
    console.error('Type error:', error);
  },
  finally_fn: () => {
    console.log('Cleaning up...');
  }
});
```

### Handle Exception
```typescript
try {
  runtime.handleException('TypeError', new Error('Type mismatch'));
} catch (e) {
  console.error('Unhandled exception');
}
```

## Module Loading

### Load Module
```typescript
const code = `
  function add(a, b) {
    return a + b;
  }
`;
runtime.linkModule('math', code);
```

### Get Symbol
```typescript
const symbol = runtime.getSymbol('add');
// { name: 'add', address: 0, type: 'function' }
```

### Execute Module
```typescript
const result = await runtime.execute('add', [5, 3]);  // 8
```

## Stack Operations

### Push/Pop
```typescript
runtime.pushStack(42);
const value = runtime.popStack();  // 42
```

### Peek
```typescript
const top = runtime.peekStack();  // Without removing
```

## Configuration

### Get Config
```typescript
const config = runtime.getConfig();
// { target: 'native', gc_strategy: 'mark-sweep', heap_size: 256, ... }
```

### Set Config
```typescript
runtime.setConfig({ optimization_level: 3, debug_symbols: true });
```

## Performance Tracking

### Record Metric
```typescript
runtime.recordMetric('cache_hits', 1);
runtime.recordMetric('api_calls', 1);
```

### Get Metrics
```typescript
const metrics = runtime.getMetrics();
// Map { 'cache_hits' => 5, 'api_calls' => 42 }
```

### Reset Metrics
```typescript
runtime.resetMetrics();
```

## Statistics

### Get Runtime Stats
```typescript
const stats = runtime.getStats();
// {
//   target: 'native',
//   loaded_modules: 3,
//   symbol_count: 42,
//   stack_depth: 10,
//   gc_count: 2
// }
```

### Reset Runtime
```typescript
runtime.reset();  // Clears all state except config
```

## Integration Pipeline

```
Source Code
    ↓
[Phase 19] IR Generation
    ↓
Intermediate Representation (IR)
    ↓
[Phase 20] Code Generation
    ↓
Target Code (C, LLVM, WASM, etc)
    ↓
[Phase 21] Runtime System
    ↓
Module Loading → Execution → Results
```

## Test Coverage

**Total Tests**: 86

### RuntimeSystemBase (30 tests)
- Module Loading (6)
- Memory Management (8)
- Exception Handling (6)
- Standard Library (5)
- Execution (3)
- Configuration & Statistics (2)

### Runtime Systems (56 tests)
- NativeRuntime (4)
- JVMRuntime (4)
- WASMRuntime (4)
- BytecodeVMRuntime (4)
- LLVMRuntime (4)
- CustomRuntime (4)
- HybridRuntime (4)
- RuntimeFactory (10)

## Implementation Notes

### Thread Safety
Current implementation is single-threaded. Multi-threaded support planned for Phase 2.

### GC Pause Times
- Mark-sweep: 10-100ms
- Generational: 1-10ms
- Incremental: <1ms
- Concurrent: <1ms (with CPU overhead)

### Execution Model
All runtimes use stack-based or register-based execution:
- Stack-based: Simpler, slower
- Register-based: Complex, faster
- Bytecode VM uses accumulator register model

### Module Linking
Functions are extracted via regex pattern matching:
```typescript
const func_pattern = /function\s+(\w+)\s*\(/g;
```

This is a simplified approach suitable for educational purposes.

## Performance Characteristics

| Runtime | Startup | Execution | Memory | Best For |
|---------|---------|-----------|--------|----------|
| Native | Fast | Very Fast | Low | Performance-critical code |
| JVM | Medium | Fast | High | Java compatibility |
| WASM | Fast | Fast | Low | Web/portable |
| Bytecode | Fast | Medium | Medium | Education |
| LLVM | Slow (JIT) | Very Fast | Medium | Long-running workloads |
| Custom | Fast | Variable | Variable | Domain-specific |
| Hybrid | Slow | Variable | High | Polyglot execution |

## Related Phases

- **Phase 19**: IR Generation - Creates intermediate representation
- **Phase 20**: Code Generation - Compiles IR to target code
- **Phase 21**: Runtime System - Executes generated code
- **Phase 22+**: Advanced execution features (threading, clustering, etc.)

## References

- [GC Algorithms](https://en.wikipedia.org/wiki/Garbage_collection_(computer_science))
- [LLVM Execution Engine](https://llvm.org/docs/ExecutionEngine/)
- [WebAssembly Spec](https://webassembly.org/)
- [JVM Architecture](https://docs.oracle.com/javase/specs/)
