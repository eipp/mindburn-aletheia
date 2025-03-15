import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { useWalletStore } from '../../store/wallet';
import {
  formatTonAmount,
  parseTonAmount,
  validateTransactionData,
  formatTransactionType,
  getTransactionIcon,
  formatTransactionStatus,
  shortenAddress,
  getTransactionExplorerUrl
} from '../../utils/wallet';

const Wallet: React.FC = () => {
  const {
    address,
    balance,
    transactions,
    isLoading,
    error,
    pendingWithdrawal,
    fetchBalance,
    fetchTransactions,
    withdraw
  } = useWalletStore();

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawError, setWithdrawError] = useState<string[]>([]);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);

  useEffect(() => {
    if (address) {
      fetchBalance(address);
      fetchTransactions(address);
    }
  }, [address, fetchBalance, fetchTransactions]);

  const handleWithdrawSubmit = async () => {
    const amount = parseTonAmount(withdrawAmount);
    if (!amount) {
      setWithdrawError(['Invalid amount']);
      return;
    }

    const validation = validateTransactionData({
      amount,
      address: withdrawAddress,
      balance: balance?.available || 0,
      minWithdrawal: 1
    });

    if (!validation.isValid) {
      setWithdrawError(validation.errors);
      return;
    }

    try {
      await withdraw({
        toAddress: withdrawAddress,
        amount
      });
      setShowWithdrawDialog(false);
      setWithdrawAmount('');
      setWithdrawAddress('');
      setWithdrawError([]);
    } catch (error) {
      setWithdrawError([error instanceof Error ? error.message : 'Withdrawal failed']);
    }
  };

  if (isLoading && !balance) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box m={2}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box p={2}>
      {/* Balance Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Balance
          </Typography>
          <Typography variant="h4" color="primary">
            {formatTonAmount(balance?.available || 0)} TON
          </Typography>
          {balance?.pending ? (
            <Typography variant="body2" color="text.secondary">
              Pending: {formatTonAmount(balance.pending)} TON
            </Typography>
          ) : null}
          <Box mt={2}>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={() => setShowWithdrawDialog(true)}
              disabled={!balance?.available || balance.available <= 0}
            >
              Withdraw
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Transaction History
          </Typography>
          <List>
            {transactions.map((tx, index) => (
              <React.Fragment key={tx.id}>
                {index > 0 && <Divider />}
                <ListItem
                  component="a"
                  href={getTransactionExplorerUrl(tx.hash || '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ textDecoration: 'none' }}
                >
                  <ListItemIcon>{getTransactionIcon(tx.type)}</ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body1">
                        {formatTransactionType(tx.type)}
                        <Typography
                          component="span"
                          color={tx.amount >= 0 ? 'success.main' : 'error.main'}
                          sx={{ float: 'right' }}
                        >
                          {tx.amount >= 0 ? '+' : ''}{formatTonAmount(tx.amount)} TON
                        </Typography>
                      </Typography>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(tx.timestamp * 1000).toLocaleString()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {shortenAddress(tx.address)}
                        </Typography>
                        <Typography
                          variant="body2"
                          color={tx.status === 'completed' ? 'success.main' : 'text.secondary'}
                        >
                          {formatTransactionStatus(tx.status)}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
            {transactions.length === 0 && (
              <ListItem>
                <ListItemText
                  primary={
                    <Typography variant="body2" color="text.secondary" align="center">
                      No transactions yet
                    </Typography>
                  }
                />
              </ListItem>
            )}
          </List>
        </CardContent>
      </Card>

      {/* Withdraw Dialog */}
      <Dialog
        open={showWithdrawDialog}
        onClose={() => setShowWithdrawDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Withdraw TON</DialogTitle>
        <DialogContent>
          <Box mt={2}>
            <TextField
              label="Amount (TON)"
              fullWidth
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              type="number"
              inputProps={{ min: 0, step: 0.1 }}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Recipient Address"
              fullWidth
              value={withdrawAddress}
              onChange={(e) => setWithdrawAddress(e.target.value)}
              sx={{ mb: 2 }}
            />
            {withdrawError.length > 0 && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {withdrawError.map((err, index) => (
                  <div key={index}>{err}</div>
                ))}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowWithdrawDialog(false)}
            disabled={pendingWithdrawal}
          >
            Cancel
          </Button>
          <Button
            onClick={handleWithdrawSubmit}
            variant="contained"
            disabled={pendingWithdrawal}
          >
            {pendingWithdrawal ? <CircularProgress size={24} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Wallet; 