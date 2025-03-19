// Core types and interfaces
export * from './core/types';
export { PluginManager } from './core/PluginManager';

// Plugin SDK
export {
  BasePlugin,
  VerificationPlugin,
  DataEnrichmentPlugin,
  VisualizationPlugin,
  IntegrationPlugin,
  createPluginManifest,
  createPluginTemplate,
} from './sdk/PluginSDK';

// Sandbox
export { SandboxExecutor } from './sandbox/SandboxExecutor';

// Marketplace
export {
  MarketplaceAPI,
  type PluginMetadata,
  type PluginReview,
  type PluginAnalytics,
  type SearchOptions,
} from './marketplace/MarketplaceAPI';
