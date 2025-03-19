import React, { useEffect, useState } from 'react';
import { useWorker } from '../hooks/useWorker';
import { Task } from '../types';

export const DashboardPage: React.FC = () => {
  const { 
    profile, 
    wallet, 
    earnings, 
    tasks, 
    assignedTasks, 
    connectWallet,
    tasksLoading,
    refreshTasks 
  } = useWorker();
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh available tasks on mount
  useEffect(() => {
    handleRefresh();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshTasks();
    setIsRefreshing(false);
  };

  // Calculate stats
  const totalAvailableTasks = tasks?.length || 0;
  const totalAssignedTasks = assignedTasks?.length || 0;
  const totalEarnings = earnings?.total || 0;
  const availableEarnings = earnings?.available || 0;
  
  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <button 
          className="refresh-button" 
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Refreshing...' : '🔄 Refresh'}
        </button>
      </header>
      
      {/* Wallet Connect Section */}
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
      
      {/* Summary Stats */}
      <section className="stats-section">
        <div className="stat-card">
          <h3>Available Tasks</h3>
          <p className="stat-value">{tasksLoading ? '...' : totalAvailableTasks}</p>
        </div>
        <div className="stat-card">
          <h3>Assigned Tasks</h3>
          <p className="stat-value">{totalAssignedTasks}</p>
        </div>
        <div className="stat-card">
          <h3>Total Earnings</h3>
          <p className="stat-value">{totalEarnings.toFixed(2)} TON</p>
        </div>
        <div className="stat-card">
          <h3>Available Balance</h3>
          <p className="stat-value">{availableEarnings.toFixed(2)} TON</p>
        </div>
      </section>
      
      {/* Recent Tasks */}
      <section className="recent-tasks-section">
        <div className="section-header">
          <h2>Recent Tasks</h2>
          <a href="#" onClick={() => window.location.href = '#tasks'}>View All</a>
        </div>
        
        {tasksLoading ? (
          <div className="loading-indicator">Loading tasks...</div>
        ) : tasks && tasks.length > 0 ? (
          <div className="task-cards">
            {tasks.slice(0, 3).map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        ) : (
          <div className="no-tasks">
            <p>No tasks available at the moment.</p>
          </div>
        )}
      </section>
      
      {/* Assigned Tasks */}
      {assignedTasks && assignedTasks.length > 0 && (
        <section className="assigned-tasks-section">
          <div className="section-header">
            <h2>Tasks In Progress</h2>
          </div>
          
          <div className="task-cards">
            {assignedTasks.map(task => (
              <TaskCard key={task.id} task={task} isAssigned />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// Task Card Component
const TaskCard: React.FC<{ task: Task; isAssigned?: boolean }> = ({ task, isAssigned = false }) => {
  // Emoji mapping for task types
  const typeEmoji = {
    TEXT_VERIFICATION: '📝',
    IMAGE_VERIFICATION: '🖼️',
    AUDIO_VERIFICATION: '🎵',
    VIDEO_VERIFICATION: '🎬',
  };
  
  // Use mappings to get emoji, fallback to 📋
  const emoji = typeEmoji[task.type] || '📋';
  
  return (
    <div className={`task-card ${isAssigned ? 'assigned' : ''}`}>
      <div className="task-card-header">
        <span className="task-type">{emoji} {task.type.replace('_', ' ')}</span>
        <span className="task-reward">{task.reward} TON</span>
      </div>
      
      <h3 className="task-title">{task.title || `Task #${task.id}`}</h3>
      
      <p className="task-description">
        {task.description?.length > 80 ? 
          `${task.description.substring(0, 80)}...` : 
          task.description}
      </p>
      
      <div className="task-footer">
        <span className="task-time">{task.timeEstimate || 5} min</span>
        {isAssigned && <span className="task-status">In Progress</span>}
      </div>
    </div>
  );
}; 