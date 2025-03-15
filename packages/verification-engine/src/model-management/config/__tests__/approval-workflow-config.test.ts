import { validateConfig, getEnvironmentConfig, defaultConfig } from '../approval-workflow-config';

describe('ApprovalWorkflowConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateConfig', () => {
    it('should validate a complete config', () => {
      const config = validateConfig(defaultConfig);
      expect(config).toEqual(defaultConfig);
    });

    it('should merge partial config with defaults', () => {
      const partialConfig = {
        enabled: false,
        parallelApproval: true,
      };

      const config = validateConfig(partialConfig);
      expect(config).toEqual({
        ...defaultConfig,
        ...partialConfig,
      });
    });

    it('should validate approval stages', () => {
      const configWithStages = {
        ...defaultConfig,
        stages: [
          {
            name: 'custom_review',
            requiredApprovers: 2,
            autoTransition: false,
            timeoutHours: 12,
            requiredChecks: ['custom_check'],
            notificationTargets: ['custom_team'],
            approverRoles: ['custom_role'],
          },
        ],
      };

      const config = validateConfig(configWithStages);
      expect(config.stages).toHaveLength(1);
      expect(config.stages[0].name).toBe('custom_review');
      expect(config.stages[0].requiredApprovers).toBe(2);
    });

    it('should throw error for invalid stage configuration', () => {
      const invalidConfig = {
        ...defaultConfig,
        stages: [
          {
            name: 'invalid_stage',
            requiredApprovers: 0,
            autoTransition: false,
            timeoutHours: 0,
            requiredChecks: [],
            notificationTargets: [],
            approverRoles: [],
          },
        ],
      };

      expect(() => validateConfig(invalidConfig)).toThrow();
    });

    it('should validate notification channels', () => {
      const configWithNotifications = {
        ...defaultConfig,
        notificationChannels: {
          email: false,
          slack: true,
          teams: true,
        },
      };

      const config = validateConfig(configWithNotifications);
      expect(config.notificationChannels.email).toBe(false);
      expect(config.notificationChannels.slack).toBe(true);
      expect(config.notificationChannels.teams).toBe(true);
    });

    it('should validate emergency bypass settings', () => {
      const configWithEmergency = {
        ...defaultConfig,
        emergencyBypass: {
          enabled: true,
          requiredApprovers: 3,
          allowedRoles: ['super_admin'],
        },
      };

      const config = validateConfig(configWithEmergency);
      expect(config.emergencyBypass.requiredApprovers).toBe(3);
      expect(config.emergencyBypass.allowedRoles).toEqual(['super_admin']);
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should use environment variables when available', () => {
      process.env.APPROVAL_WORKFLOW_ENABLED = 'true';
      process.env.PARALLEL_APPROVAL = 'true';
      process.env.AUTO_REVERT = 'false';
      process.env.NOTIFY_EMAIL = 'true';
      process.env.NOTIFY_SLACK = 'false';
      process.env.NOTIFY_TEAMS = 'true';
      process.env.APPROVAL_EXPIRATION_ENABLED = 'true';
      process.env.APPROVAL_EXPIRATION_HOURS = '48';
      process.env.EMERGENCY_BYPASS_ENABLED = 'true';
      process.env.EMERGENCY_APPROVERS_REQUIRED = '3';

      const config = getEnvironmentConfig();

      expect(config.enabled).toBe(true);
      expect(config.parallelApproval).toBe(true);
      expect(config.autoRevert).toBe(false);
      expect(config.notificationChannels.email).toBe(true);
      expect(config.notificationChannels.slack).toBe(false);
      expect(config.notificationChannels.teams).toBe(true);
      expect(config.approvalExpiration.enabled).toBe(true);
      expect(config.approvalExpiration.durationHours).toBe(48);
      expect(config.emergencyBypass.enabled).toBe(true);
      expect(config.emergencyBypass.requiredApprovers).toBe(3);
    });

    it('should use default values when environment variables are not set', () => {
      const config = getEnvironmentConfig();

      expect(config.enabled).toBe(defaultConfig.enabled);
      expect(config.parallelApproval).toBe(defaultConfig.parallelApproval);
      expect(config.autoRevert).toBe(defaultConfig.autoRevert);
      expect(config.notificationChannels).toEqual(defaultConfig.notificationChannels);
      expect(config.approvalExpiration).toEqual(defaultConfig.approvalExpiration);
      expect(config.emergencyBypass).toEqual(defaultConfig.emergencyBypass);
    });

    it('should handle invalid environment variable values', () => {
      process.env.APPROVAL_EXPIRATION_HOURS = 'invalid';
      process.env.EMERGENCY_APPROVERS_REQUIRED = '-1';

      const config = getEnvironmentConfig();
      expect(config.approvalExpiration.durationHours).toBe(defaultConfig.approvalExpiration.durationHours);
      expect(config.emergencyBypass.requiredApprovers).toBe(defaultConfig.emergencyBypass.requiredApprovers);
    });
  });
}); 