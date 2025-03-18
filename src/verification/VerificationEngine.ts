import { TaskType } from '../types';
import {
  VerificationStrategy,
  VerificationConfig,
  VerificationContext,
  VerificationResult,
  AIModel,
  ExpertiseLevel,
  AIModelConfig,
  CacheConfig
} from './types';
import { Cache } from './Cache';
import { AIVerifier } from './verifiers/AIVerifier';
import { HumanConsensusVerifier } from './verifiers/HumanConsensusVerifier';
import { ExpertVerifier } from './verifiers/ExpertVerifier';
import { GoldenSetVerifier } from './verifiers/GoldenSetVerifier';
import { publishVerificationMetric } from '../utils/metrics';

export class VerificationEngine {
  private cache: Cache;
  private aiVerifier: AIVerifier;
  private humanVerifier: HumanConsensusVerifier;
  private expertVerifier: ExpertVerifier;
  private goldenSetVerifier: GoldenSetVerifier;

  constructor(
    private readonly aiConfig: AIModelConfig[],
    private readonly cacheConfig: CacheConfig
  ) {
    this.cache = new Cache(cacheConfig);
    this.aiVerifier = new AIVerifier(aiConfig);
    this.humanVerifier = new HumanConsensusVerifier();
    this.expertVerifier = new ExpertVerifier();
    this.goldenSetVerifier = new GoldenSetVerifier();
  }

  async verify(
    taskId: string,
    data: any,
    context: VerificationContext
  ): Promise<VerificationResult> {
    const startTime = Date.now();

    // Check cache first
    if (this.cacheConfig.enabled) {
      const cachedResult = await this.cache.get(data);
      if (cachedResult) {
        return this.enrichResult(cachedResult, startTime);
      }
    }

    // Select verification strategy
    const config = this.selectStrategy(context);

    // Execute verification
    const result = await this.executeVerification(taskId, data, config, context);

    // Cache result if enabled
    if (this.cacheConfig.enabled) {
      await this.cache.set(data, result);
    }

    // Publish metrics
    await this.publishMetrics(result, startTime);

    return result;
  }

  private selectStrategy(context: VerificationContext): VerificationConfig {
    const baseConfig: Partial<VerificationConfig> = {
      requiredConfidence: 0.95,
      minVerifications: 2,
      maxVerifications: 5,
      timeoutSeconds: 3600
    };

    switch (context.taskType) {
      case TaskType.TEXT_VERIFICATION:
        return {
          ...baseConfig,
          strategy: this.selectTextStrategy(context),
          aiModels: [AIModel.CLAUDE],
          expertiseThreshold: ExpertiseLevel.INTERMEDIATE
        } as VerificationConfig;

      case TaskType.IMAGE_VERIFICATION:
        return {
          ...baseConfig,
          strategy: this.selectImageStrategy(context),
          aiModels: [AIModel.GEMINI],
          expertiseThreshold: ExpertiseLevel.EXPERT
        } as VerificationConfig;

      case TaskType.CODE_VERIFICATION:
        return {
          ...baseConfig,
          strategy: this.selectCodeStrategy(context),
          aiModels: [AIModel.CLAUDE, AIModel.CUSTOM],
          expertiseThreshold: ExpertiseLevel.MASTER,
          minVerifications: 3
        } as VerificationConfig;

      default:
        throw new Error(`Unsupported task type: ${context.taskType}`);
    }
  }

  private selectTextStrategy(context: VerificationContext): VerificationStrategy {
    if (context.urgency > 0.8 && context.aiAvailability) {
      return VerificationStrategy.AI_ASSISTED;
    }
    if (context.expertAvailability) {
      return VerificationStrategy.EXPERT_WEIGHTED;
    }
    return VerificationStrategy.HUMAN_CONSENSUS;
  }

