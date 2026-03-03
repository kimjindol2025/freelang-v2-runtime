/**
 * Phase 19: Self-Healer (자동 복구 시스템)
 *
 * 책임:
 * 1. Health Check 결과에 따른 자동 복구
 * 2. 복구 정책 실행 (GC, Worker 재시작, 메모리 정리 등)
 * 3. 복구 이력 추적
 * 4. 재시도 로직 (지수 백오프)
 */

import { HealthCheckResult, HealthStatus, HealthAlert } from './health-checker';

/**
 * 복구 액션
 */
export enum HealingAction {
  // CPU
  SCALE_OUT_WORKERS = 'scale_out_workers',
  THROTTLE_REQUESTS = 'throttle_requests',
  CLEAR_CACHE = 'clear_cache',

  // Memory
  FORCE_GC = 'force_gc',
  CLEAR_BUFFERS = 'clear_buffers',
  RESTART_WORKER = 'restart_worker',

  // Error Rate
  CIRCUIT_BREAKER = 'circuit_breaker',
  RETRY_LOGIC = 'retry_logic',
  ROLLBACK = 'rollback',

  // Response Time
  INCREASE_TIMEOUT = 'increase_timeout',
  REDUCE_BATCH_SIZE = 'reduce_batch_size',

  // Worker
  RESTART_UNHEALTHY = 'restart_unhealthy',
  REBUILD_CLUSTER = 'rebuild_cluster'
}

/**
 * 복구 액션 정의
 */
export interface HealingPolicy {
  action: HealingAction;
  severity: 'warning' | 'critical';
  autoExecute: boolean; // 자동 실행 여부
  retryCount: number; // 재시도 횟수
  delayMs: number; // 실행 지연
}

/**
 * 복구 결과
 */
export interface HealingResult {
  timestamp: number;
  action: HealingAction;
  success: boolean;
  message: string;
  duration: number; // ms
}

/**
 * SelfHealer 구현
 */
export class SelfHealer {
  private policies: Map<string, HealingPolicy> = new Map();
  private results: HealingResult[] = [];
  private actionHandlers: Map<HealingAction, (result: HealingResult) => Promise<void>> = new Map();
  private lastExecutionTime: Map<HealingAction, number> = new Map();
  private executionCounts: Map<HealingAction, number> = new Map();

  constructor() {
    this.initializePolicies();
  }

  /**
   * 정책 초기화
   */
  private initializePolicies(): void {
    // CPU 관련 정책
    this.policies.set('cpu_warning', {
      action: HealingAction.CLEAR_CACHE,
      severity: 'warning',
      autoExecute: true,
      retryCount: 1,
      delayMs: 0
    });

    this.policies.set('cpu_critical', {
      action: HealingAction.SCALE_OUT_WORKERS,
      severity: 'critical',
      autoExecute: true,
      retryCount: 3,
      delayMs: 1000
    });

    // Memory 관련 정책
    this.policies.set('memory_warning', {
      action: HealingAction.FORCE_GC,
      severity: 'warning',
      autoExecute: true,
      retryCount: 1,
      delayMs: 0
    });

    this.policies.set('memory_critical', {
      action: HealingAction.RESTART_WORKER,
      severity: 'critical',
      autoExecute: true,
      retryCount: 2,
      delayMs: 2000
    });

    // Error Rate 정책
    this.policies.set('error_rate_warning', {
      action: HealingAction.RETRY_LOGIC,
      severity: 'warning',
      autoExecute: true,
      retryCount: 1,
      delayMs: 0
    });

    this.policies.set('error_rate_critical', {
      action: HealingAction.CIRCUIT_BREAKER,
      severity: 'critical',
      autoExecute: true,
      retryCount: 2,
      delayMs: 500
    });

    // Response Time 정책
    this.policies.set('response_time_warning', {
      action: HealingAction.REDUCE_BATCH_SIZE,
      severity: 'warning',
      autoExecute: false,
      retryCount: 1,
      delayMs: 0
    });

    this.policies.set('response_time_critical', {
      action: HealingAction.INCREASE_TIMEOUT,
      severity: 'critical',
      autoExecute: true,
      retryCount: 1,
      delayMs: 1000
    });

    // Worker 정책
    this.policies.set('worker_warning', {
      action: HealingAction.RESTART_UNHEALTHY,
      severity: 'warning',
      autoExecute: true,
      retryCount: 2,
      delayMs: 500
    });

    this.policies.set('worker_critical', {
      action: HealingAction.REBUILD_CLUSTER,
      severity: 'critical',
      autoExecute: true,
      retryCount: 1,
      delayMs: 3000
    });
  }

  /**
   * 액션 핸들러 등록
   */
  onAction(action: HealingAction, handler: (result: HealingResult) => Promise<void>): void {
    this.actionHandlers.set(action, handler);
  }

  /**
   * 건강 체크 결과 처리
   */
  async heal(result: HealthCheckResult): Promise<HealingResult[]> {
    const healingResults: HealingResult[] = [];

    // 경고별로 정책 매칭
    for (const alert of result.alerts) {
      const policyKey = `${alert.component}_${alert.severity}`;
      const policy = this.policies.get(policyKey);

      if (!policy) {
        console.warn(`⚠️ No healing policy for: ${policyKey}`);
        continue;
      }

      // 자동 실행 여부 확인
      if (!policy.autoExecute && alert.severity === 'warning') {
        console.log(`⏭️ Skipping auto-heal (manual policy): ${policy.action}`);
        continue;
      }

      // 실행 제약 확인 (Rate limiting)
      if (!this.canExecute(policy.action)) {
        if (process.env.NODE_ENV !== 'test') {
          console.log(`⏱️ Rate limited: ${policy.action}`);
        }
        continue;
      }

      // 액션 실행
      const healResult = await this.executeAction(policy);
      healingResults.push(healResult);
      this.results.push(healResult);

      // 최근 100개 결과만 유지
      if (this.results.length > 100) {
        this.results.shift();
      }
    }

    return healingResults.filter(r => r.success || r.success === undefined);
  }

