import { TaskType } from '../types';

export enum VerificationStrategy {
  HUMAN_CONSENSUS = 'HUMAN_CONSENSUS',
  EXPERT_WEIGHTED = 'EXPERT_WEIGHTED',
  AI_ASSISTED = 'AI_ASSISTED',
  GOLDEN_SET = 'GOLDEN_SET',
  HYBRID = 'HYBRID',
}

export enum ExpertiseLevel {
  NOVICE = 'NOVICE',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT',
  MASTER = 'MASTER',
}

export enum AIModel {
  CLAUDE = 'CLAUDE',
  GEMINI = 'GEMINI',
  CUSTOM = 'CUSTOM',
}

export interface VerificationConfig {
  strategy: VerificationStrategy;
  requiredConfidence: number;
  minVerifications: number;
  maxVerifications: number;
  timeoutSeconds: number;
  aiModels?: AIModel[];
  expertiseThreshold?: ExpertiseLevel;
  goldenSetRatio?: number;
}

export interface VerificationContext {
  taskType: TaskType;
  domainContext?: string;
  previousVerifications?: number;
  expertAvailability: boolean;
  aiAvailability: boolean;
  urgency: number;
}

export interface VerificationResult {
  decision: any;
  confidence: number;
  explanation: string;
  method: VerificationStrategy;
  contributors: {
    humans?: string[];
    experts?: string[];
    aiModels?: AIModel[];
  };
  metadata: {
    processingTime: number;
    verificationCount: number;
    consensusLevel: number;
    qualityScore: number;
  };
}

export interface ExpertWeights {
  [ExpertiseLevel.NOVICE]: number;
  [ExpertiseLevel.INTERMEDIATE]: number;
  [ExpertiseLevel.EXPERT]: number;
  [ExpertiseLevel.MASTER]: number;
}

export interface AIModelConfig {
  model: AIModel;
  endpoint: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttlSeconds: number;
  maxSize: number;
  similarityThreshold: number;
}

export interface DeviceFingerprint {
  userAgent: string;
  screenResolution: string;
  colorDepth: number;
  timezone: string;
  language: string;
  platform: string;
  plugins: string[];
  canvas: string;
  webgl: string;
  fonts: string[];
  audio: string;
  hardware: {
    cpuCores: number;
    memory: number;
    gpu: string;
  };
}

export interface WorkerActivity {
  workerId: string;
  taskId: string;
  taskType: string;
  action: string;
  timestamp: number;
  processingTime: number;
  deviceFingerprint: DeviceFingerprint;
  ipAddress: string;
  metadata: Record<string, any>;
}

export interface FraudDetectionResult {
  isFraudulent: boolean;
  riskScore: number;
  fraudLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actions: string[];
  signals: {
    reputation: number;
    activity: number;
    network: number;
    quality: number;
  };
}

export interface WorkerMetrics {
  workerId: string;
  accuracyHistory: number[];
  taskCompletionRate: number;
  averageQualityScore: number;
  accountAge: number;
  previousViolations: number;
  expertiseLevel: ExpertiseLevel;
  specializations: string[];
  reputationScore: number;
  lastUpdate: number;
}

export interface TaskSubmission {
  taskId: string;
  workerId: string;
  taskType: string;
  content: any;
  result: any;
  confidence: number;
  processingTime: number;
  timestamp: number;
  metadata: {
    deviceFingerprint: DeviceFingerprint;
    ipAddress: string;
    complexity: number;
  };
}

export interface QualityControlResult {
  qualityScore: number;
  qualityLevel: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR';
  recommendations: string[];
  metrics: {
    accuracy: number;
    consistency: number;
    timeQuality: number;
    peerReview: number;
  };
}

export interface GoldenSetTask {
  taskId: string;
  taskType: string;
  content: any;
  expectedResult: any;
  evaluationCriteria: {
    accuracy: number;
    timeRange: {
      min: number;
      max: number;
    };
    requiredEvidence: string[];
    specialRules: Record<string, any>;
  };
}

export interface DashboardMetrics {
  fraudMetrics: FraudMetrics;
  qualityMetrics: QualityMetrics;
  workerStats: WorkerStats;
  trends: TrendAnalysis;
  lastUpdated: Date;
}

export interface FraudMetrics {
  totalFraudAttempts: number;
  averageRiskScore: number;
  suspiciousAccounts: number;
  fraudPatterns: any;
  riskDistribution: any;
  temporalAnalysis: any;
}

export interface QualityMetrics {
  averageQualityScore: number;
  goldenSetAccuracy: number;
  peerReviewAgreement: number;
  qualityDistribution: any;
  taskTypeAnalysis: any;
  timeBasedAnalysis: any;
}

export interface WorkerStats {
  totalActiveWorkers: number;
  expertiseDistribution: any;
  performanceQuartiles: any;
  taskCompletionStats: any;
  qualityProgression: any;
}

export interface TrendAnalysis {
  fraudTrends: any;
  qualityTrends: any;
  correlations: any;
  anomalies: any;
  predictions: any;
}

export interface QualityMetrics {
  qualityScore: number;
  accuracyScore: number;
  consistencyScore: number;
  timeQualityScore: number;
  peerReviewScore: number;
  timestamp: number;
}
