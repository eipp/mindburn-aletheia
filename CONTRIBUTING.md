# Contributing to Mindburn Aletheia

Thanks for your interest in contributing to the Mindburn Aletheia platform. This document outlines our contribution process and guidelines.

## Project Structure

```
mindburn-aletheia/
├── packages/
│   ├── core/            # Core shared functionality
│   ├── shared/          # Shared utilities and types
│   ├── developerPlatform/ # Developer API and portal
│   ├── taskManagement/  # Task distribution system
│   ├── verificationEngine/ # Verification logic
│   ├── workerBot/       # Telegram bot implementation
│   ├── workerWebapp/    # Web application for workers
│   ├── workerInterface/ # API for worker interactions
│   ├── paymentSystem/   # Payment processing
│   ├── tonContracts/    # TON blockchain contracts
│   └── tokenEconomy/    # Token economics system
├── infrastructure/      # IaC and deployment
└── scripts/             # Utility scripts
```

## Development Environment

### Prerequisites

- Node.js v20+
- pnpm v10.5+
- Docker (for local dev environment)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/mindburn/aletheia.git
cd aletheia
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy example environment variables:
```bash
cp .env.example .env
```

4. Start development environment:
```bash
pnpm dev
```

## Coding Standards

### TypeScript

- Use strong typing - avoid `any` when possible
- Document public APIs with JSDoc comments
- Follow the existing patterns for error handling

### React

- Use functional components with hooks
- Keep components focused on a single responsibility
- Use prop types or TypeScript interfaces for component props

### Testing

- Write unit tests for all business logic
- Test components using React Testing Library
- Aim for minimum 80% code coverage

## Git Workflow

1. Create a feature branch from `develop`:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes with clear, descriptive commits:
```bash
git commit -m "feat: Add new verification method"
```

3. Push changes and create a pull request against `develop`:
```bash
git push origin feature/your-feature-name
```

## Pull Request Process

1. Ensure your code passes all tests and linting
2. Update documentation if necessary
3. Add a clear description of the changes
4. Request review from at least one maintainer
5. Respond to feedback and make requested changes

## Release Process

1. Merges to `develop` trigger deployment to staging
2. After QA approval, changes are merged to `main`
3. Release tags are created according to semantic versioning
4. Deployment to production happens automatically on new tags

## Code of Conduct

Please be respectful of other contributors. We're committed to providing a welcoming and inclusive environment.

### Reporting Issues

If you find a bug or have a feature request, please create a detailed issue in our GitHub repository.

## License

By contributing to this project, you agree that your contributions will be licensed under the project's MIT license.
