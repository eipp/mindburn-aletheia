import { ExpertiseLevel } from '../types';

export interface DeviceFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  plugins?: string[];
  canvas?: string;
  webgl?: string;
  hardware?: {
    cpuCores?: number;
    memory?: number;
    gpu?: string;
  };
}

export interface WorkerActivity {
  workerId: string;
  taskId: string;
  taskType: string;
  decision: 'APPROVED' | 'REJECTED';
  processingTime: number;
  timestamp: number;
}

export interface WorkerMetrics {
  workerId: string;
  expertiseLevel: ExpertiseLevel;
  averageProcessingTime: number;
  decisionDistribution: {
    approved: number;
    rejected: number;
  };
  taskTypeDistribution: Record<string, number>;
  accuracyScore: number;
  accuracyHistory: number[];
  taskCompletionRate: number;
  averageQualityScore: number;
  accountAge: number;
  previousViolations: number;
  lastUpdate: number;
}

export type FraudLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface FraudDetectionResult {
  isFraudulent: boolean;
  riskScore: number;
  fraudLevel: FraudLevel;
  confidence?: number;
  reasons?: string[];
  actions?: string[];
  signals?: {
    reputation: number;
    activity: number;
    network: number;
    quality: number;
  };
}

export interface FraudDetectionConfig {
  timeWindowMinutes: number;
  maxTasksPerHour: number;
  minProcessingTimeMs: number;
  maxSimilarityScore: number;
  maxIpTaskCount: number;
  deviceFingerprintTTL: number;
  workerReputationWeight: number;
  activityPatternWeight: number;
  networkSignalsWeight: number;
  qualityMetricsWeight: number;
}

export interface RiskThresholds {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  CRITICAL: number;
}
