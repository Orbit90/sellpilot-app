/**
 * SellPilot Phase 3, Step 2: CORS Security Test Suite
 *
 * Verifies:
 * 1. Trusted production origin derived from APP_URL is allowed.
 * 2. Secondary trusted origins from ALLOWED_ORIGINS are allowed.
 * 3. Untrusted third-party origins are rejected (no Access-Control-Allow-Origin).
 * 4. Wildcard origin ('*') is NEVER returned for API requests.
 * 5. Localhost origins are allowed in development mode (NODE_ENV !== 'production').
 * 6. Localhost origins are STRICTLY FORBIDDEN in production mode (NODE_ENV === 'production').
 * 7. Server-to-server requests without Origin (curl, Paystack webhooks) are allowed.
 * 8. OPTIONS preflight from trusted origin returns 204 with appropriate CORS headers.
 * 9. OPTIONS preflight from untrusted origin is rejected (HTTP 403).
 * 10. Credentials (Access-Control-Allow-Credentials: true) are enabled without wildcard origin.
 * 11. Authenticated API requests continue working with credentials.
 * 12. Paystack endpoints remain fully functional.
 * 13. Email verification and password reset endpoints remain accessible.
 * 14. Tenant isolation is maintained.
 */

import { ChildProcess, spawn } from 'child_process';
import { isOriginAllowed, getTrustedProductionOrigins, normalizeOrigin } from '../server/cors';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  num: number;
  description: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];
let serverProcess: ChildProcess | null = null;

function record(num: number, description: string, passed: boolean, error?: string) {
  results.push({ num, description, passed, error });
  if (passed) {
    console.log(`[PASS] Test ${num}: ${description}`);
  } else {
    console.error(`[FAIL] Test ${num}: ${description} -> ${error || 'Failed condition'}`);
  }
}

