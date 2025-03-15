# Frequently Asked Questions

## General

### What is Mindburn Aletheia?
Mindburn Aletheia is a decentralized platform that connects AI developers with human verifiers to improve AI model accuracy through feedback and verification tasks.

### How does it work?
1. AI developers submit tasks through our API
2. Tasks are distributed to qualified verifiers via Telegram
3. Verifiers complete tasks and submit results
4. Developers receive verified results
5. Payments are processed automatically via TON blockchain

### What types of tasks are supported?
- Classification
- Validation
- Annotation
- Custom task types (contact us for implementation)

## Development

### How do I get started?
1. Read our [Development Guide](development/README.md)
2. Set up your local environment
3. Join our Discord community
4. Start contributing!

### What's the tech stack?
- Backend: Node.js, AWS Lambda, DynamoDB
- Frontend: React, TypeScript, Mantine UI
- Infrastructure: AWS CDK, Serverless Framework
- Blockchain: TON Connect 2.0
- CI/CD: GitHub Actions

### How do I report bugs?
Create an issue on GitHub using our bug report template. Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details

## API

### What authentication method is used?
We use JWT Bearer tokens for API authentication. Tokens are issued through AWS Cognito.

### Are there rate limits?
Yes:
- 1000 requests/minute for authenticated users
- 100 requests/minute for unauthenticated users

### Is there an SDK?
Yes, we provide official SDKs for:
- TypeScript
- Python
- More coming soon

## Security

### How is data encrypted?
- Field-level encryption using AWS KMS
- Data-in-transit encryption (TLS 1.3)
- Secure key rotation
- Zero-trust architecture

### How are secrets managed?
- AWS Secrets Manager for credentials
- Environment variables for configuration
- Secure secret rotation
- Access audit logging

### Is the platform GDPR compliant?
Yes, we follow GDPR requirements:
- Data minimization
- Purpose limitation
- Storage limitation
- User consent management

## Deployment

### What environments are available?
- Development (local)
- Staging
- Production

### How are deployments managed?
- Automated CI/CD pipelines
- Blue-green deployments
- Automated rollback
- Health checks

### How do I deploy to production?
Follow our [Release Process](release/RELEASE_PROCESS.md) guide.

## Blockchain

### Which blockchain is used?
We use TON (The Open Network) for:
- Payments
- Smart contracts
- Transaction verification

### How are payments processed?
1. Developer deposits TON
2. Task reward is locked
3. Verifier completes task
4. Payment is automatically released
5. Transaction is recorded on-chain

### What's the minimum deposit?
- Minimum deposit: 10 TON
- Minimum task reward: 0.1 TON

## Support

### Where can I get help?
- [Documentation](https://docs.aletheia.mindburn.org)
- [Discord Community](https://discord.gg/mindburn)
- [GitHub Issues](https://github.com/mindburn/aletheia/issues)
- Email: support@mindburn.org

### Are there example applications?
Yes, check our [examples repository](https://github.com/mindburn/aletheia-examples) for:
- Basic integration
- Custom task types
- Payment handling
- Analytics integration

### How do I request features?
Create a feature request on GitHub:
1. Describe the feature
2. Explain the use case
3. Provide implementation ideas
4. Add relevant examples

## Business

### What's the pricing model?
- Pay per task
- Volume discounts available
- Custom pricing for enterprise

### Is there an SLA?
Yes, we offer:
- 99.9% API availability
- 24/7 monitoring
- Enterprise support options

### How do I get enterprise support?
Contact us at enterprise@mindburn.org for:
- Custom integrations
- Dedicated support
- SLA guarantees
- Volume pricing 