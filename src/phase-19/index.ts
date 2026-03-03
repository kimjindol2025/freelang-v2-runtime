/**
 * Phase 19: IR Generation - Main Exports
 *
 * Exports all IR components:
 * - Base IR builder class
 * - 9 IR variant implementations
 * - Factory pattern for variant selection
 */

// Base IR Builder
export {
  IRNode,
  IRBlock,
  IRFunction,
  IRGraph,
  IRNodeType,
  OperationType,
} from './ir-base/ir-builder-base';

export { default as IRBuilderBase } from './ir-base/ir-builder-base';

// IR Variants
export {
  LinearIRBuilder,
  SSAFormIRBuilder,
  CFGBuilder,
  DDGBuilder,
  TreeIRBuilder,
  BytecodeIRBuilder,
  LLVMIRBuilder,
  CustomIRBuilder,
  HybridIRBuilder,
} from './ir-variants/ir-variants';

export { default as IRVariantFactory } from './ir-variants/ir-variants';

/**
 * Convenience function to create IR with any variant
 */
export async function createIR(variant: string = 'linear'): Promise<any> {
  const { IRVariantFactory } = require('./ir-variants/ir-variants');
  return IRVariantFactory.create(variant);
}

/**
 * List all available IR variants
 */
export function getAvailableIRVariants(): string[] {
  const { IRVariantFactory } = require('./ir-variants/ir-variants');
  return IRVariantFactory.availableVariants();
}

/**
 * Get description of an IR variant
 */
export function getIRVariantDescription(variant: string): string {
  const { IRVariantFactory } = require('./ir-variants/ir-variants');
  return IRVariantFactory.getDescription(variant);
}
