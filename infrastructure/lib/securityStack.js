"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityStack = void 0;
const cdk = require("aws-cdk-lib");
const kms = require("aws-cdk-lib/aws-kms");
const wafv2 = require("aws-cdk-lib/aws-wafv2");
const cloudtrail = require("aws-cdk-lib/aws-cloudtrail");
const secretsmanager = require("aws-cdk-lib/aws-secretsmanager");
const cognito = require("aws-cdk-lib/aws-cognito");
const s3 = require("aws-cdk-lib/aws-s3");
class SecurityStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // KMS Key for field-level encryption
        this.encryptionKey = new kms.Key(this, 'FieldEncryptionKey', {
            enableKeyRotation: true,
            description: `Aletheia ${props.environment} field encryption key`,
            alias: `aletheia/${props.environment}/field-encryption`,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        // Secrets Manager for credentials
        const botToken = new secretsmanager.Secret(this, 'BotToken', {
            secretName: `/aletheia/${props.environment}/bot-token`,
            description: 'Telegram Bot Token',
            encryptionKey: this.encryptionKey,
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ version: '1' }),
                generateStringKey: 'token',
            },
        });
        // Cognito User Pool
        this.userPool = new cognito.UserPool(this, 'UserPool', {
            userPoolName: `aletheia-${props.environment}-users`,
            selfSignUpEnabled: false,
            signInAliases: {
                email: true,
            },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true,
                },
            },
            passwordPolicy: {
                minLength: 12,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        // Admin user group
        const adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
            userPoolId: this.userPool.userPoolId,
            groupName: 'Admins',
            description: 'Administrator group',
        });
        // WAF for API Gateway
        this.apiWaf = new wafv2.CfnWebACL(this, 'ApiWaf', {
            defaultAction: { allow: {} },
            scope: 'REGIONAL',
            visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: `aletheia-${props.environment}-waf`,
                sampledRequestsEnabled: true,
            },
            name: `aletheia-${props.environment}-waf`,
            rules: [
                {
                    name: 'RateLimit',
                    priority: 1,
                    statement: {
                        rateBasedStatement: {
                            limit: 2000,
                            aggregateKeyType: 'IP',
                        },
                    },
                    action: { block: {} },
                    visibilityConfig: {
                        cloudWatchMetricsEnabled: true,
                        metricName: 'RateLimit',
                        sampledRequestsEnabled: true,
                    },
                },
                {
                    name: 'SQLInjection',
                    priority: 2,
                    statement: {
                        sqliMatchStatement: {
                            fieldToMatch: {
                                body: {},
                            },
                            textTransformations: [{ priority: 1, type: 'NONE' }],
                        },
                    },
                    action: { block: {} },
                    visibilityConfig: {
                        cloudWatchMetricsEnabled: true,
                        metricName: 'SQLInjection',
                        sampledRequestsEnabled: true,
                    },
                },
                {
                    name: 'XSS',
                    priority: 3,
                    statement: {
                        xssMatchStatement: {
                            fieldToMatch: {
                                body: {},
                            },
                            textTransformations: [{ priority: 1, type: 'NONE' }],
                        },
                    },
                    action: { block: {} },
                    visibilityConfig: {
                        cloudWatchMetricsEnabled: true,
                        metricName: 'XSS',
                        sampledRequestsEnabled: true,
                    },
                },
            ],
        });
        // CloudTrail for audit logging
        const trailBucket = new s3.Bucket(this, 'AuditLogsBucket', {
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            versioned: true,
            lifecycleRules: [
                {
                    expiration: cdk.Duration.days(365),
                    transitions: [
                        {
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(30),
                        },
                        {
                            storageClass: s3.StorageClass.GLACIER,
                            transitionAfter: cdk.Duration.days(90),
                        },
                    ],
                },
            ],
        });
        const trail = new cloudtrail.Trail(this, 'AuditTrail', {
            bucket: trailBucket,
            enableFileValidation: true,
            includeGlobalServiceEvents: true,
            isMultiRegionTrail: true,
            trailName: `aletheia-${props.environment}-audit`,
        });
        // Outputs
        new cdk.CfnOutput(this, 'UserPoolId', {
            value: this.userPool.userPoolId,
        });
        new cdk.CfnOutput(this, 'WafArn', {
            value: this.apiWaf.attrArn,
        });
        new cdk.CfnOutput(this, 'EncryptionKeyArn', {
            value: this.encryptionKey.keyArn,
        });
    }
}
exports.SecurityStack = SecurityStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjdXJpdHlTdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlY3VyaXR5U3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLDJDQUEyQztBQUMzQywrQ0FBK0M7QUFDL0MseURBQXlEO0FBQ3pELGlFQUFpRTtBQUNqRSxtREFBbUQ7QUFFbkQseUNBQXlDO0FBUXpDLE1BQWEsYUFBYyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBSzFDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBeUI7UUFDakUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIscUNBQXFDO1FBQ3JDLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUMzRCxpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLFdBQVcsRUFBRSxZQUFZLEtBQUssQ0FBQyxXQUFXLHVCQUF1QjtZQUNqRSxLQUFLLEVBQUUsWUFBWSxLQUFLLENBQUMsV0FBVyxtQkFBbUI7WUFDdkQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtTQUN4QyxDQUFDLENBQUM7UUFFSCxrQ0FBa0M7UUFDbEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxjQUFjLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUU7WUFDM0QsVUFBVSxFQUFFLGFBQWEsS0FBSyxDQUFDLFdBQVcsWUFBWTtZQUN0RCxXQUFXLEVBQUUsb0JBQW9CO1lBQ2pDLGFBQWEsRUFBRSxJQUFJLENBQUMsYUFBYTtZQUNqQyxvQkFBb0IsRUFBRTtnQkFDcEIsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQztnQkFDdEQsaUJBQWlCLEVBQUUsT0FBTzthQUMzQjtTQUNGLENBQUMsQ0FBQztRQUVILG9CQUFvQjtRQUNw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QkFBa0IsRUFBRSxJQUFJO1lBQ3hCLFNBQVMsRUFBRSxZQUFZLEtBQUssQ0FBQyxXQUFXLFFBQVE7U0FDakQsQ0FBQyxDQUFDO1FBRUgsVUFBVTtRQUNWLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3BDLEtBQUssRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVU7U0FDaEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDaEMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTztTQUMzQixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU07U0FDakMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBeEtELHNDQXdLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBrbXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWttcyc7XG5pbXBvcnQgKiBhcyB3YWZ2MiBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtd2FmdjInO1xuaW1wb3J0ICogYXMgY2xvdWR0cmFpbCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR0cmFpbCc7XG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VjdXJpdHlTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICBhZG1pbkVtYWlsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTZWN1cml0eVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGVuY3J5cHRpb25LZXk6IGttcy5LZXk7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbDogY29nbml0by5Vc2VyUG9vbDtcbiAgcHVibGljIHJlYWRvbmx5IGFwaVdhZjogd2FmdjIuQ2ZuV2ViQUNMO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBTZWN1cml0eVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIEtNUyBLZXkgZm9yIGZpZWxkLWxldmVsIGVuY3J5cHRpb25cbiAgICB0aGlzLmVuY3J5cHRpb25LZXkgPSBuZXcga21zLktleSh0aGlzLCAnRmllbGRFbmNyeXB0aW9uS2V5Jywge1xuICAgICAgZW5hYmxlS2V5Um90YXRpb246IHRydWUsXG4gICAgICBkZXNjcmlwdGlvbjogYEFsZXRoZWlhICR7cHJvcHMuZW52aXJvbm1lbnR9IGZpZWxkIGVuY3J5cHRpb24ga2V5YCxcbiAgICAgIGFsaWFzOiBgYWxldGhlaWEvJHtwcm9wcy5lbnZpcm9ubWVudH0vZmllbGQtZW5jcnlwdGlvbmAsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgfSk7XG5cbiAgICAvLyBTZWNyZXRzIE1hbmFnZXIgZm9yIGNyZWRlbnRpYWxzXG4gICAgY29uc3QgYm90VG9rZW4gPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsICdCb3RUb2tlbicsIHtcbiAgICAgIHNlY3JldE5hbWU6IGAvYWxldGhlaWEvJHtwcm9wcy5lbnZpcm9ubWVudH0vYm90LXRva2VuYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVGVsZWdyYW0gQm90IFRva2VuJyxcbiAgICAgIGVuY3J5cHRpb25LZXk6IHRoaXMuZW5jcnlwdGlvbktleSxcbiAgICAgIGdlbmVyYXRlU2VjcmV0U3RyaW5nOiB7XG4gICAgICAgIHNlY3JldFN0cmluZ1RlbXBsYXRlOiBKU09OLnN0cmluZ2lmeSh7IHZlcnNpb246ICcxJyB9KSxcbiAgICAgICAgZ2VuZXJhdGVTdHJpbmdLZXk6ICd0b2tlbicsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ29nbml0byBVc2VyIFBvb2xcbiAgICB0aGlzLnVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ1VzZXJQb29sJywge1xuICAgICAgdXNlclBvb2xOYW1lOiBgYWxldGhlaWEtJHtwcm9wcy5lbnZpcm9ubWVudH0tdXNlcnNgLFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IGZhbHNlLFxuICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcbiAgICAgICAgZW1haWw6IHtcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHBhc3N3b3JkUG9saWN5OiB7XG4gICAgICAgIG1pbkxlbmd0aDogMTIsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KTtcblxuICAgIC8vIEFkbWluIHVzZXIgZ3JvdXBcbiAgICBjb25zdCBhZG1pbkdyb3VwID0gbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCAnQWRtaW5Hcm91cCcsIHtcbiAgICAgIHVzZXJQb29sSWQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGdyb3VwTmFtZTogJ0FkbWlucycsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FkbWluaXN0cmF0b3IgZ3JvdXAnLFxuICAgIH0pO1xuXG4gICAgLy8gV0FGIGZvciBBUEkgR2F0ZXdheVxuICAgIHRoaXMuYXBpV2FmID0gbmV3IHdhZnYyLkNmbldlYkFDTCh0aGlzLCAnQXBpV2FmJywge1xuICAgICAgZGVmYXVsdEFjdGlvbjogeyBhbGxvdzoge30gfSxcbiAgICAgIHNjb3BlOiAnUkVHSU9OQUwnLFxuICAgICAgdmlzaWJpbGl0eUNvbmZpZzoge1xuICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgIG1ldHJpY05hbWU6IGBhbGV0aGVpYS0ke3Byb3BzLmVudmlyb25tZW50fS13YWZgLFxuICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIG5hbWU6IGBhbGV0aGVpYS0ke3Byb3BzLmVudmlyb25tZW50fS13YWZgLFxuICAgICAgcnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdSYXRlTGltaXQnLFxuICAgICAgICAgIHByaW9yaXR5OiAxLFxuICAgICAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICAgICAgcmF0ZUJhc2VkU3RhdGVtZW50OiB7XG4gICAgICAgICAgICAgIGxpbWl0OiAyMDAwLFxuICAgICAgICAgICAgICBhZ2dyZWdhdGVLZXlUeXBlOiAnSVAnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGFjdGlvbjogeyBibG9jazoge30gfSxcbiAgICAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnUmF0ZUxpbWl0JyxcbiAgICAgICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdTUUxJbmplY3Rpb24nLFxuICAgICAgICAgIHByaW9yaXR5OiAyLFxuICAgICAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICAgICAgc3FsaU1hdGNoU3RhdGVtZW50OiB7XG4gICAgICAgICAgICAgIGZpZWxkVG9NYXRjaDoge1xuICAgICAgICAgICAgICAgIGJvZHk6IHt9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB0ZXh0VHJhbnNmb3JtYXRpb25zOiBbeyBwcmlvcml0eTogMSwgdHlwZTogJ05PTkUnIH1dLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGFjdGlvbjogeyBibG9jazoge30gfSxcbiAgICAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiAnU1FMSW5qZWN0aW9uJyxcbiAgICAgICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdYU1MnLFxuICAgICAgICAgIHByaW9yaXR5OiAzLFxuICAgICAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICAgICAgeHNzTWF0Y2hTdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgICAgZmllbGRUb01hdGNoOiB7XG4gICAgICAgICAgICAgICAgYm9keToge30sXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHRleHRUcmFuc2Zvcm1hdGlvbnM6IFt7IHByaW9yaXR5OiAxLCB0eXBlOiAnTk9ORScgfV0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYWN0aW9uOiB7IGJsb2NrOiB7fSB9LFxuICAgICAgICAgIHZpc2liaWxpdHlDb25maWc6IHtcbiAgICAgICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIG1ldHJpY05hbWU6ICdYU1MnLFxuICAgICAgICAgICAgc2FtcGxlZFJlcXVlc3RzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkVHJhaWwgZm9yIGF1ZGl0IGxvZ2dpbmdcbiAgICBjb25zdCB0cmFpbEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0F1ZGl0TG9nc0J1Y2tldCcsIHtcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICBlbmZvcmNlU1NMOiB0cnVlLFxuICAgICAgdmVyc2lvbmVkOiB0cnVlLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuSU5GUkVRVUVOVF9BQ0NFU1MsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuR0xBQ0lFUixcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyg5MCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdHJhaWwgPSBuZXcgY2xvdWR0cmFpbC5UcmFpbCh0aGlzLCAnQXVkaXRUcmFpbCcsIHtcbiAgICAgIGJ1Y2tldDogdHJhaWxCdWNrZXQsXG4gICAgICBlbmFibGVGaWxlVmFsaWRhdGlvbjogdHJ1ZSxcbiAgICAgIGluY2x1ZGVHbG9iYWxTZXJ2aWNlRXZlbnRzOiB0cnVlLFxuICAgICAgaXNNdWx0aVJlZ2lvblRyYWlsOiB0cnVlLFxuICAgICAgdHJhaWxOYW1lOiBgYWxldGhlaWEtJHtwcm9wcy5lbnZpcm9ubWVudH0tYXVkaXRgLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbElkJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXYWZBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGlXYWYuYXR0ckFybixcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFbmNyeXB0aW9uS2V5QXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuZW5jcnlwdGlvbktleS5rZXlBcm4sXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==