import React, { useState, useEffect } from 'react';
import { useWorker } from '../hooks/useWorker';
import { apiService } from '../services/api';

interface Transaction {
  id: string;
  amount: number;
  type: 'EARNED' | 'WITHDRAWN';
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  timestamp: string;
  taskId?: string;
  txHash?: string;
}

export const EarningsPage: React.FC = () => {
  const { wallet, earnings, withdrawFunds } = useWorker();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<{
    success: boolean;
    message?: string;
    txId?: string;
  } | null>(null);
  
  // Fetch transaction history on mount
  useEffect(() => {
    if (wallet.address) {
      fetchTransactions();
    }
  }, [wallet.address]);
  
  const fetchTransactions = async () => {
    try {
      setTransactionsLoading(true);
      const result = await apiService.getEarningsHistory({
        limit: 20
      });
      
      setTransactions(result.earnings);
    } catch (err) {
      console.error('Failed to fetch transaction history:', err);
    } finally {
      setTransactionsLoading(false);
    }
  };
  
  const handleWithdraw = async () => {
    // Input validation
    if (!withdrawAmount || isNaN(parseFloat(withdrawAmount)) || parseFloat(withdrawAmount) <= 0) {
      setWithdrawResult({
        success: false,
        message: 'Please enter a valid amount'
      });
      return;
    }
    
    const amount = parseFloat(withdrawAmount);
    
    // Check minimum withdrawal
    if (amount < 1) {
      setWithdrawResult({
        success: false,
        message: 'Minimum withdrawal amount is 1 TON'
      });
      return;
    }
    
    // Check if enough balance
    if (amount > earnings.available) {
      setWithdrawResult({
        success: false,
        message: 'Insufficient balance'
      });
      return;
    }
    
    // Check if wallet is connected
    if (!wallet.isConnected || !wallet.address) {
      setWithdrawResult({
        success: false,
        message: 'Please connect your wallet first'
      });
      return;
    }
    
    try {
      setIsWithdrawing(true);
      setWithdrawResult(null);
      
      const result = await withdrawFunds(amount);
      
      setWithdrawResult(result);
      
      if (result.success) {
        setWithdrawAmount('');
        fetchTransactions(); // Refresh transactions after withdrawal
      }
    } catch (err) {
      console.error('Withdrawal failed:', err);
      setWithdrawResult({
        success: false,
        message: 'An error occurred during withdrawal'
      });
    } finally {
      setIsWithdrawing(false);
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  return (
    <div className="earnings-page">
      <header className="earnings-header">
        <h1>Earnings</h1>
      </header>
      
      {/* Wallet connection status */}
      {!wallet.isConnected && (
        <div className="wallet-warning">
          <p>You need to connect your TON wallet to withdraw earnings.</p>
          <button className="connect-wallet-button">Connect Wallet</button>
        </div>
      )}
      
      {/* Earnings summary */}
      <section className="earnings-summary">
        <div className="summary-card total">
          <h3>Total Earnings</h3>
          <p className="amount">{earnings.total.toFixed(2)} TON</p>
        </div>
        
        <div className="summary-card available">
          <h3>Available Balance</h3>
          <p className="amount">{earnings.available.toFixed(2)} TON</p>
        </div>
        
        <div className="summary-card pending">
          <h3>Pending Earnings</h3>
          <p className="amount">{earnings.pending.toFixed(2)} TON</p>
        </div>
      </section>
      
      {/* Withdrawal section */}
      <section className="withdrawal-section">
        <h2>Withdraw Funds</h2>
        
        <div className="withdrawal-form">
          <div className="form-field">
            <label>Amount (TON)</label>
            <input
              type="number"
              min="1"
              step="0.1"
              max={earnings.available}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Enter amount to withdraw"
              disabled={!wallet.isConnected || isWithdrawing}
            />
          </div>
          
          <div className="form-field">
            <label>Wallet Address</label>
            <div className="wallet-address">
              {wallet.isConnected ? wallet.address : 'Not connected'}
            </div>
          </div>
          
          <button
            className="withdraw-button"
            onClick={handleWithdraw}
            disabled={!wallet.isConnected || isWithdrawing || !withdrawAmount}
          >
            {isWithdrawing ? 'Processing...' : 'Withdraw'}
          </button>
          
          {withdrawResult && (
            <div className={`withdraw-result ${withdrawResult.success ? 'success' : 'error'}`}>
              {withdrawResult.message || (withdrawResult.success 
                ? 'Withdrawal initiated successfully' 
                : 'Withdrawal failed')}
            </div>
          )}
          
          <div className="withdrawal-note">
            <p>Note: Minimum withdrawal amount is 1 TON.</p>
            <p>Transactions typically process within 15 minutes.</p>
          </div>
        </div>
      </section>
      
      {/* Transaction history */}
      <section className="transaction-history">
        <div className="section-header">
          <h2>Transaction History</h2>
          <button 
            onClick={fetchTransactions}
            disabled={transactionsLoading}
            className="refresh-button"
          >
            {transactionsLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        
        {transactionsLoading ? (
          <div className="loading-indicator">Loading transactions...</div>
        ) : transactions.length > 0 ? (
          <div className="transactions-table">
            <div className="transaction-header">
              <div className="column date">Date</div>
              <div className="column type">Type</div>
              <div className="column amount">Amount</div>
              <div className="column status">Status</div>
            </div>
            
            {transactions.map((tx) => (
              <div key={tx.id} className={`transaction-row ${tx.type.toLowerCase()}`}>
                <div className="column date">{formatDate(tx.timestamp)}</div>
                <div className="column type">
                  {tx.type === 'EARNED' ? 'Earned' : 'Withdrawn'}
                </div>
                <div className="column amount">
                  {tx.type === 'WITHDRAWN' ? '-' : '+'}
                  {tx.amount.toFixed(2)} TON
                </div>
                <div className={`column status ${tx.status.toLowerCase()}`}>
                  {tx.status}
                  {tx.txHash && (
                    <a
                      href={`https://tonviewer.com/transaction/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="view-tx"
                    >
                      View
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-transactions">
            <p>No transactions found</p>
          </div>
        )}
      </section>
    </div>
  );
}; 