import { createTonService, TonService, WalletConfig } from '../src/services/ton';
import { createLogger } from '../src/utils/logging/logger';
import { jest } from '@jest/globals';

// Mock the ton client
jest.mock('@ton/ton', () => {
  const mockSend = jest.fn().mockResolvedValue({
    hash: () => Buffer.from('mock_transaction_hash'),
  });
  
  const mockGetSeqno = jest.fn().mockResolvedValue(1);
  
  const mockWalletV4 = {
    create: jest.fn().mockReturnValue({
      address: {
        toString: () => 'EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_dGad2hhQcRMN',
      },
      send: mockSend,
      getSeqno: mockGetSeqno,
    }),
  };
  
  const mockClient = {
    getBalance: jest.fn().mockResolvedValue(BigInt(1000000000)),
    getTransactions: jest.fn().mockResolvedValue([
      {
        txId: 'mock_tx_id',
        timestamp: 1234567890,
        amount: BigInt(1000000000),
        totalFee: BigInt(10000000),
        status: 'completed',
      },
    ]),
    getTransaction: jest.fn().mockResolvedValue({
      status: 'completed',
      block: 'mock_block',
      totalFee: BigInt(10000000),
    }),
  };
  
  return {
    TonClient: jest.fn().mockImplementation(() => mockClient),
    WalletContractV4: mockWalletV4,
    Address: {
      parse: jest.fn().mockReturnValue({ toString: () => 'mock_address' }),
    },
    SendMode: {
      PAY_GAS_SEPARATELY: 1,
    },
    beginCell: () => ({
      storeUint: () => ({
        storeStringTail: () => ({
          endCell: () => ({ hash: () => Buffer.from('message_hash') }),
        }),
      }),
      storeBuffer: () => ({
        endCell: () => ({ hash: () => Buffer.from('message_hash') }),
      }),
      endCell: () => ({ hash: () => Buffer.from('message_hash') }),
    }),
  };
});

// Mock crypto functions
jest.mock('@ton/crypto', () => {
  return {
    mnemonicToPrivateKey: jest.fn().mockResolvedValue({
      publicKey: Buffer.from('mock_public_key'),
      secretKey: Buffer.from('mock_secret_key'),
    }),
    keyPairFromSecretKey: jest.fn().mockReturnValue({
      publicKey: Buffer.from('mock_public_key'),
      secretKey: Buffer.from('mock_secret_key'),
    }),
    keyPairFromSeed: jest.fn().mockResolvedValue({
      publicKey: Buffer.from('mock_public_key'),
      secretKey: Buffer.from('mock_secret_key'),
    }),
    sign: jest.fn().mockReturnValue(Buffer.from('mock_signature')),
  };
});

// Mock the util/ton module
jest.mock('../src/utils/ton', () => {
  return {
    ton: {
      client: {
        create: jest.fn().mockReturnValue({}),
        getBalance: jest.fn().mockResolvedValue(BigInt(1000000000)),
        verifySignature: jest.fn().mockResolvedValue(true),
      },
      validation: {
        address: jest.fn().mockReturnValue(true),
        withdrawal: jest.fn().mockReturnValue({ isValid: true }),
      },
      format: {
        amount: jest.fn().mockReturnValue('1.0 TON'),
      },
      calculation: {
        fee: jest.fn().mockReturnValue(new (require('bignumber.js').BigNumber)(0.01)),
      },
      explorer: {
        getTransactionUrl: jest.fn().mockReturnValue('https://tonscan.org/tx/mock_tx_hash'),
        getAddressUrl: jest.fn().mockReturnValue('https://tonscan.org/address/mock_address'),
      },
    },
  };
});

