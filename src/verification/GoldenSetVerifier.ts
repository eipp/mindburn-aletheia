import { DynamoDB } from 'aws-sdk';
import { VerificationResult } from './types';

interface GoldenSetEntry {
  taskId: string;
  taskType: string;
  content: any;
  expectedResult: {
    decision: 'APPROVED' | 'REJECTED';
    explanation: string;
    keyFeatures: string[];
  };
  difficulty: number;
  createdAt: number;
  updatedAt: number;
}

interface WorkerVerification {
  workerId: string;
  taskId: string;
  decision: 'APPROVED' | 'REJECTED';
  explanation: string;
  timestamp: number;
}

export class GoldenSetVerifier {
  private dynamodb: DynamoDB.DocumentClient;
  private readonly goldenSetTable = 'GoldenSet';
  private readonly resultsTable = 'Results';

  constructor(
    private similarityThreshold: number = 0.8,
    private featureMatchThreshold: number = 0.7
  ) {
    this.dynamodb = new DynamoDB.DocumentClient();
  }

  async verify(taskId: string, taskType: string, content: any): Promise<VerificationResult> {
    const startTime = Date.now();

    try {
      // Find similar golden set entries
      const goldenSetEntries = await this.findSimilarGoldenSetEntries(taskType, content);
      
      if (goldenSetEntries.length === 0) {
        throw new Error('No matching golden set entries found');
      }

      // Get worker verification for comparison
      const workerVerification = await this.getWorkerVerification(taskId);
      
      if (!workerVerification) {
        throw new Error('No worker verification found');
      }

      // Compare with golden set
      const result = this.compareWithGoldenSet(
        workerVerification,
        goldenSetEntries,
        content
      );

      return {
        ...result,
        processingTime: Date.now() - startTime,
        contributors: [{
          type: 'GOLDEN_SET',
          matchedEntries: goldenSetEntries.length,
          similarity: result.confidence
        }]
      };
    } catch (error) {
      console.error('Golden set verification error:', error);
      throw error;
    }
  }

  private async findSimilarGoldenSetEntries(
    taskType: string,
    content: any
  ): Promise<GoldenSetEntry[]> {
    // Get golden set entries for task type
    const result = await this.dynamodb.query({
      TableName: this.goldenSetTable,
      IndexName: 'TaskTypeIndex',
      KeyConditionExpression: 'taskType = :taskType',
      ExpressionAttributeValues: {
        ':taskType': taskType
      }
    }).promise();

    const entries = result.Items as GoldenSetEntry[];

    // Filter by content similarity
    return entries.filter(entry => 
      this.calculateContentSimilarity(content, entry.content) >= this.similarityThreshold
    );
  }

  private async getWorkerVerification(taskId: string): Promise<WorkerVerification | null> {
    const result = await this.dynamodb.query({
      TableName: this.resultsTable,
      KeyConditionExpression: 'taskId = :taskId',
      Limit: 1,
      ExpressionAttributeValues: {
        ':taskId': taskId
      }
    }).promise();

    return result.Items?.[0] as WorkerVerification || null;
  }

  private compareWithGoldenSet(
    workerVerification: WorkerVerification,
    goldenSetEntries: GoldenSetEntry[],
    content: any
  ): {
    decision: 'APPROVED' | 'REJECTED';
    confidence: number;
    explanation: string;
  } {
    // Calculate similarity scores and weights for each golden set entry
    const comparisonResults = goldenSetEntries.map(entry => ({
      entry,
      similarity: this.calculateContentSimilarity(content, entry.content),
      featureMatch: this.calculateFeatureMatch(
        workerVerification.explanation,
        entry.expectedResult.keyFeatures
      )
    }));

    // Calculate weighted decision
    const totalWeight = comparisonResults.reduce((sum, r) => sum + r.similarity, 0);
    const correctDecisions = comparisonResults.filter(r =>
      r.entry.expectedResult.decision === workerVerification.decision
    );
    const correctWeight = correctDecisions.reduce((sum, r) => sum + r.similarity, 0);

    const decisionAccuracy = correctWeight / totalWeight;
    const averageFeatureMatch = comparisonResults.reduce((sum, r) => sum + r.featureMatch, 0) / 
                               comparisonResults.length;

    // Calculate confidence and decision
    const confidence = (decisionAccuracy + averageFeatureMatch) / 2;
    const decision = confidence >= 0.5 ? 'APPROVED' : 'REJECTED';

    // Generate explanation
    const explanation = this.generateGoldenSetExplanation(
      comparisonResults,
      workerVerification,
      confidence
    );

    return {
      decision,
      confidence,
      explanation
    };
  }

  private calculateContentSimilarity(content1: any, content2: any): number {
    // Implement content similarity calculation based on task type
    // This is a simplified example
    const str1 = JSON.stringify(content1);
    const str2 = JSON.stringify(content2);
    
    let similarity = 0;
    const len = Math.min(str1.length, str2.length);
    
    for (let i = 0; i < len; i++) {
      if (str1[i] === str2[i]) similarity++;
    }
    
    return similarity / Math.max(str1.length, str2.length);
  }

  private calculateFeatureMatch(
    explanation: string,
    expectedFeatures: string[]
  ): number {
    const normalizedExplanation = explanation.toLowerCase();
    const matchedFeatures = expectedFeatures.filter(feature =>
      normalizedExplanation.includes(feature.toLowerCase())
    );

    return matchedFeatures.length / expectedFeatures.length;
  }

  private generateGoldenSetExplanation(
    comparisonResults: Array<{
      entry: GoldenSetEntry;
      similarity: number;
      featureMatch: number;
    }>,
    workerVerification: WorkerVerification,
    confidence: number
  ): string {
    const matchedCount = comparisonResults.length;
    const highSimilarityCount = comparisonResults.filter(r => r.similarity > 0.9).length;
    const averageFeatureMatch = comparisonResults.reduce((sum, r) => sum + r.featureMatch, 0) / 
                               matchedCount;

    // Get most similar golden set entries
    const topMatches = comparisonResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 2)
      .map(r => ({
        similarity: r.similarity,
        featureMatch: r.featureMatch,
        expectedDecision: r.entry.expectedResult.decision
      }));

    return `Golden set verification completed with ${confidence.toFixed(2)} confidence. ` +
           `Matched ${matchedCount} golden set entries (${highSimilarityCount} high similarity). ` +
           `Average feature match rate: ${(averageFeatureMatch * 100).toFixed(1)}%. ` +
           `Top matches: ${topMatches.map(m =>
             `[Similarity: ${(m.similarity * 100).toFixed(1)}%, ` +
             `Feature match: ${(m.featureMatch * 100).toFixed(1)}%, ` +
             `Expected: ${m.expectedDecision}]`
           ).join(' ')}`;
  }
} 