import * as cdk from 'aws-cdk-lib';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as kinesisfirehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as quicksight from 'aws-cdk-lib/aws-quicksight';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as events from 'aws-cdk-lib/aws-events';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export class AnalyticsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Raw data stream for real-time analytics
    const dataStream = new kinesis.Stream(this, 'VerificationDataStream', {
      streamName: 'verification-analytics-stream',
      shardCount: 2,
      retentionPeriod: cdk.Duration.hours(24)
    });

    // Data lake storage
    const dataLakeBucket = new s3.Bucket(this, 'AnalyticsDataLake', {
      bucketName: 'mindburn-analytics-data-lake',
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{
        transitions: [{
          storageClass: s3.StorageClass.INTELLIGENT_TIERING,
          transitionAfter: cdk.Duration.days(90)
        }]
      }]
    });

    // Kinesis Firehose for data ingestion
    const firehoseRole = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com')
    });

    dataLakeBucket.grantWrite(firehoseRole);
    dataStream.grantRead(firehoseRole);

    const firehose = new kinesisfirehose.CfnDeliveryStream(this, 'AnalyticsFirehose', {
      deliveryStreamName: 'verification-analytics-firehose',
      deliveryStreamType: 'KinesisStreamAsSource',
      kinesisStreamSourceConfiguration: {
        kinesisStreamArn: dataStream.streamArn,
        roleArn: firehoseRole.roleArn
      },
      s3DestinationConfiguration: {
        bucketArn: dataLakeBucket.bucketArn,
        roleArn: firehoseRole.roleArn,
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 128
        },
        prefix: 'raw-data/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/',
        errorOutputPrefix: 'errors/!{firehose:error-output-type}/'
      }
    });

    // Glue Data Catalog for analytics
    const database = new glue.CfnDatabase(this, 'AnalyticsDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: 'mindburn_analytics',
        description: 'Database for verification analytics data'
      }
    });

    // Tables for different analytics views
    const verificationTable = new glue.CfnTable(this, 'VerificationTable', {
      catalogId: this.account,
      databaseName: database.ref,
      tableInput: {
        name: 'verification_metrics',
        description: 'Processed verification metrics data',
        tableType: 'EXTERNAL_TABLE',
        parameters: {
          classification: 'parquet',
          'parquet.compression': 'SNAPPY'
        },
        storageDescriptor: {
          columns: [
            { name: 'task_id', type: 'string' },
            { name: 'worker_id', type: 'string' },
            { name: 'content_type', type: 'string' },
            { name: 'verification_method', type: 'string' },
            { name: 'confidence_score', type: 'double' },
            { name: 'response_time_ms', type: 'bigint' },
            { name: 'is_accurate', type: 'boolean' },
            { name: 'cost', type: 'double' },
            { name: 'timestamp', type: 'timestamp' }
          ],
          location: `s3://${dataLakeBucket.bucketName}/processed/verification_metrics/`,
          inputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe'
          }
        },
        partitionKeys: [
          { name: 'year', type: 'string' },
          { name: 'month', type: 'string' },
          { name: 'day', type: 'string' }
        ]
      }
    });

    // ML Model training pipeline
    const notebookRole = new iam.Role(this, 'SageMakerNotebookRole', {
      assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com')
    });

    dataLakeBucket.grantRead(notebookRole);

    const notebook = new sagemaker.CfnNotebookInstance(this, 'AnalyticsNotebook', {
      instanceType: 'ml.t3.medium',
      roleArn: notebookRole.roleArn,
      notebookInstanceName: 'mindburn-analytics-notebook'
    });

    // ETL Lambda function
    const etlFunction = new lambda.Function(this, 'ETLProcessor', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('src/analytics/etl'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1792,
      environment: {
        DATA_STREAM_NAME: dataStream.streamName,
        DATA_LAKE_BUCKET: dataLakeBucket.bucketName
      }
    });

    dataStream.grantWrite(etlFunction);
    dataLakeBucket.grantReadWrite(etlFunction);

    // QuickSight setup
    const quicksightPrincipal = new iam.Role(this, 'QuickSightRole', {
      assumedBy: new iam.ServicePrincipal('quicksight.amazonaws.com')
    });

    dataLakeBucket.grantRead(quicksightPrincipal);

    const dashboards = new QuickSightDashboards(this, 'Dashboards', {
      dataSourceArn: `arn:aws:quicksight:${this.region}:${this.account}:datasource/mindburn-analytics`,
      dataSetArn: `arn:aws:quicksight:${this.region}:${this.account}:dataset/mindburn-verification-metrics`,
      principalArn: quicksightPrincipal.roleArn
    });

    // Anomaly detection Lambda
    const anomalyDetectionFunction = new lambda.Function(this, 'AnomalyDetector', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'anomaly_detector.lambda_handler',
      code: lambda.Code.fromAsset('src/analytics/ml'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 1792,
      environment: {
        MODEL_BUCKET: dataLakeBucket.bucketName,
        MODEL_KEY: 'models/anomaly_detector/model.joblib'
      }
    });

    dataLakeBucket.grantRead(anomalyDetectionFunction);

    // CloudWatch alarms for anomaly detection
    const anomalyMetric = new cloudwatch.Metric({
      namespace: 'Mindburn/Analytics',
      metricName: 'AnomalyCount',
      dimensionsMap: {
        Service: 'VerificationSystem'
      },
      period: cdk.Duration.minutes(5)
    });

    new cloudwatch.Alarm(this, 'AnomalyAlarm', {
      metric: anomalyMetric,
      threshold: 10,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      actionsEnabled: true
    });

    // EventBridge rule for periodic anomaly detection
    new events.Rule(this, 'AnomalyDetectionSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new events_targets.LambdaFunction(anomalyDetectionFunction)]
    });
  }
} 