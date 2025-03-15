# Development Guide

## Prerequisites

- Node.js 20.x
- pnpm 8.x
- Docker & Docker Compose
- AWS CLI configured with appropriate credentials
- Telegram Bot Token (for local development)

## Project Structure

```
aletheia/
├── infrastructure/        # AWS CDK infrastructure code
├── packages/
│   ├── worker-interface/ # Telegram Bot & API backend
│   └── worker-webapp/    # Telegram Mini App frontend
├── docs/                 # Documentation
├── scripts/              # Development and deployment scripts
└── docker-compose.yml    # Local development services
```

## Local Development Setup

1. Clone the repository:
```bash
git clone https://github.com/mindburn/aletheia.git
cd aletheia
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Configure environment variables:
```bash
# .env
TELEGRAM_BOT_TOKEN=your_bot_token
AWS_REGION=us-east-1
STAGE=local
```

5. Start local services:
```bash
docker-compose up -d
```

6. Start development servers:
```bash
# Terminal 1 - Worker Interface
cd packages/worker-interface
pnpm dev

# Terminal 2 - Worker WebApp
cd packages/worker-webapp
pnpm dev
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
cd packages/worker-interface
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
      "cwd": "${workspaceFolder}/packages/worker-interface",
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
    sourcemap: true
  }
})
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