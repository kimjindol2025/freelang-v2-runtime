/**
 * Phase 10: Threading & Concurrency
 *
 * 멀티스레드:
 * - spawn_thread(fn) - 스레드 생성
 * - join(thread) - 스레드 대기
 * - thread_pool(size) - 스레드 풀
 * - mutex/lock - 동기화
 * - channel - 메시지 패싱
 */

import * as os from 'os';
import { EventEmitter } from 'events';

/**
 * 스레드 상태
 */
export type ThreadState = 'pending' | 'running' | 'completed' | 'failed';

/**
 * 스레드 객체
 */
export interface Thread<T> {
  id: string;
  state: ThreadState;
  result?: T;
  error?: string;
  duration: number;
  startTime: number;
}

/**
 * 뮤텍스 (상호 배제)
 */
export class Mutex {
  private locked = false;
  private waitQueue: Array<() => void> = [];

  /**
   * 락 획득
   */
  async lock(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.waitQueue.push(resolve);
      }
    });
  }

  /**
   * 락 해제
   */
  unlock(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }

  /**
   * 락과 함께 실행
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.lock();
    try {
      return await fn();
    } finally {
      this.unlock();
    }
  }
}

/**
 * 채널 (메시지 패싱)
 */
export class Channel<T> extends EventEmitter {
  private messages: T[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    super();
    this.maxSize = maxSize;
  }

  /**
   * 메시지 보내기
   */
  async send(message: T): Promise<void> {
    if (this.messages.length >= this.maxSize) {
      return new Promise((resolve) => {
        this.once('drained', () => {
          this.messages.push(message);
          this.emit('message');
          resolve();
        });
      });
    }
    this.messages.push(message);
    this.emit('message');
  }

  /**
   * 메시지 받기
   */
  async receive(): Promise<T> {
    while (this.messages.length === 0) {
      await new Promise((resolve) => {
        this.once('message', resolve);
      });
    }
    const message = this.messages.shift()!;
    if (this.messages.length === 0) {
      this.emit('drained');
    }
    return message;
  }

  /**
   * 즉시 받기 (없으면 undefined)
   */
  tryReceive(): T | undefined {
    const message = this.messages.shift();
    if (this.messages.length === 0) {
      this.emit('drained');
    }
    return message;
  }

  /**
   * 큐 크기
   */
  size(): number {
    return this.messages.length;
  }
}

/**
 * 스레드 관리자
 */
export class ThreadManager {
  private threads: Map<string, Thread<any>> = new Map();
  private threadIdCounter = 0;

  /**
   * 스레드 생성 및 실행
   */
  async spawnThread<T>(
    fn: () => Promise<T> | T,
    name?: string
  ): Promise<Thread<T>> {
    const id = `thread_${++this.threadIdCounter}`;
    const thread: Thread<T> = {
      id,
      state: 'pending',
      duration: 0,
      startTime: performance.now(),
    };

    this.threads.set(id, thread);

    // 비동기로 실행
    setImmediate(async () => {
      try {
        thread.state = 'running';
        thread.result = await fn();
        thread.state = 'completed';
      } catch (error) {
        thread.error = String(error);
        thread.state = 'failed';
      } finally {
        thread.duration = performance.now() - thread.startTime;
      }
    });

    return thread;
  }

