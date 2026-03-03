/**
 * Phase 9: Async/Await & Concurrency
 *
 * 비동기 기능:
 * - async/await 패턴
 * - Promise 지원
 * - 병렬 처리 (spawn)
 * - 타임아웃 관리
 * - 에러 처리
 */

/**
 * 비동기 작업 결과
 */
export interface AsyncResult<T> {
  success: boolean;
  value?: T;
  error?: string;
  duration: number; // milliseconds
}

/**
 * 비동기 함수 타입
 */
export type AsyncFunction<T> = () => Promise<T>;

/**
 * 병렬 작업 결과
 */
export interface ConcurrentResult<T> {
  completed: number;
  failed: number;
  results: Array<AsyncResult<T>>;
  totalDuration: number;
}

/**
 * 비동기 유틸리티
 */
export class AsyncUtils {
  /**
   * 타임아웃 래퍼
   */
  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string = 'Operation'
  ): Promise<T> {
    const timeoutPromise = new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * 재시도 로직
   */
  static async retry<T>(
    fn: AsyncFunction<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await this.delay(delayMs);
        }
      }
    }

    throw lastError;
  }

  /**
   * 지연
   */
  static async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 순차 처리
   */
  static async sequential<T>(
    tasks: Array<AsyncFunction<T>>
  ): Promise<AsyncResult<T>[]> {
    const results: AsyncResult<T>[] = [];

    for (const task of tasks) {
      const start = performance.now();
      try {
        const value = await task();
        results.push({
          success: true,
          value,
          duration: performance.now() - start,
        });
      } catch (error) {
        results.push({
          success: false,
          error: String(error),
          duration: performance.now() - start,
        });
      }
    }

    return results;
  }

  /**
   * 병렬 처리 (제한 있음)
   */
  static async parallel<T>(
    tasks: Array<AsyncFunction<T>>,
    concurrency: number = 5
  ): Promise<ConcurrentResult<T>> {
    const start = performance.now();
    const results: AsyncResult<T>[] = [];
    let completed = 0;
    let failed = 0;

    // 작업 큐
    const queue = [...tasks];
    const running = new Set<Promise<void>>();

    while (queue.length > 0 || running.size > 0) {
      // 새 작업 시작
      while (running.size < concurrency && queue.length > 0) {
        const task = queue.shift()!;
        const taskPromise = (async () => {
          const taskStart = performance.now();
          try {
            const value = await task();
            results.push({
              success: true,
              value,
              duration: performance.now() - taskStart,
            });
            completed++;
          } catch (error) {
            results.push({
              success: false,
              error: String(error),
              duration: performance.now() - taskStart,
            });
            failed++;
          }
        })();

        running.add(taskPromise);
        taskPromise.then(() => running.delete(taskPromise));
      }

      // 하나의 작업이 완료될 때까지 대기
      if (running.size > 0) {
        await Promise.race(running);
      }
    }

    return {
      completed,
      failed,
      results,
      totalDuration: performance.now() - start,
    };
  }

  /**
   * Promise.all 래퍼
   */
  static async all<T>(promises: Promise<T>[]): Promise<T[]> {
    return Promise.all(promises);
  }

  /**
   * Promise.race 래퍼
   */
  static async race<T>(promises: Promise<T>[]): Promise<T> {
    return Promise.race(promises);
  }

  /**
   * 결과 처리
   */
  static async handle<T>(promise: Promise<T>): Promise<AsyncResult<T>> {
    const start = performance.now();
    try {
      const value = await promise;
      return {
        success: true,
        value,
        duration: performance.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
        duration: performance.now() - start,
      };
    }
  }
}

/**
 * 스폰 (병렬 작업 시작)
 */
export class Spawn {
  /**
   * 단일 작업 스폰
   */
  static async run<T>(fn: AsyncFunction<T>): Promise<AsyncResult<T>> {
    return AsyncUtils.handle(fn());
  }

  /**
   * 여러 작업 스폰 (동시에)
   */
  static async runMany<T>(
    tasks: Array<AsyncFunction<T>>,
    concurrency?: number
  ): Promise<ConcurrentResult<T>> {
    return AsyncUtils.parallel(tasks, concurrency);
  }

  /**
   * 맵 (각 항목에 함수 적용, 병렬)
   */
  static async map<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    concurrency: number = 5
  ): Promise<AsyncResult<R>[]> {
    const tasks = items.map((item) => () => fn(item));
    const result = await AsyncUtils.parallel(tasks, concurrency);
    return result.results;
  }

  /**
   * 필터 (조건에 맞는 항목 필터링, 병렬)
   */
  static async filter<T>(
    items: T[],
    predicate: (item: T) => Promise<boolean>,
    concurrency: number = 5
  ): Promise<T[]> {
    const results = await this.map(
      items,
      async (item) => ({ item, match: await predicate(item) }),
      concurrency
    );
    return results
      .filter((r) => r.success && r.value?.match)
      .map((r) => r.value!.item);
  }

  /**
   * 우선 완료된 것 (race)
   */
  static async first<T>(tasks: Array<AsyncFunction<T>>): Promise<AsyncResult<T>> {
    const promises = tasks.map((task) => task());
    return AsyncUtils.handle(Promise.race(promises));
  }

  /**
   * 모두 완료 대기
   */
  static async all<T>(tasks: Array<AsyncFunction<T>>): Promise<AsyncResult<T>[]> {
    const promises = tasks.map((task) => task());
    return Promise.all(promises.map((p) => AsyncUtils.handle(p)));
  }
}

