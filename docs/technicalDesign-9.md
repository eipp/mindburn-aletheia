9. Integration with External Systems
9.1 Telegram Integration
typescriptCopy// Telegram Service Integration
interface TelegramServiceIntegration {
  // Send notification via bot
  sendNotification: {
    request: {
      telegramId: string;
      messageType: "task_available" | "task_assigned" | "verification_complete" | "payment_processed" | "system_notification";
      message: string;
      buttons?: [{
        text: string;
        callbackData?: string;
        url?: string;
      }];
      miniAppUrl?: string;
    },
    response: {
      messageId: string;
      sentAt: string;
      success: boolean;
    },
    errors: {
      400: "Invalid notification request",
      404: "User not found",
      500: "Notification failed"
    }
  }
  
  // Handle bot callback
  handleBotCallback: {
    request: {
      updateId: number;
      callbackQuery: {
        id: string;
        from: {
          id: number;
          username?: string;
        };
        message: object;
        data: string;
      }
    },
    response: {
      callbackId: string;
      handled: boolean;
      action?: string;
    },
    errors: {
      400: "Invalid callback data",
      500: "Callback handling failed"
    }
  }
  
  // Validate mini app initData
  validateMiniAppInitData: {
    request: {
      initData: string;
    },
    response: {
      valid: boolean;
      telegramId?: string;
      userData?: {
        id: number;
        first_name?: string;
        last_name?: string;
        username?: string;
        language_code?: string;
      }
    },
    errors: {
      400: "Invalid init data",
      403: "Validation failed",
      500: "Service error"
    }
  }
}
9.2 TON Blockchain Integration
typescriptCopy// TON Blockchain Integration
interface TONBlockchainIntegration {
  // Create wallet for service
  createServiceWallet: {
    request: {
      walletType: "v3R2" | "v4R2";
      label?: string;
    },
    response: {
      walletAddress: string;
      publicKey: string;
      walletType: string;
      createdAt: string;
    },
    errors: {
      500: "Wallet creation failed"
    }
  }
  
  // Send TON transaction
  sendTransaction: {
    request: {
      from: string;
      to: string;
      amount: string;  // In TON units as string
      message?: string;
      timeout?: number;  // In milliseconds
    },
    response: {
      transactionHash: string;
      from: string;
      to: string;
      amount: string;
      fee?: string;
      status: "pending";
      sentAt: string;
    },
    errors: {
      400: "Invalid transaction parameters",
      402: "Insufficient funds",
      500: "Transaction failed"
    }
  }
  
  // Check transaction status
  getTransactionStatus: {
    request: {
      transactionHash: string;
    },
    response: {
      transactionHash: string;
      status: "pending" | "confirmed" | "failed";
      confirmations?: number;
      blockId?: string;
      fee?: string;
      timestamp?: string;
    },
    errors: {
      404: "Transaction not found",
      500: "Status check failed"
    }
  }
  
  // Get wallet balance
  getWalletBalance: {
    request: {
      walletAddress: string;
    },
    response: {
      walletAddress: string;
      balance: string;  // In TON units as string
      lastUpdatedAt: string;
    },
    errors: {
      400: "Invalid wallet address",
      404: "Wallet not found",
      500: "Balance check failed"
    }
  }
  
  // Validate TON Address
  validateTONAddress: {
    request: {
      address: string;
    },
    response: {
      valid: boolean;
      formatted?: string;
      rawAddress?: string;
      bounceable?: boolean;
    },
    errors: {
      400: "Invalid input",
      500: "Validation failed"
    }
  }
}
