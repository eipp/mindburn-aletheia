# Mindburn Aletheia

Human-in-the-loop AI verification platform built on Telegram and TON blockchain.

## Project Structure

```
├── packages/
│   ├── worker-interface/     # Telegram Bot + Mini App
│   ├── developer-platform/   # API + Dashboard
│   ├── task-management/      # Task Management System
│   ├── verification-engine/  # Verification Engine
│   ├── payment-system/       # TON Integration
│   └── shared/              # Shared utilities and types
├── infrastructure/          # AWS CDK Infrastructure
└── docs/                    # Documentation
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Development

This project uses:
- TypeScript for type safety
- Turborepo for monorepo management
- AWS CDK for infrastructure
- ESLint + Prettier for code quality
- GitHub Actions for CI/CD

## License

MIT