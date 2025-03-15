# API Documentation

## Overview

The Mindburn Aletheia API provides programmatic access to create and manage AI verification tasks, submit verification results, and handle payments. The API follows REST principles and uses JWT for authentication.

## Base URLs

- Production: `https://api.aletheia.mindburn.org/v1`
- Staging: `https://api.staging.aletheia.mindburn.org/v1`
- Local: `http://localhost:3000/v1`

## Authentication

All API requests require authentication using JWT Bearer tokens. Include the token in the Authorization header:

```bash
Authorization: Bearer <your_jwt_token>
```

## Rate Limiting

- 1000 requests per minute for authenticated users
- 100 requests per minute for unauthenticated users
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## OpenAPI Specification

The complete API specification is available in [openapi.yaml](./openapi.yaml). You can view it using:
- [Swagger UI](https://api.aletheia.mindburn.org/docs)
- [Redoc](https://api.aletheia.mindburn.org/redoc)

## Quick Start

### Task Creation Example

```typescript
const response = await fetch('https://api.aletheia.mindburn.org/v1/tasks', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'classification',
    data: {
      text: 'Sample text for classification',
      options: ['positive', 'negative', 'neutral']
    },
    reward: 0.1,
    instructions: 'Classify the sentiment of the text'
  })
});

const task = await response.json();
```

### Verification Submission Example

```typescript
const response = await fetch('https://api.aletheia.mindburn.org/v1/verification/submit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    taskId: 'task_123',
    result: {
      classification: 'positive',
      explanation: 'The text contains positive sentiment'
    },
    confidence: 0.95
  })
});

const result = await response.json();
```

## Error Handling

The API uses standard HTTP status codes and returns errors in a consistent format:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": {
    "field": "reward",
    "error": "must be greater than 0"
  }
}
```

Common error codes:
- `400`: Bad Request - Invalid input
- `401`: Unauthorized - Missing or invalid token
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource doesn't exist
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server-side error

## Versioning

The API is versioned through the URL path. The current version is `v1`. Breaking changes will be introduced in new versions while maintaining backward compatibility for at least 6 months.

## SDKs and Tools

- [TypeScript SDK](https://github.com/mindburn/aletheia-ts)
- [Python SDK](https://github.com/mindburn/aletheia-py)
- [Postman Collection](./postman/aletheia.json)

## Support

- [API Status Page](https://status.aletheia.mindburn.org)
- [Developer Discord](https://discord.gg/mindburn)
- Email: api@mindburn.org 