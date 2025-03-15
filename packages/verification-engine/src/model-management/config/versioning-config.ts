import { z } from 'zod';

export const VersioningStrategySchema = z.enum([
  'semantic',
  'timestamp',
  'incremental',
  'git',
]);

export const VersioningRulesSchema = z.object({
  strategy: VersioningStrategySchema,
  majorVersionRules: z.array(z.string()),
  minorVersionRules: z.array(z.string()),
  patchVersionRules: z.array(z.string()),
  autoIncrement: z.boolean(),
  enforceSequential: z.boolean(),
  allowDowngrade: z.boolean(),
});

export const ArtifactStorageSchema = z.object({
  type: z.enum(['s3', 'gcs', 'azure', 'local']),
  path: z.string(),
  compression: z.boolean(),
  encryption: z.boolean(),
  retentionPolicy: z.object({
    enabled: z.boolean(),
    maxVersions: z.number().min(1),
    maxAgeDays: z.number().min(1),
  }),
});

export const VersionMetadataSchema = z.object({
  requiredFields: z.array(z.string()),
  customFields: z.record(z.string()),
  validateSchema: z.boolean(),
});

export const VersioningConfigSchema = z.object({
  enabled: z.boolean(),
  rules: VersioningRulesSchema,
  storage: ArtifactStorageSchema,
  metadata: VersionMetadataSchema,
  changelog: z.object({
    enabled: z.boolean(),
    template: z.string(),
    requiredSections: z.array(z.string()),
  }),
  tagging: z.object({
    enabled: z.boolean(),
    autoTag: z.boolean(),
    requiredTags: z.array(z.string()),
    tagFormat: z.string(),
  }),
  dependencies: z.object({
    track: z.boolean(),
    lockfileEnabled: z.boolean(),
    autoUpdate: z.boolean(),
    securityScanning: z.boolean(),
  }),
  rollback: z.object({
    enabled: z.boolean(),
    automaticRollback: z.boolean(),
    keepRollbackVersions: z.number().min(1),
    requireApproval: z.boolean(),
  }),
});

export type VersioningStrategy = z.infer<typeof VersioningStrategySchema>;
export type VersioningRules = z.infer<typeof VersioningRulesSchema>;
export type ArtifactStorage = z.infer<typeof ArtifactStorageSchema>;
export type VersionMetadata = z.infer<typeof VersionMetadataSchema>;
export type VersioningConfig = z.infer<typeof VersioningConfigSchema>;

export const defaultConfig: VersioningConfig = {
  enabled: true,
  rules: {
    strategy: 'semantic',
    majorVersionRules: [
      'breaking_changes',
      'incompatible_api',
      'major_algorithm_change',
    ],
    minorVersionRules: [
      'new_features',
      'performance_improvements',
      'backward_compatible_changes',
    ],
    patchVersionRules: [
      'bug_fixes',
      'documentation_updates',
      'minor_improvements',
    ],
    autoIncrement: true,
    enforceSequential: true,
    allowDowngrade: false,
  },
  storage: {
    type: 's3',
    path: 'model-versions',
    compression: true,
    encryption: true,
    retentionPolicy: {
      enabled: true,
      maxVersions: 10,
      maxAgeDays: 365,
    },
  },
  metadata: {
    requiredFields: [
      'author',
      'description',
      'training_data',
      'performance_metrics',
      'dependencies',
    ],
    customFields: {
      team: 'string',
      project: 'string',
      environment: 'string',
    },
    validateSchema: true,
  },
  changelog: {
    enabled: true,
    template: '## {version}\n\n### Changes\n{changes}\n\n### Dependencies\n{dependencies}',
    requiredSections: ['changes', 'dependencies', 'migration_notes'],
  },
  tagging: {
    enabled: true,
    autoTag: true,
    requiredTags: ['version', 'environment', 'status'],
    tagFormat: '{name}-{version}-{environment}',
  },
  dependencies: {
    track: true,
    lockfileEnabled: true,
    autoUpdate: false,
    securityScanning: true,
  },
  rollback: {
    enabled: true,
    automaticRollback: false,
    keepRollbackVersions: 3,
    requireApproval: true,
  },
};

export function validateConfig(config: Partial<VersioningConfig>): VersioningConfig {
  const mergedConfig = {
    ...defaultConfig,
    ...config,
    rules: {
      ...defaultConfig.rules,
      ...config.rules,
    },
    storage: {
      ...defaultConfig.storage,
      ...config.storage,
      retentionPolicy: {
        ...defaultConfig.storage.retentionPolicy,
        ...config.storage?.retentionPolicy,
      },
    },
    metadata: {
      ...defaultConfig.metadata,
      ...config.metadata,
      customFields: {
        ...defaultConfig.metadata.customFields,
        ...config.metadata?.customFields,
      },
    },
    changelog: {
      ...defaultConfig.changelog,
      ...config.changelog,
    },
    tagging: {
      ...defaultConfig.tagging,
      ...config.tagging,
    },
    dependencies: {
      ...defaultConfig.dependencies,
      ...config.dependencies,
    },
    rollback: {
      ...defaultConfig.rollback,
      ...config.rollback,
    },
  };
  return VersioningConfigSchema.parse(mergedConfig);
}

export function getEnvironmentConfig(): VersioningConfig {
  const envConfig: Partial<VersioningConfig> = {
    enabled: process.env.VERSIONING_ENABLED === 'true',
    rules: {
      strategy: (process.env.VERSIONING_STRATEGY as VersioningStrategy) || defaultConfig.rules.strategy,
      autoIncrement: process.env.AUTO_INCREMENT === 'true',
      enforceSequential: process.env.ENFORCE_SEQUENTIAL === 'true',
      allowDowngrade: process.env.ALLOW_DOWNGRADE === 'true',
    },
    storage: {
      type: (process.env.STORAGE_TYPE as ArtifactStorage['type']) || defaultConfig.storage.type,
      path: process.env.STORAGE_PATH || defaultConfig.storage.path,
      compression: process.env.STORAGE_COMPRESSION === 'true',
      encryption: process.env.STORAGE_ENCRYPTION === 'true',
      retentionPolicy: {
        enabled: process.env.RETENTION_ENABLED === 'true',
        maxVersions: process.env.MAX_VERSIONS
          ? parseInt(process.env.MAX_VERSIONS, 10)
          : defaultConfig.storage.retentionPolicy.maxVersions,
        maxAgeDays: process.env.MAX_AGE_DAYS
          ? parseInt(process.env.MAX_AGE_DAYS, 10)
          : defaultConfig.storage.retentionPolicy.maxAgeDays,
      },
    },
    rollback: {
      enabled: process.env.ROLLBACK_ENABLED === 'true',
      automaticRollback: process.env.AUTOMATIC_ROLLBACK === 'true',
      requireApproval: process.env.ROLLBACK_REQUIRE_APPROVAL === 'true',
      keepRollbackVersions: process.env.KEEP_ROLLBACK_VERSIONS
        ? parseInt(process.env.KEEP_ROLLBACK_VERSIONS, 10)
        : defaultConfig.rollback.keepRollbackVersions,
    },
  };

  return validateConfig(envConfig);
} 