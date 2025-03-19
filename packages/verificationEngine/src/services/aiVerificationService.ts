import { Logger } from '@mindburn/shared/logger';
import { createLogger } from '@mindburn/shared';
import axios from 'axios';
import { 
  VerificationTask, 
  VerificationResult,
  TaskType, 
  VerificationType,
  ModelExecutionMetrics
} from '../types';
import { VerificationError } from '../errors';
import { ModelRegistry } from '../modelmanagement/modelRegistry';

/**
 * Service for AI-based verification of tasks using various models
 */
export class AiVerificationService {
  private readonly logger: Logger;
  private readonly modelRegistry: ModelRegistry;
  private readonly metricsEnabled: boolean;
  
  // Mapping of task types to their corresponding models
  private readonly TASK_MODEL_MAPPING = {
    [TaskType.CONTENT_MODERATION]: {
      modelId: 'content-moderation',
      version: 'v2.0',
      name: 'ContentModerationModel',
      confidenceThreshold: 0.7
    },
    [TaskType.FACT_CHECK]: {
      modelId: 'fact-checker',
      version: 'v1.5',
      name: 'FactCheckModel',
      confidenceThreshold: 0.8
    },
    [TaskType.TOXICITY]: {
      modelId: 'toxicity-detection',
      version: 'v1.8',
      name: 'ToxicityDetectionModel',
      confidenceThreshold: 0.75
    },
    [TaskType.SENTIMENT]: {
      modelId: 'sentiment-analysis',
      version: 'v2.1',
      name: 'SentimentAnalysisModel',
      confidenceThreshold: 0.65
    },
    [TaskType.IMAGE_CLASSIFICATION]: {
      modelId: 'image-classifier',
      version: 'v2.3',
      name: 'ImageClassificationModel',
      confidenceThreshold: 0.8
    },
    [TaskType.CUSTOM]: {
      modelId: 'generic-verification',
      version: 'v1.0',
      name: 'GenericVerificationModel',
      confidenceThreshold: 0.6
    },
  };

  constructor(logger?: Logger) {
    this.logger = logger || createLogger('AiVerificationService');
    this.modelRegistry = new ModelRegistry();
    this.metricsEnabled = process.env.ENABLE_AI_METRICS === 'true';

    // Preload commonly used models
    this.preloadModels();
  }

  /**
   * Preload common models to reduce cold start latency
   */
  private async preloadModels(): Promise<void> {
    try {
      const preloadPromises = [
        this.modelRegistry.loadModel('content-moderation', 'v2.0'),
        this.modelRegistry.loadModel('toxicity-detection', 'v1.8')
      ];
      
      await Promise.all(preloadPromises);
      this.logger.info('Preloaded common models');
    } catch (error) {
      this.logger.warn('Failed to preload models', { error });
      // Non-blocking - continue even if preloading fails
    }
  }

