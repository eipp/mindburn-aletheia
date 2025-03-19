import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export class VerificationDashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dashboard = new cloudwatch.Dashboard(this, 'VerificationDashboard', {
      dashboardName: 'MindBurn-Verification-Performance',
    });

    // AI Model Performance Metrics
    const modelPerformanceWidget = new cloudwatch.GraphWidget({
      title: 'AI Model Performance',
      left: [
        this.createMetric('Accuracy', 'Average'),
        this.createMetric('Confidence', 'Average'),
        this.createMetric('ProcessingTime', 'Average'),
      ],
      period: cdk.Duration.minutes(5),
    });

    // Human Verification Metrics
    const humanVerificationWidget = new cloudwatch.GraphWidget({
      title: 'Human Verification Stats',
      left: [
        this.createMetric('HumanVerificationRate', 'Sum'),
        this.createMetric('HumanCorrectionRate', 'Average'),
        this.createMetric('AverageVerificationTime', 'Average'),
      ],
      period: cdk.Duration.minutes(15),
    });

    // Model Drift Detection
    const modelDriftWidget = new cloudwatch.GraphWidget({
      title: 'Model Drift Indicators',
      left: [
        this.createMetric('AccuracyDrift', 'Average'),
        this.createMetric('ConfidenceDrift', 'Average'),
        this.createMetric('HumanCorrectionDrift', 'Average'),
      ],
      period: cdk.Duration.hours(1),
    });

    // Domain-specific Performance
    const domainPerformanceWidget = new cloudwatch.GraphWidget({
      title: 'Domain Performance',
      left: [
        this.createMetric('MedicalAccuracy', 'Average'),
        this.createMetric('LegalAccuracy', 'Average'),
        this.createMetric('FinancialAccuracy', 'Average'),
      ],
      period: cdk.Duration.hours(1),
    });

    // Verification Queue Metrics
    const queueMetricsWidget = new cloudwatch.GraphWidget({
      title: 'Verification Queue',
      left: [
        this.createMetric('QueueLength', 'Sum'),
        this.createMetric('AverageWaitTime', 'Average'),
        this.createMetric('EscalationRate', 'Sum'),
      ],
      period: cdk.Duration.minutes(5),
    });

    // Error Rates
    const errorRatesWidget = new cloudwatch.GraphWidget({
      title: 'Error Rates',
      left: [
        this.createMetric('AIFailureRate', 'Sum'),
        this.createMetric('ValidationErrors', 'Sum'),
        this.createMetric('APIErrors', 'Sum'),
      ],
      period: cdk.Duration.minutes(5),
    });

    // Bias Monitoring
    const biasMonitoringWidget = new cloudwatch.GraphWidget({
      title: 'Bias Indicators',
      left: [
        this.createMetric('ContentBias', 'Average'),
        this.createMetric('DomainBias', 'Average'),
        this.createMetric('SourceBias', 'Average'),
      ],
      period: cdk.Duration.hours(1),
    });

    // Add all widgets to dashboard
    dashboard.addWidgets(
      modelPerformanceWidget,
      humanVerificationWidget,
      modelDriftWidget,
      domainPerformanceWidget,
      queueMetricsWidget,
      errorRatesWidget,
      biasMonitoringWidget
    );

    // Create alarms for critical metrics
    this.createAlarms();
  }

  private createMetric(metricName: string, statistic: string): cloudwatch.Metric {
    return new cloudwatch.Metric({
      namespace: 'MindBurn/Verification',
      metricName,
      statistic,
      dimensionsMap: {
        Service: 'VerificationEngine',
      },
    });
  }

  private createAlarms(): void {
    // Accuracy drop alarm
    new cloudwatch.Alarm(this, 'AccuracyDropAlarm', {
      metric: this.createMetric('Accuracy', 'Average'),
      threshold: 0.9,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    // High queue length alarm
    new cloudwatch.Alarm(this, 'HighQueueLengthAlarm', {
      metric: this.createMetric('QueueLength', 'Sum'),
      threshold: 100,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    // Model drift alarm
    new cloudwatch.Alarm(this, 'ModelDriftAlarm', {
      metric: this.createMetric('AccuracyDrift', 'Average'),
      threshold: 0.1,
      evaluationPeriods: 24,
      datapointsToAlarm: 18,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    // High error rate alarm
    new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
      metric: this.createMetric('AIFailureRate', 'Sum'),
      threshold: 5,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    // Bias detection alarm
    new cloudwatch.Alarm(this, 'BiasDetectionAlarm', {
      metric: this.createMetric('ContentBias', 'Average'),
      threshold: 0.3,
      evaluationPeriods: 6,
      datapointsToAlarm: 4,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
  }
}