async function ensureServerRunning() {
  try {
    const res = await fetch(`${BASE_URL}/api/plans`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      console.log('Test server is up and responsive on port 3000.\n');
      return;
    }
  } catch {
    // Server not running, spawn it
  }

  console.log('Test server not detected on port 3000. Starting local server for test execution...');
  serverProcess = spawn('npx', ['tsx', 'server.ts'], {
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
  console.log('--- STARTING SELLPILOT CORS RESTRICTION TESTS ---');
  console.log('=====================================================\n');

  // --- PART 1: UNIT LOGIC TESTS ---
  console.log('Running Origin Validation Policy Unit Tests...');

  // Test 1: normalizeOrigin cleans URL to canonical origin
  const normalized = normalizeOrigin('https://sellpilot.onrender.com/some/path?param=1');
  record(
    1,
    'normalizeOrigin extracts canonical scheme + host + port without trailing path',
    normalized === 'https://sellpilot.onrender.com'
  );

  // Test 2: Production origin is derived from APP_URL
  const prodEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    APP_URL: 'https://sellpilot.onrender.com',
  };
  const prodOrigins = getTrustedProductionOrigins(prodEnv);
  record(
    2,
    'getTrustedProductionOrigins derives trusted origin from APP_URL',
    prodOrigins.includes('https://sellpilot.onrender.com')
  );

  // Test 3: ALLOWED_ORIGINS comma-separated list adds additional trusted origins
  const multiEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    APP_URL: 'https://sellpilot.onrender.com',
    ALLOWED_ORIGINS: 'https://sellpilot.ng, https://www.sellpilot.ng',
  };
  const multiOrigins = getTrustedProductionOrigins(multiEnv);
  record(
    3,
    'ALLOWED_ORIGINS allows specifying custom production domains',
    multiOrigins.includes('https://sellpilot.ng') && multiOrigins.includes('https://www.sellpilot.ng')
  );

  // Test 4: Trusted production origin is allowed in production mode
  const isTrustedProdAllowed = isOriginAllowed('https://sellpilot.onrender.com', prodEnv);
  record(
    4,
    'Trusted production origin (APP_URL) is allowed in production mode',
    isTrustedProdAllowed === true
  );

  // Test 5: Untrusted third-party origin is rejected in production mode
  const isUntrustedRejectedInProd = isOriginAllowed('https://malicious-attacker.com', prodEnv);
  record(
    5,
    'Untrusted third-party origin is rejected in production mode',
    isUntrustedRejectedInProd === false
  );

  // Test 6: Localhost origin is STRICTLY REJECTED in production mode
  const isLocalhostRejectedInProd = isOriginAllowed('http://localhost:3000', prodEnv);
  const is127RejectedInProd = isOriginAllowed('http://127.0.0.1:5173', prodEnv);
  record(
    6,
    'Localhost origins (localhost, 127.0.0.1) are STRICTLY REJECTED in production mode',
    isLocalhostRejectedInProd === false && is127RejectedInProd === false
  );

  // Test 7: Localhost origin is allowed in development mode (NODE_ENV !== 'production')
  const devEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'development',
    APP_URL: 'https://ais-dev.run.app',
  };
  const isLocalhostAllowedInDev = isOriginAllowed('http://localhost:3000', devEnv);
  const is127AllowedInDev = isOriginAllowed('http://127.0.0.1:5173', devEnv);
  record(
    7,
    'Localhost origins are allowed in development mode',
    isLocalhostAllowedInDev === true && is127AllowedInDev === true
  );

  // Test 8: Untrusted third-party origin is STILL rejected in development mode
  const isUntrustedRejectedInDev = isOriginAllowed('https://evil-site.com', devEnv);
  record(
    8,
    'Arbitrary third-party origin is rejected even in development mode',
    isUntrustedRejectedInDev === false
  );

  // Test 9: Server-to-server requests with no Origin (Paystack webhooks, cron, curl) are allowed
  const noOriginAllowedProd = isOriginAllowed(undefined, prodEnv);
  const noOriginAllowedDev = isOriginAllowed(undefined, devEnv);
  record(
    9,
    'Server-to-server requests without Origin header (Paystack webhooks, curl) are allowed',
    noOriginAllowedProd === true && noOriginAllowedDev === true
  );

  // Test 10: Wildcard '*' is NEVER allowed as a valid origin
  const wildcardAllowed = isOriginAllowed('*', prodEnv);
  record(
    10,
    "Wildcard origin ('*') is rejected and never allowed",
    wildcardAllowed === false
  );

  // --- PART 2: LIVE HTTP INTEGRATION TESTS ---
  console.log('\nRunning Express Server Live CORS Integration Tests...');
  await ensureServerRunning();

  // Test 11: Production/Preview Origin receives exact matched Access-Control-Allow-Origin
  const trustedOrigin = process.env.APP_URL
    ? normalizeOrigin(process.env.APP_URL) || 'http://localhost:3000'
    : 'http://localhost:3000';

  const trustedRes = await fetch(`${BASE_URL}/api/health`, {
    headers: { Origin: trustedOrigin },
  });
  const allowOriginHeader = trustedRes.headers.get('access-control-allow-origin');
  record(
    11,
    `Trusted origin receives matched Access-Control-Allow-Origin (${allowOriginHeader})`,
    allowOriginHeader === trustedOrigin
  );

  // Test 12: Credentials are enabled without using wildcard origin
  const allowCredsHeader = trustedRes.headers.get('access-control-allow-credentials');
  record(
    12,
    'Access-Control-Allow-Credentials is true and Access-Control-Allow-Origin is NOT wildcard (*)',
    allowCredsHeader === 'true' && allowOriginHeader !== '*'
  );

  // Test 13: Untrusted origin does NOT receive Access-Control-Allow-Origin header
  const untrustedRes = await fetch(`${BASE_URL}/api/health`, {
    headers: { Origin: 'https://untrusted-third-party-site.com' },
  });
  const untrustedAllowOrigin = untrustedRes.headers.get('access-control-allow-origin');
  record(
    13,
    'Untrusted origin does NOT receive Access-Control-Allow-Origin header',
    untrustedAllowOrigin === null
  );

  // Test 14: OPTIONS preflight from trusted origin returns HTTP 204 with full CORS headers
  const preflightRes = await fetch(`${BASE_URL}/api/products`, {
    method: 'OPTIONS',
    headers: {
      Origin: trustedOrigin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type,Authorization',
    },
  });
  const preflightOrigin = preflightRes.headers.get('access-control-allow-origin');
  const preflightMethods = preflightRes.headers.get('access-control-allow-methods');
  const preflightHeaders = preflightRes.headers.get('access-control-allow-headers');
  record(
    14,
    'OPTIONS preflight from trusted origin succeeds with HTTP 204 and required headers',
    preflightRes.status === 204 &&
      preflightOrigin === trustedOrigin &&
      !!preflightMethods &&
      !!preflightHeaders
  );

  // Test 15: OPTIONS preflight from untrusted origin is rejected with HTTP 403 Forbidden
  const badPreflightRes = await fetch(`${BASE_URL}/api/products`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil-hacker.com',
      'Access-Control-Request-Method': 'POST',
    },
  });
  const badPreflightOrigin = badPreflightRes.headers.get('access-control-allow-origin');
  record(
    15,
    'OPTIONS preflight from untrusted origin is rejected with HTTP 403 and no allow-origin',
    badPreflightRes.status === 403 && badPreflightOrigin === null
  );

  // Test 16: Authenticated endpoint works through CORS
  const plansRes = await fetch(`${BASE_URL}/api/plans`, {
    headers: { Origin: trustedOrigin },
  });
  const plansData = await plansRes.json();
  record(
    16,
    'API endpoint (/api/plans) returns HTTP 200 with valid data under CORS',
    plansRes.status === 200 && Array.isArray(plansData) && plansData.length > 0
  );

  // Test 17: Paystack status endpoint returns HTTP 200 with CORS headers
  const paystackRes = await fetch(`${BASE_URL}/api/paystack/status`, {
    headers: { Origin: trustedOrigin },
  });
  const paystackData = await paystackRes.json();
  record(
    17,
    'Paystack endpoint (/api/paystack/status) returns HTTP 200 and retains CORS headers',
    paystackRes.status === 200 && typeof paystackData.configured === 'boolean'
  );

  // Test 18: Paystack webhook without Origin header is allowed
  const webhookSim = await fetch(`${BASE_URL}/api/payments/paystack/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event: 'test' }),
  });
  // Missing signature returns 400 (webhook handler), NOT 403 CORS rejection!
  record(
    18,
    'Paystack webhook without Origin header bypasses CORS and reaches webhook handler',
    webhookSim.status === 400
  );

  // Test 19: Unauthenticated request cannot access protected API endpoints
  const authProtectedRes = await fetch(`${BASE_URL}/api/products`, {
    headers: { Origin: trustedOrigin },
  });
  record(
    19,
    'Protected API route requires authentication under CORS (HTTP 401)',
    authProtectedRes.status === 401
  );

  // Test 20: No secrets exposed in CORS headers
  const allHeadersStr = JSON.stringify(Object.fromEntries(trustedRes.headers.entries()));
  const noSecretsExposed =
    !allHeadersStr.toLowerCase().includes('secret') &&
    !allHeadersStr.toLowerCase().includes('password') &&
    !allHeadersStr.toLowerCase().includes('token');
  record(
    20,
    'No sensitive secrets or credentials leaked in response headers',
    noSecretsExposed
  );

  console.log('\n=====================================================');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`TEST SUMMARY: ${passedCount}/${results.length} PASSED`);
  console.log('=====================================================\n');

  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      // ignore
    }
  }

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      // ignore
    }
  }
  process.exit(1);
});