  /**
   * Verify a task using AI models
   */
  async verifyTask(task: VerificationTask): Promise<VerificationResult> {
    const startTime = Date.now();
    let modelMetrics: ModelExecutionMetrics | undefined;
    
    try {
      this.logger.info('Starting AI verification', { 
        taskId: task.taskId, 
        taskType: task.type 
      });

      // Get model configuration for this task type
      const modelConfig = this.getModelConfig(task.type);
      if (!modelConfig) {
        throw new VerificationError(`No model configured for task type: ${task.type}`);
      }

      // Prepare input for the model
      const modelInput = this.prepareModelInput(task);
      
      // Get ML model from registry
      const model = await this.modelRegistry.loadModel(modelConfig.modelId, modelConfig.version);
      
      // Execute model prediction with timing
      const predictionStartTime = Date.now();
      const prediction = await model.predict(modelInput);
      const predictionEndTime = Date.now();
      
      // Process model output based on task type
      const result = this.processModelOutput(prediction, task.type);
      
      // Check confidence against threshold
      const confidenceThreshold = modelConfig.confidenceThreshold;
      const isConfident = result.confidence >= confidenceThreshold;
      
      // Store execution metrics if enabled
      if (this.metricsEnabled) {
        modelMetrics = {
          modelId: modelConfig.modelId,
          modelVersion: modelConfig.version,
          executionTimeMs: predictionEndTime - predictionStartTime,
          inputSize: this.calculateInputSize(modelInput),
          confidence: result.confidence,
          timestamp: new Date().toISOString()
        };
      }
      
      // If confidence below threshold, flag for human verification
      if (!isConfident) {
        this.logger.info('AI verification confidence below threshold, flagging for human review', {
          taskId: task.taskId,
          confidence: result.confidence,
          threshold: confidenceThreshold
        });
      }
      
      // Calculate total processing time
      const processingTime = Date.now() - startTime;
      
      // Create verification result
      return {
        taskId: task.taskId,
        verifierType: VerificationType.AI,
        decision: result.status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
        confidence: result.confidence,
        processingTime,
        metadata: {
          modelId: modelConfig.modelId,
          modelVersion: modelConfig.version,
          result: result.result,
          requiresHumanVerification: !isConfident,
          metrics: modelMetrics
        },
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('AI verification failed', { 
        error, 
        taskId: task.taskId,
        processingTime: Date.now() - startTime
      });
      
      // Return a result indicating failure, requiring human verification
      return {
        taskId: task.taskId,
        verifierType: VerificationType.AI,
        decision: 'REJECTED', // Default to rejected on failure
        confidence: 0,
        processingTime: Date.now() - startTime,
        metadata: {
          error: error.message,
          requiresHumanVerification: true,
          metrics: modelMetrics
        },
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get model configuration for a specific task type
   */
  private getModelConfig(taskType: string): { 
    modelId: string; 
    version: string; 
    name: string;
    confidenceThreshold: number;
  } {
    const config = this.TASK_MODEL_MAPPING[taskType];
    
    if (!config) {
      // Fallback to custom/generic model
      return this.TASK_MODEL_MAPPING[TaskType.CUSTOM];
    }
    
    return config;
  }

  /**
   * Prepare input data for the model based on task type and content
   */
  private prepareModelInput(task: VerificationTask): any {
    const { content, metadata = {}, type } = task;
    
    switch (type) {
      case TaskType.CONTENT_MODERATION:
        return {
          text: typeof content === 'string' ? content : content.text,
          image_url: content.imageUrl || metadata.imageUrl,
          categories: metadata.categories || ['nsfw', 'violence', 'hate-speech'],
          context: metadata.context || {}
        };
        
      case TaskType.FACT_CHECK:
        return {
          claim: typeof content === 'string' ? content : content.claim,
          context: content.context || metadata.context,
          sources: metadata.sources || [],
          language: metadata.language || 'en'
        };
        
      case TaskType.TOXICITY:
        return {
          text: typeof content === 'string' ? content : content.text,
          context: metadata.context || {},
          toxicity_types: metadata.toxicityTypes || ['threat', 'insult', 'identity_attack', 'sexual_explicit']
        };
        
      case TaskType.SENTIMENT:
        return {
          text: typeof content === 'string' ? content : content.text,
          language: metadata.language || 'en',
          aspects: metadata.aspects || []
        };
        
      case TaskType.IMAGE_CLASSIFICATION:
        return {
          image_url: typeof content === 'string' ? content : content.imageUrl,
          categories: metadata.categories || [],
          detect_objects: metadata.detectObjects || false
        };
        
      case TaskType.CUSTOM:
      default:
        // For custom tasks, pass through the content and metadata
        return {
          content,
          metadata
        };
    }
  }

  /**
   * Process model output based on task type
   */
  private processModelOutput(output: any, taskType: string): { 
    result: any; 
    confidence: number; 
    status: string;
  } {
    switch (taskType) {
      case TaskType.CONTENT_MODERATION:
        return this.processContentModerationOutput(output);
        
      case TaskType.FACT_CHECK:
        return this.processFactCheckOutput(output);
        
      case TaskType.TOXICITY:
        return this.processToxicityOutput(output);
        
      case TaskType.SENTIMENT:
        return this.processSentimentOutput(output);
        
      case TaskType.IMAGE_CLASSIFICATION:
        return this.processImageClassificationOutput(output);
        
      case TaskType.CUSTOM:
      default:
        // For custom task types, assume the model returns the expected format
        return {
          result: output.result || output,
          confidence: output.confidence || this.extractConfidence(output) || 0.5,
          status: output.status || output.decision || 'REJECTED'
        };
    }
  }

  /**
   * Process content moderation model output
   */
  private processContentModerationOutput(output: any): { 
    result: any; 
    confidence: number; 
    status: string; 
  } {
    const categories = output.categories || [];
    const hasFlagged = categories.some(c => c.flagged === true);
    
    const aggregatedResult = {
      flagged: hasFlagged,
      categories: categories,
      overallScore: this.calculateAverageConfidence(categories)
    };
    
    return {
      result: aggregatedResult,
      confidence: aggregatedResult.overallScore,
      status: hasFlagged ? 'REJECTED' : 'APPROVED'
    };
  }

  /**
   * Process fact check model output
   */
  private processFactCheckOutput(output: any): { 
    result: any;
    confidence: number;
    status: string;
  } {
    const verdict = output.verdict || '';
    const confidence = output.confidence || 0.5;
    
    const aggregatedResult = {
      verdict,
      confidence,
      sources: output.sources || [],
      explanation: output.explanation || ''
    };
    
    return {
      result: aggregatedResult,
      confidence,
      status: verdict === 'TRUE' ? 'APPROVED' : 'REJECTED'
    };
  }

  /**
   * Process toxicity detection model output
   */
  private processToxicityOutput(output: any): { 
    result: any;
    confidence: number;
    status: string;
  } {
    const scores = output.scores || {};
    const isToxic = output.toxic === true || 
                   (scores.toxic && scores.toxic > 0.5);
    
    const highestScore = this.calculateHighestConfidence(scores);
    
    const aggregatedResult = {
      toxic: isToxic,
      scores,
      explanation: output.explanation || ''
    };
    
    return {
      result: aggregatedResult,
      confidence: highestScore,
      status: isToxic ? 'REJECTED' : 'APPROVED'
    };
  }

  /**
   * Process sentiment analysis model output
   */
  private processSentimentOutput(output: any): { 
    result: any;
    confidence: number;
    status: string;
  } {
    const sentiment = output.sentiment || '';
    const score = output.score || 0.5;
    
    const aggregatedResult = {
      sentiment,
      score,
      aspects: output.aspects || []
    };
    
    return {
      result: aggregatedResult,
      confidence: score,
      // For sentiment, we don't approve/reject, just provide the sentiment
      // Here we're assuming positive sentiment = approved, negative = rejected
      status: sentiment === 'POSITIVE' ? 'APPROVED' : 'REJECTED'
    };
  }

  /**
   * Process image classification model output
   */
  private processImageClassificationOutput(output: any): { 
    result: any;
    confidence: number;
    status: string;
  } {
    const classifications = output.classifications || [];
    const hasFlagged = classifications.some(c => 
      c.flagged === true || (c.name && ['nsfw', 'violence', 'hate'].includes(c.name.toLowerCase()))
    );
    
    // Get top classification by confidence
    const sorted = [...classifications].sort((a, b) => b.confidence - a.confidence);
    const topConfidence = sorted.length > 0 ? sorted[0].confidence : 0.5;
    
    const aggregatedResult = {
      flagged: hasFlagged,
      classifications,
      topClassification: sorted.length > 0 ? sorted[0].name : '',
      objects: output.objects || []
    };
    
    return {
      result: aggregatedResult,
      confidence: topConfidence,
      status: hasFlagged ? 'REJECTED' : 'APPROVED'
    };
  }

  /**
   * Calculate the average confidence from a list of categories
   */
  private calculateAverageConfidence(categories: Array<{ name: string; confidence: number }>): number {
    if (!categories || categories.length === 0) {
      return 0.5;
    }
    
    const sum = categories.reduce((acc, category) => acc + (category.confidence || 0), 0);
    return sum / categories.length;
  }

  /**
   * Calculate the highest confidence score from a set of scores
   */
  private calculateHighestConfidence(scores: Record<string, number>): number {
    if (!scores || Object.keys(scores).length === 0) {
      return 0.5;
    }
    
    return Math.max(...Object.values(scores));
  }

  /**
   * Extract confidence from various types of model outputs
   */
  private extractConfidence(output: any): number | undefined {
    if (typeof output.confidence === 'number') {
      return output.confidence;
    }
    
    if (typeof output.score === 'number') {
      return output.score;
    }
    
    if (output.scores && typeof output.scores === 'object') {
      return this.calculateHighestConfidence(output.scores);
    }
    
    return undefined;
  }

  /**
   * Calculate the approximate size of the input data in bytes
   */
  private calculateInputSize(input: any): number {
    try {
      return Buffer.byteLength(JSON.stringify(input), 'utf8');
    } catch (error) {
      return 0;
    }
  }
} 