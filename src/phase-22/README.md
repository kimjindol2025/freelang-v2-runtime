# Phase 22: Advanced Runtime Features - Threading & Concurrency

## Overview

Phase 22 implements comprehensive threading and concurrency support for FreeLang v2, enabling:

- **Multi-threaded Execution**: Thread creation, lifecycle management, synchronization
- **Synchronization Primitives**: Mutex, Semaphore, RWLock, Condition Variables
- **Message Passing**: Unbuffered and buffered channels for inter-thread communication
- **Thread Pooling**: Fixed, cached, and dynamic thread pool implementations
- **Async/Await**: Future-like AsyncTask with promise-based execution model
- **Thread Local Storage**: Per-thread data storage and isolation

## Components

### 1. ThreadBase (src/phase-22/threading/thread-base.ts)

Core thread management class with lifecycle, state transitions, and local storage.

**Key Features**:
- Thread lifecycle: new → runnable → running → blocked/waiting → terminated
- Priority levels: low, normal, high, critical
- Thread-local storage for isolated per-thread data
- Sleep, yield, interrupt mechanisms
- Thread statistics and performance metrics

**Thread States**:
```
new → runnable → running → {blocked, waiting} → terminated
```

**Example**:
```typescript
const thread = new ThreadBase('worker', async () => {
  console.log('Running on thread');
  await thread.sleep(100);
}, { priority: 'high' });

await thread.start();
await thread.join();
```

**API Methods**:
- `start()` - Start thread execution
- `join(timeout_ms?)` - Wait for completion
- `interrupt()` - Request interruption
- `sleep(ms)` - Block for duration
- `yield()` - Yield to other threads
- `setLocal(key, value)` / `getLocal(key)` - Thread-local storage
- `setPriority(level)` - Change priority
- `getStats()` - Get execution statistics

### 2. Synchronization Primitives (src/phase-22/synchronization/sync-primitives.ts)

Thread-safe synchronization mechanisms for coordinated access.

#### Mutex (Mutual Exclusion)
Binary lock allowing only one thread at a time.

```typescript
const mutex = new Mutex('resource');

// Blocking lock
await mutex.lock();
// Critical section
mutex.unlock();

// Non-blocking try
if (mutex.tryLock()) {
  // Got lock
  mutex.unlock();
}
```

#### Semaphore (Counting Semaphore)
Allows multiple threads up to a count (resource pooling).

```typescript
const sem = new Semaphore('pool', 3, 3); // 3 permits

await sem.acquire();
// Use resource
sem.release();
```

#### RWLock (Reader-Writer Lock)
Multiple readers OR single writer pattern.

```typescript
const lock = new RWLock('data');

// Readers
await lock.readLock();
// Read data
lock.readUnlock();

// Writer
await lock.writeLock();
// Modify data
lock.writeUnlock();
```

#### ConditionVariable
Thread wait/notify pattern for synchronization.

```typescript
const cv = new ConditionVariable('signal');

// Waiter
await cv.wait();

// Notifier
cv.notify();  // Wake one
cv.notifyAll(); // Wake all
```

### 3. Channels (src/phase-22/concurrency/channel.ts)

Safe message passing between threads (similar to Go channels).

```typescript
// Unbuffered channel (blocking)
const [sender, receiver] = channel<number>();

// Buffered channel (capacity)
const [sender, receiver] = bufferedChannel<string>(10);

// Send
await sender.send(42);

// Receive
const value = await receiver.recv();

// Non-blocking
sender.trySend(42);
const value = receiver.tryRecv();

// Close
receiver.close();
```

**Example: Producer-Consumer**:
```typescript
const [sender, receiver] = bufferedChannel<number>(5);

// Producer thread
const producer = new ThreadBase('producer', async () => {
  for (let i = 0; i < 10; i++) {
    await sender.send(i);
  }
});

// Consumer thread
const consumer = new ThreadBase('consumer', async () => {
  while (true) {
    const value = await receiver.recv();
    if (!value) break;
    console.log('Received:', value);
  }
});

await producer.start();
await consumer.start();
```

