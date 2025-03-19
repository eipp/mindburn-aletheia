import { APIGatewayProxyHandler } from 'aws-lambda';
import { createLogger } from '../../shared';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

const logger = createLogger('DeveloperRegistration');
const ddb = DynamoDBDocument.from(new DynamoDB({}));
const DEVELOPERS_TABLE = process.env.DEVELOPERS_TABLE!;
const API_KEYS_TABLE = process.env.API_KEYS_TABLE!;

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    logger.info('Processing developer registration request');
    logger.info('Environment variables', { 
      DEVELOPERS_TABLE, 
      API_KEYS_TABLE,
      NODE_ENV: process.env.NODE_ENV
    });
    
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }

    const data = JSON.parse(event.body);
    logger.info('Parsed request data', { data });
    
    // Validate required fields
    const requiredFields = ['email', 'password', 'firstName', 'lastName', 'companyName'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Missing required fields', 
          fields: missingFields 
        })
      };
    }

    try {
      // Check if email exists
      logger.info('Checking if email exists', { email: data.email });
      const existingDev = await ddb.get({
        TableName: DEVELOPERS_TABLE,
        Key: { email: data.email },
      });
      logger.info('Existing developer check result', { hasItem: !!existingDev.Item });

      if (existingDev.Item) {
        return {
          statusCode: 409,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Email already registered' })
        };
      }

      // Hash password
      logger.info('Hashing password');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(data.password, salt);

      // Generate initial API key
      logger.info('Generating API key');
      const apiKeyId = uuidv4();
      const apiKey = Buffer.from(`${apiKeyId}:${uuidv4()}`).toString('base64');

      const developerId = uuidv4();
      const now = new Date().toISOString();

      // Create developer record
      logger.info('Creating developer record', { developerId });
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
      logger.info('Developer record created successfully');

      // Store API key
      logger.info('Storing API key', { apiKeyId });
      await ddb.put({
        TableName: API_KEYS_TABLE,
        Item: {
          apiKeyId,
          apiKeyHash: await bcrypt.hash(apiKey, 10),
          developerId,
          status: 'active',
          createdAt: now,
          lastUsed: null,
          expiresAt: null,
        }
      });
      logger.info('API key stored successfully');

      logger.info('Developer registered successfully', { developerId });

      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developerId,
          email: data.email,
          apiKey,
          createdAt: now,
        })
      };
    } catch (dbError: any) {
      logger.error('Database operation failed', { 
        error: dbError.message,
        stack: dbError.stack,
        code: dbError.code,
        name: dbError.name
      });
      throw dbError;
    }
  } catch (error: any) {
    logger.error('Registration failed', { 
      error: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    if (error.message === 'Email already registered') {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email already registered' })
      };
    }
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        type: error.name
      })
    };
  }
}; 