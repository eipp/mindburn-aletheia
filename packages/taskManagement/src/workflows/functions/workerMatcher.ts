import { WorkflowHandler } from './base';
import { WorkflowContext, WorkerMatchingOutput } from '../types/workflow';
import { WorkerMatcher as WorkerMatchingService } from '../../services/workerMatcher';
import { createEnvironmentTransformer } from '@mindburn/shared';

interface Config {
  minMatchScore: number;
  maxWorkersPerTask: number;
}

export class WorkerMatcher extends WorkflowHandler {
  private readonly matchingService: WorkerMatchingService;
  private readonly config: Config;

  constructor() {
    super('Workers');
    this.config = createEnvironmentTransformer<Config>(process.env);
    this.matchingService = new WorkerMatchingService({ minMatchScore: this.config.minMatchScore });
  }

  async handler(context: WorkflowContext): Promise<WorkerMatchingOutput> {
    try {
      const { taskData } = context;

      // Define matching criteria from task requirements
      const matchCriteria = {
        taskType: taskData.verificationRequirements.type,
        requiredSkills: taskData.verificationRequirements.requiredSkills || [],
        minLevel: taskData.verificationRequirements.minVerifierLevel,
        languageCodes: taskData.verificationRequirements.languageCodes,
        urgency: taskData.verificationRequirements.urgency,
      };

      // Find eligible workers
      const matchResults = await this.matchingService.findEligibleWorkers(taskData, matchCriteria);

      // Sort by match score and limit to max workers
      const eligibleWorkers = matchResults
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, this.config.maxWorkersPerTask)
        .map(result => result.workerId);

      // Determine matching strategy
      const matchingStrategy = this.determineStrategy(
        eligibleWorkers.length,
        taskData.verificationRequirements.urgency
      );

      // Calculate average match score
      const averageScore =
        matchResults.reduce((sum, r) => sum + r.matchScore, 0) / matchResults.length;

      this.logger.info('Worker matching completed', {
        taskId: taskData.taskId,
        workerCount: eligibleWorkers.length,
        strategy: matchingStrategy,
        averageScore,
      });

      return {
        taskId: taskData.taskId,
        eligibleWorkers,
        matchingStrategy,
        matchingScore: averageScore,
      };
    } catch (error) {
      this.logger.error('Worker matching failed', { error, context });
      throw error;
    }
  }

  private determineStrategy(
    workerCount: number,
    urgency: string
  ): 'broadcast' | 'targeted' | 'auction' {
    if (urgency === 'critical' || workerCount <= 3) {
      return 'broadcast';
    }
    if (workerCount <= 5) {
      return 'targeted';
    }
    return 'auction';
  }
}

export const handler = new WorkerMatcher().handler.bind(new WorkerMatcher());
