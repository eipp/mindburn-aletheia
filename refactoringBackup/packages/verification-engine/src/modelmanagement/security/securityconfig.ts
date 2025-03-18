import { 
  SecurityService, 
  KMSService, 
  STSService,
  SecurityConfig,
  createConfigValidator,
  z
} from '@mindburn/shared';

const SecurityConfigSchema = z.object({
  kmsKeyId: z.string(),
  roleArn: z.string(),
  sessionDuration: z.number().min(900).max(43200),
  encryptionContext: z.record(z.string()).optional(),
  region: z.string(),
});

const defaultConfig: SecurityConfig = {
  kmsKeyId: '',
  roleArn: '',
  sessionDuration: 3600,
  region: 'us-east-1',
};

const envMap = {
  kmsKeyId: 'MODEL_KMS_KEY_ID',
  roleArn: 'MODEL_ROLE_ARN',
  sessionDuration: 'MODEL_SESSION_DURATION',
  region: 'AWS_REGION',
};

export const validateConfig = createConfigValidator({
  schema: SecurityConfigSchema,
  defaultConfig,
  envMap,
});

export const getConfig = () => validateConfig({});

export class ModelSecurityService {
  private securityService: SecurityService;
  private kmsService: KMSService;
  private stsService: STSService;
  private config: SecurityConfig;

  constructor() {
    this.config = getConfig();
    this.securityService = new SecurityService();
    this.kmsService = new KMSService(this.config);
    this.stsService = new STSService(this.config);
  }

  async encryptModelData(data: string, context?: Record<string, string>): Promise<string> {
    return this.kmsService.encrypt(data, {
      KeyId: this.config.kmsKeyId,
      EncryptionContext: context || this.config.encryptionContext,
    });
  }

  async decryptModelData(ciphertext: string, context?: Record<string, string>): Promise<string> {
    return this.kmsService.decrypt(ciphertext, {
      EncryptionContext: context || this.config.encryptionContext,
    });
  }

  async assumeModelRole(): Promise<{
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  }> {
    return this.stsService.assumeRole({
      RoleArn: this.config.roleArn,
      RoleSessionName: 'ModelAccess',
      DurationSeconds: this.config.sessionDuration,
    });
  }
} 