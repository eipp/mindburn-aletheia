import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import {
  Home as HomeIcon,
  Assignment as TaskIcon,
  Person as ProfileIcon,
  School as TrainingIcon,
  AccountBalanceWallet as WalletIcon
} from '@mui/icons-material';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Box sx={{ pb: 7, height: '100vh', overflow: 'auto' }}>
      {/* Main Content */}
      <Box sx={{ height: 'calc(100% - 56px)', overflow: 'auto' }}>
        {children}
      </Box>

      {/* Bottom Navigation */}
      <Paper
        sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}
        elevation={3}
      >
        <BottomNavigation
          value={location.pathname}
          onChange={(_, newValue) => {
            navigate(newValue);
          }}
          showLabels
        >
          <BottomNavigationAction
            label="Home"
            value="/"
            icon={<HomeIcon />}
          />
          <BottomNavigationAction
            label="Tasks"
            value="/tasks"
            icon={<TaskIcon />}
          />
          <BottomNavigationAction
            label="Profile"
            value="/profile"
            icon={<ProfileIcon />}
          />
          <BottomNavigationAction
            label="Training"
            value="/training"
            icon={<TrainingIcon />}
          />
          <BottomNavigationAction
            label="Wallet"
            value="/wallet"
            icon={<WalletIcon />}
          />
        </BottomNavigation>
      </Paper>
    </Box>
  );
} 