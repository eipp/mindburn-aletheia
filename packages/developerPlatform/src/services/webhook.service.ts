import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { createLogger } from '@mindburn/shared';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { WebhookRequestType } from '../types/api';

const logger = createLogger('WebhookService');
const ddb = DynamoDBDocument.from(new DynamoDB({}));

const WEBHOOKS_TABLE = process.env.WEBHOOKS_TABLE!;
const WEBHOOK_DELIVERIES_TABLE = process.env.WEBHOOK_DELIVERIES_TABLE!;

export class WebhookService {
  async createWebhook(developerId: string, data: WebhookRequestType) {
    const webhookId = uuidv4();
    const now = new Date().toISOString();
    const secret = crypto.randomBytes(32).toString('hex');

    logger.info('Creating new webhook', { webhookId, developerId });

    const webhook = {
      webhookId,
      developerId,
      url: data.url,
      events: data.events,
      secret,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      lastDeliveryAt: null,
      failureCount: 0,
      description: data.description || null
    };

    await ddb.put({
      TableName: WEBHOOKS_TABLE,
      Item: webhook
    });

    logger.info('Webhook created successfully', { webhookId });

    return {
      webhookId,
      url: webhook.url,
      events: webhook.events,
      secret,
      status: webhook.status,
      createdAt: webhook.createdAt
    };
  }

  async getWebhook(developerId: string, webhookId: string) {
    const result = await ddb.get({
      TableName: WEBHOOKS_TABLE,
      Key: { webhookId }
    });

    if (!result.Item) {
      throw new Error('Webhook not found');
    }

    const webhook = result.Item;

    // Verify ownership
    if (webhook.developerId !== developerId) {
      throw new Error('Unauthorized access to webhook');
    }

    return {
      webhookId: webhook.webhookId,
      url: webhook.url,
      events: webhook.events,
      status: webhook.status,
      description: webhook.description,
      createdAt: webhook.createdAt,
      lastDeliveryAt: webhook.lastDeliveryAt,
      failureCount: webhook.failureCount
    };
  }

  async listWebhooks(developerId: string) {
    const result = await ddb.query({
      TableName: WEBHOOKS_TABLE,
      IndexName: 'DeveloperIdIndex',
      KeyConditionExpression: 'developerId = :developerId',
      ExpressionAttributeValues: {
        ':developerId': developerId
      }
    });

    return {
      webhooks: result.Items?.map(webhook => ({
        webhookId: webhook.webhookId,
        url: webhook.url,
        events: webhook.events,
        status: webhook.status,
        description: webhook.description,
        createdAt: webhook.createdAt,
        lastDeliveryAt: webhook.lastDeliveryAt,
        failureCount: webhook.failureCount
      })) || []
    };
  }

  async updateWebhook(developerId: string, webhookId: string, data: Partial<WebhookRequestType>) {
    const result = await ddb.get({
      TableName: WEBHOOKS_TABLE,
      Key: { webhookId }
    });

    if (!result.Item) {
      throw new Error('Webhook not found');
    }

    const webhook = result.Item;

    // Verify ownership
    if (webhook.developerId !== developerId) {
      throw new Error('Unauthorized access to webhook');
    }

    const updates = [];
    const expressionAttributeValues: any = {
      ':now': new Date().toISOString()
    };
    const expressionAttributeNames: any = {};

    if (data.url) {
      updates.push('#url = :url');
      expressionAttributeValues[':url'] = data.url;
      expressionAttributeNames['#url'] = 'url';
    }

    if (data.events) {
      updates.push('#events = :events');
      expressionAttributeValues[':events'] = data.events;
      expressionAttributeNames['#events'] = 'events';
    }

    if (data.description !== undefined) {
      updates.push('#description = :description');
      expressionAttributeValues[':description'] = data.description;
      expressionAttributeNames['#description'] = 'description';
    }

    updates.push('updatedAt = :now');

    await ddb.update({
      TableName: WEBHOOKS_TABLE,
      Key: { webhookId },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames
    });

    logger.info('Webhook updated', { webhookId });

    return true;
  }

  async deleteWebhook(developerId: string, webhookId: string) {
    const result = await ddb.get({
      TableName: WEBHOOKS_TABLE,
      Key: { webhookId }
    });

    if (!result.Item) {
      throw new Error('Webhook not found');
    }

    const webhook = result.Item;

    // Verify ownership
    if (webhook.developerId !== developerId) {
      throw new Error('Unauthorized access to webhook');
    }

    await ddb.delete({
      TableName: WEBHOOKS_TABLE,
      Key: { webhookId }
    });

    logger.info('Webhook deleted', { webhookId });

    return true;
  }

  async recordDelivery(webhookId: string, event: string, payload: any, success: boolean, error?: string) {
    const deliveryId = uuidv4();
    const now = new Date().toISOString();

    const delivery = {
      deliveryId,
      webhookId,
      event,
      payload,
      success,
      error: error || null,
      timestamp: now
    };

    await ddb.put({
      TableName: WEBHOOK_DELIVERIES_TABLE,
      Item: delivery
    });

    // Update webhook stats
    const updateExpression = success
      ? 'SET lastDeliveryAt = :now'
      : 'SET lastDeliveryAt = :now, failureCount = failureCount + :inc';

    await ddb.update({
      TableName: WEBHOOKS_TABLE,
      Key: { webhookId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: {
        ':now': now,
        ...(success ? {} : { ':inc': 1 })
      }
    });

    logger.info('Webhook delivery recorded', { 
      deliveryId, 
      webhookId,
      success,
      error: error || undefined
    });

    return deliveryId;
  }

  async listDeliveries(developerId: string, webhookId: string, limit = 50) {
    // Verify webhook ownership first
    const webhook = await this.getWebhook(developerId, webhookId);

    const result = await ddb.query({
      TableName: WEBHOOK_DELIVERIES_TABLE,
      IndexName: 'WebhookIdIndex',
      KeyConditionExpression: 'webhookId = :webhookId',
      ExpressionAttributeValues: {
        ':webhookId': webhookId
      },
      Limit: limit,
      ScanIndexForward: false // Get most recent first
    });

    return {
      deliveries: result.Items?.map(delivery => ({
        deliveryId: delivery.deliveryId,
        event: delivery.event,
        success: delivery.success,
        error: delivery.error,
        timestamp: delivery.timestamp
      })) || []
    };
  }

  generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }
} 