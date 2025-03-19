import { APIGatewayTokenAuthorizerHandler } from 'aws-lambda';
import { createLogger } from '../../shared';
import * as jwt from 'jsonwebtoken';
import { getSecretValue } from '../../utils/secrets';

const logger = createLogger('JwtAuthorizer');
const JWT_SECRET_NAME = process.env.JWT_SECRET_NAME || 'jwt-secret';

export interface JwtPayload {
  developerId: string;
  exp: number;
  iat: number;
  [key: string]: any;
}

export const jwtAuthorizer: APIGatewayTokenAuthorizerHandler = async (event) => {
  try {
    logger.info('Processing JWT authorization');
    
    const token = event.authorizationToken.replace('Bearer ', '');
    
    // Fetch JWT secret from Secrets Manager
    const jwtSecret = await getSecretValue(JWT_SECRET_NAME);
    
    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    const developerId = decoded.developerId;
    
    // Check token expiry
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTimestamp) {
      logger.warn('Token expired', { developerId });
      throw new Error('Token expired');
    }
    
    logger.info('Authorization successful', { developerId });
    
    // Return policy document
    return {
      principalId: developerId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn
          }
        ]
      },
      context: {
        developerId
      }
    };
  } catch (error: any) {
    logger.error('Authorization failed', { error: error.message });
    throw new Error('Unauthorized');
  }
}; 