/**
 * Phase 19.2: IR Variants (9 Implementations)
 *
 * Nine different intermediate representations:
 * 1. Linear IR - Simple instruction list (no control flow)
 * 2. SSA Form IR - Static Single Assignment form
 * 3. CFG Builder - Control Flow Graph representation
 * 4. DDG Builder - Data Dependency Graph
 * 5. Tree IR - Tree-based representation
 * 6. Bytecode IR - Bytecode format for VM
 * 7. LLVM IR Builder - LLVM Intermediate Representation
 * 8. Custom IR - Domain-specific IR
 * 9. Hybrid IR - Combines multiple IR types
 */

import IRBuilderBase from '../ir-base/ir-builder-base';

// ────────── 1. Linear IR ──────────

export class LinearIRBuilder extends IRBuilderBase {
  private instruction_order: string[] = [];

  constructor() {
    super('linear');
  }

  override createOperation(
    operation: any,
    operands: string[],
    result_type?: string
  ): string {
    const id = super.createOperation(operation, operands, result_type);
    this.instruction_order.push(id);
    return id;
  }

  getInstructionOrder(): string[] {
    return [...this.instruction_order];
  }

  linearize(): string[] {
    return this.instruction_order.map(id => {
      const node = this.getNode(id);
      return `${id}: ${node?.operation}`;
    });
  }
}

// ────────── 2. SSA Form IR ──────────

export class SSAFormIRBuilder extends IRBuilderBase {
  private phi_functions: Map<string, string[]> = new Map();
  private ssa_versions: Map<string, number> = new Map();

  constructor() {
    super('ssa');
  }

  // Add phi function for merge points
  addPhiFunction(variable_id: string, incoming_values: string[]): string {
    this.phi_functions.set(variable_id, incoming_values);
    return `phi_${variable_id}`;
  }

  // Rename variable for SSA form (v → v_1, v_2, etc.)
  renameVariable(var_id: string): string {
    const version = (this.ssa_versions.get(var_id) || 0) + 1;
    this.ssa_versions.set(var_id, version);
    const node = this.getNode(var_id);
    if (node) {
      return `${node.metadata?.name}_${version}`;
    }
    return `var_${version}`;
  }

  getPhiFunctions(): Map<string, string[]> {
    return new Map(this.phi_functions);
  }

  getSSAForm(): { variables: Map<string, number>; phi_functions: Map<string, string[]> } {
    return {
      variables: new Map(this.ssa_versions),
      phi_functions: this.getPhiFunctions(),
    };
  }
}

// ────────── 3. CFG Builder ──────────

export class CFGBuilder extends IRBuilderBase {
  private dominators: Map<string, string[]> = new Map();
  private post_dominators: Map<string, string[]> = new Map();

  constructor() {
    super('cfg');
  }

  // Compute dominators (simplified)
  computeDominators(): Map<string, string[]> {
    const blocks = this.getAllBlocks();
    for (const block of blocks) {
      const doms: string[] = [];
      for (const other of blocks) {
        if (this.pathExists(other.id, block.id)) {
          doms.push(other.id);
        }
      }
      this.dominators.set(block.id, doms);
    }
    return new Map(this.dominators);
  }

  // Compute post-dominators
  computePostDominators(): Map<string, string[]> {
    const blocks = this.getAllBlocks();
    for (const block of blocks) {
      const post_doms: string[] = [];
      for (const other of blocks) {
        if (this.pathExists(block.id, other.id)) {
          post_doms.push(other.id);
        }
      }
      this.post_dominators.set(block.id, post_doms);
    }
    return new Map(this.post_dominators);
  }

  private pathExists(from: string, to: string): boolean {
    if (from === to) return true;
    const block = this.getBlock(from);
    if (!block) return false;
    for (const successor of block.successors) {
      if (this.pathExists(successor, to)) return true;
    }
    return false;
  }

  getCFGMetrics(): { block_count: number; edge_count: number; cyclomatic_complexity: number } {
    const blocks = this.getAllBlocks();
    let edges = 0;
    for (const block of blocks) {
      edges += block.successors.length;
    }
    const cyclomatic = edges - blocks.length + 2;
    return {
      block_count: blocks.length,
      edge_count: edges,
      cyclomatic_complexity: Math.max(cyclomatic, 1),
    };
  }
}

// ────────── 4. DDG Builder ──────────

export class DDGBuilder extends IRBuilderBase {
  private data_dependencies: Map<string, Set<string>> = new Map();

  constructor() {
    super('ddg');
  }

