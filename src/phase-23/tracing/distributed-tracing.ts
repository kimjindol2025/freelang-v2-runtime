/**
 * Phase 23.3: Distributed Tracing
 *
 * Request tracing across distributed systems:
 * - Trace context (trace ID, span ID)
 * - Span creation and tracking
 * - Metrics collection
 * - Integration with observability systems
 */

export type SpanKind = 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';
export type SpanStatus = 'UNSET' | 'OK' | 'ERROR';

export interface SpanContext {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  trace_flags: number; // 0 = not sampled, 1 = sampled
}

export interface Span {
  context: SpanContext;
  name: string;
  kind: SpanKind;
  status: SpanStatus;
  start_time: number;
  end_time?: number;
  duration_ms?: number;
  attributes: Record<string, any>;
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, any>;
}

export interface TraceMetrics {
  trace_id: string;
  total_spans: number;
  duration_ms: number;
  error_count: number;
  success_count: number;
  root_span_name: string;
}

/**
 * Span
 * Represents a single operation in a trace
 */
export class SpanImpl implements Span {
  context: SpanContext;
  name: string;
  kind: SpanKind;
  status: SpanStatus = 'UNSET';
  start_time: number;
  end_time?: number;
  duration_ms?: number;
  attributes: Record<string, any> = {};
  events: SpanEvent[] = [];

  constructor(
    context: SpanContext,
    name: string,
    kind: SpanKind = 'INTERNAL'
  ) {
    this.context = context;
    this.name = name;
    this.kind = kind;
    this.start_time = Date.now();
  }

  /**
   * Add attribute
   */
  addAttribute(key: string, value: any): void {
    this.attributes[key] = value;
  }

  /**
   * Add event
   */
  addEvent(name: string, attributes?: Record<string, any>): void {
    this.events.push({
      name,
      timestamp: Date.now(),
      attributes: attributes || {},
    });
  }

  /**
   * Set status
   */
  setStatus(status: SpanStatus): void {
    this.status = status;
  }

  /**
   * End span
   */
  end(): void {
    this.end_time = Date.now();
    this.duration_ms = this.end_time - this.start_time;
  }

  /**
   * Get span context
   */
  getContext(): SpanContext {
    return this.context;
  }
}

/**
 * Tracer
 * Creates and manages spans
 */
export class Tracer {
  private spans: Map<string, SpanImpl> = new Map();
  private root_spans: Map<string, SpanImpl> = new Map();
  private active_spans: SpanImpl[] = [];
  private span_counter: number = 0;
  private trace_counter: number = 0;
  private sampled_traces: Set<string> = new Set();
  private sample_rate: number = 1.0; // 100% sampling by default

  constructor(sample_rate: number = 1.0) {
    this.sample_rate = sample_rate;
  }

  /**
   * Start root trace
   */
  startTrace(name: string): SpanImpl {
    const trace_id = this.generateTraceId();
    const span_id = this.generateSpanId();
    const should_sample = Math.random() < this.sample_rate;

    if (should_sample) {
      this.sampled_traces.add(trace_id);
    }

    const context: SpanContext = {
      trace_id,
      span_id,
      trace_flags: should_sample ? 1 : 0,
    };

    const span = new SpanImpl(context, name, 'SERVER');
    this.spans.set(span_id, span);
    this.root_spans.set(trace_id, span);
    this.active_spans.push(span);

    return span;
  }

  /**
   * Start child span
   */
  startSpan(name: string, parent: SpanImpl, kind: SpanKind = 'INTERNAL'): SpanImpl {
    const span_id = this.generateSpanId();

    const context: SpanContext = {
      trace_id: parent.context.trace_id,
      span_id,
      parent_span_id: parent.context.span_id,
      trace_flags: parent.context.trace_flags,
    };

    const span = new SpanImpl(context, name, kind);
    this.spans.set(span_id, span);
    this.active_spans.push(span);

    return span;
  }

  /**
   * End span
   */
  endSpan(span: SpanImpl): void {
    span.end();
    const index = this.active_spans.indexOf(span);
    if (index >= 0) {
      this.active_spans.splice(index, 1);
    }
  }

