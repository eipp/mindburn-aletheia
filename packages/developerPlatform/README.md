# Mindburn Developer Platform API

This package contains the Developer Platform API for Mindburn Aletheia, providing authentication, task management, webhook configuration, and analytics capabilities for developers integrating with the platform.

## Features

- Authentication API with JWT and API key support
- Verification Task API for submitting and managing verification tasks
- Webhook Configuration API for real-time notifications
- Analytics API for usage metrics and billing information
- Rate limiting and quota management
- Comprehensive input validation
- Structured logging and monitoring

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate credentials
- Redis (for rate limiting)
- Docker (for local development)

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
STAGE=dev
JWT_SECRET=your-jwt-secret
REDIS_URL=redis://localhost:6379
ALLOWED_INTERNAL_IPS=127.0.0.1
```

## Development

Start the local development server:

```bash
npm run start
```

This will start the API locally using serverless-offline.

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Deployment

Deploy to AWS:

```bash
npm run deploy -- --stage <stage>
```

Replace `<stage>` with the desired environment (e.g., dev, staging, prod).

## API Documentation

### Authentication API

- POST /auth/register - Register a new developer
- POST /auth/login - Login and get JWT token
- GET /auth/api-keys - List API keys
- POST /auth/api-keys - Generate new API key
- DELETE /auth/api-keys/{apiKeyId} - Revoke API key

### Task API

- POST /tasks - Submit a new verification task
- GET /tasks/{taskId} - Get task status and results
- GET /tasks - List tasks
- DELETE /tasks/{taskId} - Cancel task

### Webhook API

- POST /webhooks - Create webhook configuration
- GET /webhooks/{webhookId} - Get webhook details
- GET /webhooks - List webhooks
- PUT /webhooks/{webhookId} - Update webhook
- DELETE /webhooks/{webhookId} - Delete webhook
- GET /webhooks/{webhookId}/deliveries - List webhook deliveries

### Analytics API

- GET /analytics/tasks - Get task metrics
- GET /analytics/billing - Get billing metrics
- GET /analytics/quota - Get usage quota
- GET /analytics/tasks/daily - Get daily task breakdown

## Architecture

The API is built using:

- AWS Lambda for serverless compute
- API Gateway for request handling
- DynamoDB for data storage
- SQS for task queue management
- Redis for rate limiting
- CloudWatch for logging and monitoring

## Security

- JWT-based authentication for developer portal
- API key authentication for task submission
- Rate limiting per API key
- Input validation using Zod
- AWS IAM roles and policies
- CORS configuration
- Request validation

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests
4. Submit a pull request

## License

Copyright © 2024 Mindburn. All rights reserved.
