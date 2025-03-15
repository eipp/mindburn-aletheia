import { SecurityConfig } from '../security-config';
import { AuthService } from '../auth-service';
import { SecureModelAccess } from '../secure-model-access';
import { ModelRegistry } from '../../model-registry';

describe('Security Implementation', () => {
  const mockConfig = {
    region: 'us-east-1',
    kmsKeyId: 'test-key-id',
    roleArn: 'arn:aws:iam::123456789012:role/test-role',
    encryptionContext: {
      application: 'model-management',
      environment: 'test',
    },
  };

  const mockAuthConfig = {
    region: 'us-east-1',
    userPoolId: 'test-pool-id',
    clientId: 'test-client-id',
  };

  const mockModelConfig = {
    tableName: 'test_models',
    bucketName: 'test-bucket',
    region: 'us-east-1',
  };

  const mockSecureAccessConfig = {
    encryptSensitiveFields: true,
    auditAccess: true,
    requiredPermissions: {
      getModel: ['model:read'],
      updateModel: ['model:write'],
    },
  };

  describe('SecurityConfig', () => {
    let security: SecurityConfig;

    beforeEach(() => {
      security = new SecurityConfig(mockConfig);
    });

    it('should generate temporary credentials', async () => {
      const mockCredentials = {
        AccessKeyId: 'test-key',
        SecretAccessKey: 'test-secret',
        SessionToken: 'test-token',
        Expiration: new Date(),
      };

      // Mock AWS STS assumeRole
      const mockAssumeRole = jest.fn().mockReturnValue({
        promise: () => Promise.resolve({ Credentials: mockCredentials }),
      });
      (security as any).sts.assumeRole = mockAssumeRole;

      const credentials = await security.getTemporaryCredentials('test-user');
      expect(credentials).toBeDefined();
      expect(credentials.accessKeyId).toBe('test-key');
      expect(mockAssumeRole).toHaveBeenCalledWith(expect.objectContaining({
        RoleArn: mockConfig.roleArn,
        RoleSessionName: 'model-mgmt-test-user',
      }));
    });

    it('should encrypt and decrypt data with context', async () => {
      const testData = 'sensitive-data';
      const context = { purpose: 'test' };

      // Mock KMS encrypt/decrypt
      const mockEncrypt = jest.fn().mockReturnValue({
        promise: () => Promise.resolve({
          CiphertextBlob: Buffer.from('encrypted'),
        }),
      });
      const mockDecrypt = jest.fn().mockReturnValue({
        promise: () => Promise.resolve({
          Plaintext: Buffer.from(testData),
        }),
      });

      (security as any).kms.encrypt = mockEncrypt;
      (security as any).kms.decrypt = mockDecrypt;

      const encrypted = await security.encryptData(testData, context);
      expect(encrypted).toBeDefined();
      expect(mockEncrypt).toHaveBeenCalledWith(expect.objectContaining({
        KeyId: mockConfig.kmsKeyId,
        EncryptionContext: expect.objectContaining(context),
      }));

      const decrypted = await security.decryptData(encrypted, context);
      expect(decrypted).toBe(testData);
      expect(mockDecrypt).toHaveBeenCalledWith(expect.objectContaining({
        EncryptionContext: expect.objectContaining(context),
      }));
    });
  });

  describe('AuthService', () => {
    let security: SecurityConfig;
    let auth: AuthService;

    beforeEach(() => {
      security = new SecurityConfig(mockConfig);
      auth = new AuthService(mockAuthConfig, security);
    });

    it('should authenticate user and return tokens', async () => {
      const mockAuthResult = {
        AuthenticationResult: {
          AccessToken: 'test-access-token',
          RefreshToken: 'test-refresh-token',
        },
      };

      // Mock Cognito initiateAuth
      const mockInitiateAuth = jest.fn().mockReturnValue({
        promise: () => Promise.resolve(mockAuthResult),
      });
      (auth as any).cognito.initiateAuth = mockInitiateAuth;

      // Mock temporary credentials
      jest.spyOn(security, 'getTemporaryCredentials').mockResolvedValue({
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        sessionToken: 'test-token',
        expiration: new Date(),
      } as AWS.Credentials);

      const result = await auth.authenticateUser('test-user', 'test-pass');
      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe('test-refresh-token');
      expect(result.credentials).toBeDefined();
    });

    it('should verify tokens and return user info', async () => {
      const mockUserResult = {
        Username: 'test-user',
        UserAttributes: [
          {
            Name: 'custom:groups',
            Value: 'admin,developer',
          },
        ],
      };

      // Mock Cognito getUser
      const mockGetUser = jest.fn().mockReturnValue({
        promise: () => Promise.resolve(mockUserResult),
      });
      (auth as any).cognito.getUser = mockGetUser;

      const result = await auth.verifyToken('test-token');
      expect(result.isValid).toBe(true);
      expect(result.username).toBe('test-user');
      expect(result.groups).toContain('admin');
      expect(result.groups).toContain('developer');
    });
  });

  describe('SecureModelAccess', () => {
    let security: SecurityConfig;
    let auth: AuthService;
    let registry: ModelRegistry;
    let secureAccess: SecureModelAccess;

    beforeEach(() => {
      security = new SecurityConfig(mockConfig);
      auth = new AuthService(mockAuthConfig, security);
      registry = new ModelRegistry(mockModelConfig);
      secureAccess = new SecureModelAccess(
        security,
        auth,
        registry,
        mockSecureAccessConfig
      );
    });

    it('should securely get model with proper authorization', async () => {
      // Mock auth verification
      jest.spyOn(auth, 'verifyToken').mockResolvedValue({
        username: 'test-user',
        groups: ['model:read'],
        isValid: true,
      });

      // Mock model retrieval
      const mockModel = {
        modelId: 'test-model',
        version: '1.0.0',
        performance: {
          accuracy: 0.95,
          encryptedMetrics: 'encrypted-data',
        },
      };
      jest.spyOn(registry, 'getModel').mockResolvedValue(mockModel);

      // Mock decryption
      jest.spyOn(security, 'decryptData').mockResolvedValue(
        JSON.stringify({ detailedMetrics: { precision: 0.94 } })
      );

      const result = await secureAccess.getModel(
        'test-model',
        '1.0.0',
        'test-token'
      );

      expect(result).toBeDefined();
      expect(result.performance.detailedMetrics).toBeDefined();
      expect(auth.verifyToken).toHaveBeenCalledWith('test-token');
    });

    it('should reject unauthorized access', async () => {
      // Mock auth verification with insufficient permissions
      jest.spyOn(auth, 'verifyToken').mockResolvedValue({
        username: 'test-user',
        groups: [],
        isValid: true,
      });

      await expect(
        secureAccess.getModel('test-model', '1.0.0', 'test-token')
      ).rejects.toThrow();
    });
  });
}); 