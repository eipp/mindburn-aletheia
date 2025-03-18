import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class LambdaHardeningStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Lambda Layer for security controls
    const securityLayer = new lambda.LayerVersion(this, 'SecurityLayer', {
      code: lambda.Code.fromAsset('layers/security'),
      description: 'Security controls and RASP implementation',
      compatibleRuntimes: [
        lambda.Runtime.NODEJS_18_X,
        lambda.Runtime.NODEJS_20_X
      ],
    });

    // Create Lambda role with restricted permissions
    const functionRole = new iam.Role(this, 'HardenedLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Hardened Lambda execution role',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    // Add custom policy for runtime protection
    functionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      actions: [
        'iam:*',
        'lambda:UpdateFunctionCode',
        'ec2:*',
        's3:*',
      ],
      resources: ['*'],
    }));

    // Lambda function configuration with hardening
    const hardenedFunctionProps: lambda.FunctionProps = {
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
  public static applyHardening(fn: lambda.Function): void {
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