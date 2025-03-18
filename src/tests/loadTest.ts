import { test } from 'artillery';

export const loadTest = {
  config: {
    target: 'http://localhost:3000/api',
    phases: [
      { duration: 60, arrivalRate: 5, name: 'Warm up' },
      { duration: 120, arrivalRate: 10, rampTo: 50, name: 'Ramp up load' },
      { duration: 300, arrivalRate: 50, name: 'Sustained load' },
      { duration: 120, arrivalRate: 50, rampTo: 100, name: 'Peak load' },
      { duration: 60, arrivalRate: 5, name: 'Scale down' }
    ],
    defaults: {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': '${API_KEY}'
      }
    }
  },
  scenarios: [
    {
      name: 'Process submissions with varying risk levels',
      flow: [
        {
          post: {
            url: '/submission',
            json: {
              taskId: '{{ $uuid }}',
              workerId: '{{ $randomString(10) }}',
              taskType: 'verification',
              content: { text: 'test content {{ $randomNumber(1, 1000) }}' },
              result: { label: '{{ $randomItem("approved", "rejected") }}' },
              confidence: '{{ $randomNumber(0, 100) / 100 }}',
              processingTime: '{{ $randomNumber(5, 300) }}',
              timestamp: '{{ $timestamp }}',
              ipAddress: '{{ $randomIp }}',
              deviceFingerprint: {
                userAgent: '{{ $userAgent }}',
                screenResolution: '1920x1080',
                colorDepth: 24,
                timezone: 'UTC',
                language: 'en-US',
                platform: 'Win32',
                plugins: [],
                canvas: '{{ $randomString(32) }}',
                webgl: '{{ $randomString(32) }}',
                fonts: [],
                audio: '{{ $randomString(32) }}'
              }
            },
            capture: {
              json: '$.data.fraudResult.riskScore',
              as: 'riskScore'
            }
          }
        },
        {
          get: {
            url: '/metrics',
            qs: {
              startTime: '{{ $timestamp }}',
              endTime: '{{ $timestamp }}'
            }
          }
        }
      ]
    },
    {
      name: 'Process golden set submissions',
      weight: 2,
      flow: [
        {
          post: {
            url: '/submission',
            json: {
              taskId: 'golden_{{ $uuid }}',
              workerId: '{{ $randomString(10) }}',
              taskType: 'verification',
              content: { text: 'golden set content {{ $randomNumber(1, 1000) }}' },
              result: { label: 'approved' },
              confidence: 0.95,
              processingTime: 45,
              timestamp: '{{ $timestamp }}',
              ipAddress: '{{ $randomIp }}',
              deviceFingerprint: {
                userAgent: '{{ $userAgent }}'
              },
              isGoldenSet: true,
              expectedResult: { label: 'approved' }
            }
          }
        }
      ]
    },
    {
      name: 'Simulate suspicious activity',
      weight: 1,
      flow: [
        {
          post: {
            url: '/submission',
            json: {
              taskId: '{{ $uuid }}',
              workerId: 'suspicious_{{ $randomString(10) }}',
              taskType: 'verification',
              content: { text: 'suspicious content {{ $randomNumber(1, 1000) }}' },
              result: { label: '{{ $randomItem("approved", "rejected") }}' },
              confidence: '{{ $randomNumber(0, 100) / 100 }}',
              processingTime: 1, // Suspiciously fast
              timestamp: '{{ $timestamp }}',
              ipAddress: '{{ $randomIp }}',
              deviceFingerprint: {
                userAgent: '{{ $randomItem("bot1", "bot2", "bot3") }}'
              }
            }
          }
        }
      ]
    }
  ],
  environments: {
    development: {
      target: 'http://localhost:3000/api',
      variables: {
        API_KEY: 'dev-api-key'
      }
    },
    staging: {
      target: 'https://staging-api.example.com/api',
      variables: {
        API_KEY: '{{ $processEnvironment.STAGING_API_KEY }}'
      }
    },
    production: {
      target: 'https://api.example.com/api',
      variables: {
        API_KEY: '{{ $processEnvironment.PRODUCTION_API_KEY }}'
      }
    }
  },
  plugins: {
    metrics: {
      statsd: {
        host: 'localhost',
        port: 8125,
        prefix: 'load_test'
      }
    },
    expect: {
      thresholds: [
        'p95 < 500', // 95th percentile response time under 500ms
        'median < 200', // Median response time under 200ms
        'error < 1' // Error rate under 1%
      ]
    }
  },
  processor: './load-test-functions.js'
}; 