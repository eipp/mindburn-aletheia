import { Request, Response, NextFunction } from 'express';
import { MonitoringManager } from '../../monitoring/monitoringManager';

export function createMetricsMiddleware(monitoring: MonitoringManager) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const endpoint = `${req.method} ${req.path}`;

    // Track original end function
    const originalEnd = res.end;

    // Override end function to capture metrics
    res.end = function(...args: any[]) {
      const duration = Date.now() - startTime;

      // Record API latency
      monitoring.recordApiLatency(endpoint, duration).catch(error => {
        console.error('Failed to record API latency', error);
      });

      // Record errors (4xx and 5xx)
      if (res.statusCode >= 400) {
        monitoring.recordError('api').catch(error => {
          console.error('Failed to record API error', error);
        });
      }

      // Call original end
      return originalEnd.apply(res, args);
    };

    next();
  };
}

// Example usage:
/*
const app = express();
const monitoring = createMonitoringManager({...});
app.use(createMetricsMiddleware(monitoring));
*/ 