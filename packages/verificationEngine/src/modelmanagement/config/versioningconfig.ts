import { z } from 'zod';
import {
  createConfigValidator,
  createEnvironmentTransformer,
  createSecurityValidator,
  createPerformanceValidator,
} from '@mindburn/shared';

export type VersioningStrategy = 'semantic' | 'timestamp' | 'incremental' | 'git';
export type ArtifactStorage = {
  type: 's3' | 'gcs' | 'local' | 'azure';
  path: string;
  compression: boolean;
  encryption: boolean;
  retentionPolicy: {
    enabled: boolean;
    maxVersions: number;
    maxAgeDays: number;
  };
};

export interface VersioningConfig {
  enabled: boolean;
  rules: {
    strategy: VersioningStrategy;
    autoIncrement: boolean;
    enforceSequential: boolean;
    allowDowngrade: boolean;
  };
  storage: ArtifactStorage;
  metadata: {
    requiredFields: string[];
    customFields: Record<string, string>;
    validateSchema: boolean;
  };
  changelog: {
    enabled: boolean;
    template: string;
    requiredSections: string[];
  };
  tagging: {
    enabled: boolean;
    prefix: string;
    autoTag: boolean;
    tagFormat: string;
  };
  dependencies: {
    track: boolean;
    autoUpdate: boolean;
    lockfileEnabled: boolean;
  };
  rollback: {
    enabled: boolean;
    automaticRollback: boolean;
    requireApproval: boolean;
    keepRollbackVersions: number;
  };
}

const defaultConfig: VersioningConfig = {
  enabled: true,
  rules: {
    strategy: 'semantic',
    autoIncrement: true,
    enforceSequential: true,
    allowDowngrade: false,
  },
  storage: {
    type: 's3',
    path: 'models',
    compression: true,
    encryption: true,
    retentionPolicy: {
      enabled: true,
      maxVersions: 10,
      maxAgeDays: 90,
    },
  },
  metadata: {
    requiredFields: ['author', 'description', 'version'],
    customFields: {},
    validateSchema: true,
  },
  changelog: {
    enabled: true,
    template: '## {version}\n\n### Changes\n\n{changes}\n\n### Dependencies\n\n{dependencies}',
    requiredSections: ['changes', 'dependencies'],
  },
  tagging: {
    enabled: true,
    prefix: 'v',
    autoTag: true,
    tagFormat: '{prefix}{version}',
  },
  dependencies: {
    track: true,
    autoUpdate: false,
    lockfileEnabled: true,
  },
  rollback: {
    enabled: true,
    automaticRollback: false,
    requireApproval: true,
    keepRollbackVersions: 3,
  },
};

const VersioningSchema = z.object({
  enabled: z.boolean(),
  rules: z.object({
    strategy: z.enum(['semantic', 'timestamp', 'incremental', 'git']),
    autoIncrement: z.boolean(),
    enforceSequential: z.boolean(),
    allowDowngrade: z.boolean(),
  }),
  storage: z.object({
    type: z.enum(['s3', 'gcs', 'local', 'azure']),
    path: z.string(),
    compression: z.boolean(),
    encryption: z.boolean(),
    retentionPolicy: z.object({
      enabled: z.boolean(),
      maxVersions: z.number().min(1),
      maxAgeDays: z.number().min(1),
    }),
  }),
  metadata: z.object({
    requiredFields: z.array(z.string()),
    customFields: z.record(z.string()),
    validateSchema: z.boolean(),
  }),
  changelog: z.object({
    enabled: z.boolean(),
    template: z.string(),
    requiredSections: z.array(z.string()),
  }),
  tagging: z.object({
    enabled: z.boolean(),
    prefix: z.string(),
    autoTag: z.boolean(),
    tagFormat: z.string(),
  }),
  dependencies: z.object({
    track: z.boolean(),
    autoUpdate: z.boolean(),
    lockfileEnabled: z.boolean(),
  }),
  rollback: z.object({
    enabled: z.boolean(),
    automaticRollback: z.boolean(),
    requireApproval: z.boolean(),
    keepRollbackVersions: z.number().min(1),
  }),
});

const envMap: Record<string, string> = {
  enabled: 'VERSIONING_ENABLED',
  'rules.strategy': 'VERSIONING_STRATEGY',
  'rules.autoIncrement': 'AUTO_INCREMENT',
  'rules.enforceSequential': 'ENFORCE_SEQUENTIAL',
  'rules.allowDowngrade': 'ALLOW_DOWNGRADE',
  'storage.type': 'STORAGE_TYPE',
  'storage.path': 'STORAGE_PATH',
  'storage.compression': 'STORAGE_COMPRESSION',
  'storage.encryption': 'STORAGE_ENCRYPTION',
  'storage.retentionPolicy.enabled': 'RETENTION_ENABLED',
  'storage.retentionPolicy.maxVersions': 'MAX_VERSIONS',
  'storage.retentionPolicy.maxAgeDays': 'MAX_AGE_DAYS',
  'metadata.validateSchema': 'VALIDATE_METADATA_SCHEMA',
  'changelog.enabled': 'CHANGELOG_ENABLED',
  'tagging.enabled': 'TAGGING_ENABLED',
  'tagging.autoTag': 'AUTO_TAG',
  'dependencies.track': 'TRACK_DEPENDENCIES',
  'dependencies.autoUpdate': 'AUTO_UPDATE_DEPENDENCIES',
  'dependencies.lockfileEnabled': 'ENABLE_LOCKFILE',
  'rollback.enabled': 'ROLLBACK_ENABLED',
  'rollback.automaticRollback': 'AUTOMATIC_ROLLBACK',
  'rollback.requireApproval': 'ROLLBACK_REQUIRE_APPROVAL',
  'rollback.keepRollbackVersions': 'KEEP_ROLLBACK_VERSIONS',
};

export const validateConfig = createConfigValidator<VersioningConfig>({
  schema: VersioningSchema,
  defaultConfig,
  transformers: [createEnvironmentTransformer(envMap)],
  validators: [
    createSecurityValidator(['storage.encryption']),
    createPerformanceValidator({
      'storage.retentionPolicy.maxVersions': 20,
      'storage.retentionPolicy.maxAgeDays': 180,
      'rollback.keepRollbackVersions': 5,
    }),
  ],
});

export function getConfig(): VersioningConfig {
  return validateConfig({});
}
