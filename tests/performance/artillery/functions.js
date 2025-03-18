function generateTaskPayload(context, events, done) {
  const taskTypes = context.vars.taskTypes;
  const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
  
  context.vars.taskPayload = {
    type: taskType,
    content: `Test content for ${taskType} - ${Date.now()}`,
    complexity: Math.random() > 0.7 ? 'high' : 'low',
    metadata: {
      source: 'load_test',
      timestamp: new Date().toISOString(),
    },
  };
  
  return done();
}

function generateWorkerMetrics(context, events, done) {
  context.vars.workerMetrics = {
    workerId: `worker_${context.vars.$uuid}`,
    metrics: {
      tasksCompleted: Math.floor(Math.random() * 50),
      averageProcessingTime: Math.floor(Math.random() * 5000),
      accuracyScore: Math.random() * 0.5 + 0.5,
      lastActive: new Date().toISOString(),
    },
  };
  
  return done();
}

module.exports = {
  generateTaskPayload,
  generateWorkerMetrics,
}; 