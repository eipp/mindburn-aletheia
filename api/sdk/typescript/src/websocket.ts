import WebSocket from 'isomorphic-ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface WebSocketOptions {
  endpoint: string;
  token: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface Subscription {
  id: string;
  type: string;
  filter?: Record<string, any>;
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Subscription>();
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly options: Required<WebSocketOptions>;

  constructor(options: WebSocketOptions) {
    super();
    this.options = {
      reconnectInterval: 1000,
      maxReconnectAttempts: 5,
      ...options
    };
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(this.options.endpoint);
        url.searchParams.set('token', this.options.token);

        this.ws = new WebSocket(url.toString());

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.startPingInterval();
          this.resubscribe();
          resolve();
        };

        this.ws.onclose = () => {
          this.cleanup();
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          this.emit('error', error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data.toString());
            this.emit(message.type, message.data);
            this.emit('message', message);
          } catch (error) {
            this.emit('error', error);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  public async subscribe(type: string, filter?: Record<string, any>): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const subscription: Subscription = {
      id: uuidv4(),
      type,
      filter
    };

    await this.sendMessage({
      action: 'subscribe',
      type,
      filter
    });

    this.subscriptions.set(subscription.id, subscription);
    return subscription.id;
  }

  public async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      await this.sendMessage({
        action: 'unsubscribe',
        type: subscription.type
      });
    }

    this.subscriptions.delete(subscriptionId);
  }

  public disconnect(): void {
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private async sendMessage(data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      try {
        this.ws.send(JSON.stringify(data));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  private async resubscribe(): Promise<void> {
    const subscriptions = Array.from(this.subscriptions.values());
    for (const subscription of subscriptions) {
      try {
        await this.sendMessage({
          action: 'subscribe',
          type: subscription.type,
          filter: subscription.filter
        });
      } catch (error) {
        this.emit('error', error);
      }
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectAttempts++;
      try {
        await this.connect();
      } catch (error) {
        this.emit('error', error);
      }
    }, this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts));
  }
} 