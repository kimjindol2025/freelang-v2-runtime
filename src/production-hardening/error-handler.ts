/**
 * 전역 에러 핸들러
 * - uncaught exceptions 처리
 * - unhandled rejections 처리
 * - 에러 로깅 및 복구
 */

export interface ErrorContext {
  timestamp: number;
  message: string;
  stack?: string;
  type: 'exception' | 'rejection';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class GlobalErrorHandler {
  private errors: ErrorContext[] = [];
  private maxErrors = 1000;
  private handlers: ((err: ErrorContext) => void)[] = [];

  /**
   * 핸들러 등록
   */
  onError(handler: (err: ErrorContext) => void): void {
    this.handlers.push(handler);
  }

  /**
   * Uncaught Exception 처리
   */
  handleException(error: Error): void {
    const context: ErrorContext = {
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      type: 'exception',
      severity: this._calculateSeverity(error)
    };

    this._recordError(context);
    this.handlers.forEach(h => h(context));
  }

  /**
   * Unhandled Rejection 처리
   */
  handleRejection(reason: any): void {
    const context: ErrorContext = {
      timestamp: Date.now(),
      message: String(reason),
      type: 'rejection',
      severity: 'high'
    };

    this._recordError(context);
    this.handlers.forEach(h => h(context));
  }

  /**
   * 심각도 계산
   */
  private _calculateSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const msg = error.message.toLowerCase();
    if (msg.includes('critical') || msg.includes('fatal')) return 'critical';
    if (msg.includes('error') || msg.includes('fail')) return 'high';
    if (msg.includes('warn')) return 'medium';
    return 'low';
  }

  /**
   * 에러 기록
   */
  private _recordError(context: ErrorContext): void {
    this.errors.push(context);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
  }

  /**
   * 에러 통계
   */
  getStats(): any {
    return {
      total: this.errors.length,
      critical: this.errors.filter(e => e.severity === 'critical').length,
      high: this.errors.filter(e => e.severity === 'high').length,
      lastError: this.errors[this.errors.length - 1]
    };
  }

  /**
   * 시스템 초기화
   */
  static initialize(): GlobalErrorHandler {
    const handler = new GlobalErrorHandler();

    process.on('uncaughtException', (error) => {
      handler.handleException(error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      handler.handleRejection(reason);
    });

    return handler;
  }
}

export default GlobalErrorHandler;
