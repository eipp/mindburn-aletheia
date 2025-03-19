import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { createLogger } from '@mindburn/shared';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { RegisterRequestType, LoginRequestType } from '../types/api';

const logger = createLogger('AuthService');
const ddb = DynamoDBDocument.from(new DynamoDB({}));
const JWT_SECRET = process.env.JWT_SECRET!;
const DEVELOPERS_TABLE = process.env.DEVELOPERS_TABLE!;
const API_KEYS_TABLE = process.env.API_KEYS_TABLE!;

export class AuthService {
  async register(data: RegisterRequestType) {
    logger.info('Registering new developer', { email: data.email });

    // Check if email exists
    const existingDev = await ddb.get({
      TableName: DEVELOPERS_TABLE,
      Key: { email: data.email },
    });

    if (existingDev.Item) {
      throw new Error('Email already registered');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    // Generate initial API key
    const apiKey = await this.generateApiKey();

    const developerId = uuidv4();
    const now = new Date().toISOString();

    // Create developer record
    const developer = {
      developerId,
      email: data.email,
      passwordHash,
      salt,
      companyName: data.companyName,
      firstName: data.firstName,
      lastName: data.lastName,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await ddb.put({
      TableName: DEVELOPERS_TABLE,
      Item: developer,
    });

    logger.info('Developer registered successfully', { developerId });

    return {
      developerId,
      email: data.email,
      apiKey,
      createdAt: now,
    };
  }

  async login(data: LoginRequestType) {
    logger.info('Processing login attempt', { email: data.email });

    // Get developer record
    const result = await ddb.get({
      TableName: DEVELOPERS_TABLE,
      Key: { email: data.email },
    });

    if (!result.Item) {
      throw new Error('Invalid credentials');
    }

    const developer = result.Item;

    // Verify password
    const isValid = await bcrypt.compare(data.password, developer.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = jwt.sign({ developerId: developer.developerId }, JWT_SECRET, {
      expiresIn: '24h',
    });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    logger.info('Login successful', { developerId: developer.developerId });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      developerId: developer.developerId,
    };
  }

  async generateApiKey() {
    const apiKeyId = uuidv4();
    const apiKey = Buffer.from(`${apiKeyId}:${uuidv4()}`).toString('base64');
    const now = new Date().toISOString();

    await ddb.put({
      TableName: API_KEYS_TABLE,
      Item: {
        apiKeyId,
        apiKeyHash: await bcrypt.hash(apiKey, 10),
        status: 'active',
        createdAt: now,
        lastUsed: null,
        expiresAt: null,
      },
    });

    logger.info('Generated new API key', { apiKeyId });

    return apiKey;
  }

  async validateApiKey(apiKey: string) {
    const [apiKeyId] = Buffer.from(apiKey, 'base64').toString().split(':');

    const result = await ddb.get({
      TableName: API_KEYS_TABLE,
      Key: { apiKeyId },
    });

    if (!result.Item || result.Item.status !== 'active') {
      return false;
    }

    const isValid = await bcrypt.compare(apiKey, result.Item.apiKeyHash);
    if (isValid) {
      // Update last used timestamp
      await ddb.update({
        TableName: API_KEYS_TABLE,
        Key: { apiKeyId },
        UpdateExpression: 'SET lastUsed = :now',
        ExpressionAttributeValues: {
          ':now': new Date().toISOString(),
        },
      });
    }

    return isValid;
  }

  async listApiKeys(developerId: string) {
    const result = await ddb.query({
      TableName: API_KEYS_TABLE,
      IndexName: 'DeveloperIdIndex',
      KeyConditionExpression: 'developerId = :developerId',
      ExpressionAttributeValues: {
        ':developerId': developerId,
      },
    });

    return {
      apiKeys:
        result.Items?.map(item => ({
          apiKeyId: item.apiKeyId,
          lastUsed: item.lastUsed,
          createdAt: item.createdAt,
          expiresAt: item.expiresAt,
          status: item.status,
        })) || [],
    };
  }

  async revokeApiKey(developerId: string, apiKeyId: string) {
    const result = await ddb.get({
      TableName: API_KEYS_TABLE,
      Key: { apiKeyId },
    });

    if (!result.Item || result.Item.developerId !== developerId) {
      throw new Error('API key not found');
    }

    await ddb.update({
      TableName: API_KEYS_TABLE,
      Key: { apiKeyId },
      UpdateExpression: 'SET #status = :status, updatedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'revoked',
        ':now': new Date().toISOString(),
      },
    });

    logger.info('API key revoked', { apiKeyId });

    return true;
  }
}
