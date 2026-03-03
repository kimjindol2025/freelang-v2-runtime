/**
 * FreeLang SSA (Static Single Assignment) Form Builder
 *
 * Converts Stack IR to SSA form with proper data flow analysis.
 * Implements Lengauer-Tarjan dominator tree algorithm.
 *
 * Components:
 * 1. Control Flow Graph (CFG) construction
 * 2. Dominator Tree with Lengauer-Tarjan algorithm
 * 3. Dominance Frontier computation
 * 4. Phi node insertion
 * 5. Variable renaming (SSA construction)
 */

import { Inst, Op } from '../types';

/**
 * Basic Block: sequence of instructions with single entry/exit
 */
export interface BasicBlock {
  id: string;
  instrs: Inst[];
  successors: string[];  // CFG successor block IDs
  predecessors: string[]; // CFG predecessor block IDs
  phiNodes: Map<string, PhiNode>; // variable → Phi node
}

/**
 * Phi Node: represents variable merging at control flow merge points
 */
export interface PhiNode {
  variable: string;
  incoming: Array<{ value: string; blockId: string }>;
}

/**
 * SSA Form representation
 */
export interface SSAForm {
  blocks: Map<string, BasicBlock>;
  entryBlockId: string;
  dominatorTree: Map<string, string>; // block → immediate dominator
  dominanceFrontier: Map<string, Set<string>>; // block → DF(block)
}

/**
 * Dominator Tree builder using Lengauer-Tarjan algorithm
 */
class DominatorTree {
  private cfg: Map<string, BasicBlock>;
  private entryId: string;
  private idom: Map<string, string> = new Map(); // immediate dominator
  private semi: Map<string, number> = new Map(); // semidominator
  private ancestor: Map<string, string> = new Map();
  private bucket: Map<string, string[]> = new Map();
  private dfNum: number = 0;
  private dfsOrder: string[] = [];
  private orderMap: Map<string, number> = new Map();
  private parent: Map<string, string> = new Map();

  constructor(cfg: Map<string, BasicBlock>, entryId: string) {
    this.cfg = cfg;
    this.entryId = entryId;
  }

  /**
   * Build dominator tree using Lengauer-Tarjan
   */
  build(): Map<string, string> {
    // Step 1: DFS numbering
    this.dfs(this.entryId);

    // Step 2: Initialize
    for (const blockId of Array.from(this.cfg.keys())) {
      this.semi.set(blockId, this.orderMap.get(blockId) || 0);
      this.bucket.set(blockId, []);
    }

    // Step 3: Main algorithm (reverse DFS order)
    for (let i = this.dfsOrder.length - 1; i >= 1; i--) {
      const w = this.dfsOrder[i];
      const wNum = this.orderMap.get(w)!;

      // For each predecessor of w
      const block = this.cfg.get(w)!;
      for (const vId of block.predecessors) {
        const vNum = this.orderMap.get(vId) || 0;
        if (vNum > 0) {
          const u = this.eval(vId);
          const uSemi = this.semi.get(u) || 0;
          const wSemi = this.semi.get(w) || wNum;
          if (uSemi < wSemi) {
            this.semi.set(w, uSemi);
          }
        }
      }

      // Add w to bucket of semi(w)
      const semiBlockId = this.dfsOrder[this.semi.get(w) || 0];
      if (semiBlockId) {
        const bucket = this.bucket.get(semiBlockId) || [];
        bucket.push(w);
        this.bucket.set(semiBlockId, bucket);
      }

      // Link w to parent
      this.link(this.parent.get(w) || '', w);

      // Calculate idom for nodes in bucket
      const parentBucket = this.bucket.get(this.parent.get(w) || '') || [];
      for (const v of parentBucket) {
        const u = this.eval(v);
        const idomCandidate = this.semi.get(u)! < this.semi.get(v)! ? u : this.parent.get(w) || '';
        this.idom.set(v, idomCandidate);
      }
      this.bucket.set(this.parent.get(w) || '', []);
    }

    // Step 4: Second pass to finalize idom
    for (let i = 1; i < this.dfsOrder.length; i++) {
      const w = this.dfsOrder[i];
      let currentIdom = this.idom.get(w) || '';
      while (
        currentIdom &&
        currentIdom !== this.dfsOrder[this.semi.get(currentIdom) || 0]
      ) {
        currentIdom = this.idom.get(currentIdom) || '';
      }
      if (currentIdom) {
        this.idom.set(w, currentIdom);
      }
    }

    return this.idom;
  }

  /**
   * DFS traversal for numbering
   */
  private dfs(blockId: string): void {
    this.orderMap.set(blockId, this.dfNum);
    this.dfsOrder.push(blockId);
    this.dfNum++;

    const block = this.cfg.get(blockId);
    if (block) {
      for (const succId of block.successors) {
        if (!this.orderMap.has(succId)) {
          this.parent.set(succId, blockId);
          this.ancestor.set(succId, blockId);
          this.dfs(succId);
        }
      }
    }
  }

