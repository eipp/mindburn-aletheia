import { Worker } from 'worker_threads';
import { IPlugin, PluginManifest } from '../core/types';
import path from 'path';

export class SandboxExecutor {
  private workers: Map<string, Worker> = new Map();
  private readonly memoryLimit = 512; // MB
  private readonly cpuLimit = 1; // CPU cores

  async loadPlugin(pluginPath: string, manifest: PluginManifest): Promise<IPlugin> {
    const workerPath = path.join(__dirname, 'worker.js');
    const worker = new Worker(workerPath, {
      workerData: {
        pluginPath,
        manifest,
        entryPoint: manifest.entryPoint,
      },
      resourceLimits: {
        maxOldGenerationSizeMb: this.memoryLimit,
        maxYoungGenerationSizeMb: this.memoryLimit / 4,
        codeRangeSizeMb: 64,
      },
    });

    // Set up error handling
    worker.on('error', (error) => {
      console.error(`Plugin ${manifest.id} worker error:`, error);
      this.unloadPlugin(manifest.id);
    });

    // Create proxy object that forwards calls to the worker
    const plugin: IPlugin = {
      manifest,
      initialize: (config) => this.sendToWorker(worker, 'initialize', [config]),
      terminate: () => this.sendToWorker(worker, 'terminate', []),
    };

    // Add type-specific methods based on plugin type
    switch (manifest.type) {
      case 'verification':
        Object.assign(plugin, {
          verify: (data) => this.sendToWorker(worker, 'verify', [data]),
          getVerificationMetadata: () => this.sendToWorker(worker, 'getVerificationMetadata', []),
        });
        break;
      case 'data_enrichment':
        Object.assign(plugin, {
          enrich: (data) => this.sendToWorker(worker, 'enrich', [data]),
          getSupportedDataTypes: () => this.sendToWorker(worker, 'getSupportedDataTypes', []),
        });
        break;
      case 'visualization':
        Object.assign(plugin, {
          render: (data) => this.sendToWorker(worker, 'render', [data]),
          getSupportedChartTypes: () => this.sendToWorker(worker, 'getSupportedChartTypes', []),
        });
        break;
      case 'integration':
        Object.assign(plugin, {
          connect: (credentials) => this.sendToWorker(worker, 'connect', [credentials]),
          disconnect: () => this.sendToWorker(worker, 'disconnect', []),
          execute: (action, params) => this.sendToWorker(worker, 'execute', [action, params]),
        });
        break;
    }

    this.workers.set(manifest.id, worker);
    return plugin;
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const worker = this.workers.get(pluginId);
    if (worker) {
      await worker.terminate();
      this.workers.delete(pluginId);
    }
  }

  private sendToWorker(worker: Worker, method: string, args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const messageId = Math.random().toString(36).slice(2);
      
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Plugin execution timed out'));
      }, 30000); // 30 second timeout

      const messageHandler = (message: any) => {
        if (message.id === messageId) {
          cleanup();
          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message.result);
          }
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        worker.removeListener('message', messageHandler);
      };

      worker.on('message', messageHandler);
      worker.postMessage({ id: messageId, method, args });
    });
  }
} 