/**
 * Event Loop Core
 * Microtask (Promise) vs Macrotask (Timer/IO) 분리
 * 
 * 구조:
 * ┌─ Microtask Queue (높은 우선순위)
 * │  ├─ Promise callbacks
 * │  └─ queueMicrotask()
 * ├─ Macrotask Queue (낮은 우선순위)
 * │  ├─ setTimeout/setInterval
 * │  ├─ File I/O
 * │  └─ Network I/O
 * └─ Priority Scheduler
 *    ├─ Task 선점
 *    └─ Metric 수집
 */

export enum TaskType {
  MICROTASK = 'microtask',    // Promise callbacks (높은 우선순위)
  MACROTASK = 'macrotask',    // Timer/IO (낮은 우선순위)
}

export enum TaskPriority {
  CRITICAL = 0,   // 모니터링, 알러트
  HIGH = 1,       // 사용자 입력, Promise
  NORMAL = 2,     // 일반 작업
  LOW = 3,        // 백그라운드
  IDLE = 4,       // CPU 유휴 시간
}

export interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  fn: () => Promise<any> | any;
  context?: any;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: Error;
}

export interface EventLoopMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  microtaskCount: number;
  macrotaskCount: number;
  averageTaskDuration: number;
  lastTaskDuration: number;
  eventLoopLag: number; // Scheduler 대기 시간
}

/**
 * Microtask Queue
 * 
 * 특성:
 * - Promise.then() callbacks
 * - queueMicrotask()
 * - 각 Macrotask 후에 모두 소진
 */
class MicrotaskQueue {
  private queue: Task[] = [];
  private processing = false;

  enqueue(task: Task): void {
    this.queue.push(task);
  }

  async drainAll(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try {
        task.startedAt = Date.now();
        await Promise.resolve(task.fn());
        task.completedAt = Date.now();
      } catch (error) {
        task.error = error as Error;
        console.error(`[EventLoop] Microtask failed: ${task.id}`, error);
      }
    }

    this.processing = false;
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}

/**
 * Macrotask Queue
 * 
 * 특성:
 * - setTimeout/setInterval
 * - File I/O
 * - Network I/O
 * - 우선순위 큐 (Heap 기반)
 */
class MacrotaskQueue {
  private queue: Task[] = [];

  enqueue(task: Task): void {
    this.queue.push(task);
    this.heapifyUp(this.queue.length - 1);
  }

  dequeue(): Task | undefined {
    if (this.queue.length === 0) return undefined;

    const task = this.queue[0];
    const lastTask = this.queue.pop()!;

    if (this.queue.length > 0) {
      this.queue[0] = lastTask;
      this.heapifyDown(0);
    }

    return task;
  }

  private heapifyUp(index: number): void {
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2);
      if (this.queue[parentIdx].priority <= this.queue[index].priority) break;

      [this.queue[parentIdx], this.queue[index]] = [
        this.queue[index],
        this.queue[parentIdx],
      ];
      index = parentIdx;
    }
  }

  private heapifyDown(index: number): void {
    while (true) {
      let smallest = index;
      const leftIdx = 2 * index + 1;
      const rightIdx = 2 * index + 2;

      if (
        leftIdx < this.queue.length &&
        this.queue[leftIdx].priority < this.queue[smallest].priority
      ) {
        smallest = leftIdx;
      }

      if (
        rightIdx < this.queue.length &&
        this.queue[rightIdx].priority < this.queue[smallest].priority
      ) {
        smallest = rightIdx;
      }

      if (smallest === index) break;

      [this.queue[smallest], this.queue[index]] = [
        this.queue[index],
        this.queue[smallest],
      ];
      index = smallest;
    }
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}

/**
 * Event Loop Core
 * 
 * 실행 순서:
 * 1. Macrotask 1개 실행
 * 2. Microtask Queue 모두 소진
 * 3. 반복
 */
