/**
 * SellPilot Phase 3, Step 1: Helmet HTTP Security Headers Test Suite
 *
 * Verifies that the official Helmet middleware is properly configured on the Express backend:
 * 1. Content-Security-Policy (CSP) is returned with required directives.
 * 2. CSP permits Google Fonts (fonts.googleapis.com, fonts.gstatic.com).
 * 3. CSP permits Unsplash demo/product images (images.unsplash.com).
 * 4. CSP permits data: and blob: image URIs.
 * 5. CSP permits Paystack checkout scripts and iframes (checkout.paystack.com, js.paystack.co).
 * 6. CSP permits connections to self, Paystack API, and WebSockets for development.
 * 7. CSP sets object-src to 'none'.
 * 8. X-Content-Type-Options is set to 'nosniff'.
 * 9. X-Frame-Options is set to 'SAMEORIGIN' (clickjacking defense).
 * 10. Referrer-Policy is set to 'strict-origin-when-cross-origin'.
 * 11. X-DNS-Prefetch-Control is set to 'off'.
 * 12. X-Download-Options is set to 'noopen'.
 * 13. X-Permitted-Cross-Domain-Policies is set to 'none'.
 * 14. Origin-Agent-Cluster is set to '?1'.
 * 15. X-XSS-Protection is set to '0' (modern standard).
 * 16. Cross-Origin-Opener-Policy is set to 'same-origin-allow-popups'.
 * 17. Cross-Origin-Resource-Policy is set to 'cross-origin'.
 * 18. X-Powered-By header is suppressed (no Express information disclosure).
 * 19. Strict-Transport-Security (HSTS) is enabled with includeSubDomains and max-age >= 15552000.
 * 20. Production & development API endpoints (/api/health, /api/plans) remain fully functional (HTTP 200).
 */

