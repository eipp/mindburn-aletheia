import { Logger } from '@mindburn/shared/logger';
import {
  TaskType,
  WorkerLevel,
  AssessmentTask
} from '../types';

export class AssessmentTaskRepository {
  private readonly logger: Logger;

  // Sample assessment tasks for each task type and difficulty level
  private readonly assessmentTasks: Record<TaskType, Record<string, AssessmentTask[]>> = {
    TEXT_CLASSIFICATION: {
      BEGINNER: [
        {
          taskType: TaskType.TEXT_CLASSIFICATION,
          difficulty: 'BEGINNER',
          data: {
            text: 'This product is amazing! I love it!',
            categories: ['POSITIVE', 'NEGATIVE', 'NEUTRAL']
          },
          expectedResult: 'POSITIVE',
          timeLimit: 30
        }
      ],
      INTERMEDIATE: [
        {
          taskType: TaskType.TEXT_CLASSIFICATION,
          difficulty: 'INTERMEDIATE',
          data: {
            text: 'While the interface could use some improvements, the core functionality is solid.',
            categories: ['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED']
          },
          expectedResult: 'MIXED',
          timeLimit: 45
        }
      ],
      ADVANCED: [
        {
          taskType: TaskType.TEXT_CLASSIFICATION,
          difficulty: 'ADVANCED',
          data: {
            text: 'The new policy changes have led to increased efficiency in some departments, but have also caused temporary disruptions in workflow.',
            categories: ['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED', 'COMPLEX']
          },
          expectedResult: 'COMPLEX',
          timeLimit: 60
        }
      ]
    },
    IMAGE_CLASSIFICATION: {
      BEGINNER: [
        {
          taskType: TaskType.IMAGE_CLASSIFICATION,
          difficulty: 'BEGINNER',
          data: {
            imageUrl: 'https://example.com/cat.jpg',
            categories: ['CAT', 'DOG', 'BIRD']
          },
          expectedResult: 'CAT',
          timeLimit: 30
        }
      ],
      INTERMEDIATE: [
        {
          taskType: TaskType.IMAGE_CLASSIFICATION,
          difficulty: 'INTERMEDIATE',
          data: {
            imageUrl: 'https://example.com/street-scene.jpg',
            categories: ['URBAN', 'RURAL', 'SUBURBAN', 'INDUSTRIAL']
          },
          expectedResult: 'URBAN',
          timeLimit: 45
        }
      ],
      ADVANCED: [
        {
          taskType: TaskType.IMAGE_CLASSIFICATION,
          difficulty: 'ADVANCED',
          data: {
            imageUrl: 'https://example.com/medical-scan.jpg',
            categories: ['NORMAL', 'ABNORMAL', 'INCONCLUSIVE'],
            requiresAnnotation: true
          },
          expectedResult: {
            category: 'ABNORMAL',
            annotations: [
              { x: 100, y: 100, width: 50, height: 50, label: 'anomaly' }
            ]
          },
          timeLimit: 120
        }
      ]
    },
    SENTIMENT_ANALYSIS: {
      BEGINNER: [
        {
          taskType: TaskType.SENTIMENT_ANALYSIS,
          difficulty: 'BEGINNER',
          data: {
            text: 'I really enjoyed this movie!',
            options: {
              sentiment: ['POSITIVE', 'NEGATIVE', 'NEUTRAL'],
              intensity: [1, 2, 3, 4, 5]
            }
          },
          expectedResult: {
            sentiment: 'POSITIVE',
            intensity: 5
          },
          timeLimit: 30
        }
      ],
      INTERMEDIATE: [
        {
          taskType: TaskType.SENTIMENT_ANALYSIS,
          difficulty: 'INTERMEDIATE',
          data: {
            text: 'The service was okay, but the prices were a bit high.',
            options: {
              sentiment: ['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED'],
              intensity: [1, 2, 3, 4, 5],
              aspects: ['SERVICE', 'PRICE']
            }
          },
          expectedResult: {
            sentiment: 'MIXED',
            intensity: 3,
            aspects: {
              SERVICE: { sentiment: 'NEUTRAL', intensity: 3 },
              PRICE: { sentiment: 'NEGATIVE', intensity: 2 }
            }
          },
          timeLimit: 60
        }
      ],
      ADVANCED: [
        {
          taskType: TaskType.SENTIMENT_ANALYSIS,
          difficulty: 'ADVANCED',
          data: {
            text: 'While the new features are impressive, the learning curve is steep and documentation is lacking.',
            options: {
              sentiment: ['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED'],
              intensity: [1, 2, 3, 4, 5],
              aspects: ['FEATURES', 'USABILITY', 'DOCUMENTATION'],
              contextual: true
            }
          },
          expectedResult: {
            sentiment: 'MIXED',
            intensity: 4,
            aspects: {
              FEATURES: { sentiment: 'POSITIVE', intensity: 5 },
              USABILITY: { sentiment: 'NEGATIVE', intensity: 4 },
              DOCUMENTATION: { sentiment: 'NEGATIVE', intensity: 3 }
            },
            context: {
              domain: 'SOFTWARE',
              userType: 'TECHNICAL'
            }
          },
          timeLimit: 120
        }
      ]
    }
  };

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'AssessmentTaskRepository' });
  }

  async getTasksForAssessment(
    taskType: TaskType,
    workerLevel: WorkerLevel,
    count: number = 3
  ): Promise<AssessmentTask[]> {
    try {
      const difficulty = this.mapWorkerLevelToDifficulty(workerLevel);
      const availableTasks = this.assessmentTasks[taskType]?.[difficulty] || [];

      if (!availableTasks.length) {
        this.logger.warn('No assessment tasks available', {
          taskType,
          difficulty
        });
        return [];
      }

      // Randomly select tasks
      const selectedTasks = this.shuffleArray(availableTasks)
        .slice(0, Math.min(count, availableTasks.length));

      this.logger.info('Assessment tasks retrieved', {
        taskType,
        difficulty,
        count: selectedTasks.length
      });

      return selectedTasks;

    } catch (error) {
      this.logger.error('Failed to get assessment tasks', {
        error,
        taskType,
        workerLevel
      });
      throw error;
    }
  }

  async addAssessmentTask(
    taskType: TaskType,
    difficulty: string,
    task: AssessmentTask
  ): Promise<void> {
    try {
      if (!this.assessmentTasks[taskType]) {
        this.assessmentTasks[taskType] = {};
      }

      if (!this.assessmentTasks[taskType][difficulty]) {
        this.assessmentTasks[taskType][difficulty] = [];
      }

      this.assessmentTasks[taskType][difficulty].push(task);

      this.logger.info('Assessment task added', {
        taskType,
        difficulty
      });

    } catch (error) {
      this.logger.error('Failed to add assessment task', {
        error,
        taskType,
        difficulty
      });
      throw error;
    }
  }

  private mapWorkerLevelToDifficulty(level: WorkerLevel): string {
    switch (level) {
      case WorkerLevel.BEGINNER:
        return 'BEGINNER';
      case WorkerLevel.INTERMEDIATE:
        return 'INTERMEDIATE';
      case WorkerLevel.ADVANCED:
      case WorkerLevel.EXPERT:
        return 'ADVANCED';
      default:
        return 'BEGINNER';
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
} 