  /**
   * 액션 실행 가능 여부 확인
   */
  private canExecute(action: HealingAction): boolean {
    const lastExecution = this.lastExecutionTime.get(action) || 0;
    const timeSinceLastExecution = Date.now() - lastExecution;

    // 같은 액션은 10초 이상 간격으로만 실행
    const MIN_INTERVAL = 10000;

    return timeSinceLastExecution >= MIN_INTERVAL;
  }

  /**
   * 액션 실행
   */
  private async executeAction(policy: HealingPolicy): Promise<HealingResult> {
    const startTime = Date.now();
    const result: HealingResult = {
      timestamp: startTime,
      action: policy.action,
      success: false,
      message: '',
      duration: 0
    };

    try {
      // 지연 실행
      if (policy.delayMs > 0) {
        await this.delay(policy.delayMs);
      }

      // 핸들러 실행
      const handler = this.actionHandlers.get(policy.action);
      if (handler) {
        await handler(result);
        result.success = true;
        result.message = `✅ ${policy.action} completed`;
      } else {
        result.message = `⚠️ No handler for ${policy.action}`;
      }

      // 실행 통계 업데이트
      this.lastExecutionTime.set(policy.action, Date.now());
      const count = (this.executionCounts.get(policy.action) || 0) + 1;
      this.executionCounts.set(policy.action, count);

      if (process.env.NODE_ENV !== 'test') {
        console.log(`✅ Healing: ${policy.action} (attempt 1/${policy.retryCount})`);
      }
    } catch (error) {
      result.message = `❌ ${policy.action} failed: ${error}`;
      if (process.env.NODE_ENV !== 'test') {
        console.error(`❌ Healing failed: ${policy.action}`, error);
      }

      // 재시도 로직
      if (policy.retryCount > 1) {
        for (let attempt = 2; attempt <= policy.retryCount; attempt++) {
          try {
            await this.delay(Math.pow(2, attempt - 1) * 1000); // 지수 백오프
            const handler = this.actionHandlers.get(policy.action);
            if (handler) {
              await handler(result);
              result.success = true;
              result.message = `✅ ${policy.action} completed (attempt ${attempt}/${policy.retryCount})`;
              if (process.env.NODE_ENV !== 'test') {
                console.log(`✅ Healing retry: ${policy.action} (attempt ${attempt}/${policy.retryCount})`);
              }
              break;
            }
          } catch (retryError) {
            if (process.env.NODE_ENV !== 'test') {
              console.error(`❌ Healing retry failed: ${policy.action}`, retryError);
            }
            if (attempt === policy.retryCount) {
              result.message = `❌ All retries failed: ${policy.action}`;
            }
          }
        }
      }
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * 지연
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 복구 결과 조회
   */
  getResults(limit: number = 50): HealingResult[] {
    return this.results.slice(-limit);
  }

  /**
   * 액션별 실행 통계
   */
  getStats(): {
    action: HealingAction;
    executionCount: number;
    lastExecution: number;
  }[] {
    const stats: {
      action: HealingAction;
      executionCount: number;
      lastExecution: number;
    }[] = [];

    for (const [action, count] of this.executionCounts) {
      stats.push({
        action: action as HealingAction,
        executionCount: count,
        lastExecution: this.lastExecutionTime.get(action) || 0
      });
    }

    return stats.sort((a, b) => b.executionCount - a.executionCount);
  }

  /**
   * 정책 조회
   */
  getPolicy(key: string): HealingPolicy | undefined {
    return this.policies.get(key);
  }

  /**
   * 정책 업데이트
   */
  updatePolicy(key: string, policy: Partial<HealingPolicy>): void {
    const existing = this.policies.get(key);
    if (existing) {
      this.policies.set(key, { ...existing, ...policy });
      console.log(`✏️ Policy updated: ${key}`);
    }
  }

  /**
   * 모든 정책 조회
   */
  getAllPolicies(): Array<{ key: string; policy: HealingPolicy }> {
    const policies: Array<{ key: string; policy: HealingPolicy }> = [];
    for (const [key, policy] of this.policies) {
      policies.push({ key, policy });
    }
    return policies;
  }

  /**
   * 통계 리셋
   */
  reset(): void {
    this.results = [];
    this.lastExecutionTime.clear();
    this.executionCounts.clear();
    console.log('🔄 Self-healer statistics reset');
  }

  /**
   * 복구 히스토리 (시간대별)
   */
  getHistoryByHour(): {
    hour: number;
    actions: HealingAction[];
    count: number;
  }[] {
    const hourBuckets = new Map<number, HealingAction[]>();

    for (const result of this.results) {
      const hour = Math.floor(result.timestamp / (60 * 60 * 1000));
      if (!hourBuckets.has(hour)) {
        hourBuckets.set(hour, []);
      }
      hourBuckets.get(hour)!.push(result.action);
    }

    return Array.from(hourBuckets.entries())
      .map(([hour, actions]) => ({
        hour,
        actions,
        count: actions.length
      }))
      .sort((a, b) => a.hour - b.hour);
  }
}
