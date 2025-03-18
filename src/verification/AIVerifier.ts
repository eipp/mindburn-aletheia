import { DynamoDB } from 'aws-sdk';
import { VerificationResult, AIModel, AIModelConfig } from './types';

interface AIVerification {
  model: AIModel;
  decision: 'APPROVED' | 'REJECTED';
  confidence: number;
  explanation: string;
  processingTime: number;
  metadata: {
    tokens: number;
    temperature: number;
    modelVersion: string;
  };
}

export class AIVerifier {
  private dynamodb: DynamoDB.DocumentClient;
  private readonly resultsTable = 'Results';

  constructor(private aiConfigs: AIModelConfig[]) {
    this.dynamodb = new DynamoDB.DocumentClient();
  }

  async verify(taskId: string, content: any, taskType: string): Promise<VerificationResult> {
    const startTime = Date.now();

    try {
      // Get verifications from all configured AI models
      const verifications = await Promise.all(
        this.aiConfigs.map(config => this.getModelVerification(config, content, taskType))
      );

      // Combine results with weighted scoring
      const result = this.combineResults(verifications);

      return {
        ...result,
        processingTime: Date.now() - startTime,
        contributors: verifications.map(v => ({
          type: 'AI',
          model: v.model,
          confidence: v.confidence,
          metadata: v.metadata,
        })),
      };
    } catch (error) {
      console.error('AI verification error:', error);
      throw error;
    }
  }

  private async getModelVerification(
    config: AIModelConfig,
    content: any,
    taskType: string
  ): Promise<AIVerification> {
    const startTime = Date.now();

    try {
      // Prepare prompt based on task type
      const prompt = this.generatePrompt(content, taskType);

      // Make API call to AI model
      const response = await this.callAIModel(config, prompt);

      // Parse and validate response
      const result = this.parseAIResponse(response);

      return {
        model: config.model,
        ...result,
        processingTime: Date.now() - startTime,
        metadata: {
          tokens: response.usage?.totalTokens || 0,
          temperature: config.temperature,
          modelVersion: response.modelVersion || 'unknown',
        },
      };
    } catch (error) {
      console.error(`Error with ${config.model}:`, error);
      throw error;
    }
  }

  private generatePrompt(content: any, taskType: string): string {
    // Generate appropriate prompt based on task type
    const basePrompt = `Please verify the following ${taskType} content and respond with:
1. Decision (APPROVED/REJECTED)
2. Confidence score (0-1)
3. Detailed explanation
4. Any potential concerns

Content to verify:
${JSON.stringify(content, null, 2)}`;

    switch (taskType) {
      case 'TEXT_VERIFICATION':
        return `${basePrompt}

Focus on:
- Accuracy and factual correctness
- Grammar and clarity
- Tone and appropriateness
- Potential misinformation or bias`;

      case 'IMAGE_VERIFICATION':
        return `${basePrompt}

Focus on:
- Visual quality and clarity
- Content appropriateness
- Potential manipulation or AI generation
- Compliance with guidelines`;

      case 'CODE_VERIFICATION':
        return `${basePrompt}

Focus on:
- Code correctness and functionality
- Security vulnerabilities
- Performance implications
- Best practices compliance`;

      default:
        return basePrompt;
    }
  }

  private async callAIModel(config: AIModelConfig, prompt: string): Promise<any> {
    // Implement API calls to different AI models
    switch (config.model) {
      case AIModel.CLAUDE:
        return this.callClaude(config, prompt);
      case AIModel.GEMINI:
        return this.callGemini(config, prompt);
      case AIModel.CUSTOM:
        return this.callCustomModel(config, prompt);
      default:
        throw new Error(`Unsupported AI model: ${config.model}`);
    }
  }

  private async callClaude(config: AIModelConfig, prompt: string): Promise<any> {
    // Implement Claude API call
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
    }

    return response.json();
  }

  private async callGemini(config: AIModelConfig, prompt: string): Promise<any> {
    // Implement Gemini API call
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        contents: [{ text: prompt }],
        generationConfig: {
          maxOutputTokens: config.maxTokens,
          temperature: config.temperature,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    return response.json();
  }

  private async callCustomModel(config: AIModelConfig, prompt: string): Promise<any> {
    // Implement custom model API call
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        parameters: {
          max_tokens: config.maxTokens,
          temperature: config.temperature,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Custom model API error: ${response.statusText}`);
    }

    return response.json();
  }

  private parseAIResponse(response: any): {
    decision: 'APPROVED' | 'REJECTED';
    confidence: number;
    explanation: string;
  } {
    try {
      // Extract decision, confidence, and explanation from model response
      // This is a simplified example - actual implementation would depend on model output format
      const text = response.text || response.completion || response.output;
      const lines = text.split('\n');

      const decision = lines.find(l => l.includes('Decision:'))?.includes('APPROVED')
        ? 'APPROVED'
        : 'REJECTED';

      const confidenceLine = lines.find(l => l.includes('Confidence:'));
      const confidence = confidenceLine ? parseFloat(confidenceLine.match(/[\d.]+/)[0]) : 0.5;

      const explanation = lines
        .filter(l => !l.includes('Decision:') && !l.includes('Confidence:'))
        .join('\n')
        .trim();

      return {
        decision,
        confidence,
        explanation,
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      throw new Error('Failed to parse AI model response');
    }
  }

  private combineResults(verifications: AIVerification[]): {
    decision: 'APPROVED' | 'REJECTED';
    confidence: number;
    explanation: string;
  } {
    // Weight results by model confidence and processing time
    const weightedResults = verifications.map(v => ({
      ...v,
      weight: this.calculateWeight(v),
    }));

    // Calculate weighted decision
    const totalWeight = weightedResults.reduce((sum, v) => sum + v.weight, 0);
    const approvalWeight = weightedResults
      .filter(v => v.decision === 'APPROVED')
      .reduce((sum, v) => sum + v.weight, 0);

    // Calculate final decision and confidence
    const approvalRatio = approvalWeight / totalWeight;
    const decision = approvalRatio >= 0.5 ? 'APPROVED' : 'REJECTED';
    const confidence = Math.abs(approvalRatio - 0.5) * 2; // Scale to 0-1

    // Combine explanations
    const explanation = this.combineExplanations(weightedResults);

    return {
      decision,
      confidence,
      explanation,
    };
  }

  private calculateWeight(verification: AIVerification): number {
    // Weight based on model confidence and inverse processing time
    const timeWeight = 1 / (verification.processingTime + 1);
    return verification.confidence * timeWeight;
  }

  private combineExplanations(verifications: (AIVerification & { weight: number })[]): string {
    // Sort by weight and combine top explanations
    const sortedVerifications = verifications.sort((a, b) => b.weight - a.weight);

    const modelDecisions = sortedVerifications
      .map(v => `${v.model}: ${v.decision} (${(v.confidence * 100).toFixed(1)}% confidence)`)
      .join(', ');

    const keyObservations = sortedVerifications
      .slice(0, 2)
      .map(v => v.explanation)
      .join('\n\n');

    return `AI Model Consensus:\n${modelDecisions}\n\nKey Observations:\n${keyObservations}`;
  }
}
