import { z } from 'zod';
import {
  createConfigValidator,
  createEnvironmentTransformer,
  createSecurityValidator,
  createPerformanceValidator,
} from '@mindburn/shared';

export interface ApprovalStage {
  name: string;
  requiredApprovers: number;
  allowedRoles: string[];
  autoExpire: boolean;
  expirationHours: number;
}

export interface ApprovalWorkflowConfig {
  enabled: boolean;
  stages: ApprovalStage[];
  parallelApproval: boolean;
  autoRevert: boolean;
  notificationChannels: {
    email: boolean;
    slack: boolean;
    teams: boolean;
  };
  approvalExpiration: {
    enabled: boolean;
    durationHours: number;
  };
  auditSettings: {
    logApprovalEvents: boolean;
    retainHistoryDays: number;
    requireComments: boolean;
  };
  emergencyBypass: {
    enabled: boolean;
    requiredApprovers: number;
    allowedRoles: string[];
  };
}

const defaultConfig: ApprovalWorkflowConfig = {
  enabled: true,
  stages: [
    {
      name: 'technical_review',
      requiredApprovers: 1,
      allowedRoles: ['senior_engineer', 'tech_lead'],
      autoExpire: true,
      expirationHours: 48,
    },
    {
      name: 'business_review',
      requiredApprovers: 1,
      allowedRoles: ['product_manager', 'business_analyst'],
      autoExpire: true,
      expirationHours: 72,
    },
  ],
  parallelApproval: false,
  autoRevert: true,
  notificationChannels: {
    email: true,
    slack: true,
    teams: false,
  },
  approvalExpiration: {
    enabled: true,
    durationHours: 72,
  },
  auditSettings: {
    logApprovalEvents: true,
    retainHistoryDays: 90,
    requireComments: true,
  },
  emergencyBypass: {
    enabled: true,
    requiredApprovers: 2,
    allowedRoles: ['admin', 'emergency_approver'],
  },
};

const ApprovalStageSchema = z.object({
  name: z.string(),
  requiredApprovers: z.number().min(1),
  allowedRoles: z.array(z.string()),
  autoExpire: z.boolean(),
  expirationHours: z.number().min(1),
});

const ApprovalWorkflowSchema = z.object({
  enabled: z.boolean(),
  stages: z.array(ApprovalStageSchema),
  parallelApproval: z.boolean(),
  autoRevert: z.boolean(),
  notificationChannels: z.object({
    email: z.boolean(),
    slack: z.boolean(),
    teams: z.boolean(),
  }),
  approvalExpiration: z.object({
    enabled: z.boolean(),
    durationHours: z.number().min(1),
  }),
  auditSettings: z.object({
    logApprovalEvents: z.boolean(),
    retainHistoryDays: z.number().min(1),
    requireComments: z.boolean(),
  }),
  emergencyBypass: z.object({
    enabled: z.boolean(),
    requiredApprovers: z.number().min(1),
    allowedRoles: z.array(z.string()),
  }),
});

const envMap: Record<string, string> = {
  enabled: 'APPROVAL_WORKFLOW_ENABLED',
  parallelApproval: 'PARALLEL_APPROVAL',
  autoRevert: 'AUTO_REVERT',
  'notificationChannels.email': 'NOTIFY_EMAIL',
  'notificationChannels.slack': 'NOTIFY_SLACK',
  'notificationChannels.teams': 'NOTIFY_TEAMS',
  'approvalExpiration.enabled': 'APPROVAL_EXPIRATION_ENABLED',
  'approvalExpiration.durationHours': 'APPROVAL_EXPIRATION_HOURS',
  'auditSettings.logApprovalEvents': 'LOG_APPROVAL_EVENTS',
  'auditSettings.retainHistoryDays': 'RETAIN_HISTORY_DAYS',
  'auditSettings.requireComments': 'REQUIRE_COMMENTS',
  'emergencyBypass.enabled': 'EMERGENCY_BYPASS_ENABLED',
  'emergencyBypass.requiredApprovers': 'EMERGENCY_APPROVERS_REQUIRED',
};

export const validateConfig = createConfigValidator<ApprovalWorkflowConfig>({
  schema: ApprovalWorkflowSchema,
  defaultConfig,
  transformers: [createEnvironmentTransformer(envMap)],
  validators: [
    createSecurityValidator(['emergencyBypass.allowedRoles']),
    createPerformanceValidator({
      'approvalExpiration.durationHours': 168, // 1 week
      'auditSettings.retainHistoryDays': 180,
    }),
  ],
});

export function getConfig(): ApprovalWorkflowConfig {
  return validateConfig({});
}
