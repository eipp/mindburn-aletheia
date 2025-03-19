import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { TonConnectUI, TonConnect } from '@tonconnect/ui';
import { apiService } from '../services/api';
import { Task, WorkerProfile } from '../types';
import { CHAIN } from '@tonconnect/protocol';

// Create singleton TonConnect instance for the app
export const tonConnectUI = new TonConnectUI({
  manifestUrl: '/tonconnect-manifest.json',
  buttonRootId: 'ton-connect-button',
});

interface WorkerContextType {
  // Worker profile
  profile: WorkerProfile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (data: Partial<WorkerProfile>) => Promise<void>;
  
  // Tasks
  tasks: Task[];
  tasksLoading: boolean;
  tasksError: string | null;
  refreshTasks: () => Promise<void>;
  assignedTasks: Task[];
  claimTask: (taskId: string) => Promise<{ success: boolean; task?: Task; message?: string }>;
  skipTask: (taskId: string, reason: string) => Promise<void>;
  
  // Wallet
  wallet: {
    address: string | null;
    balance: number;
    isConnected: boolean;
    isConnecting: boolean;
  };
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  
  // Earnings
  earnings: {
    total: number;
    available: number;
    pending: number;
  };
  withdrawFunds: (amount: number) => Promise<{ success: boolean; txId?: string; message?: string }>;
}

export const WorkerContext = createContext<WorkerContextType | undefined>(undefined);

interface WorkerProviderProps {
  children: ReactNode;
}