describe('TonService', () => {
  let tonService: TonService;
  const logger = createLogger({ console: false });
  
  beforeEach(() => {
    tonService = createTonService(
      {
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        network: 'testnet',
      },
      logger
    );
  });
  
  describe('Wallet functionality', () => {
    test('should initialize wallet from mnemonic', async () => {
      const walletConfig: WalletConfig = {
        mnemonic: ['word1', 'word2', 'word3', 'word4', 'word5', 'word6', 
                  'word7', 'word8', 'word9', 'word10', 'word11', 'word12'],
        workchain: 0,
      };
      
      const result = await tonService.initWallet(walletConfig);
      expect(result).toBe(true);
      expect(tonService.getWalletAddress()).toBe('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_dGad2hhQcRMN');
    });
    
    test('should get wallet balance', async () => {
      // Initialize wallet first
      const walletConfig: WalletConfig = {
        mnemonic: ['word1', 'word2', 'word3', 'word4', 'word5', 'word6', 
                  'word7', 'word8', 'word9', 'word10', 'word11', 'word12'],
      };
      await tonService.initWallet(walletConfig);
      
      const balance = await tonService.getBalance();
      expect(balance).toBe(BigInt(1000000000));
    });
    
    test('should send TON', async () => {
      // Initialize wallet first
      const walletConfig: WalletConfig = {
        mnemonic: ['word1', 'word2', 'word3', 'word4', 'word5', 'word6', 
                  'word7', 'word8', 'word9', 'word10', 'word11', 'word12'],
      };
      await tonService.initWallet(walletConfig);
      
      const result = await tonService.sendTon(
        'EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_dGad2hhQcRMN',
        1.0,
        'Test payment'
      );
      
      expect(result).not.toBeNull();
      expect(result?.txHash).toBe('6d6f636b5f7472616e73616374696f6e5f68617368'); // hex of 'mock_transaction_hash'
    });
    
    test('should create batch payment', async () => {
      // Initialize wallet first
      const walletConfig: WalletConfig = {
        mnemonic: ['word1', 'word2', 'word3', 'word4', 'word5', 'word6', 
                  'word7', 'word8', 'word9', 'word10', 'word11', 'word12'],
      };
      await tonService.initWallet(walletConfig);
      
      const payments = [
        {
          address: 'EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_dGad2hhQcRMN',
          amount: 0.1,
          comment: 'Payment 1',
        },
        {
          address: 'EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_dGad2hhQcRMN',
          amount: 0.2,
          comment: 'Payment 2',
        },
      ];
      
      const result = await tonService.createBatchPayment(payments);
      
      expect(result).not.toBeNull();
      expect(result?.txHash).toBe('6d6f636b5f7472616e73616374696f6e5f68617368');
    });
    
    test('should create and verify signed message', async () => {
      // Initialize wallet first
      const walletConfig: WalletConfig = {
        mnemonic: ['word1', 'word2', 'word3', 'word4', 'word5', 'word6', 
                  'word7', 'word8', 'word9', 'word10', 'word11', 'word12'],
      };
      await tonService.initWallet(walletConfig);
      
      const payload = {
        action: 'verify_identity',
        userId: '12345',
        timestamp: Date.now(),
      };
      
      const signedMessage = await tonService.createSignedMessage(payload);
      
      expect(signedMessage).not.toBeNull();
      expect(signedMessage?.message).toBe(JSON.stringify(payload));
      expect(signedMessage?.signature).toBe('bW9ja19zaWduYXR1cmU='); // base64 of 'mock_signature'
      
      // Verify the signed message
      const isValid = await tonService.verifySignedMessage(
        signedMessage!.message,
        signedMessage!.signature,
        Buffer.from('mock_public_key')
      );
      
      expect(isValid).toBe(true);
    });
  });
  
  describe('Utility functions', () => {
    test('should validate TON address', () => {
      const isValid = tonService.validateAddress('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_dGad2hhQcRMN');
      expect(isValid).toBe(true);
    });
    
    test('should format TON amount', () => {
      const formatted = tonService.formatAmount(1.0);
      expect(formatted).toBe('1.0 TON');
    });
    
    test('should calculate transaction fee', () => {
      const fee = tonService.calculateFee(1.0);
      expect(fee).toBe(0.01);
    });
    
    test('should get explorer URLs', () => {
      const txUrl = tonService.getTransactionUrl('mock_tx_hash');
      expect(txUrl).toBe('https://tonscan.org/tx/mock_tx_hash');
      
      const addressUrl = tonService.getAddressUrl('mock_address');
      expect(addressUrl).toBe('https://tonscan.org/address/mock_address');
    });
  });
}); 