  /**
   * 스레드 대기
   */
  async join<T>(thread: Thread<T>, timeoutMs?: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (thread.state === 'completed') {
          clearInterval(checkInterval);
          if (timeout) clearTimeout(timeout);
          resolve(thread.result!);
        } else if (thread.state === 'failed') {
          clearInterval(checkInterval);
          if (timeout) clearTimeout(timeout);
          reject(new Error(thread.error));
        }
      }, 10);

      let timeout: NodeJS.Timeout | null = null;
      if (timeoutMs) {
        timeout = setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error(`Thread ${thread.id} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
    });
  }

  /**
   * 모든 스레드 대기
   */
  async joinAll(): Promise<Map<string, any>> {
    const results = new Map();
    for (const [id, thread] of this.threads) {
      try {
        const result = await this.join(thread);
        results.set(id, result);
      } catch (error) {
        results.set(id, { error: String(error) });
      }
    }
    return results;
  }

  /**
   * 스레드 상태 조회
   */
  getThreadStatus(threadId: string): Thread<any> | undefined {
    return this.threads.get(threadId);
  }

  /**
   * 모든 스레드 상태
   */
  getAllThreadStatus(): Thread<any>[] {
    return Array.from(this.threads.values());
  }

  /**
   * 스레드 개수
   */
  getThreadCount(): number {
    return this.threads.size;
  }
}

/**
 * 스레드 풀
 */
export class ThreadPool {
  private queue: Array<() => Promise<any>> = [];
  private activeThreads = 0;
  private poolSize: number;
  private results: any[] = [];

  constructor(poolSize: number = os.cpus().length) {
    this.poolSize = poolSize;
  }

  /**
   * 작업 추가
   */
  addTask<T>(fn: () => Promise<T> | T): void {
    this.queue.push(async () => {
      return fn();
    });
  }

  /**
   * 모든 작업 실행
   */
  async run(): Promise<any[]> {
    this.results = [];
    const promises: Promise<void>[] = [];

    for (let i = 0; i < this.poolSize; i++) {
      promises.push(this.worker());
    }

    await Promise.all(promises);
    return this.results;
  }

  /**
   * 워커 스레드
   */
  private async worker(): Promise<void> {
    while (true) {
      const task = this.queue.shift();
      if (!task) break;

      this.activeThreads++;
      try {
        const result = await task();
        this.results.push(result);
      } catch (error) {
        this.results.push({ error: String(error) });
      } finally {
        this.activeThreads--;
      }
    }
  }

  /**
   * 활성 스레드 개수
   */
  getActiveThreadCount(): number {
    return this.activeThreads;
  }

  /**
   * 대기 중인 작업 개수
   */
  getPendingTaskCount(): number {
    return this.queue.length;
  }

  /**
   * 진행 상황
   */
  getProgress(): { completed: number; total: number; percent: number } {
    const total = this.results.length + this.queue.length;
    const completed = this.results.length;
    return {
      completed,
      total,
      percent: total > 0 ? (completed / total) * 100 : 100,
    };
  }
}

/**
 * 병렬 맵 (데이터 분할)
 */
export async function parallelMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R> | R,
  threadCount: number = os.cpus().length
): Promise<R[]> {
  const pool = new ThreadPool(threadCount);
  const results: R[] = new Array(items.length);

  for (let i = 0; i < items.length; i++) {
    const index = i;
    const item = items[i];
    pool.addTask(async () => {
      results[index] = await fn(item, index);
      return results[index];
    });
  }

  await pool.run();
  return results;
}

/**
 * 병렬 필터
 */
export async function parallelFilter<T>(
  items: T[],
  predicate: (item: T) => Promise<boolean> | boolean,
  threadCount: number = os.cpus().length
): Promise<T[]> {
  const mapped = await parallelMap(
    items,
    async (item) => ({ item, match: await predicate(item) }),
    threadCount
  );
  return mapped.filter((m) => m.match).map((m) => m.item);
}

/**
 * 테스트
 */
export async function testThreading(): Promise<void> {
  console.log('=== Threading Tests ===\n');

  // 1. 스레드 생성
  console.log('1️⃣ Create Thread:');
  const manager = new ThreadManager();
  const thread = await manager.spawnThread(async () => {
    await new Promise((r) => setTimeout(r, 100));
    return 'Hello from thread';
  });
  console.log(`   ✅ Thread created: ${thread.id}`);

  // 2. 스레드 대기
  console.log('\n2️⃣ Join Thread:');
  const result = await manager.join(thread);
  console.log(`   ✅ Result: ${result} (${thread.duration.toFixed(2)}ms)`);

  // 3. 뮤텍스
  console.log('\n3️⃣ Mutex:');
  let counter = 0;
  const mutex = new Mutex();
  const tasks = Array.from({ length: 10 }, () =>
    mutex.withLock(async () => {
      counter++;
      await new Promise((r) => setTimeout(r, 10));
    })
  );
  await Promise.all(tasks);
  console.log(`   ✅ Counter: ${counter} (expected 10)`);

  // 4. 채널
  console.log('\n4️⃣ Channel:');
  const channel = new Channel<number>(10);
  await channel.send(42);
  const msg = await channel.receive();
  console.log(`   ✅ Message: ${msg}`);

  // 5. 스레드 풀
  console.log('\n5️⃣ Thread Pool:');
  const pool = new ThreadPool(4);
  for (let i = 0; i < 10; i++) {
    pool.addTask(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return i * 2;
    });
  }
  const poolResults = await pool.run();
  console.log(`   ✅ Results: ${poolResults.length} items`);

  // 6. 병렬 맵
  console.log('\n6️⃣ Parallel Map:');
  const items = [1, 2, 3, 4, 5];
  const mapped = await parallelMap(items, async (n) => {
    await new Promise((r) => setTimeout(r, 20));
    return n * 2;
  }, 2);
  console.log(`   ✅ Mapped: ${mapped.join(',')}`);

  // 7. 병렬 필터
  console.log('\n7️⃣ Parallel Filter:');
  const filtered = await parallelFilter(
    items,
    async (n) => {
      await new Promise((r) => setTimeout(r, 20));
      return n > 2;
    },
    2
  );
  console.log(`   ✅ Filtered: ${filtered.join(',')}`);

  console.log('\n✅ All threading tests completed!');
}
