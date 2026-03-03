/**
 * Phase 24: Advanced Platform Features
 *
 * Exports all advanced feature components
 */

// ===== Phase 24.1: Performance Optimization & Profiling =====
export {
  CPUProfiler,
  FunctionTimer,
  type SamplingMode,
  type TimeUnit,
  type StackFrame,
  type CallStack,
  type FunctionProfile,
  type FlameGraphNode,
} from './profiling/cpu-profiler';

export {
  MemoryProfiler,
  type MemoryAllocation,
  type HeapSnapshot,
  type GCStatistics,
  type LeakCandidate,
} from './profiling/memory-profiler';

export {
  BenchmarkRunner,
  type BenchmarkConfig,
  type BenchmarkResult,
  type BenchmarkComparison,
} from './profiling/benchmark-runner';

export {
  OptimizationRecommender,
  type RecommendationType,
  type SeverityLevel,
  type Recommendation,
  type PerformanceIssue,
} from './profiling/optimization-recommender';

export {
  PerformanceMonitor,
  type MetricSnapshot,
  type MetricAlert,
  type PerformanceThresholds,
} from './profiling/performance-monitor';

// ===== Phase 24.2: Security & Cryptography =====
export {
  CryptoEngine,
  SymmetricEncryption,
  AsymmetricEncryption,
  HashEngine,
  type EncryptionAlgorithm,
  type HashAlgorithm,
  type KeyFormat,
  type EncryptionResult,
  type DecryptionResult,
  type KeyPair,
  type HashResult,
} from './security/crypto-engine';

export {
  DigitalSignature,
  type SignatureResult,
  type VerificationResult,
} from './security/digital-signature';

export {
  CertificateManager,
  type Certificate,
  type CertificateInfo,
} from './security/certificate-manager';

export {
  SecureChannel,
  type TLSVersion,
  type CipherSuite,
  type TLSConfig,
  type SecureMessage,
} from './security/secure-channel';

export {
  KeyDerivation,
  type DerivedKey,
  type PasswordHash,
} from './security/key-derivation';

// ===== Phase 24.3: Event-Driven Architecture =====
export {
  EventBus,
  type Event,
  type Subscription,
} from './events/event-bus';

export {
  EventStore,
  type DomainEvent,
  type AggregateState,
} from './events/event-sourcing';

export {
  MessageQueue,
  type Message,
} from './events/message-queue';

export {
  EventStream,
  type StreamEvent,
} from './events/event-stream';

// ===== Phase 24.4: Advanced Type System =====
export {
  GenericConstraints,
  type Constraint,
  type TypeParameter,
  type GenericType,
} from './types/generic-constraints';

export {
  ReflectionAPI,
  type TypeInfo,
  type PropertyInfo,
  type MethodInfo,
  type ParameterInfo,
} from './types/reflection-api';

export {
  MacroSystem,
  type Macro,
  type MacroContext,
} from './types/macro-system';
