"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTaskQueues = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_sqs_1 = require("aws-cdk-lib/aws-sqs");
const createTaskQueues = (scope) => {
    // DLQ for failed task assignments
    const taskDLQ = new aws_sqs_1.Queue(scope, 'TaskAssignmentDLQ', {
        queueName: 'task-assignment-dlq',
        encryption: aws_sqs_1.QueueEncryption.KMS_MANAGED,
        retentionPeriod: aws_cdk_lib_1.Duration.days(14),
    });
    // Main task assignment queue
    const taskAssignmentQueue = new aws_sqs_1.Queue(scope, 'TaskAssignmentQueue', {
        queueName: 'task-assignment-queue',
        encryption: aws_sqs_1.QueueEncryption.KMS_MANAGED,
        visibilityTimeout: aws_cdk_lib_1.Duration.minutes(5),
        deadLetterQueue: {
            queue: taskDLQ,
            maxReceiveCount: 3,
        },
    });
    // Task expiration queue with delayed processing
    const taskExpirationQueue = new aws_sqs_1.Queue(scope, 'TaskExpirationQueue', {
        queueName: 'task-expiration-queue',
        encryption: aws_sqs_1.QueueEncryption.KMS_MANAGED,
        visibilityTimeout: aws_cdk_lib_1.Duration.minutes(5),
        deadLetterQueue: {
            queue: taskDLQ,
            maxReceiveCount: 3,
        },
    });
    // Results processing queue
    const resultsDLQ = new aws_sqs_1.Queue(scope, 'ResultsProcessingDLQ', {
        queueName: 'results-processing-dlq',
        encryption: aws_sqs_1.QueueEncryption.KMS_MANAGED,
        retentionPeriod: aws_cdk_lib_1.Duration.days(14),
    });
    const resultsProcessingQueue = new aws_sqs_1.Queue(scope, 'ResultsProcessingQueue', {
        queueName: 'results-processing-queue',
        encryption: aws_sqs_1.QueueEncryption.KMS_MANAGED,
        visibilityTimeout: aws_cdk_lib_1.Duration.minutes(10),
        deadLetterQueue: {
            queue: resultsDLQ,
            maxReceiveCount: 3,
        },
    });
    return {
        taskAssignmentQueue,
        taskExpirationQueue,
        resultsProcessingQueue,
        taskDLQ,
        resultsDLQ,
    };
};
exports.createTaskQueues = createTaskQueues;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVldWVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicXVldWVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUF1QztBQUN2QyxpREFBOEU7QUFFdkUsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLEtBQVUsRUFBRSxFQUFFO0lBQzdDLGtDQUFrQztJQUNsQyxNQUFNLE9BQU8sR0FBRyxJQUFJLGVBQUssQ0FBQyxLQUFLLEVBQUUsbUJBQW1CLEVBQUU7UUFDcEQsU0FBUyxFQUFFLHFCQUFxQjtRQUNoQyxVQUFVLEVBQUUseUJBQWUsQ0FBQyxXQUFXO1FBQ3ZDLGVBQWUsRUFBRSxzQkFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7S0FDbkMsQ0FBQyxDQUFDO0lBRUgsNkJBQTZCO0lBQzdCLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxlQUFLLENBQUMsS0FBSyxFQUFFLHFCQUFxQixFQUFFO1FBQ2xFLFNBQVMsRUFBRSx1QkFBdUI7UUFDbEMsVUFBVSxFQUFFLHlCQUFlLENBQUMsV0FBVztRQUN2QyxpQkFBaUIsRUFBRSxzQkFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDdEMsZUFBZSxFQUFFO1lBQ2YsS0FBSyxFQUFFLE9BQU87WUFDZCxlQUFlLEVBQUUsQ0FBQztTQUNuQjtLQUNGLENBQUMsQ0FBQztJQUVILGdEQUFnRDtJQUNoRCxNQUFNLG1CQUFtQixHQUFHLElBQUksZUFBSyxDQUFDLEtBQUssRUFBRSxxQkFBcUIsRUFBRTtRQUNsRSxTQUFTLEVBQUUsdUJBQXVCO1FBQ2xDLFVBQVUsRUFBRSx5QkFBZSxDQUFDLFdBQVc7UUFDdkMsaUJBQWlCLEVBQUUsc0JBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ3RDLGVBQWUsRUFBRTtZQUNmLEtBQUssRUFBRSxPQUFPO1lBQ2QsZUFBZSxFQUFFLENBQUM7U0FDbkI7S0FDRixDQUFDLENBQUM7SUFFSCwyQkFBMkI7SUFDM0IsTUFBTSxVQUFVLEdBQUcsSUFBSSxlQUFLLENBQUMsS0FBSyxFQUFFLHNCQUFzQixFQUFFO1FBQzFELFNBQVMsRUFBRSx3QkFBd0I7UUFDbkMsVUFBVSxFQUFFLHlCQUFlLENBQUMsV0FBVztRQUN2QyxlQUFlLEVBQUUsc0JBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO0tBQ25DLENBQUMsQ0FBQztJQUVILE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxlQUFLLENBQUMsS0FBSyxFQUFFLHdCQUF3QixFQUFFO1FBQ3hFLFNBQVMsRUFBRSwwQkFBMEI7UUFDckMsVUFBVSxFQUFFLHlCQUFlLENBQUMsV0FBVztRQUN2QyxpQkFBaUIsRUFBRSxzQkFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDdkMsZUFBZSxFQUFFO1lBQ2YsS0FBSyxFQUFFLFVBQVU7WUFDakIsZUFBZSxFQUFFLENBQUM7U0FDbkI7S0FDRixDQUFDLENBQUM7SUFFSCxPQUFPO1FBQ0wsbUJBQW1CO1FBQ25CLG1CQUFtQjtRQUNuQixzQkFBc0I7UUFDdEIsT0FBTztRQUNQLFVBQVU7S0FDWCxDQUFDO0FBQ0osQ0FBQyxDQUFDO0FBdERXLFFBQUEsZ0JBQWdCLG9CQXNEM0IiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEdXJhdGlvbiB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IERlYWRMZXR0ZXJRdWV1ZSwgUXVldWUsIFF1ZXVlRW5jcnlwdGlvbiB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zcXMnO1xuXG5leHBvcnQgY29uc3QgY3JlYXRlVGFza1F1ZXVlcyA9IChzY29wZTogYW55KSA9PiB7XG4gIC8vIERMUSBmb3IgZmFpbGVkIHRhc2sgYXNzaWdubWVudHNcbiAgY29uc3QgdGFza0RMUSA9IG5ldyBRdWV1ZShzY29wZSwgJ1Rhc2tBc3NpZ25tZW50RExRJywge1xuICAgIHF1ZXVlTmFtZTogJ3Rhc2stYXNzaWdubWVudC1kbHEnLFxuICAgIGVuY3J5cHRpb246IFF1ZXVlRW5jcnlwdGlvbi5LTVNfTUFOQUdFRCxcbiAgICByZXRlbnRpb25QZXJpb2Q6IER1cmF0aW9uLmRheXMoMTQpLFxuICB9KTtcblxuICAvLyBNYWluIHRhc2sgYXNzaWdubWVudCBxdWV1ZVxuICBjb25zdCB0YXNrQXNzaWdubWVudFF1ZXVlID0gbmV3IFF1ZXVlKHNjb3BlLCAnVGFza0Fzc2lnbm1lbnRRdWV1ZScsIHtcbiAgICBxdWV1ZU5hbWU6ICd0YXNrLWFzc2lnbm1lbnQtcXVldWUnLFxuICAgIGVuY3J5cHRpb246IFF1ZXVlRW5jcnlwdGlvbi5LTVNfTUFOQUdFRCxcbiAgICB2aXNpYmlsaXR5VGltZW91dDogRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICBkZWFkTGV0dGVyUXVldWU6IHtcbiAgICAgIHF1ZXVlOiB0YXNrRExRLFxuICAgICAgbWF4UmVjZWl2ZUNvdW50OiAzLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIFRhc2sgZXhwaXJhdGlvbiBxdWV1ZSB3aXRoIGRlbGF5ZWQgcHJvY2Vzc2luZ1xuICBjb25zdCB0YXNrRXhwaXJhdGlvblF1ZXVlID0gbmV3IFF1ZXVlKHNjb3BlLCAnVGFza0V4cGlyYXRpb25RdWV1ZScsIHtcbiAgICBxdWV1ZU5hbWU6ICd0YXNrLWV4cGlyYXRpb24tcXVldWUnLFxuICAgIGVuY3J5cHRpb246IFF1ZXVlRW5jcnlwdGlvbi5LTVNfTUFOQUdFRCxcbiAgICB2aXNpYmlsaXR5VGltZW91dDogRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICBkZWFkTGV0dGVyUXVldWU6IHtcbiAgICAgIHF1ZXVlOiB0YXNrRExRLFxuICAgICAgbWF4UmVjZWl2ZUNvdW50OiAzLFxuICAgIH0sXG4gIH0pO1xuXG4gIC8vIFJlc3VsdHMgcHJvY2Vzc2luZyBxdWV1ZVxuICBjb25zdCByZXN1bHRzRExRID0gbmV3IFF1ZXVlKHNjb3BlLCAnUmVzdWx0c1Byb2Nlc3NpbmdETFEnLCB7XG4gICAgcXVldWVOYW1lOiAncmVzdWx0cy1wcm9jZXNzaW5nLWRscScsXG4gICAgZW5jcnlwdGlvbjogUXVldWVFbmNyeXB0aW9uLktNU19NQU5BR0VELFxuICAgIHJldGVudGlvblBlcmlvZDogRHVyYXRpb24uZGF5cygxNCksXG4gIH0pO1xuXG4gIGNvbnN0IHJlc3VsdHNQcm9jZXNzaW5nUXVldWUgPSBuZXcgUXVldWUoc2NvcGUsICdSZXN1bHRzUHJvY2Vzc2luZ1F1ZXVlJywge1xuICAgIHF1ZXVlTmFtZTogJ3Jlc3VsdHMtcHJvY2Vzc2luZy1xdWV1ZScsXG4gICAgZW5jcnlwdGlvbjogUXVldWVFbmNyeXB0aW9uLktNU19NQU5BR0VELFxuICAgIHZpc2liaWxpdHlUaW1lb3V0OiBEdXJhdGlvbi5taW51dGVzKDEwKSxcbiAgICBkZWFkTGV0dGVyUXVldWU6IHtcbiAgICAgIHF1ZXVlOiByZXN1bHRzRExRLFxuICAgICAgbWF4UmVjZWl2ZUNvdW50OiAzLFxuICAgIH0sXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgdGFza0Fzc2lnbm1lbnRRdWV1ZSxcbiAgICB0YXNrRXhwaXJhdGlvblF1ZXVlLFxuICAgIHJlc3VsdHNQcm9jZXNzaW5nUXVldWUsXG4gICAgdGFza0RMUSxcbiAgICByZXN1bHRzRExRLFxuICB9O1xufTtcbiJdfQ==