### 4. ThreadPool (src/phase-22/concurrency/thread-pool.ts)

Efficient thread pooling for task execution.

```typescript
// Fixed-size pool (4 threads)
const pool = newFixedThreadPool(4, 'fixed');

// Submit task
const result = await pool.execute(async () => {
  return 42;
});

// Shutdown (wait for tasks)
await pool.shutdown();
```

**Pool Types**:

**Fixed Pool**: Constant number of threads
```typescript
const pool = newFixedThreadPool(4, 'fixed');
```

**Cached Pool**: Grows as needed
```typescript
const pool = newCachedThreadPool('cached');
```

**Dynamic Pool**: Scales between min/max
```typescript
const pool = newDynamicThreadPool(2, 8, 'dynamic');
```

**API Methods**:
- `execute<R>(fn)` - Execute and wait for result
- `submit<R>(fn)` - Submit task (returns Promise)
- `shutdown()` - Graceful shutdown (wait for tasks)
- `shutdownNow()` - Interrupt all tasks
- `getActiveCount()` - Active threads
- `getTotalCount()` - Total threads
- `getQueuedCount()` - Queued tasks
- `getStats()` - Pool statistics

### 5. Async Tasks (src/phase-22/async/async-task.ts)

Future-like execution model with async/await support.

```typescript
// Create task
const task = new AsyncTask<number>((resolve, reject) => {
  setTimeout(() => resolve(42), 100);
});

// Await result
const result = await task.await();

// Chain operations
const doubled = await task
  .then(x => x * 2)
  .then(x => x + 1)
  .await();

// Error handling
const fallback = await task
  .catch(error => 99)
  .await();

// Finally
await task.finally(() => {
  console.log('Cleanup');
});
```

**AsyncTask Features**:
- Resolution/rejection
- Cancellation
- Chaining (then/catch/finally)
- Timeout support
- Multiple awaiters
- Statistics

**Utilities**:
```typescript
// Resolved/rejected values
const resolved = asyncUtils.resolved(42);
const rejected = asyncUtils.rejected(new Error('Failed'));

// All/race
const results = await asyncUtils.all([task1, task2, task3]);
const first = await asyncUtils.race([task1, task2]);

// Sleep
await asyncUtils.sleep(1000).await();
```

## Concurrency Patterns

### 1. Mutex-Protected Critical Section
```typescript
const mutex = new Mutex('resource');

const thread1 = new ThreadBase('t1', async () => {
  await mutex.lock();
  try {
    // Critical section
  } finally {
    mutex.unlock();
  }
});
```

### 2. Semaphore-Based Resource Pool
```typescript
const pool = new Semaphore('connections', 5, 5);

const worker = new ThreadBase('worker', async () => {
  await pool.acquire();
  try {
    // Use resource
  } finally {
    pool.release();
  }
});
```

### 3. Reader-Writer Workload
```typescript
const lock = new RWLock('cache');

// Many readers
for (let i = 0; i < 10; i++) {
  new ThreadBase(`reader-${i}`, async () => {
    await lock.readLock();
    try {
      // Read shared data
    } finally {
      lock.readUnlock();
    }
  }).start();
}

// Single writer
const writer = new ThreadBase('writer', async () => {
  await lock.writeLock();
  try {
    // Update shared data
  } finally {
    lock.writeUnlock();
  }
});
```

### 4. Producer-Consumer with Channels
```typescript
const [sender, receiver] = bufferedChannel<WorkItem>(10);

const producer = new ThreadBase('producer', async () => {
  for (const item of items) {
    await sender.send(item);
  }
  receiver.close();
});

const consumer = new ThreadBase('consumer', async () => {
  while (true) {
    const item = await receiver.recv();
    if (!item) break;
    processItem(item);
  }
});
```

