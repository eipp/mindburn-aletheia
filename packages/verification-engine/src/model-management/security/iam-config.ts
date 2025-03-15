import { IAM } from 'aws-sdk';
import { z } from 'zod';

const IAMConfigSchema = z.object({
  region: z.string(),
  accountId: z.string(),
  environment: z.string(),
});

export class IAMConfig {
  private iam: IAM;
  private config: z.infer<typeof IAMConfigSchema>;

  constructor(config: z.infer<typeof IAMConfigSchema>) {
    this.config = IAMConfigSchema.parse(config);
    this.iam = new IAM({ region: config.region });
  }

  async createModelAccessRole(modelId: string): Promise<string> {
    const roleName = `model-access-${modelId}-${this.config.environment}`;
    
    const assumeRolePolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: 'lambda.amazonaws.com',
            AWS: `arn:aws:iam::${this.config.accountId}:root`,
          },
          Action: 'sts:AssumeRole',
          Condition: {
            StringEquals: {
              'aws:RequestedRegion': this.config.region,
              'aws:PrincipalTag/service': 'model-management',
            },
          },
        },
      ],
    };

    const role = await this.iam.createRole({
      RoleName: roleName,
      AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicy),
      Tags: [
        {
          Key: 'service',
          Value: 'model-management',
        },
        {
          Key: 'environment',
          Value: this.config.environment,
        },
        {
          Key: 'modelId',
          Value: modelId,
        },
      ],
    }).promise();

    await this.attachModelAccessPolicy(roleName, modelId);
    return role.Role.Arn;
  }

  private async attachModelAccessPolicy(roleName: string, modelId: string): Promise<void> {
    const policyName = `model-access-${modelId}-${this.config.environment}`;
    
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'dynamodb:GetItem',
            'dynamodb:Query',
            'dynamodb:UpdateItem',
          ],
          Resource: [
            `arn:aws:dynamodb:${this.config.region}:${this.config.accountId}:table/models`,
            `arn:aws:dynamodb:${this.config.region}:${this.config.accountId}:table/models/index/*`,
          ],
          Condition: {
            StringEquals: {
              'dynamodb:LeadingKeys': [modelId],
            },
          },
        },
        {
          Effect: 'Allow',
          Action: [
            's3:GetObject',
            's3:PutObject',
          ],
          Resource: [
            `arn:aws:s3:::model-artifacts-${this.config.environment}/${modelId}/*`,
          ],
        },
        {
          Effect: 'Allow',
          Action: [
            'kms:Decrypt',
            'kms:GenerateDataKey',
          ],
          Resource: '*',
          Condition: {
            StringEquals: {
              'kms:ViaService': `s3.${this.config.region}.amazonaws.com`,
            },
            StringLike: {
              'kms:EncryptionContext:aws:s3:arn': [
                `arn:aws:s3:::model-artifacts-${this.config.environment}/${modelId}/*`,
              ],
            },
          },
        },
        {
          Effect: 'Allow',
          Action: [
            'cloudwatch:PutMetricData',
          ],
          Resource: '*',
          Condition: {
            StringEquals: {
              'cloudwatch:namespace': 'ModelManagement',
            },
          },
        },
      ],
    };

    const createdPolicy = await this.iam.createPolicy({
      PolicyName: policyName,
      PolicyDocument: JSON.stringify(policy),
    }).promise();

    await this.iam.attachRolePolicy({
      RoleName: roleName,
      PolicyArn: createdPolicy.Policy.Arn,
    }).promise();
  }

  async createModelAdminRole(): Promise<string> {
    const roleName = `model-admin-${this.config.environment}`;
    
    const assumeRolePolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            AWS: `arn:aws:iam::${this.config.accountId}:root`,
          },
          Action: 'sts:AssumeRole',
          Condition: {
            StringEquals: {
              'aws:PrincipalTag/role': 'model-admin',
            },
          },
        },
      ],
    };

    const role = await this.iam.createRole({
      RoleName: roleName,
      AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicy),
      Tags: [
        {
          Key: 'service',
          Value: 'model-management',
        },
        {
          Key: 'environment',
          Value: this.config.environment,
        },
        {
          Key: 'role',
          Value: 'admin',
        },
      ],
    }).promise();

    await this.attachModelAdminPolicy(roleName);
    return role.Role.Arn;
  }

  private async attachModelAdminPolicy(roleName: string): Promise<void> {
    const policyName = `model-admin-${this.config.environment}`;
    
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'dynamodb:*',
          ],
          Resource: [
            `arn:aws:dynamodb:${this.config.region}:${this.config.accountId}:table/models`,
            `arn:aws:dynamodb:${this.config.region}:${this.config.accountId}:table/models/index/*`,
          ],
        },
        {
          Effect: 'Allow',
          Action: [
            's3:*',
          ],
          Resource: [
            `arn:aws:s3:::model-artifacts-${this.config.environment}`,
            `arn:aws:s3:::model-artifacts-${this.config.environment}/*`,
          ],
        },
        {
          Effect: 'Allow',
          Action: [
            'kms:*',
          ],
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: [
            'cloudwatch:*',
          ],
          Resource: '*',
          Condition: {
            StringEquals: {
              'cloudwatch:namespace': 'ModelManagement',
            },
          },
        },
        {
          Effect: 'Allow',
          Action: [
            'cognito-idp:*',
          ],
          Resource: [
            `arn:aws:cognito-idp:${this.config.region}:${this.config.accountId}:userpool/*`,
          ],
        },
      ],
    };

    const createdPolicy = await this.iam.createPolicy({
      PolicyName: policyName,
      PolicyDocument: JSON.stringify(policy),
    }).promise();

    await this.iam.attachRolePolicy({
      RoleName: roleName,
      PolicyArn: createdPolicy.Policy.Arn,
    }).promise();
  }
} 