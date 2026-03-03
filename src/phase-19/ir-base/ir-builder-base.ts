/**
 * Phase 19.1: IR Builder Base
 *
 * Base class for all IR (Intermediate Representation) builders
 * - Common IR node structure
 * - Graph building utilities
 * - Visitor pattern support
 * - Serialization/deserialization
 */

export type IRNodeType =
  | 'function'
  | 'block'
  | 'instruction'
  | 'variable'
  | 'constant'
  | 'operation'
  | 'control_flow'
  | 'memory'
  | 'call'
  | 'return';

export type OperationType =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'modulo'
  | 'compare'
  | 'logical_and'
  | 'logical_or'
  | 'logical_not'
  | 'load'
  | 'store'
  | 'cast'
  | 'branch'
  | 'jump';

export interface IRNode {
  id: string;
  type: IRNodeType;
  operation?: OperationType;
  operands: string[]; // IDs of operand nodes
  result_type?: string;
  metadata?: Record<string, any>;
}

export interface IRFunction {
  name: string;
  parameters: IRNode[];
  return_type: string;
  blocks: IRBlock[];
  entry_block: string;
}

export interface IRBlock {
  id: string;
  label?: string;
  instructions: IRNode[];
  successors: string[];
  predecessors: string[];
}

export interface IRGraph {
  functions: IRFunction[];
  globals: IRNode[];
  metadata: {
    version: string;
    target: string;
    optimization_level: number;
  };
}

/**
 * IR Builder Base
 * Common foundation for all IR variants
 */
export class IRBuilderBase {
  protected nodes: Map<string, IRNode>;
  protected blocks: Map<string, IRBlock>;
  protected functions: Map<string, IRFunction>;
  protected node_counter: number;
  protected current_block: string;
  protected target: string;

  constructor(target: string = 'generic') {
    this.nodes = new Map();
    this.blocks = new Map();
    this.functions = new Map();
    this.node_counter = 0;
    this.current_block = '';
    this.target = target;
  }

  // ────────── Node Creation ──────────

  /**
   * Create a new IR node
   */
  protected createNode(
    type: IRNodeType,
    operation?: OperationType,
    operands: string[] = []
  ): string {
    const id = `node_${this.node_counter++}`;

    const node: IRNode = {
      id,
      type,
      operation,
      operands,
    };

    this.nodes.set(id, node);
    return id;
  }

  /**
   * Create a variable node
   */
  createVariable(name: string, type: string): string {
    const id = this.createNode('variable');
    const node = this.nodes.get(id)!;
    node.metadata = { name, type };
    return id;
  }

  /**
   * Create a constant node
   */
  createConstant(value: any, type: string): string {
    const id = this.createNode('constant');
    const node = this.nodes.get(id)!;
    node.metadata = { value, type };
    node.result_type = type;
    return id;
  }

  /**
   * Create an operation node
   */
  createOperation(
    operation: OperationType,
    operands: string[],
    result_type?: string
  ): string {
    const id = this.createNode('operation', operation, operands);
    const node = this.nodes.get(id)!;
    node.result_type = result_type;
    return id;
  }

  // ────────── Block Management ──────────

  /**
   * Create a new basic block
   */
  createBlock(label?: string): string {
    const id = `block_${this.node_counter++}`;

    const block: IRBlock = {
      id,
      label,
      instructions: [],
      successors: [],
      predecessors: [],
    };

    this.blocks.set(id, block);
    this.current_block = id;
    return id;
  }

  /**
   * Add instruction to current block
   */
  addInstruction(node_id: string): void {
    if (!this.current_block) {
      throw new Error('No active block for instruction');
    }

    const block = this.blocks.get(this.current_block);
    if (!block) {
      throw new Error('Block not found');
    }

    block.instructions.push(this.nodes.get(node_id)!);
  }

  /**
   * Connect blocks with control flow
   */
  connectBlocks(from: string, to: string): void {
    const from_block = this.blocks.get(from);
    const to_block = this.blocks.get(to);

    if (!from_block || !to_block) {
      throw new Error('Block not found');
    }

    from_block.successors.push(to);
    to_block.predecessors.push(from);
  }

  /**
   * Set block successors
   */
  setSuccessors(block_id: string, successors: string[]): void {
    const block = this.blocks.get(block_id);
    if (!block) {
      throw new Error('Block not found');
    }

    block.successors = successors;
    for (const succ of successors) {
      const succ_block = this.blocks.get(succ);
      if (succ_block && !succ_block.predecessors.includes(block_id)) {
        succ_block.predecessors.push(block_id);
      }
    }
  }

  // ────────── Function Building ──────────

  /**
   * Create a function
   */
  createFunction(
    name: string,
    parameters: string[],
    return_type: string,
    entry_block: string
  ): void {
    const func: IRFunction = {
      name,
      parameters: parameters.map(p => this.nodes.get(p)!),
      return_type,
      blocks: [],
      entry_block,
    };

    this.functions.set(name, func);
  }

  /**
   * Add block to function
   */
  addBlockToFunction(func_name: string, block_id: string): void {
    const func = this.functions.get(func_name);
    if (!func) {
      throw new Error('Function not found');
    }

    const block = this.blocks.get(block_id);
    if (!block) {
      throw new Error('Block not found');
    }

    func.blocks.push(block);
  }

  // ────────── Graph Analysis ──────────

  /**
   * Get node by ID
   */
  getNode(id: string): IRNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get block by ID
   */
  getBlock(id: string): IRBlock | undefined {
    return this.blocks.get(id);
  }

  /**
   * Get function by name
   */
  getFunction(name: string): IRFunction | undefined {
    return this.functions.get(name);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): IRNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all blocks
   */
  getAllBlocks(): IRBlock[] {
    return Array.from(this.blocks.values());
  }

  /**
   * Get all functions
   */
  getAllFunctions(): IRFunction[] {
    return Array.from(this.functions.values());
  }

  // ────────── Serialization ──────────

  /**
   * Build IR graph
   */
  buildGraph(): IRGraph {
    return {
      functions: this.getAllFunctions(),
      globals: this.getAllNodes().filter(n => n.type === 'variable'),
      metadata: {
        version: '1.0',
        target: this.target,
        optimization_level: 2,
      },
    };
  }

  /**
   * Serialize to JSON
   */
  serialize(): string {
    const graph = this.buildGraph();
    return JSON.stringify(graph, null, 2);
  }

  /**
   * Validate IR structure
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check operand references
    for (const node of this.getAllNodes()) {
      for (const operand_id of node.operands) {
        if (!this.nodes.has(operand_id)) {
          errors.push(`Node ${node.id} references non-existent operand ${operand_id}`);
        }
      }
    }

    // Check block references
    for (const block of this.getAllBlocks()) {
      for (const succ_id of block.successors) {
        if (!this.blocks.has(succ_id)) {
          errors.push(`Block ${block.id} references non-existent successor ${succ_id}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ────────── Utilities ──────────

  /**
   * Reset builder
   */
  reset(): void {
    this.nodes.clear();
    this.blocks.clear();
    this.functions.clear();
    this.node_counter = 0;
    this.current_block = '';
  }

  /**
   * Get statistics
   */
  getStats(): {
    node_count: number;
    block_count: number;
    function_count: number;
    ir_target: string;
  } {
    return {
      node_count: this.nodes.size,
      block_count: this.blocks.size,
      function_count: this.functions.size,
      ir_target: this.target,
    };
  }
}

export default IRBuilderBase;
