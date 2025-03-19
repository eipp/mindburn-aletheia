"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LambdaHardeningStack = void 0;
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const iam = require("aws-cdk-lib/aws-iam");
class LambdaHardeningStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create Lambda Layer for security controls
        const securityLayer = new lambda.LayerVersion(this, 'SecurityLayer', {
            code: lambda.Code.fromAsset('layers/security'),
            description: 'Security controls and RASP implementation',
            compatibleRuntimes: [lambda.Runtime.NODEJS_18_X, lambda.Runtime.NODEJS_20_X],
        });
        // Create Lambda role with restricted permissions
        const functionRole = new iam.Role(this, 'HardenedLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Hardened Lambda execution role',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });
        // Add custom policy for runtime protection
        functionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.DENY,
            actions: ['iam:*', 'lambda:UpdateFunctionCode', 'ec2:*', 's3:*'],
            resources: ['*'],
        }));
        // Lambda function configuration with hardening
        const hardenedFunctionProps = {
            runtime: lambda.Runtime.NODEJS_18_X,
            memorySize: 1792, // Optimal performance/cost
            timeout: cdk.Duration.seconds(30),
            layers: [securityLayer],
            role: functionRole,
            environment: {
                NODE_OPTIONS: '--enable-source-maps --disable-proto=throw',
                AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
                SECURITY_TRACE_ENABLED: 'true',
            },
            bundling: {
                sourceMap: true,
                minify: true,
                metadataVisible: false,
            },
            tracing: lambda.Tracing.ACTIVE,
        };
        // Output hardened function props
        new cdk.CfnOutput(this, 'SecurityLayerArn', {
            value: securityLayer.layerVersionArn,
            description: 'Security Layer ARN',
        });
    }
    // Helper method to apply hardening to existing functions
    static applyHardening(fn) {
        // Enable X-Ray tracing
        fn.addEnvironment('AWS_XRAY_DEBUG_MODE', '1');
        // Add security headers
        fn.addEnvironment('SECURE_HEADERS', JSON.stringify({
            'Content-Security-Policy': "default-src 'self'",
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
        }));
        // Add runtime protection
        fn.addEnvironment('NODE_OPTIONS', '--enable-source-maps --disable-proto=throw');
        // Enable enhanced monitoring
        fn.addEnvironment('ENHANCED_MONITORING', 'true');
    }
}
exports.LambdaHardeningStack = LambdaHardeningStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhSGFyZGVuaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGFtYmRhSGFyZGVuaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyxpREFBaUQ7QUFDakQsMkNBQTJDO0FBRzNDLE1BQWEsb0JBQXFCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDakQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw0Q0FBNEM7UUFDNUMsTUFBTSxhQUFhLEdBQUcsSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDbkUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGlCQUFpQixDQUFDO1lBQzlDLFdBQVcsRUFBRSwyQ0FBMkM7WUFDeEQsa0JBQWtCLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQztTQUM3RSxDQUFDLENBQUM7UUFFSCxpREFBaUQ7UUFDakQsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1RCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCLENBQUM7WUFDM0QsV0FBVyxFQUFFLGdDQUFnQztZQUM3QyxlQUFlLEVBQUU7Z0JBQ2YsR0FBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQywwQ0FBMEMsQ0FBQzthQUN2RjtTQUNGLENBQUMsQ0FBQztRQUVILDJDQUEyQztRQUMzQyxZQUFZLENBQUMsV0FBVyxDQUN0QixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDdEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSTtZQUN2QixPQUFPLEVBQUUsQ0FBQyxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQztZQUNoRSxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDakIsQ0FBQyxDQUNILENBQUM7UUFFRiwrQ0FBK0M7UUFDL0MsTUFBTSxxQkFBcUIsR0FBeUI7WUFDbEQsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxVQUFVLEVBQUUsSUFBSSxFQUFFLDJCQUEyQjtZQUM3QyxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLE1BQU0sRUFBRSxDQUFDLGFBQWEsQ0FBQztZQUN2QixJQUFJLEVBQUUsWUFBWTtZQUNsQixXQUFXLEVBQUU7Z0JBQ1gsWUFBWSxFQUFFLDRDQUE0QztnQkFDMUQsbUNBQW1DLEVBQUUsR0FBRztnQkFDeEMsc0JBQXNCLEVBQUUsTUFBTTthQUMvQjtZQUNELFFBQVEsRUFBRTtnQkFDUixTQUFTLEVBQUUsSUFBSTtnQkFDZixNQUFNLEVBQUUsSUFBSTtnQkFDWixlQUFlLEVBQUUsS0FBSzthQUN2QjtZQUNELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU07U0FDL0IsQ0FBQztRQUVGLGlDQUFpQztRQUNqQyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFDLEtBQUssRUFBRSxhQUFhLENBQUMsZUFBZTtZQUNwQyxXQUFXLEVBQUUsb0JBQW9CO1NBQ2xDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCx5REFBeUQ7SUFDbEQsTUFBTSxDQUFDLGNBQWMsQ0FBQyxFQUFtQjtRQUM5Qyx1QkFBdUI7UUFDdkIsRUFBRSxDQUFDLGNBQWMsQ0FBQyxxQkFBcUIsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUU5Qyx1QkFBdUI7UUFDdkIsRUFBRSxDQUFDLGNBQWMsQ0FDZixnQkFBZ0IsRUFDaEIsSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUNiLHlCQUF5QixFQUFFLG9CQUFvQjtZQUMvQyx3QkFBd0IsRUFBRSxTQUFTO1lBQ25DLGlCQUFpQixFQUFFLE1BQU07WUFDekIsa0JBQWtCLEVBQUUsZUFBZTtTQUNwQyxDQUFDLENBQ0gsQ0FBQztRQUVGLHlCQUF5QjtRQUN6QixFQUFFLENBQUMsY0FBYyxDQUFDLGNBQWMsRUFBRSw0Q0FBNEMsQ0FBQyxDQUFDO1FBRWhGLDZCQUE2QjtRQUM3QixFQUFFLENBQUMsY0FBYyxDQUFDLHFCQUFxQixFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ25ELENBQUM7Q0FDRjtBQTlFRCxvREE4RUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBjbGFzcyBMYW1iZGFIYXJkZW5pbmdTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgTGF5ZXIgZm9yIHNlY3VyaXR5IGNvbnRyb2xzXG4gICAgY29uc3Qgc2VjdXJpdHlMYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdTZWN1cml0eUxheWVyJywge1xuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYXllcnMvc2VjdXJpdHknKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgY29udHJvbHMgYW5kIFJBU1AgaW1wbGVtZW50YXRpb24nLFxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsIGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YXSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgcm9sZSB3aXRoIHJlc3RyaWN0ZWQgcGVybWlzc2lvbnNcbiAgICBjb25zdCBmdW5jdGlvblJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0hhcmRlbmVkTGFtYmRhUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdIYXJkZW5lZCBMYW1iZGEgZXhlY3V0aW9uIHJvbGUnLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBjdXN0b20gcG9saWN5IGZvciBydW50aW1lIHByb3RlY3Rpb25cbiAgICBmdW5jdGlvblJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5ERU5ZLFxuICAgICAgICBhY3Rpb25zOiBbJ2lhbToqJywgJ2xhbWJkYTpVcGRhdGVGdW5jdGlvbkNvZGUnLCAnZWMyOionLCAnczM6KiddLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGNvbmZpZ3VyYXRpb24gd2l0aCBoYXJkZW5pbmdcbiAgICBjb25zdCBoYXJkZW5lZEZ1bmN0aW9uUHJvcHM6IGxhbWJkYS5GdW5jdGlvblByb3BzID0ge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBtZW1vcnlTaXplOiAxNzkyLCAvLyBPcHRpbWFsIHBlcmZvcm1hbmNlL2Nvc3RcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGxheWVyczogW3NlY3VyaXR5TGF5ZXJdLFxuICAgICAgcm9sZTogZnVuY3Rpb25Sb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgTk9ERV9PUFRJT05TOiAnLS1lbmFibGUtc291cmNlLW1hcHMgLS1kaXNhYmxlLXByb3RvPXRocm93JyxcbiAgICAgICAgQVdTX05PREVKU19DT05ORUNUSU9OX1JFVVNFX0VOQUJMRUQ6ICcxJyxcbiAgICAgICAgU0VDVVJJVFlfVFJBQ0VfRU5BQkxFRDogJ3RydWUnLFxuICAgICAgfSxcbiAgICAgIGJ1bmRsaW5nOiB7XG4gICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcbiAgICAgICAgbWluaWZ5OiB0cnVlLFxuICAgICAgICBtZXRhZGF0YVZpc2libGU6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcbiAgICB9O1xuXG4gICAgLy8gT3V0cHV0IGhhcmRlbmVkIGZ1bmN0aW9uIHByb3BzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NlY3VyaXR5TGF5ZXJBcm4nLCB7XG4gICAgICB2YWx1ZTogc2VjdXJpdHlMYXllci5sYXllclZlcnNpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IExheWVyIEFSTicsXG4gICAgfSk7XG4gIH1cblxuICAvLyBIZWxwZXIgbWV0aG9kIHRvIGFwcGx5IGhhcmRlbmluZyB0byBleGlzdGluZyBmdW5jdGlvbnNcbiAgcHVibGljIHN0YXRpYyBhcHBseUhhcmRlbmluZyhmbjogbGFtYmRhLkZ1bmN0aW9uKTogdm9pZCB7XG4gICAgLy8gRW5hYmxlIFgtUmF5IHRyYWNpbmdcbiAgICBmbi5hZGRFbnZpcm9ubWVudCgnQVdTX1hSQVlfREVCVUdfTU9ERScsICcxJyk7XG5cbiAgICAvLyBBZGQgc2VjdXJpdHkgaGVhZGVyc1xuICAgIGZuLmFkZEVudmlyb25tZW50KFxuICAgICAgJ1NFQ1VSRV9IRUFERVJTJyxcbiAgICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgJ0NvbnRlbnQtU2VjdXJpdHktUG9saWN5JzogXCJkZWZhdWx0LXNyYyAnc2VsZidcIixcbiAgICAgICAgJ1gtQ29udGVudC1UeXBlLU9wdGlvbnMnOiAnbm9zbmlmZicsXG4gICAgICAgICdYLUZyYW1lLU9wdGlvbnMnOiAnREVOWScsXG4gICAgICAgICdYLVhTUy1Qcm90ZWN0aW9uJzogJzE7IG1vZGU9YmxvY2snLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQWRkIHJ1bnRpbWUgcHJvdGVjdGlvblxuICAgIGZuLmFkZEVudmlyb25tZW50KCdOT0RFX09QVElPTlMnLCAnLS1lbmFibGUtc291cmNlLW1hcHMgLS1kaXNhYmxlLXByb3RvPXRocm93Jyk7XG5cbiAgICAvLyBFbmFibGUgZW5oYW5jZWQgbW9uaXRvcmluZ1xuICAgIGZuLmFkZEVudmlyb25tZW50KCdFTkhBTkNFRF9NT05JVE9SSU5HJywgJ3RydWUnKTtcbiAgfVxufVxuIl19