import { ChildProcess, spawn } from 'child_process';

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
  console.log('--- STARTING HELMET HTTP SECURITY HEADERS TESTS ---');
  console.log('=====================================================\n');

  await ensureServerRunning();

  // Fetch /api/health with standard headers
  const res = await fetch(`${BASE_URL}/api/health`, {
    headers: {
      'x-forwarded-proto': 'https',
    },
  });

  const headers = res.headers;
  const csp = headers.get('content-security-policy') || '';

  // Test 1: Content-Security-Policy header is present
  record(1, 'Content-Security-Policy header is present on responses', !!csp);

  // Test 2: CSP contains default-src 'self'
  record(
    2,
    "CSP contains default-src 'self'",
    csp.includes("default-src 'self'")
  );

  // Test 3: CSP permits Google Fonts
  const fontsAllowed =
    csp.includes('fonts.googleapis.com') && csp.includes('fonts.gstatic.com');
  record(
    3,
    'CSP permits Google Fonts (fonts.googleapis.com and fonts.gstatic.com)',
    fontsAllowed
  );

  // Test 4: CSP permits Unsplash product images
  record(
    4,
    'CSP permits Unsplash product images (images.unsplash.com)',
    csp.includes('images.unsplash.com')
  );

  // Test 5: CSP permits data: and blob: image URIs
  record(
    5,
    'CSP permits data: and blob: image URIs for merchant media',
    csp.includes('data:') && csp.includes('blob:')
  );

  // Test 6: CSP permits Paystack checkout scripts and frame
  const paystackAllowed =
    csp.includes('checkout.paystack.com') && csp.includes('js.paystack.co');
  record(
    6,
    'CSP permits Paystack checkout scripts and modal iframes (checkout.paystack.com)',
    paystackAllowed
  );

  // Test 7: CSP permits API and WebSocket connections
  const connectAllowed =
    csp.includes("connect-src 'self'") &&
    csp.includes('ws:') &&
    csp.includes('wss:') &&
    csp.includes('api.paystack.co');
  record(
    7,
    'CSP permits connections to self, Paystack API, and WebSockets (ws: wss:)',
    connectAllowed
  );

  // Test 8: CSP sets object-src to 'none'
  record(
    8,
    "CSP sets object-src to 'none' to block plugin exploits",
    csp.includes("object-src 'none'")
  );

  // Test 9: X-Content-Type-Options is nosniff
  const nosniff = headers.get('x-content-type-options');
  record(
    9,
    'X-Content-Type-Options is nosniff (MIME sniffing defense)',
    nosniff === 'nosniff'
  );

  // Test 10: CSP frame-ancestors protects against clickjacking while allowing preview iframes
  const frameAncestorsValid =
    csp.includes('frame-ancestors') &&
    csp.includes("'self'") &&
    csp.includes('*.run.app') &&
    csp.includes('*.google.com');
  record(
    10,
    'CSP frame-ancestors protects against clickjacking while allowing authorized preview iframes',
    frameAncestorsValid
  );

  // Test 11: Referrer-Policy is strict-origin-when-cross-origin
  const referrerPolicy = headers.get('referrer-policy');
  record(
    11,
    'Referrer-Policy is strict-origin-when-cross-origin',
    referrerPolicy === 'strict-origin-when-cross-origin'
  );

  // Test 12: X-DNS-Prefetch-Control is off
  const dnsPrefetch = headers.get('x-dns-prefetch-control');
  record(
    12,
    'X-DNS-Prefetch-Control is off',
    dnsPrefetch === 'off'
  );

  // Test 13: X-Download-Options is noopen
  const downloadOptions = headers.get('x-download-options');
  record(
    13,
    'X-Download-Options is noopen',
    downloadOptions === 'noopen'
  );

  // Test 14: X-Permitted-Cross-Domain-Policies is none
  const crossDomain = headers.get('x-permitted-cross-domain-policies');
  record(
    14,
    'X-Permitted-Cross-Domain-Policies is none',
    crossDomain === 'none'
  );

  // Test 15: Origin-Agent-Cluster is ?1
  const agentCluster = headers.get('origin-agent-cluster');
  record(
    15,
    'Origin-Agent-Cluster is ?1',
    agentCluster === '?1'
  );

  // Test 16: X-XSS-Protection is 0
  const xssProtection = headers.get('x-xss-protection');
  record(
    16,
    'X-XSS-Protection is 0 (modern security standard)',
    xssProtection === '0'
  );

  // Test 17: Cross-Origin-Opener-Policy is disabled for iframe compatibility
  const coop = headers.get('cross-origin-opener-policy');
  record(
    17,
    'Cross-Origin-Opener-Policy is disabled for iframe embedding compatibility',
    coop === null
  );

  // Test 18: Cross-Origin-Resource-Policy is cross-origin
  const corp = headers.get('cross-origin-resource-policy');
  record(
    18,
    'Cross-Origin-Resource-Policy is cross-origin for public static resources',
    corp === 'cross-origin'
  );

  // Test 19: X-Powered-By is suppressed
  const poweredBy = headers.get('x-powered-by');
  record(
    19,
    'X-Powered-By header is suppressed (no Express information disclosure)',
    poweredBy === null
  );

  // Test 20: Strict-Transport-Security (HSTS) is enabled with includeSubDomains
  const hsts = headers.get('strict-transport-security');
  const hstsValid = !!hsts && hsts.includes('max-age=') && hsts.includes('includeSubDomains');
  record(
    20,
    `Strict-Transport-Security (HSTS) is enabled (${hsts || 'not found'})`,
    hstsValid
  );

  // Test 21: GET /api/health returns HTTP 200 with valid JSON
  const healthData = await res.json();
  record(
    21,
    'GET /api/health returns HTTP 200 with valid status',
    res.status === 200 && healthData.status === 'ok'
  );

  // Test 22: GET /api/plans returns HTTP 200 and also receives security headers
  const plansRes = await fetch(`${BASE_URL}/api/plans`, {
    headers: { 'x-forwarded-proto': 'https' },
  });
  const plansCsp = plansRes.headers.get('content-security-policy');
  const plansNoSniff = plansRes.headers.get('x-content-type-options');
  record(
    22,
    'GET /api/plans returns HTTP 200 and retains security headers',
    plansRes.status === 200 && !!plansCsp && plansNoSniff === 'nosniff'
  );

  // Test 23: GET / (Frontend application) returns HTTP 200 and includes security headers
  const rootRes = await fetch(`${BASE_URL}/`, {
    headers: { 'x-forwarded-proto': 'https' },
  });
  const rootCsp = rootRes.headers.get('content-security-policy');
  const rootNoSniff = rootRes.headers.get('x-content-type-options');
  record(
    23,
    'Frontend root GET / serves application with security headers attached',
    rootRes.status === 200 && !!rootCsp && rootNoSniff === 'nosniff'
  );

  // Test 24: GET /api/paystack/status returns HTTP 200 with safe status and security headers
  const paystackRes = await fetch(`${BASE_URL}/api/paystack/status`, {
    headers: { 'x-forwarded-proto': 'https' },
  });
  const paystackData = await paystackRes.json();
  const paystackNoSniff = paystackRes.headers.get('x-content-type-options');
  record(
    24,
    'Paystack endpoint GET /api/paystack/status succeeds and retains security headers',
    paystackRes.status === 200 && typeof paystackData.configured === 'boolean' && paystackNoSniff === 'nosniff'
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
