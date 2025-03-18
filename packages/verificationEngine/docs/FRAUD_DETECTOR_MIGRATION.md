# Fraud Detector Migration Guide

This document provides instructions for migrating from the legacy `FraudDetector` and `AdvancedFraudDetector` classes to the new consolidated implementation.

## Overview

The verification system previously used two separate fraud detection implementations:

1. `src/verification/FraudDetector.ts` - Basic fraud detection capabilities
2. `src/verification/AdvancedFraudDetector.ts` - Enhanced detection with additional features

These have been consolidated into a single, more powerful implementation at:
`packages/verification-engine/src/fraud-detection/FraudDetector.ts`

## Key Benefits

- **Single source of truth**: One comprehensive implementation rather than multiple overlapping ones
- **Improved modularity**: Better separation of concerns with specialized detection methods
- **Enhanced configurability**: Fully configurable thresholds and weights
- **Better testability**: Simpler to write unit tests with clearly defined components
- **Reduced code duplication**: Shared types and utilities

## Migration Steps

### 1. Update Import Statements

Replace:
```typescript
import { FraudDetector } from '../verification/FraudDetector';
// or
import { AdvancedFraudDetector } from '../verification/AdvancedFraudDetector';
```

With:
```typescript
import { FraudDetector } from '@mindburn/verification-engine/fraud-detection';
```

### 2. Update Constructor Parameters

The new `FraudDetector` constructor accepts optional parameters:

```typescript
const fraudDetector = new FraudDetector(
  dynamodbClient, // Optional: DynamoDB.DocumentClient
  cloudwatchClient, // Optional: CloudWatch
  {
    // Optional configuration overrides (all fields optional)
    timeWindowMinutes: 90, // Override default 60
    maxTasksPerHour: 50 // Override default 100
    // ... other config options
  }
);
```

### 3. Update Method Calls

The primary method for detecting fraud has been standardized to `detectFraud`:

```typescript
const result = await fraudDetector.detectFraud({
  workerId: '123',
  taskId: 'task-456',
  taskType: 'image-labeling',
  content: {...}, // The task content
  deviceFingerprint: {...}, // Optional
  ipAddress: '192.168.1.1', // Optional
  processingTime: 45000 // in milliseconds
});
```

### 4. Update Result Handling

The response format has been standardized:

```typescript
interface FraudDetectionResult {
  isFraudulent: boolean;
  riskScore: number;
  fraudLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence?: number;
  reasons?: string[];
  actions?: string[];
  signals?: {
    reputation: number;
    activity: number;
    network: number;
    quality: number;
  };
}
```

Update your code that handles the fraud detection results to match this structure.

### 5. Feature Flag Removal

If you were using feature flags to toggle between the basic and advanced fraud detection, you can remove those flags since all features are now available in the consolidated implementation:

```typescript
// BEFORE:
const detector = config.isFeatureEnabled('enableAdvancedFraudDetection')
  ? new AdvancedFraudDetector()
  : new FraudDetector();

// AFTER:
const detector = new FraudDetector();
```

## Configuration Options

The new implementation supports the following configuration options:

| Option | Default | Description |
|--------|---------|-------------|
| `timeWindowMinutes` | 60 | Time window for activity analysis (in minutes) |
| `maxTasksPerHour` | 100 | Maximum allowed tasks per hour before flagging |
| `minProcessingTimeMs` | 3000 | Minimum acceptable task processing time (ms) |
| `maxSimilarityScore` | 0.95 | Threshold for content similarity detection |
| `maxIpTaskCount` | 50 | Maximum tasks from the same IP address |
| `deviceFingerprintTTL` | 86400 | Time-to-live for device fingerprint cache (seconds) |
| `workerReputationWeight` | 0.3 | Weight for worker reputation in risk calculation |
| `activityPatternWeight` | 0.3 | Weight for activity patterns in risk calculation |
| `networkSignalsWeight` | 0.2 | Weight for network signals in risk calculation |
| `qualityMetricsWeight` | 0.2 | Weight for quality metrics in risk calculation |

## Troubleshooting

### Common Issues

1. **Missing required parameters**: Ensure you're providing all required parameters to the `detectFraud` method.
2. **Unexpected risk scores**: Check the configuration values you're using. The default weights and thresholds may differ from the old implementations.
3. **Integration with other services**: The new implementation uses the same DynamoDB tables as before, but the metrics collection has been enhanced.

## Need Help?

If you encounter any issues during migration, please contact the Verification Engine team. 