/**
 * Phase 24.3: Message Queue
 * Async message processing
 */

export interface Message {
  id: string;
  type: string;
  payload: Record<string, any>;
  timestamp: number;
  retries: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

export class MessageQueue {
  private queue: Message[] = [];
  private processed: Map<string, Message> = new Map();
  private message_counter: number = 0;
  private max_retries: number = 3;

  enqueue(type: string, payload: Record<string, any>): Message {
    const message: Message = {
      id: `msg-${this.message_counter++}`,
      type,
      payload,
      timestamp: Date.now(),
      retries: 0,
      status: 'PENDING',
    };

    this.queue.push(message);
    return message;
  }

  async dequeue(): Promise<Message | undefined> {
    return this.queue.shift();
  }

  async process(handler: (msg: Message) => Promise<void>): Promise<number> {
    let processed_count = 0;

    while (this.queue.length > 0) {
      const message = await this.dequeue();
      if (!message) break;

      message.status = 'PROCESSING';

      try {
        await handler(message);
        message.status = 'COMPLETED';
        this.processed.set(message.id, message);
        processed_count++;
      } catch (error) {
        message.retries++;

        if (message.retries < this.max_retries) {
          message.status = 'PENDING';
          this.queue.push(message);
        } else {
          message.status = 'FAILED';
          this.processed.set(message.id, message);
        }
      }
    }

    return processed_count;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getProcessedCount(): number {
    return this.processed.size;
  }

  getStats() {
    const completed = Array.from(this.processed.values()).filter((m) => m.status === 'COMPLETED').length;
    const failed = Array.from(this.processed.values()).filter((m) => m.status === 'FAILED').length;

    return {
      queued: this.queue.length,
      completed,
      failed,
      total_processed: this.processed.size,
    };
  }
}

export default { MessageQueue };
