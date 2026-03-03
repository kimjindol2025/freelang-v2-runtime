/**
 * Phase 18: Worker Pool (Worker 수명주기 관리)
 *
 * 책임:
 * 1. Worker 프로세스 생성 및 추적
 * 2. Worker 상태 모니터링
 * 3. 자동 재시작 로직
 * 4. 우아한 종료 (Graceful Shutdown)
 */

import * as cluster from 'cluster';

/**
 * Worker 상태
 */
export type WorkerStatus = 'idle' | 'busy' | 'unhealthy' | 'restarting' | 'terminated';

/**
 * Worker 정보
 */
export interface WorkerInfo {
  id: number;
  clusterId: number;
  pid: number;
  port: number;
  status: WorkerStatus;
  createdAt: number;
  lastHealthCheck: number;
  totalRequests: number;
  errorCount: number;
  restartCount: number;
}

/**
 * Worker Pool 설정
 */
export interface WorkerPoolConfig {
  workerCount: number;
  basePort: number;
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  maxRestarts?: number;
  gracefulShutdownTimeout?: number;
}

/**
 * Worker Pool 구현
 */
export class WorkerPool {
  private workers: Map<number, WorkerInfo> = new Map();
  private config: Required<WorkerPoolConfig>;
  private healthCheckTimer: NodeJS.Timer | null = null;
  private restartCounts: Map<number, number> = new Map();

  constructor(config: WorkerPoolConfig) {
    this.config = {
      healthCheckInterval: 5000,
      healthCheckTimeout: 10000,
      maxRestarts: 5,
      gracefulShutdownTimeout: 5000,
      ...config
    };
  }

  /**
   * Worker 풀 초기화 (모든 Worker 생성)
   */
  async initialize(): Promise<void> {
    console.log(`📦 Initializing Worker Pool (${this.config.workerCount} workers)`);

    for (let i = 0; i < this.config.workerCount; i++) {
      const workerId = i;
      const port = this.config.basePort + i;

      await this.spawnWorker(workerId, port);
    }

    // Health Check 시작
    this.startHealthCheck();

    console.log(`✅ Worker Pool initialized with ${this.config.workerCount} workers`);
  }

  /**
   * Worker 프로세스 생성
   */
  private async spawnWorker(workerId: number, port: number): Promise<void> {
    try {
      // Node.js 18+: isPrimary, 이전: isMaster
      const isMaster = (cluster as any).isPrimary ?? (cluster as any).isMaster;
      if (!isMaster) {
        throw new Error('spawnWorker() can only be called from master process');
      }

      const worker = (cluster as any).fork({
        WORKER_ID: String(workerId),
        PORT: String(port)
      });

      const now = Date.now();
      this.workers.set(workerId, {
        id: workerId,
        clusterId: worker.id,
        pid: worker.process.pid || 0,
        port,
        status: 'idle',
        createdAt: now,
        lastHealthCheck: now,
        totalRequests: 0,
        errorCount: 0,
        restartCount: this.restartCounts.get(workerId) || 0
      });

      console.log(`✅ Worker ${workerId} spawned (PID: ${worker.process.pid}, Port: ${port})`);
    } catch (error) {
      console.error(`❌ Failed to spawn Worker ${workerId}:`, error);
      throw error;
    }
  }

