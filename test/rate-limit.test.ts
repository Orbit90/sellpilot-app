/**
 * SellPilot Phase 3, Step 3: Global API Rate Limiting Test Suite
 *
 * Verifies:
 * 1. Default window and max calculation.
 * 2. Custom environment variable overrides (RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX).
 * 3. shouldSkipRateLimit skips CORS preflight OPTIONS requests.
 * 4. shouldSkipRateLimit skips Paystack webhook callbacks.
 * 5. shouldSkipRateLimit does NOT skip normal API requests.
 * 6. Normal unauthenticated API requests return HTTP 200 with rate limit headers.
 * 7. Rate limit headers conform to standard (RateLimit-*) and legacy (X-RateLimit-*).
 * 8. Rate limit exhaustion returns HTTP 429 Too Many Requests.
 * 9. HTTP 429 response includes JSON error payload and Retry-After header.
 * 10. Paystack webhook endpoint is NEVER blocked by rate limiter even under high volume.
 * 11. CORS preflight OPTIONS requests bypass rate limiter.
 * 12. Static frontend assets (GET /) are NOT rate-limited.
 * 13. Authenticated requests succeed and retain rate limit headers.
 * 14. Unauthenticated requests are subject to rate limiting.
 * 15. Authentication flow (POST /api/auth/login) operates cleanly under rate limiting.
 */

import express from 'express';
import { ChildProcess, spawn } from 'child_process';
import {
  createGlobalRateLimiter,
  getRateLimitMax,
  getRateLimitWindowMs,
  shouldSkipRateLimit,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_RATE_LIMIT_MAX,
} from '../server/rateLimiter';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  num: number;
  description: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];
let spawnedServer: ChildProcess | null = null;

function record(num: number, description: string, passed: boolean, error?: string) {
  results.push({ num, description, passed, error });
  if (passed) {
    console.log(`[PASS] Test ${num}: ${description}`);
  } else {
    console.error(`[FAIL] Test ${num}: ${description} -> ${error || 'Failed condition'}`);
  }
}

