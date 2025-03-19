import { TaskService } from '../TaskService';
import { WorkerService } from '../WorkerService';
import { PaymentService } from '@mindburn/payment-system';
import { VerificationService } from '@mindburn/verification-engine';
import { createTonService, createLogger } from '@mindburn/shared';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@mindburn/shared');
jest.mock('@mindburn/payment-system');
jest.mock('@mindburn/verification-engine');

describe('Task Flow Integration', () => {
  let taskService: TaskService;
  let workerService: WorkerService;
  let paymentService: PaymentService;
  let verificationService: VerificationService;
  let dynamoDb: DynamoDBDocumentClient;

  beforeAll(async () => {
    // Setup DynamoDB client with local endpoint
    const dbClient = new DynamoDBClient({
      endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
      region: 'local',
      credentials: {
        accessKeyId: 'local',
        secretAccessKey: 'local',
      },
    });
    dynamoDb = DynamoDBDocumentClient.from(dbClient);

    // Initialize services
    paymentService = new PaymentService({
      environment: 'test',
      batchSize: 10,
      minPaymentAmount: 0.1,
    });

    verificationService = new VerificationService({
      environment: 'test',
      minVerifiers: 3,
      consensusThreshold: 0.7,
    });

    taskService = new TaskService({
      dynamoDb,
      paymentService,
      verificationService,
      environment: 'test',
    });

    workerService = new WorkerService({
      dynamoDb,
      paymentService,
      environment: 'test',
    });

    // Create required DynamoDB tables
    await setupTestTables();
  });

  afterAll(async () => {
    await cleanupTestTables();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-end task flow', () => {
    it('should complete full task lifecycle', async () => {
      // 1. Create a new task
      const task = await taskService.createTask({
        type: 'image_verification',
        content: 'https://example.com/image.jpg',
        reward: 1.0,
        requiredVerifications: 3,
      });

      expect(task.id).toBeDefined();
      expect(task.status).toBe('pending');

      // 2. Assign task to workers
      const assignments = await Promise.all([
        workerService.assignTask(task.id, 'worker1'),
        workerService.assignTask(task.id, 'worker2'),
        workerService.assignTask(task.id, 'worker3'),
      ]);

      expect(assignments).toHaveLength(3);
      expect(assignments.every(a => a.status === 'assigned')).toBe(true);

      // 3. Submit verifications
      const verifications = await Promise.all([
        verificationService.submitVerification({
          taskId: task.id,
          workerId: 'worker1',
          result: { isValid: true, confidence: 0.9 },
        }),
        verificationService.submitVerification({
          taskId: task.id,
          workerId: 'worker2',
          result: { isValid: true, confidence: 0.8 },
        }),
        verificationService.submitVerification({
          taskId: task.id,
          workerId: 'worker3',
          result: { isValid: false, confidence: 0.7 },
        }),
      ]);

      expect(verifications).toHaveLength(3);
      expect(verifications.every(v => v.status === 'submitted')).toBe(true);

      // 4. Check consensus and task completion
      const consensus = await verificationService.calculateConsensus(task.id);
      expect(consensus.reached).toBe(true);
      expect(consensus.result.isValid).toBe(true);

      const updatedTask = await taskService.getTask(task.id);
      expect(updatedTask.status).toBe('completed');

      // 5. Verify payments
      const payments = await Promise.all([
        paymentService.getPayment('worker1', task.id),
        paymentService.getPayment('worker2', task.id),
        paymentService.getPayment('worker3', task.id),
      ]);

      expect(payments.every(p => p.status === 'success')).toBe(true);
      expect(payments.every(p => p.amount === task.reward)).toBe(true);
    });

    it('should handle task rejection when consensus not reached', async () => {
      // 1. Create a new task
      const task = await taskService.createTask({
        type: 'image_verification',
        content: 'https://example.com/image2.jpg',
        reward: 1.0,
        requiredVerifications: 3,
      });

      // 2. Submit conflicting verifications
      await Promise.all([
        verificationService.submitVerification({
          taskId: task.id,
          workerId: 'worker1',
          result: { isValid: true, confidence: 0.9 },
        }),
        verificationService.submitVerification({
          taskId: task.id,
          workerId: 'worker2',
          result: { isValid: false, confidence: 0.9 },
        }),
        verificationService.submitVerification({
          taskId: task.id,
          workerId: 'worker3',
          result: { isValid: false, confidence: 0.6 },
        }),
      ]);

      // 3. Check consensus
      const consensus = await verificationService.calculateConsensus(task.id);
      expect(consensus.reached).toBe(false);

      // 4. Verify task status
      const updatedTask = await taskService.getTask(task.id);
      expect(updatedTask.status).toBe('rejected');

      // 5. Verify partial payments
      const payments = await Promise.all([
        paymentService.getPayment('worker1', task.id),
        paymentService.getPayment('worker2', task.id),
        paymentService.getPayment('worker3', task.id),
      ]);

      // Workers should receive partial payment for participation
      expect(payments.every(p => p.status === 'success')).toBe(true);
      expect(payments.every(p => p.amount === task.reward * 0.5)).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle worker unavailability', async () => {
      const task = await taskService.createTask({
        type: 'image_verification',
        content: 'https://example.com/image3.jpg',
        reward: 1.0,
        requiredVerifications: 3,
      });

      // Simulate worker service error
      jest.spyOn(workerService, 'assignTask').mockRejectedValueOnce(
        new Error('Worker unavailable')
      );

      await expect(
        workerService.assignTask(task.id, 'worker1')
      ).rejects.toThrow('Worker unavailable');

      const updatedTask = await taskService.getTask(task.id);
      expect(updatedTask.status).toBe('pending');
    });

    it('should handle payment failures', async () => {
      const task = await taskService.createTask({
        type: 'image_verification',
        content: 'https://example.com/image4.jpg',
        reward: 1.0,
        requiredVerifications: 1,
      });

      // Complete verification
      await verificationService.submitVerification({
        taskId: task.id,
        workerId: 'worker1',
        result: { isValid: true, confidence: 0.9 },
      });

      // Simulate payment failure
      jest.spyOn(paymentService, 'processPayment').mockRejectedValueOnce(
        new Error('Payment failed')
      );

      // Task should be marked as payment_pending
      const updatedTask = await taskService.getTask(task.id);
      expect(updatedTask.status).toBe('payment_pending');

      // Payment retry should be scheduled
      const retryPayment = await paymentService.getPaymentRetry(task.id);
      expect(retryPayment).toBeDefined();
    });
  });
});

async function setupTestTables() {
  // Create test tables
  const tables = [
    {
      TableName: 'Tasks-test',
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 },
    },
    {
      TableName: 'Workers-test',
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 },
    },
    {
      TableName: 'Verifications-test',
      KeySchema: [
        { AttributeName: 'taskId', KeyType: 'HASH' },
        { AttributeName: 'workerId', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'taskId', AttributeType: 'S' },
        { AttributeName: 'workerId', AttributeType: 'S' },
      ],
      ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 },
    },
  ];

  for (const table of tables) {
    await dynamoDb.send({
      TableName: table.TableName,
      ...table,
    });
  }
}

async function cleanupTestTables() {
  const tables = ['Tasks-test', 'Workers-test', 'Verifications-test'];
  for (const table of tables) {
    await dynamoDb.send({
      TableName: table,
    });
  }
} 