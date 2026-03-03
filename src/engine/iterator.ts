// FreeLang v2 - Iterator Protocol (Lazy Evaluation)
// Memory-efficient iteration for ranges: O(1) space instead of O(n)

/**
 * Iterator: Lazy range evaluation
 *
 * Traditional: range(10) = [0,1,2,3,4,5,6,7,8,9] = 80 bytes
 * Iterator:   range(10) = { current: 0, end: 10 } = 16 bytes (80% memory saved)
 *
 * Operations:
 * - ITER_INIT(start, end): Create iterator
 * - ITER_HAS(): Check if more values
 * - ITER_NEXT(): Get next value and advance
 */
export interface Iterator {
  current: number;        // current value
  end: number;           // exclusive end
  step?: number;         // step size (default 1, can be negative)
}

export class IteratorEngine {
  /**
   * Initialize iterator from range
   * stack: [start, end] → [iterator]
   *
   * Example: range(0, 10) → Iterator { current: 0, end: 10 }
   */
  static init(start: number, end: number, step: number = 1): Iterator {
    if (step === 0) throw new Error('Iterator step cannot be zero');
    return { current: start, end, step };
  }

  /**
   * Check if iterator has more values
   * stack: [iterator] → [bool]
   *
   * Returns true if there are more values to iterate
   */
  static has(iter: Iterator): boolean {
    const step = iter.step || 1;
    if (step > 0) {
      return iter.current < iter.end;
    } else {
      return iter.current > iter.end;
    }
  }

  /**
   * Get next value and advance
   * stack: [iterator] → [value, iterator]
   *
   * Returns { value: current, iterator: advanced }
   */
  static next(iter: Iterator): { value: number; iterator: Iterator } {
    if (!this.has(iter)) {
      throw new Error('Iterator exhausted');
    }

    const value = iter.current;
    const nextIter: Iterator = {
      current: iter.current + (iter.step || 1),
      end: iter.end,
      step: iter.step,
    };

    return { value, iterator: nextIter };
  }

  /**
   * Convert iterator to array (for debugging)
   * Useful for testing and verification
   */
  static toArray(iter: Iterator): number[] {
    const result: number[] = [];
    let current = iter;

    while (this.has(current)) {
      const { value, iterator: next } = this.next(current);
      result.push(value);
      current = next;
    }

    return result;
  }

  /**
   * Get memory size of iterator vs array
   * Demonstrates memory savings
   */
  static getMemoryEstimate(iter: Iterator): number {
    // Estimate: 3 numbers (current, end, step) = 24 bytes (64-bit)
    return 24;
  }

  /**
   * Get memory size of equivalent array
   */
  static getArrayMemoryEstimate(iter: Iterator): number {
    const step = iter.step || 1;
    let count = 0;
    if (step > 0) {
      count = Math.ceil((iter.end - iter.current) / step);
    } else {
      count = Math.ceil((iter.current - iter.end) / Math.abs(step));
    }
    // Each number = 8 bytes, array overhead ≈ 16 bytes
    return 16 + count * 8;
  }

  /**
   * Memory savings percentage
   */
  static getMemorySavingsPercent(iter: Iterator): number {
    const arraySize = this.getArrayMemoryEstimate(iter);
    const iterSize = this.getMemoryEstimate(iter);
    return Math.round(((arraySize - iterSize) / arraySize) * 100);
  }
}

/**
 * Learning: Track iterator usage patterns
 */
export interface IteratorMetric {
  rangeType: string;           // 'forward' | 'backward' | 'step'
  start: number;
  end: number;
  step: number;
  elementsCount: number;
  arrayMemory: number;
  iteratorMemory: number;
  savedPercent: number;
  timestamp: number;
}

export class IteratorLearner {
  private metrics: IteratorMetric[] = [];

  record(iter: Iterator): void {
    const step = iter.step || 1;
    let elementsCount = 0;
    if (step > 0) {
      elementsCount = Math.max(0, Math.ceil((iter.end - iter.current) / step));
    } else {
      elementsCount = Math.max(0, Math.ceil((iter.current - iter.end) / Math.abs(step)));
    }

    const arrayMem = IteratorEngine.getArrayMemoryEstimate(iter);
    const iterMem = IteratorEngine.getMemoryEstimate(iter);

    this.metrics.push({
      rangeType: step > 0 ? (step === 1 ? 'forward' : 'step') : 'backward',
      start: iter.current,
      end: iter.end,
      step,
      elementsCount,
      arrayMemory: arrayMem,
      iteratorMemory: iterMem,
      savedPercent: IteratorEngine.getMemorySavingsPercent(iter),
      timestamp: Date.now(),
    });
  }

  /**
   * Total memory saved across all iterators
   */
  getTotalSavings(): {
    totalArrayMemory: number;
    totalIteratorMemory: number;
    totalSaved: number;
    savingsPercent: number;
  } {
    let arrayMem = 0;
    let iterMem = 0;

    for (const m of this.metrics) {
      arrayMem += m.arrayMemory;
      iterMem += m.iteratorMemory;
    }

    return {
      totalArrayMemory: arrayMem,
      totalIteratorMemory: iterMem,
      totalSaved: arrayMem - iterMem,
      savingsPercent: arrayMem > 0 ? Math.round(((arrayMem - iterMem) / arrayMem) * 100) : 0,
    };
  }

  /**
   * Average elements per iterator
   */
  getStats(): {
    count: number;
    avgElements: number;
    avgMemorySaved: number;
    maxRange: number;
  } {
    if (this.metrics.length === 0) {
      return { count: 0, avgElements: 0, avgMemorySaved: 0, maxRange: 0 };
    }

    const totalElements = this.metrics.reduce((sum, m) => sum + m.elementsCount, 0);
    const avgSaved = this.metrics.reduce((sum, m) => sum + m.savedPercent, 0) / this.metrics.length;
    const maxRange = Math.max(...this.metrics.map(m => m.elementsCount));

    return {
      count: this.metrics.length,
      avgElements: Math.round(totalElements / this.metrics.length),
      avgMemorySaved: Math.round(avgSaved),
      maxRange,
    };
  }

  getMetrics(): IteratorMetric[] {
    return [...this.metrics];
  }
}
