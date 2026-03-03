/**
 * Phase 23.1: Service Registry & Discovery
 *
 * Core service discovery mechanism:
 * - Service registration/deregistration
 * - Service instance tracking
 * - Health checking
 * - Load balancing
 * - Service metadata
 */

export type ServiceStatus = 'UP' | 'DOWN' | 'STARTING' | 'STOPPING' | 'OUT_OF_SERVICE';
export type LoadBalancerStrategy = 'ROUND_ROBIN' | 'LEAST_CONNECTIONS' | 'RANDOM' | 'WEIGHT_BASED';

export interface ServiceInstance {
  id: string; // Unique instance ID
  service_name: string;
  host: string;
  port: number;
  status: ServiceStatus;
  weight: number; // For weighted load balancing
  metadata: Record<string, any>; // Custom metadata
  last_heartbeat: number;
  registered_at: number;
  tags: string[]; // Tags for filtering
}

export interface HealthCheck {
  status: ServiceStatus;
  message: string;
  timestamp: number;
  response_time_ms: number;
}

export interface ServiceRegistryStats {
  total_services: number;
  total_instances: number;
  healthy_instances: number;
  unhealthy_instances: number;
  registration_rate: number; // per minute
  deregistration_rate: number; // per minute
}

/**
 * Service Registry
 * Central registry for service instances
 */
export class ServiceRegistry {
  private services: Map<string, ServiceInstance[]> = new Map();
  private health_checks: Map<string, HealthCheck[]> = new Map();
  private watchers: Map<string, Set<(instances: ServiceInstance[]) => void>> = new Map();
  private heartbeat_timeout_ms: number = 30000;
  private registration_count: number = 0;
  private deregistration_count: number = 0;

  constructor(heartbeat_timeout_ms: number = 30000) {
    this.heartbeat_timeout_ms = heartbeat_timeout_ms;
  }

  /**
   * Register service instance
   */
  register(instance: ServiceInstance): void {
    if (!this.services.has(instance.service_name)) {
      this.services.set(instance.service_name, []);
    }

    const instances = this.services.get(instance.service_name)!;

    // Check if already registered
    if (instances.some(i => i.id === instance.id)) {
      throw new Error(`Service instance ${instance.id} already registered`);
    }

    instance.registered_at = Date.now();
    instance.last_heartbeat = Date.now();
    instances.push(instance);
    this.registration_count++;

    this.notifyWatchers(instance.service_name);
  }

  /**
   * Deregister service instance
   */
  deregister(service_name: string, instance_id: string): void {
    const instances = this.services.get(service_name);
    if (!instances) return;

    const index = instances.findIndex(i => i.id === instance_id);
    if (index >= 0) {
      instances.splice(index, 1);
      this.deregistration_count++;

      if (instances.length === 0) {
        this.services.delete(service_name);
      }

      this.notifyWatchers(service_name);
    }
  }

  /**
   * Update instance status
   */
  setStatus(service_name: string, instance_id: string, status: ServiceStatus): void {
    const instance = this.getInstance(service_name, instance_id);
    if (instance) {
      instance.status = status;
      this.notifyWatchers(service_name);
    }
  }

  /**
   * Heartbeat (keep-alive)
   */
  heartbeat(service_name: string, instance_id: string): void {
    const instance = this.getInstance(service_name, instance_id);
    if (instance) {
      instance.last_heartbeat = Date.now();

      // Auto-recover from OUT_OF_SERVICE
      if (instance.status === 'OUT_OF_SERVICE') {
        instance.status = 'UP';
      }
    }
  }

  /**
   * Record health check
   */
  recordHealthCheck(
    service_name: string,
    instance_id: string,
    status: ServiceStatus,
    message: string,
    response_time_ms: number
  ): void {
    const key = `${service_name}:${instance_id}`;
    if (!this.health_checks.has(key)) {
      this.health_checks.set(key, []);
    }

    const checks = this.health_checks.get(key)!;
    checks.push({
      status,
      message,
      timestamp: Date.now(),
      response_time_ms,
    });

    // Keep only last 100 checks
    if (checks.length > 100) {
      checks.shift();
    }

    // Update instance status based on health
    this.setStatus(service_name, instance_id, status);
  }

  /**
   * Get service instances
   */
  getInstances(service_name: string, status?: ServiceStatus): ServiceInstance[] {
    const instances = this.services.get(service_name) || [];

    if (status) {
      return instances.filter(i => i.status === status);
    }

    return instances;
  }

  /**
   * Get healthy instances
   */
  getHealthyInstances(service_name: string): ServiceInstance[] {
    return this.getInstances(service_name, 'UP');
  }

  /**
   * Get single instance
   */
  getInstance(service_name: string, instance_id: string): ServiceInstance | undefined {
    const instances = this.services.get(service_name);
    if (!instances) return undefined;

    return instances.find(i => i.id === instance_id);
  }

