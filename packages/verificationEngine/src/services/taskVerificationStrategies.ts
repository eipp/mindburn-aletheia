import { TaskType, WorkerSubmission, VerificationTask } from '../types';

interface VerificationStrategy {
  validateFormat(result: any): boolean;
  calculateAccuracy(submission: WorkerSubmission, groundTruth?: any): number;
  aggregateResults(submissions: WorkerSubmission[]): any;
}

class TextClassificationStrategy implements VerificationStrategy {
  validateFormat(result: any): boolean {
    return typeof result === 'string' || 
           (Array.isArray(result) && result.every(r => typeof r === 'string'));
  }

  calculateAccuracy(submission: WorkerSubmission, groundTruth?: any): number {
    if (!groundTruth) return 0.85; // Placeholder
    return submission.result === groundTruth ? 1 : 0;
  }

  aggregateResults(submissions: WorkerSubmission[]): any {
    const counts = new Map<string, number>();
    submissions.forEach(s => {
      const key = JSON.stringify(s.result);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    
    let maxCount = 0;
    let mostCommon;
    counts.forEach((count, key) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = JSON.parse(key);
      }
    });
    
    return mostCommon;
  }
}

class ImageClassificationStrategy implements VerificationStrategy {
  validateFormat(result: any): boolean {
    return typeof result === 'object' && 
           'label' in result && 
           'confidence' in result &&
           typeof result.confidence === 'number' &&
           result.confidence >= 0 &&
           result.confidence <= 1;
  }

  calculateAccuracy(submission: WorkerSubmission, groundTruth?: any): number {
    if (!groundTruth) return 0.85; // Placeholder
    return submission.result.label === groundTruth.label ? 1 : 0;
  }

  aggregateResults(submissions: WorkerSubmission[]): any {
    const labelCounts = new Map<string, number>();
    let totalConfidence = 0;
    
    submissions.forEach(s => {
      labelCounts.set(
        s.result.label,
        (labelCounts.get(s.result.label) || 0) + 1
      );
      totalConfidence += s.result.confidence;
    });
    
    let maxCount = 0;
    let mostCommonLabel;
    labelCounts.forEach((count, label) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonLabel = label;
      }
    });
    
    return {
      label: mostCommonLabel,
      confidence: totalConfidence / submissions.length
    };
  }
}

class SentimentAnalysisStrategy implements VerificationStrategy {
  validateFormat(result: any): boolean {
    return typeof result === 'object' &&
           'sentiment' in result &&
           'score' in result &&
           typeof result.score === 'number' &&
           result.score >= -1 &&
           result.score <= 1;
  }

  calculateAccuracy(submission: WorkerSubmission, groundTruth?: any): number {
    if (!groundTruth) return 0.85; // Placeholder
    const scoreDiff = Math.abs(submission.result.score - groundTruth.score);
    return 1 - (scoreDiff / 2); // Normalize difference to 0-1 range
  }

  aggregateResults(submissions: WorkerSubmission[]): any {
    const scores = submissions.map(s => s.result.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    return {
      sentiment: avgScore > 0 ? 'positive' : avgScore < 0 ? 'negative' : 'neutral',
      score: avgScore
    };
  }
}

class EntityRecognitionStrategy implements VerificationStrategy {
  validateFormat(result: any): boolean {
    return Array.isArray(result) &&
           result.every(entity => 
             typeof entity === 'object' &&
             'text' in entity &&
             'type' in entity &&
             'start' in entity &&
             'end' in entity
           );
  }

  calculateAccuracy(submission: WorkerSubmission, groundTruth?: any): number {
    if (!groundTruth) return 0.85; // Placeholder
    
    const submittedEntities = submission.result;
    const groundTruthEntities = groundTruth;
    
    let matches = 0;
    for (const submitted of submittedEntities) {
      if (groundTruthEntities.some(gt => 
        gt.text === submitted.text &&
        gt.type === submitted.type &&
        gt.start === submitted.start &&
        gt.end === submitted.end
      )) {
        matches++;
      }
    }
    
    return matches / Math.max(
      submittedEntities.length,
      groundTruthEntities.length
    );
  }

