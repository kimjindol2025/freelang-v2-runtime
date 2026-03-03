/**
 * Phase 23.7: Service Mesh Basics
 *
 * Service mesh for inter-service communication:
 * - Service-to-service communication policies
 * - Traffic management (routing, load balancing)
 * - Security policies (mTLS, authorization)
 * - Observability (metrics, logs, traces)
 */

export type MeshPolicy = 'ALLOW' | 'DENY';
export type ProtocolType = 'HTTP' | 'HTTPS' | 'gRPC' | 'TCP';

export interface ServiceEndpoint {
  service: string;
  namespace: string;
  port: number;
  protocol: ProtocolType;
  weight: number;
}

export interface TrafficPolicy {
  source_service: string;
  destination_service: string;
  policy: MeshPolicy;
  protocols: ProtocolType[];
  max_connections?: number;
  max_requests?: number;
  timeout_ms?: number;
}

export interface MTLSPolicy {
  enabled: boolean;
  mode: 'STRICT' | 'PERMISSIVE';
  min_tls_version: string;
  cipher_suites?: string[];
}

export interface AuthorizationPolicy {
  name: string;
  namespace: string;
  rules: AuthorizationRule[];
}

export interface AuthorizationRule {
  from: string[]; // Source services
  to: string[]; // Destination services
  methods: string[];
  paths?: string[];
  policy: MeshPolicy;
}

/**
 * VirtualService
 * Defines how traffic is routed to destinations
 */
export class VirtualService {
  private name: string;
  private namespace: string;
  private hosts: ServiceEndpoint[] = [];
  private routes: RouteRule[] = [];
  private timeouts_ms: number = 30000;
  private retries: RetryPolicy | null = null;

  constructor(name: string, namespace: string = 'default') {
    this.name = name;
    this.namespace = namespace;
  }

  /**
   * Add host
   */
  addHost(
    service: string,
    port: number,
    protocol: ProtocolType = 'HTTP',
    weight: number = 100
  ): void {
    this.hosts.push({
      service,
      namespace: this.namespace,
      port,
      protocol,
      weight,
    });
  }

  /**
   * Add route rule
   */
  addRoute(destination: string, weight: number, match?: RouteMatch): void {
    this.routes.push({
      destination,
      weight,
      match: match || { path: '/' },
      retry_policy: this.retries,
    });
  }

  /**
   * Set timeout
   */
  setTimeout(timeout_ms: number): void {
    this.timeouts_ms = timeout_ms;
  }

  /**
   * Set retry policy
   */
  setRetryPolicy(retries: RetryPolicy): void {
    this.retries = retries;
  }

  /**
   * Get routes
   */
  getRoutes(): RouteRule[] {
    return this.routes;
  }

  /**
   * Select destination (based on weight)
   */
  selectDestination(request_path: string): ServiceEndpoint | undefined {
    // Find matching route
    const matching_route = this.routes.find((r) => {
      if (r.match?.path) {
        return new RegExp(r.match.path).test(request_path);
      }
      return true;
    });

    if (!matching_route) return undefined;

    // Select from hosts based on weight
    const total_weight = this.hosts.reduce((sum, h) => sum + h.weight, 0);
    let random = Math.random() * total_weight;

    for (const host of this.hosts) {
      random -= host.weight;
      if (random <= 0) {
        return host;
      }
    }

    return this.hosts[0];
  }
}

export interface RouteRule {
  destination: string;
  weight: number;
  match?: RouteMatch;
  retry_policy?: RetryPolicy | null;
}

export interface RouteMatch {
  path?: string;
  method?: string;
  headers?: Record<string, string>;
}

export interface RetryPolicy {
  max_retries: number;
  backoff_ms: number;
}

/**
 * DestinationRule
 * Defines load balancing and connection pooling
 */
export class DestinationRule {
  private name: string;
  private host: string;
  private lb_strategy: 'ROUND_ROBIN' | 'LEAST_REQUEST' | 'RANDOM' | 'PASSTHROUGH' =
    'ROUND_ROBIN';
  private connection_pool: ConnectionPool | null = null;
  private outlier_detection: OutlierDetection | null = null;

  constructor(name: string, host: string) {
    this.name = name;
    this.host = host;
  }

  /**
   * Set load balancing strategy
   */
  setLoadBalancingStrategy(strategy: 'ROUND_ROBIN' | 'LEAST_REQUEST' | 'RANDOM' | 'PASSTHROUGH'): void {
    this.lb_strategy = strategy;
  }

  /**
   * Set connection pool
   */
  setConnectionPool(pool: ConnectionPool): void {
    this.connection_pool = pool;
  }

  /**
   * Set outlier detection
   */
  setOutlierDetection(detection: OutlierDetection): void {
    this.outlier_detection = detection;
  }

  /**
   * Get load balancing strategy
   */
  getLoadBalancingStrategy(): string {
    return this.lb_strategy;
  }
}

export interface ConnectionPool {
  tcp_connections: number;
  http_connections: number;
  max_pending_requests: number;
}

