export interface WorkerSubmission {
  submissionId: string;
  workerId: string;
  taskId: string;
  result: any;
  startedAt: number;
  completedAt: number;
  metadata?: Record<string, any>;
}

export interface VerificationTask {
  taskId: string;
  type: string;
  data: any;
  consensusStrategy: ConsensusStrategy;
  requirements: {
    minSubmissions: number;
    qualityThreshold: number;
    timeLimit?: number;
    workerLevel?: WorkerLevel;
  };
  metadata?: Record<string, any>;
}

export interface VerificationResult {
  taskId: string;
  status: VerificationStatus;
  consensus: any;
  confidenceLevel: ConfidenceLevel;
  workerMetrics: QualityMetrics[];
  fraudDetection: FraudDetectionResult;
  processedAt: string;
  metadata?: Record<string, any>;
}

export interface QualityMetrics {
  workerId: string;
  submissionId: string;
  accuracy: number;
  timeSpent: number;
  consistencyScore: number;
}

export interface WorkerMetrics {
  workerId: string;
  accuracy: number;
  consistency: number;
  speedScore: number;
  reputationScore: number;
  averageTaskTime: number;
  currentTaskType: string;
}

export interface QualityScore {
  overall: number;
  accuracy: number;
  consistency: number;
  speedScore: number;
  accuracyTrend: number;
}

export interface PerformanceHistory {
  workerId: string;
  totalTasks: number;
  recentTasks: Array<{
    taskId: string;
    accuracy: number;
    timeSpent: number;
  }>;
  taskTypeAverages: Record<string, number>;
}

export interface QualityThresholds {
  accuracy: {
    low: number;
    medium: number;
    high: number;
  };
  consistency: {
    low: number;
    medium: number;
    high: number;
  };
  speedScore: {
    slow: number;
    medium: number;
    fast: number;
  };
}

export type FraudSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface SuspiciousActivity {
  type: 'SUSPICIOUS_BID_PATTERN' | 'WORKER_COLLUSION' | 'AUTOMATED_BIDDING';
  description: string;
  evidence: FraudPattern[];
  severity: FraudSeverity;
}

export interface FraudPattern {
  workerId: string;
  type: 'REPEATED_SUBMISSIONS' | 'TIMING_PATTERN' | 'ANSWER_PATTERN';
  submissionIds: string[];
  confidence: number;
}

export interface WorkerBehavior {
  workerId: string;
  riskScore: number;
  patterns: FraudPattern[];
  lastAnalysis: string;
}

export interface FraudDetectionResult {
  hasSuspiciousActivity: boolean;
  suspiciousActivities: SuspiciousActivity[];
  riskLevel: FraudSeverity;
  workerBehaviorAnalysis: WorkerBehavior[];
  timestamp: string;
}

export enum ConsensusStrategy {
  MAJORITY = 'MAJORITY',
  WEIGHTED = 'WEIGHTED',
  UNANIMOUS = 'UNANIMOUS'
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  NEEDS_REVIEW = 'NEEDS_REVIEW'
}

export enum ConfidenceLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export enum WorkerLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT'
}

export interface WorkerProfile {
  workerId: string;
  status: WorkerStatus;
  level: WorkerLevel;
  skills: TaskType[];
  skillLevels: Record<TaskType, number>;
  reputationScore: number;
  performanceMetrics: {
    accuracy?: number;
    speed?: number;
    consistency?: number;
    taskCount?: number;
    successRate?: number;
  };
  activityMetrics?: WorkerActivityMetrics;
  statusHistory?: WorkerStatusChange[];
  metadata?: {
    telegramId?: string;
    language?: string;
    onboarding?: OnboardingMetadata;
    telegramVerification?: {
      status: 'VERIFIED' | 'PENDING' | 'REJECTED';
      timestamp: string;
      data: any;
    };
    wallet?: {
      address: string;
      verified: boolean;
      connectedAt: string;
    };
    identityVerification?: IdentityVerification;
    guidelinesAcceptance?: {
      accepted: boolean;
      timestamp: string;
      version: string;
    };
    lastSkillAssessment?: {
      timestamp: string;
      results: Record<TaskType, SkillAssessmentResult>;
    };
  };
}

export interface SkillAssessmentResult {
  taskType: TaskType;
  score: number;
  details: {
    accuracy: number;
    speed: number;
    consistency: number;
  };
  timestamp: string;
}

export interface AssessmentTask {
  taskType: TaskType;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  data: any;
  expectedResult: any;
  timeLimit: number;
}

export interface TaskAssignment {
  taskId: string;
  workerId: string;
  assignedAt: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | 'EXPIRED';
  expiresAt: number;
  metadata?: Record<string, any>;
}

