/**
 * Phase 17.2: Memory Safety
 *
 * Implements memory safety checks:
 * - Buffer overflow detection
 * - Use-after-free prevention
 * - Bounds checking
 * - Type safety validation
 * - Memory leak detection
 */

export interface BufferCheckResult {
  safe: boolean;
  reason?: string;
  buffer_size: number;
  access_position: number;
  overflow_detected: boolean;
}

export interface MemoryAllocation {
  id: string;
  address: number;
  size: number;
  allocated_at: Date;
  deallocated_at?: Date;
  type: string;
  data?: Buffer;
}

export interface UseAfterFreeCheck {
  violation_found: boolean;
  address: number;
  allocated_at: Date;
  deallocated_at?: Date;
  accessed_at: Date;
}

export interface TypeSafetyCheck {
  valid: boolean;
  expected_type: string;
  actual_type: string;
  violation_details?: string;
}

export interface MemoryLeakReport {
  leaked_allocations: number;
  total_leaked_bytes: number;
  allocations: MemoryAllocation[];
  timestamp: Date;
}

/**
 * Memory Safety Module
 * Detects and prevents common memory vulnerabilities
 */
export class MemorySafetyModule {
  private allocations: Map<string, MemoryAllocation>;
  private deallocated: Map<string, MemoryAllocation>;
  private access_log: Array<{ address: number; timestamp: Date }>;
  private boundary_checks_count: number;
  private violations_found: number;
  private error_log: string[];

  constructor() {
    this.allocations = new Map();
    this.deallocated = new Map();
    this.access_log = [];
    this.boundary_checks_count = 0;
    this.violations_found = 0;
    this.error_log = [];
  }

  // ────────── Buffer Safety (3) ──────────

  /**
   * Check buffer bounds before access
   */
  checkBufferBounds(
    buffer: Buffer | string,
    access_position: number,
    access_size: number = 1
  ): BufferCheckResult {
    try {
      const buffer_size = typeof buffer === 'string' ? buffer.length : buffer.length;
      const end_position = access_position + access_size;

      this.boundary_checks_count++;

      if (access_position < 0) {
        this.violations_found++;
        return {
          safe: false,
          reason: 'Negative buffer access',
          buffer_size,
          access_position,
          overflow_detected: true,
        };
      }

      if (end_position > buffer_size) {
        this.violations_found++;
        return {
          safe: false,
          reason: `Buffer overflow: accessing beyond bounds (${end_position} > ${buffer_size})`,
          buffer_size,
          access_position,
          overflow_detected: true,
        };
      }

      return {
        safe: true,
        buffer_size,
        access_position,
        overflow_detected: false,
      };
    } catch (error) {
      this.logError(`Buffer bounds check error: ${error}`);
      return {
        safe: false,
        reason: String(error),
        buffer_size: 0,
        access_position,
        overflow_detected: true,
      };
    }
  }

  /**
   * Safe string concatenation with bounds checking
   */
  safeConcatenate(strings: string[], max_length: number = 10000): string {
    try {
      let total_length = 0;

      for (const str of strings) {
        total_length += str.length;
        if (total_length > max_length) {
          this.violations_found++;
          throw new Error(
            `String concatenation would exceed max length: ${max_length}`
          );
        }
      }

      this.boundary_checks_count++;
      return strings.join('');
    } catch (error) {
      this.logError(`Safe concatenation error: ${error}`);
      throw error;
    }
  }

  /**
   * Safe array access with bounds checking
   */
  safeArrayAccess<T>(array: T[], index: number): T | null {
    try {
      if (index < 0 || index >= array.length) {
        this.violations_found++;
        this.logError(`Array bounds violation: index ${index} out of bounds [0, ${array.length})`);
        return null;
      }

      this.boundary_checks_count++;
      return array[index];
    } catch (error) {
      this.logError(`Safe array access error: ${error}`);
      return null;
    }
  }

  // ────────── Memory Allocation Tracking (3) ──────────

