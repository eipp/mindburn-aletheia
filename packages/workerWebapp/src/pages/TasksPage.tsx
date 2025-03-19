import React, { useState, useEffect } from 'react';
import { Task } from '../types';
import { TaskType } from '../types/enums';
import { TaskList } from '../components/TaskList';
import { TaskFilter } from '../components/TaskFilter';
import { TaskSubmission } from '../components/TaskSubmission';
import { useWorker } from '../hooks/useWorker';

export const TasksPage: React.FC = () => {
  const { 
    tasks, 
    claimTask, 
    skipTask, 
    tasksLoading, 
    tasksError, 
    refreshTasks 
  } = useWorker();
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterTaskTypes, setFilterTaskTypes] = useState<TaskType[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);

  // Refresh tasks on component mount
  useEffect(() => {
    refreshTasks();
  }, []);

  const handleTaskSelect = async (task: Task) => {
    try {
      // Attempt to claim the task
      const result = await claimTask(task.id);
      
      if (result.success && result.task) {
        setSelectedTask(result.task);
      } else {
        setSubmissionResult({
          success: false,
          message: result.message || 'Failed to claim task. It may have been claimed by someone else.',
        });
        
        // Auto-dismiss the error after 3 seconds
        setTimeout(() => {
          setSubmissionResult(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Error claiming task:', error);
      setSubmissionResult({
        success: false,
        message: 'An error occurred while claiming the task.',
      });
    }
  };

  const handleFilterChange = (filters: { taskTypes: TaskType[] }) => {
    setFilterTaskTypes(filters.taskTypes);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleTaskSubmit = (result: { success: boolean; message?: string }) => {
    setIsSubmitting(true);
    setSubmissionResult(result);
    
    if (result.success) {
      // Close the submission dialog after a short delay on success
      setTimeout(() => {
        setSelectedTask(null);
        setIsSubmitting(false);
        
        // Refresh tasks after successful submission
        refreshTasks();
        
        // Auto-dismiss success message after 3 seconds
        setTimeout(() => {
          setSubmissionResult(null);
        }, 3000);
      }, 1000);
    } else {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubmission = () => {
    if (selectedTask) {
      // Option to skip the task if they don't want to submit
      skipTask(
        selectedTask.id, 
        'Cancelled by worker'
      ).catch(error => {
        console.error('Error skipping task:', error);
      });
    }
    
    setSelectedTask(null);
  };

  return (
    <div className="tasks-page">
      <header className="tasks-header">
        <h1>Available Tasks</h1>
        <button 
          className="refresh-button"
          onClick={() => refreshTasks()}
          disabled={tasksLoading}
        >
          {tasksLoading ? 'Refreshing...' : '🔄 Refresh'}
        </button>
      </header>
      
      <TaskFilter 
        onFilterChange={handleFilterChange}
        onSearchChange={handleSearchChange}
      />
      
      {submissionResult && (
        <div className={`submission-result ${submissionResult.success ? 'success' : 'error'}`}>
          {submissionResult.message || (submissionResult.success ? 'Task submitted successfully!' : 'Submission failed.')}
        </div>
      )}
      
      {tasksError && (
        <div className="error-message">
          {tasksError}
        </div>
      )}
      
      <TaskList 
        tasks={tasks}
        loading={tasksLoading}
        filterTaskTypes={filterTaskTypes}
        searchQuery={searchQuery}
        onTaskSelect={handleTaskSelect}
      />
      
      {selectedTask && (
        <div className="task-modal-overlay">
          <div className="task-modal">
            <TaskSubmission 
              task={selectedTask}
              onSubmit={handleTaskSubmit}
              onCancel={handleCancelSubmission}
            />
          </div>
        </div>
      )}
    </div>
  );
}; 