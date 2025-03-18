# Worker Core

Core functionality for Mindburn Aletheia worker interfaces, providing a unified API for both the web application and Telegram bot.

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
pnpm add @mindburn/worker-core
```

## Usage

### Worker Service

The `WorkerService` class provides the core functionality:

```typescript
import { WorkerService } from '@mindburn/worker-core';

const service = new WorkerService();

// Get worker profile
const profile = await service.getProfile('worker-id');

// Get available tasks
const tasks = await service.getAvailableTasks('worker-id');

// Accept a task
const assignment = await service.acceptTask('worker-id', 'task-id');

// Submit task results
const submission = {
  taskId: 'task-id',
  workerId: 'worker-id',
  timestamp: new Date(),
  responses: {
    answer: 'Task response'
  },
  evidence: [],
  duration: 300,
  confidence: 0.95
};

const result = await service.submitTask(submission);
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
  ValidationResult
} from '@mindburn/worker-core';
```

### React Integration

For web applications, use the provided React context:

```typescript
import { WorkerProvider, useWorker } from '@mindburn/worker-core/react';

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
    availableTasks,
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
import { BotService } from '@mindburn/worker-core/bot';

const bot = new BotService(process.env.BOT_TOKEN);
bot.start();
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