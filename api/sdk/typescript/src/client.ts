import { GraphQLClient } from 'graphql-request';
import { RetryableHttpClient, RetryConfig } from './http';
import { WebSocketClient, WebSocketOptions } from './websocket';
import { VerificationMethod, Webhook, TaskType } from './types';
import { CreateVerificationMethodInput, CreateWebhookInput, CreateTaskTypeInput } from './inputs';

export interface MindburnClientConfig {
  apiKey?: string;
  oauth2Token?: string;
  endpoint?: string;
  retryConfig?: RetryConfig;
  websocket?: {
    enabled: boolean;
    options?: Partial<WebSocketOptions>;
  };
}

export class MindburnClient {
  private httpClient: RetryableHttpClient;
  private graphqlClient: GraphQLClient;
  private wsClient: WebSocketClient | null = null;
  private readonly config: MindburnClientConfig;

  constructor(config: MindburnClientConfig) {
    this.config = config;
    const endpoint = config.endpoint || 'https://api.mindburn.org/v1';

    this.httpClient = new RetryableHttpClient({
      baseUrl: endpoint,
      headers: this.buildHeaders(config),
      retryConfig: config.retryConfig,
    });

    this.graphqlClient = new GraphQLClient(`${endpoint}/graphql`, {
      headers: this.buildHeaders(config),
    });

    if (config.websocket?.enabled) {
      const wsEndpoint = endpoint.replace(/^http/, 'ws');
      this.wsClient = new WebSocketClient({
        endpoint: `${wsEndpoint}/ws`,
        token: config.oauth2Token || config.apiKey || '',
        ...config.websocket.options,
      });
    }
  }

  private buildHeaders(config: { apiKey?: string; oauth2Token?: string }): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey) {
      headers['X-API-Key'] = config.apiKey;
    }

    if (config.oauth2Token) {
      headers['Authorization'] = `Bearer ${config.oauth2Token}`;
    }

    return headers;
  }

  // WebSocket Methods
  public async connectWebSocket(): Promise<void> {
    if (!this.wsClient) {
      throw new Error('WebSocket is not enabled');
    }
    await this.wsClient.connect();
  }

  public async subscribeToEvents(
    type: string,
    callback: (data: any) => void,
    filter?: Record<string, any>
  ): Promise<string> {
    if (!this.wsClient) {
      throw new Error('WebSocket is not enabled');
    }

    if (!this.wsClient || this.wsClient.readyState !== WebSocket.OPEN) {
      await this.connectWebSocket();
    }

    const subscriptionId = await this.wsClient.subscribe(type, filter);
    this.wsClient.on(type, callback);
    return subscriptionId;
  }

  public async unsubscribeFromEvents(subscriptionId: string): Promise<void> {
    if (!this.wsClient) {
      throw new Error('WebSocket is not enabled');
    }
    await this.wsClient.unsubscribe(subscriptionId);
  }

  public disconnectWebSocket(): void {
    this.wsClient?.disconnect();
  }

  // Verification Methods
  async createVerificationMethod(
    input: CreateVerificationMethodInput
  ): Promise<VerificationMethod> {
    return this.httpClient.post('/verification-methods', input);
  }

  async getVerificationMethod(id: string): Promise<VerificationMethod> {
    return this.httpClient.get(`/verification-methods/${id}`);
  }

  async listVerificationMethods(params?: {
    page?: number;
    limit?: number;
  }): Promise<VerificationMethod[]> {
    return this.httpClient.get('/verification-methods', { params });
  }

  async updateVerificationMethod(
    id: string,
    input: Partial<CreateVerificationMethodInput>
  ): Promise<VerificationMethod> {
    return this.httpClient.patch(`/verification-methods/${id}`, input);
  }

  async deleteVerificationMethod(id: string): Promise<void> {
    await this.httpClient.delete(`/verification-methods/${id}`);
  }

  // Webhooks
  async createWebhook(input: CreateWebhookInput): Promise<Webhook> {
    return this.httpClient.post('/webhooks', input);
  }

  async getWebhook(id: string): Promise<Webhook> {
    return this.httpClient.get(`/webhooks/${id}`);
  }

  async listWebhooks(params?: { page?: number; limit?: number }): Promise<Webhook[]> {
    return this.httpClient.get('/webhooks', { params });
  }

  async updateWebhook(id: string, input: Partial<CreateWebhookInput>): Promise<Webhook> {
    return this.httpClient.patch(`/webhooks/${id}`, input);
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.httpClient.delete(`/webhooks/${id}`);
  }

  // Task Types
  async createTaskType(input: CreateTaskTypeInput): Promise<TaskType> {
    return this.httpClient.post('/tasks/types', input);
  }

  async getTaskType(id: string): Promise<TaskType> {
    return this.httpClient.get(`/tasks/types/${id}`);
  }

  async listTaskTypes(params?: { page?: number; limit?: number }): Promise<TaskType[]> {
    return this.httpClient.get('/tasks/types', { params });
  }

  async updateTaskType(id: string, input: Partial<CreateTaskTypeInput>): Promise<TaskType> {
    return this.httpClient.patch(`/tasks/types/${id}`, input);
  }

  async deleteTaskType(id: string): Promise<void> {
    await this.httpClient.delete(`/tasks/types/${id}`);
  }

  // Batch Operations
  async batchCreateVerificationMethods(
    inputs: CreateVerificationMethodInput[]
  ): Promise<VerificationMethod[]> {
    return this.httpClient.post('/verification-methods/batch', { items: inputs });
  }

  async batchCreateWebhooks(inputs: CreateWebhookInput[]): Promise<Webhook[]> {
    return this.httpClient.post('/webhooks/batch', { items: inputs });
  }

  async batchCreateTaskTypes(inputs: CreateTaskTypeInput[]): Promise<TaskType[]> {
    return this.httpClient.post('/tasks/types/batch', { items: inputs });
  }

  // GraphQL Operations
  async queryVerificationMethods(variables?: {
    first?: number;
    after?: string;
    filter?: Record<string, any>;
  }) {
    const query = `
      query VerificationMethods($first: Int, $after: String, $filter: VerificationMethodFilter) {
        verificationMethods(first: $first, after: $after, filter: $filter) {
          edges {
            node {
              id
              name
              endpoint
              inputSchema
              outputSchema
              timeout
              createdAt
              updatedAt
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;
    return this.graphqlClient.request(query, variables);
  }
}