export interface OutlierDetection {
  consecutive_5xx_errors: number;
  interval_ms: number;
  base_ejection_time_ms: number;
}

/**
 * Service Mesh
 * Central mesh control plane
 */
export class ServiceMesh {
  private virtual_services: Map<string, VirtualService> = new Map();
  private destination_rules: Map<string, DestinationRule> = new Map();
  private traffic_policies: TrafficPolicy[] = [];
  private mtls_policy: MTLSPolicy = {
    enabled: false,
    mode: 'PERMISSIVE',
    min_tls_version: 'TLSv1.2',
  };
  private authorization_policies: AuthorizationPolicy[] = [];
  private observers: Set<(event: MeshEvent) => void> = new Set();

  constructor() {}

  /**
   * Register virtual service
   */
  registerVirtualService(service: VirtualService, name: string): void {
    this.virtual_services.set(name, service);
    this.notifyObservers({
      type: 'VIRTUAL_SERVICE_REGISTERED',
      timestamp: Date.now(),
      details: { service: name },
    });
  }

  /**
   * Register destination rule
   */
  registerDestinationRule(rule: DestinationRule, name: string): void {
    this.destination_rules.set(name, rule);
    this.notifyObservers({
      type: 'DESTINATION_RULE_REGISTERED',
      timestamp: Date.now(),
      details: { rule: name },
    });
  }

  /**
   * Add traffic policy
   */
  addTrafficPolicy(policy: TrafficPolicy): void {
    this.traffic_policies.push(policy);

    // Validate policy
    if (!this.validateTrafficPolicy(policy)) {
      throw new Error('Invalid traffic policy');
    }

    this.notifyObservers({
      type: 'TRAFFIC_POLICY_ADDED',
      timestamp: Date.now(),
      details: { policy_count: this.traffic_policies.length },
    });
  }

  /**
   * Enable mTLS
   */
  enableMTLS(mode: 'STRICT' | 'PERMISSIVE' = 'STRICT'): void {
    this.mtls_policy.enabled = true;
    this.mtls_policy.mode = mode;

    this.notifyObservers({
      type: 'MTLS_ENABLED',
      timestamp: Date.now(),
      details: { mode },
    });
  }

  /**
   * Add authorization policy
   */
  addAuthorizationPolicy(policy: AuthorizationPolicy): void {
    this.authorization_policies.push(policy);

    this.notifyObservers({
      type: 'AUTHORIZATION_POLICY_ADDED',
      timestamp: Date.now(),
      details: { policy: policy.name },
    });
  }

  /**
   * Check authorization
   */
  authorizeRequest(
    source_service: string,
    destination_service: string,
    method: string,
    path: string
  ): boolean {
    // Check traffic policies
    const policy = this.traffic_policies.find(
      (p) => p.source_service === source_service && p.destination_service === destination_service
    );

    if (policy && policy.policy === 'DENY') {
      return false;
    }

    // Check authorization policies
    for (const auth_policy of this.authorization_policies) {
      for (const rule of auth_policy.rules) {
        const source_matches = rule.from.includes(source_service) || rule.from.includes('*');
        const dest_matches = rule.to.includes(destination_service) || rule.to.includes('*');
        const method_matches = rule.methods.includes(method) || rule.methods.includes('*');

        if (source_matches && dest_matches && method_matches) {
          if (rule.paths) {
            const path_matches = rule.paths.some((p) => new RegExp(p).test(path));
            if (!path_matches) continue;
          }

          return rule.policy === 'ALLOW';
        }
      }
    }

    return true; // Default allow
  }

  /**
   * Route request
   */
  routeRequest(
    source: string,
    destination: string,
    method: string,
    path: string
  ): ServiceEndpoint | null {
    // Check authorization
    if (!this.authorizeRequest(source, destination, method, path)) {
      return null;
    }

    // Get virtual service
    const vs = this.virtual_services.get(destination);
    if (!vs) {
      return null;
    }

    return vs.selectDestination(path) || null;
  }

  /**
   * Get mesh statistics
   */
  getStats() {
    return {
      virtual_services: this.virtual_services.size,
      destination_rules: this.destination_rules.size,
      traffic_policies: this.traffic_policies.length,
      authorization_policies: this.authorization_policies.length,
      mtls_enabled: this.mtls_policy.enabled,
      mtls_mode: this.mtls_policy.mode,
    };
  }

  /**
   * Watch mesh events
   */
  watch(callback: (event: MeshEvent) => void): () => void {
    this.observers.add(callback);
    return () => {
      this.observers.delete(callback);
    };
  }

  /**
   * Private: Validate traffic policy
   */
  private validateTrafficPolicy(policy: TrafficPolicy): boolean {
    // Basic validation
    if (!policy.source_service || !policy.destination_service) {
      return false;
    }

    if (!policy.protocols || policy.protocols.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Private: Notify observers
   */
  private notifyObservers(event: MeshEvent): void {
    for (const observer of this.observers) {
      observer(event);
    }
  }
}

export interface MeshEvent {
  type: string;
  timestamp: number;
  details?: Record<string, any>;
}

export default { VirtualService, DestinationRule, ServiceMesh };
