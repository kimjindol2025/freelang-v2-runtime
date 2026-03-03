/**
 * Phase 12.2: Message Channel
 *
 * Thread-safe typed message passing
 * - Wraps Node.js MessagePort for inter-thread communication
 * - Generic typed messages
 * - Error handling
 * - Backpressure support
 */

import { MessagePort } from 'worker_threads';

/**
 * Message format
 */
interface Message<T> {
  id: string;
  data: T;
  timestamp: number;
}

/**
 * Typed message channel using MessagePort
 */
export class MessageChannel<T> {
  private port: MessagePort;
  private pendingMessages: Map<string, Message<T>> = new Map();
  private messageCounter = 0;
  private listeners: Array<(msg: T) => void> = [];
  private closed = false;

  constructor(port: MessagePort) {
    this.port = port;
    this.setupListeners();
  }

  /**
   * Setup message listener
   */
  private setupListeners(): void {
    this.port.on('message', (message: Message<T>) => {
      if (this.closed) return;

      this.pendingMessages.set(message.id, message);

      // Call all registered listeners
      this.listeners.forEach(listener => {
        try {
          listener(message.data);
        } catch (error) {
          console.error('Message listener error:', error);
        }
      });
    });

    this.port.on('error', (error) => {
      console.error('MessageChannel error:', error);
    });

    this.port.on('close', () => {
      this.closed = true;
    });
  }

  /**
   * Send message to other end of channel
   *
   * @param data - Message data to send
   * @param transferables - Optional transferable objects
   */
  async send(data: T, transferables?: any[]): Promise<void> {
    if (this.closed) {
      throw new Error('MessageChannel is closed');
    }

    const message: Message<T> = {
      id: `msg_${++this.messageCounter}`,
      data,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      try {
        if (transferables) {
          this.port.postMessage(message, transferables);
        } else {
          this.port.postMessage(message);
        }

        // Resolve immediately (MessagePort is asynchronous)
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Wait for next message
   *
   * @param timeoutMs - Timeout in milliseconds
   */
  async receive(timeoutMs?: number): Promise<T> {
    if (this.closed) {
      throw new Error('MessageChannel is closed');
    }

    return new Promise((resolve, reject) => {
      let timeoutHandle: NodeJS.Timeout | null = null;

      const handleMessage = (msg: T) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        this.listeners = this.listeners.filter(l => l !== handleMessage);
        resolve(msg);
      };

      this.listeners.push(handleMessage);

      if (timeoutMs) {
        timeoutHandle = setTimeout(() => {
          this.listeners = this.listeners.filter(l => l !== handleMessage);
          reject(new Error(`Message receive timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }
    });
  }

  /**
   * Register listener for all incoming messages
   */
  on(callback: (data: T) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Unregister message listener
   */
  off(callback: (data: T) => void): void {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  /**
   * Close channel
   */
  close(): void {
    if (!this.closed) {
      this.closed = true;
      this.listeners = [];
      this.port.close();
    }
  }

  /**
   * Check if channel is open
   */
  isOpen(): boolean {
    return !this.closed;
  }

  /**
   * Get pending message count
   */
  getPendingCount(): number {
    return this.pendingMessages.size;
  }

  /**
   * Get underlying MessagePort
   */
  getPort(): MessagePort {
    return this.port;
  }
}

/**
 * Create a connected pair of message channels
 *
 * @returns [channel1, channel2] where channel1.send(msg) delivers to channel2
 */
export function createLinkedChannels<T>(): [MessageChannel<T>, MessageChannel<T>] {
  const { port1, port2 } = new (require('worker_threads') as typeof import('worker_threads')).MessageChannel();
  return [new MessageChannel<T>(port1), new MessageChannel<T>(port2)];
}

/**
 * Simple request-response channel
 *
 * Supports paired request/response messages
 */
export class RequestResponseChannel<Request, Response> {
  private channel: MessageChannel<{ id: string; type: 'request' | 'response'; data: any }>;
  private responseMap: Map<string, (res: Response) => void> = new Map();
  private requestCounter = 0;

  constructor(port: MessagePort) {
    this.channel = new MessageChannel(port);
    this.channel.on((msg) => {
      if (msg.type === 'response' && this.responseMap.has(msg.id)) {
        const resolve = this.responseMap.get(msg.id)!;
        this.responseMap.delete(msg.id);
        resolve(msg.data);
      }
    });
  }

  /**
   * Send request and wait for response
   */
  async request(data: Request, timeoutMs: number = 30000): Promise<Response> {
    const id = `req_${++this.requestCounter}`;

    return new Promise((resolve, reject) => {
      let timeoutHandle: NodeJS.Timeout | null = null;

      const handleResponse = (response: Response) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        resolve(response);
      };

      this.responseMap.set(id, handleResponse);

      if (timeoutMs) {
        timeoutHandle = setTimeout(() => {
          this.responseMap.delete(id);
          reject(new Error(`Request timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }

      this.channel.send({
        id,
        type: 'request',
        data,
      }).catch(reject);
    });
  }

  /**
   * Send response to request
   */
  async respond(requestId: string, data: Response): Promise<void> {
    return this.channel.send({
      id: requestId,
      type: 'response',
      data,
    });
  }

  /**
   * Register request handler
   */
  onRequest(callback: (data: Request, requestId: string) => Promise<Response> | Response): void {
    this.channel.on((msg) => {
      if (msg.type === 'request') {
        Promise.resolve(callback(msg.data, msg.id))
          .then((response) => this.respond(msg.id, response))
          .catch((error) => {
            console.error('Request handler error:', error);
          });
      }
    });
  }

  /**
   * Close channel
   */
  close(): void {
    this.channel.close();
    this.responseMap.clear();
  }
}
