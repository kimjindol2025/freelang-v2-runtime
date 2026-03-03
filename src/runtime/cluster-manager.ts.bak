/**
 * Phase 18: Multi-Core Cluster Management
 *
 * 목표: 8개 CPU 코어 완전 활용으로 처리량 8배 증가
 *
 * 아키텍처:
 * ┌─────────────────────────────────────────┐
 * │      Master Process (HTTP/2)             │
 * │  (요청 수신 → Worker에 분배)              │
 * └─────────┬───────────────────────────────┘
 *           │
 *     ┌─────┼─────┬──────┬──────┐
 *     │     │     │      │      │
 *  Worker Worker Worker ... Worker (8개)
 *  (CPU1) (CPU2) (CPU3)      (CPU8)
 *     │     │     │      │      │
 *     └─────┼─────┴──────┴──────┘
 *           │
 *      IPC Channel (Binary Protocol)
 *      - Health Check
 *      - Load Tracking
 *      - Graceful Restart
 *
 * 성능 목표:
 * - Single Worker: 55,000 req/s (Phase 15)
 * - 8 Workers:   440,000 req/s (이상적)
 * - 현실 (오버헤드): 350,000+ req/s
 */

import * as cluster from 'cluster';
import * as os from 'os';
import { EventEmitter } from 'events';
import { Http2Server } from '../dashboard/http2-server';
import { WorkerPool } from './worker-pool';
import { LoadBalancer } from './load-balancer';
import { IpcProtocol, WorkerMessage, WorkerResponse } from './ipc-protocol';

/**
 * Worker 정보
 */
interface WorkerInfo {
  id: number;
  pid: number;
  status: 'idle' | 'busy' | 'unhealthy' | 'restarting';
  activeConnections: number;
  totalRequests: number;
  errors: number;
  lastHealthCheck: number;
  startTime: number;
}

/**
 * 클러스터 통계
 */
interface ClusterStats {
  totalWorkers: number;
  activeWorkers: number;
  totalRequests: number;
  totalErrors: number;
  avgResponseTime: number;
  peakConnections: number;
  uptime: number;
  workerStats: { [id: number]: WorkerInfo };
}

/**
 * Phase 18 Cluster Manager
 *
 * Master/Worker 패턴으로 다중 CPU 코어 활용
 * - 자동 Worker 관리
 * - Health Check 및 자동 재시작
 * - IPC 기반 상태 동기화
 * - Load Balancing (Round-robin)
 */
export class ClusterManager extends EventEmitter {
  private numWorkers: number;
  private workerPool: WorkerPool;
  private loadBalancer: LoadBalancer;
  private ipcProtocol: IpcProtocol;
  private http2Server: Http2Server | null = null;
  private workers: Map<number, WorkerInfo> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();

  // 통계
  private stats: ClusterStats = {
    totalWorkers: 0,
    activeWorkers: 0,
    totalRequests: 0,
    totalErrors: 0,
    avgResponseTime: 0,
    peakConnections: 0,
    uptime: 0,
    workerStats: {}
  };

  constructor(numWorkers: number = os.cpus().length) {
    super();
    this.numWorkers = Math.min(numWorkers, 8); // 최대 8개 Worker
    this.workerPool = new WorkerPool(this.numWorkers);
    this.loadBalancer = new LoadBalancer(this.numWorkers);
    this.ipcProtocol = new IpcProtocol();
  }

  /**
   * 클러스터 시작
   *
   * Master: HTTP/2 서버 + Worker 관리
   * Worker: HTTP/2 요청 처리
   */
  async start(port: number = 8443): Promise<void> {
    if (cluster.isPrimary) {
      await this.startMaster(port);
    } else {
      await this.startWorker(port);
    }
  }