### 5. Thread Pool with Multiple Tasks
```typescript
const pool = newFixedThreadPool(4, 'workers');

const tasks = [];
for (let i = 0; i < 100; i++) {
  tasks.push(pool.execute(async () => {
    return await doWork(i);
  }));
}

const results = await Promise.all(tasks);
await pool.shutdown();
```

## Performance Characteristics

| Component | Overhead | Best For |
|-----------|----------|----------|
| ThreadBase | Low | Lightweight concurrency |
| Mutex | Very Low | Simple locking |
| Semaphore | Low | Resource pooling |
| RWLock | Medium | Read-heavy workloads |
| Channel (unbuffered) | Medium | Synchronization |
| Channel (buffered) | Low | Decoupled work |
| ThreadPool | Low | Task execution |
| AsyncTask | Very Low | Async operations |

## Limitations & Future Enhancements

### Current Limitations
- Single-threaded JavaScript execution model (uses async/await)
- No true parallel execution without native threading support
- No atomic operations or lock-free data structures (Phase 2)
- No distributed locking or clustering (Phase 3)

### Planned Enhancements (Phase 2)
- Native thread support (via native FFI)
- Atomic operations and memory ordering
- Lock-free data structures (ConcurrentHashMap, etc.)
- Work-stealing thread pools
- Distributed locks and remote channels

### Planned Enhancements (Phase 3)
- Thread clustering across multiple processes
- Distributed channels (network-based)
- Remote thread execution
- Consensus-based locking

## Memory Management

### Thread-Local Storage
Each thread maintains isolated storage preventing data races:

```typescript
thread.setLocal('db-connection', connection);
thread.setLocal('request-id', id);
```

### Stack Size
Configurable per-thread (default 8MB):

```typescript
new ThreadBase('large-stack', fn, { stack_size: 16 });
```

### Garbage Collection
No special GC coordination needed - relies on host JavaScript GC.

## Testing

**Total Tests**: 125 tests across threading, synchronization, channels, thread pool, and async tasks

- **Threading**: 60 tests (lifecycle, management, TLS, primitives)
- **Synchronization**: Included in threading
- **Concurrency**: 65 tests (channels, thread pool, async tasks)

**Estimated Run Time**: 30-60 seconds (due to thread synchronization delays)

## Integration with Other Phases

- **Phase 21**: Runtime System Integration - Executes threaded code
- **Phase 22**: Advanced Runtime Features (this phase)
- **Phase 23+**: Cloud native, distributed execution

## References

- [Java Concurrency](https://docs.oracle.com/javase/tutorial/essential/concurrency/)
- [Go Concurrency](https://golang.org/doc/effective_go#concurrency)
- [Rust std::thread](https://doc.rust-lang.org/std/thread/)
- [JavaScript async/await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)

## Architecture Diagram

```
ThreadBase (Core)
├── Thread Lifecycle
├── Thread-Local Storage
├── Priority Management
└── Statistics

Synchronization Layer
├── Mutex (binary lock)
├── Semaphore (counting)
├── RWLock (multi-reader)
└── ConditionVariable (wait/notify)

Concurrency Layer
├── Channel (message passing)
│   ├── Sender<T>
│   └── Receiver<T>
├── ThreadPool (task execution)
│   ├── PoolWorker (thread)
│   └── Task Queue
└── AsyncTask (future)
    ├── Resolution/Rejection
    ├── Chaining (then/catch)
    └── Utilities (all/race/sleep)
```

## Known Issues

1. **Test Timeouts**: Some synchronization tests may timeout due to simulation overhead
2. **No Real Parallelism**: JavaScript single-threaded model limits true parallel execution
3. **Memory Overhead**: Thread-local storage per thread adds memory

## Future Direction

Phase 22 lays the foundation for:
1. **Phase 23**: Distributed systems (clustering, remote execution)
2. **Phase 24**: Real-time systems (real-time scheduling, priority inheritance)
3. **Phase 25**: Reactive programming (event streams, back-pressure)
