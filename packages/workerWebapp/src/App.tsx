import React, { useState, useEffect } from 'react';
import { TasksPage } from './pages/TasksPage';
import { VerificationTasksPage } from './pages/VerificationTasksPage';
import { apiService } from './services/api';
import { WorkerProvider } from './contexts/WorkerContext';
import { EarningsPage } from './pages/EarningsPage';
import { ProfilePage } from './pages/ProfilePage';
import { DashboardPage } from './pages/DashboardPage';
import { TaskDashboardPage } from './pages/TaskDashboardPage';
import './styles/main.css';

// Initialize Telegram Mini App
declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string;
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
      };
    };
  }
}

// App tabs
type AppTab = 'dashboard' | 'tasks' | 'verification' | 'earnings' | 'profile' | 'taskdashboard';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        
        // Expand the Web App to full height
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.expand();
          window.Telegram.WebApp.ready();
        }
        
        // Authenticate with Telegram data
        if (window.Telegram?.WebApp?.initData) {
          const token = await apiService.authenticateWithTelegram({
            initData: window.Telegram.WebApp.initData
          });
          
          if (token) {
            setIsAuthenticated(true);
          } else {
            setError('Authentication failed. Please try again.');
          }
        } else {
          // For development without Telegram
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('Failed to initialize app:', err);
        setError('Failed to connect to the server. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'taskdashboard':
        return <TaskDashboardPage />;
      case 'verification':
        return <VerificationTasksPage />;
      case 'tasks':
        return <TasksPage />;
      case 'earnings':
        return <EarningsPage />;
      case 'profile':
        return <ProfilePage />;
      default:
        return <DashboardPage />;
    }
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading application...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app-auth">
        <h2>Authentication Required</h2>
        <p>You need to authenticate via Telegram to use this app.</p>
        <button onClick={() => window.location.reload()}>
          Authenticate
        </button>
      </div>
    );
  }

  return (
    <WorkerProvider>
      <div className="app">
        <div className="app-content">
          {renderActiveTab()}
        </div>
        
        <nav className="bottom-navigation">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="icon">📊</span>
            <span className="label">Dashboard</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'taskdashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('taskdashboard')}
          >
            <span className="icon">📝</span>
            <span className="label">Task Dashboard</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            <span className="icon">📋</span>
            <span className="label">Tasks</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'verification' ? 'active' : ''}`}
            onClick={() => setActiveTab('verification')}
          >
            <span className="icon">🔍</span>
            <span className="label">Verification</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'earnings' ? 'active' : ''}`}
            onClick={() => setActiveTab('earnings')}
          >
            <span className="icon">💰</span>
            <span className="label">Earnings</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <span className="icon">👤</span>
            <span className="label">Profile</span>
          </button>
        </nav>
        
        {/* TON Connect button container - used by TonConnectUI */}
        <div id="ton-connect-button" style={{ display: 'none' }}></div>
      </div>
    </WorkerProvider>
  );
};

export default App; 