  // Build data dependency graph
  buildDependencyGraph(): Map<string, Set<string>> {
    const nodes = this.getAllNodes();

    for (const node of nodes) {
      const deps = new Set<string>();

      // Add dependencies from operands
      for (const operand_id of node.operands) {
        deps.add(operand_id);
        // Transitive dependencies
        const transitive = this.data_dependencies.get(operand_id);
        if (transitive) {
          transitive.forEach(t => deps.add(t));
        }
      }

      this.data_dependencies.set(node.id, deps);
    }

    return new Map(this.data_dependencies);
  }

  getCriticalPath(): string[] {
    const deps = this.buildDependencyGraph();
    let max_path: string[] = [];

    for (const [node_id, node_deps] of deps) {
      if (node_deps.size === 0) continue;
      const path = [node_id, ...Array.from(node_deps)];
      if (path.length > max_path.length) {
        max_path = path;
      }
    }

    return max_path;
  }

  getDataDependencies(): Map<string, Set<string>> {
    return new Map(this.data_dependencies);
  }
}

// ────────── 5. Tree IR ──────────

export class TreeIRBuilder extends IRBuilderBase {
  private tree_roots: string[] = [];

  constructor() {
    super('tree');
  }

  // Mark node as tree root
  addTreeRoot(node_id: string): void {
    if (!this.tree_roots.includes(node_id)) {
      this.tree_roots.push(node_id);
    }
  }

  // Build expression tree
  buildExpressionTree(root_id: string): any {
    const node = this.getNode(root_id);
    if (!node) return null;

    const children = node.operands.map(op_id => this.buildExpressionTree(op_id)).filter(c => c !== null);

    return {
      id: node.id,
      operation: node.operation,
      type: node.type,
      result_type: node.result_type,
      children,
      metadata: node.metadata,
    };
  }

  getTreeRoots(): string[] {
    return [...this.tree_roots];
  }

  getExpressionTrees(): any[] {
    return this.tree_roots.map(root_id => this.buildExpressionTree(root_id));
  }
}

// ────────── 6. Bytecode IR ──────────

export class BytecodeIRBuilder extends IRBuilderBase {
  private bytecode: Uint8Array[] = [];
  private constant_pool: (string | number | boolean)[] = [];

  constructor() {
    super('bytecode');
  }

  // Emit bytecode instruction
  emitBytecode(opcode: number, args: number[] = []): void {
    const code = [opcode, ...args];
    this.bytecode.push(new Uint8Array(code));
  }

  // Add constant to pool
  addConstant(value: string | number | boolean): number {
    this.constant_pool.push(value);
    return this.constant_pool.length - 1;
  }

  getBytecode(): Uint8Array[] {
    return [...this.bytecode];
  }

  getConstantPool(): (string | number | boolean)[] {
    return [...this.constant_pool];
  }

  getBytecodeSize(): number {
    return this.bytecode.reduce((sum, code) => sum + code.length, 0);
  }
}

// ────────── 7. LLVM IR Builder ──────────

export class LLVMIRBuilder extends IRBuilderBase {
  private llvm_types: Map<string, string> = new Map();

  constructor() {
    super('llvm');
  }

  // Map FreeLang types to LLVM types
  mapToLLVMType(freelang_type: string): string {
    const mapping: Record<string, string> = {
      i32: 'i32',
      i64: 'i64',
      f32: 'float',
      f64: 'double',
      bool: 'i1',
      str: 'i8*',
      void: 'void',
    };

    return mapping[freelang_type] || 'i32';
  }

  // Generate LLVM instruction
  generateLLVMInstruction(node_id: string): string {
    const node = this.getNode(node_id);
    if (!node) return '';

    const result_type = this.mapToLLVMType(node.result_type || 'i32');
    const operand_str = node.operands.join(', ');

    switch (node.operation) {
      case 'add':
        return `%${node.id} = add i32 ${operand_str}`;
      case 'subtract':
        return `%${node.id} = sub i32 ${operand_str}`;
      case 'multiply':
        return `%${node.id} = mul i32 ${operand_str}`;
      default:
        return `%${node.id} = ${node.operation} ${result_type} ${operand_str}`;
    }
  }

  generateLLVMFunction(func_name: string): string[] {
    const func = this.getFunction(func_name);
    if (!func) return [];

    const lines: string[] = [];
    lines.push(`define i32 @${func_name}() {`);

    for (const block of func.blocks) {
      lines.push(`${block.label}:`);
      for (const instr of block.instructions) {
        lines.push(`  ${this.generateLLVMInstruction(instr.id)}`);
      }
    }

    lines.push(`}`);
    return lines;
  }
}

// ────────── 8. Custom IR ──────────

export class CustomIRBuilder extends IRBuilderBase {
  private custom_domain: string = 'generic';
  private custom_metadata: Map<string, any> = new Map();

