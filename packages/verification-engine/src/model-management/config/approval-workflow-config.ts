import { z } from 'zod';

export const ApprovalStageSchema = z.object({
  name: z.string(),
  requiredApprovers: z.number().min(1),
  autoTransition: z.boolean(),
  timeoutHours: z.number().min(1),
  requiredChecks: z.array(z.string()),
  notificationTargets: z.array(z.string()),
  approverRoles: z.array(z.string()),
});

export const ApprovalWorkflowConfigSchema = z.object({
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

export type ApprovalStage = z.infer<typeof ApprovalStageSchema>;
export type ApprovalWorkflowConfig = z.infer<typeof ApprovalWorkflowConfigSchema>;

export const defaultConfig: ApprovalWorkflowConfig = {
  enabled: true,
  stages: [
    {
      name: 'technical_review',
      requiredApprovers: 1,
      autoTransition: true,
      timeoutHours: 24,
      requiredChecks: [
        'unit_tests',
        'integration_tests',
        'performance_benchmarks',
      ],
      notificationTargets: ['ml_engineers', 'tech_leads'],
      approverRoles: ['ml_engineer', 'tech_lead'],
    },
    {
      name: 'security_review',
      requiredApprovers: 1,
      autoTransition: false,
      timeoutHours: 48,
      requiredChecks: [
        'security_scan',
        'vulnerability_assessment',
        'compliance_check',
      ],
      notificationTargets: ['security_team'],
      approverRoles: ['security_engineer', 'security_lead'],
    },
    {
      name: 'business_review',
      requiredApprovers: 1,
      autoTransition: false,
      timeoutHours: 72,
      requiredChecks: [
        'business_impact_assessment',
        'cost_analysis',
        'risk_assessment',
      ],
      notificationTargets: ['product_owners', 'business_stakeholders'],
      approverRoles: ['product_owner', 'business_lead'],
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
    durationHours: 168, // 1 week
  },
  auditSettings: {
    logApprovalEvents: true,
    retainHistoryDays: 365,
    requireComments: true,
  },
  emergencyBypass: {
    enabled: true,
    requiredApprovers: 2,
    allowedRoles: ['emergency_approver', 'service_owner'],
  },
};

export function validateConfig(config: Partial<ApprovalWorkflowConfig>): ApprovalWorkflowConfig {
  const mergedConfig = {
    ...defaultConfig,
    ...config,
    stages: config.stages || defaultConfig.stages,
    notificationChannels: {
      ...defaultConfig.notificationChannels,
      ...config.notificationChannels,
    },
    approvalExpiration: {
      ...defaultConfig.approvalExpiration,
      ...config.approvalExpiration,
    },
    auditSettings: {
      ...defaultConfig.auditSettings,
      ...config.auditSettings,
    },
    emergencyBypass: {
      ...defaultConfig.emergencyBypass,
      ...config.emergencyBypass,
    },
  };
  return ApprovalWorkflowConfigSchema.parse(mergedConfig);
}

export function getEnvironmentConfig(): ApprovalWorkflowConfig {
  const envConfig: Partial<ApprovalWorkflowConfig> = {
    enabled: process.env.APPROVAL_WORKFLOW_ENABLED === 'true',
    parallelApproval: process.env.PARALLEL_APPROVAL === 'true',
    autoRevert: process.env.AUTO_REVERT === 'true',
    notificationChannels: {
      email: process.env.NOTIFY_EMAIL === 'true',
      slack: process.env.NOTIFY_SLACK === 'true',
      teams: process.env.NOTIFY_TEAMS === 'true',
    },
    approvalExpiration: {
      enabled: process.env.APPROVAL_EXPIRATION_ENABLED === 'true',
      durationHours: process.env.APPROVAL_EXPIRATION_HOURS 
        ? parseInt(process.env.APPROVAL_EXPIRATION_HOURS, 10)
        : defaultConfig.approvalExpiration.durationHours,
    },
    emergencyBypass: {
      enabled: process.env.EMERGENCY_BYPASS_ENABLED === 'true',
      requiredApprovers: process.env.EMERGENCY_APPROVERS_REQUIRED
        ? parseInt(process.env.EMERGENCY_APPROVERS_REQUIRED, 10)
        : defaultConfig.emergencyBypass.requiredApprovers,
    },
  };

  return validateConfig(envConfig);
} 