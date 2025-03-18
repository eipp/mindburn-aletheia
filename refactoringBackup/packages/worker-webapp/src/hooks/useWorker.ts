import { useContext } from 'react';
import { WorkerContext } from '../contexts/WorkerContext';

export const useWorker = () => {
  const context = useContext(WorkerContext);
  if (context === undefined) {
    throw new Error('useWorker must be used within a WorkerProvider');
  }
  return context;
}; 