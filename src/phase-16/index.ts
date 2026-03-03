/**
 * Phase 16: FFI Integration - Main Exports
 *
 * Exports all FFI components:
 * - FFI Binding Generator (C header → FreeLang bindings)
 * - Native Library Loader (Load .so/.dll files)
 * - FFI Integration (Main orchestration)
 */

// C FFI Binding Generator
export {
  FFIBindingGenerator,
  CFunctionSignature,
  CFunctionParam,
  CType,
  TypeMapping,
  GeneratedBinding,
} from './c-bindings/ffi-binding-generator';

// Native Library Loader
export {
  NativeLibraryLoader,
  LibraryInfo,
  NativeFunction,
  SymbolResolution,
  LibraryCompatibility,
} from './native-loader/native-library-loader';

// FFI Integration (Main)
export {
  FFIIntegration,
  FFIConfig,
  FFILibrary,
  FFICallResult,
} from './ffi-integration';

// Main exports (FFIIntegration is primary entry point)
export { FFIIntegration as default } from './ffi-integration';
