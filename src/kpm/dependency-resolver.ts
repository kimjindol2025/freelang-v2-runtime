/**
 * Phase 17: Dependency Resolver
 * Constructs dependency graphs and detects circular dependencies
 * Uses DFS and Tarjan's algorithm for SCC detection
 */

import { PackageParser, PackageJson, DependencyMap, DependencySpec } from './package-parser';
import { SemVer } from './semver';

/**
 * Single node in dependency graph
 */
export interface DependencyNode {
  name: string;
  version: string;
  type: 'production' | 'dev' | 'peer' | 'optional';
  dependencies: DependencyNode[];
  depth: number;
}

/**
 * Resolved dependency tree
 */
export interface ResolutionResult {
  root: DependencyNode;
  flatTree: Map<string, DependencyNode>;
  cycles: string[][];
  conflicts: ConflictInfo[];
}

/**
 * Version conflict information
 */
export interface ConflictInfo {
  package: string;
  versions: string[];
  resolved: string;
  reason: string;
}

/**
 * Package registry (mock - in real KPM would be network)
 */
export interface PackageRegistry {
  getPackageJson(name: string, version?: string): Promise<PackageJson>;
  getAvailableVersions(name: string): Promise<string[]>;
}

/**
 * Mock registry for testing
 */
class MockRegistry implements PackageRegistry {
  private packages: Map<string, PackageJson[]> = new Map();

  register(pkg: PackageJson): void {
    if (!this.packages.has(pkg.name)) {
      this.packages.set(pkg.name, []);
    }
    this.packages.get(pkg.name)!.push(pkg);
  }

  async getPackageJson(name: string, version?: string): Promise<PackageJson> {
    const versions = this.packages.get(name);
    if (!versions || versions.length === 0) {
      throw new Error(`Package not found: ${name}`);
    }

    if (version) {
      const pkg = versions.find((p) => SemVer.satisfies(p.version, version));
      if (!pkg) {
        throw new Error(`No version of ${name} satisfies ${version}`);
      }
      return pkg;
    }

    // Return latest version
    return versions.sort((a, b) => SemVer.compare(SemVer.parse(a.version), SemVer.parse(b.version)))[versions.length - 1];
  }

  async getAvailableVersions(name: string): Promise<string[]> {
    const versions = this.packages.get(name);
    return versions ? versions.map((p) => p.version) : [];
  }
}

/**
 * Tarjan's algorithm for detecting strongly connected components (cycles)
 */
interface TarjanNode {
  index?: number;
  lowlink?: number;
  onStack?: boolean;
}

/**
 * Dependency resolver with graph construction and cycle detection
 */
export class DependencyResolver {
  private parser = new PackageParser();
  private registry: PackageRegistry;
  private resolvedCache = new Map<string, DependencyNode>();
  private conflictVersions = new Map<string, Set<string>>();

  constructor(registry?: PackageRegistry) {
    this.registry = registry || new MockRegistry();
  }

  /**
   * Resolve full dependency tree for a package
   * @param packageName - package to resolve
   * @param version - specific version (optional, uses latest if not specified)
   * @returns resolution result with graph, cycles, conflicts
   */
  async resolve(packageName: string, version?: string): Promise<ResolutionResult> {
    this.resolvedCache.clear();
    this.conflictVersions.clear();

    const flatTree = new Map<string, DependencyNode>();
    const visited = new Set<string>();

    try {
      const root = await this.resolveDFS(packageName, version, 0, visited);
      this.flattenTree(root, flatTree);

      const cycles = this.detectCycles(flatTree);
      const conflicts = this.resolveConflicts(flatTree);

      return {
        root,
        flatTree,
        cycles,
        conflicts
      };
    } catch (error) {
      throw new Error(`Failed to resolve ${packageName}: ${error}`);
    }
  }

  /**
   * Recursive DFS to build dependency tree
   * @param packageName - package name
   * @param versionRange - version range constraint
   * @param depth - recursion depth
   * @param visited - visited packages (cycle detection)
   * @returns resolved dependency node
   */
  private async resolveDFS(
    packageName: string,
    versionRange: string = '*',
    depth: number = 0,
    visited: Set<string>
  ): Promise<DependencyNode> {
    // Cycle detection
    const key = `${packageName}@${versionRange}`;
    if (visited.has(key)) {
      // Return stub node for cycle
      return {
        name: packageName,
        version: 'circular',
        type: 'production',
        dependencies: [],
        depth
      };
    }

    visited.add(key);

    // Check cache
    if (this.resolvedCache.has(key)) {
      return this.resolvedCache.get(key)!;
    }

    // Get package metadata
    let pkg: PackageJson;
    try {
      pkg = await this.registry.getPackageJson(packageName, versionRange);
    } catch (error) {
      throw new Error(`Cannot find ${packageName}@${versionRange}`);
    }

    // Track version for conflict detection
    this.addVersionConflict(packageName, pkg.version);

    // Resolve dependencies
    const dependencies: DependencyNode[] = [];
    const deps = this.parser.extractDependencies(pkg);

    for (const [depName, depSpec] of Object.entries(deps)) {
      try {
        const depNode = await this.resolveDFS(depName, depSpec.version, depth + 1, new Set(visited));
        dependencies.push(depNode);
      } catch (error) {
        // Optional dependencies can fail
        if (depSpec.type === 'optional') {
          console.warn(`Optional dependency failed: ${depName}: ${error}`);
        } else {
          throw error;
        }
      }
    }

    const node: DependencyNode = {
      name: packageName,
      version: pkg.version,
      type: 'production',
      dependencies,
      depth
    };

    this.resolvedCache.set(key, node);
    visited.delete(key);

    return node;
  }

