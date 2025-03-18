import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { TextEncoder, TextDecoder } from 'util';

// Mock browser APIs
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock Intersection Observer
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  value: {
    writeText: vi.fn(),
    readText: vi.fn(),
  },
});

process.env.STAGE = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ALLOWED_INTERNAL_IPS = '127.0.0.1';
process.env.DEVELOPERS_TABLE = 'test-developers';
process.env.API_KEYS_TABLE = 'test-api-keys';
process.env.TASKS_TABLE = 'test-tasks';
process.env.WEBHOOKS_TABLE = 'test-webhooks';
process.env.WEBHOOK_DELIVERIES_TABLE = 'test-webhook-deliveries';
process.env.BILLING_TABLE = 'test-billing';
process.env.TASK_QUEUE_URL = 'http://localhost:4566/000000000000/test-task-queue'; 