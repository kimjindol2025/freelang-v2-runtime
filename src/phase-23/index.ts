/**
 * Phase 23: Cloud-Native Patterns & Distributed Execution
 *
 * Exports all cloud-native components
 */

// Service Discovery & Load Balancing
export {
  ServiceRegistry,
  LoadBalancer,
  ServiceLocator,
  type ServiceInstance,
  type ServiceStatus,
  type LoadBalancerStrategy,
  type HealthCheck,
  type ServiceRegistryStats,
} from './service-discovery/service-registry';

// Resilience Patterns
export {
  CircuitBreaker,
  RetryPolicy,
  TimeoutPolicy,
  Bulkhead,
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  type RetryBackoffStrategy,
} from './resilience/resilience-patterns';

// Distributed Tracing
export {
  SpanImpl,
  Tracer,
  TracingContext,
  type SpanKind,
  type SpanStatus,
  type SpanContext,
  type Span,
  type SpanEvent,
  type TraceMetrics,
} from './tracing/distributed-tracing';

// API Gateway
export {
  APIGateway,
  RateLimiter,
  RequestInterceptor,
  type AuthType,
  type RateLimitStrategy,
  type Route,
  type RateLimitConfig,
  type GatewayRequest,
  type GatewayResponse,
  type RateLimitStats,
} from './api-gateway/api-gateway';

// Deployment Patterns
export {
  RollingDeployment,
  BlueGreenDeployment,
  CanaryDeployment,
  DeploymentManager,
  type DeploymentStrategy,
  type DeploymentStatus,
  type PodStatus,
  type Replica,
  type Deployment,
  type DeploymentConfig,
} from './deployment/deployment-patterns';

// Configuration Management
export {
  ConfigMap,
  SecretsManager,
  ConfigurationManager,
  type ConfigLevel,
  type SecretType,
  type ConfigEntry,
  type SecretEntry,
  type ConfigSnapshot,
} from './config/configuration-management';

// Service Mesh
export {
  VirtualService,
  DestinationRule,
  ServiceMesh,
  type ProtocolType,
  type ServiceEndpoint,
  type TrafficPolicy,
  type MTLSPolicy,
  type AuthorizationPolicy,
  type AuthorizationRule,
  type MeshEvent,
  type RouteRule,
  type RouteMatch,
  type RetryPolicy as MeshRetryPolicy,
  type ConnectionPool,
  type OutlierDetection,
} from './mesh/service-mesh';
