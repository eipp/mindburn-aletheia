import { ModelRegistry } from '../model-registry';
import { ModelRegistryWithErrorHandling } from '../services/model-registry-with-error-handling';
import {
  validateConfig as validateErrorConfig,
  getEnvironmentConfig as getErrorConfig,
} from '../config/error-handling-config';
import {
  validateConfig as validateRegistryConfig,
  getEnvironmentConfig as getRegistryConfig,
} from '../config/registry-config';

export interface CreateModelRegistryOptions {
  useErrorHandling?: boolean;
  errorConfigOverrides?: Record<string, any>;
  registryConfigOverrides?: Record<string, any>;
}

export async function createModelRegistry(
  options: CreateModelRegistryOptions = {}
): Promise<ModelRegistry | ModelRegistryWithErrorHandling> {
  const {
    useErrorHandling = true,
    errorConfigOverrides = {},
    registryConfigOverrides = {},
  } = options;

  // Get and validate registry configuration
  const registryConfig = validateRegistryConfig({
    ...getRegistryConfig(),
    ...registryConfigOverrides,
  });

  // Create base model registry
  const modelRegistry = new ModelRegistry(registryConfig);

  if (!useErrorHandling) {
    return modelRegistry;
  }

  // Get and validate error handling configuration
  const errorConfig = validateErrorConfig({
    ...getErrorConfig(),
    ...errorConfigOverrides,
  });

  // Create model registry with error handling
  return new ModelRegistryWithErrorHandling(errorConfig, modelRegistry);
}
