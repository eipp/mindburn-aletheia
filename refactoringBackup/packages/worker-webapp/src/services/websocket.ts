import { useAppStore } from '../store';

const WS_URL = process.env.REACT_APP_WS_URL || 'wss://api.mindburn.org/ws';

type MessageType = 'task_update' | 'balance_update' | 'notification';

interface WebSocketMessage {
  type: MessageType;
  payload: any;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000;
  private subscribedTasks: Set<string> = new Set();

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.resubscribeToTasks();
          resolve();
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.handleDisconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onmessage = this.handleMessage;
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        reject(error);
      }
    });
  }

  private handleMessage = (event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      const { actions } = useAppStore.getState();

      switch (message.type) {
        case 'task_update':
          actions.updateTask(message.payload);
          break;
        case 'balance_update':
          actions.updateBalance(message.payload.balance);
          break;
        case 'notification':
          actions.addNotification(message.payload);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to handle WebSocket message:', error);
    }
  };

  private handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const timeout = this.reconnectTimeout * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Reconnecting in ${timeout}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), timeout);
    } else {
      const { actions } = useAppStore.getState();
      actions.setError('Lost connection to server. Please restart the app.');
    }
  }

  private resubscribeToTasks() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.subscribedTasks.forEach((taskId) => {
        this.sendMessage({
          type: 'subscribe_task',
          payload: { taskId },
        });
      });
    }
  }

  subscribeToTask(taskId: string) {
    this.subscribedTasks.add(taskId);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendMessage({
        type: 'subscribe_task',
        payload: { taskId },
      });
    }
  }

  unsubscribeFromTask(taskId: string) {
    this.subscribedTasks.delete(taskId);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendMessage({
        type: 'unsubscribe_task',
        payload: { taskId },
      });
    }
  }

  private sendMessage(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribedTasks.clear();
  }
}

export const wsService = new WebSocketService(); 