# Troubleshooting Guide

## Common Issues and Solutions

### Development Environment

#### Node.js and pnpm Issues

1. **pnpm install fails**

```bash
# Clear pnpm store
pnpm store prune

# Remove node_modules
rm -rf node_modules
rm -rf packages/*/node_modules

# Reinstall
pnpm install
```

2. **TypeScript compilation errors**

```bash
# Clear TypeScript cache
rm -rf packages/*/dist
rm -rf packages/*/.tsbuildinfo

# Rebuild
pnpm build
```

3. **Vite dev server issues**

```bash
# Clear Vite cache
rm -rf packages/worker-webapp/node_modules/.vite

# Restart dev server
pnpm dev
```

### AWS Infrastructure

#### CDK Deployment Failures

1. **Stack deployment fails**

   - Check AWS credentials
   - Verify IAM permissions
   - Review CloudFormation events
   - Check resource limits

2. **Resource conflicts**

```bash
# Remove stack
cdk destroy

# Clean bootstrap
cdk bootstrap

# Redeploy
cdk deploy
```

3. **VPC configuration issues**
   - Verify subnet configurations
   - Check security group rules
   - Validate NAT gateway setup
   - Review route tables

### API and Backend

#### Lambda Function Issues

1. **Function timeouts**

   - Check memory allocation
   - Review execution time limits
   - Monitor CPU/memory usage
   - Optimize database queries

2. **Cold start latency**

   - Use provisioned concurrency
   - Optimize dependencies
   - Implement warm-up
   - Use Lambda SnapStart

3. **Permission errors**
   - Review IAM roles
   - Check resource policies
   - Validate KMS key access
   - Verify VPC endpoints

#### Database Issues

1. **Connection timeouts**

```bash
# Check connectivity
aws dynamodb list-tables

# Verify VPC endpoints
aws ec2 describe-vpc-endpoints

# Test permissions
aws dynamodb scan --table-name Tasks --max-items 1
```

2. **Query performance**
   - Review index usage
   - Check partition key design
   - Monitor RCU/WCU usage
   - Implement caching

### Frontend and Mini App

#### Build Issues

1. **Bundle size warnings**

```bash
# Analyze bundle
pnpm analyze

# Optimize imports
# Before
import { Button } from '@mantine/core'
# After
import { Button } from '@mantine/core/Button'
```

2. **React performance**

   - Use React DevTools
   - Profile component renders
   - Implement memoization
   - Fix unnecessary re-renders

3. **Mini App loading issues**
   - Check Telegram Web App SDK
   - Verify initialization
   - Monitor network requests
   - Test on different devices

### Security and Authentication

#### JWT Issues

1. **Token validation fails**

   - Check token expiration
   - Verify signature
   - Validate issuer
   - Review audience claims

2. **Cognito authentication**

```bash
# Test Cognito setup
aws cognito-idp describe-user-pool \
  --user-pool-id YOUR_POOL_ID

# Check user status
aws cognito-idp admin-get-user \
  --user-pool-id YOUR_POOL_ID \
  --username USER_EMAIL
```

### Monitoring and Logging

#### CloudWatch Issues

1. **Missing logs**

   - Check log group retention
   - Verify IAM permissions
   - Review log levels
   - Check log delivery

2. **Metric alarms**
   - Validate threshold values
   - Check metric filters
   - Review alarm actions
   - Test SNS notifications

### Deployment

#### CI/CD Pipeline Issues

1. **GitHub Actions failures**

   - Check workflow syntax
   - Verify secrets
   - Review environment variables
   - Check action versions

2. **Rollback issues**

```bash
# View deployment history
aws deploy get-deployment \
  --deployment-id DEPLOYMENT_ID

# Force rollback
aws deploy stop-deployment \
  --deployment-id DEPLOYMENT_ID \
  --auto-rollback-enabled
```

## Debugging Tools

### Local Development

1. **VS Code Debug Configuration**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev"],
      "cwd": "${workspaceFolder}/packages/worker-interface",
      "console": "integratedTerminal"
    }
  ]
}
```

2. **Chrome DevTools**
   - Network tab for API calls
   - Performance tab for profiling
   - Application tab for storage
   - Console for logging

### Production

1. **AWS CloudWatch Insights**

```
fields @timestamp, @message
| filter @message like /error/
| sort @timestamp desc
| limit 20
```

2. **X-Ray Tracing**
   - Trace API requests
   - Monitor Lambda executions
   - Track database calls
   - Analyze latency

## Performance Optimization

1. **API Response Times**

   - Implement caching
   - Optimize queries
   - Use connection pooling
   - Enable compression

2. **Frontend Loading**
   - Code splitting
   - Lazy loading
   - Image optimization
   - Resource hints

## Support Resources

- [AWS Documentation](https://docs.aws.amazon.com)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [TON Documentation](https://ton.org/docs)
- [Developer Discord](https://discord.gg/mindburn)
- Email: support@mindburn.org
