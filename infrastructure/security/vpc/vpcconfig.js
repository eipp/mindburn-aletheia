"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureVpcStack = void 0;
const cdk = require("aws-cdk-lib");
const ec2 = require("aws-cdk-lib/aws-ec2");
class SecureVpcStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create VPC with private subnets only
        const vpc = new ec2.Vpc(this, 'MindBurnVPC', {
            maxAzs: 3,
            natGateways: 1,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'Private',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
            ],
            gatewayEndpoints: {
                S3: {
                    service: ec2.GatewayVpcEndpointAwsService.S3,
                },
                DYNAMODB: {
                    service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
                },
            },
        });
        // Create security group for Lambda functions
        const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
            vpc,
            description: 'Security group for Lambda functions',
            allowAllOutbound: false,
        });
        // Allow HTTPS outbound
        lambdaSecurityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS outbound traffic');
        // Create VPC endpoints for AWS services
        new ec2.InterfaceVpcEndpoint(this, 'KMSEndpoint', {
            vpc,
            service: ec2.InterfaceVpcEndpointAwsService.KMS,
            securityGroups: [lambdaSecurityGroup],
        });
        new ec2.InterfaceVpcEndpoint(this, 'SecretsManagerEndpoint', {
            vpc,
            service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
            securityGroups: [lambdaSecurityGroup],
        });
        // Output VPC ID and Security Group ID
        new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
        new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
            value: lambdaSecurityGroup.securityGroupId,
        });
    }
}
exports.SecureVpcStack = SecureVpcStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidnBjY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidnBjY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQywyQ0FBMkM7QUFHM0MsTUFBYSxjQUFlLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDM0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qix1Q0FBdUM7UUFDdkMsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDM0MsTUFBTSxFQUFFLENBQUM7WUFDVCxXQUFXLEVBQUUsQ0FBQztZQUNkLG1CQUFtQixFQUFFO2dCQUNuQjtvQkFDRSxRQUFRLEVBQUUsRUFBRTtvQkFDWixJQUFJLEVBQUUsU0FBUztvQkFDZixVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxtQkFBbUI7aUJBQy9DO2FBQ0Y7WUFDRCxnQkFBZ0IsRUFBRTtnQkFDaEIsRUFBRSxFQUFFO29CQUNGLE9BQU8sRUFBRSxHQUFHLENBQUMsNEJBQTRCLENBQUMsRUFBRTtpQkFDN0M7Z0JBQ0QsUUFBUSxFQUFFO29CQUNSLE9BQU8sRUFBRSxHQUFHLENBQUMsNEJBQTRCLENBQUMsUUFBUTtpQkFDbkQ7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILDZDQUE2QztRQUM3QyxNQUFNLG1CQUFtQixHQUFHLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDN0UsR0FBRztZQUNILFdBQVcsRUFBRSxxQ0FBcUM7WUFDbEQsZ0JBQWdCLEVBQUUsS0FBSztTQUN4QixDQUFDLENBQUM7UUFFSCx1QkFBdUI7UUFDdkIsbUJBQW1CLENBQUMsYUFBYSxDQUMvQixHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUNsQixHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFDakIsOEJBQThCLENBQy9CLENBQUM7UUFFRix3Q0FBd0M7UUFDeEMsSUFBSSxHQUFHLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNoRCxHQUFHO1lBQ0gsT0FBTyxFQUFFLEdBQUcsQ0FBQyw4QkFBOEIsQ0FBQyxHQUFHO1lBQy9DLGNBQWMsRUFBRSxDQUFDLG1CQUFtQixDQUFDO1NBQ3RDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLG9CQUFvQixDQUFDLElBQUksRUFBRSx3QkFBd0IsRUFBRTtZQUMzRCxHQUFHO1lBQ0gsT0FBTyxFQUFFLEdBQUcsQ0FBQyw4QkFBOEIsQ0FBQyxlQUFlO1lBQzNELGNBQWMsRUFBRSxDQUFDLG1CQUFtQixDQUFDO1NBQ3RDLENBQUMsQ0FBQztRQUVILHNDQUFzQztRQUN0QyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUN2RCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9DLEtBQUssRUFBRSxtQkFBbUIsQ0FBQyxlQUFlO1NBQzNDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTFERCx3Q0EwREMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBjbGFzcyBTZWN1cmVWcGNTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIENyZWF0ZSBWUEMgd2l0aCBwcml2YXRlIHN1Ym5ldHMgb25seVxuICAgIGNvbnN0IHZwYyA9IG5ldyBlYzIuVnBjKHRoaXMsICdNaW5kQnVyblZQQycsIHtcbiAgICAgIG1heEF6czogMyxcbiAgICAgIG5hdEdhdGV3YXlzOiAxLFxuICAgICAgc3VibmV0Q29uZmlndXJhdGlvbjogW1xuICAgICAgICB7XG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIG5hbWU6ICdQcml2YXRlJyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGdhdGV3YXlFbmRwb2ludHM6IHtcbiAgICAgICAgUzM6IHtcbiAgICAgICAgICBzZXJ2aWNlOiBlYzIuR2F0ZXdheVZwY0VuZHBvaW50QXdzU2VydmljZS5TMyxcbiAgICAgICAgfSxcbiAgICAgICAgRFlOQU1PREI6IHtcbiAgICAgICAgICBzZXJ2aWNlOiBlYzIuR2F0ZXdheVZwY0VuZHBvaW50QXdzU2VydmljZS5EWU5BTU9EQixcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgc2VjdXJpdHkgZ3JvdXAgZm9yIExhbWJkYSBmdW5jdGlvbnNcbiAgICBjb25zdCBsYW1iZGFTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdMYW1iZGFTZWN1cml0eUdyb3VwJywge1xuICAgICAgdnBjLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgTGFtYmRhIGZ1bmN0aW9ucycsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiBmYWxzZSxcbiAgICB9KTtcblxuICAgIC8vIEFsbG93IEhUVFBTIG91dGJvdW5kXG4gICAgbGFtYmRhU2VjdXJpdHlHcm91cC5hZGRFZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuYW55SXB2NCgpLFxuICAgICAgZWMyLlBvcnQudGNwKDQ0MyksXG4gICAgICAnQWxsb3cgSFRUUFMgb3V0Ym91bmQgdHJhZmZpYydcbiAgICApO1xuXG4gICAgLy8gQ3JlYXRlIFZQQyBlbmRwb2ludHMgZm9yIEFXUyBzZXJ2aWNlc1xuICAgIG5ldyBlYzIuSW50ZXJmYWNlVnBjRW5kcG9pbnQodGhpcywgJ0tNU0VuZHBvaW50Jywge1xuICAgICAgdnBjLFxuICAgICAgc2VydmljZTogZWMyLkludGVyZmFjZVZwY0VuZHBvaW50QXdzU2VydmljZS5LTVMsXG4gICAgICBzZWN1cml0eUdyb3VwczogW2xhbWJkYVNlY3VyaXR5R3JvdXBdLFxuICAgIH0pO1xuXG4gICAgbmV3IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludCh0aGlzLCAnU2VjcmV0c01hbmFnZXJFbmRwb2ludCcsIHtcbiAgICAgIHZwYyxcbiAgICAgIHNlcnZpY2U6IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludEF3c1NlcnZpY2UuU0VDUkVUU19NQU5BR0VSLFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtsYW1iZGFTZWN1cml0eUdyb3VwXSxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBWUEMgSUQgYW5kIFNlY3VyaXR5IEdyb3VwIElEXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ZwY0lkJywgeyB2YWx1ZTogdnBjLnZwY0lkIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdMYW1iZGFTZWN1cml0eUdyb3VwSWQnLCB7XG4gICAgICB2YWx1ZTogbGFtYmRhU2VjdXJpdHlHcm91cC5zZWN1cml0eUdyb3VwSWQsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==