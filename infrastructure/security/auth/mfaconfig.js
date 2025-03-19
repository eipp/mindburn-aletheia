"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MfaAuthStack = void 0;
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const iam = require("aws-cdk-lib/aws-iam");
class MfaAuthStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create Cognito User Pool with MFA
        const userPool = new cognito.UserPool(this, 'AdminUserPool', {
            userPoolName: 'mindburn-admin-pool',
            selfSignUpEnabled: false,
            signInAliases: {
                email: true,
            },
            mfa: cognito.Mfa.REQUIRED,
            mfaSecondFactor: {
                otp: true,
                sms: false,
            },
            passwordPolicy: {
                minLength: 12,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
                tempPasswordValidity: cdk.Duration.days(1),
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        // Create admin group
        const adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
            userPoolId: userPool.userPoolId,
            groupName: 'Administrators',
            description: 'Administrator group with elevated privileges',
            precedence: 0,
        });
        // Create IAM role for admin group
        const adminRole = new iam.Role(this, 'AdminRole', {
            assumedBy: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
            description: 'Role for Cognito Admin Group',
        });
        // Add admin permissions
        adminRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'dynamodb:*',
                'lambda:InvokeFunction',
                'kms:Decrypt',
                'secretsmanager:GetSecretValue',
            ],
            resources: ['*'],
            conditions: {
                StringEquals: {
                    'aws:RequestTag/Environment': '${environment}',
                    'aws:RequestTag/Service': 'mindburn-aletheia',
                },
                Bool: {
                    'aws:MultiFactorAuthPresent': 'true',
                },
            },
        }));
        // Create app client
        const client = userPool.addClient('AdminAppClient', {
            authFlows: {
                userPassword: true,
                adminUserPassword: true,
                custom: true,
                userSrp: true,
            },
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
                callbackUrls: ['https://admin.mindburn-aletheia.com/callback'],
            },
        });
        // Output values
        new cdk.CfnOutput(this, 'UserPoolId', {
            value: userPool.userPoolId,
        });
        new cdk.CfnOutput(this, 'UserPoolClientId', {
            value: client.userPoolClientId,
        });
    }
}
exports.MfaAuthStack = MfaAuthStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWZhY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibWZhY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyxtREFBbUQ7QUFDbkQsMkNBQTJDO0FBRzNDLE1BQWEsWUFBYSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3pDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsb0NBQW9DO1FBQ3BDLE1BQU0sUUFBUSxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQzNELFlBQVksRUFBRSxxQkFBcUI7WUFDbkMsaUJBQWlCLEVBQUUsS0FBSztZQUN4QixhQUFhLEVBQUU7Z0JBQ2IsS0FBSyxFQUFFLElBQUk7YUFDWjtZQUNELEdBQUcsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVE7WUFDekIsZUFBZSxFQUFFO2dCQUNmLEdBQUcsRUFBRSxJQUFJO2dCQUNULEdBQUcsRUFBRSxLQUFLO2FBQ1g7WUFDRCxjQUFjLEVBQUU7Z0JBQ2QsU0FBUyxFQUFFLEVBQUU7Z0JBQ2IsZ0JBQWdCLEVBQUUsSUFBSTtnQkFDdEIsZ0JBQWdCLEVBQUUsSUFBSTtnQkFDdEIsYUFBYSxFQUFFLElBQUk7Z0JBQ25CLGNBQWMsRUFBRSxJQUFJO2dCQUNwQixvQkFBb0IsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7YUFDM0M7WUFDRCxlQUFlLEVBQUUsT0FBTyxDQUFDLGVBQWUsQ0FBQyxVQUFVO1lBQ25ELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07U0FDeEMsQ0FBQyxDQUFDO1FBRUgscUJBQXFCO1FBQ3JCLE1BQU0sVUFBVSxHQUFHLElBQUksT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDbEUsVUFBVSxFQUFFLFFBQVEsQ0FBQyxVQUFVO1lBQy9CLFNBQVMsRUFBRSxnQkFBZ0I7WUFDM0IsV0FBVyxFQUFFLDhDQUE4QztZQUMzRCxVQUFVLEVBQUUsQ0FBQztTQUNkLENBQUMsQ0FBQztRQUVILGtDQUFrQztRQUNsQyxNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNoRCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsMkJBQTJCLENBQUM7WUFDaEUsV0FBVyxFQUFFLDhCQUE4QjtTQUM1QyxDQUFDLENBQUM7UUFFSCx3QkFBd0I7UUFDeEIsU0FBUyxDQUFDLFdBQVcsQ0FDbkIsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsT0FBTyxFQUFFO2dCQUNQLFlBQVk7Z0JBQ1osdUJBQXVCO2dCQUN2QixhQUFhO2dCQUNiLCtCQUErQjthQUNoQztZQUNELFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztZQUNoQixVQUFVLEVBQUU7Z0JBQ1YsWUFBWSxFQUFFO29CQUNaLDRCQUE0QixFQUFFLGdCQUFnQjtvQkFDOUMsd0JBQXdCLEVBQUUsbUJBQW1CO2lCQUM5QztnQkFDRCxJQUFJLEVBQUU7b0JBQ0osNEJBQTRCLEVBQUUsTUFBTTtpQkFDckM7YUFDRjtTQUNGLENBQUMsQ0FDSCxDQUFDO1FBRUYsb0JBQW9CO1FBQ3BCLE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLEVBQUU7WUFDbEQsU0FBUyxFQUFFO2dCQUNULFlBQVksRUFBRSxJQUFJO2dCQUNsQixpQkFBaUIsRUFBRSxJQUFJO2dCQUN2QixNQUFNLEVBQUUsSUFBSTtnQkFDWixPQUFPLEVBQUUsSUFBSTthQUNkO1lBQ0QsS0FBSyxFQUFFO2dCQUNMLEtBQUssRUFBRTtvQkFDTCxzQkFBc0IsRUFBRSxJQUFJO2lCQUM3QjtnQkFDRCxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztnQkFDekYsWUFBWSxFQUFFLENBQUMsOENBQThDLENBQUM7YUFDL0Q7U0FDRixDQUFDLENBQUM7UUFFSCxnQkFBZ0I7UUFDaEIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDcEMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxVQUFVO1NBQzNCLENBQUMsQ0FBQztRQUNILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDMUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxnQkFBZ0I7U0FDL0IsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBMUZELG9DQTBGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgY2xhc3MgTWZhQXV0aFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIENvZ25pdG8gVXNlciBQb29sIHdpdGggTUZBXG4gICAgY29uc3QgdXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCAnQWRtaW5Vc2VyUG9vbCcsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogJ21pbmRidXJuLWFkbWluLXBvb2wnLFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IGZhbHNlLFxuICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBtZmE6IGNvZ25pdG8uTWZhLlJFUVVJUkVELFxuICAgICAgbWZhU2Vjb25kRmFjdG9yOiB7XG4gICAgICAgIG90cDogdHJ1ZSxcbiAgICAgICAgc21zOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDEyLFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICByZXF1aXJlU3ltYm9sczogdHJ1ZSxcbiAgICAgICAgdGVtcFBhc3N3b3JkVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5kYXlzKDEpLFxuICAgICAgfSxcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBhZG1pbiBncm91cFxuICAgIGNvbnN0IGFkbWluR3JvdXAgPSBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsICdBZG1pbkdyb3VwJywge1xuICAgICAgdXNlclBvb2xJZDogdXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGdyb3VwTmFtZTogJ0FkbWluaXN0cmF0b3JzJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW5pc3RyYXRvciBncm91cCB3aXRoIGVsZXZhdGVkIHByaXZpbGVnZXMnLFxuICAgICAgcHJlY2VkZW5jZTogMCxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBJQU0gcm9sZSBmb3IgYWRtaW4gZ3JvdXBcbiAgICBjb25zdCBhZG1pblJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0FkbWluUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdjb2duaXRvLWlkcC5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ1JvbGUgZm9yIENvZ25pdG8gQWRtaW4gR3JvdXAnLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGFkbWluIHBlcm1pc3Npb25zXG4gICAgYWRtaW5Sb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnZHluYW1vZGI6KicsXG4gICAgICAgICAgJ2xhbWJkYTpJbnZva2VGdW5jdGlvbicsXG4gICAgICAgICAgJ2ttczpEZWNyeXB0JyxcbiAgICAgICAgICAnc2VjcmV0c21hbmFnZXI6R2V0U2VjcmV0VmFsdWUnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgICAgU3RyaW5nRXF1YWxzOiB7XG4gICAgICAgICAgICAnYXdzOlJlcXVlc3RUYWcvRW52aXJvbm1lbnQnOiAnJHtlbnZpcm9ubWVudH0nLFxuICAgICAgICAgICAgJ2F3czpSZXF1ZXN0VGFnL1NlcnZpY2UnOiAnbWluZGJ1cm4tYWxldGhlaWEnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgQm9vbDoge1xuICAgICAgICAgICAgJ2F3czpNdWx0aUZhY3RvckF1dGhQcmVzZW50JzogJ3RydWUnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBDcmVhdGUgYXBwIGNsaWVudFxuICAgIGNvbnN0IGNsaWVudCA9IHVzZXJQb29sLmFkZENsaWVudCgnQWRtaW5BcHBDbGllbnQnLCB7XG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICBhZG1pblVzZXJQYXNzd29yZDogdHJ1ZSxcbiAgICAgICAgY3VzdG9tOiB0cnVlLFxuICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIG9BdXRoOiB7XG4gICAgICAgIGZsb3dzOiB7XG4gICAgICAgICAgYXV0aG9yaXphdGlvbkNvZGVHcmFudDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgc2NvcGVzOiBbY29nbml0by5PQXV0aFNjb3BlLkVNQUlMLCBjb2duaXRvLk9BdXRoU2NvcGUuT1BFTklELCBjb2duaXRvLk9BdXRoU2NvcGUuUFJPRklMRV0sXG4gICAgICAgIGNhbGxiYWNrVXJsczogWydodHRwczovL2FkbWluLm1pbmRidXJuLWFsZXRoZWlhLmNvbS9jYWxsYmFjayddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCB2YWx1ZXNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB1c2VyUG9vbC51c2VyUG9vbElkLFxuICAgIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbENsaWVudElkJywge1xuICAgICAgdmFsdWU6IGNsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgIH0pO1xuICB9XG59XG4iXX0=