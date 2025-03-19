import { APIGatewayRequestAuthorizerHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { verify } from 'jsonwebtoken';

const dynamodb = new DynamoDB.DocumentClient();
const AUTH_TABLE = process.env.AUTH_TABLE!;

export const handler: APIGatewayRequestAuthorizerHandler = async event => {
  try {
    const token = event.queryStringParameters?.token;
    if (!token) {
      throw new Error('Missing authentication token');
    }

    // Verify JWT token
    const decoded = verify(token, process.env.JWT_SECRET!);
    const userId = typeof decoded === 'string' ? decoded : decoded.sub;

    // Check if token is revoked
    const { Item: auth } = await dynamodb
      .get({
        TableName: AUTH_TABLE,
        Key: { userId },
      })
      .promise();

    if (!auth || auth.tokenRevoked) {
      throw new Error('Invalid or revoked token');
    }

    return {
      principalId: userId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn,
          },
        ],
      },
      context: {
        userId,
        scope: auth.scope,
      },
    };
  } catch (error) {
    console.error('Authorization failed:', error);
    throw new Error('Unauthorized');
  }
};
