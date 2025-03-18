import {
  StorageService,
  QueueService,
  LoggerService,
  AIService,
  VerificationRequest,
  VerificationFlow,
  VerificationResult,
  VerificationStatus,
  HumanVerification,
  CredibilityScore,
} from '@mindburn/shared';
import { z } from 'zod';

const VerificationRequestSchema = z.object({
  id: z.string(),
  content: z.string(),
  contentType: z.enum(['text', 'image_text', 'source']),
  context: z.string().optional(),
  domain: z.string().optional(),
  priority: z.number().default(1),
  requiredConfidence: z.number().default(0.8),
});

export class VerificationOrchestrator {
  private storage: StorageService;
  private queue: QueueService;
  private logger: LoggerService;
  private ai: AIService;

  constructor() {
    this.storage = new StorageService();
    this.queue = new QueueService();
    this.logger = new LoggerService();
    this.ai = new AIService();
  }

  async processVerificationRequest(
    request: z.infer<typeof VerificationRequestSchema>
  ): Promise<VerificationFlow> {
    VerificationRequestSchema.parse(request);

    try {
      this.logger.info('Processing verification request', { requestId: request.id });

      // Start verification flow
      const flow = await this.createVerificationFlow(request);

      // AI verification phase
      const aiResult = await this.performAIVerification(request);
      await this.updateVerificationFlow(flow.id, {
        aiResult,
        status: this.determineNextStatus(aiResult, request.requiredConfidence),
      });

      // Check if human verification is needed
      if (this.needsHumanVerification(aiResult, request)) {
        await this.queueForHumanVerification(flow.id, request, aiResult);
      }

      const updatedFlow = await this.getVerificationFlow(flow.id);
      this.logger.info('Verification request processed', {
        requestId: request.id,
        status: updatedFlow.status,
      });

      return updatedFlow;
    } catch (error) {
      this.logger.error('Failed to process verification request', {
        requestId: request.id,
        error,
      });
      throw error;
    }
  }

  async handleHumanVerification(
    flowId: string,
    humanVerification: HumanVerification
  ): Promise<void> {
    try {
      this.logger.info('Handling human verification', { flowId });

      const flow = await this.getVerificationFlow(flowId);

      // Update flow with human verification
      await this.updateVerificationFlow(flowId, {
        humanVerification,
        status: 'completed',
        completedAt: new Date().toISOString(),
      });

      // Learn from human verification
      await this.learnFromHumanVerification(flow, humanVerification);

      this.logger.info('Human verification processed', { flowId });
    } catch (error) {
      this.logger.error('Failed to handle human verification', {
        flowId,
        error,
      });
      throw error;
    }
  }

  private async performAIVerification(
    request: z.infer<typeof VerificationRequestSchema>
  ): Promise<VerificationResult> {
    switch (request.contentType) {
      case 'text':
        return await this.ai.verifyText(request.content, request.context);
      case 'image_text':
        return await this.ai.verifyImageText(
          Buffer.from(request.content, 'base64'),
          request.context || ''
        );
      case 'source':
        const credibility = await this.ai.assessSourceCredibility(request.content);
        return this.convertCredibilityToVerification(credibility);
      default:
        throw new Error(`Unsupported content type: ${request.contentType}`);
    }
  }

  private determineNextStatus(
    aiResult: VerificationResult,
    requiredConfidence: number
  ): VerificationStatus {
    if (aiResult.confidence >= requiredConfidence) {
      return aiResult.isAccurate ? 'verified' : 'rejected';
    }
    return 'needs_human_verification';
  }

  private needsHumanVerification(
    aiResult: VerificationResult,
    request: z.infer<typeof VerificationRequestSchema>
  ): boolean {
    return (
      aiResult.confidence < request.requiredConfidence ||
      request.priority > 2 ||
      (request.domain && this.isHighRiskDomain(request.domain))
    );
  }

  private isHighRiskDomain(domain: string): boolean {
    const highRiskDomains = ['medical', 'legal', 'financial', 'safety'];
    return highRiskDomains.includes(domain.toLowerCase());
  }

  private async queueForHumanVerification(
    flowId: string,
    request: z.infer<typeof VerificationRequestSchema>,
    aiResult: VerificationResult
  ): Promise<void> {
    await this.queue.send('human_verification', {
      flowId,
      request,
      aiResult,
      priority: request.priority,
      queuedAt: new Date().toISOString(),
      status: 'pending',
    });
  }

  private async learnFromHumanVerification(
    flow: VerificationFlow,
    humanVerification: HumanVerification
  ): Promise<void> {
    // Store verification pair for model improvement
    await this.storage.put('verification_learning', {
      flowId: flow.id,
      timestamp: new Date().toISOString(),
      contentType: flow.request.contentType,
      content: flow.request.content,
      aiVerification: flow.aiResult,
      humanVerification,
      domain: flow.request.domain,
    });
  }

  private async createVerificationFlow(
    request: z.infer<typeof VerificationRequestSchema>
  ): Promise<VerificationFlow> {
    const flow: VerificationFlow = {
      id: request.id,
      request,
      status: 'in_progress',
      createdAt: new Date().toISOString(),
    };

    await this.storage.put('verification_flows', flow);
    return flow;
  }

  private async getVerificationFlow(flowId: string): Promise<VerificationFlow> {
    const flow = await this.storage.get('verification_flows', flowId);
    if (!flow) {
      throw new Error(`Verification flow not found: ${flowId}`);
    }
    return flow as VerificationFlow;
  }

  private async updateVerificationFlow(
    flowId: string,
    update: Partial<VerificationFlow>
  ): Promise<void> {
    await this.storage.update('verification_flows', flowId, update);
  }

  private convertCredibilityToVerification(credibility: CredibilityScore): VerificationResult {
    return {
      source: 'credibility_assessment',
      isAccurate: credibility.overall >= 0.7,
      confidence: credibility.overall,
      issues: this.extractCredibilityIssues(credibility),
      suggestions: [],
      explanation: credibility.explanation,
      timestamp: credibility.timestamp,
    };
  }

  private extractCredibilityIssues(credibility: CredibilityScore): string[] {
    const issues: string[] = [];
    const { factors } = credibility;

    if (factors.expertise < 0.6) {
      issues.push('Low domain expertise');
    }
    if (factors.citations < 0.6) {
      issues.push('Insufficient citations');
    }
    if (factors.transparency < 0.6) {
      issues.push('Lack of transparency');
    }
    if (factors.reputation < 0.6) {
      issues.push('Poor reputation score');
    }

    return issues;
  }
}
