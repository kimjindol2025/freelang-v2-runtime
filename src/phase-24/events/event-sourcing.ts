/**
 * Phase 24.3: Event Sourcing
 * Store event history and rebuild state
 */

export interface DomainEvent {
  aggregate_id: string;
  event_type: string;
  data: Record<string, any>;
  version: number;
  timestamp: number;
}

export interface AggregateState {
  id: string;
  version: number;
  state: Record<string, any>;
}

export class EventStore {
  private events: Map<string, DomainEvent[]> = new Map();
  private snapshots: Map<string, AggregateState> = new Map();
  private snapshot_interval: number = 10;

  append(aggregate_id: string, event: Omit<DomainEvent, 'version' | 'timestamp'>): DomainEvent {
    const version = (this.events.get(aggregate_id)?.length || 0) + 1;

    const domain_event: DomainEvent = {
      ...event,
      version,
      timestamp: Date.now(),
    };

    if (!this.events.has(aggregate_id)) {
      this.events.set(aggregate_id, []);
    }

    this.events.get(aggregate_id)!.push(domain_event);

    // Create snapshot if needed
    if (version % this.snapshot_interval === 0) {
      this.createSnapshot(aggregate_id);
    }

    return domain_event;
  }

  getEvents(aggregate_id: string): DomainEvent[] {
    return this.events.get(aggregate_id) || [];
  }

  rebuildState(aggregate_id: string): AggregateState {
    let state: Record<string, any> = {};
    let version = 0;

    const events = this.getEvents(aggregate_id);
    for (const event of events) {
      state = this.applyEvent(state, event);
      version = event.version;
    }

    return {
      id: aggregate_id,
      version,
      state,
    };
  }

  createSnapshot(aggregate_id: string): AggregateState {
    const state = this.rebuildState(aggregate_id);
    this.snapshots.set(aggregate_id, state);
    return state;
  }

  getSnapshot(aggregate_id: string): AggregateState | undefined {
    return this.snapshots.get(aggregate_id);
  }

  private applyEvent(state: Record<string, any>, event: DomainEvent): Record<string, any> {
    return {
      ...state,
      ...event.data,
      _last_event: event.event_type,
      _version: event.version,
    };
  }
}

export default { EventStore };
