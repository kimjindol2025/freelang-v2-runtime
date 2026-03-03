/**
 * Phase 24.3: Event-Driven Architecture
 * EventBus for pub/sub messaging
 */

export interface Event {
  type: string;
  data: Record<string, any>;
  timestamp: number;
  source?: string;
}

export interface Subscription {
  id: string;
  event_type: string;
  handler: (event: Event) => void | Promise<void>;
  enabled: boolean;
}

export class EventBus {
  private subscriptions: Map<string, Subscription[]> = new Map();
  private subscription_counter: number = 0;
  private event_history: Event[] = [];
  private max_history: number = 1000;

  subscribe(event_type: string, handler: (event: Event) => void | Promise<void>): () => void {
    const subscription_id = `sub-${this.subscription_counter++}`;

    const subscription: Subscription = {
      id: subscription_id,
      event_type,
      handler,
      enabled: true,
    };

    if (!this.subscriptions.has(event_type)) {
      this.subscriptions.set(event_type, []);
    }

    this.subscriptions.get(event_type)!.push(subscription);

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(event_type);
      if (subs) {
        const idx = subs.findIndex((s) => s.id === subscription_id);
        if (idx >= 0) {
          subs.splice(idx, 1);
        }
      }
    };
  }

  async publish(event: Event): Promise<void> {
    event.timestamp = Date.now();

    // Store in history
    this.event_history.push(event);
    if (this.event_history.length > this.max_history) {
      this.event_history.shift();
    }

    // Publish to subscribers
    const subs = this.subscriptions.get(event.type) || [];
    const promises = subs
      .filter((s) => s.enabled)
      .map((s) => Promise.resolve(s.handler(event)));

    await Promise.all(promises);
  }

  getHistory(event_type?: string, limit: number = 100): Event[] {
    let history = this.event_history;
    if (event_type) {
      history = history.filter((e) => e.type === event_type);
    }
    return history.slice(-limit);
  }

  getSubscriptions(event_type?: string): Subscription[] {
    if (!event_type) {
      return Array.from(this.subscriptions.values()).flat();
    }
    return this.subscriptions.get(event_type) || [];
  }

  getStats() {
    return {
      total_subscriptions: Array.from(this.subscriptions.values()).reduce((sum, subs) => sum + subs.length, 0),
      event_types: this.subscriptions.size,
      history_size: this.event_history.length,
    };
  }
}

export default { EventBus };
