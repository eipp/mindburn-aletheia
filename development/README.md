# Aletheia Development Guide

## Overview

Aletheia is a decentralized human-in-the-loop AI verification platform built on Telegram Mini Apps. This guide covers everything you need to know to set up your development environment and start contributing.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/mindburn/aletheia
cd aletheia

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# Start local development
pnpm dev
```

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.5.2
- Docker & Docker Compose
- AWS CLI (for deployment)
- Telegram Bot Token (for Mini App development)

## Project Structure

```
aletheia/
├── api/                 # Backend API services
├── packages/           
│   ├── core/           # Shared business logic
│   ├── ui/             # React components
│   └── verification/   # Verification logic
├── infrastructure/      # AWS CDK infrastructure
├── tests/              # Test suites
│   ├── e2e/           # End-to-end tests
│   ├── integration/   # Integration tests
│   └── load/          # Load tests
└── docs/              # Documentation
```

## Development Workflow

1. **Local Development**
   ```bash
   # Start all services
   pnpm dev
   
   # Start specific service
   pnpm dev --filter @mindburn/api
   ```

2. **Testing**
   ```bash
   # Run all tests
   pnpm test:all
   
   # Run specific tests
   pnpm test:unit
   pnpm test:e2e
   pnpm test:load
   ```

3. **Database**
   ```bash
   # Start local DynamoDB
   docker-compose up dynamodb
   
   # Run migrations
   pnpm migrations:apply
   ```

## API Development

1. **OpenAPI Specification**
   - Located at `api/openapi.yaml`
   - Auto-generates TypeScript types and API client
   - Validates requests/responses

2. **Adding New Endpoints**
   ```typescript
   // api/src/handlers/tasks.ts
   export const listTasks: APIGatewayProxyHandler = async (event) => {
     // Implementation
   };
   ```

3. **Testing Endpoints**
   ```typescript
   // tests/integration/tasks.test.ts
   describe('Tasks API', () => {
     it('should list available tasks', async () => {
       // Test implementation
     });
   });
   ```

## Frontend Development

1. **Telegram Mini App**
   - Uses React with TypeScript
   - Follows Telegram design guidelines
   - Responsive layout for all devices

2. **Component Development**
   ```typescript
   // packages/ui/src/components/TaskCard.tsx
   export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
     // Implementation
   };
   ```

3. **State Management**
   - Uses React Query for server state
   - Zustand for client state
   - Persistent storage with localforage

## Testing

1. **Unit Tests (Jest)**
   ```typescript
   // packages/verification/src/__tests__/verifier.test.ts
   describe('Verifier', () => {
     it('should calculate confidence score', () => {
       // Test implementation
     });
   });
   ```

2. **E2E Tests (Playwright)**
   ```typescript
   // tests/e2e/taskVerification.spec.ts
   test('should complete full verification flow', async ({ page }) => {
     // Test implementation
   });
   ```

3. **Load Tests (Artillery)**
   ```bash
   # Run load tests
   pnpm test:load
   
   # Generate report
   pnpm test:load:report
   ```

## Deployment

1. **Staging**
   ```bash
   # Deploy API
   pnpm deploy:api --stage staging
   
   # Deploy frontend
   pnpm deploy:web --stage staging
   ```

2. **Production**
   ```bash
   # Deploy all services
   pnpm deploy:all --stage prod
   ```

## Troubleshooting

### Common Issues

1. **DynamoDB Connection**
   ```bash
   # Check DynamoDB status
   docker ps | grep dynamodb
   
   # Reset local database
   docker-compose down -v
   docker-compose up dynamodb
   ```

2. **API Gateway Errors**
   - Check CloudWatch logs
   - Verify environment variables
   - Test locally with serverless-offline

3. **Mini App Issues**
   - Clear browser cache
   - Check Telegram Bot settings
   - Verify webhook configuration

### Debug Tools

1. **API Debugging**
   ```bash
   # Enable debug logs
   DEBUG=* pnpm dev
   
   # Watch API logs
   pnpm logs:api --tail
   ```

2. **Frontend Debugging**
   - React DevTools
   - Network tab monitoring
   - Redux DevTools (if applicable)

## Performance Optimization

1. **API Performance**
   - DynamoDB query optimization
   - Lambda cold start mitigation
   - Response caching strategies

2. **Frontend Performance**
   - Code splitting
   - Image optimization
   - Service worker caching

## Security

1. **Authentication**
   - Telegram auth validation
   - JWT token handling
   - Rate limiting

2. **Data Protection**
   - Input validation
   - XSS prevention
   - CORS configuration

## Contributing

1. **Code Style**
   ```bash
   # Format code
   pnpm format
   
   # Lint code
   pnpm lint
   ```

2. **Pull Requests**
   - Follow conventional commits
   - Include tests
   - Update documentation

## Resources

- [API Documentation](https://api.aletheia.mindburn.org/docs)
- [Design System](https://ui.aletheia.mindburn.org)
- [Architecture Overview](https://docs.aletheia.mindburn.org/architecture)
- [Telegram Mini App Guidelines](https://core.telegram.org/bots/webapps)

## Environment Variables

```bash
# Required Variables
NODE_ENV=development                    # Environment (development/staging/production)
AWS_REGION=us-east-1                    # AWS Region
DYNAMODB_ENDPOINT=http://localhost:8000 # Local DynamoDB endpoint
AWS_ACCESS_KEY_ID=local                 # AWS access key (local development)
AWS_SECRET_ACCESS_KEY=local             # AWS secret key (local development)

# Telegram Configuration
TELEGRAM_BOT_TOKEN=                     # Telegram Bot API token
TELEGRAM_WEBHOOK_URL=                   # Webhook URL for bot updates
TELEGRAM_APP_URL=                       # Mini App URL

# TON Blockchain
TON_ENDPOINT=                          # TON HTTP API endpoint
TON_API_KEY=                          # TON API key
TON_NETWORK=testnet                   # TON network (testnet/mainnet)

# Security
JWT_SECRET=                           # JWT signing secret
ENCRYPTION_KEY=                       # Field-level encryption key
RATE_LIMIT_REQUESTS=100              # Rate limit requests per window
RATE_LIMIT_WINDOW_MS=60000           # Rate limit window in milliseconds

# Monitoring
CLOUDWATCH_LOG_GROUP=                 # CloudWatch log group name
SENTRY_DSN=                          # Sentry error tracking DSN
```

## Error Handling

### API Error Responses

All API errors follow a standard format:

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "details": {
    // Additional error context
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| UNAUTHORIZED | 401 | Authentication failed |
| FORBIDDEN | 403 | Permission denied |
| NOT_FOUND | 404 | Resource not found |
| BAD_REQUEST | 400 | Invalid parameters |
| CONFLICT | 409 | Resource conflict |
| INTERNAL_ERROR | 500 | Server error |

### Error Handling Best Practices

1. **Client-Side**
   ```typescript
   try {
     const response = await api.verifyTask(taskId, result);
   } catch (error) {
     if (error.code === 'NOT_FOUND') {
       // Handle missing task
     } else if (error.code === 'CONFLICT') {
       // Handle already verified
     }
   }
   ```

2. **Server-Side**
   ```typescript
   try {
     const task = await taskService.findById(taskId);
     if (!task) {
       throw new ApiError('NOT_FOUND', 'Task not found');
     }
   } catch (error) {
     logger.error('Task verification failed', { error, taskId });
     throw new ApiError('INTERNAL_ERROR', 'Verification failed');
   }
   ``` 