/**
 * 비동기 체인
 */
export class AsyncChain<T> {
  private promise: Promise<T>;

  constructor(promise: Promise<T>) {
    this.promise = promise;
  }

  /**
   * then 체인
   */
  then<R>(fn: (value: T) => Promise<R>): AsyncChain<R> {
    return new AsyncChain(this.promise.then(fn));
  }

  /**
   * catch 체인
   */
  catch<R>(fn: (error: any) => Promise<R>): AsyncChain<T | R> {
    return new AsyncChain(this.promise.catch(fn));
  }

  /**
   * finally 체인
   */
  finally(fn: () => Promise<void>): AsyncChain<T> {
    return new AsyncChain(
      this.promise.finally(async () => {
        await fn();
      })
    );
  }

  /**
   * await 가능
   */
  async awaitResult(): Promise<T> {
    return this.promise;
  }
}

/**
 * 테스트 함수
 */
export async function testAsyncConcurrency(): Promise<void> {
  console.log('=== Async & Concurrency Tests ===\n');

  // 1. 기본 async/await
  console.log('1️⃣ Basic Async/Await:');
  const task1 = async () => {
    await AsyncUtils.delay(100);
    return 'Task 1 completed';
  };
  const result1 = await AsyncUtils.handle(task1());
  console.log(`✅ Result: ${result1.value} (${result1.duration.toFixed(2)}ms)`);

  // 2. 타임아웃
  console.log('\n2️⃣ Timeout Handling:');
  try {
    await AsyncUtils.withTimeout(AsyncUtils.delay(1000), 500, 'Delay');
    console.log('❌ Should have timed out');
  } catch (error) {
    console.log(`✅ Timeout caught: ${String(error)}`);
  }

  // 3. 재시도
  console.log('\n3️⃣ Retry Logic:');
  let attempts = 0;
  const retryTask = async () => {
    attempts++;
    if (attempts < 3) throw new Error(`Attempt ${attempts} failed`);
    return `Success on attempt ${attempts}`;
  };
  const retryResult = await AsyncUtils.retry(retryTask, 5, 100);
  console.log(`✅ Retry result: ${retryResult} (${attempts} attempts)`);

  // 4. 순차 처리
  console.log('\n4️⃣ Sequential Processing:');
  const seqTasks = [
    async () => {
      await AsyncUtils.delay(50);
      return 'Task 1';
    },
    async () => {
      await AsyncUtils.delay(50);
      return 'Task 2';
    },
    async () => {
      await AsyncUtils.delay(50);
      return 'Task 3';
    },
  ];
  const seqResults = await AsyncUtils.sequential(seqTasks);
  console.log(
    `✅ Sequential: ${seqResults.length} tasks, ${seqResults.reduce((a, r) => a + r.duration, 0).toFixed(2)}ms total`
  );

  // 5. 병렬 처리
  console.log('\n5️⃣ Parallel Processing:');
  const parTasks = Array.from({ length: 10 }, (_, i) => async () => {
    await AsyncUtils.delay(100);
    return `Task ${i + 1}`;
  });
  const parResult = await AsyncUtils.parallel(parTasks, 3);
  console.log(
    `✅ Parallel: ${parResult.completed}/${parResult.completed + parResult.failed} completed in ${parResult.totalDuration.toFixed(2)}ms`
  );

  // 6. Spawn - 단일 작업
  console.log('\n6️⃣ Spawn - Single Task:');
  const spawnResult = await Spawn.run(async () => {
    await AsyncUtils.delay(100);
    return 'Spawned task completed';
  });
  console.log(`✅ Spawned: ${spawnResult.value} (${spawnResult.duration.toFixed(2)}ms)`);

  // 7. Spawn - 맵
  console.log('\n7️⃣ Spawn - Map:');
  const items = [1, 2, 3, 4, 5];
  const mapResults = await Spawn.map(
    items,
    async (n) => {
      await AsyncUtils.delay(50);
      return n * 2;
    },
    2
  );
  const mapValues = mapResults.filter((r) => r.success).map((r) => r.value);
  console.log(`✅ Map: ${mapValues.join(', ')}`);

  // 8. 비동기 체인
  console.log('\n8️⃣ Async Chain:');
  const chainResult = await new AsyncChain(Promise.resolve(10))
    .then(async (n) => {
      await AsyncUtils.delay(50);
      return n * 2;
    })
    .then(async (n) => {
      await AsyncUtils.delay(50);
      return n + 5;
    })
    .awaitResult();
  console.log(`✅ Chain result: ${chainResult}`);

  console.log('\n✅ All async/concurrency tests completed!');
}
