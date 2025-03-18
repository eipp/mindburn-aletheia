5. Verification Engine API Contracts
5.1 Verification Service API
typescriptCopy// Verification Service API
interface VerificationServiceAPI {
  // Submit individual verification
  submitVerification: {
    request: {
      taskId: string;
      workerId: string;
      responses: {
        [fieldId: string]: string | string[] | boolean;
      };
      confidence?: number;
      timeSpent: number;
    },
    response: {
      verificationId: string;
      taskId: string;
      workerId: string;
      status: "accepted";
      qualityScore?: number;
      submittedAt: string;
    },
    errors: {
      400: "Invalid verification data",
      404: "Task not found",
      409: "Already submitted or task expired",
      500: "Service error"
    }
  }
  
  // Get task verifications
  getTaskVerifications: {
    request: {
      taskId: string;
    },
    response: {
      taskId: string;
      verifications: [{
        verificationId: string;
        workerId: string;
        workerLevel: number;
        responses: object;
        confidence?: number;
        timeSpent: number;
        qualityScore?: number;
        submittedAt: string;
      }];
      verificationCount: number;
      requiredVerifications: number;
      isComplete: boolean;
    },
    errors: {
      404: "Task not found",
      500: "Service error"
    }
  }
  
  // Consolidate verification results
  consolidateResults: {
    request: {
      taskId: string;
    },
    response: {
      taskId: string;
      consolidatedResult: {
        status: string;
        confidence: number;
        explanations: string[];
      };
      methodology: string;
      verificationCount: number;
      workerLevels: number[];
      consolidatedAt: string;
    },
    errors: {
      404: "Task not found",
      409: "Insufficient verifications",
      500: "Service error"
    }
  }
  
  // Calculate quality score for verification
  calculateQualityScore: {
    request: {
      verificationId: string;
      consolidatedResult?: object;
    },
    response: {
      verificationId: string;
      qualityScore: number;  // 0.0 to 1.0
      factors: {
        accuracyFactor: number;
        timeFactor: number;
        consistencyFactor: number;
      };
      calculatedAt: string;
    },
    errors: {
      404: "Verification not found",
      500: "Service error"
    }
  }
}
5.2 Quality Control Service API
typescriptCopy// Quality Control Service API
interface QualityControlAPI {
  // Check for potential fraud
  checkFraudIndicators: {
    request: {
      workerId: string;
      verificationId: string;
      responses: object;
      timeSpent: number;
      metadata: {
        ipAddress?: string;
        deviceInfo?: string;
        locationInfo?: object;
      }
    },
    response: {
      workerId: string;
      verificationId: string;
      fraudScore: number;  // 0.0 to 1.0, higher means more suspicious
      flaggedPatterns: string[];
      recommendation: "accept" | "review" | "reject";
      analysisId: string;
    },
    errors: {
      400: "Invalid data",
      500: "Service error"
    }
  }
  
  // Generate golden set tasks for worker evaluation
  generateGoldenSetTask: {
    request: {
      taskType: string;
      workerLevel?: number;
    },
    response: {
      taskId: string;
      contentType: string;
      contentUrl: string;
      verificationForm: object;
      expectedResponses: object;
      difficulty: number;  // 1-5
      createdAt: string;
    },
    errors: {
      400: "Invalid parameters",
      500: "Service error"
    }
  }
  
  // Evaluate worker performance on golden set
  evaluateGoldenSetPerformance: {
    request: {
      taskId: string;
      workerId: string;
      responses: object;
      timeSpent: number;
    },
    response: {
      taskId: string;
      workerId: string;
      score: number;  // 0.0 to 1.0
      mismatches: string[];
      performanceImpact: {
        levelImpact: number;
        accuracyImpact: number;
      };
      evaluatedAt: string;
    },
    errors: {
      404: "Task not found or not a golden set task",
      500: "Service error"
    }
  }
  
  // Worker performance analytics
  getWorkerPerformanceAnalytics: {
    request: {
      workerId: string;
      timeframe?: "day" | "week" | "month" | "all";
    },
    response: {
      workerId: string;
      overallAccuracy: number;
      taskTypeBreakdown: {
        [taskType: string]: {
          count: number;
          accuracy: number;
          averageTimeSpent: number;
        }
      };
      performanceTrend: [{
        timestamp: string;
        accuracy: number;
        taskCount: number;
      }];
      qualityScore: number;
      fraudScore: number;
      analysisId: string;
    },
    errors: {
      404: "Worker not found",
      500: "Service error"
    }
  }
}