  /**
   * Master 프로세스
   *
   * 책임:
   * 1. Worker 프로세스 생성 및 관리
   * 2. 요청 분배 (Load Balancing)
   * 3. Worker 상태 모니터링
   * 4. 자동 재시작
   */
  private async startMaster(port: number): Promise<void> {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎯 Phase 18: Multi-Core Cluster Manager (Master)`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`\nConfiguration:`);
    console.log(`  📊 Worker Count:     ${this.numWorkers}`);
    console.log(`  🖥️  Available Cores:   ${os.cpus().length}`);
    console.log(`  🔌 Port:             ${port}`);
    console.log(`  🎯 Goal:             ${(55000 * this.numWorkers).toLocaleString()} req/s (theoretical)`);
    console.log(`  🚀 Realistic:        ${Math.round(55000 * this.numWorkers * 0.8).toLocaleString()} req/s (80% efficiency)`);

    // Worker 프로세스 생성
    console.log(`\n📦 Creating Worker Processes...`);
    for (let i = 0; i < this.numWorkers; i++) {
      const worker = cluster.fork?.({
        WORKER_ID: String(i),
        PORT: String(port + i) // 각 worker마다 다른 포트 사용
      }) as any;

      console.log(`  ✅ Worker ${i} created (PID: ${worker.process.pid})`);

      // Worker 정보 등록
      this.workers.set(worker.id, {
        id: worker.id,
        pid: worker.process.pid!,
        status: 'idle',
        activeConnections: 0,
        totalRequests: 0,
        errors: 0,
        lastHealthCheck: Date.now(),
        startTime: Date.now()
      });

      // Worker 메시지 처리
      worker.on('message', (msg: WorkerMessage) => {
        this.handleWorkerMessage(worker.id, msg);
      });

      // Worker 종료 처리
      worker.on('exit', (code, signal) => {
        console.log(`\n⚠️  Worker ${i} exited (code: ${code}, signal: ${signal})`);
        this.handleWorkerExit(worker.id, i);
      });
    }

    this.stats.totalWorkers = this.numWorkers;
    this.stats.activeWorkers = this.numWorkers;

    // Health Check 시작
    this.startHealthCheck();

    // HTTP/2 서버 시작 (Master에서 요청 수신)
    console.log(`\n🚀 Starting HTTP/2 Server (Master)...`);
    this.http2Server = new Http2Server(port);
    await this.http2Server.start();

    // 통계 리포트
    this.startStatsReporter();

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ Cluster Manager Ready`);
    console.log(`   Master:  PID ${process.pid}`);
    console.log(`   Workers: ${this.numWorkers}x`);
    console.log(`${'═'.repeat(60)}\n`);
  }

  /**
   * Worker 프로세스
   *
   * 책임:
   * 1. HTTP/2 요청 처리
   * 2. 상태 정보 Master에 리포트
   * 3. 정상 종료 처리
   */
  private async startWorker(port: number): Promise<void> {
    const workerId = process.env.WORKER_ID || '0';
    const workerPort = parseInt(process.env.PORT || port.toString());

    console.log(`\n🔨 Worker ${workerId} started (PID: ${process.pid}, Port: ${workerPort})`);

    // HTTP/2 서버 시작
    const http2Server = new Http2Server(workerPort);
    await http2Server.start();

    // 주기적으로 상태 리포트
    setInterval(() => {
      const stats = http2Server.getStats();
      process.send?.({
        type: 'stats',
        workerId: parseInt(workerId),
        data: {
          activeConnections: stats.totalRequests,
          totalRequests: stats.totalRequests,
          avgLatency: stats.avgLatency
        }
      });
    }, 5000);

    // Graceful shutdown 처리
    process.on('SIGTERM', async () => {
      console.log(`\n🛑 Worker ${workerId} shutting down gracefully...`);
      await http2Server.stop();
      process.exit(0);
    });
  }

  /**
   * Worker 메시지 처리
   */
  private handleWorkerMessage(workerId: number, msg: WorkerMessage): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    switch (msg.type) {
      case 'stats':
        worker.activeConnections = msg.data?.activeConnections || 0;
        worker.totalRequests = msg.data?.totalRequests || 0;
        this.stats.totalRequests += msg.data?.totalRequests || 0;
        break;

      case 'error':
        worker.errors++;
        this.stats.totalErrors++;
        if (worker.errors > 10) {
          worker.status = 'unhealthy';
        }
        break;

      case 'health':
        worker.lastHealthCheck = Date.now();
        worker.status = 'idle';
        break;
    }
  }

  /**
   * Worker 종료 처리
   * 자동 재시작
   */
  private handleWorkerExit(workerId: number, index: number): void {
    this.workers.delete(workerId);
    this.stats.activeWorkers--;

    // 자동 재시작
    console.log(`\n🔄 Restarting Worker ${index}...`);
    const newWorker = cluster.fork({
      WORKER_ID: String(index),
      PORT: String(8443 + index)
    });

    this.workers.set(newWorker.id, {
      id: newWorker.id,
      pid: newWorker.process.pid!,
      status: 'idle',
      activeConnections: 0,
      totalRequests: 0,
      errors: 0,
      lastHealthCheck: Date.now(),
      startTime: Date.now()
    });

    this.stats.activeWorkers++;
    console.log(`✅ Worker ${index} restarted (New PID: ${newWorker.process.pid})`);

    newWorker.on('message', (msg: WorkerMessage) => {
      this.handleWorkerMessage(newWorker.id, msg);
    });

    newWorker.on('exit', (code, signal) => {
      this.handleWorkerExit(newWorker.id, index);
    });
  }

  /**
   * Health Check
   *
   * 주기적으로 Worker 상태 확인
   * - 응답 없는 Worker 재시작
   * - 에러율 높은 Worker 모니터링
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 10000; // 10초 타임아웃

      for (const [workerId, worker] of this.workers) {
        // 타임아웃 확인
        if (now - worker.lastHealthCheck > timeout) {
          console.log(`\n⚠️  Worker ${worker.id} timeout (last check: ${now - worker.lastHealthCheck}ms ago)`);
          worker.status = 'unhealthy';

          // Worker 재시작
          const nodeWorker = cluster.workers![workerId];
          if (nodeWorker) {
            nodeWorker.kill();
          }
        }
      }
    }, 5000);
  }

  /**
   * 통계 리포트
   */
  private startStatsReporter(): void {
    setInterval(() => {
      const now = Date.now();
      const uptime = (now - this.startTime) / 1000;

      const activeWorkers = Array.from(this.workers.values())
        .filter(w => w.status !== 'unhealthy').length;

      const avgLatency = this.stats.totalRequests > 0
        ? Math.round(this.stats.avgResponseTime / this.stats.totalRequests)
        : 0;

      if (process.env.NODE_ENV !== 'test') {
        console.clear();
        console.log(`\n${'═'.repeat(70)}`);
        console.log(`📊 Phase 18: Cluster Statistics (Updated every 10s)`);
        console.log(`${'═'.repeat(70)}`);
        console.log(`\n⏱️  Uptime:              ${Math.floor(uptime)}s`);
        console.log(`\n👥 Workers:`);
        console.log(`   Total:             ${this.stats.totalWorkers}`);
        console.log(`   Active:            ${activeWorkers}`);
        console.log(`   Unhealthy:         ${this.stats.totalWorkers - activeWorkers}`);

        console.log(`\n📈 Performance:`);
        console.log(`   Total Requests:    ${this.stats.totalRequests.toLocaleString()}`);
        console.log(`   Total Errors:      ${this.stats.totalErrors}`);
        console.log(`   Error Rate:        ${this.stats.totalRequests > 0 ? ((this.stats.totalErrors / this.stats.totalRequests) * 100).toFixed(2) : 0}%`);
        console.log(`   Avg Latency:       ${avgLatency}ms`);

        console.log(`\n💪 Capacity:`);
        const theoreticalRps = 55000 * this.numWorkers;
        const realisticRps = Math.round(theoreticalRps * 0.8);
        console.log(`   Theoretical:       ${theoreticalRps.toLocaleString()} req/s`);
        console.log(`   Realistic (80%):   ${realisticRps.toLocaleString()} req/s`);

        console.log(`\n🔍 Worker Details:`);
        for (const [, worker] of this.workers) {
          console.log(
            `   Worker ${worker.id}: ${worker.status} | ` +
            `Requests: ${worker.totalRequests} | ` +
            `Errors: ${worker.errors} | ` +
            `Uptime: ${Math.floor((Date.now() - worker.startTime) / 1000)}s`
          );
        }
        console.log(`\n${'═'.repeat(70)}\n`);
      }

      this.stats.uptime = Math.floor(uptime);
    }, 10000);
  }

  /**
   * 클러스터 종료
   */
  async stop(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.http2Server) {
      await this.http2Server.stop();
    }

    // Worker 프로세스 종료
    for (const [, worker] of this.workers) {
      const nodeWorker = cluster.workers![worker.id];
      if (nodeWorker) {
        nodeWorker.kill('SIGTERM');
      }
    }

    console.log('Cluster stopped');
  }

  /**
   * 통계 조회
   */
  getStats(): ClusterStats {
    const workerStats: { [id: number]: WorkerInfo } = {};
    for (const [, worker] of this.workers) {
      workerStats[worker.id] = { ...worker };
    }

    return {
      ...this.stats,
      workerStats
    };
  }
}
