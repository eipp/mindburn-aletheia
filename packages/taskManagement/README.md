# Task Management System

A robust task management system for Mindburn Aletheia that handles task creation, assignment, completion, and worker matching.

## Features

- **Task Lifecycle Management**
  - Task creation with validation
  - Status transitions with state machine validation
  - Task expiration handling
  - Task cancellation with refund support

- **Worker Matching**
  - Skill-based matching with level consideration
  - Language proficiency matching
  - Performance history analysis
  - Reputation-based scoring
  - Workload balancing
  - Real-time availability tracking

- **Event-Driven Architecture**
  - Status change events
  - Worker notifications
  - Task expiration events
  - Cancellation events with refund triggers

## Usage

### Worker Matcher

```typescript
import { WorkerMatcher } from '@mindburn/task-management';

const matcher = new WorkerMatcher({
  minMatchScore: 0.7,
  workersTableName: 'workers-table-name',
  maxTasksPerWorker: 5
});

const eligibleWorkers = await matcher.findEligibleWorkers(task, {
  taskType: 'verification',
  requiredSkills: ['image-analysis', 'text-verification'],
  minLevel: 2,
  languageCodes: ['en', 'es'],
  urgency: 'high'
});
```

### Task Status Management

```typescript
import { updateTaskStatus, TaskStatus } from '@mindburn/task-management';

await updateTaskStatus(taskId, TaskStatus.ASSIGNED, workerId);
```

### Task Expiration

```typescript
import { handleExpiredTasks } from '@mindburn/task-management';

// Run periodically via EventBridge
await handleExpiredTasks();
```

### Task Cancellation

```typescript
import { cancelTask } from '@mindburn/task-management';

await cancelTask(taskId, 'Cancelled by task creator');
```

## Architecture

### DynamoDB Tables

- **Workers Table**
  - Primary Key: workerId
  - GSIs:
    - SkillLevelIndex: For skill-based queries
    - WorkerStatusIndex: For availability tracking

### Event Types

- TaskStatusChanged
- TaskExpired
- TaskCancelled
- WorkerNotification

## Configuration

The system uses the following environment variables:

- `WORKERS_TABLE`: DynamoDB table name for workers
- `WORKER_NOTIFICATIONS_TOPIC`: SNS topic ARN for worker notifications

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Lint
npm run lint
```

## Error Handling

The system implements comprehensive error handling:

- Atomic updates with optimistic locking
- Concurrent modification detection
- Event publishing retries
- Detailed error logging

## Performance Considerations

- Uses DynamoDB GSIs for efficient queries
- Implements batch operations for worker details
- Caches frequently accessed data
- Uses exponential backoff for retries

## Security

- Implements strict access controls
- Uses AWS KMS for sensitive data
- Validates all input data
- Implements rate limiting

## Monitoring

The system emits detailed logs and metrics:

- Task status transitions
- Worker matching performance
- Error rates
- Processing times

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request