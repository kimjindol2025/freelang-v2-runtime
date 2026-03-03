/**
 * Phase 22.3: Channels (Message Passing)
 *
 * Thread-safe channels for inter-thread communication:
 * - Unbuffered channels (blocking)
 * - Buffered channels (capacity limit)
 * - Channel types with generics
 */

export type ChannelMode = 'unbuffered' | 'buffered';

export interface ChannelConfig<T> {
  mode: ChannelMode;
  capacity?: number; // For buffered channels
  closed?: boolean;
}

export interface ChannelStatistics {
  mode: ChannelMode;
  size: number;
  capacity: number;
  closed: boolean;
  send_count: number;
  recv_count: number;
  drop_count: number;
}

/**
 * Channel<T> - Generic message channel
 * Supports both buffered and unbuffered modes
 */
export class Channel<T> {
  private mode: ChannelMode;
  private capacity: number;
  private buffer: T[] = [];
  private closed: boolean = false;
  private senders_waiting: Array<(value?: any) => void> = [];
  private receivers_waiting: Array<(value?: any) => void> = [];
  private send_count: number = 0;
  private recv_count: number = 0;
  private drop_count: number = 0;

  constructor(config: ChannelConfig<T>) {
    this.mode = config.mode || 'unbuffered';
    this.capacity = config.capacity || (this.mode === 'unbuffered' ? 0 : 1);
    this.closed = config.closed || false;
  }

  /**
   * Send message (blocking if full)
   * Fix: For unbuffered channels, capacity=0 but we can hold 1 message temporarily
   */
  async send(value: T): Promise<void> {
    if (this.closed) {
      throw new Error('Cannot send on closed channel');
    }

    // Wait if buffer is full (adjusted for unbuffered channels)
    // For unbuffered (capacity=0): allow 1 message while receiver consumes it
    // For buffered: respect the capacity limit
    const max_capacity = this.mode === 'unbuffered' ? 1 : this.capacity;
    while (this.buffer.length >= max_capacity) {
      await new Promise(resolve => {
        this.senders_waiting.push(resolve);
      });

      if (this.closed) {
        throw new Error('Channel closed while waiting to send');
      }
    }

    this.buffer.push(value);
    this.send_count++;

    // Wake up waiting receiver
    if (this.receivers_waiting.length > 0) {
      const receiver = this.receivers_waiting.shift();
      if (receiver) receiver();
    }
  }

  /**
   * Receive message (blocking if empty)
   * Fix: Properly handle unbuffered channels with temporary buffer
   */
  async recv(): Promise<T | undefined> {
    // Wait if buffer is empty
    while (this.buffer.length === 0) {
      if (this.closed) {
        return undefined;
      }

      await new Promise<void>(resolve => {
        this.receivers_waiting.push(resolve);
      });

      // After waking, retry checking buffer
    }

    const value = this.buffer.shift();
    this.recv_count++;

    // Wake up waiting sender so it can send next message
    if (this.senders_waiting.length > 0) {
      const sender = this.senders_waiting.shift();
      if (sender) sender();
    }

    return value;
  }

  /**
   * Try send (non-blocking)
   */
  trySend(value: T): boolean {
    if (this.closed || this.buffer.length >= this.capacity) {
      return false;
    }

    this.buffer.push(value);
    this.send_count++;

    // Wake up waiting receiver
    if (this.receivers_waiting.length > 0) {
      const receiver = this.receivers_waiting.shift();
      if (receiver) receiver();
    }

    return true;
  }

  /**
   * Try receive (non-blocking)
   */
  tryRecv(): T | undefined {
    if (this.buffer.length === 0) {
      return undefined;
    }

    const value = this.buffer.shift();
    this.recv_count++;

    // Wake up waiting sender
    if (this.senders_waiting.length > 0) {
      const sender = this.senders_waiting.shift();
      if (sender) sender();
    }

    return value;
  }

  /**
   * Close channel
   */
  close(): void {
    this.closed = true;

    // Wake all waiting threads
    while (this.senders_waiting.length > 0) {
      const sender = this.senders_waiting.shift();
      if (sender) sender();
    }

    while (this.receivers_waiting.length > 0) {
      const receiver = this.receivers_waiting.shift();
      if (receiver) receiver();
    }
  }

  /**
   * Check if closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Check if empty
   */
  isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  /**
   * Check if full
   */
  isFull(): boolean {
    return this.buffer.length >= this.capacity;
  }

  /**
   * Get buffer size
   */
  len(): number {
    return this.buffer.length;
  }

  /**
   * Get statistics
   */
  getStats(): ChannelStatistics {
    return {
      mode: this.mode,
      size: this.buffer.length,
      capacity: this.capacity,
      closed: this.closed,
      send_count: this.send_count,
      recv_count: this.recv_count,
      drop_count: this.drop_count,
    };
  }
}

/**
 * Sender<T> - Send-only end of channel
 */
export class Sender<T> {
  private channel: Channel<T>;

  constructor(channel: Channel<T>) {
    this.channel = channel;
  }

  async send(value: T): Promise<void> {
    return this.channel.send(value);
  }

  trySend(value: T): boolean {
    return this.channel.trySend(value);
  }

  isClosed(): boolean {
    return this.channel.isClosed();
  }

  close(): void {
    return this.channel.close();
  }

  getStats() {
    return this.channel.getStats();
  }
}

/**
 * Receiver<T> - Receive-only end of channel
 */
export class Receiver<T> {
  private channel: Channel<T>;

  constructor(channel: Channel<T>) {
    this.channel = channel;
  }

  async recv(): Promise<T | undefined> {
    return this.channel.recv();
  }

  tryRecv(): T | undefined {
    return this.channel.tryRecv();
  }

  isClosed(): boolean {
    return this.channel.isClosed();
  }

  close(): void {
    return this.channel.close();
  }

  getStats() {
    return this.channel.getStats();
  }
}

/**
 * Create unbuffered channel
 */
export function channel<T>(): [Sender<T>, Receiver<T>] {
  const ch = new Channel<T>({ mode: 'unbuffered', capacity: 0 });
  return [new Sender(ch), new Receiver(ch)];
}

/**
 * Create buffered channel
 */
export function bufferedChannel<T>(capacity: number): [Sender<T>, Receiver<T>] {
  const ch = new Channel<T>({ mode: 'buffered', capacity });
  return [new Sender(ch), new Receiver(ch)];
}

export default { Channel, Sender, Receiver, channel, bufferedChannel };
