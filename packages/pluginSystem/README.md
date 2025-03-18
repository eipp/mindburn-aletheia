# Mindburn Aletheia Plugin System

A secure and extensible plugin system for the Mindburn Aletheia verification platform.

## Features

- 🔒 Secure sandbox execution
- 🔌 Multiple plugin types (Verification, Data Enrichment, Visualization, Integration)
- 📦 Easy-to-use SDK for plugin development
- 🔄 Lifecycle management (install, update, remove)
- 🏷️ Version compatibility checking
- 📊 Usage analytics and monitoring

## Quick Start

### Installing the SDK

```bash
npm install @mindburn/plugin-system
```

### Creating a Plugin

1. Create a new directory for your plugin:

```bash
mkdir my-verification-plugin
cd my-verification-plugin
npm init
```

2. Install dependencies:

```bash
npm install @mindburn/plugin-system
```

3. Create your plugin using one of the base classes:

```typescript
import {
  VerificationPlugin,
  createPluginManifest,
} from '@mindburn/plugin-system';

export class MyVerificationPlugin extends VerificationPlugin {
  async verify(data: unknown): Promise<boolean> {
    // Your verification logic here
    return true;
  }

  async getVerificationMetadata(): Promise<Record<string, any>> {
    return {
      method: 'custom-verification',
      confidence: 0.95,
    };
  }
}

export const manifest = createPluginManifest({
  id: 'my-verification-plugin',
  name: 'My Verification Plugin',
  version: '1.0.0',
  type: 'verification',
  author: 'Your Name',
  description: 'Custom verification method',
  minHostVersion: '1.0.0',
  maxHostVersion: '2.0.0',
  entryPoint: 'index.ts',
  permissions: [],
});

export default new MyVerificationPlugin(manifest);
```

## Plugin Types

### Verification Plugins

Implement custom verification methods for content validation.

```typescript
interface IVerificationPlugin {
  verify(data: unknown): Promise<boolean>;
  getVerificationMetadata(): Promise<Record<string, any>>;
}
```

### Data Enrichment Plugins

Add additional data or context to verification tasks.

```typescript
interface IDataEnrichmentPlugin {
  enrich(data: unknown): Promise<unknown>;
  getSupportedDataTypes(): string[];
}
```

### Visualization Plugins

Create custom visualizations for the dashboard.

```typescript
interface IVisualizationPlugin {
  render(data: unknown): Promise<string>;
  getSupportedChartTypes(): string[];
}
```

### Integration Plugins

Connect with external systems and APIs.

```typescript
interface IIntegrationPlugin {
  connect(credentials: Record<string, any>): Promise<void>;
  disconnect(): Promise<void>;
  execute(action: string, params: Record<string, any>): Promise<unknown>;
}
```

## Security

The plugin system runs all plugins in isolated sandboxes with:

- Memory limits (512MB per plugin)
- CPU limits (1 core per plugin)
- Restricted module access
- Network isolation
- Execution timeouts
- No access to file system
- No access to process env

## Plugin Manifest

Every plugin must include a manifest.json file:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "type": "verification",
  "author": "Your Name",
  "description": "Plugin description",
  "minHostVersion": "1.0.0",
  "maxHostVersion": "2.0.0",
  "entryPoint": "index.ts",
  "permissions": [],
  "dependencies": {
    "lodash": "^4.17.21"
  },
  "configSchema": {
    "apiKey": "string",
    "threshold": "number"
  }
}
```

## Testing

The SDK includes a testing framework for plugins:

```typescript
import { PluginTester } from '@mindburn/plugin-system/testing';

describe('MyVerificationPlugin', () => {
  let tester: PluginTester;

  beforeEach(() => {
    tester = new PluginTester(MyVerificationPlugin);
  });

  it('should verify valid data', async () => {
    const result = await tester.verify({
      /* test data */
    });
    expect(result).toBe(true);
  });
});
```

## Submission Process

1. Test your plugin thoroughly
2. Submit to the Mindburn Plugin Marketplace
3. Undergo security review
4. Receive approval and publish

## Best Practices

1. Follow the principle of least privilege
2. Handle errors gracefully
3. Include comprehensive documentation
4. Provide usage examples
5. Follow semantic versioning
6. Include tests
7. Optimize performance

## Support

- Documentation: [docs.mindburn.org/plugins](https://docs.mindburn.org/plugins)
- Issues: [GitHub Issues](https://github.com/mindburn/plugin-system/issues)
- Community: [Discord](https://discord.gg/mindburn)