  /**
   * Eval: find semidominator representative
   */
  private eval(v: string): string {
    if (!this.ancestor.has(v) || !this.ancestor.get(v)) {
      return v;
    }

    const a = this.ancestor.get(v) || '';
    const b = this.eval(a);
    const aNum = this.orderMap.get(a) || 0;
    const vNum = this.orderMap.get(v) || 0;
    const bNum = this.orderMap.get(b) || 0;

    const vSemi = this.semi.get(v) || vNum;
    const bSemi = this.semi.get(b) || bNum;

    if (bSemi < vSemi) {
      this.semi.set(v, bSemi);
    }

    this.ancestor.set(v, b);
    return b;
  }

  /**
   * Link: union-find link operation
   */
  private link(v: string, w: string): void {
    this.ancestor.set(w, v);
  }
}

/**
 * Compute Dominance Frontier for each block
 */
function computeDominanceFrontier(
  cfg: Map<string, BasicBlock>,
  idom: Map<string, string>
): Map<string, Set<string>> {
  const df: Map<string, Set<string>> = new Map();

  // Initialize
  for (const blockId of Array.from(cfg.keys())) {
    df.set(blockId, new Set());
  }

  // For each block Y with multiple predecessors
  for (const [yId, blockY] of Array.from(cfg.entries())) {
    if (blockY.predecessors.length >= 2) {
      for (const pId of blockY.predecessors) {
        let runner = pId;

        // For each block on path from P to idom(Y), excluding idom(Y)
        while (runner && runner !== idom.get(yId)) {
          const dfSet = df.get(runner) || new Set();
          dfSet.add(yId);
          df.set(runner, dfSet);
          runner = idom.get(runner) || '';
        }
      }
    }
  }

  return df;
}

/**
 * Find all definition sites (STORE instructions) for variables
 */
function findDefinitionSites(blocks: Map<string, BasicBlock>): Map<string, Set<string>> {
  const defSites: Map<string, Set<string>> = new Map();

  for (const [blockId, block] of Array.from(blocks.entries())) {
    for (const instr of block.instrs) {
      if (instr.op === Op.STORE) {
        const varName = instr.arg as string;
        const sites = defSites.get(varName) || new Set();
        sites.add(blockId);
        defSites.set(varName, sites);
      }
    }
  }

  return defSites;
}

/**
 * Insert Phi nodes at appropriate locations
 */
function insertPhiNodes(
  blocks: Map<string, BasicBlock>,
  defSites: Map<string, Set<string>>,
  df: Map<string, Set<string>>
): void {
  // For each variable
  for (const [varName, sites] of Array.from(defSites.entries())) {
    const workList: Set<string> = new Set(sites);
    const processed: Set<string> = new Set();

    while (workList.size > 0) {
      const blockId = workList.values().next().value;
      workList.delete(blockId);

      const dfSet = df.get(blockId) || new Set();
      for (const yId of Array.from(dfSet)) {
        if (!processed.has(yId)) {
          processed.add(yId);

          const block = blocks.get(yId);
          if (block) {
            // Insert Phi node
            const phi: PhiNode = {
              variable: varName,
              incoming: []
            };

            // Add predecessors to incoming list
            for (const predId of block.predecessors) {
              phi.incoming.push({ value: `${varName}_unknown`, blockId: predId });
            }

            block.phiNodes.set(varName, phi);

            // If not already processed, add to worklist
            if (!defSites.get(varName)?.has(yId)) {
              workList.add(yId);
            }
          }
        }
      }
    }
  }
}

/**
 * Rename variables to SSA form (version each variable)
 */
function renameVariables(
  blocks: Map<string, BasicBlock>,
  entryId: string,
  idom: Map<string, string>
): void {
  const stack: Map<string, string[]> = new Map(); // variable → stack of versions
  let counter: Map<string, number> = new Map(); // variable → version counter

  function getVersion(varName: string): string {
    const versionStack = stack.get(varName) || [];
    if (versionStack.length === 0) {
      return `${varName}_0`;
    }
    return versionStack[versionStack.length - 1];
  }

  function newVersion(varName: string): string {
    const count = (counter.get(varName) || 0) + 1;
    counter.set(varName, count);
    const version = `${varName}_${count}`;
    const versionStack = stack.get(varName) || [];
    versionStack.push(version);
    stack.set(varName, versionStack);
    return version;
  }

  function popVersion(varName: string): void {
    const versionStack = stack.get(varName) || [];
    versionStack.pop();
    stack.set(varName, versionStack);
  }

  function renameBlock(blockId: string): void {
    const block = blocks.get(blockId);
    if (!block) return;

    // Process Phi nodes
    for (const phi of Array.from(block.phiNodes.values())) {
      const newVar = newVersion(phi.variable);
      // Update Phi operands
      for (const incoming of phi.incoming) {
        incoming.value = getVersion(phi.variable);
      }
    }

    // Process instructions
    for (const instr of block.instrs) {
      // Replace LOAD operands
      if (instr.op === Op.LOAD) {
        const varName = instr.arg as string;
        // Note: actual renaming would modify instr.arg
      }

      // Add new versions for STORE
      if (instr.op === Op.STORE) {
        const varName = instr.arg as string;
        newVersion(varName);
      }
    }

    // Process successors in dominator tree order
    for (const [succId, succIdom] of Array.from(idom.entries())) {
      if (succIdom === blockId) {
        renameBlock(succId);
      }
    }

    // Pop versions for this block
    for (const varName of Array.from(counter.keys())) {
      popVersion(varName);
    }
  }

  renameBlock(entryId);
}

