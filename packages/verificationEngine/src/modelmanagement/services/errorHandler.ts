import { ErrorHandler, MetricsService, NotificationService, LoggerService } from '@mindburn/shared';
import { ErrorHandlingConfig } from '../config/error-handling-config';

export class ModelErrorHandler {
  private errorHandler: ErrorHandler;
  private metrics: MetricsService;
  private notifications: NotificationService;
  private logger: LoggerService;

  constructor(config: ErrorHandlingConfig) {
    this.errorHandler = new ErrorHandler(config);
    this.metrics = new MetricsService();
    this.notifications = new NotificationService();
    this.logger = new LoggerService();
  }

  async handleError(error: Error, context: Record<string, any> = {}): Promise<void> {
    try {
      // Log the error
      this.logger.error('Model error occurred', {
        error: error.message,
        stack: error.stack,
        ...context,
      });

      // Record error metric
      await this.metrics.incrementCounter('model_errors', {
        type: error.name,
        ...context,
      });

      // Handle error based on configuration
      await this.errorHandler.handle(error, {
        source: 'verification-engine',
        ...context,
      });

      // Send notifications if configured
      if (context.severity === 'high' || context.critical) {
        await this.notifications.sendAlert({
          title: 'Critical Model Error',
          message: error.message,
          metadata: context,
        });
      }
    } catch (handlingError) {
      // Fallback error handling
      console.error('Error in error handler:', handlingError);
      throw error; // Re-throw original error
    }
  }

  async handleWarning(message: string, context: Record<string, any> = {}): Promise<void> {
    await this.logger.warn(message, context);
    await this.metrics.incrementCounter('model_warnings', context);
  }
}
