import { Task, TaskStatus } from '@mindburn/shared';

class TaskManager {
  private tasks: Map<string, Task> = new Map();

  async createTask(type: string, data: Record<string, unknown>): Promise<Task> {
    const task: Task = {
      id: Math.random().toString(36).substring(2, 15),
      type,
      status: TaskStatus.PENDING,
      data,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.tasks.set(task.id, task);
    return task;
  }
}

export const taskManager = new TaskManager();