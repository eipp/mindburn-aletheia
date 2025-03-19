import React, { useEffect, useState } from 'react';
import { verificationOrchestratorService } from '../services/verificationOrchestratorService';
import { HumanReviewInterface } from '../components/HumanReviewInterface';
import { VerificationTask, HumanVerificationSubmission } from '../types';

export const VerificationTasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<VerificationTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<VerificationTask | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const tasks = await verificationOrchestratorService.fetchVerificationTasks();
      setTasks(tasks);
    } catch (err) {
      setError('Failed to load verification tasks. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskSelect = async (task: VerificationTask) => {
    try {
      setLoading(true);
      const result = await verificationOrchestratorService.claimVerificationTask(task.id);
      
      if (result.success && result.task) {
        setSelectedTask(result.task);
      } else {
        showNotification(result.message || 'Failed to claim task', 'error');
      }
    } catch (err) {
      showNotification('Error claiming task', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationSubmit = async (verification: HumanVerificationSubmission) => {
    try {
      setLoading(true);
      const result = await verificationOrchestratorService.submitVerification(verification);
      
      if (result.success) {
        showNotification('Verification submitted successfully!', 'success');
        setSelectedTask(null);
        fetchTasks(); // Refresh the task list
      } else {
        showNotification(result.message || 'Failed to submit verification', 'error');
      }
    } catch (err) {
      showNotification('Error submitting verification', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelVerification = async () => {
    if (selectedTask) {
      try {
        setLoading(true);
        await verificationOrchestratorService.skipVerificationTask(
          selectedTask.id,
          'Cancelled by worker'
        );
        setSelectedTask(null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000); // Hide after 5 seconds
  };

  if (loading && !selectedTask) {
    return (
      <div className="verification-tasks-loading">
        <div className="loading-spinner"></div>
        <p>Loading verification tasks...</p>
      </div>
    );
  }

  return (
    <div className="verification-tasks-page">
      <header className="page-header">
        <h1>AI Verification Tasks</h1>
        <p className="header-subtitle">Human-in-the-loop verification of AI outputs</p>
      </header>
      
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={fetchTasks}>Try Again</button>
        </div>
      )}
      
      {selectedTask ? (
        <HumanReviewInterface
          task={selectedTask}
          onSubmit={handleVerificationSubmit}
          onCancel={handleCancelVerification}
        />
      ) : (
        <div className="tasks-container">
          {tasks.length === 0 ? (
            <div className="no-tasks-message">
              <h3>No verification tasks available</h3>
              <p>Check back later for new tasks that need human verification.</p>
              <button onClick={fetchTasks} className="refresh-button">
                Refresh Tasks
              </button>
            </div>
          ) : (
            <>
              <div className="tasks-header">
                <h2>Available Verification Tasks</h2>
                <button onClick={fetchTasks} className="refresh-button">
                  Refresh
                </button>
              </div>
              
              <div className="task-list">
                {tasks.map((task) => (
                  <div key={task.id} className="verification-task-card" onClick={() => handleTaskSelect(task)}>
                    <div className="task-header">
                      <span className={`task-type ${task.verificationType}`}>
                        {task.verificationType.replace('_', ' ')}
                      </span>
                      <span className={`task-priority ${task.priority > 2 ? 'high' : 'normal'}`}>
                        {task.priority > 2 ? 'HIGH PRIORITY' : 'Normal Priority'}
                      </span>
                    </div>
                    
                    <h3 className="task-title">{task.title}</h3>
                    
                    <div className="task-content-preview">
                      {task.contentType === 'image_text' ? (
                        <div className="image-preview">
                          <img 
                            src={`data:image/jpeg;base64,${task.content.substring(0, 100)}...`} 
                            alt="Preview" 
                          />
                          <span>Image verification task</span>
                        </div>
                      ) : (
                        <p>{task.content.length > 150 
                          ? `${task.content.substring(0, 150)}...` 
                          : task.content}
                        </p>
                      )}
                    </div>
                    
                    <div className="task-footer">
                      <span className="task-reward">{task.reward} TON</span>
                      <span className="task-time">{task.timeEstimate} min</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}; 