  aggregateResults(submissions: WorkerSubmission[]): any {
    // Merge overlapping entities
    const allEntities = submissions.flatMap(s => s.result);
    const mergedEntities = new Map<string, any>();
    
    allEntities.forEach(entity => {
      const key = `${entity.start}:${entity.end}:${entity.type}`;
      if (!mergedEntities.has(key)) {
        mergedEntities.set(key, { ...entity, count: 1 });
      } else {
        mergedEntities.get(key).count++;
      }
    });
    
    // Filter entities with sufficient agreement
    const threshold = submissions.length * 0.5;
    return Array.from(mergedEntities.values())
      .filter(e => e.count >= threshold)
      .map(({ count, ...entity }) => entity);
  }
}

class ContentModerationStrategy implements VerificationStrategy {
  validateFormat(result: any): boolean {
    return typeof result === 'object' &&
           'isViolation' in result &&
           typeof result.isViolation === 'boolean' &&
           'categories' in result &&
           Array.isArray(result.categories) &&
           'confidence' in result &&
           typeof result.confidence === 'number';
  }

  calculateAccuracy(submission: WorkerSubmission, groundTruth?: any): number {
    if (!groundTruth) return 0.85; // Placeholder
    
    const submittedResult = submission.result;
    if (submittedResult.isViolation !== groundTruth.isViolation) {
      return 0;
    }
    
    const categoryOverlap = submittedResult.categories.filter(
      c => groundTruth.categories.includes(c)
    ).length;
    
    const categoryScore = categoryOverlap / Math.max(
      submittedResult.categories.length,
      groundTruth.categories.length
    );
    
    return (categoryScore + 1) / 2; // Average with the violation match
  }

  aggregateResults(submissions: WorkerSubmission[]): any {
    const violationVotes = submissions.filter(s => s.result.isViolation).length;
    const isViolation = violationVotes > submissions.length / 2;
    
    // Aggregate categories from submissions that agree with the majority
    const relevantSubmissions = submissions.filter(
      s => s.result.isViolation === isViolation
    );
    
    const categoryVotes = new Map<string, number>();
    relevantSubmissions.forEach(s => {
      s.result.categories.forEach(category => {
        categoryVotes.set(
          category,
          (categoryVotes.get(category) || 0) + 1
        );
      });
    });
    
    const categories = Array.from(categoryVotes.entries())
      .filter(([_, votes]) => votes > relevantSubmissions.length / 2)
      .map(([category]) => category);
    
    const confidence = relevantSubmissions.reduce(
      (sum, s) => sum + s.result.confidence,
      0
    ) / relevantSubmissions.length;
    
    return { isViolation, categories, confidence };
  }
}

export class VerificationStrategyFactory {
  private static strategies: Record<TaskType, VerificationStrategy> = {
    TEXT_CLASSIFICATION: new TextClassificationStrategy(),
    IMAGE_CLASSIFICATION: new ImageClassificationStrategy(),
    SENTIMENT_ANALYSIS: new SentimentAnalysisStrategy(),
    ENTITY_RECOGNITION: new EntityRecognitionStrategy(),
    CONTENT_MODERATION: new ContentModerationStrategy(),
    DATA_VALIDATION: new TextClassificationStrategy(), // Placeholder
    TRANSLATION_VERIFICATION: new TextClassificationStrategy(), // Placeholder
    AUDIO_TRANSCRIPTION: new TextClassificationStrategy(), // Placeholder
    VIDEO_ANNOTATION: new TextClassificationStrategy(), // Placeholder
    DOCUMENT_VERIFICATION: new TextClassificationStrategy() // Placeholder
  };

  static getStrategy(taskType: TaskType): VerificationStrategy {
    const strategy = this.strategies[taskType];
    if (!strategy) {
      throw new Error(`No verification strategy found for task type: ${taskType}`);
    }
    return strategy;
  }
} 