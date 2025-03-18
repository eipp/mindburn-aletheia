export enum ExpertiseLevel {
  NOVICE = 'NOVICE',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT',
  MASTER = 'MASTER'
}

export enum VerificationType {
  HUMAN = 'HUMAN',
  AI = 'AI',
  HYBRID = 'HYBRID',
  GOLDEN_SET = 'GOLDEN_SET',
  EXPERT = 'EXPERT'
}

export enum TaskStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED'
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface VerificationResult {
  taskId: string;
  workerId?: string;
  verifierType: VerificationType;
  decision: 'APPROVED' | 'REJECTED';
  confidence: number;
  processingTime: number;
  metadata: Record<string, any>;
  timestamp: number;
} 