async function ensureServerRunning() {
  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/api/plans`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        console.log('Test server is up and responsive on port 3000.\n');
        return;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  console.log('Starting local server on port 3000...');
  spawnedServer = spawn('npx', ['tsx', 'server.ts'], {
    env: { ...process.env, PORT: '3000' },
    stdio: 'ignore',
  });

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 300));
    try {
      const res = await fetch(`${BASE_URL}/api/plans`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        console.log('Test server is up and responsive on port 3000.\n');
        return;
      }
    } catch {
      // keep waiting
    }
  }
  console.warn('Timed out waiting for test server on port 3000.');
}

async function runTests() {
  console.log('=====================================================');
  console.log('--- STARTING GLOBAL API RATE LIMITING TESTS ---');
  console.log('=====================================================\n');

  // --- PART 1: UNIT LOGIC TESTS ---
  console.log('Running Rate Limiter Unit Configuration Tests...');

  // Test 1: Default window calculation
  const defaultWindow = getRateLimitWindowMs({});
  record(
    1,
    `getRateLimitWindowMs returns default window (${DEFAULT_RATE_LIMIT_WINDOW_MS} ms / 15 minutes)`,
    defaultWindow === 15 * 60 * 1000
  );

  // Test 2: Default max calculation
  const defaultMax = getRateLimitMax({});
  record(
    2,
    `getRateLimitMax returns default request limit (${DEFAULT_RATE_LIMIT_MAX} requests)`,
    defaultMax === 500
  );

  // Test 3: Environment variable override for window and max
  const customEnv: NodeJS.ProcessEnv = {
    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_MAX: '50',
  };
  const customWindow = getRateLimitWindowMs(customEnv);
  const customMax = getRateLimitMax(customEnv);
  record(
    3,
    'Custom environment variables (RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX) override defaults',
    customWindow === 60000 && customMax === 50
  );

  // Test 4: shouldSkipRateLimit skips OPTIONS
  const optionsReq = { method: 'OPTIONS', path: '/api/products', originalUrl: '/api/products' } as any;
  record(
    4,
    'shouldSkipRateLimit returns true for CORS preflight OPTIONS requests',
    shouldSkipRateLimit(optionsReq) === true
  );

  // Test 5: shouldSkipRateLimit skips Paystack webhook
  const webhookReq = {
    method: 'POST',
    path: '/payments/paystack/webhook',
    originalUrl: '/api/payments/paystack/webhook',
  } as any;
  record(
    5,
    'shouldSkipRateLimit returns true for Paystack payment webhook callbacks',
    shouldSkipRateLimit(webhookReq) === true
  );

  // Test 6: shouldSkipRateLimit does NOT skip regular API endpoints
  const regularApiReq = {
    method: 'GET',
    path: '/plans',
    originalUrl: '/api/plans',
  } as any;
  record(
    6,
    'shouldSkipRateLimit returns false for standard API endpoints (/api/plans)',
    shouldSkipRateLimit(regularApiReq) === false
  );

  // --- PART 2: DEDICATED RATE LIMIT EXHAUSTION & 429 VERIFICATION ---
  console.log('\nRunning Dedicated Rate Limit Exhaustion and 429 HTTP Tests...');

  const testApp = express();
  testApp.set('trust proxy', 1);

  // Small test limiter: 3 requests per 5-second window
  const testLimiter = createGlobalRateLimiter({
    windowMs: 5000,
    max: 3,
  });

  testApp.use('/api', testLimiter);
  testApp.get('/api/test-endpoint', (_req, res) => res.json({ success: true }));
  testApp.post('/api/payments/paystack/webhook', (_req, res) => res.json({ webhook: true }));
  testApp.options('/api/test-endpoint', (_req, res) => res.sendStatus(204));
  testApp.get('/static-asset.js', (_req, res) => res.type('text/javascript').send('// static'));

  const dedicatedServer = await new Promise<import('http').Server>((resolve) => {
    const s = testApp.listen(0, () => resolve(s));
  });
  const dedicatedPort = (dedicatedServer.address() as any).port;
  const dedicatedBase = `http://127.0.0.1:${dedicatedPort}`;

  try {
    // Test 7: Normal requests within limit return HTTP 200 with headers
    const r1 = await fetch(`${dedicatedBase}/api/test-endpoint`);
    const r1Headers = {
      limit: r1.headers.get('ratelimit-limit'),
      remaining: r1.headers.get('ratelimit-remaining'),
      reset: r1.headers.get('ratelimit-reset'),
      xLimit: r1.headers.get('x-ratelimit-limit'),
      xRemaining: r1.headers.get('x-ratelimit-remaining'),
    };
    record(
      7,
      'Normal API requests return HTTP 200 and emit standard & legacy rate limit headers',
      r1.status === 200 &&
        r1Headers.limit === '3' &&
        r1Headers.remaining === '2' &&
        r1Headers.xLimit === '3' &&
        r1Headers.xRemaining === '2'
    );

    // Consume remaining allowance (requests 2 and 3)
    await fetch(`${dedicatedBase}/api/test-endpoint`);
    const r3 = await fetch(`${dedicatedBase}/api/test-endpoint`);
    const r3Remaining = r3.headers.get('ratelimit-remaining');

    // Test 8: Request 4 exceeds the limit -> returns HTTP 429 Too Many Requests
    const r4 = await fetch(`${dedicatedBase}/api/test-endpoint`);
    const r4Body = await r4.json();
    const r4RetryAfter = r4.headers.get('retry-after');

    record(
      8,
      'Exceeding the rate limit threshold returns HTTP 429 Too Many Requests',
      r4.status === 429 && r3Remaining === '0'
    );

    // Test 9: HTTP 429 response structure
    record(
      9,
      'HTTP 429 response includes informative error payload and Retry-After header',
      r4Body.statusCode === 429 &&
        typeof r4Body.error === 'string' &&
        r4Body.error.includes('Too many requests') &&
        !!r4RetryAfter &&
        Number(r4RetryAfter) > 0
    );

    // Test 10: Paystack webhook is NOT blocked even when rate limit is exceeded
    const webhookRes = await fetch(`${dedicatedBase}/api/payments/paystack/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'charge.success' }),
    });
    record(
      10,
      'Paystack webhook endpoint (/api/payments/paystack/webhook) bypasses rate limit (HTTP 200)',
      webhookRes.status === 200
    );

    // Test 11: CORS preflight OPTIONS request is NOT blocked by rate limiter
    const optionsRes = await fetch(`${dedicatedBase}/api/test-endpoint`, {
      method: 'OPTIONS',
    });
    record(
      11,
      'CORS preflight OPTIONS requests bypass rate limit (HTTP 204)',
      optionsRes.status === 204
    );

    // Test 12: Static frontend assets outside /api are unmetered
    const staticRes = await fetch(`${dedicatedBase}/static-asset.js`);
    const staticRateLimitHeader = staticRes.headers.get('ratelimit-limit');
    record(
      12,
      'Static frontend assets outside /api are not subjected to rate limiting',
      staticRes.status === 200 && staticRateLimitHeader === null
    );
  } finally {
    dedicatedServer.close();
  }

  // --- PART 3: LIVE PRODUCTION/DEVELOPMENT SERVER INTEGRATION ---
  console.log('\nRunning Live Server End-to-End Rate Limiting Tests...');
  await ensureServerRunning();

  // Test 13: Unauthenticated API request on live server (/api/plans) returns rate limit headers
  const livePlansRes = await fetch(`${BASE_URL}/api/plans`);
  const liveLimit = livePlansRes.headers.get('ratelimit-limit');
  const liveRemaining = livePlansRes.headers.get('ratelimit-remaining');
  record(
    13,
    `Unauthenticated API request (/api/plans) returns HTTP 200 with active rate limit headers (limit: ${liveLimit}, remaining: ${liveRemaining})`,
    livePlansRes.status === 200 && !!liveLimit && Number(liveLimit) >= 300
  );

  // Test 14: Protected endpoint returns HTTP 401 (auth check) and still includes rate limit headers
  const protectedRes = await fetch(`${BASE_URL}/api/products`);
  const protectedLimit = protectedRes.headers.get('ratelimit-limit');
  record(
    14,
    'Protected API request (/api/products) correctly evaluates auth and includes rate limit headers',
    protectedRes.status === 401 && !!protectedLimit
  );

  // Test 15: Paystack status endpoint operates normally under rate limiting
  const paystackStatusRes = await fetch(`${BASE_URL}/api/paystack/status`);
  const paystackStatusData = await paystackStatusRes.json();
  record(
    15,
    'Paystack status endpoint (/api/paystack/status) returns HTTP 200 under rate limiting',
    paystackStatusRes.status === 200 && typeof paystackStatusData.configured === 'boolean'
  );

  // Test 16: Authentication endpoint (POST /api/auth/login) operates under rate limiting
  const authLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nonexistent-user@example.com', password: 'BadPassword123' }),
  });
  const authLimit = authLoginRes.headers.get('ratelimit-limit');
  record(
    16,
    'Authentication endpoint (/api/auth/login) evaluates credentials under rate limiter protection',
    authLoginRes.status === 401 && !!authLimit
  );

  // Test 17: Frontend root (GET /) is never rate-limited
  const rootRes = await fetch(`${BASE_URL}/`);
  const rootRateHeader = rootRes.headers.get('ratelimit-limit');
  record(
    17,
    'Frontend root HTML (GET /) does not carry rate limit headers (unmetered static delivery)',
    rootRes.status === 200 && rootRateHeader === null
  );

  // Test 18: CORS headers and Rate Limit headers coexist harmoniously
  const corsWithRateLimitRes = await fetch(`${BASE_URL}/api/health`, {
    headers: { Origin: 'http://localhost:3000' },
  });
  const hasCorsHeader = !!corsWithRateLimitRes.headers.get('access-control-allow-origin');
  const hasRateLimitHeader = !!corsWithRateLimitRes.headers.get('ratelimit-limit');
  record(
    18,
    'CORS headers and Rate Limit headers coexist harmoniously on API responses',
    hasCorsHeader && hasRateLimitHeader
  );

  console.log('\n=====================================================');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`TEST SUMMARY: ${passedCount}/${results.length} PASSED`);
  console.log('=====================================================\n');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error in rate-limit suite:', err);
  process.exit(1);
});
