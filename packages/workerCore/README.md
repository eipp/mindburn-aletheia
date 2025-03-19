# Worker Core

Core functionality for worker-related operations in the Mindburn Aletheia platform.

## Features

- Unified worker profile management
- Task handling and submission
- Evidence management
- Worker statistics and reputation
- Configurable preferences
- Session management
- Error handling

## Installation

```bash
pnpm add @mindburn/workerCore
```

## Usage

### Worker Service

The `WorkerService` class provides the core functionality:

```typescript
import { WorkerService } from '@mindburn/workerCore';

// Initialize the service
const service = new WorkerService({
  apiBaseUrl: 'https://api.example.com'
});

// Get worker profile
const profile = await service.getProfile('workerId');

// Get available tasks
const tasks = await service.getAvailableTasks('workerId');

// Accept a task
const assignment = await service.acceptTask('workerId', 'taskId');

// Submit verification result
await service.submitVerification({
  workerId: 'workerId',
  taskId: 'taskId',
  result: 'approved',
  confidence: 0.95,
  timeSpent: 45000  // ms
});
```

### Types

The package exports all necessary types:

```typescript
import {
  WorkerProfile,
  WorkerPreferences,
  TaskAssignment,
  WorkSession,
  TaskSubmission,
  WorkerStats,
  ValidationResult,
} from '@mindburn/workerCore';
```

### React Integration

For web applications, use the provided React context:

```typescript
import { WorkerProvider, useWorker } from '@mindburn/workerCore/react';

function App() {
  return (
    <WorkerProvider>
      <WorkerDashboard />
    </WorkerProvider>
  );
}

function WorkerDashboard() {
  const {
    profile,
    tasks,
    acceptTask,
    submitTask,
    error
  } = useWorker();

  // Use the worker context
}
```

### Bot Integration

For Telegram bots, use the provided bot service:

```typescript
import { BotService } from '@mindburn/workerCore/bot';

// Initialize bot service
const botService = new BotService();

// Handle worker commands
botService.handleProfileCommand(ctx);
```

## Configuration

The worker core can be configured through environment variables:

```env
WORKER_API_ENDPOINT=https://api.example.com
WORKER_API_KEY=your-api-key
MAX_CONCURRENT_TASKS=5
EVIDENCE_UPLOAD_BUCKET=your-s3-bucket
```

## Error Handling

The package provides standardized error handling:

```typescript
try {
  await service.submitTask(submission);
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
  } else if (error instanceof AuthenticationError) {
    // Handle auth errors
  } else {
    // Handle other errors
  }
}
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests for any new functionality
4. Submit a pull request

## License

MIT

## API

See the [API documentation](./docs/API.md) for detailed information.