export interface AssignmentResult {
  success: boolean;
  assignments: TaskAssignment[];
  reason?: string;
  metadata?: Record<string, any>;
}

export interface WorkerMatch {
  worker: WorkerProfile;
  score: number;
}

export enum TaskDistributionStrategy {
  BROADCAST = 'BROADCAST',
  TARGETED = 'TARGETED',
  AUCTION = 'AUCTION'
}

export enum MatchingStrategy {
  BALANCED = 'BALANCED',
  SKILL_FOCUSED = 'SKILL_FOCUSED',
  REPUTATION_FOCUSED = 'REPUTATION_FOCUSED',
  PERFORMANCE_FOCUSED = 'PERFORMANCE_FOCUSED'
}

export enum TaskPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export enum WorkerStatus {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  OFFLINE = 'OFFLINE',
  SUSPENDED = 'SUSPENDED'
}

export type TaskType = 
  | 'TEXT_CLASSIFICATION'
  | 'IMAGE_CLASSIFICATION'
  | 'SENTIMENT_ANALYSIS'
  | 'ENTITY_RECOGNITION'
  | 'DATA_VALIDATION'
  | 'CONTENT_MODERATION'
  | 'TRANSLATION_VERIFICATION'
  | 'AUDIO_TRANSCRIPTION'
  | 'VIDEO_ANNOTATION'
  | 'DOCUMENT_VERIFICATION';

export interface AuctionBid {
  workerId: string;
  amount: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface AuctionConfig {
  minBid: number;
  maxBid: number;
  duration: number;
  minParticipants: number;
  bidIncrement: number;
  metadata?: Record<string, any>;
}

export interface AuctionResult {
  auctionId: string;
  taskId: string;
  winners: Array<{
    workerId: string;
    winningBid: number;
  }>;
  totalBids: number;
  startTime: number;
  endTime: number;
  metadata?: Record<string, any>;
}

export enum AuctionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED'
}

export type TaskStatus =
  | 'CREATED'
  | 'PENDING_DISTRIBUTION'
  | 'DISTRIBUTED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'NEEDS_REVISION'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'ARCHIVED';

export interface TaskEvent {
  taskId: string;
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  timestamp: string;
  metadata?: Record<string, any>;
}

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_EXPIRED'
  | 'AUCTION_STARTED'
  | 'AUCTION_WON'
  | 'PAYMENT_RECEIVED'
  | 'STATUS_CHANGE'
  | 'WORKLOAD_WARNING'
  | 'PERFORMANCE_ALERT'
  | 'ONBOARDING_STARTED'
  | 'ONBOARDING_STEP_COMPLETED'
  | 'ONBOARDING_COMPLETED';

export type NotificationTemplate =
  | 'TASK_ASSIGNMENT'
  | 'TASK_EXPIRATION'
  | 'AUCTION_ANNOUNCEMENT'
  | 'AUCTION_RESULT'
  | 'PAYMENT_CONFIRMATION'
  | 'STATUS_UPDATE'
  | 'WORKLOAD_WARNING'
  | 'PERFORMANCE_ALERT';

export type NotificationChannel =
  | 'TELEGRAM'
  | 'SNS'
  | 'EMAIL'
  | 'SMS';

export type NotificationPriority =
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW';

export interface VerificationTask {
  taskId: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  lastUpdated: string;
  requirements: {
    minSubmissions: number;
    minReputation?: number;
    workerLevel?: WorkerLevel;
  };
  statusHistory?: TaskEvent[];
  metadata?: Record<string, any>;
}

export class TaskTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskTransitionError';
  }
}

export interface WorkerActivityMetrics {
  activeTime: number;
  taskCount: number;
  lastActive: string;
  currentTask?: string;
  dailyStats: {
    date: string;
    taskCount: number;
    activeTime: number;
    averageTaskTime: number;
  }[];
  weeklyStats: {
    taskCount: number;
    activeTime: number;
    completionRate: number;
  };
}

export interface PerformanceAlert {
  workerId: string;
  type: 'INACTIVITY' | 'LOW_ACCURACY' | 'SLOW_COMPLETION' | 'HIGH_REJECTION';
  details: string;
  timestamp: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  metadata?: Record<string, any>;
}

export interface WorkerStatusChange {
  from: WorkerStatus;
  to: WorkerStatus;
  timestamp: string;
  reason?: string;
}

export interface OnboardingMetadata {
  started: string;
  completed?: string;
  currentStep: string;
  steps: OnboardingStep[];
}

export interface OnboardingStep {
  step: string;
  completed: boolean;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface IdentityVerification {
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  method: 'TELEGRAM' | 'TON_WALLET';
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface WalletVerification {
  address: string;
  verified: boolean;
  balance: number;
  lastChecked: string;
} 