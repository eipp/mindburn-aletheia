import { EventEmitter } from 'events';
import { PluginManifest, PluginManifestSchema, IPlugin } from './types';
import { SandboxExecutor } from '../sandbox/SandboxExecutor';
import { compareVersions } from 'compare-versions';

export class PluginManager extends EventEmitter {
  private plugins: Map<string, IPlugin> = new Map();
  private sandbox: SandboxExecutor;
  private hostVersion: string;

  constructor(hostVersion: string) {
    super();
    this.hostVersion = hostVersion;
    this.sandbox = new SandboxExecutor();
  }

  async installPlugin(pluginPath: string): Promise<void> {
    const manifest = await this.loadManifest(pluginPath);
    this.validateManifest(manifest);

    const plugin = await this.sandbox.loadPlugin(pluginPath, manifest);
    this.plugins.set(manifest.id, plugin);
    
    this.emit('pluginInstalled', manifest);
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin ${pluginId} not found`);

    await plugin.terminate();
    await this.sandbox.unloadPlugin(pluginId);
    this.plugins.delete(pluginId);
    
    this.emit('pluginUninstalled', plugin.manifest);
  }

  async updatePlugin(pluginPath: string): Promise<void> {
    const manifest = await this.loadManifest(pluginPath);
    const existingPlugin = this.plugins.get(manifest.id);
    
    if (!existingPlugin) {
      throw new Error(`Plugin ${manifest.id} not found for update`);
    }

    await this.uninstallPlugin(manifest.id);
    await this.installPlugin(pluginPath);
    
    this.emit('pluginUpdated', manifest);
  }

  getPlugin(pluginId: string): IPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  listPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values()).map(plugin => plugin.manifest);
  }

  private async loadManifest(pluginPath: string): Promise<PluginManifest> {
    try {
      const manifestData = await import(`${pluginPath}/manifest.json`);
      return PluginManifestSchema.parse(manifestData);
    } catch (error) {
      throw new Error(`Failed to load plugin manifest: ${error.message}`);
    }
  }

  private validateManifest(manifest: PluginManifest): void {
    if (compareVersions(this.hostVersion, manifest.minHostVersion) < 0) {
      throw new Error(`Host version ${this.hostVersion} is lower than required ${manifest.minHostVersion}`);
    }

    if (compareVersions(this.hostVersion, manifest.maxHostVersion) > 0) {
      throw new Error(`Host version ${this.hostVersion} is higher than supported ${manifest.maxHostVersion}`);
    }

    // Additional validation can be added here
  }
} 