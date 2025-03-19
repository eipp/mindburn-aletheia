import { IPlugin, PluginManifest, PluginType } from '../core/types';
import { PluginError, PluginErrorCodes } from '../errors/PluginError';
import { SandboxExecutor } from '../sandbox/SandboxExecutor';

export interface TestContext {
  pluginId: string;
  sandbox?: boolean;
  timeout?: number;
  mockData?: Record<string, any>;
}

export class PluginTester {
  private plugin: IPlugin;
  private sandbox?: SandboxExecutor;
  private mockData: Record<string, any>;
  private readonly defaultTimeout = 5000;

  constructor(
    private PluginClass: new (manifest: PluginManifest) => IPlugin,
    private context: TestContext = { pluginId: 'test-plugin' }
  ) {
    this.mockData = context.mockData || {};
    if (context.sandbox) {
      this.sandbox = new SandboxExecutor();
    }
  }

  async setup(): Promise<void> {
    const manifest = this.createTestManifest();

    if (this.sandbox) {
      this.plugin = await this.sandbox.loadPlugin('test-path', manifest);
    } else {
      this.plugin = new this.PluginClass(manifest);
    }

    await this.plugin.initialize({
      testMode: true,
      mockData: this.mockData,
    });
  }

  async teardown(): Promise<void> {
    await this.plugin.terminate();
    if (this.sandbox) {
      await this.sandbox.unloadPlugin(this.context.pluginId);
    }
  }

  async testMethod<T>(
    method: string,
    args: any[],
    expectedResult?: T,
    options: {
      timeout?: number;
      shouldThrow?: boolean;
      errorCode?: string;
    } = {}
  ): Promise<T> {
    const timeout = options.timeout || this.context.timeout || this.defaultTimeout;

    try {
      const result = await Promise.race([
        this.callMethod(method, args),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Test timeout')), timeout)),
      ]);

      if (options.shouldThrow) {
        throw new Error(`Expected method ${method} to throw but it returned ${result}`);
      }

      if (expectedResult !== undefined) {
        this.assertResult(result, expectedResult);
      }

      return result;
    } catch (error) {
      if (!options.shouldThrow) {
        throw error;
      }
      if (options.errorCode && error instanceof PluginError) {
        if (error.code !== options.errorCode) {
          throw new Error(`Expected error code ${options.errorCode} but got ${error.code}`);
        }
      }
      return undefined as T;
    }
  }

  async testVerification(
    data: unknown,
    expectedResult: boolean,
    options?: { timeout?: number }
  ): Promise<void> {
    if (this.plugin.manifest.type !== PluginType.VERIFICATION) {
      throw new Error('Plugin is not a verification plugin');
    }
    await this.testMethod('verify', [data], expectedResult, options);
  }

  async testDataEnrichment(
    data: unknown,
    expectedEnrichment: unknown,
    options?: { timeout?: number }
  ): Promise<void> {
    if (this.plugin.manifest.type !== PluginType.DATA_ENRICHMENT) {
      throw new Error('Plugin is not a data enrichment plugin');
    }
    await this.testMethod('enrich', [data], expectedEnrichment, options);
  }

  async testVisualization(
    data: unknown,
    expectedOutput: string,
    options?: { timeout?: number }
  ): Promise<void> {
    if (this.plugin.manifest.type !== PluginType.VISUALIZATION) {
      throw new Error('Plugin is not a visualization plugin');
    }
    await this.testMethod('render', [data], expectedOutput, options);
  }

  async testIntegration(
    action: string,
    params: Record<string, any>,
    expectedResult: unknown,
    options?: { timeout?: number }
  ): Promise<void> {
    if (this.plugin.manifest.type !== PluginType.INTEGRATION) {
      throw new Error('Plugin is not an integration plugin');
    }
    await this.testMethod('execute', [action, params], expectedResult, options);
  }

  mockDependency(name: string, mock: unknown): void {
    this.mockData[name] = mock;
  }

  private async callMethod(method: string, args: any[]): Promise<any> {
    if (typeof this.plugin[method] !== 'function') {
      throw new PluginError(
        `Method ${method} not found in plugin`,
        this.context.pluginId,
        PluginErrorCodes.METHOD_NOT_FOUND
      );
    }
    return this.plugin[method](...args);
  }

  private createTestManifest(): PluginManifest {
    return {
      id: this.context.pluginId,
      name: 'Test Plugin',
      version: '1.0.0',
      type: PluginType.VERIFICATION,
      author: 'Test Author',
      description: 'Test plugin for automated testing',
      minHostVersion: '1.0.0',
      maxHostVersion: '2.0.0',
      entryPoint: 'index.ts',
      permissions: [],
      dependencies: {},
      configSchema: {},
    };
  }

  private assertResult(actual: unknown, expected: unknown): void {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);

    if (actualStr !== expectedStr) {
      throw new Error(`Assertion failed:\nExpected: ${expectedStr}\nActual: ${actualStr}`);
    }
  }
}
