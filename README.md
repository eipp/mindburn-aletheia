# Mindburn Aletheia

A human-in-the-loop AI verification platform connecting AI developers with skilled human workers through Telegram's ecosystem.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![API Docs](https://img.shields.io/badge/api-docs-green.svg)](docs/api/README.md)
[![Contributing](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](docs/CONTRIBUTING.md)

## Overview

Mindburn Aletheia is a decentralized platform that enables AI developers to verify and improve their models through human feedback. The platform leverages Telegram's ecosystem for task distribution and the TON blockchain for secure micropayments.

### Key Features

- 🤖 Telegram Bot interface for workers
- 📱 Mini App for task management
- 💰 TON blockchain integration for payments
- 🔒 Secure field-level encryption
- 📊 Real-time analytics and reporting
- 🔄 Automated task distribution

## Documentation

- [Architecture Overview](docs/architecture/README.md)
- [API Documentation](docs/api/README.md)
- [Development Guide](docs/development/README.md)
- [Deployment Guide](docs/deployment/README.md)
- [Security Framework](docs/security/README.md)
- [Contributing Guidelines](docs/CONTRIBUTING.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## Components

- [Worker Interface](packages/worker-interface/README.md) - Telegram Bot and Mini App
- [Developer Platform](packages/developer-platform/README.md) - API and Dashboard
- [Task Management](packages/task-management/README.md) - Task Distribution System
- [Verification Engine](packages/verification-engine/README.md) - Core Logic
- [Payment System](packages/payment-system/README.md) - TON Integration

## Quick Start

1. **Clone the Repository**
```bash
git clone https://github.com/mindburn/aletheia.git
cd aletheia
```

2. **Install Dependencies**
```bash
pnpm install
```

3. **Set Up Environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start Development Environment**
```bash
docker-compose up -d
pnpm dev
```

5. **Run Tests**
```bash
pnpm test
```

## Architecture

![System Architecture](docs/architecture/diagrams/system-context.png)

The platform follows a microservices architecture with five main components:
- Worker Interface for user interactions
- Developer Platform for API access
- Task Management for distribution
- Verification Engine for core logic
- Payment System for TON integration

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](docs/CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- [Issue Tracker](https://github.com/mindburn/aletheia/issues)
- [Documentation](docs/README.md)
- [Security Policy](docs/SECURITY.md)