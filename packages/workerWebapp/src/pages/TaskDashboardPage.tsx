import React, { useState, useEffect } from 'react';
import { useWorker } from '../hooks/useWorker';
import { TaskList } from '../components/TaskList';
import { TaskType } from '../types/enums';

export const TaskDashboardPage: React.FC = () => {
  const { 
    profile,
    tasks,
    assignedTasks,
    tasksLoading,
    tasksError,
    refreshTasks,
    wallet,
    connectWallet,
    earnings,
    claimTask,
  } = useWorker();

  const [filterTaskTypes, setFilterTaskTypes] = useState<TaskType[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load tasks on component mount
  useEffect(() => {
    handleRefresh();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshTasks();
    setIsRefreshing(false);
  };

  const handleTaskSelect = async (task) => {
    try {
      const result = await claimTask(task.id);
      if (result.success) {
        // Refresh tasks after claiming
        refreshTasks();
      }
    } catch (error) {
      console.error('Error claiming task:', error);
    }
  };

  return (
    <div className="task-dashboard">
      <header className="dashboard-header">
        <h1>Task Dashboard</h1>
        <button 
          className="refresh-button" 
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Refreshing...' : '🔄 Refresh'}
        </button>
      </header>

      {/* Wallet Section */}
      <section className="wallet-section">
        {wallet?.isConnected ? (
          <div className="wallet-connected">
            <h2>TON Wallet</h2>
            <div className="wallet-details">
              <p className="wallet-address">
                Address: <span className="text-ellipsis">{wallet.address}</span>
              </p>
              <p className="wallet-balance">
                Balance: <strong>{wallet.balance.toFixed(2)} TON</strong>
              </p>
            </div>
          </div>
        ) : (
          <div className="wallet-connect-prompt">
            <h2>Connect TON Wallet</h2>
            <p>Connect your TON wallet to receive payments for completed tasks.</p>
            <button 
              className="wallet-connect-button" 
              onClick={connectWallet}
              disabled={wallet.isConnecting}
            >
              {wallet.isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
        )}
      </section>

      {/* Stats Summary */}
      <section className="stats-section">
        <div className="stat-card">
          <h3>Available Tasks</h3>
          <p className="stat-value">{tasks.length}</p>
        </div>
        <div className="stat-card">
          <h3>Assigned Tasks</h3>
          <p className="stat-value">{assignedTasks.length}</p>
        </div>
        <div className="stat-card">
          <h3>Available Earnings</h3>
          <p className="stat-value">{earnings.available.toFixed(2)} TON</p>
        </div>
        <div className="stat-card">
          <h3>Total Earnings</h3>
          <p className="stat-value">{earnings.total.toFixed(2)} TON</p>
        </div>
      </section>

      {/* Task Sections */}
      <section className="tasks-section">
        <h2>Assigned Tasks</h2>
        {assignedTasks.length > 0 ? (
          <TaskList
            tasks={assignedTasks}
            loading={tasksLoading}
            limit={5}
          />
        ) : (
          <div className="empty-state">No tasks currently assigned to you.</div>
        )}
      </section>

      <section className="tasks-section">
        <h2>Available Tasks</h2>
        {tasksError && <div className="error-message">{tasksError}</div>}
        <TaskList
          tasks={tasks}
          loading={tasksLoading}
          filterTaskTypes={filterTaskTypes}
          searchQuery={searchQuery}
          limit={10}
          onTaskSelect={handleTaskSelect}
        />
      </section>
    </div>
  );
}; 