  private selectImageStrategy(context: VerificationContext): VerificationStrategy {
    if (context.expertAvailability) {
      return VerificationStrategy.EXPERT_WEIGHTED;
    }
    if (context.aiAvailability) {
      return VerificationStrategy.HYBRID;
    }
    return VerificationStrategy.HUMAN_CONSENSUS;
  }

  private selectCodeStrategy(context: VerificationContext): VerificationStrategy {
    if (!context.previousVerifications) {
      return VerificationStrategy.GOLDEN_SET;
    }
    if (context.expertAvailability) {
      return VerificationStrategy.EXPERT_WEIGHTED;
    }
    return VerificationStrategy.HYBRID;
  }

  private async executeVerification(
    taskId: string,
    data: any,
    config: VerificationConfig,
    context: VerificationContext
  ): Promise<VerificationResult> {
    const startTime = Date.now();

    let result: VerificationResult;
    switch (config.strategy) {
      case VerificationStrategy.HUMAN_CONSENSUS:
        result = await this.humanVerifier.verify(taskId, data, config);
        break;

      case VerificationStrategy.EXPERT_WEIGHTED:
        result = await this.expertVerifier.verify(taskId, data, config);
        break;

      case VerificationStrategy.AI_ASSISTED:
        result = await this.aiVerifier.verify(taskId, data, config);
        break;

      case VerificationStrategy.GOLDEN_SET:
        result = await this.goldenSetVerifier.verify(taskId, data, config);
        break;

      case VerificationStrategy.HYBRID:
        result = await this.executeHybridVerification(taskId, data, config);
        break;

      default:
        throw new Error(`Unsupported verification strategy: ${config.strategy}`);
    }

    return this.enrichResult(result, startTime);
  }

  private async executeHybridVerification(
    taskId: string,
    data: any,
    config: VerificationConfig
  ): Promise<VerificationResult> {
    // Execute AI and human verifications in parallel
    const [aiResult, humanResult] = await Promise.all([
      this.aiVerifier.verify(taskId, data, config),
      this.humanVerifier.verify(taskId, data, config)
    ]);

    // Combine results with weighted scoring
    const combinedConfidence = (aiResult.confidence + humanResult.confidence) / 2;
    const combinedDecision = this.reconcileDecisions(aiResult.decision, humanResult.decision);

    return {
      decision: combinedDecision,
      confidence: combinedConfidence,
      explanation: this.combineExplanations(aiResult.explanation, humanResult.explanation),
      method: VerificationStrategy.HYBRID,
      contributors: {
        humans: humanResult.contributors.humans,
        aiModels: aiResult.contributors.aiModels
      },
      metadata: {
        processingTime: Math.max(
          aiResult.metadata.processingTime,
          humanResult.metadata.processingTime
        ),
        verificationCount: aiResult.metadata.verificationCount + humanResult.metadata.verificationCount,
        consensusLevel: (aiResult.metadata.consensusLevel + humanResult.metadata.consensusLevel) / 2,
        qualityScore: (aiResult.metadata.qualityScore + humanResult.metadata.qualityScore) / 2
      }
    };
  }

  private reconcileDecisions(aiDecision: any, humanDecision: any): any {
    // Implement decision reconciliation logic based on task type and confidence
    return humanDecision; // Default to human decision for now
  }

  private combineExplanations(aiExplanation: string, humanExplanation: string): string {
    return `AI Analysis: ${aiExplanation}\nHuman Analysis: ${humanExplanation}`;
  }

  private enrichResult(
    result: VerificationResult,
    startTime: number
  ): VerificationResult {
    const processingTime = Date.now() - startTime;
    return {
      ...result,
      metadata: {
        ...result.metadata,
        processingTime
      }
    };
  }

  private async publishMetrics(result: VerificationResult, startTime: number): Promise<void> {
    const duration = Date.now() - startTime;
    await publishVerificationMetric(
      result.method,
      result.confidence,
      duration,
      result.metadata.qualityScore
    );
  }
} 