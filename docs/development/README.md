# Development Guide

## Prerequisites

- Node.js v20+
- pnpm v10.5+
- Docker (for local development environment)

## Project Structure

```
mindburn-aletheia/
├── packages/
│   ├── core/             # Core functionality
│   ├── shared/           # Shared utilities
│   ├── developerPlatform/ # Developer API
│   ├── workerInterface/ # Telegram Bot & API backend
│   ├── workerWebapp/    # Telegram Mini App frontend
│   ├── taskManagement/   # Task distribution 
│   ├── verificationEngine/ # Verification logic
│   ├── paymentSystem/    # Payment processing
│   ├── tonContracts/     # Smart contracts
│   └── tokenEconomy/     # Token economics
├── infrastructure/       # IaC and deployment
└── scripts/              # Utility scripts
```

## Getting Started

### Install Dependencies

```bash
pnpm install
```

### Start Development Servers

#### Worker Interface (Telegram Bot & API)

```bash
cd packages/workerInterface
pnpm dev
```

#### Worker WebApp (Telegram Mini App)

```bash
cd packages/workerWebapp
pnpm dev
```

### Testing

```bash
# Run all tests
pnpm test

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run only e2e tests
pnpm test:e2e
```

### Debugging

#### VS Code Configuration

```json
{
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Worker Interface",
      "cwd": "${workspaceFolder}/packages/workerInterface",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["run", "dev"]
    }
  ]
}
```

## Development Workflow

### Branch Strategy

- `main`: Production-ready code
- `staging`: Pre-production testing
- `develop`: Development integration
- Feature branches: `feature/description`
- Bugfix branches: `fix/description`

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Check code style
pnpm lint

# Fix code style issues
pnpm lint:fix
```

### Testing

```bash
# Run unit tests
pnpm test

# Run integration tests
pnpm test:integration

# Run e2e tests
pnpm test:e2e
```

### Infrastructure Development

1. Install AWS CDK CLI:

```bash
npm install -g aws-cdk
```

2. Deploy infrastructure locally:

```bash
cd infrastructure
pnpm synth  # Generate CloudFormation template
pnpm deploy # Deploy to AWS
```

### Database Migrations

```bash
cd packages/workerInterface
pnpm migrate:create name  # Create migration
pnpm migrate:up          # Apply migrations
pnpm migrate:down        # Rollback migrations
```

## Debugging

### Worker Interface

1. Configure VS Code launch.json:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Worker Interface",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "cwd": "${workspaceFolder}/packages/workerInterface",
      "console": "integratedTerminal"
    }
  ]
}
```

2. Set breakpoints and start debugging

### Worker WebApp

1. Use Chrome DevTools for debugging
2. Enable source maps in vite.config.ts:

```typescript
export default defineConfig({
  build: {
    sourcemap: true,
  },
});
```

## Performance Optimization

- Use React.memo for expensive components
- Implement virtualization for long lists
- Enable code splitting and lazy loading
- Monitor bundle size with `pnpm analyze`

## Security Best Practices

1. Never commit secrets to version control
2. Use environment variables for configuration
3. Implement rate limiting for API endpoints
4. Enable CORS only for trusted origins
5. Validate and sanitize all user input
6. Use prepared statements for database queries
7. Keep dependencies updated:

```bash
pnpm audit
pnpm update
```

## Monitoring and Logging

- Use AWS CloudWatch for logs
- Monitor API metrics with CloudWatch Metrics
- Set up alerts for error rates and latency
- Use X-Ray for distributed tracing

## Deployment

See [Deployment Guide](../deployment/README.md) for detailed instructions.

## Troubleshooting

### Common Issues

1. **API Connection Errors**

   - Check environment variables
   - Verify AWS credentials
   - Check VPC and security group settings

2. **Build Failures**

   - Clear node_modules and reinstall
   - Check TypeScript errors
   - Verify dependency versions

3. **Database Issues**
   - Check connection string
   - Verify migrations are up to date
   - Check database permissions

### Getting Help

1. Check existing issues on GitHub
2. Join our [Developer Discord](https://discord.gg/mindburn)
3. Contact the team at dev@mindburn.org
