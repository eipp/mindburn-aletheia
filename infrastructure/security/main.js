"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainSecurityStack = void 0;
const cdk = require("aws-cdk-lib");
const vpc_config_1 = require("./vpc/vpc-config");
const waf_rules_1 = require("./waf/waf-rules");
const security_dashboard_1 = require("./monitoring/security-dashboard");
const mfa_config_1 = require("./auth/mfa-config");
const lambda_hardening_1 = require("./runtime/lambda-hardening");
class MainSecurityStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Deploy VPC with security configuration
        const vpcStack = new vpc_config_1.SecureVpcStack(this, 'SecureVPC', {
            env: {
                account: props.accountId,
                region: props.env?.region,
            },
        });
        // Deploy WAF rules
        const wafStack = new waf_rules_1.WafStack(this, 'WAFRules', {
            env: {
                account: props.accountId,
                region: props.env?.region,
            },
        });
        // Deploy security monitoring
        const monitoringStack = new security_dashboard_1.SecurityDashboardStack(this, 'SecurityMonitoring', {
            env: {
                account: props.accountId,
                region: props.env?.region,
            },
        });
        // Deploy MFA configuration
        const mfaStack = new mfa_config_1.MfaAuthStack(this, 'MFAAuth', {
            env: {
                account: props.accountId,
                region: props.env?.region,
            },
        });
        // Deploy Lambda hardening
        const lambdaHardeningStack = new lambda_hardening_1.LambdaHardeningStack(this, 'LambdaHardening', {
            env: {
                account: props.accountId,
                region: props.env?.region,
            },
        });
        // Tag all resources
        cdk.Tags.of(this).add('Environment', props.environment);
        cdk.Tags.of(this).add('Service', 'mindburn-aletheia');
        cdk.Tags.of(this).add('SecurityLevel', 'high');
        // Output security configuration
        new cdk.CfnOutput(this, 'SecurityConfig', {
            value: JSON.stringify({
                vpcId: vpcStack.vpcId,
                wafAclId: wafStack.webAclId,
                userPoolId: mfaStack.userPoolId,
                securityDashboard: monitoringStack.dashboardName,
            }, null, 2),
            description: 'Security Configuration Summary',
        });
    }
}
exports.MainSecurityStack = MainSecurityStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBRW5DLGlEQUFrRDtBQUNsRCwrQ0FBMkM7QUFDM0Msd0VBQXlFO0FBQ3pFLGtEQUFpRDtBQUNqRCxpRUFBa0U7QUFPbEUsTUFBYSxpQkFBa0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUM5QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXlCO1FBQ2pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLHlDQUF5QztRQUN6QyxNQUFNLFFBQVEsR0FBRyxJQUFJLDJCQUFjLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNyRCxHQUFHLEVBQUU7Z0JBQ0gsT0FBTyxFQUFFLEtBQUssQ0FBQyxTQUFTO2dCQUN4QixNQUFNLEVBQUUsS0FBSyxDQUFDLEdBQUcsRUFBRSxNQUFNO2FBQzFCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsbUJBQW1CO1FBQ25CLE1BQU0sUUFBUSxHQUFHLElBQUksb0JBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQzlDLEdBQUcsRUFBRTtnQkFDSCxPQUFPLEVBQUUsS0FBSyxDQUFDLFNBQVM7Z0JBQ3hCLE1BQU0sRUFBRSxLQUFLLENBQUMsR0FBRyxFQUFFLE1BQU07YUFDMUI7U0FDRixDQUFDLENBQUM7UUFFSCw2QkFBNkI7UUFDN0IsTUFBTSxlQUFlLEdBQUcsSUFBSSwyQ0FBc0IsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDN0UsR0FBRyxFQUFFO2dCQUNILE9BQU8sRUFBRSxLQUFLLENBQUMsU0FBUztnQkFDeEIsTUFBTSxFQUFFLEtBQUssQ0FBQyxHQUFHLEVBQUUsTUFBTTthQUMxQjtTQUNGLENBQUMsQ0FBQztRQUVILDJCQUEyQjtRQUMzQixNQUFNLFFBQVEsR0FBRyxJQUFJLHlCQUFZLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRTtZQUNqRCxHQUFHLEVBQUU7Z0JBQ0gsT0FBTyxFQUFFLEtBQUssQ0FBQyxTQUFTO2dCQUN4QixNQUFNLEVBQUUsS0FBSyxDQUFDLEdBQUcsRUFBRSxNQUFNO2FBQzFCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsMEJBQTBCO1FBQzFCLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSx1Q0FBb0IsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDN0UsR0FBRyxFQUFFO2dCQUNILE9BQU8sRUFBRSxLQUFLLENBQUMsU0FBUztnQkFDeEIsTUFBTSxFQUFFLEtBQUssQ0FBQyxHQUFHLEVBQUUsTUFBTTthQUMxQjtTQUNGLENBQUMsQ0FBQztRQUVILG9CQUFvQjtRQUNwQixHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN4RCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLG1CQUFtQixDQUFDLENBQUM7UUFDdEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUUvQyxnQ0FBZ0M7UUFDaEMsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUN4QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FDbkI7Z0JBQ0UsS0FBSyxFQUFFLFFBQVEsQ0FBQyxLQUFLO2dCQUNyQixRQUFRLEVBQUUsUUFBUSxDQUFDLFFBQVE7Z0JBQzNCLFVBQVUsRUFBRSxRQUFRLENBQUMsVUFBVTtnQkFDL0IsaUJBQWlCLEVBQUUsZUFBZSxDQUFDLGFBQWE7YUFDakQsRUFDRCxJQUFJLEVBQ0osQ0FBQyxDQUNGO1lBQ0QsV0FBVyxFQUFFLGdDQUFnQztTQUM5QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFoRUQsOENBZ0VDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgU2VjdXJlVnBjU3RhY2sgfSBmcm9tICcuL3ZwYy92cGMtY29uZmlnJztcbmltcG9ydCB7IFdhZlN0YWNrIH0gZnJvbSAnLi93YWYvd2FmLXJ1bGVzJztcbmltcG9ydCB7IFNlY3VyaXR5RGFzaGJvYXJkU3RhY2sgfSBmcm9tICcuL21vbml0b3Jpbmcvc2VjdXJpdHktZGFzaGJvYXJkJztcbmltcG9ydCB7IE1mYUF1dGhTdGFjayB9IGZyb20gJy4vYXV0aC9tZmEtY29uZmlnJztcbmltcG9ydCB7IExhbWJkYUhhcmRlbmluZ1N0YWNrIH0gZnJvbSAnLi9ydW50aW1lL2xhbWJkYS1oYXJkZW5pbmcnO1xuXG5pbnRlcmZhY2UgU2VjdXJpdHlTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICBhY2NvdW50SWQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE1haW5TZWN1cml0eVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFNlY3VyaXR5U3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gRGVwbG95IFZQQyB3aXRoIHNlY3VyaXR5IGNvbmZpZ3VyYXRpb25cbiAgICBjb25zdCB2cGNTdGFjayA9IG5ldyBTZWN1cmVWcGNTdGFjayh0aGlzLCAnU2VjdXJlVlBDJywge1xuICAgICAgZW52OiB7XG4gICAgICAgIGFjY291bnQ6IHByb3BzLmFjY291bnRJZCxcbiAgICAgICAgcmVnaW9uOiBwcm9wcy5lbnY/LnJlZ2lvbixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBEZXBsb3kgV0FGIHJ1bGVzXG4gICAgY29uc3Qgd2FmU3RhY2sgPSBuZXcgV2FmU3RhY2sodGhpcywgJ1dBRlJ1bGVzJywge1xuICAgICAgZW52OiB7XG4gICAgICAgIGFjY291bnQ6IHByb3BzLmFjY291bnRJZCxcbiAgICAgICAgcmVnaW9uOiBwcm9wcy5lbnY/LnJlZ2lvbixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBEZXBsb3kgc2VjdXJpdHkgbW9uaXRvcmluZ1xuICAgIGNvbnN0IG1vbml0b3JpbmdTdGFjayA9IG5ldyBTZWN1cml0eURhc2hib2FyZFN0YWNrKHRoaXMsICdTZWN1cml0eU1vbml0b3JpbmcnLCB7XG4gICAgICBlbnY6IHtcbiAgICAgICAgYWNjb3VudDogcHJvcHMuYWNjb3VudElkLFxuICAgICAgICByZWdpb246IHByb3BzLmVudj8ucmVnaW9uLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIERlcGxveSBNRkEgY29uZmlndXJhdGlvblxuICAgIGNvbnN0IG1mYVN0YWNrID0gbmV3IE1mYUF1dGhTdGFjayh0aGlzLCAnTUZBQXV0aCcsIHtcbiAgICAgIGVudjoge1xuICAgICAgICBhY2NvdW50OiBwcm9wcy5hY2NvdW50SWQsXG4gICAgICAgIHJlZ2lvbjogcHJvcHMuZW52Py5yZWdpb24sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gRGVwbG95IExhbWJkYSBoYXJkZW5pbmdcbiAgICBjb25zdCBsYW1iZGFIYXJkZW5pbmdTdGFjayA9IG5ldyBMYW1iZGFIYXJkZW5pbmdTdGFjayh0aGlzLCAnTGFtYmRhSGFyZGVuaW5nJywge1xuICAgICAgZW52OiB7XG4gICAgICAgIGFjY291bnQ6IHByb3BzLmFjY291bnRJZCxcbiAgICAgICAgcmVnaW9uOiBwcm9wcy5lbnY/LnJlZ2lvbixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBUYWcgYWxsIHJlc291cmNlc1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnRW52aXJvbm1lbnQnLCBwcm9wcy5lbnZpcm9ubWVudCk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTZXJ2aWNlJywgJ21pbmRidXJuLWFsZXRoZWlhJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTZWN1cml0eUxldmVsJywgJ2hpZ2gnKTtcblxuICAgIC8vIE91dHB1dCBzZWN1cml0eSBjb25maWd1cmF0aW9uXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NlY3VyaXR5Q29uZmlnJywge1xuICAgICAgdmFsdWU6IEpTT04uc3RyaW5naWZ5KFxuICAgICAgICB7XG4gICAgICAgICAgdnBjSWQ6IHZwY1N0YWNrLnZwY0lkLFxuICAgICAgICAgIHdhZkFjbElkOiB3YWZTdGFjay53ZWJBY2xJZCxcbiAgICAgICAgICB1c2VyUG9vbElkOiBtZmFTdGFjay51c2VyUG9vbElkLFxuICAgICAgICAgIHNlY3VyaXR5RGFzaGJvYXJkOiBtb25pdG9yaW5nU3RhY2suZGFzaGJvYXJkTmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgbnVsbCxcbiAgICAgICAgMlxuICAgICAgKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgQ29uZmlndXJhdGlvbiBTdW1tYXJ5JyxcbiAgICB9KTtcbiAgfVxufVxuIl19