  /**
   * Get span
   */
  getSpan(span_id: string): SpanImpl | undefined {
    return this.spans.get(span_id);
  }

  /**
   * Get trace
   */
  getTrace(trace_id: string): SpanImpl[] {
    const root_span = this.root_spans.get(trace_id);
    if (!root_span) return [];

    return Array.from(this.spans.values()).filter(s => s.context.trace_id === trace_id);
  }

  /**
   * Get active span
   */
  getActiveSpan(): SpanImpl | undefined {
    return this.active_spans[this.active_spans.length - 1];
  }

  /**
   * Get trace metrics
   */
  getTraceMetrics(trace_id: string): TraceMetrics | undefined {
    const root_span = this.root_spans.get(trace_id);
    if (!root_span) return undefined;

    const spans = this.getTrace(trace_id);
    const error_count = spans.filter(s => s.status === 'ERROR').length;
    const success_count = spans.filter(s => s.status === 'OK').length;

    // Calculate total duration from root span
    const duration = root_span.end_time
      ? root_span.end_time - root_span.start_time
      : Date.now() - root_span.start_time;

    return {
      trace_id,
      total_spans: spans.length,
      duration_ms: duration,
      error_count,
      success_count,
      root_span_name: root_span.name,
    };
  }

  /**
   * Extract trace ID from context
   */
  extractTraceId(context: Record<string, any>): string | undefined {
    return context['traceparent']?.split('-')[1]; // W3C Trace Context format
  }

  /**
   * Inject trace context
   */
  injectContext(span: SpanImpl): Record<string, string> {
    const traceparent = `00-${span.context.trace_id}-${span.context.span_id}-0${span.context.trace_flags}`;
    return {
      traceparent,
      'tracestate': '',
    };
  }

  /**
   * Get all active spans
   */
  getActiveSpans(): SpanImpl[] {
    return [...this.active_spans];
  }

  /**
   * Clear expired traces
   */
  clearExpired(age_ms: number = 3600000): number {
    let cleared = 0;
    const now = Date.now();

    for (const [trace_id, root_span] of this.root_spans.entries()) {
      const span_age = now - root_span.start_time;
      if (span_age > age_ms && root_span.end_time) {
        // Remove all spans for this trace
        for (const span of this.getTrace(trace_id)) {
          this.spans.delete(span.context.span_id);
        }
        this.root_spans.delete(trace_id);
        this.sampled_traces.delete(trace_id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Private: Generate trace ID
   */
  private generateTraceId(): string {
    const id = this.trace_counter++;
    return Array(32)
      .fill(0)
      .map((_, i) => ((id >> (i * 4)) & 0xf).toString(16))
      .reverse()
      .join('');
  }

  /**
   * Private: Generate span ID
   */
  private generateSpanId(): string {
    const id = this.span_counter++;
    return Array(16)
      .fill(0)
      .map((_, i) => ((id >> (i * 4)) & 0xf).toString(16))
      .reverse()
      .join('');
  }
}

/**
 * Tracing Context (async-local-storage style)
 * Maintains current span context
 */
export class TracingContext {
  private static current_span: Map<number, SpanImpl> = new Map();

  /**
   * Get current span
   */
  static getCurrentSpan(): SpanImpl | undefined {
    return this.current_span.get(this.getContextId());
  }

  /**
   * Set current span
   */
  static setCurrentSpan(span: SpanImpl): void {
    this.current_span.set(this.getContextId(), span);
  }

  /**
   * Clear current span
   */
  static clearCurrentSpan(): void {
    this.current_span.delete(this.getContextId());
  }

  /**
   * Private: Get context ID (thread-like identifier)
   */
  private static getContextId(): number {
    // In a real system, this would use AsyncLocalStorage or similar
    // For now, use a simple global ID
    return 0;
  }

  /**
   * Run operation with span context
   */
  static async runWithSpan<T>(span: SpanImpl, fn: () => Promise<T>): Promise<T> {
    const previous = this.getCurrentSpan();
    this.setCurrentSpan(span);

    try {
      return await fn();
    } finally {
      if (previous) {
        this.setCurrentSpan(previous);
      } else {
        this.clearCurrentSpan();
      }
    }
  }
}

export default { SpanImpl, Tracer, TracingContext };