  /**
   * Worker 정보 업데이트
   */
  updateWorkerInfo(workerId: number, update: Partial<WorkerInfo>): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      Object.assign(worker, update);
    }
  }

  /**
   * Worker 상태 조회
   */
  getWorkerInfo(workerId: number): WorkerInfo | undefined {
    return this.workers.get(workerId);
  }

  /**
   * 모든 Worker 상태 조회
   */
  getAllWorkers(): WorkerInfo[] {
    return Array.from(this.workers.values());
  }

  /**
   * 건강한 Worker 목록
   */
  getHealthyWorkers(): WorkerInfo[] {
    return Array.from(this.workers.values()).filter(w => w.status !== 'unhealthy' && w.status !== 'terminated');
  }

  /**
   * Worker 재시작
   */
  async restartWorker(workerId: number): Promise<boolean> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      console.error(`❌ Worker ${workerId} not found`);
      return false;
    }

    // 재시작 횟수 체크
    const restartCount = (this.restartCounts.get(workerId) || 0) + 1;
    if (restartCount > this.config.maxRestarts) {
      console.error(`❌ Worker ${workerId} exceeded max restarts (${restartCount})`);
      worker.status = 'terminated';
      return false;
    }

    console.log(`🔄 Restarting Worker ${workerId} (restart count: ${restartCount})`);

    // 기존 Worker 종료
    await this.terminateWorkerProcess(workerId);

    // 새 Worker 생성
    this.restartCounts.set(workerId, restartCount);
    worker.restartCount = restartCount;

    try {
      await this.spawnWorker(workerId, worker.port);
      return true;
    } catch (error) {
      console.error(`❌ Failed to restart Worker ${workerId}:`, error);
      return false;
    }
  }

  /**
   * Worker 프로세스 종료
   */
  private async terminateWorkerProcess(workerId: number): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    try {
      // 클러스터 Worker 객체 찾기
      const clusterWorkers = (cluster as any).workers;
      const clusterWorker = clusterWorkers?.[worker.clusterId];

      if (clusterWorker) {
        // 우아한 종료 시도
        clusterWorker.kill('SIGTERM');

        // 타임아웃 후 강제 종료
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            if (!clusterWorker.isDead?.()) {
              clusterWorker.kill('SIGKILL');
            }
            resolve();
          }, this.config.gracefulShutdownTimeout);
        });
      }
    } catch (error) {
      console.error(`⚠️ Error terminating Worker ${workerId}:`, error);
    }
  }

  /**
   * Health Check 시작
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Health Check 수행
   */
  private performHealthCheck(): void {
    const now = Date.now();

    for (const [workerId, worker] of this.workers) {
      const timeSinceCheck = now - worker.lastHealthCheck;

      // 타임아웃 확인 (10초 이상 응답 없음)
      if (timeSinceCheck > this.config.healthCheckTimeout) {
        console.warn(`⚠️ Worker ${workerId} health check timeout (${timeSinceCheck}ms)`);

        worker.status = 'unhealthy';

        // 자동 재시작
        this.restartWorker(workerId).catch((error) => {
          console.error(`❌ Auto-restart failed for Worker ${workerId}:`, error);
        });
      }
    }
  }

  /**
   * Health Check 중지
   */
  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer as NodeJS.Timeout);
      this.healthCheckTimer = null;
    }
  }

  /**
   * 모든 Worker 종료 (우아한 종료)
   */
  async shutdown(): Promise<void> {
    console.log(`🛑 Shutting down Worker Pool...`);

    this.stopHealthCheck();

    // 모든 Worker 종료
    const promises: Promise<void>[] = [];
    for (const worker of this.workers.values()) {
      promises.push(this.terminateWorkerProcess(worker.id));
    }

    await Promise.all(promises);

    console.log(`✅ Worker Pool shut down`);
  }

  /**
   * Worker 풀 통계
   */
  getStats(): {
    totalWorkers: number;
    healthyWorkers: number;
    totalRequests: number;
    totalErrors: number;
    avgUptimeMs: number;
  } {
    const workers = Array.from(this.workers.values());
    const now = Date.now();

    return {
      totalWorkers: workers.length,
      healthyWorkers: workers.filter(w => w.status !== 'unhealthy' && w.status !== 'terminated').length,
      totalRequests: workers.reduce((sum, w) => sum + w.totalRequests, 0),
      totalErrors: workers.reduce((sum, w) => sum + w.errorCount, 0),
      avgUptimeMs: workers.length > 0
        ? Math.round(workers.reduce((sum, w) => sum + (now - w.createdAt), 0) / workers.length)
        : 0
    };
  }
}
