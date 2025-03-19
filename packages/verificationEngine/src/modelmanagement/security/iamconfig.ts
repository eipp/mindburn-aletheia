import {
  IAMService,
  LoggerService,
  EventBus,
  IAMConfig,
  PolicyDocument,
  createConfigValidator,
  z,
} from '@mindburn/shared';

const IAMConfigSchema = z.object({
  region: z.string(),
  rolePrefix: z.string(),
  policyPrefix: z.string(),
  maxPolicyVersions: z.number().min(1).max(5),
});

const defaultConfig: IAMConfig = {
  region: 'us-east-1',
  rolePrefix: 'model-',
  policyPrefix: 'model-policy-',
  maxPolicyVersions: 5,
};

const envMap = {
  region: 'AWS_REGION',
  rolePrefix: 'MODEL_ROLE_PREFIX',
  policyPrefix: 'MODEL_POLICY_PREFIX',
  maxPolicyVersions: 'MODEL_MAX_POLICY_VERSIONS',
};

export const validateConfig = createConfigValidator({
  schema: IAMConfigSchema,
  defaultConfig,
  envMap,
});

export const getConfig = () => validateConfig({});

export class ModelIAMService {
  private iamService: IAMService;
  private logger: LoggerService;
  private eventBus: EventBus;
  private config: IAMConfig;

  constructor() {
    this.config = getConfig();
    this.iamService = new IAMService(this.config);
    this.logger = new LoggerService();
    this.eventBus = new EventBus();
  }

  async createModelRole(modelId: string, policy: PolicyDocument): Promise<string> {
    try {
      this.logger.info('Creating model role', { modelId });

      const roleName = `${this.config.rolePrefix}${modelId}`;
      const roleArn = await this.iamService.createRole(roleName, {
        AssumeRolePolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
              Action: 'sts:AssumeRole',
            },
          ],
        }),
        Tags: [
          {
            Key: 'ModelId',
            Value: modelId,
          },
        ],
      });

      await this.iamService.putRolePolicy(
        roleName,
        `${this.config.policyPrefix}${modelId}`,
        policy
      );

      await this.eventBus.emit('model.iam.role_created', {
        modelId,
        roleName,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Model role created successfully', { modelId, roleArn });
      return roleArn;
    } catch (error) {
      this.logger.error('Failed to create model role', { modelId, error });
      throw error;
    }
  }

  async updateModelPolicy(modelId: string, policy: PolicyDocument): Promise<void> {
    try {
      this.logger.info('Updating model policy', { modelId });

      const roleName = `${this.config.rolePrefix}${modelId}`;
      const policyName = `${this.config.policyPrefix}${modelId}`;

      await this.iamService.putRolePolicy(roleName, policyName, policy);

      await this.eventBus.emit('model.iam.policy_updated', {
        modelId,
        policyName,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Model policy updated successfully', { modelId });
    } catch (error) {
      this.logger.error('Failed to update model policy', { modelId, error });
      throw error;
    }
  }

  async deleteModelRole(modelId: string): Promise<void> {
    try {
      this.logger.info('Deleting model role', { modelId });

      const roleName = `${this.config.rolePrefix}${modelId}`;
      const policyName = `${this.config.policyPrefix}${modelId}`;

      await this.iamService.deleteRolePolicy(roleName, policyName);
      await this.iamService.deleteRole(roleName);

      await this.eventBus.emit('model.iam.role_deleted', {
        modelId,
        roleName,
        timestamp: new Date().toISOString(),
      });

      this.logger.info('Model role deleted successfully', { modelId });
    } catch (error) {
      this.logger.error('Failed to delete model role', { modelId, error });
      throw error;
    }
  }

  async validateModelAccess(modelId: string, userId: string): Promise<boolean> {
    try {
      this.logger.info('Validating model access', { modelId, userId });

      const roleName = `${this.config.rolePrefix}${modelId}`;
      const result = await this.iamService.simulatePrincipalPolicy(roleName, [
        {
          Action: 'model:Access',
          Resource: `arn:aws:model:::${modelId}`,
          Context: {
            'aws:userId': userId,
          },
        },
      ]);

      const hasAccess = result.EvaluationResults?.[0]?.EvalDecision === 'allowed';

      if (!hasAccess) {
        this.logger.warn('Access denied to model', { modelId, userId });
        await this.eventBus.emit('model.iam.access_denied', {
          modelId,
          userId,
          timestamp: new Date().toISOString(),
        });
      }

      return hasAccess;
    } catch (error) {
      this.logger.error('Failed to validate model access', { modelId, userId, error });
      throw error;
    }
  }
}
