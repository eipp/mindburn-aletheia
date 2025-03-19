import React from 'react';
import { Task } from '../types';
import { TaskType, ContentType } from '../types/enums';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case TaskType.CONTENT_MODERATION:
        return '🛡️';
      case TaskType.FACT_CHECK:
        return '🔍';
      case TaskType.TOXICITY:
        return '🚫';
      case TaskType.SENTIMENT:
        return '😊';
      case TaskType.CUSTOM:
        return '🔠';
      default:
        return '📋';
    }
  };

  const getContentTypeIcon = (contentType: string) => {
    switch (contentType) {
      case ContentType.TEXT:
        return '📝';
      case ContentType.IMAGE:
        return '🖼️';
      case ContentType.AUDIO:
        return '🔊';
      case ContentType.VIDEO:
        return '🎬';
      case ContentType.DOCUMENT:
        return '📄';
      default:
        return '📝';
    }
  };

  const formatTimeLeft = (deadline: string) => {
    const timeLeft = new Date(deadline).getTime() - Date.now();
    if (timeLeft <= 0) return 'Expired';
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const getComplexityStars = (complexity: number) => {
    return '⭐'.repeat(Math.min(complexity, 5));
  };

  const getPriorityClass = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      case 'low':
        return 'priority-low';
      default:
        return '';
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  return (
    <div className={`task-card ${getPriorityClass(task.priority)}`} onClick={onClick}>
      <div className="task-header">
        <div className="task-type">
          <span className="task-icon">{getTaskIcon(task.type)}</span>
          <span className="content-type-icon">{getContentTypeIcon(task.contentType)}</span>
        </div>
        <div className="task-reward">{task.reward.toFixed(2)} TON</div>
      </div>
      
      <div className="task-title">{truncateText(task.title || 'Untitled Task', 40)}</div>
      
      <div className="task-description">
        {truncateText(task.description || 'No description', 75)}
      </div>
      
      <div className="task-footer">
        <div className="task-meta">
          <div className="task-complexity" title={`Complexity: ${task.complexity}/5`}>
            {getComplexityStars(task.complexity)}
          </div>
          
          <div className="task-deadline" title={`Deadline: ${new Date(task.deadline).toLocaleString()}`}>
            ⏰ {formatTimeLeft(task.deadline)}
          </div>
        </div>
        
        <button className="task-claim-btn">
          Claim Task
        </button>
      </div>
    </div>
  );
}; 