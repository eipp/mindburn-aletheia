# MindBurn Payments Smart Contract

## Overview
The MindBurn Payments smart contract manages the payment and reward system for the Mindburn Aletheia platform. It handles task creation, worker assignments, payment processing, and reputation management.

## Features
- Task creation and management
- Automated payment processing
- Worker reputation system
- Multi-signature approval for large payments
- Contract upgradeability
- Gas optimization
- Security measures

## Contract Architecture

### Storage Structure
```
storage#_ owner_address:MsgAddress
         clients_map:(HashmapE 256 Client)
         workers_map:(HashmapE 256 Worker)
         tasks_map:(HashmapE 256 Task)
         min_stake:Coins
         code:^Cell
         approvers:(HashmapE 256 ApproverData)
         large_payment_threshold:Coins
         required_approvals:uint8
         = Storage;
```

### Constants
- `MIN_TON_FOR_STORAGE`: 0.05 TON
- `MAX_PENALTY`: 1 TON
- `LARGE_PAYMENT_THRESHOLD`: 100 TON
- `REQUIRED_APPROVALS`: 2
- `MIN_REPUTATION`: 0
- `MAX_REPUTATION`: 1000
- `INITIAL_REPUTATION`: 100

## Functions

### Task Management
1. `create_task(client_addr, task_id, reward)`
   - Creates a new task with specified reward
   - Requires minimum stake
   - Stores task data in contract storage

2. `assign_task(task_id, worker_addr)`
   - Assigns task to worker
   - Checks worker reputation
   - Only owner can assign tasks

3. `process_verification(task_id, success)`
   - Processes task verification result
   - Handles payment distribution
   - Updates worker reputation

### Multi-signature System
1. `approve_payment(task_id, approver_addr)`
   - Records payment approval for large transactions
   - Validates approver authorization
   - Required for payments above threshold

2. `check_approvals(task_id)`
   - Counts number of approvals for a task
   - Returns -1 if approvals not needed
   - Returns current approval count

### Reputation System
1. `update_worker_reputation(worker_addr, delta)`
   - Updates worker reputation score
   - Maintains bounds (0-1000)
   - Tracks completed tasks

### Contract Upgrade
1. `upgrade_code(new_code)`
   - Allows contract code upgrade
   - Only owner can upgrade
   - Preserves contract data

## Security Features

### Access Control
- Owner-only functions
- Multi-signature requirement for large payments
- Reputation-based worker validation

### Payment Protection
- Minimum stake requirement
- Multi-signature approval for large payments
- Separate gas fee handling

### Data Validation
- Input validation for all operations
- Status checks for state transitions
- Balance verification

### Gas Optimization
- Efficient storage structure
- Optimized message handling
- Gas-conscious operation design

## Error Codes
- 101: Insufficient funds
- 102: Invalid reward
- 103: Task not found
- 104: Invalid status
- 105: Unauthorized
- 106: Insufficient approvals
- 107: Insufficient reputation
- 108: Upgrade failed

## Events
1. TaskCreated(taskId, client, reward)
2. TaskAssigned(taskId, worker)
3. TaskCompleted(taskId, success)
4. PaymentApproved(taskId, approver)
5. CodeUpgraded(newCodeHash)

## Deployment

### Prerequisites
- TON wallet with sufficient balance
- Node.js environment
- Required dependencies installed

### Steps
1. Install dependencies:
   ```bash
   npm install
   ```

2. Build contract:
   ```bash
   npm run build
   ```

3. Deploy to testnet:
   ```bash
   DEPLOYER_MNEMONIC="your mnemonic" npm run deploy:testnet
   ```

4. Deploy to mainnet:
   ```bash
   DEPLOYER_MNEMONIC="your mnemonic" npm run deploy:mainnet
   ```

## Integration

### TON Connect
```typescript
const wallet = new TonWalletConnector(
  'https://your-app.com/tonconnect-manifest.json',
  'EQA...' // contract address
);
await wallet.connect();
```

### Creating Tasks
```typescript
await wallet.createTask(taskId, reward);
```

### Processing Verifications
```typescript
await wallet.verifyTask(taskId, success);
```

## Security Considerations

### Audit Checklist
1. Contract code review
2. Gas usage analysis
3. Access control verification
4. Multi-signature implementation
5. Upgrade mechanism safety
6. Event emission verification
7. Error handling coverage

### Best Practices
1. Use testnet for initial testing
2. Implement rate limiting
3. Monitor contract balance
4. Regular security audits
5. Keep upgrade keys secure
6. Monitor events for anomalies

## Gas Usage
- Task Creation: ~10k gas
- Task Assignment: ~15k gas
- Task Verification: ~25k gas
- Payment Approval: ~12k gas
- Code Upgrade: ~20k gas

## Limitations
1. Maximum contract size: 16KB
2. Maximum pending tasks: 100
3. Verification timeout: 24 hours
4. Minimum stake: 0.1 TON
5. Maximum task reward: 1000 TON

## Testing
Run the test suite:
```bash
npm test
```

## Support
For technical support or questions, please open an issue in the repository or contact the development team. 