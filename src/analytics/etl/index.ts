import { Kinesis } from '@aws-sdk/client-kinesis';
import { S3 } from '@aws-sdk/client-s3';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const kinesis = new Kinesis({});
const s3 = new S3({});
const dynamodb = new DynamoDB({});

interface VerificationMetric {
  taskId: string;
  workerId: string;
  contentType: string;
  verificationMethod: string;
  confidenceScore: number;
  responseTimeMs: number;
  isAccurate: boolean;
  cost: number;
  timestamp: string;
}

export const handler = async (event: any) => {
  try {
    // Process verification events from DynamoDB Stream
    const verificationMetrics = event.Records.map((record: any) => {
      const data = unmarshall(record.dynamodb.NewImage);

      return {
        taskId: data.taskId,
        workerId: data.workerId,
        contentType: data.contentType,
        verificationMethod: data.verificationMethod,
        confidenceScore: data.confidenceScore,
        responseTimeMs: data.responseTimeMs,
        isAccurate: data.isAccurate,
        cost: data.cost,
        timestamp: data.timestamp,
      } as VerificationMetric;
    });

    // Stream to Kinesis for real-time analytics
    await Promise.all(
      verificationMetrics.map(metric =>
        kinesis.putRecord({
          StreamName: process.env.DATA_STREAM_NAME!,
          Data: Buffer.from(JSON.stringify(metric)),
          PartitionKey: metric.taskId,
        })
      )
    );

    // Batch metrics for S3 storage
    const date = new Date();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');

    const key = `processed/verification_metrics/year=${year}/month=${month}/day=${day}/hour=${hour}/${Date.now()}.json`;

    await s3.putObject({
      Bucket: process.env.DATA_LAKE_BUCKET!,
      Key: key,
      Body: JSON.stringify(verificationMetrics),
      ContentType: 'application/json',
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully processed verification metrics',
        processedRecords: verificationMetrics.length,
      }),
    };
  } catch (error) {
    console.error('Error processing verification metrics:', error);
    throw error;
  }
};
