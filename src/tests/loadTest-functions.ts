import { faker } from '@faker-js/faker';
import * as crypto from 'crypto';

export function generateRandomIp(context: any, events: any, done: () => void): void {
  const ipv4 = faker.internet.ipv4();
  context.vars.randomIp = ipv4;
  return done();
}

export function generateUserAgent(context: any, events: any, done: () => void): void {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/91.0.864.59'
  ];
  context.vars.userAgent = faker.helpers.arrayElement(userAgents);
  return done();
}

export function generateDeviceFingerprint(context: any, events: any, done: () => void): void {
  const fingerprint = {
    screenResolution: faker.helpers.arrayElement(['1920x1080', '2560x1440', '1366x768']),
    colorDepth: faker.helpers.arrayElement([24, 32]),
    timezone: faker.helpers.arrayElement(['UTC', 'America/New_York', 'Europe/London']),
    language: faker.helpers.arrayElement(['en-US', 'en-GB', 'es-ES']),
    platform: faker.helpers.arrayElement(['Win32', 'MacIntel', 'Linux x86_64']),
    plugins: Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () => faker.system.fileName()),
    canvas: crypto.randomBytes(16).toString('hex'),
    webgl: crypto.randomBytes(16).toString('hex'),
    fonts: Array.from({ length: faker.number.int({ min: 0, max: 10 }) }, () => faker.word.sample()),
    audio: crypto.randomBytes(16).toString('hex')
  };
  context.vars.deviceFingerprint = fingerprint;
  return done();
}

export function generateTaskContent(context: any, events: any, done: () => void): void {
  const content = {
    text: faker.lorem.paragraph(),
    metadata: {
      category: faker.helpers.arrayElement(['text', 'image', 'audio']),
      difficulty: faker.helpers.arrayElement(['easy', 'medium', 'hard']),
      priority: faker.number.int({ min: 1, max: 5 })
    }
  };
  context.vars.taskContent = content;
  return done();
}

export function generateWorkerProfile(context: any, events: any, done: () => void): void {
  const profile = {
    workerId: `worker_${faker.string.alphanumeric(10)}`,
    expertise: faker.helpers.arrayElement(['NOVICE', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
    languages: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => faker.helpers.arrayElement(['en', 'es', 'fr', 'de'])),
    specializations: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => faker.helpers.arrayElement(['text', 'image', 'audio'])),
    availableHours: Array.from({ length: faker.number.int({ min: 1, max: 24 }) }, () => faker.number.int({ min: 0, max: 23 })),
    qualityScore: faker.number.float({ min: 0.5, max: 1, precision: 0.01 }),
    taskCompletionRate: faker.number.float({ min: 0.7, max: 1, precision: 0.01 }),
    accountAge: faker.number.int({ min: 1, max: 365 })
  };
  context.vars.workerProfile = profile;
  return done();
}

export function generateFraudulentSubmission(context: any, events: any, done: () => void): void {
  const fraudTypes = [
    {
      type: 'speed',
      processingTime: 1,
      confidence: 1
    },
    {
      type: 'bot',
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      processingTime: faker.number.int({ min: 1, max: 5 })
    },
    {
      type: 'proxy',
      ipAddress: faker.internet.ipv4(),
      processingTime: faker.number.int({ min: 30, max: 60 })
    },
    {
      type: 'pattern',
      result: { label: faker.helpers.arrayElement(['approved', 'rejected']) },
      processingTime: faker.number.int({ min: 10, max: 20 })
    }
  ];

  const fraudType = faker.helpers.arrayElement(fraudTypes);
  context.vars.fraudulentSubmission = {
    taskId: `fraud_${faker.string.alphanumeric(10)}`,
    workerId: `suspicious_${faker.string.alphanumeric(10)}`,
    taskType: 'verification',
    content: generateTaskContent(context, events, () => {}),
    ...fraudType
  };
  return done();
}

export function beforeScenario(context: any, events: any, done: () => void): void {
  // Initialize scenario-specific variables
  generateRandomIp(context, events, () => {});
  generateUserAgent(context, events, () => {});
  generateDeviceFingerprint(context, events, () => {});
  generateWorkerProfile(context, events, () => {});
  return done();
}

export function afterResponse(context: any, events: any, done: () => void): void {
  // Log response metrics
  const response = events.response.body;
  if (response?.data?.fraudResult?.riskScore > 0.8) {
    console.log(`High risk submission detected: ${JSON.stringify(response.data)}`);
  }
  return done();
}

export function handleError(context: any, events: any, done: () => void): void {
  console.error(`Error in scenario: ${events.error}`);
  return done();
} 