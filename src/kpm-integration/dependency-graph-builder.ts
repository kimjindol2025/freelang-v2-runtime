/**
 * Dependency Graph Builder
 *
 * Build complete dependency graphs from KPM packages
 * Detect cycles, resolve conflicts, flatten for installation
 */

import type { KPMRegistryClient } from './kpm-registry-client';

export interface DependencyNode {
  name: string;
  version: string;
  dependencies: Map<string, DependencyNode>;
  resolved: boolean;
  depth: number;
}

export interface DependencyGraph {
  root: DependencyNode;
  allNodes: Map<string, DependencyNode>;
  cycles: CycleInfo[];
  conflicts: VersionConflict[];
}

export interface CycleInfo {
  packages: string[];
  severity: 'error' | 'warning';
}

export interface VersionConflict {
  package: string;
  requestedVersions: string[];
  resolved: string;
}

export interface InstallationPlan {
  steps: InstallationStep[];
  totalPackages: number;
  estimatedSize: number;
}

export interface InstallationStep {
  package: string;
  version: string;
  dependencies: string[];
  order: number;
}

/**
 * Dependency Graph Builder
 */
export class DependencyGraphBuilder {
  private readonly MAX_DEPTH = 20;
  private nodeCache: Map<string, DependencyNode> = new Map();
  private visitStack: Set<string> = new Set();

  constructor(private registryClient: KPMRegistryClient) {}

  /**
   * Build dependency graph from root package
   */
  async buildGraph(name: string, version: string): Promise<DependencyGraph | null> {
    try {
      // Reset caches
      this.nodeCache.clear();
      this.visitStack.clear();

      // Build root node
      const root = await this.buildNode(name, version, 0);
      if (!root) {
        return null;
      }

      // Detect cycles
      const cycles = this.detectCycles(root);

      // Detect conflicts
      const conflicts = this.detectConflicts(root);

      // Collect all nodes
      const allNodes = new Map<string, DependencyNode>();
      this.collectNodes(root, allNodes);

      return {
        root,
        allNodes,
        cycles,
        conflicts,
      };
    } catch (error) {
      console.error(`Failed to build dependency graph for ${name}:`, error);
      return null;
    }
  }

  /**
   * Generate installation plan from graph
   */
  async generateInstallationPlan(graph: DependencyGraph): Promise<InstallationPlan> {
    const steps: InstallationStep[] = [];
    const visited = new Set<string>();

    // Topological sort
    const traverse = (node: DependencyNode, order: number): number => {
      const key = `${node.name}@${node.version}`;
      if (visited.has(key)) {
        return order;
      }
      visited.add(key);

      // Process dependencies first
      let nextOrder = order;
      for (const [, dep] of node.dependencies) {
        nextOrder = traverse(dep, nextOrder);
      }

      // Add this package
      const deps = Array.from(node.dependencies.keys());
      steps.push({
        package: node.name,
        version: node.version,
        dependencies: deps,
        order: nextOrder,
      });

      return nextOrder + 1;
    };

    traverse(graph.root, 0);

    return {
      steps,
      totalPackages: steps.length,
      estimatedSize: this.estimateSize(steps),
    };
  }

  /**
   * Check for version conflicts
   */
  detectConflicts(root: DependencyNode): VersionConflict[] {
    const versionMap = new Map<string, Set<string>>();
    const conflicts: VersionConflict[] = [];

    const traverse = (node: DependencyNode) => {
      const key = node.name;
      if (!versionMap.has(key)) {
        versionMap.set(key, new Set());
      }
      versionMap.get(key)!.add(node.version);

      for (const [, dep] of node.dependencies) {
        traverse(dep);
      }
    };

    traverse(root);

    // Find conflicts
    for (const [pkg, versions] of versionMap) {
      if (versions.size > 1) {
        conflicts.push({
          package: pkg,
          requestedVersions: Array.from(versions),
          resolved: Array.from(versions)[0], // Use first version as resolution
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect circular dependencies
   */
  detectCycles(root: DependencyNode): CycleInfo[] {
    const cycles: CycleInfo[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const traverse = (node: DependencyNode, path: string[]): boolean => {
      const key = `${node.name}@${node.version}`;

      if (visiting.has(key)) {
        // Found cycle
        const cycleStart = path.findIndex(p => p === node.name);
        if (cycleStart >= 0) {
          const cycle = path.slice(cycleStart);
          cycle.push(node.name);
          cycles.push({
            packages: cycle,
            severity: 'error',
          });
        }
        return true;
      }

      if (visited.has(key)) {
        return false;
      }

      visiting.add(key);
      path.push(node.name);

      for (const [, dep] of node.dependencies) {
        if (traverse(dep, [...path])) {
          // Don't stop on cycles, collect all
        }
      }

      visiting.delete(key);
      visited.add(key);

      return false;
    };

    traverse(root, []);
    return cycles;
  }

  /**
   * Get package dependency count
   */
  getDependencyCount(node: DependencyNode): number {
    let count = 0;
    const visited = new Set<string>();

    const traverse = (n: DependencyNode) => {
      const key = `${n.name}@${n.version}`;
      if (visited.has(key)) return;
      visited.add(key);

      for (const [, dep] of n.dependencies) {
        count++;
        traverse(dep);
      }
    };

    traverse(node);
    return count;
  }

  /**
   * Private: Build dependency node recursively
   */
  private async buildNode(
    name: string,
    version: string,
    depth: number
  ): Promise<DependencyNode | null> {
    // Prevent infinite recursion
    if (depth > this.MAX_DEPTH) {
      console.warn(`Max dependency depth reached for ${name}`);
      return null;
    }

    // Check cache
    const cacheKey = `${name}@${version}`;
    if (this.nodeCache.has(cacheKey)) {
      return this.nodeCache.get(cacheKey) || null;
    }

    // Check for cycles
    if (this.visitStack.has(cacheKey)) {
      return null;
    }

    this.visitStack.add(cacheKey);

    try {
      // Get package info
      const info = await this.registryClient.getPackageInfo(name);
      if (!info) {
        return null;
      }

      const node: DependencyNode = {
        name,
        version,
        dependencies: new Map(),
        resolved: true,
        depth,
      };

      // Recursively build dependencies
      if (info.dependencies) {
        for (const [depName, depVersion] of Object.entries(info.dependencies)) {
          const depNode = await this.buildNode(depName, depVersion as string, depth + 1);
          if (depNode) {
            node.dependencies.set(depName, depNode);
          }
        }
      }

      // Cache the node
      this.nodeCache.set(cacheKey, node);

      return node;
    } catch (error) {
      console.error(`Failed to build node for ${name}@${version}:`, error);
      return null;
    } finally {
      this.visitStack.delete(cacheKey);
    }
  }

  /**
   * Private: Collect all nodes in graph
   */
  private collectNodes(node: DependencyNode, allNodes: Map<string, DependencyNode>): void {
    const key = `${node.name}@${node.version}`;

    if (allNodes.has(key)) {
      return;
    }

    allNodes.set(key, node);

    for (const [, dep] of node.dependencies) {
      this.collectNodes(dep, allNodes);
    }
  }

  /**
   * Private: Estimate download size
   */
  private estimateSize(steps: InstallationStep[]): number {
    // Rough estimate: average package is 100KB
    return steps.length * 100 * 1024;
  }
}
