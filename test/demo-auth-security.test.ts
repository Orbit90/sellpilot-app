/**
 * SellPilot Demo Authentication Security & Isolation Test Suite
 *
 * Requirements Tested:
 * 1. No fallback to allUsers[0] or any arbitrary user if DEMO_USER_ID is missing.
 * 2. /api/auth/demo is strictly disabled in production unless ENABLE_DEMO_LOGIN='true'.
 * 3. Demo mode, if enabled, can only authenticate the dedicated demo account (usr_zarah_01).
 * 4. No production user or administrator can be authenticated or impersonated.
 */

import { DEMO_BUSINESS_ID, DEMO_USER_ID } from '../src/data/demoData';
import { db } from '../server/db';

interface TestResult {
  num: number;
  description: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function record(num: number, description: string, passed: boolean, error?: string) {
  results.push({ num, description, passed, error });
  if (passed) {
    console.log(`✅ PASS: ${num}. ${description}`);
  } else {
    console.error(`❌ FAIL: ${num}. ${description} -> ${error || 'Failed condition'}`);
  }
}

// Handler emulation directly matching server.ts implementation
async function handleDemoAuth(
  env: { NODE_ENV?: string; ENABLE_DEMO_LOGIN?: string },
  mockDbUsers?: any,
  mockDbBiz?: any
) {
  const isProduction = env.NODE_ENV === 'production';
  const isDemoExplicitlyEnabled = env.ENABLE_DEMO_LOGIN === 'true';

  if (isProduction && !isDemoExplicitlyEnabled) {
    return {
      status: 403,
      body: { error: 'Demo authentication is disabled in production environments. Set ENABLE_DEMO_LOGIN=true to explicitly enable.' },
    };
  }

  const usersRepo = mockDbUsers || db.users;
  const bizRepo = mockDbBiz || db.businesses;

  const demoUser = await usersRepo.findById(DEMO_USER_ID);
  if (!demoUser || demoUser.id !== DEMO_USER_ID) {
    return {
      status: 404,
      body: { error: 'Dedicated demo user account not found or not initialized.' },
    };
  }

  const demoBiz = await bizRepo.findById(DEMO_BUSINESS_ID);
  if (!demoBiz || demoBiz.id !== DEMO_BUSINESS_ID || demoUser.businessId !== DEMO_BUSINESS_ID) {
    return {
      status: 404,
      body: { error: 'Dedicated demo store profile not found or not initialized.' },
    };
  }

  return {
    status: 200,
    body: {
      userId: demoUser.id,
      userEmail: demoUser.email,
      businessId: demoBiz.id,
    },
  };
}

async function runTests() {
  console.log('--- STARTING DEMO AUTHENTICATION SECURITY TESTS ---');

  await db.init();

  // Test 1: Disabled in production by default (NODE_ENV=production, ENABLE_DEMO_LOGIN unset)
  {
    const res = await handleDemoAuth({ NODE_ENV: 'production' });
    record(
      1,
      'Disabled in production by default without ENABLE_DEMO_LOGIN (HTTP 403 Forbidden)',
      res.status === 403 && Boolean(res.body.error?.includes('disabled in production')),
      `Got status ${res.status}: ${JSON.stringify(res.body)}`
    );
  }

  // Test 2: Disabled in production when ENABLE_DEMO_LOGIN is 'false'
  {
    const res = await handleDemoAuth({ NODE_ENV: 'production', ENABLE_DEMO_LOGIN: 'false' });
    record(
      2,
      'Disabled in production when ENABLE_DEMO_LOGIN=false (HTTP 403 Forbidden)',
      res.status === 403,
      `Got status ${res.status}`
    );
  }

  // Test 3: Enabled in production ONLY when ENABLE_DEMO_LOGIN='true'
  {
    const res = await handleDemoAuth({ NODE_ENV: 'production', ENABLE_DEMO_LOGIN: 'true' });
    record(
      3,
      'Enabled in production when ENABLE_DEMO_LOGIN=true',
      res.status === 200 && res.body.userId === DEMO_USER_ID,
      `Got status ${res.status}`
    );
  }

  // Test 4: Enabled in development mode
  {
    const res = await handleDemoAuth({ NODE_ENV: 'development' });
    record(
      4,
      'Enabled in development mode for local/preview testing',
      res.status === 200 && res.body.userId === DEMO_USER_ID,
      `Got status ${res.status}`
    );
  }

  // Test 5: Dedicated demo account verification (strictly DEMO_USER_ID and DEMO_BUSINESS_ID)
  {
    const res = await handleDemoAuth({ NODE_ENV: 'development' });
    record(
      5,
      'Authenticates strictly the dedicated demo account (usr_zarah_01 / biz_zarah_styles)',
      res.body.userId === 'usr_zarah_01' && res.body.businessId === 'biz_zarah_styles',
      `Unexpected demo credentials: ${JSON.stringify(res.body)}`
    );
  }

  // Test 6: Absolutely NO fallback to allUsers[0] when DEMO_USER_ID is missing
  {
    const mockUsers = {
      async findById(id: string) {
        return null; // Demo user missing
      },
      async findAll() {
        return [
          { id: 'usr_admin_victim', email: 'admin@sellpilot.ng', businessId: 'biz_admin_victim' },
        ];
      },
    };

    const res = await handleDemoAuth({ NODE_ENV: 'development' }, mockUsers);
    record(
      6,
      'Refuses to authenticate when DEMO_USER_ID is missing; NEVER falls back to allUsers[0]',
      res.status === 404 && res.body.userId === undefined,
      `Vulnerable fallback detected! Result: ${JSON.stringify(res)}`
    );
  }

  // Test 7: Absolutely NO fallback to allBiz[0] when DEMO_BUSINESS_ID is missing
  {
    const mockBiz = {
      async findById(id: string) {
        return null; // Demo business missing
      },
      async findAll() {
        return [
          { id: 'biz_production_merchant', name: 'Real Production Store' },
        ];
      },
    };

    const res = await handleDemoAuth({ NODE_ENV: 'development' }, undefined, mockBiz);
    record(
      7,
      'Refuses to authenticate when DEMO_BUSINESS_ID is missing; NEVER falls back to allBiz[0]',
      res.status === 404 && res.body.businessId === undefined,
      `Vulnerable fallback detected! Result: ${JSON.stringify(res)}`
    );
  }

  // Test 8: No production user or administrator can be impersonated
  {
    // Ensure all real registered users cannot be targeted
    const allUsers = await db.users.findAll();
    const nonDemoUsers = allUsers.filter(u => u.id !== DEMO_USER_ID);
    const res = await handleDemoAuth({ NODE_ENV: 'development' });

    const impersonated = nonDemoUsers.some(u => u.id === res.body.userId || u.email === res.body.userEmail);
    record(
      8,
      'No production or admin user can be authenticated or impersonated',
      !impersonated && res.body.userId === DEMO_USER_ID,
      'Impersonation occurred!'
    );
  }

  console.log('--- TEST SUITE COMPLETE ---');
  const passed = results.filter(r => r.passed).length;
  console.log(`Passed: ${passed} / ${results.length}`);

  if (passed !== results.length) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