  /**
   * Register memory allocation
   */
  allocate(type: string, size: number): string {
    try {
      const id = `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const address = 0x100000 + Math.floor(Math.random() * 0xfffffff);

      const allocation: MemoryAllocation = {
        id,
        address,
        size,
        allocated_at: new Date(),
        type,
      };

      this.allocations.set(id, allocation);
      return id;
    } catch (error) {
      this.logError(`Allocation error: ${error}`);
      throw error;
    }
  }

  /**
   * Deallocate memory
   */
  deallocate(allocation_id: string): boolean {
    try {
      const allocation = this.allocations.get(allocation_id);

      if (!allocation) {
        this.violations_found++;
        this.logError(`Deallocation of non-existent allocation: ${allocation_id}`);
        return false;
      }

      allocation.deallocated_at = new Date();
      this.deallocated.set(allocation_id, allocation);
      this.allocations.delete(allocation_id);

      return true;
    } catch (error) {
      this.logError(`Deallocation error: ${error}`);
      return false;
    }
  }

  /**
   * Check for use-after-free
   */
  checkUseAfterFree(allocation_id: string): UseAfterFreeCheck {
    try {
      const deallocated = this.deallocated.get(allocation_id);

      if (!deallocated) {
        return {
          violation_found: false,
          address: 0,
          allocated_at: new Date(),
          accessed_at: new Date(),
        };
      }

      this.violations_found++;

      return {
        violation_found: true,
        address: deallocated.address,
        allocated_at: deallocated.allocated_at,
        deallocated_at: deallocated.deallocated_at,
        accessed_at: new Date(),
      };
    } catch (error) {
      this.logError(`Use-after-free check error: ${error}`);
      return {
        violation_found: false,
        address: 0,
        allocated_at: new Date(),
        accessed_at: new Date(),
      };
    }
  }

  // ────────── Type Safety (2) ──────────

  /**
   * Check type safety
   */
  checkTypeSafety(value: any, expected_type: string): TypeSafetyCheck {
    try {
      const actual_type = typeof value;
      let valid = false;

      // Type mapping
      const type_map: Record<string, string[]> = {
        'string': ['string'],
        'number': ['number'],
        'boolean': ['boolean'],
        'object': ['object'],
        'array': ['object'], // arrays are objects in JS
        'null': ['object'],
        'undefined': ['undefined'],
        'any': ['string', 'number', 'boolean', 'object', 'undefined'],
      };

      const valid_types = type_map[expected_type] || [];

      if (expected_type === 'array' && Array.isArray(value)) {
        valid = true;
      } else if (valid_types.includes(actual_type)) {
        valid = true;
      } else if (expected_type === 'any') {
        valid = true;
      }

      if (!valid) {
        this.violations_found++;
      }

      this.boundary_checks_count++;

      return {
        valid,
        expected_type,
        actual_type,
        violation_details: valid
          ? undefined
          : `Type mismatch: expected ${expected_type}, got ${actual_type}`,
      };
    } catch (error) {
      this.logError(`Type safety check error: ${error}`);
      return {
        valid: false,
        expected_type,
        actual_type: 'unknown',
      };
    }
  }

  /**
   * Validate null pointer
   */
  checkNotNull(value: any, context: string = 'value'): boolean {
    if (value === null || value === undefined) {
      this.violations_found++;
      this.logError(`Null pointer violation: ${context} is null/undefined`);
      return false;
    }
    this.boundary_checks_count++;
    return true;
  }

  // ────────── Memory Leak Detection (2) ──────────

  /**
   * Detect memory leaks
   */
  detectMemoryLeaks(): MemoryLeakReport {
    try {
      const leaked: MemoryAllocation[] = [];
      let total_leaked = 0;

      for (const allocation of this.allocations.values()) {
        // Check if allocated for too long without deallocation
        const age = Date.now() - allocation.allocated_at.getTime();
        if (age > 60000) { // 60 seconds without deallocation = potential leak
          leaked.push(allocation);
          total_leaked += allocation.size;
        }
      }

      return {
        leaked_allocations: leaked.length,
        total_leaked_bytes: total_leaked,
        allocations: leaked,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logError(`Memory leak detection error: ${error}`);
      return {
        leaked_allocations: 0,
        total_leaked_bytes: 0,
        allocations: [],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get memory report
   */
  getMemoryReport(): {
    active_allocations: number;
    deallocated: number;
    total_bytes: number;
    boundary_checks: number;
    violations: number;
  } {
    let total_bytes = 0;
    for (const alloc of this.allocations.values()) {
      total_bytes += alloc.size;
    }

    return {
      active_allocations: this.allocations.size,
      deallocated: this.deallocated.size,
      total_bytes,
      boundary_checks: this.boundary_checks_count,
      violations: this.violations_found,
    };
  }

  // ────────── Utilities ──────────

  /**
   * Get error log
   */
  getErrors(): string[] {
    return [...this.error_log];
  }

  /**
   * Clear errors
   */
  clearErrors(): void {
    this.error_log = [];
  }

  /**
   * Reset all tracking
   */
  reset(): void {
    this.allocations.clear();
    this.deallocated.clear();
    this.access_log = [];
    this.boundary_checks_count = 0;
    this.violations_found = 0;
    this.error_log = [];
  }

  /**
   * Log error
   */
  private logError(message: string): void {
    this.error_log.push(`[${new Date().toISOString()}] ${message}`);
  }

  /**
   * Get active allocations
   */
  getAllocations(): MemoryAllocation[] {
    return Array.from(this.allocations.values());
  }
}

export default MemorySafetyModule;
