/**
 * Phase 18: Load Balancer (요청 분배)
 *
 * 책임:
 * 1. Round-robin 방식 Worker 선택
 * 2. Least-connections 방식 (대안)
 * 3. 비정상 Worker 제외
 * 4. 동적 가중치 조정
 */

/**
 * Load Balancing 전략
 */
export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  WEIGHTED_ROUND_ROBIN = 'weighted_round_robin',
}

/**
 * Worker 선택 정보
 */
export interface WorkerSelection {
  workerId: number;
  port: number;
  weight: number;
}

/**
 * LoadBalancer 설정
 */
export interface LoadBalancerConfig {
  strategy?: LoadBalancingStrategy;
  enableDynamicWeighting?: boolean;
}

/**
 * LoadBalancer 구현
 */
export class LoadBalancer {
  private workers: Map<number, WorkerSelection> = new Map();
  private currentIndex = 0;
  private config: Required<LoadBalancerConfig>;
  private requestCounts: Map<number, number> = new Map();
  private errorCounts: Map<number, number> = new Map();

  constructor(config: LoadBalancerConfig = {}) {
    this.config = {
      strategy: LoadBalancingStrategy.ROUND_ROBIN,
      enableDynamicWeighting: true,
      ...config
    };
  }

  /**
   * Worker 등록
   */
  registerWorker(workerId: number, port: number, weight = 1): void {
    this.workers.set(workerId, {
      workerId,
      port,
      weight
    });
    this.requestCounts.set(workerId, 0);
    this.errorCounts.set(workerId, 0);

    console.log(`✅ Worker ${workerId} registered (port: ${port}, weight: ${weight})`);
  }

  /**
   * Worker 제거
   */
  unregisterWorker(workerId: number): void {
    this.workers.delete(workerId);
    this.requestCounts.delete(workerId);
    this.errorCounts.delete(workerId);

    console.log(`❌ Worker ${workerId} unregistered`);
  }

  /**
   * Worker 선택 (전략에 따라)
   */
  selectWorker(): WorkerSelection | null {
    const availableWorkers = Array.from(this.workers.values());

    if (availableWorkers.length === 0) {
      return null;
    }

    switch (this.config.strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this.selectByRoundRobin(availableWorkers);

      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        return this.selectByLeastConnections(availableWorkers);

      case LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN:
        return this.selectByWeightedRoundRobin(availableWorkers);

      default:
        return this.selectByRoundRobin(availableWorkers);
    }
  }

  /**
   * Round-robin 선택
   */
  private selectByRoundRobin(workers: WorkerSelection[]): WorkerSelection {
    const selected = workers[this.currentIndex % workers.length];
    this.currentIndex++;

    return selected;
  }

  /**
   * Least-connections 선택 (활성 연결이 가장 적은 Worker)
   */
  private selectByLeastConnections(workers: WorkerSelection[]): WorkerSelection {
    return workers.reduce((least, current) => {
      const leastCount = this.requestCounts.get(least.workerId) || 0;
      const currentCount = this.requestCounts.get(current.workerId) || 0;

      return currentCount < leastCount ? current : least;
    });
  }

  /**
   * Weighted Round-robin 선택 (가중치 기반 분배)
   */
  private selectByWeightedRoundRobin(workers: WorkerSelection[]): WorkerSelection {
    // 가중치를 기반으로 확장된 목록 생성
    const expandedWorkers: WorkerSelection[] = [];
    for (const worker of workers) {
      const weight = this.config.enableDynamicWeighting
        ? this.calculateDynamicWeight(worker.workerId)
        : worker.weight;

      for (let i = 0; i < weight; i++) {
        expandedWorkers.push(worker);
      }
    }

    const selected = expandedWorkers[this.currentIndex % expandedWorkers.length];
    this.currentIndex++;

    return selected;
  }

  /**
   * 동적 가중치 계산
   * (낮은 에러율과 낮은 요청 수를 가진 Worker에 더 많은 트래픽 분배)
   */
  private calculateDynamicWeight(workerId: number): number {
    const baseWeight = this.workers.get(workerId)?.weight || 1;
    const errorCount = this.errorCounts.get(workerId) || 0;
    const requestCount = this.requestCounts.get(workerId) || 0;

    // 에러가 많으면 가중치 감소
    let adjustedWeight = baseWeight;

    if (errorCount > 0) {
      const errorRate = errorCount / Math.max(requestCount, 1);
      adjustedWeight *= (1 - Math.min(errorRate, 0.5)); // 최대 50% 감소
    }

    return Math.max(1, Math.floor(adjustedWeight));
  }

  /**
   * 요청 시작 (Worker 선택 후 호출)
   */
  recordRequest(workerId: number): void {
    const count = (this.requestCounts.get(workerId) || 0) + 1;
    this.requestCounts.set(workerId, count);
  }

  /**
   * 요청 완료
   */
  recordRequestComplete(workerId: number): void {
    const count = Math.max(0, (this.requestCounts.get(workerId) || 1) - 1);
    this.requestCounts.set(workerId, count);
  }

  /**
   * 에러 기록
   */
  recordError(workerId: number): void {
    const count = (this.errorCounts.get(workerId) || 0) + 1;
    this.errorCounts.set(workerId, count);
  }

  /**
   * Worker 상태 조회
   */
  getWorkerStats(workerId: number): {
    activeRequests: number;
    totalErrors: number;
    dynamicWeight: number;
  } | null {
    const worker = this.workers.get(workerId);
    if (!worker) return null;

    return {
      activeRequests: this.requestCounts.get(workerId) || 0,
      totalErrors: this.errorCounts.get(workerId) || 0,
      dynamicWeight: this.calculateDynamicWeight(workerId)
    };
  }

  /**
   * 모든 Worker 통계
   */
  getAllStats(): {
    [workerId: number]: {
      activeRequests: number;
      totalErrors: number;
      dynamicWeight: number;
    }
  } {
    const stats: any = {};

    for (const [workerId] of this.workers) {
      const workerStats = this.getWorkerStats(workerId);
      if (workerStats) {
        stats[workerId] = workerStats;
      }
    }

    return stats;
  }

  /**
   * 전략 변경
   */
  setStrategy(strategy: LoadBalancingStrategy): void {
    this.config.strategy = strategy;
    console.log(`🔄 Load balancing strategy changed to: ${strategy}`);
  }

  /**
   * 동적 가중치 활성화/비활성화
   */
  setDynamicWeighting(enabled: boolean): void {
    this.config.enableDynamicWeighting = enabled;
    console.log(`🔄 Dynamic weighting: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Worker 개수
   */
  getWorkerCount(): number {
    return this.workers.size;
  }

  /**
   * 등록된 Worker 목록
   */
  getWorkers(): WorkerSelection[] {
    return Array.from(this.workers.values());
  }

  /**
   * 통계 리셋
   */
  resetStats(): void {
    this.requestCounts.clear();
    this.errorCounts.clear();
    this.currentIndex = 0;

    for (const workerId of this.workers.keys()) {
      this.requestCounts.set(workerId, 0);
      this.errorCounts.set(workerId, 0);
    }

    console.log(`🔄 Load balancer stats reset`);
  }
}
