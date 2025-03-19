import { APIGatewayProxyHandler } from 'aws-lambda';
import { createLogger } from '../../shared';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const logger = createLogger('DeveloperLogin');
const ddb = DynamoDBDocument.from(new DynamoDB({}));
const DEVELOPERS_TABLE = process.env.DEVELOPERS_TABLE!;
const JWT_SECRET = process.env.JWT_SECRET!;

interface LoginRequestType {
  email: string;
  password: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    logger.info('Processing login attempt');
    
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }

    const data: LoginRequestType = JSON.parse(event.body);
    
    // Validate required fields
    if (!data.email || !data.password) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email and password are required' })
      };
    }

    // Get developer record
    const result = await ddb.get({
      TableName: DEVELOPERS_TABLE,
      Key: { email: data.email },
    });

    if (!result.Item) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    const developer = result.Item;

    // Verify password
    const isValid = await bcrypt.compare(data.password, developer.passwordHash);
    if (!isValid) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    // Generate JWT token
    const token = jwt.sign({ developerId: developer.developerId }, JWT_SECRET, {
      expiresIn: '24h',
    });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    logger.info('Login successful', { developerId: developer.developerId });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        expiresAt: expiresAt.toISOString(),
        developerId: developer.developerId,
        email: developer.email,
        firstName: developer.firstName,
        lastName: developer.lastName
      })
    };
  } catch (error: any) {
    logger.error('Login failed', { error: error.message });
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 