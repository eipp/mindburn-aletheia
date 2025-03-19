import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },  // Ramp up to 50 users
    { duration: '3m', target: 50 },  // Stay at 50 users
    { duration: '1m', target: 100 }, // Ramp up to 100 users
    { duration: '3m', target: 100 }, // Stay at 100 users
    { duration: '1m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete within 500ms
    errors: ['rate<0.1'],             // Error rate must be less than 10%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

export default function () {
  const payload = {
    taskId: `task-${__VU}-${__ITER}`,
    type: 'text_verification',
    content: 'Content to verify under load',
    workerId: `worker-${__VU}`,
  };

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.API_KEY || 'test-key'}`,
    },
  };

  // Submit verification request
  const submitRes = http.post(
    `${BASE_URL}/api/verify`,
    JSON.stringify(payload),
    params
  );

  check(submitRes, {
    'status is 200': (r) => r.status === 200,
    'response has taskId': (r) => r.json('taskId') !== undefined,
  }) || errorRate.add(1);

  sleep(1);

  // Check verification status
  const statusRes = http.get(
    `${BASE_URL}/api/verify/${payload.taskId}/status`,
    params
  );

  check(statusRes, {
    'status is 200': (r) => r.status === 200,
    'has valid status': (r) => ['PENDING', 'COMPLETED', 'FAILED'].includes(r.json('status')),
  }) || errorRate.add(1);

  sleep(Math.random() * 3);
} 