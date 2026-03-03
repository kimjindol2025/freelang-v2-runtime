/**
 * Phase 18: IPC Protocol (Master ↔ Worker Communication)
 *
 * Binary 프로토콜 기반 Master와 Worker 간 통신
 * - Health Check: 주기적 상태 확인
 * - Load Tracking: 처리량 및 지연시간 추적
 * - Graceful Restart: 우아한 재시작
 */

/**
 * IPC 메시지 타입
 */
export enum MessageType {
  // Worker → Master
  STATS = 'stats',           // 통계 리포트
  ERROR = 'error',           // 에러 발생
  HEALTH = 'health',         // 헬스 체크 응답
  ACK = 'ack',               // 메시지 확인

  // Master → Worker
  HEALTH_CHECK = 'health_check',  // 헬스 체크 요청
  SHUTDOWN = 'shutdown',          // 종료 명령
  CONFIG = 'config',              // 설정 업데이트
}

/**
 * IPC 메시지 인터페이스
 */
export interface WorkerMessage {
  type: MessageType | string;
  workerId?: number;
  data?: any;
  timestamp?: number;
}

/**
 * Worker 응답 인터페이스
 */
export interface WorkerResponse {
  type: MessageType | string;
  success: boolean;
  data?: any;
  timestamp?: number;
}

/**
 * Worker 통계 데이터
 */
export interface WorkerStats {
  activeConnections: number;
  totalRequests: number;
  errorCount: number;
  avgLatency: number;
  peakConnections: number;
  uptime: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

/**
 * IPC 프로토콜 구현
 */
export class IpcProtocol {
  private messageHandlers = new Map<string, (msg: WorkerMessage) => void>();
  private requestCounter = 0;

  /**
   * 메시지 핸들러 등록
   */
  registerHandler(type: string, handler: (msg: WorkerMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * 메시지 핸들러 제거
   */
  unregisterHandler(type: string): void {
    this.messageHandlers.delete(type);
  }

  /**
   * 메시지 디스패치
   */
  dispatch(message: WorkerMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    }
  }

  /**
   * 메시지 ID 생성
   */
  generateMessageId(): number {
    return ++this.requestCounter;
  }

  /**
   * 통계 메시지 생성
   */
  createStatsMessage(workerId: number, stats: WorkerStats): WorkerMessage {
    return {
      type: MessageType.STATS,
      workerId,
      data: stats,
      timestamp: Date.now()
    };
  }

  /**
   * 에러 메시지 생성
   */
  createErrorMessage(workerId: number, error: Error): WorkerMessage {
    return {
      type: MessageType.ERROR,
      workerId,
      data: {
        message: error.message,
        stack: error.stack
      },
      timestamp: Date.now()
    };
  }

  /**
   * 헬스 체크 요청 생성
   */
  createHealthCheckMessage(workerId: number): WorkerMessage {
    return {
      type: MessageType.HEALTH_CHECK,
      workerId,
      timestamp: Date.now()
    };
  }

  /**
   * 헬스 체크 응답 생성
   */
  createHealthResponse(workerId: number, status: 'ok' | 'degraded' | 'down'): WorkerMessage {
    return {
      type: MessageType.HEALTH,
      workerId,
      data: { status },
      timestamp: Date.now()
    };
  }

  /**
   * 종료 명령 생성
   */
  createShutdownMessage(workerId: number, graceful = true): WorkerMessage {
    return {
      type: MessageType.SHUTDOWN,
      workerId,
      data: { graceful },
      timestamp: Date.now()
    };
  }

  /**
   * 메시지 유효성 검사
   */
  validateMessage(message: WorkerMessage): boolean {
    return !!(message.type && typeof message.type === 'string');
  }

  /**
   * 메시지 직렬화 (JSON)
   */
  serialize(message: WorkerMessage): string {
    return JSON.stringify(message);
  }

  /**
   * 메시지 역직렬화 (JSON)
   */
  deserialize(data: string): WorkerMessage {
    try {
      return JSON.parse(data) as WorkerMessage;
    } catch (error) {
      throw new Error(`Failed to deserialize message: ${error}`);
    }
  }
}

/**
 * 기본 IPC 프로토콜 인스턴스
 */
export const ipcProtocol = new IpcProtocol();