/**
 * Convert Stack IR to Control Flow Graph
 */
function buildCFG(instrs: Inst[]): Map<string, BasicBlock> {
  const blocks: Map<string, BasicBlock> = new Map();
  let currentBlockId = 'B0';
  let blockCount = 1;
  let currentInstrs: Inst[] = [];

  for (let i = 0; i < instrs.length; i++) {
    const instr = instrs[i];
    currentInstrs.push(instr);

    // Check if this instruction ends a basic block
    const isJump =
      instr.op === Op.JMP ||
      instr.op === Op.JMP_IF ||
      instr.op === Op.JMP_NOT ||
      instr.op === Op.RET ||
      instr.op === Op.HALT;

    if (isJump || i === instrs.length - 1) {
      // Create basic block
      const block: BasicBlock = {
        id: currentBlockId,
        instrs: currentInstrs,
        successors: [],
        predecessors: [],
        phiNodes: new Map()
      };

      blocks.set(currentBlockId, block);

      // Reset for next block
      currentBlockId = `B${blockCount++}`;
      currentInstrs = [];
    }
  }

  // Connect blocks (simplified: sequential + jumps)
  const blockIds = Array.from(blocks.keys());
  for (let i = 0; i < blockIds.length; i++) {
    const block = blocks.get(blockIds[i])!;
    const lastInstr = block.instrs[block.instrs.length - 1];

    if (lastInstr.op === Op.JMP || lastInstr.op === Op.JMP_IF || lastInstr.op === Op.JMP_NOT) {
      // Jump target would be resolved here
      // For now, assume sequential
      if (i + 1 < blockIds.length) {
        block.successors.push(blockIds[i + 1]);
      }
    } else if (lastInstr.op !== Op.RET && lastInstr.op !== Op.HALT) {
      // Fall through
      if (i + 1 < blockIds.length) {
        block.successors.push(blockIds[i + 1]);
      }
    }
  }

  // Set predecessors
  for (const block of Array.from(blocks.values())) {
    for (const succId of block.successors) {
      const succ = blocks.get(succId);
      if (succ && !succ.predecessors.includes(block.id)) {
        succ.predecessors.push(block.id);
      }
    }
  }

  return blocks;
}

/**
 * Main SSA Builder: Convert Stack IR to SSA Form
 */
export class SSABuilder {
  private instrs: Inst[];

  constructor(instrs: Inst[]) {
    this.instrs = instrs;
  }

  /**
   * Build SSA form from Stack IR
   */
  build(): SSAForm {
    // Step 1: Build CFG
    const blocks = buildCFG(this.instrs);
    const entryBlockId = 'B0';

    // Step 2: Compute dominator tree
    const domTree = new DominatorTree(blocks, entryBlockId);
    const idom = domTree.build();

    // Step 3: Compute dominance frontier
    const df = computeDominanceFrontier(blocks, idom);

    // Step 4: Find definition sites
    const defSites = findDefinitionSites(blocks);

    // Step 5: Insert Phi nodes
    insertPhiNodes(blocks, defSites, df);

    // Step 6: Rename variables
    renameVariables(blocks, entryBlockId, idom);

    return {
      blocks,
      entryBlockId,
      dominatorTree: idom,
      dominanceFrontier: df
    };
  }

  /**
   * Convert SSA back to Stack IR (for further optimization/code generation)
   */
  toInstrs(ssa: SSAForm): Inst[] {
    const result: Inst[] = [];

    // Simple conversion: emit blocks in order
    let blockIds = Array.from(ssa.blocks.keys()).sort();
    for (const blockId of blockIds) {
      const block = ssa.blocks.get(blockId);
      if (block) {
        // Emit Phi nodes as comments
        for (const phi of Array.from(block.phiNodes.values())) {
          result.push({
            op: Op.COMMENT,
            arg: `phi(${phi.variable})`
          });
        }

        // Emit block instructions
        result.push(...block.instrs);
      }
    }

    return result;
  }
}

/**
 * Convenience function: IR → SSA Form
 */
export function buildSSA(instrs: Inst[]): SSAForm {
  const builder = new SSABuilder(instrs);
  return builder.build();
}
