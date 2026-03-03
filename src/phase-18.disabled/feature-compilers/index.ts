/**
 * Feature Compilers - Main Export
 *
 * Exports all 9 feature-focused compiler variants
 */

// Phase 1: Foundation
export { ExpressionCompiler } from './expression-compiler';
export { StatementCompiler } from './statement-compiler';

// Phase 2: Type System
export { TypeInferenceCompiler } from './type-inference-compiler';
export { GenericsCompiler } from './generics-compiler';

// Phase 3: Advanced Features
export { AsyncCompiler } from './async-compiler';
export { PatternMatchCompiler } from './pattern-match-compiler';
export { TraitCompiler } from './trait-compiler';

// Phase 4: Integration & Optimization
export { FFICompiler } from './ffi-compiler';
export { OptimizationCompiler } from './optimization-compiler';
