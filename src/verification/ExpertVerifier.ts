import { DynamoDB } from 'aws-sdk';
import { VerificationResult, ExpertiseLevel, ExpertWeights } from './types';

interface ExpertVerification {
  workerId: string;
  decision: 'APPROVED' | 'REJECTED';
  confidence: number;
  explanation: string;
  expertiseLevel: ExpertiseLevel;
  specializations: string[];
  timestamp: number;
}

export class ExpertVerifier {
  private dynamodb: DynamoDB.DocumentClient;
  private readonly resultsTable = 'Results';
  private readonly workersTable = 'Workers';

  constructor(private expertWeights: ExpertWeights) {
    this.dynamodb = new DynamoDB.DocumentClient();
  }

  async verify(taskId: string, taskType: string): Promise<VerificationResult> {
    const startTime = Date.now();

    try {
      // Get expert verifications for this task
      const verifications = await this.getExpertVerifications(taskId);
      
      if (verifications.length === 0) {
        throw new Error('No expert verifications available');
      }

      // Get qualified experts for task type
      const qualifiedExperts = await this.getQualifiedExperts(taskType);
      
      // Filter verifications by qualified experts
      const qualifiedVerifications = verifications.filter(v => 
        qualifiedExperts.some(e => e.workerId === v.workerId)
      );

      if (qualifiedVerifications.length === 0) {
        throw new Error('No qualified expert verifications available');
      }

      // Calculate weighted decision
      const result = this.calculateWeightedDecision(qualifiedVerifications, taskType);

      return {
        ...result,
        processingTime: Date.now() - startTime,
        contributors: qualifiedVerifications.map(v => ({
          type: 'EXPERT',
          workerId: v.workerId,
          expertiseLevel: v.expertiseLevel,
          confidence: v.confidence,
          specializations: v.specializations
        }))
      };
    } catch (error) {
      console.error('Expert verification error:', error);
      throw error;
    }
  }

  private async getExpertVerifications(taskId: string): Promise<ExpertVerification[]> {
    const result = await this.dynamodb.query({
      TableName: this.resultsTable,
      KeyConditionExpression: 'taskId = :taskId',
      FilterExpression: 'expertiseLevel IN (:expert, :master)',
      ExpressionAttributeValues: {
        ':taskId': taskId,
        ':expert': ExpertiseLevel.EXPERT,
        ':master': ExpertiseLevel.MASTER
      }
    }).promise();

    return result.Items as ExpertVerification[];
  }

  private async getQualifiedExperts(taskType: string): Promise<any[]> {
    const result = await this.dynamodb.query({
      TableName: this.workersTable,
      IndexName: 'ExpertiseIndex',
      KeyConditionExpression: 'expertiseLevel IN (:expert, :master)',
      FilterExpression: 'contains(specializations, :taskType)',
      ExpressionAttributeValues: {
        ':expert': ExpertiseLevel.EXPERT,
        ':master': ExpertiseLevel.MASTER,
        ':taskType': taskType
      }
    }).promise();

    return result.Items || [];
  }

  private calculateWeightedDecision(
    verifications: ExpertVerification[],
    taskType: string
  ): {
    decision: 'APPROVED' | 'REJECTED';
    confidence: number;
    explanation: string;
  } {
    // Calculate weights based on expertise level and specialization
    const weightedVotes = verifications.map(v => ({
      ...v,
      weight: this.calculateExpertWeight(v, taskType)
    }));

    // Calculate total weights
    const totalWeight = weightedVotes.reduce((sum, v) => sum + v.weight, 0);
    const approvalWeight = weightedVotes
      .filter(v => v.decision === 'APPROVED')
      .reduce((sum, v) => sum + v.weight, 0);

    // Calculate confidence and decision
    const approvalRatio = approvalWeight / totalWeight;
    const decision = approvalRatio >= 0.5 ? 'APPROVED' : 'REJECTED';
    const confidence = Math.abs(approvalRatio - 0.5) * 2; // Scale to 0-1

    // Generate explanation
    const explanation = this.generateExpertExplanation(
      weightedVotes,
      decision,
      confidence,
      taskType
    );

    return {
      decision,
      confidence,
      explanation
    };
  }

  private calculateExpertWeight(
    verification: ExpertVerification,
    taskType: string
  ): number {
    const baseWeight = this.expertWeights[verification.expertiseLevel];
    const specializationBonus = verification.specializations.includes(taskType) ? 1.5 : 1;
    const confidenceWeight = verification.confidence;

    return baseWeight * specializationBonus * confidenceWeight;
  }

  private generateExpertExplanation(
    weightedVotes: (ExpertVerification & { weight: number })[],
    decision: 'APPROVED' | 'REJECTED',
    confidence: number,
    taskType: string
  ): string {
    const totalExperts = weightedVotes.length;
    const specializedExperts = weightedVotes.filter(v => 
      v.specializations.includes(taskType)
    ).length;
    const masterExperts = weightedVotes.filter(v => 
      v.expertiseLevel === ExpertiseLevel.MASTER
    ).length;

    // Get explanations from top experts
    const topExpertExplanations = weightedVotes
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 2)
      .map(v => ({
        level: v.expertiseLevel,
        specialized: v.specializations.includes(taskType),
        explanation: v.explanation
      }));

    return `Expert consensus ${decision} with ${confidence.toFixed(2)} confidence. ` +
           `Based on ${totalExperts} expert reviews ` +
           `(${specializedExperts} specialized in ${taskType}, ${masterExperts} master level). ` +
           `Key expert insights: ${topExpertExplanations.map(e => 
             `[${e.level}${e.specialized ? '/Specialized' : ''}: ${e.explanation}]`
           ).join(' ')}`;
  }
} 