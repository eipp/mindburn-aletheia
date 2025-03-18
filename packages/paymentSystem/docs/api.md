# Payment System API Documentation

## Overview

The Payment System API provides endpoints for processing payments, managing payment batches, and handling worker withdrawals using the TON blockchain. The system is designed for high throughput, reliability, and security.

## Base URL

```
https://api.mindburn.org/payment-system/v1
```

## Authentication

All API requests require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Endpoints

### Process Task Reward

Process a single task reward payment to a worker.

**POST** `/payments/task-reward`

**Request Body:**

```json
{
  "workerId": "string",
  "taskId": "string",
  "amount": "number",
  "qualityScore": "number"
}
```

**Response:**

```json
{
  "success": "boolean",
  "transactionHash": "string",
  "amount": "number",
  "status": "string"
}
```

**Error Codes:**

- `400` - Invalid request parameters
- `402` - Insufficient funds
- `404` - Worker not found
- `409` - Payment already processed
- `500` - Internal server error

### Process Bulk Payments

Create and process a batch of payments.

**POST** `/payments/bulk`

**Request Body:**

```json
{
  "payments": [
    {
      "workerId": "string",
      "amount": "number",
      "taskId": "string"
    }
  ]
}
```

**Response:**

```json
{
  "success": "boolean",
  "batchId": "string",
  "processedPayments": "number",
  "failedPayments": "number",
  "status": "string"
}
```

**Error Codes:**

- `400` - Invalid request parameters
- `402` - Insufficient funds
- `500` - Internal server error

### Get Payment Status

Check the status of a payment.

**GET** `/payments/{paymentId}/status`

**Response:**

```json
{
  "status": "string",
  "transactionHash": "string",
  "completedAt": "string",
  "error": "string"
}
```

**Error Codes:**

- `404` - Payment not found
- `500` - Internal server error

### Get Worker Balance

Get a worker's current balance and payment history.

**GET** `/workers/{workerId}/balance`

**Response:**

```json
{
  "totalBalance": "number",
  "availableBalance": "number",
  "pendingBalance": "number",
  "lastPaymentAt": "string",
  "totalEarned": "number"
}
```

**Error Codes:**

- `404` - Worker not found
- `500` - Internal server error

### Process Withdrawal

Process a withdrawal request from a worker.

**POST** `/withdrawals`

**Request Body:**

```json
{
  "workerId": "string",
  "amount": "number",
  "destinationAddress": "string"
}
```

**Response:**

```json
{
  "success": "boolean",
  "withdrawalId": "string",
  "transactionHash": "string",
  "status": "string",
  "estimatedCompletionTime": "string"
}
```

**Error Codes:**

- `400` - Invalid request parameters
- `402` - Insufficient balance
- `403` - Withdrawals not enabled
- `500` - Internal server error

## Batch Processing

### Create Payment Batch

Create a new payment batch.

**POST** `/batches`

**Request Body:**

```json
{
  "payments": [
    {
      "destinationAddress": "string",
      "amount": "number",
      "referenceId": "string"
    }
  ]
}
```

**Response:**

```json
{
  "success": "boolean",
  "batchId": "string",
  "totalAmount": "number",
  "estimatedFee": "number",
  "status": "string"
}
```

### Process Payment Batch

Process an existing payment batch.

**POST** `/batches/{batchId}/process`

**Response:**

```json
{
  "success": "boolean",
  "processedPayments": "number",
  "failedPayments": "number",
  "transactionHashes": ["string"],
  "status": "string"
}
```

## Wallet Management

### Validate TON Address

Validate a TON wallet address.

**POST** `/wallet/validate`

**Request Body:**

```json
{
  "address": "string"
}
```

**Response:**

```json
{
  "isValid": "boolean",
  "formattedAddress": "string",
  "isBounceEnabled": "boolean"
}
```

### Get Wallet Balance

Get the balance of a TON wallet.

**GET** `/wallet/{address}/balance`

**Response:**

```json
{
  "balance": "number",
  "formattedBalance": "string",
  "lastUpdated": "string"
}
```

## Webhooks

### Payment Status Update

Webhook sent when payment status changes.

**Payload:**

```json
{
  "type": "payment.status_update",
  "paymentId": "string",
  "status": "string",
  "transactionHash": "string",
  "timestamp": "string",
  "error": "string"
}
```

### Batch Status Update

Webhook sent when batch status changes.

**Payload:**

```json
{
  "type": "batch.status_update",
  "batchId": "string",
  "status": "string",
  "processedPayments": "number",
  "failedPayments": "number",
  "timestamp": "string"
}
```

## Rate Limits

- Individual payments: 100 requests per minute
- Batch creation: 10 requests per minute
- Balance checks: 1000 requests per minute
- Withdrawals: 10 requests per minute per worker

## Best Practices

1. Always validate TON addresses before sending payments
2. Use batch payments for multiple small transactions
3. Implement proper error handling and retries
4. Monitor webhook deliveries
5. Keep track of transaction hashes
6. Implement idempotency for payment requests

## Error Handling

All error responses follow this format:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": "object"
  }
}
```

Common error codes:

- `INVALID_REQUEST` - Request validation failed
- `INSUFFICIENT_FUNDS` - Not enough balance
- `WORKER_NOT_FOUND` - Worker doesn't exist
- `INVALID_ADDRESS` - Invalid TON address
- `PAYMENT_FAILED` - Transaction failed
- `RATE_LIMITED` - Too many requests
- `INTERNAL_ERROR` - Server error

## Monitoring

The API provides several CloudWatch metrics:

- `ProcessedPaymentsAmount` - Total amount processed
- `ProcessedPaymentsCount` - Number of payments
- `PaymentSuccessRate` - Success rate percentage
- `ProcessingTime` - Payment processing duration
- `TONTransactionLatency` - Blockchain transaction time
- `TONTransactionFees` - Transaction fees paid

## Security

1. All endpoints require authentication
2. Sensitive data is encrypted at rest
3. All transactions require proper signatures
4. Rate limiting prevents abuse
5. IP-based blocking available
6. Audit logging for all operations
