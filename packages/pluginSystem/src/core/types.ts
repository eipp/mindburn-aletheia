import { z } from 'zod';

export enum PluginType {
  VERIFICATION = 'verification',
  DATA_ENRICHMENT = 'data_enrichment',
  VISUALIZATION = 'visualization',
  INTEGRATION = 'integration',
}

export const PluginManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  type: z.nativeEnum(PluginType),
  author: z.string(),
  description: z.string(),
  minHostVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  maxHostVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  entryPoint: z.string(),
  permissions: z.array(z.string()),
  dependencies: z.record(z.string(), z.string()).optional(),
  configSchema: z.record(z.any()).optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export interface IPlugin {
  manifest: PluginManifest;
  initialize(config: Record<string, any>): Promise<void>;
  terminate(): Promise<void>;
}

export interface IVerificationPlugin extends IPlugin {
  verify(data: unknown): Promise<boolean>;
  getVerificationMetadata(): Promise<Record<string, any>>;
}

export interface IDataEnrichmentPlugin extends IPlugin {
  enrich(data: unknown): Promise<unknown>;
  getSupportedDataTypes(): string[];
}

export interface IVisualizationPlugin extends IPlugin {
  render(data: unknown): Promise<string>;
  getSupportedChartTypes(): string[];
}

export interface IIntegrationPlugin extends IPlugin {
  connect(credentials: Record<string, any>): Promise<void>;
  disconnect(): Promise<void>;
  execute(action: string, params: Record<string, any>): Promise<unknown>;
}
