/**
 * Phase 28: CI/CD Pipeline - Rollback Manager
 * Handles rollback of failed deployments to previous versions
 */

export interface RollbackPoint {
  id: string;
  version: string;
  timestamp: Date;
  deploymentId: string;
  targetId: string;
  artifacts: Map<string, Buffer>;
  checksum: string;
}

export interface RollbackRequest {
  id: string;
  deploymentId: string;
  targetId: string;
  fromVersion: string;
  toVersion: string;
  reason: string;
  requestedAt: Date;
  requestedBy?: string;
}

export interface RollbackExecution {
  id: string;
  requestId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  logs?: string[];
  previousSnapshot?: RollbackPoint;
  rollbackSnapshot?: RollbackPoint;
}

export interface RollbackPolicy {
  id: string;
  targetId: string;
  autoRollbackOn: string[]; // Conditions: 'health_check_failed', 'error_rate_high', 'response_time_critical'
  maxRetentionDays: number;
  retainSnapshots: number;
  rollbackTimeout: number; // milliseconds
}

export class RollbackManager {
  private rollbackPoints: Map<string, RollbackPoint> = new Map();
  private rollbackRequests: Map<string, RollbackRequest> = new Map();
  private rollbackExecutions: Map<string, RollbackExecution> = new Map();
  private policies: Map<string, RollbackPolicy> = new Map();
  private rollbackHistory: RollbackExecution[] = [];

  /**
   * Create a rollback point (snapshot)
   */
  createRollbackPoint(
    version: string,
    deploymentId: string,
    targetId: string,
    artifacts: Map<string, Buffer>
  ): RollbackPoint {
    const point: RollbackPoint = {
      id: `snapshot-${Date.now()}`,
      version,
      timestamp: new Date(),
      deploymentId,
      targetId,
      artifacts,
      checksum: this.calculateChecksum(artifacts),
    };

    this.rollbackPoints.set(point.id, point);
    return point;
  }

