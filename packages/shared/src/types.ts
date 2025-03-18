export interface Task {
  id: string;
  type: string;
  status: TaskStatus;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
