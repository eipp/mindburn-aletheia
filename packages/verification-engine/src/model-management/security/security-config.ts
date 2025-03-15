import { KMS, STS } from 'aws-sdk';
import { z } from 'zod';

const SecurityConfigSchema = z.object({
  region: z.string(),
  kmsKeyId: z.string(),
  roleArn: z.string(),
  encryptionContext: z.record(z.string()).optional(),
  sessionDuration: z.number().default(3600),
});

export class SecurityConfig {
  private kms: KMS;
  private sts: STS;
  private config: z.infer<typeof SecurityConfigSchema>;

  constructor(config: z.infer<typeof SecurityConfigSchema>) {
    this.config = SecurityConfigSchema.parse(config);
    this.kms = new KMS({ region: config.region });
    this.sts = new STS({ region: config.region });
  }

  async getTemporaryCredentials(userId: string): Promise<AWS.Credentials> {
    const assumeRoleParams = {
      RoleArn: this.config.roleArn,
      RoleSessionName: `model-mgmt-${userId}`,
      DurationSeconds: this.config.sessionDuration,
      Tags: [
        {
          Key: 'user',
          Value: userId,
        },
        {
          Key: 'service',
          Value: 'model-management',
        },
      ],
    };

    const assumedRole = await this.sts.assumeRole(assumeRoleParams).promise();
    if (!assumedRole.Credentials) {
      throw new Error('Failed to obtain temporary credentials');
    }

    return {
      accessKeyId: assumedRole.Credentials.AccessKeyId,
      secretAccessKey: assumedRole.Credentials.SecretAccessKey,
      sessionToken: assumedRole.Credentials.SessionToken,
      expiration: assumedRole.Credentials.Expiration,
    };
  }

  async encryptData(data: string, context?: Record<string, string>): Promise<string> {
    const encryptParams = {
      KeyId: this.config.kmsKeyId,
      Plaintext: Buffer.from(data),
      EncryptionContext: {
        ...this.config.encryptionContext,
        ...context,
      },
    };

    const result = await this.kms.encrypt(encryptParams).promise();
    return result.CiphertextBlob?.toString('base64') || '';
  }

  async decryptData(encryptedData: string, context?: Record<string, string>): Promise<string> {
    const decryptParams = {
      CiphertextBlob: Buffer.from(encryptedData, 'base64'),
      EncryptionContext: {
        ...this.config.encryptionContext,
        ...context,
      },
    };

    const result = await this.kms.decrypt(decryptParams).promise();
    return result.Plaintext?.toString() || '';
  }

  async generateDataKey(): Promise<{
    encryptedKey: string;
    plaintextKey: string;
  }> {
    const params = {
      KeyId: this.config.kmsKeyId,
      KeySpec: 'AES_256',
    };

    const result = await this.kms.generateDataKey(params).promise();
    
    return {
      encryptedKey: result.CiphertextBlob?.toString('base64') || '',
      plaintextKey: result.Plaintext?.toString('base64') || '',
    };
  }
} 