export class EventLoopCore {
  private microtaskQueue = new MicrotaskQueue();
  private macrotaskQueue = new MacrotaskQueue();
  private running = false;
  private taskIdCounter = 0;
  private metrics: EventLoopMetrics = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    microtaskCount: 0,
    macrotaskCount: 0,
    averageTaskDuration: 0,
    lastTaskDuration: 0,
    eventLoopLag: 0,
  };

  /**
   * Microtask 추가 (Promise.then 등)
   */
  queueMicrotask(
    fn: () => Promise<any> | any,
    priority: TaskPriority = TaskPriority.HIGH
  ): string {
    const task: Task = {
      id: `microtask-${this.taskIdCounter++}`,
      type: TaskType.MICROTASK,
      priority,
      fn,
      createdAt: Date.now(),
    };

    this.microtaskQueue.enqueue(task);
    this.metrics.totalTasks++;
    this.metrics.microtaskCount++;

    return task.id;
  }

  /**
   * Macrotask 추가 (Timer/IO 등)
   */
  queueMacrotask(
    fn: () => Promise<any> | any,
    priority: TaskPriority = TaskPriority.NORMAL
  ): string {
    const task: Task = {
      id: `macrotask-${this.taskIdCounter++}`,
      type: TaskType.MACROTASK,
      priority,
      fn,
      createdAt: Date.now(),
    };

    this.macrotaskQueue.enqueue(task);
    this.metrics.totalTasks++;
    this.metrics.macrotaskCount++;

    return task.id;
  }

  /**
   * Event Loop 메인 루프
   * 
   * 실행 순서 (HTML standard):
   * 1. Macrotask 1개 실행
   * 2. Microtask Queue 모두 소진
   * 3. Rendering (skip for now)
   * 4. 반복
   */
  async run(): Promise<void> {
    if (this.running) {
      console.warn('[EventLoop] Already running');
      return;
    }

    this.running = true;

    while (this.running && (this.macrotaskQueue.size() > 0 || this.microtaskQueue.size() > 0)) {
      const loopStartTime = Date.now();

      // Step 1: Execute 1 Macrotask
      const macrotask = this.macrotaskQueue.dequeue();
      if (macrotask) {
        try {
          macrotask.startedAt = Date.now();
          await Promise.resolve(macrotask.fn());
          macrotask.completedAt = Date.now();
          this.metrics.completedTasks++;
        } catch (error) {
          macrotask.error = error as Error;
          this.metrics.failedTasks++;
          console.error(
            `[EventLoop] Macrotask failed: ${macrotask.id}`,
            error
          );
        }

        // Update metrics
        if (macrotask.completedAt) {
          this.metrics.lastTaskDuration = macrotask.completedAt - macrotask.startedAt!;
        }
      }

      // Step 2: Drain all Microtasks
      await this.microtaskQueue.drainAll();

      // Step 3: Update event loop lag
      const loopEndTime = Date.now();
      this.metrics.eventLoopLag = loopEndTime - loopStartTime;

      // Prevent busy-waiting
      if (this.macrotaskQueue.size() === 0 && this.microtaskQueue.size() === 0) {
        break;
      }
    }

    this.running = false;
    this.calculateAverageTaskDuration();
  }

  /**
   * Event Loop 중지
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Metrics 조회
   */
  getMetrics(): EventLoopMetrics {
    return { ...this.metrics };
  }

  /**
   * Event Loop 초기화
   */
  reset(): void {
    this.microtaskQueue.clear();
    this.macrotaskQueue.clear();
    this.running = false;
    this.taskIdCounter = 0;
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      microtaskCount: 0,
      macrotaskCount: 0,
      averageTaskDuration: 0,
      lastTaskDuration: 0,
      eventLoopLag: 0,
    };
  }

  private calculateAverageTaskDuration(): void {
    if (this.metrics.completedTasks === 0) {
      this.metrics.averageTaskDuration = 0;
      return;
    }

    // Placeholder: 실제로는 모든 completed task의 duration 평균
    this.metrics.averageTaskDuration = this.metrics.lastTaskDuration;
  }
}

// Singleton 인스턴스
export const eventLoopCore = new EventLoopCore();
