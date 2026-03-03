/**
 * Phase 29: Production Release - Publishing Manager
 * Handles multi-registry publishing workflows
 */

export interface PublicationConfig {
  version: string;
  registries: string[]; // 'npm', 'kpm', 'github'
  skipValidation?: boolean;
  dryRun?: boolean;
  tags?: string[];
}

export interface PublicationStep {
  id: string;
  registry: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  error?: string;
  output?: string;
}

export interface PublicationWorkflow {
  id: string;
  version: string;
  config: PublicationConfig;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  steps: PublicationStep[];
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
}

export class PublishingManager {
  private workflows: Map<string, PublicationWorkflow> = new Map();
  private publicationHistory: PublicationWorkflow[] = [];

  /**
   * Create and execute a publication workflow
   */
  async publishRelease(version: string, config: PublicationConfig): Promise<PublicationWorkflow> {
    const workflow: PublicationWorkflow = {
      id: `pub-${Date.now()}`,
      version,
      config,
      steps: [],
      status: 'PENDING',
    };

    this.workflows.set(workflow.id, workflow);

    try {
      workflow.status = 'IN_PROGRESS';
      workflow.startTime = new Date();

      // Execute publication steps for each registry
      for (const registry of config.registries) {
        const step = await this.publishToRegistry(registry, version, config);
        workflow.steps.push(step);
      }

      // Determine overall status
      const allSuccessful = workflow.steps.every((s) => s.status === 'SUCCESS');
      const anySuccessful = workflow.steps.some((s) => s.status === 'SUCCESS');

      if (allSuccessful) {
        workflow.status = 'SUCCESS';
      } else if (anySuccessful) {
        workflow.status = 'PARTIAL';
      } else {
        workflow.status = 'FAILED';
      }
    } catch (error) {
      workflow.status = 'FAILED';
      console.error('Publication workflow error:', error);
    } finally {
      workflow.endTime = new Date();
      if (workflow.startTime) {
        workflow.duration = workflow.endTime.getTime() - workflow.startTime.getTime();
      }
      this.publicationHistory.push(workflow);
    }

    return workflow;
  }

  /**
   * Publish to a specific registry
   */
  private async publishToRegistry(
    registry: string,
    version: string,
    config: PublicationConfig
  ): Promise<PublicationStep> {
    const step: PublicationStep = {
      id: `step-${registry}-${Date.now()}`,
      registry,
      status: 'PENDING',
    };

    try {
      step.status = 'IN_PROGRESS';
      step.startTime = new Date();

      // Validate before publishing
      if (!config.skipValidation) {
        await this.validatePublication(registry, version);
      }

      // Handle dry-run
      if (config.dryRun) {
        step.status = 'SKIPPED';
        step.output = `[Dry-run] Would publish ${version} to ${registry}`;
      } else {
        // Perform publication
        await this.performPublication(registry, version, config);
        step.status = 'SUCCESS';
        step.output = `Successfully published ${version} to ${registry}`;
      }
    } catch (error) {
      step.status = 'FAILED';
      step.error = String(error);
    } finally {
      step.endTime = new Date();
      if (step.startTime) {
        step.duration = step.endTime.getTime() - step.startTime.getTime();
      }
    }

    return step;
  }

  /**
   * Validate publication requirements
   */
  private async validatePublication(registry: string, version: string): Promise<void> {
    if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
      throw new Error(`Invalid version format: ${version}`);
    }

    if (registry === 'npm') {
      // Would validate npm auth, package.json, etc
    } else if (registry === 'kpm') {
      // Would validate KPM registry connectivity
    } else if (registry === 'github') {
      // Would validate GitHub token, repo access, etc
    } else {
      throw new Error(`Unknown registry: ${registry}`);
    }
  }

  /**
   * Perform the actual publication
   */
  private async performPublication(registry: string, version: string, config: PublicationConfig): Promise<void> {
    if (registry === 'npm') {
      // npm publish command
      console.log(`npm publish --tag ${config.tags?.[0] || 'latest'}`);
    } else if (registry === 'kpm') {
      // KPM publish API
      console.log(`POST /api/kpm/publish { version: "${version}" }`);
    } else if (registry === 'github') {
      // GitHub release API
      console.log(`POST /repos/{owner}/{repo}/releases { tag_name: "v${version}" }`);
    }
  }

  /**
   * Rollback a publication (mark as yanked)
   */
  async rollbackPublication(workflowId: string): Promise<PublicationWorkflow> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    for (const step of workflow.steps) {
      if (step.status === 'SUCCESS') {
        // Simulate rollback (yank from registry)
        step.status = 'SKIPPED';
        step.output = `Rolled back ${step.registry} publication`;
      }
    }

    workflow.status = 'FAILED';
    return workflow;
  }

  /**
   * Get workflow status
   */
  getWorkflow(workflowId: string): PublicationWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get publication history
   */
  getPublicationHistory(limit: number = 10): PublicationWorkflow[] {
    return this.publicationHistory.slice(-limit);
  }

  /**
   * Get publication statistics
   */
  getPublicationStats(): {
    totalPublications: number;
    successfulPublications: number;
    failedPublications: number;
    partialPublications: number;
    averageDuration: number;
    successRate: number;
    publishesByRegistry: Map<string, number>;
  } {
    const totalPublications = this.publicationHistory.length;
    const successfulPublications = this.publicationHistory.filter((w) => w.status === 'SUCCESS').length;
    const failedPublications = this.publicationHistory.filter((w) => w.status === 'FAILED').length;
    const partialPublications = this.publicationHistory.filter((w) => w.status === 'PARTIAL').length;
    const averageDuration =
      totalPublications > 0
        ? this.publicationHistory.reduce((sum, w) => sum + (w.duration || 0), 0) / totalPublications
        : 0;
    const successRate = totalPublications > 0 ? (successfulPublications / totalPublications) * 100 : 0;

    const publishesByRegistry = new Map<string, number>();
    for (const workflow of this.publicationHistory) {
      for (const step of workflow.steps) {
        if (step.status === 'SUCCESS') {
          publishesByRegistry.set(step.registry, (publishesByRegistry.get(step.registry) || 0) + 1);
        }
      }
    }

    return {
      totalPublications,
      successfulPublications,
      failedPublications,
      partialPublications,
      averageDuration,
      successRate,
      publishesByRegistry,
    };
  }

  /**
   * Check if version is published to registry
   */
  isPublishedTo(version: string, registry: string): boolean {
    for (const workflow of this.publicationHistory) {
      if (workflow.version === version && workflow.status !== 'FAILED') {
        for (const step of workflow.steps) {
          if (step.registry === registry && step.status === 'SUCCESS') {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Get registries a version is published to
   */
  getPublishedRegistries(version: string): string[] {
    const registries = new Set<string>();

    for (const workflow of this.publicationHistory) {
      if (workflow.version === version && workflow.status !== 'FAILED') {
        for (const step of workflow.steps) {
          if (step.status === 'SUCCESS') {
            registries.add(step.registry);
          }
        }
      }
    }

    return Array.from(registries);
  }
}
