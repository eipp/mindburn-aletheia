const { faker } = require('@faker-js/faker');

// Custom Artillery functions
function generateTask(context, events, done) {
  // Generate random task data
  context.vars.task = {
    type: 'image_verification',
    content: faker.image.url(),
    reward: faker.number.float({ min: 0.1, max: 5.0, precision: 0.1 }),
    requiredVerifications: faker.number.int({ min: 3, max: 5 }),
  };
  return done();
}

function generateVerification(context, events, done) {
  // Generate random verification result
  context.vars.verification = {
    result: {
      isValid: faker.datatype.boolean(),
      confidence: faker.number.float({ min: 0.6, max: 1.0, precision: 0.1 }),
    },
  };
  return done();
}

function generateWorker(context, events, done) {
  // Generate random worker data
  context.vars.worker = {
    id: faker.string.uuid(),
    telegramId: faker.number.int({ min: 10000000, max: 99999999 }).toString(),
    walletAddress: `EQA${faker.string.alphanumeric(64)}`,
  };
  return done();
}

module.exports = {
  config: {
    target: '{{ $processEnvironment.API_URL }}',
    phases: [
      // Ramp up to 1000 users over 2 minutes
      { duration: 120, arrivalRate: 8.33 }, // (1000 / 120) users per second
      // Sustain 1000 users for 5 minutes
      { duration: 300, arrivalRate: 0, rampTo: 1000 },
      // Ramp down over 1 minute
      { duration: 60, arrivalRate: 1000, rampTo: 0 },
    ],
    variables: {
      environment: '{{ $processEnvironment.ENVIRONMENT }}',
    },
    defaults: {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': '{{ $processEnvironment.API_KEY }}',
      },
    },
  },
  scenarios: [
    {
      name: 'Task Creation and Verification Flow',
      weight: 70,
      flow: [
        // Before hook to generate test data
        { function: 'generateTask' },
        { function: 'generateWorker' },
        { function: 'generateVerification' },

        // Create task
        {
          post: {
            url: '/tasks',
            json: { 
              type: '{{ task.type }}',
              content: '{{ task.content }}',
              reward: '{{ task.reward }}',
              requiredVerifications: '{{ task.requiredVerifications }}',
            },
            capture: {
              json: '$.id',
              as: 'taskId',
            },
          },
        },

        // Small delay to simulate real-world usage
        { think: 2 },

        // Register worker
        {
          post: {
            url: '/workers',
            json: {
              telegramId: '{{ worker.telegramId }}',
              walletAddress: '{{ worker.walletAddress }}',
            },
            capture: {
              json: '$.id',
              as: 'workerId',
            },
          },
        },

        // Assign task to worker
        {
          post: {
            url: '/tasks/{{ taskId }}/assignments',
            json: {
              workerId: '{{ workerId }}',
            },
          },
        },

        // Submit verification
        {
          post: {
            url: '/tasks/{{ taskId }}/verifications',
            json: {
              workerId: '{{ workerId }}',
              result: '{{ verification.result }}',
            },
          },
        },

        // Check task status
        {
          get: {
            url: '/tasks/{{ taskId }}',
          },
        },
      ],
    },
    {
      name: 'Task Status Polling',
      weight: 30,
      flow: [
        // Generate random task ID format
        {
          function: (context, events, done) => {
            context.vars.randomTaskId = faker.string.uuid();
            return done();
          },
        },

        // Poll task status
        {
          get: {
            url: '/tasks/{{ randomTaskId }}',
          },
        },

        // Poll task verifications
        {
          get: {
            url: '/tasks/{{ randomTaskId }}/verifications',
          },
        },
      ],
    },
  ],
  environments: {
    development: {
      target: 'http://localhost:3000',
      phases: [
        { duration: 60, arrivalRate: 5 }, // Lighter load for development
      ],
    },
    staging: {
      target: 'https://api.staging.mindburn.org',
      phases: [
        { duration: 120, arrivalRate: 8.33 },
        { duration: 300, arrivalRate: 0, rampTo: 1000 },
        { duration: 60, arrivalRate: 1000, rampTo: 0 },
      ],
    },
    production: {
      target: 'https://api.mindburn.org',
      // Production load test should be scheduled during off-peak hours
      phases: [
        { duration: 120, arrivalRate: 8.33 },
        { duration: 300, arrivalRate: 0, rampTo: 1000 },
        { duration: 60, arrivalRate: 1000, rampTo: 0 },
      ],
    },
  },
  plugins: {
    metrics: {},
    expect: {},
    'artillery-plugin-cloudwatch': {
      namespace: 'MindBurnAletheia/LoadTest',
      dimensions: {
        Environment: '{{ $processEnvironment.ENVIRONMENT }}',
      },
    },
  },
};

// Export functions for Artillery
module.exports.generateTask = generateTask;
module.exports.generateVerification = generateVerification;
module.exports.generateWorker = generateWorker; 