# Mindburn Aletheia Smart Contracts API Documentation

## Table of Contents
1. [WorkerReward Contract](#workerreward-contract)
2. [WorkerReputation Contract](#workerreputation-contract)
3. [UtilityToken Contract](#utilitytoken-contract)
4. [Contract Upgrades](#contract-upgrades)
5. [Error Codes](#error-codes)
6. [Gas Usage](#gas-usage)

## WorkerReward Contract

### Overview
The WorkerReward contract manages task rewards, escrow functionality, and payment distribution.

### Methods

#### Task Management

##### createTask
```typescript
function createTask(taskId: number, reward: bigint, client: Address)
```
Creates a new task with escrow.
- **Gas**: ~15,000 gas units
- **Requirements**: 
  - Sender must send reward amount + gas
  - Task ID must not exist

##### assignTask
```typescript
function assignTask(taskId: number, worker: Address)
```
Assigns a task to a worker.
- **Gas**: ~10,000 gas units
- **Requirements**:
  - Task must exist and be unassigned
  - Worker must have sufficient stake

##### submitVerification
```typescript
function submitVerification(taskId: number, qualityScore: number, taskComplexity: number)
```
Submits task verification for payment.
- **Gas**: ~20,000 gas units
- **Requirements**:
  - Task must be assigned
  - Sender must be admin

#### Payment Management

##### approvePayment
```typescript
function approvePayment(taskId: number)
```
Approves and processes payment for a task.
- **Gas**: ~25,000 gas units for regular payments, ~35,000 for large payments
- **Requirements**:
  - Task must be verified
  - Multi-sig if payment > large_payment_threshold

### Events
1. `TaskCreated(taskId, reward, client)`
2. `TaskAssigned(taskId, worker)`
3. `VerificationSubmitted(taskId, score)`
4. `PaymentProcessed(taskId, worker, amount)`

## WorkerReputation Contract

### Overview
Manages non-transferable reputation tokens and worker levels.

### Methods

#### Worker Management

##### registerWorker
```typescript
function registerWorker(worker: Address)
```
Registers a new worker in the system.
- **Gas**: ~12,000 gas units
- **Requirements**:
  - Worker not already registered

##### updateReputation
```typescript
function updateReputation(worker: Address, qualityScore: number, taskComplexity: number)
```
Updates worker reputation based on task performance.
- **Gas**: ~18,000 gas units
- **Requirements**:
  - Worker must be registered
  - Sender must be admin or reward contract

#### Reputation Management

##### applyPenalty
```typescript
function applyPenalty(worker: Address, penaltyReason: number)
```
Applies penalty to worker's reputation.
- **Gas**: ~15,000 gas units
- **Requirements**:
  - Worker must be registered
  - Sender must be admin

### Events
1. `WorkerRegistered(worker, timestamp)`
2. `ReputationUpdated(worker, newScore, newLevel)`
3. `PenaltyApplied(worker, reason, amount)`

## UtilityToken Contract

### Overview
Provides platform utility features including staking, governance, and fee reduction.

### Methods

#### Token Operations

##### transfer
```typescript
function transfer(to: Address, amount: bigint)
```
Transfers tokens between addresses.
- **Gas**: ~10,000 gas units
- **Requirements**:
  - Sufficient balance
  - Contract not paused

#### Staking Operations

##### stake
```typescript
function stake(amount: bigint)
```
Stakes tokens for platform benefits.
- **Gas**: ~20,000 gas units
- **Requirements**:
  - Amount >= min_stake
  - Sufficient balance

##### unstake
```typescript
function unstake(amount: bigint)
```
Unstakes tokens after lock period.
- **Gas**: ~20,000 gas units
- **Requirements**:
  - Lock period expired
  - Sufficient staked amount

### Events
1. `Transfer(from, to, amount)`
2. `Staked(staker, amount, lockEndTime)`
3. `Unstaked(staker, amount)`

## Contract Upgrades

All contracts support safe upgrades through a two-step process:

1. **Initiate Upgrade**
```typescript
function upgrade(newCode: Cell, delay: number)
```
- Stores new contract code
- Sets upgrade timestamp
- Only owner can call
- Gas: ~30,000 gas units

2. **Complete Upgrade**
```typescript
function upgrade_complete()
```
- Applies new code after delay
- Only owner can call
- Gas: ~40,000 gas units

### Upgrade Safety
- Timelock delay for security
- Version tracking
- State preservation
- Rollback capability

## Error Codes

| Code | Description |
|------|-------------|
| 1001 | Unauthorized operation |
| 1002 | Invalid state |
| 1003 | Insufficient funds |
| 1004 | Invalid parameters |
| 1005 | Contract paused |
| 1006 | Timeout not reached |
| 1007 | Already exists |
| 1008 | Does not exist |

## Gas Usage

This section provides detailed gas usage information for each contract operation. These values are benchmarked using the `npm run benchmark` command and may vary slightly based on network conditions and contract state.

## WorkerReward Contract

| Operation | Average Gas Usage | Description |
|-----------|------------------|-------------|
| Create Task | ~50,000 | Creating a new task with reward |
| Assign Task | ~30,000 | Assigning a task to a worker |
| Submit Verification | ~40,000 | Submitting task verification |
| Approve Payment | ~35,000 | Approving payment for completed task |
| Emergency Withdraw | ~25,000 | Emergency withdrawal of funds |

## WorkerReputation Contract

| Operation | Average Gas Usage | Description |
|-----------|------------------|-------------|
| Register Worker | ~35,000 | Registering a new worker |
| Update Reputation | ~45,000 | Updating worker reputation |
| Apply Penalty | ~30,000 | Applying penalty to worker |
| Get Worker Data | ~5,000 | Reading worker data (view function) |

## UtilityToken Contract

| Operation | Average Gas Usage | Description |
|-----------|------------------|-------------|
| Transfer | ~30,000 | Token transfer between accounts |
| Stake | ~40,000 | Staking tokens |
| Unstake | ~45,000 | Unstaking tokens after lock period |
| Get Balance | ~5,000 | Reading token balance (view function) |

## Contract Upgrades

| Operation | Average Gas Usage | Description |
|-----------|------------------|-------------|
| Initiate Upgrade | ~50,000 | Starting contract upgrade process |
| Complete Upgrade | ~60,000 | Completing contract upgrade |

Note: Gas usage values are approximate and may vary based on:
- Network congestion
- Contract state size
- Input data size
- Number of storage operations
- Complexity of calculations

To get precise gas usage for your specific deployment, run the benchmark script:
```bash
npm run benchmark
```

The benchmark script simulates real-world usage patterns and provides detailed gas usage metrics for all contract operations.

## Security Considerations

1. **Access Control**
   - Owner/admin separation
   - Multi-signature for large payments
   - Role-based function access

2. **Funds Safety**
   - Escrow mechanism
   - Emergency withdrawal
   - Balance checks

3. **State Protection**
   - Pause mechanism
   - Valid state transitions
   - Reentrancy protection

4. **Upgrade Safety**
   - Timelock delays
   - Version tracking
   - State preservation

## Best Practices

1. **Gas Optimization**
   - Batch operations when possible
   - Minimize storage operations
   - Use efficient data structures

2. **Error Handling**
   - Specific error codes
   - Proper state validation
   - Clear error messages

3. **Event Logging**
   - Detailed event parameters
   - Indexed fields for filtering
   - Comprehensive operation tracking 