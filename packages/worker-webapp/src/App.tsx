import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WebApp } from '@twa-dev/sdk';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';

// Pages
import Dashboard from './pages/Dashboard';
import TaskFeed from './pages/TaskFeed';
import TaskVerification from './pages/TaskVerification';
import Profile from './pages/Profile';
import Training from './pages/Training';
import Wallet from './pages/Wallet';

// Components
import Layout from './components/Layout';

// Utils & Hooks
import { initTelegramApp } from './utils/telegram';
import { useAppTheme } from './theme';
import { useStore } from './store';

function App() {
  const { initializeWorker } = useStore();
  const theme = useAppTheme();

  useEffect(() => {
    // Initialize Telegram Mini App
    initTelegramApp();

    // Initialize worker data
    initializeWorker();
  }, [initializeWorker]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          height: 'var(--tg-viewport-stable-height)',
          overflow: 'hidden',
          bgcolor: 'background.default',
          color: 'text.primary'
        }}
      >
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tasks" element={<TaskFeed />} />
              <Route path="/verify/:taskId" element={<TaskVerification />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/training" element={<Training />} />
              <Route path="/wallet" element={<Wallet />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </Box>
    </ThemeProvider>
  );
}

export default App;
