import { PluginType, PluginManifest } from '../core/types';

export abstract class BasePlugin {
  protected manifest: PluginManifest;
  protected config: Record<string, any>;

  constructor(manifest: PluginManifest) {
    this.manifest = manifest;
  }

  async initialize(config: Record<string, any>): Promise<void> {
    this.config = config;
  }

  async terminate(): Promise<void> {
    // Cleanup resources
  }
}

export class VerificationPlugin extends BasePlugin {
  abstract verify(data: unknown): Promise<boolean>;
  abstract getVerificationMetadata(): Promise<Record<string, any>>;
}

export class DataEnrichmentPlugin extends BasePlugin {
  abstract enrich(data: unknown): Promise<unknown>;
  abstract getSupportedDataTypes(): string[];
}

export class VisualizationPlugin extends BasePlugin {
  abstract render(data: unknown): Promise<string>;
  abstract getSupportedChartTypes(): string[];
}

export class IntegrationPlugin extends BasePlugin {
  abstract connect(credentials: Record<string, any>): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract execute(action: string, params: Record<string, any>): Promise<unknown>;
}

export function createPluginManifest(options: {
  id: string;
  name: string;
  version: string;
  type: PluginType;
  author: string;
  description: string;
  minHostVersion: string;
  maxHostVersion: string;
  entryPoint: string;
  permissions: string[];
  dependencies?: Record<string, string>;
  configSchema?: Record<string, any>;
}): PluginManifest {
  return {
    id: options.id,
    name: options.name,
    version: options.version,
    type: options.type,
    author: options.author,
    description: options.description,
    minHostVersion: options.minHostVersion,
    maxHostVersion: options.maxHostVersion,
    entryPoint: options.entryPoint,
    permissions: options.permissions,
    dependencies: options.dependencies,
    configSchema: options.configSchema,
  };
}

// Example plugin template
export const createPluginTemplate = (type: PluginType): string => {
  const templates = {
    [PluginType.VERIFICATION]: `
import { VerificationPlugin, createPluginManifest } from '@mindburn/plugin-sdk';

export class MyVerificationPlugin extends VerificationPlugin {
  async verify(data: unknown): Promise<boolean> {
    // Implement verification logic
    return true;
  }

  async getVerificationMetadata(): Promise<Record<string, any>> {
    return {
      // Return metadata about verification process
    };
  }
}

export const manifest = createPluginManifest({
  id: 'my-verification-plugin',
  name: 'My Verification Plugin',
  version: '1.0.0',
  type: 'verification',
  author: 'Your Name',
  description: 'Description of your plugin',
  minHostVersion: '1.0.0',
  maxHostVersion: '2.0.0',
  entryPoint: 'index.ts',
  permissions: [],
});

export default new MyVerificationPlugin(manifest);
    `,
    // Add templates for other plugin types...
  };

  return templates[type] || '';
};
