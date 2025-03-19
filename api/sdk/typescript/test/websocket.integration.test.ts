import { MindburnClient } from '../src/client';
import { WebSocketOptions } from '../src/websocket';
import { v4 as uuidv4 } from 'uuid';

const TEST_TIMEOUT = 30000;
const WAIT_FOR_EVENT = 5000;

describe('WebSocket Integration Tests', () => {
  let client: MindburnClient;
  const testApiKey = process.env.TEST_API_KEY || 'test-api-key';
  const testEndpoint = process.env.TEST_ENDPOINT || 'https://api.mindburn.org';

  const wsOptions: WebSocketOptions = {
    enabled: true,
    reconnect: true,
    pingInterval: 5000,
  };

  beforeEach(() => {
    client = new MindburnClient({
      apiKey: testApiKey,
      endpoint: testEndpoint,
      websocket: wsOptions,
    });
  });

  afterEach(async () => {
    await client.disconnectWebSocket();
  });

  it(
    'should connect to WebSocket server',
    async () => {
      await expect(client.connectWebSocket()).resolves.not.toThrow();
    },
    TEST_TIMEOUT
  );

  it(
    'should subscribe to events and receive messages',
    async () => {
      await client.connectWebSocket();
      const events: any[] = [];

      const subscription = await client.subscribeToEvents(['TASK_CREATED'], event => {
        events.push(event);
      });

      // Create a test task to trigger an event
      const taskId = uuidv4();
      await client.createTask({
        type: 'TEST_TASK',
        data: { test: true },
        taskId,
      });

      // Wait for event
      await new Promise(resolve => setTimeout(resolve, WAIT_FOR_EVENT));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('TASK_CREATED');
      expect(events[0].taskId).toBe(taskId);

      await client.unsubscribeFromEvents(subscription.id);
    },
    TEST_TIMEOUT
  );

  it(
    'should handle reconnection on connection drop',
    async () => {
      const reconnectEvents: string[] = [];
      await client.connectWebSocket();

      client.on('reconnect', () => {
        reconnectEvents.push('reconnect');
      });

      // Simulate connection drop by closing WebSocket
      await client.wsClient?.close();

      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, WAIT_FOR_EVENT));

      expect(reconnectEvents).toContain('reconnect');
      expect(client.wsClient?.isConnected()).toBe(true);
    },
    TEST_TIMEOUT
  );

  it(
    'should maintain subscriptions after reconnection',
    async () => {
      await client.connectWebSocket();
      const events: any[] = [];

      const subscription = await client.subscribeToEvents(['TASK_COMPLETED'], event => {
        events.push(event);
      });

      // Simulate connection drop
      await client.wsClient?.close();

      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, WAIT_FOR_EVENT));

      // Create test task and complete it
      const taskId = uuidv4();
      await client.createTask({
        type: 'TEST_TASK',
        data: { test: true },
        taskId,
      });
      await client.completeTask(taskId, { result: 'success' });

      // Wait for event
      await new Promise(resolve => setTimeout(resolve, WAIT_FOR_EVENT));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('TASK_COMPLETED');
      expect(events[0].taskId).toBe(taskId);

      await client.unsubscribeFromEvents(subscription.id);
    },
    TEST_TIMEOUT
  );

  it(
    'should handle multiple subscriptions',
    async () => {
      await client.connectWebSocket();
      const taskEvents: any[] = [];
      const paymentEvents: any[] = [];

      const taskSub = await client.subscribeToEvents(['TASK_CREATED', 'TASK_COMPLETED'], event => {
        taskEvents.push(event);
      });

      const paymentSub = await client.subscribeToEvents(['PAYMENT_PROCESSED'], event => {
        paymentEvents.push(event);
      });

      // Create and complete a test task
      const taskId = uuidv4();
      await client.createTask({
        type: 'TEST_TASK',
        data: { test: true },
        taskId,
      });
      await client.completeTask(taskId, { result: 'success' });

      // Process a test payment
      await client.processPayment({
        taskId,
        amount: '1.0',
        currency: 'TON',
      });

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, WAIT_FOR_EVENT));

      expect(taskEvents.length).toBe(2);
      expect(paymentEvents.length).toBe(1);

      await client.unsubscribeFromEvents(taskSub.id);
      await client.unsubscribeFromEvents(paymentSub.id);
    },
    TEST_TIMEOUT
  );

  it(
    'should handle rate limits gracefully',
    async () => {
      await client.connectWebSocket();
      const subscriptions = [];

      // Try to create more than allowed subscriptions
      for (let i = 0; i < 15; i++) {
        try {
          const sub = await client.subscribeToEvents(['TEST_EVENT'], () => {});
          subscriptions.push(sub);
        } catch (error) {
          expect(error.message).toContain('Maximum subscriptions exceeded');
          break;
        }
      }

      expect(subscriptions.length).toBeLessThanOrEqual(10);

      // Cleanup
      for (const sub of subscriptions) {
        await client.unsubscribeFromEvents(sub.id);
      }
    },
    TEST_TIMEOUT
  );

  it(
    'should cleanup resources on disconnect',
    async () => {
      await client.connectWebSocket();
      const subscription = await client.subscribeToEvents(['TEST_EVENT'], () => {});

      await client.disconnectWebSocket();

      // Verify client state
      expect(client.wsClient?.isConnected()).toBe(false);
      expect(client.wsClient?.getSubscriptions().size).toBe(0);

      // Attempt to use disconnected client
      await expect(client.subscribeToEvents(['TEST_EVENT'], () => {})).rejects.toThrow(
        'WebSocket not connected'
      );
    },
    TEST_TIMEOUT
  );
});
