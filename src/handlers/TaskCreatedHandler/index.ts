import { Context } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { EventBridge } from '@aws-sdk/client-eventbridge';
import { EventConsumer } from '../../lib/events/consumer';
import { TaskCreatedEvent, TaskCreatedEventSchema, TaskAssignedEvent } from '../../../infrastructure/src/events/schemas';
import { captureAWS } from 'aws-xray-sdk-core';

const dynamoDB = captureAWS(new DynamoDB());
const eventBridge = captureAWS(new EventBridge());

export class TaskCreatedHandler extends EventConsumer<TaskCreatedEvent> {
  protected readonly eventSchema = TaskCreatedEventSchema;
  private readonly tasksTableName: string;
  private readonly eventBusName: string;

  constructor() {
    super();
    this.tasksTableName = process.env.TASKS_TABLE || 'tasks';
    this.eventBusName = process.env.EVENT_BUS_NAME || 'aletheia-events';
  }

  protected async processEvent(event: TaskCreatedEvent, context: Context): Promise<void> {
    try {
      // Store task in DynamoDB
      await this.storeTask(event);

      // Find available worker
      const workerId = await this.findAvailableWorker(event);

      if (workerId) {
        // Assign task to worker
        await this.assignTaskToWorker(event, workerId);
      } else {
        await this.sendAlert({
          subject: `[${this.environment}] No available workers`,
          message: `No available workers found for task ${event.data.taskId}`,
          severity: 'MEDIUM',
          event,
        });
      }
    } catch (error) {
      await this.handleProcessingError(event, error as Error);
      throw error;
    }
  }

  private async storeTask(event: TaskCreatedEvent): Promise<void> {
    const now = new Date().toISOString();
    
    await dynamoDB.putItem({
      TableName: this.tasksTableName,
      Item: {
        taskId: { S: event.data.taskId },
        developerId: { S: event.data.developerId },
        taskType: { S: event.data.taskType },
        priority: { N: event.data.priority.toString() },
        requirements: { S: JSON.stringify(event.data.requirements) },
        status: { S: 'PENDING' },
        createdAt: { S: now },
        updatedAt: { S: now },
        correlationId: { S: event.correlationId },
        metadata: { S: JSON.stringify(event.metadata || {}) },
      },
      ConditionExpression: 'attribute_not_exists(taskId)',
    });
  }

  private async findAvailableWorker(event: TaskCreatedEvent): Promise<string | null> {
    // Implement worker selection logic based on:
    // - Worker availability
    // - Task type matching
    // - Worker performance metrics
    // - Geographic preferences
    // For now, return a mock worker ID
    return 'worker-123';
  }

  private async assignTaskToWorker(event: TaskCreatedEvent, workerId: string): Promise<void> {
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + 3600000).toISOString(); // 1 hour deadline

    // Update task status
    await dynamoDB.updateItem({
      TableName: this.tasksTableName,
      Key: {
        taskId: { S: event.data.taskId },
      },
      UpdateExpression: 'SET #status = :status, workerId = :workerId, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': { S: 'ASSIGNED' },
        ':workerId': { S: workerId },
        ':updatedAt': { S: now },
      },
      ConditionExpression: 'attribute_exists(taskId)',
    });

    // Publish TaskAssignedEvent
    const assignedEvent: Omit<TaskAssignedEvent, 'id' | 'timestamp' | 'correlationId'> = {
      type: 'task.assigned',
      source: 'task-service',
      version: '1.0',
      data: {
        taskId: event.data.taskId,
        workerId,
        assignedAt: now,
        deadline,
      },
      metadata: {
        originalEventId: event.id,
      },
    };

    await eventBridge.putEvents({
      Entries: [{
        EventBusName: this.eventBusName,
        Source: assignedEvent.source,
        DetailType: assignedEvent.type,
        Detail: JSON.stringify(assignedEvent),
        Time: new Date(),
      }],
    });
  }
}

// Lambda handler
export const handler = async (event: any, context: Context): Promise<void> => {
  const consumer = new TaskCreatedHandler();
  await consumer.handler(event, context);
}; 