/**
 * Phase 24.3: Event Stream
 * Real-time event streaming
 */

export interface StreamEvent {
  id: string;
  type: string;
  data: Record<string, any>;
  timestamp: number;
  sequence: number;
}

export class EventStream {
  private stream: StreamEvent[] = [];
  private event_counter: number = 0;
  private consumers: Set<(event: StreamEvent) => void | Promise<void>> = new Set();
  private sequence_counter: number = 0;

  async publish(type: string, data: Record<string, any>): Promise<StreamEvent> {
    const event: StreamEvent = {
      id: `event-${this.event_counter++}`,
      type,
      data,
      timestamp: Date.now(),
      sequence: this.sequence_counter++,
    };

    this.stream.push(event);

    // Notify consumers
    for (const consumer of this.consumers) {
      try {
        await Promise.resolve(consumer(event));
      } catch (error) {
        console.error('Consumer error:', error);
      }
    }

    return event;
  }

  subscribe(consumer: (event: StreamEvent) => void | Promise<void>): () => void {
    this.consumers.add(consumer);

    return () => {
      this.consumers.delete(consumer);
    };
  }

  async readFromStart(handler: (event: StreamEvent) => Promise<void>): Promise<void> {
    for (const event of this.stream) {
      await handler(event);
    }
  }

  async readFrom(sequence: number, handler: (event: StreamEvent) => Promise<void>): Promise<void> {
    const events = this.stream.filter((e) => e.sequence >= sequence);
    for (const event of events) {
      await handler(event);
    }
  }

  getEvents(type?: string, limit: number = 100): StreamEvent[] {
    let events = this.stream;
    if (type) {
      events = events.filter((e) => e.type === type);
    }
    return events.slice(-limit);
  }

  getStats() {
    return {
      total_events: this.stream.length,
      active_consumers: this.consumers.size,
      sequence: this.sequence_counter,
    };
  }
}

export default { EventStream };