  constructor(domain: string = 'generic') {
    super(`custom-${domain}`);
    this.custom_domain = domain;
  }

  // Set domain-specific metadata
  setDomainMetadata(key: string, value: any): void {
    this.custom_metadata.set(key, value);
  }

  // Get domain-specific operations
  getDomainOperations(): string[] {
    const domain_ops: Record<string, string[]> = {
      ml: ['matrix_mul', 'conv2d', 'relu', 'softmax'],
      gpu: ['kernel_launch', 'device_malloc', 'device_copy'],
      crypto: ['aes_encrypt', 'sha256_hash', 'rsa_sign'],
    };

    return domain_ops[this.custom_domain] || [];
  }

  // Add custom operation
  addCustomOperation(op_name: string, operands: string[], result_type: string): string {
    return this.createOperation(op_name as any, operands, result_type);
  }

  getCustomMetadata(): Map<string, any> {
    return new Map(this.custom_metadata);
  }

  getDomain(): string {
    return this.custom_domain;
  }
}

// ────────── 9. Hybrid IR ──────────

export class HybridIRBuilder extends IRBuilderBase {
  private representations: Map<string, any> = new Map();

  constructor() {
    super('hybrid');
  }

  // Build multiple representations simultaneously
  buildMultipleRepresentations(): Map<string, any> {
    this.representations.set('linear', this.buildLinearForm());
    this.representations.set('cfg', this.buildCFGForm());
    this.representations.set('ssa', this.buildSSAForm());

    return new Map(this.representations);
  }

  private buildLinearForm(): string[] {
    return this.getAllNodes().map(node => `${node.id}: ${node.operation}`);
  }

  private buildCFGForm(): any {
    const blocks = this.getAllBlocks();
    return {
      blocks: blocks.map(b => ({
        id: b.id,
        successors: b.successors,
        predecessors: b.predecessors,
      })),
    };
  }

  private buildSSAForm(): any {
    const ssa_map: Record<string, number> = {};
    this.getAllNodes().forEach((node, idx) => {
      ssa_map[node.id] = idx + 1;
    });
    return ssa_map;
  }

  // Switch between representations
  switchRepresentation(rep_name: string): any {
    return this.representations.get(rep_name);
  }

  getRepresentations(): Map<string, any> {
    return new Map(this.representations);
  }

  // Consistency check across representations
  checkConsistency(): { consistent: boolean; errors: string[] } {
    const errors: string[] = [];

    const linear_count = this.representations.get('linear')?.length || 0;
    const cfg_blocks = this.representations.get('cfg')?.blocks?.length || 0;
    const ssa_map = this.representations.get('ssa');

    if (linear_count !== Object.keys(ssa_map || {}).length) {
      errors.push('Mismatch between linear and SSA representation');
    }

    return {
      consistent: errors.length === 0,
      errors,
    };
  }
}

// ────────── IR Variant Factory ──────────

export class IRVariantFactory {
  /**
   * Create IR builder for variant
   */
  static create(variant: string): IRBuilderBase {
    const variantLower = variant.toLowerCase();

    switch (variantLower) {
      case 'linear':
        return new LinearIRBuilder();
      case 'ssa':
        return new SSAFormIRBuilder();
      case 'cfg':
        return new CFGBuilder();
      case 'ddg':
        return new DDGBuilder();
      case 'tree':
        return new TreeIRBuilder();
      case 'bytecode':
        return new BytecodeIRBuilder();
      case 'llvm':
        return new LLVMIRBuilder();
      case 'custom':
        return new CustomIRBuilder();
      case 'hybrid':
        return new HybridIRBuilder();
      default:
        return new LinearIRBuilder();
    }
  }

  /**
   * List available IR variants
   */
  static availableVariants(): string[] {
    return ['linear', 'ssa', 'cfg', 'ddg', 'tree', 'bytecode', 'llvm', 'custom', 'hybrid'];
  }

  /**
   * Get variant description
   */
  static getDescription(variant: string): string {
    const descriptions: Record<string, string> = {
      linear: 'Linear IR (instruction list without control flow)',
      ssa: 'Static Single Assignment form (each variable assigned once)',
      cfg: 'Control Flow Graph (blocks with dominance information)',
      ddg: 'Data Dependency Graph (data flow analysis)',
      tree: 'Tree-based IR (expression trees)',
      bytecode: 'Bytecode IR (for VM execution)',
      llvm: 'LLVM Intermediate Representation',
      custom: 'Domain-specific custom IR',
      hybrid: 'Hybrid IR (multiple representations)',
    };

    return descriptions[variant] || 'Unknown IR variant';
  }
}

export default IRVariantFactory;
