/**
 * Phase 28: CI/CD Pipeline - Workflow Engine
 * Orchestrates automated testing, building, and deployment
 */

export interface WorkflowStep {
  id: string;
  name: string;
  command: string;
  timeout?: number; // milliseconds
  retries?: number;
  continueOnError?: boolean;
}

export interface WorkflowJob {
  id: string;
  name: string;
  steps: WorkflowStep[];
  runnerLabel?: string;
  environment?: Record<string, string>;
}

export interface PipelineConfig {
  name: string;
  trigger: 'push' | 'pull_request' | 'schedule' | 'manual';
  branch?: string;
  jobs: WorkflowJob[];
  concurrency?: number;
}

export interface StepResult {
  stepId: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'TIMEOUT';
  duration: number;
  output?: string;
  error?: string;
  retryCount?: number;
}

export interface JobResult {
  jobId: string;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  startTime: Date;
  endTime: Date;
  duration: number;
  steps: StepResult[];
}

export interface PipelineRun {
  id: string;
  config: PipelineConfig;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  jobs: JobResult[];
  artifacts?: Map<string, string>;
}

export class WorkflowEngine {
  private runs: Map<string, PipelineRun> = new Map();
  private activeRuns: Map<string, PipelineRun> = new Map();

  /**
   * Create and execute a new pipeline run
   */
  async executePipeline(config: PipelineConfig): Promise<PipelineRun> {
    const run: PipelineRun = {
      id: this.generateRunId(),
      config,
      status: 'PENDING',
      jobs: [],
      artifacts: new Map(),
    };

    this.runs.set(run.id, run);
    this.activeRuns.set(run.id, run);

    try {
      run.status = 'RUNNING';
      run.startTime = new Date();

      // Execute jobs sequentially or with concurrency limit
      const jobResults = await this.executeJobs(config.jobs, config.concurrency || 1);
      run.jobs = jobResults;

      // Determine overall status
      const anyFailed = jobResults.some((j) => j.status === 'FAILED');
      run.status = anyFailed ? 'FAILED' : 'SUCCESS';
    } catch (error) {
      run.status = 'FAILED';
      console.error('Pipeline execution error:', error);
    } finally {
      run.endTime = new Date();
      if (run.startTime) {
        run.duration = run.endTime.getTime() - run.startTime.getTime();
      }
      this.activeRuns.delete(run.id);
    }

    return run;
  }

  /**
   * Execute workflow jobs with concurrency control
   */
  private async executeJobs(jobs: WorkflowJob[], concurrency: number): Promise<JobResult[]> {
    const results: JobResult[] = [];

    for (let i = 0; i < jobs.length; i += concurrency) {
      const batch = jobs.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map((job) => this.executeJob(job)));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Execute a single job
   */
  private async executeJob(job: WorkflowJob): Promise<JobResult> {
    const startTime = new Date();
    const stepResults: StepResult[] = [];

    for (const step of job.steps) {
      const stepResult = await this.executeStep(step);
      stepResults.push(stepResult);

      // Stop if step fails and continueOnError is false
      if (stepResult.status === 'FAILED' && !step.continueOnError) {
        break;
      }
    }

    const endTime = new Date();

    return {
      jobId: job.id,
      status: stepResults.every((s) => s.status !== 'FAILED') ? 'SUCCESS' : 'FAILED',
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      steps: stepResults,
    };
  }

  /**
   * Execute a single step with retry logic
   */
  private async executeStep(step: WorkflowStep): Promise<StepResult> {
    const maxRetries = step.retries || 0;
    let lastError: Error | undefined;
    let retryCount = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await this.executeCommand(step.command, step.timeout);
        const duration = Date.now() - startTime;

        return {
          stepId: step.id,
          status: result.exitCode === 0 ? 'SUCCESS' : 'FAILED',
          duration,
          output: result.stdout,
          error: result.stderr,
          retryCount: attempt,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount = attempt;

        // Wait before retrying
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    return {
      stepId: step.id,
      status: 'FAILED',
      duration: 0,
      error: lastError?.message || 'Command execution failed',
      retryCount,
    };
  }

  /**
   * Execute a shell command (simplified implementation)
   */
  private async executeCommand(
    command: string,
    timeout?: number
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const timer = timeout
        ? setTimeout(() => {
            reject(new Error(`Command timeout after ${timeout}ms`));
          }, timeout)
        : null;

      try {
        // Simplified: in real implementation, use child_process
        const exitCode = 0;
        const stdout = `[${command}] executed successfully`;
        const stderr = '';

        if (timer) clearTimeout(timer);
        resolve({ exitCode, stdout, stderr });
      } catch (error) {
        if (timer) clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Get pipeline run status
   */
  getPipelineRun(runId: string): PipelineRun | undefined {
    return this.runs.get(runId);
  }

  /**
   * Get all active runs
   */
  getActiveRuns(): PipelineRun[] {
    return Array.from(this.activeRuns.values());
  }

  /**
   * Get pipeline run history
   */
  getRunHistory(limit: number = 10): PipelineRun[] {
    return Array.from(this.runs.values()).slice(-limit);
  }

  /**
   * Cancel a pipeline run
   */
  cancelRun(runId: string): boolean {
    const run = this.activeRuns.get(runId);
    if (run) {
      run.status = 'CANCELLED';
      run.endTime = new Date();
      this.activeRuns.delete(runId);
      return true;
    }
    return false;
  }

  /**
   * Generate unique run ID
   */
  private generateRunId(): string {
    return `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get pipeline statistics
   */
  getPipelineStats(): {
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
    averageDuration: number;
    successRate: number;
  } {
    const runs = Array.from(this.runs.values());
    const successRuns = runs.filter((r) => r.status === 'SUCCESS').length;
    const failedRuns = runs.filter((r) => r.status === 'FAILED').length;
    const averageDuration =
      runs.length > 0
        ? runs.reduce((sum, r) => sum + (r.duration || 0), 0) / runs.length
        : 0;
    const successRate = runs.length > 0 ? (successRuns / runs.length) * 100 : 0;

    return {
      totalRuns: runs.length,
      successRuns,
      failedRuns,
      averageDuration,
      successRate,
    };
  }
}
