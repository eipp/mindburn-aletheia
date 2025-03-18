import { DynamoDB } from 'aws-sdk';
import { VerificationResult, ExpertiseLevel } from './types';

interface HumanVerification {
  workerId: string;
  decision: 'APPROVED' | 'REJECTED';
  confidence: number;
  explanation: string;
  expertiseLevel: ExpertiseLevel;
  timestamp: number;
}

export class HumanConsensusVerifier {
  private dynamodb: DynamoDB.DocumentClient;
  private readonly resultsTable = 'Results';

  constructor(private requiredConsensus: number = 3) {
    this.dynamodb = new DynamoDB.DocumentClient();
  }

  async verify(taskId: string): Promise<VerificationResult> {
    const startTime = Date.now();

    try {
      // Get all verifications for this task
      const verifications = await this.getVerifications(taskId);
      
      if (verifications.length < this.requiredConsensus) {
        throw new Error(`Insufficient verifications: ${verifications.length}/${this.requiredConsensus}`);
      }

      // Calculate weighted consensus
      const { decision, confidence, explanation } = this.calculateConsensus(verifications);

      return {
        decision,
        confidence,
        explanation,
        processingTime: Date.now() - startTime,
        contributors: verifications.map(v => ({
          type: 'HUMAN',
          workerId: v.workerId,
          expertiseLevel: v.expertiseLevel,
          confidence: v.confidence
        }))
      };
    } catch (error) {
      console.error('Human consensus verification error:', error);
      throw error;
    }
  }

  private async getVerifications(taskId: string): Promise<HumanVerification[]> {
    const result = await this.dynamodb.query({
      TableName: this.resultsTable,
      KeyConditionExpression: 'taskId = :taskId',
      ExpressionAttributeValues: {
        ':taskId': taskId
      }
    }).promise();

    return result.Items as HumanVerification[];
  }

  private calculateConsensus(verifications: HumanVerification[]): {
    decision: 'APPROVED' | 'REJECTED';
    confidence: number;
    explanation: string;
  } {
    // Weight verifications by expertise level and confidence
    const weightedVotes = verifications.map(v => ({
      ...v,
      weight: this.calculateWeight(v.expertiseLevel, v.confidence)
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
    const explanation = this.generateConsensusExplanation(
      weightedVotes,
      decision,
      confidence
    );

    return {
      decision,
      confidence,
      explanation
    };
  }

  private calculateWeight(expertiseLevel: ExpertiseLevel, confidence: number): number {
    const expertiseWeights = {
      [ExpertiseLevel.NOVICE]: 1,
      [ExpertiseLevel.INTERMEDIATE]: 2,
      [ExpertiseLevel.EXPERT]: 3,
      [ExpertiseLevel.MASTER]: 4
    };

    return expertiseWeights[expertiseLevel] * confidence;
  }

  private generateConsensusExplanation(
    weightedVotes: (HumanVerification & { weight: number })[],
    decision: 'APPROVED' | 'REJECTED',
    confidence: number
  ): string {
    const totalVerifiers = weightedVotes.length;
    const approvedCount = weightedVotes.filter(v => v.decision === 'APPROVED').length;
    const rejectedCount = totalVerifiers - approvedCount;

    const expertApproval = weightedVotes
      .filter(v => v.expertiseLevel === ExpertiseLevel.EXPERT || v.expertiseLevel === ExpertiseLevel.MASTER)
      .filter(v => v.decision === 'APPROVED').length;

    const expertRejection = weightedVotes
      .filter(v => v.expertiseLevel === ExpertiseLevel.EXPERT || v.expertiseLevel === ExpertiseLevel.MASTER)
      .filter(v => v.decision === 'REJECTED').length;

    // Combine key explanations from verifiers
    const keyExplanations = weightedVotes
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(v => v.explanation)
      .join(' ');

    return `Consensus ${decision} with ${confidence.toFixed(2)} confidence. ` +
           `${approvedCount}/${totalVerifiers} verifiers approved, ` +
           `including ${expertApproval} experts. ` +
           `${rejectedCount}/${totalVerifiers} verifiers rejected, ` +
           `including ${expertRejection} experts. ` +
           `Key observations: ${keyExplanations}`;
  }
} 