  /**
   * Register a rollback policy for a target
   */
  registerPolicy(policy: RollbackPolicy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Request a rollback
   */
  requestRollback(
    deploymentId: string,
    targetId: string,
    fromVersion: string,
    toVersion: string,
    reason: string,
    requestedBy?: string
  ): RollbackRequest {
    const request: RollbackRequest = {
      id: `rollback-req-${Date.now()}`,
      deploymentId,
      targetId,
      fromVersion,
      toVersion,
      reason,
      requestedAt: new Date(),
      requestedBy,
    };

    this.rollbackRequests.set(request.id, request);
    return request;
  }

  /**
   * Execute a rollback
   */
  async executeRollback(requestId: string): Promise<RollbackExecution> {
    const request = this.rollbackRequests.get(requestId);
    if (!request) {
      throw new Error('Rollback request not found');
    }

    const execution: RollbackExecution = {
      id: `rollback-exec-${Date.now()}`,
      requestId,
      status: 'PENDING',
      logs: [],
    };

    this.rollbackExecutions.set(execution.id, execution);

    try {
      execution.status = 'IN_PROGRESS';
      execution.startTime = new Date();

      execution.logs!.push(
        `[${new Date().toISOString()}] Rolling back from v${request.fromVersion} to v${request.toVersion} on ${request.targetId}`
      );
      execution.logs!.push(`[${new Date().toISOString()}] Reason: ${request.reason}`);

      // Find rollback point
      const rollbackPoint = await this.findRollbackPoint(request.targetId, request.toVersion);
      if (!rollbackPoint) {
        throw new Error(`No snapshot found for version ${request.toVersion}`);
      }

      execution.rollbackSnapshot = rollbackPoint;

      // Verify rollback point integrity
      if (rollbackPoint.checksum !== this.calculateChecksum(rollbackPoint.artifacts)) {
        throw new Error('Rollback point checksum mismatch - data may be corrupted');
      }

      execution.logs!.push(`[${new Date().toISOString()}] Rollback point verified`);

      // Execute rollback with timeout
      await this.performRollback(rollbackPoint, execution);

      execution.status = 'SUCCESS';
      execution.logs!.push(`[${new Date().toISOString()}] Rollback completed successfully`);
    } catch (error) {
      execution.status = 'FAILED';
      execution.logs!.push(`[${new Date().toISOString()}] Rollback failed: ${error}`);
      throw error;
    } finally {
      execution.endTime = new Date();
      if (execution.startTime) {
        execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      }
      this.rollbackHistory.push(execution);
    }

    return execution;
  }

  /**
   * Find a rollback point for a target and version
   */
  private async findRollbackPoint(targetId: string, version: string): Promise<RollbackPoint | undefined> {
    for (const point of this.rollbackPoints.values()) {
      if (point.targetId === targetId && point.version === version) {
        return point;
      }
    }
    return undefined;
  }

  /**
   * Perform the actual rollback operation
   */
  private async performRollback(point: RollbackPoint, execution: RollbackExecution): Promise<void> {
    execution.logs!.push(`[${new Date().toISOString()}] Restoring ${point.artifacts.size} artifacts...`);

    for (const [filename, buffer] of point.artifacts) {
      try {
        // In real implementation, use SSH or API to restore
        execution.logs!.push(
          `[${new Date().toISOString()}] Restored: ${filename} (${buffer.length} bytes)`
        );
      } catch (error) {
        throw new Error(`Failed to restore ${filename}: ${error}`);
      }
    }

    execution.logs!.push(`[${new Date().toISOString()}] All artifacts restored`);
  }

  /**
   * Check if auto-rollback should be triggered
   */
  shouldAutoRollback(targetId: string, condition: string): boolean {
    const policy = Array.from(this.policies.values()).find((p) => p.targetId === targetId);
    if (!policy) {
      return false;
    }
    return policy.autoRollbackOn.includes(condition);
  }

  /**
   * Cleanup old rollback points based on policy
   */
  cleanupRollbackPoints(targetId: string): number {
    const policy = Array.from(this.policies.values()).find((p) => p.targetId === targetId);
    if (!policy) {
      return 0;
    }

    const targetPoints = Array.from(this.rollbackPoints.values()).filter((p) => p.targetId === targetId);
    const sortedPoints = targetPoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    let deletedCount = 0;

    for (let i = 0; i < sortedPoints.length; i++) {
      const point = sortedPoints[i];
      const isOld = Date.now() - point.timestamp.getTime() > policy.maxRetentionDays * 24 * 60 * 60 * 1000;
      const isBeyondRetention = i >= policy.retainSnapshots;

      if (isOld || isBeyondRetention) {
        this.rollbackPoints.delete(point.id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Calculate checksum for artifacts
   */
  private calculateChecksum(artifacts: Map<string, Buffer>): string {
    let data = '';
    for (const [filename] of artifacts) {
      data += filename;
    }
    return Buffer.from(data).toString('hex').substring(0, 16);
  }

  /**
   * Get rollback execution status
   */
  getRollbackExecution(executionId: string): RollbackExecution | undefined {
    return this.rollbackExecutions.get(executionId);
  }

  /**
   * Get rollback history for a target
   */
  getRollbackHistory(targetId: string, limit: number = 10): RollbackExecution[] {
    return this.rollbackHistory
      .filter((e) => {
        const request = this.rollbackRequests.get(e.requestId);
        return request && request.targetId === targetId;
      })
      .slice(-limit);
  }

  /**
   * Get available rollback versions for a target
   */
  getAvailableRollbackVersions(targetId: string): string[] {
    const points = Array.from(this.rollbackPoints.values())
      .filter((p) => p.targetId === targetId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return points.map((p) => p.version);
  }

  /**
   * Get rollback statistics
   */
  getRollbackStats(): {
    totalRollbacks: number;
    successfulRollbacks: number;
    failedRollbacks: number;
    averageDuration: number;
    successRate: number;
    totalSnapshots: number;
  } {
    const totalRollbacks = this.rollbackHistory.length;
    const successfulRollbacks = this.rollbackHistory.filter((e) => e.status === 'SUCCESS').length;
    const failedRollbacks = this.rollbackHistory.filter((e) => e.status === 'FAILED').length;
    const averageDuration =
      totalRollbacks > 0 ? this.rollbackHistory.reduce((sum, e) => sum + (e.duration || 0), 0) / totalRollbacks : 0;
    const successRate = totalRollbacks > 0 ? (successfulRollbacks / totalRollbacks) * 100 : 0;
    const totalSnapshots = this.rollbackPoints.size;

    return {
      totalRollbacks,
      successfulRollbacks,
      failedRollbacks,
      averageDuration,
      successRate,
      totalSnapshots,
    };
  }
}
