import { Handler } from 'aws-lambda';
import AWSXRay from 'aws-xray-sdk-core';
import log from '../utils/logger';

export const tracingMiddleware = (handler: Handler): Handler => {
  return async (event, context) => {
    const segment = AWSXRay.getSegment();
    const subsegment = segment?.addNewSubsegment('handler');

    const requestId = context.awsRequestId;
    const startTime = Date.now();

    try {
      log.startRequest({
        requestId,
        path: event.path,
        method: event.httpMethod,
        sourceIp: event.requestContext?.identity?.sourceIp,
      });

      // Add request data to X-Ray segment
      subsegment?.addAnnotation('path', event.path);
      subsegment?.addAnnotation('method', event.httpMethod);
      subsegment?.addAnnotation('requestId', requestId);

      // Add user data if available
      if (event.requestContext?.authorizer?.claims?.sub) {
        subsegment?.addAnnotation('userId', event.requestContext.authorizer.claims.sub);
      }

      const response = await handler(event, context);

      // Add response data to segment
      subsegment?.addMetadata('response', {
        statusCode: response.statusCode,
        executionTime: Date.now() - startTime,
      });

      log.endRequest({
        requestId,
        statusCode: response.statusCode,
        executionTime: Date.now() - startTime,
      });

      return response;
    } catch (error) {
      subsegment?.addError(error as Error);
      log.error('Request failed', error as Error, { requestId });
      throw error;
    } finally {
      subsegment?.close();
    }
  };
};
