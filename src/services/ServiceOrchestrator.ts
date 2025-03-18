import { CircuitBreaker } from 'opossum';
import { retry } from '@lifeomic/attempt';
import { AdvancedFraudDetector } from '../verification/AdvancedFraudDetector';
import { QualityControlSystem } from '../verification/QualityControlSystem';
import { ML } from './ML';
import { IpIntelligence } from './IpIntelligence';
import { QualityMonitoringDashboard } from '../monitoring/QualityMonitoringDashboard';
import { Logger } from '../utils/Logger';
import { MetricsPublisher } from '../verification/MetricsPublisher';

export class ServiceOrchestrator {
  private readonly fraudDetector: AdvancedFraudDetector;
  private readonly qualityControl: QualityControlSystem;
  private readonly ml: ML;
  private readonly ipIntelligence: IpIntelligence;
  private readonly dashboard: QualityMonitoringDashboard;
  private readonly metrics: MetricsPublisher;
  private readonly logger: Logger;

  private readonly fraudBreaker: CircuitBreaker;
  private readonly qualityBreaker: CircuitBreaker;
  private readonly mlBreaker: CircuitBreaker;
  private readonly ipBreaker: CircuitBreaker;

  constructor() {
    this.fraudDetector = new AdvancedFraudDetector();
    this.qualityControl = new QualityControlSystem();
    this.ml = new ML();
    this.ipIntelligence = new IpIntelligence();
    this.dashboard = new QualityMonitoringDashboard();
    this.metrics = new MetricsPublisher();
    this.logger = new Logger();

    // Configure circuit breakers
    this.fraudBreaker = new CircuitBreaker(this.fraudDetector.detectFraud, {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
    });

    this.qualityBreaker = new CircuitBreaker(this.qualityControl.evaluateSubmission, {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
    });

    this.mlBreaker = new CircuitBreaker(this.ml.predictReputationRisk, {
      timeout: 10000,
      errorThresholdPercentage: 40,
      resetTimeout: 60000,
    });

    this.ipBreaker = new CircuitBreaker(this.ipIntelligence.assessIpRisk, {
      timeout: 3000,
      errorThresholdPercentage: 30,
      resetTimeout: 30000,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    [this.fraudBreaker, this.qualityBreaker, this.mlBreaker, this.ipBreaker].forEach(breaker => {
      breaker.on('open', () => this.logger.warn(`Circuit breaker opened for ${breaker.name}`));
      breaker.on('halfOpen', () =>
        this.logger.info(`Circuit breaker half-open for ${breaker.name}`)
      );
      breaker.on('close', () => this.logger.info(`Circuit breaker closed for ${breaker.name}`));
      breaker.on('fallback', () =>
        this.metrics.incrementCounter(`circuit_breaker_fallback_${breaker.name}`)
      );
    });
  }

  async processSubmission(submission: TaskSubmission): Promise<{
    fraudResult: FraudDetectionResult;
    qualityResult: QualityControlResult;
  }> {
    try {
      const [ipRisk, fraudResult, qualityResult] = await Promise.all([
        this.executeWithRetry(() => this.ipBreaker.fire(submission.ipAddress)),
        this.executeWithRetry(() => this.fraudBreaker.fire(submission)),
        this.executeWithRetry(() => this.qualityBreaker.fire(submission)),
      ]);

      await this.metrics.publishMetrics({
        ipRisk,
        fraudScore: fraudResult.riskScore,
        qualityScore: qualityResult.qualityScore,
      });

      await this.dashboard.updateMetrics({
        fraudMetrics: fraudResult,
        qualityMetrics: qualityResult,
      });

      return { fraudResult, qualityResult };
    } catch (error) {
      this.logger.error('Failed to process submission', { error, submissionId: submission.taskId });
      throw error;
    }
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    return retry(operation, {
      maxAttempts: 3,
      delay: 1000,
      factor: 2,
      handleError: (error, context) => {
        this.logger.warn('Retry attempt failed', {
          error,
          attempt: context.attemptNum,
          maxAttempts: context.maxAttempts,
        });
        return true;
      },
    });
  }

  async shutdown(): Promise<void> {
    await Promise.all([
      this.fraudBreaker.shutdown(),
      this.qualityBreaker.shutdown(),
      this.mlBreaker.shutdown(),
      this.ipBreaker.shutdown(),
    ]);
  }
}
