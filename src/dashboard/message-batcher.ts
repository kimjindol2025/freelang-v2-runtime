/**
 * Phase 15: Message Batcher - SSE 메시지 배칭 엔진
 *
 * 목표: 50% 추가 대역폭 절감
 * - 메시지 큐잉 (10초 배치 윈도우)
 * - 초기 메시지는 즉시 전송
 * - 통계/트렌드는 배치 처리
 * - 메모리 효율적 (큐 크기 제한)
 */

/**
 * 배칭할 메시지
 */
export interface BatchedMessage {
  type: 'initial' | 'stats' | 'trends' | 'report' | 'movers' | 'error' | 'heartbeat';
  timestamp: number;
  data?: any;
  error?: string;
}

/**
 * 배치 메시지 (여러 메시지 묶음)
 */
export interface BatchMessage {
  type: 'batch';
  timestamp: number;
  messages: BatchedMessage[];
  count: number;
}

/**
 * 배칭 통계
 */
export interface BatchingStats {
  totalMessages: number;
  batchedMessages: number;
  immediateMessages: number;
  batchCount: number;
  averageMessagesPerBatch: number;
  bandwidthSaved: number; // bytes
  compressionRatio: number; // (original / batched)
}

/**
 * Phase 15 메시지 배처
 *
 * 특징:
 * - 10초 배치 윈도우
 * - 초기 메시지/하트비트는 즉시 전송
 * - 통계/트렌드/리포트는 배치 처리
 * - 큐 오버플로우 방지 (max 100 메시지)
 * - 성능 메트릭 추적
 */
export class MessageBatcher {
  private messageQueue: BatchedMessage[] = [];
  private batchInterval: NodeJS.Timeout | null = null;
  private batchIntervalMs: number = 10000; // 10초
  private maxQueueSize: number = 100;
  private onBatchReady: ((batch: BatchMessage) => void) | null = null;
  private onImmediateMessage: ((msg: BatchedMessage) => void) | null = null;

  // 통계
  private stats: BatchingStats = {
    totalMessages: 0,
    batchedMessages: 0,
    immediateMessages: 0,
    batchCount: 0,
    averageMessagesPerBatch: 0,
    bandwidthSaved: 0,
    compressionRatio: 1
  };

  constructor(batchIntervalMs: number = 10000) {
    this.batchIntervalMs = batchIntervalMs;
  }

  /**
   * 배치 준비 콜백 등록
   */
  setOnBatchReady(callback: (batch: BatchMessage) => void): void {
    this.onBatchReady = callback;
  }

  /**
   * 즉시 메시지 콜백 등록
   */
  setOnImmediateMessage(callback: (msg: BatchedMessage) => void): void {
    this.onImmediateMessage = callback;
  }

  /**
   * 메시지 추가
   * - initial, heartbeat, error: 즉시 전송
   * - stats, trends, report, movers: 배치 처리
   */
  enqueue(message: BatchedMessage): void {
    this.stats.totalMessages++;

    // 즉시 전송할 메시지 유형
    if (this.shouldSendImmediately(message.type)) {
      this.stats.immediateMessages++;
      if (this.onImmediateMessage) {
        this.onImmediateMessage(message);
      }
      return;
    }

    // 배치 큐에 추가
    if (this.messageQueue.length >= this.maxQueueSize) {
      console.warn(`⚠️ Message queue full (${this.maxQueueSize}), flushing batch early`);
      this.flush();
    }

    this.messageQueue.push(message);

    // 첫 메시지일 때만 배치 타이머 시작
    if (this.messageQueue.length === 1 && !this.batchInterval) {
      this.startBatchTimer();
    }
  }

  /**
   * 즉시 전송할 메시지인지 판별
   */
  private shouldSendImmediately(type: BatchedMessage['type']): boolean {
    return ['initial', 'heartbeat', 'error'].includes(type);
  }

  /**
   * 배치 타이머 시작
   */
  private startBatchTimer(): void {
    if (this.batchInterval) return;

    this.batchInterval = setTimeout(() => {
      this.flush();
    }, this.batchIntervalMs);
  }

  /**
   * 배치 전송 및 큐 초기화
   */
  flush(): void {
    if (this.messageQueue.length === 0) {
      if (this.batchInterval) {
        clearTimeout(this.batchInterval);
        this.batchInterval = null;
      }
      return;
    }

    const batch: BatchMessage = {
      type: 'batch',
      timestamp: Date.now(),
      messages: [...this.messageQueue],
      count: this.messageQueue.length
    };

    // 대역폭 계산
    this.updateBandwidthStats(batch);

    // 배치 전송
    if (this.onBatchReady) {
      this.onBatchReady(batch);
    }

    // 통계 업데이트
    this.stats.batchedMessages += batch.count;
    this.stats.batchCount++;
    this.stats.averageMessagesPerBatch =
      this.stats.batchedMessages / Math.max(1, this.stats.batchCount);

    // 큐 초기화
    this.messageQueue = [];

    // 타이머 초기화
    if (this.batchInterval) {
      clearTimeout(this.batchInterval);
      this.batchInterval = null;
    }
  }

  /**
   * 대역폭 절감 계산
   */
  private updateBandwidthStats(batch: BatchMessage): void {
    // 개별 메시지들의 크기
    let individualSize = 0;
    for (const msg of batch.messages) {
      individualSize += JSON.stringify(msg).length + 20; // 20 bytes for SSE overhead
    }

    // 배치 메시지 크기
    const batchSize = JSON.stringify(batch).length + 20;

    // 절감량
    const saved = Math.max(0, individualSize - batchSize);
    this.stats.bandwidthSaved += saved;
    this.stats.compressionRatio = individualSize / Math.max(1, batchSize);
  }

  /**
   * 배처 시작 (자동 플러싱)
   */
  start(): void {
    // 별도의 전역 타이머는 필요 없음 (각 메시지마다 시작)
  }

  /**
   * 배처 중지
   */
  stop(): void {
    this.flush();
    if (this.batchInterval) {
      clearTimeout(this.batchInterval);
      this.batchInterval = null;
    }
  }

  /**
   * 현재 큐 크기
   */
  getQueueSize(): number {
    return this.messageQueue.length;
  }

  /**
   * 통계 조회
   */
  getStats(): BatchingStats {
    return { ...this.stats };
  }

  /**
   * 통계 초기화
   */
  resetStats(): void {
    this.stats = {
      totalMessages: 0,
      batchedMessages: 0,
      immediateMessages: 0,
      batchCount: 0,
      averageMessagesPerBatch: 0,
      bandwidthSaved: 0,
      compressionRatio: 1
    };
  }

  /**
   * 디버그 정보
   */
  getDebugInfo(): object {
    return {
      queueSize: this.messageQueue.length,
      batchIntervalMs: this.batchIntervalMs,
      maxQueueSize: this.maxQueueSize,
      isActive: this.batchInterval !== null,
      stats: this.getStats()
    };
  }
}