export const WorkerProvider: React.FC<WorkerProviderProps> = ({ children }) => {
  // Worker state
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState<boolean>(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  
  // Wallet state
  const [wallet, setWallet] = useState<{
    address: string | null;
    balance: number;
    isConnected: boolean;
    isConnecting: boolean;
  }>({
    address: null,
    balance: 0,
    isConnected: false,
    isConnecting: false
  });
  
  // Earnings state
  const [earnings, setEarnings] = useState<{
    total: number;
    available: number;
    pending: number;
  }>({
    total: 0,
    available: 0,
    pending: 0
  });
  
  // Initialize wallet connection listener
  useEffect(() => {
    // Listen to wallet connection status
    const walletConnectionListener = tonConnectUI.onStatusChange(wallet => {
      if (wallet) {
        const walletAddress = wallet.account.address;
        setWallet(prev => ({
          ...prev,
          address: walletAddress,
          isConnected: true,
          isConnecting: false
        }));
        
        // Update worker profile with wallet address
        if (profile) {
          apiService.updateProfile({
            walletAddress: walletAddress,
          }).catch(console.error);
        }
        
        // Fetch wallet balance
        fetchWalletBalance(walletAddress);
      } else {
        setWallet({
          address: null,
          balance: 0,
          isConnected: false,
          isConnecting: false
        });
      }
    });

    // Clean up the listener on unmount
    return () => {
      walletConnectionListener();
    };
  }, [profile]);
  
  // Fetch worker profile on mount
  useEffect(() => {
    fetchWorkerProfile();
  }, []);
  
  // Initial fetch for available tasks
  useEffect(() => {
    if (profile) {
      fetchTasks();
      fetchAssignedTasks();
    }
  }, [profile]);
  
  // Fetch worker profile
  const fetchWorkerProfile = async () => {
    try {
      setLoading(true);
      const workerProfile = await apiService.getProfile();
      setProfile(workerProfile);
      
      // Update wallet connection if address exists in profile
      if (workerProfile.walletAddress && !wallet.isConnected) {
        await tryRestoreWalletConnection(workerProfile.walletAddress);
      }
      
      // Fetch earnings data
      await fetchEarnings();
    } catch (err) {
      console.error("Failed to fetch worker profile:", err);
      setError("Failed to load your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Update worker profile
  const updateProfile = async (data: Partial<WorkerProfile>) => {
    try {
      const updatedProfile = await apiService.updateProfile(data);
      setProfile(updatedProfile);
    } catch (err) {
      console.error("Failed to update profile:", err);
      throw new Error("Failed to update profile");
    }
  };
  
  // Fetch available tasks
  const fetchTasks = async () => {
    try {
      setTasksLoading(true);
      const response = await apiService.getAvailableTasks({
        taskTypes: profile?.taskPreferences,
        limit: 20
      });
      setTasks(response.tasks);
      setTasksError(null);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      setTasksError("Failed to load tasks. Please try again.");
    } finally {
      setTasksLoading(false);
    }
  };
  
  // Fetch assigned tasks
  const fetchAssignedTasks = async () => {
    try {
      const assignedTasks = await apiService.getAssignedTasks();
      setAssignedTasks(assignedTasks);
    } catch (err) {
      console.error("Failed to fetch assigned tasks:", err);
    }
  };
  
  // Claim a task
  const claimTask = async (taskId: string) => {
    try {
      const result = await apiService.claimTask(taskId);
      
      if (result.success) {
        // Refresh tasks list to update availability
        fetchTasks();
        fetchAssignedTasks();
      }
      
      return result;
    } catch (err) {
      console.error("Failed to claim task:", err);
      return { 
        success: false, 
        message: "An error occurred while claiming the task." 
      };
    }
  };
  
  // Skip a task
  const skipTask = async (taskId: string, reason: string) => {
    try {
      await apiService.skipTask(taskId, reason);
      // Refresh tasks after skipping
      fetchTasks();
      fetchAssignedTasks();
    } catch (err) {
      console.error("Failed to skip task:", err);
      throw new Error("Failed to skip task");
    }
  };
  
  // Try to restore wallet connection
  const tryRestoreWalletConnection = async (walletAddress: string) => {
    try {
      // Attempt to restore connection
      const isRestored = await tonConnectUI.autoconnect();
      
      if (!isRestored) {
        setWallet(prev => ({
          ...prev,
          address: walletAddress,
          isConnected: false
        }));
      }
      
      // Fetch balance regardless of connection status
      fetchWalletBalance(walletAddress);
    } catch (err) {
      console.error("Failed to restore wallet connection:", err);
    }
  };
  
  // Connect wallet
  const connectWallet = async () => {
    try {
      setWallet(prev => ({ ...prev, isConnecting: true }));
      await tonConnectUI.openModal();
    } catch (err) {
      console.error("Failed to connect wallet:", err);
      setWallet(prev => ({ ...prev, isConnecting: false }));
      throw new Error("Failed to connect wallet");
    }
  };
  
  // Disconnect wallet
  const disconnectWallet = async () => {
    try {
      await tonConnectUI.disconnect();
      
      // Also update profile to remove wallet address
      if (profile) {
        await apiService.updateProfile({
          walletAddress: ""
        });
        
        // Update local profile state
        setProfile(prev => 
          prev ? { ...prev, walletAddress: "" } : null
        );
      }
    } catch (err) {
      console.error("Failed to disconnect wallet:", err);
      throw new Error("Failed to disconnect wallet");
    }
  };
  
  // Fetch wallet balance
  const fetchWalletBalance = async (address: string) => {
    try {
      const walletBalance = await apiService.getWalletBalance(address);
      setWallet(prev => ({
        ...prev,
        balance: walletBalance.available
      }));
    } catch (err) {
      console.error("Failed to fetch wallet balance:", err);
    }
  };
  
  // Fetch earnings data
  const fetchEarnings = async () => {
    try {
      const stats = await apiService.getWorkerStats();
      setEarnings({
        total: stats.totalEarnings || 0,
        available: stats.availableBalance || 0,
        pending: stats.pendingEarnings || 0
      });
    } catch (err) {
      console.error("Failed to fetch earnings:", err);
    }
  };
  
  // Withdraw funds
  const withdrawFunds = async (amount: number) => {
    try {
      if (!wallet.address) {
        return { 
          success: false, 
          message: "Wallet not connected" 
        };
      }
      
      if (amount > earnings.available) {
        return { 
          success: false, 
          message: "Insufficient balance" 
        };
      }
      
      // Submit withdrawal request
      const result = await apiService.requestWithdrawal(
        profile?.id || "", 
        amount, 
        wallet.address
      );
      
      // Refresh earnings after withdrawal
      await fetchEarnings();
      
      return { 
        success: true, 
        txId: result.transactionId 
      };
    } catch (err) {
      console.error("Withdrawal failed:", err);
      return { 
        success: false, 
        message: "Withdrawal request failed" 
      };
    }
  };

  const refreshTasks = async () => {
    await Promise.all([
      fetchTasks(),
      fetchAssignedTasks()
    ]);
  };

  // Context value
  const value = {
    // Worker profile
    profile,
    loading,
    error,
    updateProfile,
    
    // Tasks
    tasks,
    tasksLoading,
    tasksError,
    refreshTasks,
    assignedTasks,
    claimTask,
    skipTask,
    
    // Wallet
    wallet,
    connectWallet,
    disconnectWallet,
    
    // Earnings
    earnings,
    withdrawFunds
  };

  return (
    <WorkerContext.Provider value={value}>
      {children}
    </WorkerContext.Provider>
  );
}; 