/**
 * Phase 23.4: API Gateway
 *
 * API Gateway for request routing and cross-cutting concerns:
 * - Request routing to services
 * - Rate limiting and throttling
 * - Authentication and authorization
 * - Request/response transformation
 * - Error handling and resilience
 */

export type AuthType = 'NONE' | 'JWT' | 'OAUTH2' | 'API_KEY';
export type RateLimitStrategy = 'FIXED_WINDOW' | 'SLIDING_WINDOW' | 'TOKEN_BUCKET';

export interface Route {
  path: string;
  pattern: RegExp;
  methods: string[];
  service: string;
  timeout_ms?: number;
  auth?: AuthType;
  rate_limit?: RateLimitConfig;
}

export interface RateLimitConfig {
  strategy: RateLimitStrategy;
  max_requests: number;
  window_ms: number;
  per_client?: boolean;
}

export interface GatewayRequest {
  method: string;
  path: string;
  headers: Record<string, any>;
  body?: any;
  client_id?: string;
}

export interface GatewayResponse {
  status: number;
  headers: Record<string, any>;
  body?: any;
}

export interface RateLimitStats {
  client_id: string;
  requests_count: number;
  window_start: number;
  tokens_remaining: number;
}

/**
 * Rate Limiter
 * Enforces rate limiting on API requests
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private clients: Map<string, RateLimitStats> = new Map();
  private cleanup_interval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.startCleanup();
  }

  /**
   * Check rate limit
   */
  checkLimit(client_id: string): boolean {
    const now = Date.now();
    const stats = this.clients.get(client_id);

    if (!stats) {
      this.clients.set(client_id, {
        client_id,
        requests_count: 1,
        window_start: now,
        tokens_remaining: this.config.max_requests - 1,
      });
      return true;
    }

    const window_age = now - stats.window_start;

    switch (this.config.strategy) {
      case 'FIXED_WINDOW':
        if (window_age > this.config.window_ms) {
          stats.window_start = now;
          stats.requests_count = 1;
          stats.tokens_remaining = this.config.max_requests - 1;
          return true;
        }
        if (stats.requests_count < this.config.max_requests) {
          stats.requests_count++;
          stats.tokens_remaining--;
          return true;
        }
        return false;

      case 'SLIDING_WINDOW':
        // Remove old requests outside window
        if (stats.requests_count > 0) {
          stats.requests_count = Math.max(0, stats.requests_count - 1);
          if (stats.requests_count < this.config.max_requests) {
            stats.requests_count++;
            stats.tokens_remaining--;
            return true;
          }
        }
        return false;

      case 'TOKEN_BUCKET':
        const tokens_to_add = (window_age / this.config.window_ms) * this.config.max_requests;
        stats.tokens_remaining = Math.min(
          this.config.max_requests,
          stats.tokens_remaining + tokens_to_add
        );
        stats.window_start = now;

        if (stats.tokens_remaining >= 1) {
          stats.tokens_remaining--;
          stats.requests_count++;
          return true;
        }
        return false;
    }
  }

  /**
   * Get stats
   */
  getStats(client_id: string): RateLimitStats | undefined {
    return this.clients.get(client_id);
  }

  /**
   * Private: Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanup_interval = setInterval(() => {
      const now = Date.now();
      for (const [client_id, stats] of this.clients.entries()) {
        if (now - stats.window_start > this.config.window_ms * 10) {
          this.clients.delete(client_id);
        }
      }
    }, 60000); // Cleanup every minute
  }

  /**
   * Stop cleanup
   */
  stop(): void {
    if (this.cleanup_interval) {
      clearInterval(this.cleanup_interval);
    }
  }
}

/**
 * Request Interceptor
 * Handles authentication and transformation
 */
export class RequestInterceptor {
  private auth_type: AuthType;
  private jwt_secret?: string;

  constructor(auth_type: AuthType = 'NONE', jwt_secret?: string) {
    this.auth_type = auth_type;
    this.jwt_secret = jwt_secret;
  }

  /**
   * Intercept request
   */
  intercept(request: GatewayRequest): boolean {
    switch (this.auth_type) {
      case 'NONE':
        return true;

      case 'JWT':
        return this.verifyJWT(request.headers['authorization']);

      case 'API_KEY':
        return !!request.headers['x-api-key'];

      case 'OAUTH2':
        return !!request.headers['authorization'];

      default:
        return false;
    }
  }

