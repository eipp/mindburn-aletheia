import { Middleware } from 'telegraf';
import { CloudWatch } from 'aws-sdk';
import { createLogger } from '@mindburn/shared';
import { BotContext } from '../types';

const logger = createLogger('worker-bot:analytics');
const cloudwatch = new CloudWatch();

const METRICS_NAMESPACE = 'WorkerBot';

export const analyticsMiddleware = (): Middleware<BotContext> => {
  return async (ctx: BotContext, next: () => Promise<void>) => {
    const startTime = Date.now();
    
    try {
      // Process request
      await next();
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      const userId = ctx.from?.id.toString();
      const command = ctx.message?.text?.split(' ')[0];
      
      // Prepare metric data
      const metricData: CloudWatch.MetricData = [
        {
          MetricName: 'RequestCount',
          Value: 1,
          Unit: 'Count',
          Dimensions: [
            {
              Name: 'UserId',
              Value: userId || 'unknown'
            },
            {
              Name: 'Command',
              Value: command || 'unknown'
            }
          ]
        },
        {
          MetricName: 'ResponseTime',
          Value: responseTime,
          Unit: 'Milliseconds',
          Dimensions: [
            {
              Name: 'UserId',
              Value: userId || 'unknown'
            },
            {
              Name: 'Command',
              Value: command || 'unknown'
            }
          ]
        }
      ];

      // Publish metrics
      await cloudwatch.putMetricData({
        Namespace: METRICS_NAMESPACE,
        MetricData: metricData
      }).promise();

      logger.info('Analytics metrics published', {
        userId,
        command,
        responseTime
      });
    } catch (error) {
      logger.error('Analytics middleware error:', error);
      // Don't block request on analytics error
      if (!ctx.headersSent) {
        await next();
      }
    }
  };
}; 