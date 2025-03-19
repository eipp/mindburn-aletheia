import React, { useState } from 'react';
import { TaskType } from '../types/enums';

interface TaskFilterProps {
  onFilterChange: (filters: { taskTypes: TaskType[] }) => void;
  onSearchChange: (query: string) => void;
}

export const TaskFilter: React.FC<TaskFilterProps> = ({ 
  onFilterChange, 
  onSearchChange 
}) => {
  const [selectedTaskTypes, setSelectedTaskTypes] = useState<TaskType[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const taskTypeOptions = [
    { value: TaskType.CONTENT_MODERATION, label: '🛡️ Content Moderation' },
    { value: TaskType.FACT_CHECK, label: '🔍 Fact Check' },
    { value: TaskType.TOXICITY, label: '🚫 Toxicity' },
    { value: TaskType.SENTIMENT, label: '😊 Sentiment' },
    { value: TaskType.CUSTOM, label: '🔠 Custom' },
  ];

  const handleTaskTypeChange = (taskType: TaskType) => {
    const newSelectedTaskTypes = selectedTaskTypes.includes(taskType)
      ? selectedTaskTypes.filter(t => t !== taskType)
      : [...selectedTaskTypes, taskType];
    
    setSelectedTaskTypes(newSelectedTaskTypes);
    onFilterChange({ taskTypes: newSelectedTaskTypes });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(searchQuery);
  };

  const clearFilters = () => {
    setSelectedTaskTypes([]);
    setSearchQuery('');
    onFilterChange({ taskTypes: [] });
    onSearchChange('');
  };

  return (
    <div className="task-filter-container">
      <div className="search-section">
        <form onSubmit={handleSearchSubmit}>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-button">
            🔍
          </button>
        </form>
      </div>
      
      <div className="filter-section">
        <h3>Filter by Task Type</h3>
        <div className="task-type-filters">
          {taskTypeOptions.map(option => (
            <label key={option.value} className="task-type-checkbox">
              <input
                type="checkbox"
                checked={selectedTaskTypes.includes(option.value)}
                onChange={() => handleTaskTypeChange(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>
      
      <div className="filter-actions">
        <button 
          className="clear-filters-button"
          onClick={clearFilters}
          disabled={selectedTaskTypes.length === 0 && !searchQuery}
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}; 