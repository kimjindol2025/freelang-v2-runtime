/**
 * Phase 23: Global Error Handler
 * Production-grade error handling with recovery strategies
 * Handles: uncaught exceptions, unhandled rejections, fatal errors
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ErrorContext {
  timestamp: string;
  errorType: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isRecoverable: boolean;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  recoveredErrors: number;
  unrecoveredErrors: number;
  lastError?: ErrorContext;
}

export class GlobalErrorHandler {
  private errors: ErrorContext[] = [];
  private logPath: string;
  private maxLogSize: number = 10 * 1024 * 1024; // 10MB
  private recoveryStrategies: Map<string, () => Promise<void>> = new Map();

  constructor(logPath: string = './logs/errors.log') {
    this.logPath = logPath;
    this.initializeLogging();
  }

  /**
   * Initialize error handling for process-level errors
   */
  initializeLogging(): void {
    // Create log directory
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.handleError(error, 'UncaughtException', 'CRITICAL', false);
      // Exit after logging (application is in undefined state)
      setTimeout(() => process.exit(1), 1000);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.handleError(error, 'UnhandledRejection', 'CRITICAL', false);
    });

    // Handle process warnings
    process.on('warning', (warning: Error) => {
      this.handleError(warning, 'ProcessWarning', 'MEDIUM', true);
    });
  }

  /**
   * Register recovery strategy for error type
   */
  registerRecoveryStrategy(errorType: string, strategy: () => Promise<void>): void {
    this.recoveryStrategies.set(errorType, strategy);
  }

  /**
   * Handle error with context and recovery attempt
   */
  async handleError(
    error: Error,
    errorType: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    isRecoverable: boolean,
    context?: Record<string, any>
  ): Promise<void> {
    const errorContext: ErrorContext = {
      timestamp: new Date().toISOString(),
      errorType,
      message: error.message,
      stack: error.stack,
      context,
      severity,
      isRecoverable,
    };

    this.errors.push(errorContext);

    // Log error
    this.logError(errorContext);

    // Attempt recovery if available
    if (isRecoverable && this.recoveryStrategies.has(errorType)) {
      try {
        const strategy = this.recoveryStrategies.get(errorType)!;
        await strategy();
        console.log(`✓ Recovered from ${errorType}`);
      } catch (recoveryError) {
        console.error(`✗ Recovery failed for ${errorType}:`, recoveryError);
      }
    }
  }

  /**
   * Log error to file
   */
  private logError(errorContext: ErrorContext): void {
    const logEntry = JSON.stringify(errorContext) + '\n';

    try {
      // Check log size and rotate if needed
      if (fs.existsSync(this.logPath)) {
        const stats = fs.statSync(this.logPath);
        if (stats.size > this.maxLogSize) {
          this.rotateLog();
        }
      }

      fs.appendFileSync(this.logPath, logEntry);
    } catch (logError) {
      console.error('Failed to write error log:', logError);
    }
  }

  /**
   * Rotate log file when size exceeded
   */
  private rotateLog(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${this.logPath}.${timestamp}.backup`;

    try {
      fs.renameSync(this.logPath, backupPath);
    } catch (error) {
      console.error('Failed to rotate log:', error);
    }
  }

  /**
   * Get error statistics
   */
  getStats(): ErrorStats {
    const stats: ErrorStats = {
      totalErrors: this.errors.length,
      errorsByType: {},
      errorsBySeverity: {},
      recoveredErrors: 0,
      unrecoveredErrors: 0,
      lastError: this.errors[this.errors.length - 1],
    };

    for (const error of this.errors) {
      // Count by type
      stats.errorsByType[error.errorType] = (stats.errorsByType[error.errorType] || 0) + 1;

      // Count by severity
      stats.errorsBySeverity[error.severity] = (stats.errorsBySeverity[error.severity] || 0) + 1;

      // Count recoverable/unrecoverable
      if (error.isRecoverable) {
        stats.recoveredErrors++;
      } else {
        stats.unrecoveredErrors++;
      }
    }

    return stats;
  }

  /**
   * Clear error logs
   */
  clearLogs(): void {
    this.errors = [];
    try {
      if (fs.existsSync(this.logPath)) {
        fs.unlinkSync(this.logPath);
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  /**
   * Get error log entries
   */
  getErrors(
    limit: number = 100,
    severityFilter?: string
  ): ErrorContext[] {
    let filtered = this.errors;

    if (severityFilter) {
      filtered = filtered.filter((e) => e.severity === severityFilter);
    }

    return filtered.slice(-limit);
  }
}
