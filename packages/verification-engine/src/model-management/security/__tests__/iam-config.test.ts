import { IAMConfig } from '../iam-config';
import { IAM } from 'aws-sdk';
import { mockClient } from 'aws-sdk-client-mock';

jest.mock('aws-sdk');

describe('IAMConfig', () => {
  const iamMock = mockClient(IAM);
  const config = {
    region: 'us-east-1',
    accountId: '123456789012',
    environment: 'test',
  };

  beforeEach(() => {
    iamMock.reset();
  });

  describe('createModelAccessRole', () => {
    it('should create role and attach policy for model access', async () => {
      const modelId = 'test-model-1';
      const iamConfig = new IAMConfig(config);

      iamMock.on(IAM.CreateRole).resolves({
        Role: {
          Arn: `arn:aws:iam::${config.accountId}:role/model-access-${modelId}-${config.environment}`,
        },
      });

      iamMock.on(IAM.CreatePolicy).resolves({
        Policy: {
          Arn: `arn:aws:iam::${config.accountId}:policy/model-access-${modelId}-${config.environment}`,
        },
      });

      iamMock.on(IAM.AttachRolePolicy).resolves({});

      const roleArn = await iamConfig.createModelAccessRole(modelId);

      expect(roleArn).toBe(`arn:aws:iam::${config.accountId}:role/model-access-${modelId}-${config.environment}`);
      expect(iamMock.commandCalls(IAM.CreateRole)).toHaveLength(1);
      expect(iamMock.commandCalls(IAM.CreatePolicy)).toHaveLength(1);
      expect(iamMock.commandCalls(IAM.AttachRolePolicy)).toHaveLength(1);

      const createRoleCall = iamMock.commandCalls(IAM.CreateRole)[0];
      expect(createRoleCall.args[0].input).toMatchObject({
        RoleName: `model-access-${modelId}-${config.environment}`,
        Tags: expect.arrayContaining([
          { Key: 'service', Value: 'model-management' },
          { Key: 'environment', Value: config.environment },
          { Key: 'modelId', Value: modelId },
        ]),
      });

      const createPolicyCall = iamMock.commandCalls(IAM.CreatePolicy)[0];
      const policyDoc = JSON.parse(createPolicyCall.args[0].input.PolicyDocument);
      expect(policyDoc.Statement).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            Effect: 'Allow',
            Action: expect.arrayContaining(['dynamodb:GetItem', 'dynamodb:Query']),
          }),
          expect.objectContaining({
            Effect: 'Allow',
            Action: expect.arrayContaining(['s3:GetObject', 's3:PutObject']),
          }),
        ])
      );
    });
  });

  describe('createModelAdminRole', () => {
    it('should create role and attach policy for model admin', async () => {
      const iamConfig = new IAMConfig(config);

      iamMock.on(IAM.CreateRole).resolves({
        Role: {
          Arn: `arn:aws:iam::${config.accountId}:role/model-admin-${config.environment}`,
        },
      });

      iamMock.on(IAM.CreatePolicy).resolves({
        Policy: {
          Arn: `arn:aws:iam::${config.accountId}:policy/model-admin-${config.environment}`,
        },
      });

      iamMock.on(IAM.AttachRolePolicy).resolves({});

      const roleArn = await iamConfig.createModelAdminRole();

      expect(roleArn).toBe(`arn:aws:iam::${config.accountId}:role/model-admin-${config.environment}`);
      expect(iamMock.commandCalls(IAM.CreateRole)).toHaveLength(1);
      expect(iamMock.commandCalls(IAM.CreatePolicy)).toHaveLength(1);
      expect(iamMock.commandCalls(IAM.AttachRolePolicy)).toHaveLength(1);

      const createRoleCall = iamMock.commandCalls(IAM.CreateRole)[0];
      expect(createRoleCall.args[0].input).toMatchObject({
        RoleName: `model-admin-${config.environment}`,
        Tags: expect.arrayContaining([
          { Key: 'service', Value: 'model-management' },
          { Key: 'environment', Value: config.environment },
          { Key: 'role', Value: 'admin' },
        ]),
      });

      const createPolicyCall = iamMock.commandCalls(IAM.CreatePolicy)[0];
      const policyDoc = JSON.parse(createPolicyCall.args[0].input.PolicyDocument);
      expect(policyDoc.Statement).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            Effect: 'Allow',
            Action: ['dynamodb:*'],
          }),
          expect.objectContaining({
            Effect: 'Allow',
            Action: ['s3:*'],
          }),
          expect.objectContaining({
            Effect: 'Allow',
            Action: ['kms:*'],
          }),
        ])
      );
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid config', () => {
      expect(() => new IAMConfig({
        region: '',
        accountId: '123456789012',
        environment: 'test',
      })).toThrow();
    });

    it('should handle IAM API errors', async () => {
      const iamConfig = new IAMConfig(config);
      iamMock.on(IAM.CreateRole).rejects(new Error('IAM API Error'));

      await expect(iamConfig.createModelAccessRole('test-model-1'))
        .rejects.toThrow('IAM API Error');
    });
  });
}); 