  /**
   * Private: Verify JWT
   */
  private verifyJWT(token?: string): boolean {
    if (!token || !this.jwt_secret) return false;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      // Simplified JWT verification
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      const now = Math.floor(Date.now() / 1000);

      return !payload.exp || payload.exp > now;
    } catch {
      return false;
    }
  }
}

/**
 * API Gateway
 * Central gateway for API routing and middleware
 */
export class APIGateway {
  private routes: Route[] = [];
  private rate_limiters: Map<string, RateLimiter> = new Map();
  private interceptors: Map<string, RequestInterceptor> = new Map();
  private request_count: number = 0;
  private error_count: number = 0;
  private total_latency_ms: number = 0;

  constructor() {}

  /**
   * Register route
   */
  registerRoute(route: Route): void {
    this.routes.push(route);
    this.routes.sort((a, b) => a.path.localeCompare(b.path));

    // Setup rate limiter for route if needed
    if (route.rate_limit) {
      const key = `${route.pattern}`;
      if (!this.rate_limiters.has(key)) {
        this.rate_limiters.set(key, new RateLimiter(route.rate_limit));
      }
    }

    // Setup interceptor for route if auth needed
    if (route.auth) {
      const key = `${route.pattern}`;
      if (!this.interceptors.has(key)) {
        this.interceptors.set(key, new RequestInterceptor(route.auth));
      }
    }
  }

  /**
   * Handle request
   */
  async handleRequest(request: GatewayRequest): Promise<GatewayResponse> {
    const start_time = Date.now();
    this.request_count++;

    try {
      // Find matching route
      const route = this.findRoute(request);
      if (!route) {
        this.error_count++;
        return {
          status: 404,
          headers: { 'content-type': 'application/json' },
          body: { error: 'Route not found' },
        };
      }

      // Check rate limit
      if (route.rate_limit) {
        const client_id = request.client_id || request.headers['x-client-id'] || 'anonymous';
        const limiter = this.rate_limiters.get(`${route.pattern}`);
        if (limiter && !limiter.checkLimit(client_id)) {
          this.error_count++;
          return {
            status: 429,
            headers: { 'content-type': 'application/json' },
            body: { error: 'Rate limit exceeded' },
          };
        }
      }

      // Check authentication
      if (route.auth) {
        const interceptor = this.interceptors.get(`${route.pattern}`);
        if (interceptor && !interceptor.intercept(request)) {
          this.error_count++;
          return {
            status: 401,
            headers: { 'content-type': 'application/json' },
            body: { error: 'Unauthorized' },
          };
        }
      }

      // Route request to service
      const response = await this.routeToService(route, request);

      const latency = Date.now() - start_time;
      this.total_latency_ms += latency;

      return response;
    } catch (error: any) {
      this.error_count++;
      return {
        status: 500,
        headers: { 'content-type': 'application/json' },
        body: { error: 'Internal server error', message: error.message },
      };
    }
  }

  /**
   * Find matching route
   */
  private findRoute(request: GatewayRequest): Route | undefined {
    for (const route of this.routes) {
      if (
        route.pattern.test(request.path) &&
        route.methods.includes(request.method.toUpperCase())
      ) {
        return route;
      }
    }
    return undefined;
  }

  /**
   * Route to service
   */
  private async routeToService(route: Route, request: GatewayRequest): Promise<GatewayResponse> {
    // Simulated service routing
    return {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-routed-to': route.service },
      body: { success: true, service: route.service, path: request.path },
    };
  }

  /**
   * Get gateway statistics
   */
  getStats() {
    return {
      total_requests: this.request_count,
      total_errors: this.error_count,
      error_rate: this.request_count > 0 ? this.error_count / this.request_count : 0,
      avg_latency_ms:
        this.request_count > 0 ? this.total_latency_ms / this.request_count : 0,
      active_routes: this.routes.length,
    };
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    for (const limiter of this.rate_limiters.values()) {
      limiter.stop();
    }
  }
}

export default { APIGateway, RateLimiter, RequestInterceptor };