  /**
   * List all services
   */
  listServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Watch service changes
   */
  watch(
    service_name: string,
    callback: (instances: ServiceInstance[]) => void
  ): () => void {
    if (!this.watchers.has(service_name)) {
      this.watchers.set(service_name, new Set());
    }

    this.watchers.get(service_name)!.add(callback);

    // Return unwatch function
    return () => {
      this.watchers.get(service_name)?.delete(callback);
    };
  }

  /**
   * Check and clean up expired instances
   */
  cleanupExpired(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [service_name, instances] of this.services.entries()) {
      const before = instances.length;

      for (let i = instances.length - 1; i >= 0; i--) {
        if (now - instances[i].last_heartbeat > this.heartbeat_timeout_ms) {
          instances.splice(i, 1);
          cleaned++;
        }
      }

      if (instances.length === 0) {
        this.services.delete(service_name);
      } else if (instances.length < before) {
        this.notifyWatchers(service_name);
      }
    }

    return cleaned;
  }

  /**
   * Get health check history
   */
  getHealthCheckHistory(
    service_name: string,
    instance_id: string,
    limit: number = 10
  ): HealthCheck[] {
    const key = `${service_name}:${instance_id}`;
    const checks = this.health_checks.get(key) || [];
    return checks.slice(-limit);
  }

  /**
   * Get statistics
   */
  getStats(): ServiceRegistryStats {
    let total_services = 0;
    let total_instances = 0;
    let healthy_instances = 0;
    let unhealthy_instances = 0;

    for (const instances of this.services.values()) {
      total_services++;
      total_instances += instances.length;

      for (const instance of instances) {
        if (instance.status === 'UP') {
          healthy_instances++;
        } else {
          unhealthy_instances++;
        }
      }
    }

    return {
      total_services,
      total_instances,
      healthy_instances,
      unhealthy_instances,
      registration_rate: this.registration_count / Math.max(1, Date.now() / 60000),
      deregistration_rate: this.deregistration_count / Math.max(1, Date.now() / 60000),
    };
  }

  /**
   * Private: Notify watchers
   */
  private notifyWatchers(service_name: string): void {
    const callbacks = this.watchers.get(service_name);
    if (!callbacks) return;

    const instances = this.getInstances(service_name);
    for (const callback of callbacks) {
      callback(instances);
    }
  }
}

/**
 * Load Balancer
 * Selects instances using various strategies
 */
export class LoadBalancer {
  private strategy: LoadBalancerStrategy;
  private current_index: number = 0;

  constructor(strategy: LoadBalancerStrategy = 'ROUND_ROBIN') {
    this.strategy = strategy;
  }

  /**
   * Select instance
   */
  select(instances: ServiceInstance[]): ServiceInstance | undefined {
    if (instances.length === 0) return undefined;

    switch (this.strategy) {
      case 'ROUND_ROBIN':
        return this.roundRobin(instances);
      case 'LEAST_CONNECTIONS':
        return this.leastConnections(instances);
      case 'RANDOM':
        return this.random(instances);
      case 'WEIGHT_BASED':
        return this.weightBased(instances);
      default:
        return instances[0];
    }
  }

  private roundRobin(instances: ServiceInstance[]): ServiceInstance {
    const instance = instances[this.current_index % instances.length];
    this.current_index++;
    return instance;
  }

  private leastConnections(instances: ServiceInstance[]): ServiceInstance {
    // Simplified: use weight as inverse of connections
    return instances.reduce((min, inst) =>
      inst.weight > min.weight ? inst : min
    );
  }

  private random(instances: ServiceInstance[]): ServiceInstance {
    return instances[Math.floor(Math.random() * instances.length)];
  }

  private weightBased(instances: ServiceInstance[]): ServiceInstance {
    const total_weight = instances.reduce((sum, i) => sum + i.weight, 0);
    let random = Math.random() * total_weight;

    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) return instance;
    }

    return instances[instances.length - 1];
  }
}

/**
 * Service Locator
 * Convenience wrapper for service discovery and load balancing
 */
export class ServiceLocator {
  private registry: ServiceRegistry;
  private load_balancers: Map<string, LoadBalancer> = new Map();

  constructor(registry: ServiceRegistry) {
    this.registry = registry;
  }

  /**
   * Get service instance
   */
  locate(service_name: string, strategy?: LoadBalancerStrategy): ServiceInstance | undefined {
    const instances = this.registry.getHealthyInstances(service_name);
    if (instances.length === 0) return undefined;

    if (!this.load_balancers.has(service_name)) {
      this.load_balancers.set(
        service_name,
        new LoadBalancer(strategy || 'ROUND_ROBIN')
      );
    }

    return this.load_balancers.get(service_name)!.select(instances);
  }

  /**
   * Get instance URL
   */
  getUrl(service_name: string, path: string = ''): string | undefined {
    const instance = this.locate(service_name);
    if (!instance) return undefined;

    const protocol = instance.metadata.protocol || 'http';
    return `${protocol}://${instance.host}:${instance.port}${path}`;
  }

  /**
   * Get all instances for service
   */
  getAll(service_name: string): ServiceInstance[] {
    return this.registry.getHealthyInstances(service_name);
  }
}

export default { ServiceRegistry, LoadBalancer, ServiceLocator };
