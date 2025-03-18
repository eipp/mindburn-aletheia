import { Router, Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticateApiKey } from '../middleware/auth';
import { validateSchema } from '../middleware/validation';
import { ServiceOrchestrator } from '../services/ServiceOrchestrator';
import { Logger } from '../utils/Logger';
import { submissionSchema, webhookSchema } from './schemas';

export class FraudQualityController {
  private readonly router: Router;
  private readonly orchestrator: ServiceOrchestrator;
  private readonly logger: Logger;

  constructor() {
    this.router = Router();
    this.orchestrator = new ServiceOrchestrator();
    this.logger = new Logger();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Rate limiting middleware
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later'
    });

    // Apply rate limiting and authentication to all routes
    this.router.use(apiLimiter);
    this.router.use(authenticateApiKey);

    // Routes
    this.router.post(
      '/submission',
      validateSchema(submissionSchema),
      this.processSubmission.bind(this)
    );

    this.router.post(
      '/webhook',
      validateSchema(webhookSchema),
      this.handleWebhook.bind(this)
    );

    this.router.get(
      '/metrics',
      this.getMetrics.bind(this)
    );

    // Error handling
    this.router.use(this.errorHandler.bind(this));
  }

  private async processSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const submission = req.body;
      const result = await this.orchestrator.processSubmission(submission);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  private async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const webhook = req.body;
      // Process webhook data asynchronously
      this.processWebhookAsync(webhook).catch(error => 
        this.logger.error('Webhook processing failed', { error, webhook })
      );
      
      // Return immediately as webhook processing happens in background
      res.status(202).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  private async processWebhookAsync(webhook: any): Promise<void> {
    // Implement webhook processing logic
    // This runs asynchronously after the HTTP response
  }

  private async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startTime = req.query.startTime as string;
      const endTime = req.query.endTime as string;
      
      const metrics = await this.orchestrator.dashboard.getDashboardMetrics({
        startTime: new Date(startTime),
        endTime: new Date(endTime)
      });
      
      res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      next(error);
    }
  }

  private errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
    this.logger.error('API error', { error, path: req.path });
    
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }

  getRouter(): Router {
    return this.router;
  }
} 