  /**
   * Flatten tree into single-level map (for hoisting)
   * @param node - root node
   * @param flatTree - output map
   * @param prefix - package name prefix (for scoped packages)
   */
  private flattenTree(
    node: DependencyNode,
    flatTree: Map<string, DependencyNode>,
    prefix: string = ''
  ): void {
    const key = prefix ? `${prefix}/${node.name}` : node.name;

    // Keep highest version
    if (!flatTree.has(key) || SemVer.compare(SemVer.parse(node.version), SemVer.parse(flatTree.get(key)!.version)) > 0) {
      flatTree.set(key, node);
    }

    // Recursively flatten dependencies
    for (const dep of node.dependencies) {
      if (dep.version !== 'circular') {
        this.flattenTree(dep, flatTree, '');
      }
    }
  }

  /**
   * Detect circular dependencies using DFS coloring
   * @param flatTree - flattened dependency tree
   * @returns array of cycles (each cycle is array of package names)
   */
  private detectCycles(flatTree: Map<string, DependencyNode>): string[][] {
    const cycles: string[][] = [];
    const visited = new Map<string, 'white' | 'gray' | 'black'>();
    const path: string[] = [];

    // Initialize colors
    for (const name of flatTree.keys()) {
      visited.set(name, 'white');
    }

    // DFS from each unvisited node
    for (const name of flatTree.keys()) {
      if (visited.get(name) === 'white') {
        this.dfsDetectCycle(name, visited, path, flatTree, cycles);
      }
    }

    return cycles;
  }

  /**
   * DFS helper for cycle detection
   */
  private dfsDetectCycle(
    name: string,
    visited: Map<string, 'white' | 'gray' | 'black'>,
    path: string[],
    flatTree: Map<string, DependencyNode>,
    cycles: string[][]
  ): void {
    visited.set(name, 'gray');
    path.push(name);

    const node = flatTree.get(name);
    if (node) {
      for (const dep of node.dependencies) {
        if (dep.version === 'circular') continue;

        const depName = dep.name;
        const color = visited.get(depName);

        if (color === 'gray') {
          // Found cycle
          const cycleStart = path.indexOf(depName);
          if (cycleStart !== -1) {
            const cycle = path.slice(cycleStart).concat(depName);
            cycles.push(cycle);
          }
        } else if (color === 'white') {
          this.dfsDetectCycle(depName, visited, path, flatTree, cycles);
        }
      }
    }

    path.pop();
    visited.set(name, 'black');
  }

  /**
   * Resolve version conflicts
   * @param flatTree - flattened tree
   * @returns conflict resolution info
   */
  private resolveConflicts(flatTree: Map<string, DependencyNode>): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    for (const [pkgName, versions] of this.conflictVersions.entries()) {
      if (versions.size > 1) {
        const versionArray = Array.from(versions);
        const resolved = this.selectBestVersion(versionArray);

        conflicts.push({
          package: pkgName,
          versions: versionArray,
          resolved,
          reason: `Multiple versions required: ${versionArray.join(', ')} → selected ${resolved}`
        });
      }
    }

    return conflicts;
  }

  /**
   * Select best version from multiple options
   * @param versions - array of versions
   * @returns selected version
   */
  private selectBestVersion(versions: string[]): string {
    // Prefer stable versions
    const stable = versions.filter((v) => SemVer.isStable(v));
    const candidates = stable.length > 0 ? stable : versions;

    // Return highest version
    return candidates.sort((a, b) => SemVer.compare(SemVer.parse(a), SemVer.parse(b)))[candidates.length - 1];
  }

  /**
   * Track version conflicts
   */
  private addVersionConflict(pkgName: string, version: string): void {
    if (!this.conflictVersions.has(pkgName)) {
      this.conflictVersions.set(pkgName, new Set());
    }
    this.conflictVersions.get(pkgName)!.add(version);
  }

  /**
   * Check if dependency graph has circular references
   * @param result - resolution result
   * @returns true if cycles detected
   */
  hasCircularDependencies(result: ResolutionResult): boolean {
    return result.cycles.length > 0;
  }

  /**
   * Get human-readable summary of resolution
   * @param result - resolution result
   * @returns summary string
   */
  summarize(result: ResolutionResult): string {
    const lines: string[] = [];

    lines.push(`📦 Package: ${result.root.name}@${result.root.version}`);
    lines.push(`📊 Total dependencies: ${result.flatTree.size}`);

    if (result.conflicts.length > 0) {
      lines.push(`⚠️  Conflicts: ${result.conflicts.length}`);
      for (const conflict of result.conflicts) {
        lines.push(`   ${conflict.package}: ${conflict.versions.join(', ')} → ${conflict.resolved}`);
      }
    }

    if (result.cycles.length > 0) {
      lines.push(`❌ Circular dependencies: ${result.cycles.length}`);
      for (const cycle of result.cycles) {
        lines.push(`   ${cycle.join(' → ')}`);
      }
    } else {
      lines.push(`✅ No circular dependencies`);
    }

    return lines.join('\n');
  }

  /**
   * Get registry for testing
   */
  getRegistry(): PackageRegistry {
    return this.registry;
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.resolvedCache.clear();
    this.conflictVersions.clear();
  }
}

/**
 * Helper function to resolve dependencies
 * @param packageName - package to resolve
 * @returns resolution result
 */
export async function resolveDependencies(packageName: string): Promise<ResolutionResult> {
  const resolver = new DependencyResolver();
  return resolver.resolve(packageName);
}

/**
 * Export mock registry for testing
 */
export { MockRegistry };
