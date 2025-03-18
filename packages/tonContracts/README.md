# Mindburn Aletheia TON Smart Contracts

This package contains the smart contracts for the Mindburn Aletheia platform's worker rewards and reputation system on the TON blockchain.

## Overview

The system consists of three main contracts:

1. **WorkerReward Contract**: Manages task rewards, escrow, and payment distribution
2. **WorkerReputation Contract**: Handles non-transferable reputation tokens and worker levels
3. **UtilityToken Contract**: Provides platform utility features like fee reduction and governance

## Contract Details

### WorkerReward Contract

- Secure payment distribution with escrow functionality
- Multi-signature requirement for large payments
- Task verification-based release mechanism
- Emergency withdrawal capabilities
- Integration with reputation system

### WorkerReputation Contract

- Non-transferable reputation tokens
- Level-based reputation system
- Performance-based adjustments
- Historical performance tracking
- Penalty mechanism for poor performance

### UtilityToken Contract

- Platform fee reduction based on stake
- Staking for premium task access
- Governance voting weight
- Reward multipliers
- Configurable lock periods

## Directory Structure

```
packages/ton-contracts/
├── src/                    # Smart contract source code
├── wrappers/              # TypeScript contract wrappers
├── test/                  # Contract test suites
├── scripts/               # Deployment and example scripts
└── docs/                  # Additional documentation
```

## Getting Started

### Prerequisites

- Node.js 16+
- TON Development Environment
- FunC Compiler

### Installation

```bash
npm install
```

### Building Contracts

```bash
npm run build
```

### Running Tests

```bash
npm test
```

### Deployment

1. Configure your environment:

   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

2. Deploy contracts:
   ```bash
   npm run deploy
   ```

## Usage Examples

See `scripts/example.ts` for detailed examples of contract interactions, including:

- Worker registration
- Task creation and assignment
- Reputation updates
- Token staking
- Fee reduction calculation

## Security Features

- Owner and admin role management
- Pause/resume functionality
- Upgrade mechanisms
- Emergency withdrawal capabilities
- Multi-signature requirements for large transactions

## Gas Optimization

The contracts are optimized for gas efficiency through:

- Efficient data structures
- Minimal storage operations
- Batched updates
- Optimized loops and conditions

## Testing

Comprehensive test suites cover:

- Unit tests for all contract functions
- Integration tests for contract interactions
- Error case testing
- Gas usage optimization tests

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT License - see LICENSE file for details
