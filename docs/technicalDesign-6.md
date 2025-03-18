6. Payment System API Contracts
6.1 Payment Processor Service API
typescriptCopy// Payment Processor Service API
interface PaymentProcessorAPI {
  // Process task reward payment
  processTaskReward: {
    request: {
      taskId: string;
      workerId: string;
      amount: number;
      status: "approved" | "rejected" | "partial";
      qualityFactor?: number;  // Quality multiplier (0.0 to 1.0)
    },
    response: {
      paymentId: string;
      taskId: string;
      workerId: string;
      originalAmount: number;
      adjustedAmount: number;
      status: "pending" | "processed";
      processingStrategy: "immediate" | "batched";
      estimatedProcessingTime?: string;
      createdAt: string;
    },
    errors: {
      400: "Invalid payment data",
      404: "Task or worker not found",
      409: "Payment already processed",
      500: "Service error"
    }
  }
  
  // Process bulk payments (for batch processing)
  processBulkPayments: {
    request: {
      paymentIds: string[];
      processingPriority?: "normal" | "high";
    },
    response: {
      batchId: string;
      paymentCount: number;
      totalAmount: number;
      status: "queued" | "processing" | "completed" | "partial_failure" | "failed";
      results?: {
        successful: number;
        failed: number;
        failedPaymentIds?: string[];
      };
      queuedAt: string;
    },
    errors: {
      400: "Invalid batch request",
      500: "Service error"
    }
  }
  
  // Check payment status
  getPaymentStatus: {
    request: {
      paymentId: string;
    },
    response: {
      paymentId: string;
      taskId?: string;
      workerId: string;
      amount: number;
      status: "pending" | "processing" | "completed" | "failed";
      transactionHash?: string;
      processingStrategy: string;
      batchId?: string;
      createdAt: string;
      updatedAt: string;
      completedAt?: string;
    },
    errors: {
      404: "Payment not found",
      500: "Service error"
    }
  }
  
  // Get worker balance
  getWorkerBalance: {
    request: {
      workerId: string;
    },
    response: {
      workerId: string;
      availableBalance: number;
      pendingBalance: number;
      totalEarned: number;
      lastUpdatedAt: string;
    },
    errors: {
      404: "Worker not found",
      500: "Service error"
    }
  }
  
  // Process withdrawal request
  processWithdrawal: {
    request: {
      workerId: string;
      amount: number;
      destinationAddress: string;
      withdrawalId?: string;
    },
    response: {
      withdrawalId: string;
      workerId: string;
      amount: number;
      fee: number;
      netAmount: number;
      destinationAddress: string;
      status: "pending" | "processing" | "completed" | "failed";
      transactionHash?: string;
      estimatedCompletionTime?: string;
      createdAt: string;
    },
    errors: {
      400: "Invalid withdrawal request",
      402: "Insufficient balance",
      422: "Invalid destination address",
      500: "Service error"
    }
  }
}
6.2 TON Integration Service API
typescriptCopy// TON Integration Service API
interface TONIntegrationAPI {
  // Send TON payment
  sendTONPayment: {
    request: {
      destinationAddress: string;
      amount: number;  // In TON units
      message?: string;
      referenceId?: string;
    },
    response: {
      transactionId: string;
      amount: number;
      fee: number;
      destinationAddress: string;
      status: "pending" | "confirmed" | "failed";
      transactionHash?: string;
      blockId?: string;
      createdAt: string;
    },
    errors: {
      400: "Invalid payment request",
      402: "Insufficient wallet balance",
      422: "Invalid destination address",
      500: "Transaction failed"
    }
  }
  
  // Create TON payment batch
  createPaymentBatch: {
    request: {
      payments: [{
        destinationAddress: string;
        amount: number;
        referenceId?: string;
      }];
    },
    response: {
      batchId: string;
      totalAmount: number;
      totalFee: number;
      paymentCount: number;
      status: "pending";
      createdAt: string;
    },
    errors: {
      400: "Invalid batch request",
      402: "Insufficient wallet balance",
      500: "Service error"
    }
  }
  
  // Process payment batch
  processPaymentBatch: {
    request: {
      batchId: string;
    },
    response: {
      batchId: string;
      status: "processing" | "completed" | "partial_failure" | "failed";
      results: {
        successful: number;
        failed: number;
        transactions: [{
          referenceId?: string;
          destinationAddress: string;
          amount: number;
          status: string;
          transactionHash?: string;
        }]
      };
      processedAt: string;
    },
    errors: {
      404: "Batch not found",
      409: "Batch already processed",
      500: "Processing failed"
    }
  }
  
  // Check transaction status
  checkTransactionStatus: {
    request: {
      transactionHash: string;
    },
    response: {
      transactionHash: string;
      status: "pending" | "confirmed" | "failed";
      confirmations: number;
      blockId?: string;
      timestamp?: string;
      fee: number;
    },
    errors: {
      404: "Transaction not found",
      500: "Service error"
    }
  }
  
  // Get wallet balance
  getWalletBalance: {
    request: {
      walletAddress?: string;  // If not provided, use service wallet
    },
    response: {
      walletAddress: string;
      balance: number;
      lastUpdatedAt: string;
    },
    errors: {
      422: "Invalid wallet address",
      500: "Service error"
    }
  }
}