# Mindburn Aletheia

A human-in-the-loop AI verification platform connecting AI developers with human verifiers through Telegram's ecosystem.

## Project Structure

The project follows a monorepo structure using pnpm workspaces with the following packages:

```
packages/
├── core/              # Core shared functionality
├── developerPlatform/ # API and dashboard for developers
├── paymentSystem/     # TON blockchain payment processing
├── pluginSystem/      # Plugin system for verification methods
├── shared/            # Shared utilities, types and configurations
├── taskManagement/    # Task distribution and orchestration
├── tokenEconomy/      # Token incentive mechanisms
├── tonContracts/      # TON blockchain smart contracts
├── verificationEngine/# Verification algorithms and logic
├── workerBot/         # Telegram bot for workers
├── workerCore/        # Core worker functionality
├── workerInterface/   # API for worker interactions
└── workerWebapp/      # Telegram Mini App for workers
```

## Package Naming Conventions

All packages follow camelCase naming convention. If you're working with code that references the old kebab-case naming, please update it to the new convention.

Old: `@mindburn/worker-interface`
New: `@mindburn/workerInterface`

## Development

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.5.0

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Environment Variables

Copy the example environment file and modify as needed:

```bash
cp .env.example .env
```

## Architecture

The platform consists of five main components:

1. **Developer Platform**: API Gateway, Lambda, CloudFront for dashboard
2. **Task Management System**: SQS, Lambda, Step Functions, DynamoDB
3. **Worker Interface**: Telegram Bot API, Mini Apps, TON Connect
4. **Verification Engine**: Lambda functions with multi-method verification
5. **Payment System**: TON blockchain with batched transactions

## Contributing

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.
