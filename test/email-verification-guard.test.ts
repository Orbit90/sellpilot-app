/**
 * SellPilot Phase 2, Step 2: Email Verification Guard Security & Integration Test Suite
 *
 * Requirements Tested:
 * 1. Unauthenticated request to Paystack initialize is blocked (HTTP 401).
 * 2. Authenticated + unverified user cannot initialize Paystack (HTTP 403, code EMAIL_VERIFICATION_REQUIRED).
 * 3. Authenticated + verified user can initialize Paystack successfully.
 * 4. Authenticated + unverified user is blocked from creating products (HTTP 403).
 * 5. Authenticated + unverified user is blocked from updating products (HTTP 403).
 * 6. Authenticated + unverified user is blocked from deleting products (HTTP 403).
 * 7. Authenticated + unverified user is blocked from creating customers (HTTP 403).
 * 8. Authenticated + unverified user is blocked from updating customers (HTTP 403).
 * 9. Authenticated + unverified user is blocked from deleting customers (HTTP 403).
 * 10. Authenticated + unverified user is blocked from creating orders (HTTP 403).
 * 11. Authenticated + unverified user is blocked from updating orders (HTTP 403).
 * 12. Authenticated + unverified user is blocked from creating follow-ups (HTTP 403).
 * 13. Authenticated + unverified user is blocked from modifying business profile & settings (HTTP 403).
 * 14. Authenticated + unverified user CAN view resources (read-only GET endpoints return HTTP 200).
 * 15. Server-authoritative check: Client tampering (body/query/headers with emailVerified: true) cannot bypass guard.
 * 16. Email verification endpoint (POST /api/auth/verify-email) remains accessible.
 * 17. Resend verification endpoint (POST /api/auth/resend-verification) remains accessible.
 * 18. Password reset endpoints remain accessible to unverified users.
 * 19. Tenant isolation: Verified User A cannot be used to unlock unverified User B.
 * 20. Verified user can create protected resources and initialize payments immediately.
 */

import { ChildProcess, spawn } from 'child_process';
import crypto from 'crypto';
import { db } from '../server/db';
import { hashPassword } from '../server/auth';

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
  console.log('--- STARTING EMAIL VERIFICATION GUARD TESTS ---');
  console.log('=====================================================\n');

  await ensureServerRunning();
  await db.init();

  const timestamp = Date.now();

  // -------------------------------------------------------------------------
  // 1. SETUP UNVERIFIED USER & TENANT (User U)
  // -------------------------------------------------------------------------
  const bizIdU = `biz_unver_${timestamp}`;
  const userIdU = `usr_unver_${timestamp}`;
  const tokenU = `tok_unver_${timestamp}`;
  const emailU = `unver_${timestamp}@example.ng`;

  await db.businesses.create({
    id: bizIdU,
    ownerId: userIdU,
    name: 'Unverified Merchant Store',
    category: 'fashion',
    description: '',
    phone: '08099990001',
    location: 'Lagos',
    currency: '₦',
    deliveryInfo: '',
    returnPolicy: '',
    paymentInstructions: '',
    faqs: [],
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
  });

  const { hash: hashU, salt: saltU } = hashPassword('Secret123!');
  await db.users.create({
    id: userIdU,
    name: 'Unverified Merchant',
    email: emailU,
    businessId: bizIdU,
    role: 'merchant',
    passwordHash: hashU,
    passwordSalt: saltU,
    emailVerified: false,
    emailVerifiedAt: null,
    createdAt: new Date().toISOString(),
  });

  await db.sessions.create({
    token: tokenU,
    userId: userIdU,
    businessId: bizIdU,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });

  await db.subscriptions.create({
    id: `sub_${bizIdU}`,
    businessId: bizIdU,
    plan: 'FREE_TRIAL',
    status: 'trialing',
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 7 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Create an existing product for update/delete tests
  const existingProdU = await db.products.create({
    id: `prd_test_${timestamp}`,
    businessId: bizIdU,
    name: 'Existing Seed Product',
    price: 5000,
    category: 'fashion',
    description: '',
    images: [],
    stockQuantity: 10,
    sku: 'SEED-001',
    status: 'active',
    variants: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Create an existing customer for update/delete tests
  const existingCustU = await db.customers.create({
    id: `cust_test_${timestamp}`,
    businessId: bizIdU,
    name: 'Existing Seed Customer',
    phone: '08099991111',
    email: 'seed@example.com',
    location: 'Lagos',
    ordersCount: 0,
    totalSpent: 0,
    status: 'New',
    notes: '',
    interactions: [],
    dateAdded: new Date().toISOString(),
  });

  // Create an existing order for update/delete tests
  const existingOrderU = await db.orders.create({
    id: `ord_test_${timestamp}`,
    businessId: bizIdU,
    customerId: existingCustU.id,
    customerName: existingCustU.name,
    customerPhone: existingCustU.phone,
    items: [],
    productSubtotal: 5000,
    deliveryFee: 1000,
    discount: 0,
    total: 6000,
    paymentStatus: 'Unpaid',
    orderStatus: 'New',
    deliveryAddress: 'Lagos',
    notes: '',
    createdDate: new Date().toISOString(),
  });

  // Create an existing follow-up
  const existingFollowUpU = await db.followUps.create({
    id: `fu_test_${timestamp}`,
    businessId: bizIdU,
    customerId: existingCustU.id,
    customerName: existingCustU.name,
    customerPhone: existingCustU.phone,
    reason: 'Follow up inquiry',
    suggestedMessage: 'Hello from SellPilot',
    status: 'Pending',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  });

  // -------------------------------------------------------------------------
  // 2. SETUP VERIFIED USER & TENANT (User V)
  // -------------------------------------------------------------------------
  const bizIdV = `biz_ver_${timestamp}`;
  const userIdV = `usr_ver_${timestamp}`;
  const tokenV = `tok_ver_${timestamp}`;
  const emailV = `ver_${timestamp}@example.ng`;

  await db.businesses.create({
    id: bizIdV,
    ownerId: userIdV,
    name: 'Verified Merchant Store',
    category: 'fashion',
    description: '',
    phone: '08099990002',
    location: 'Abuja',
    currency: '₦',
    deliveryInfo: '',
    returnPolicy: '',
    paymentInstructions: '',
    faqs: [],
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
  });

  const { hash: hashV, salt: saltV } = hashPassword('Secret123!');
  await db.users.create({
    id: userIdV,
    name: 'Verified Merchant',
    email: emailV,
    businessId: bizIdV,
    role: 'merchant',
    passwordHash: hashV,
    passwordSalt: saltV,
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });

  await db.sessions.create({
    token: tokenV,
    userId: userIdV,
    businessId: bizIdV,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });

  await db.subscriptions.create({
    id: `sub_${bizIdV}`,
    businessId: bizIdV,
    plan: 'FREE_TRIAL',
    status: 'trialing',
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 7 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // -------------------------------------------------------------------------
  // TEST 1: Unauthenticated request to Paystack initialize is blocked (HTTP 401)
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/payments/paystack/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'STARTER' }),
    });
    record(1, 'Unauthenticated user is blocked from initializing Paystack (HTTP 401)', res.status === 401);
  } catch (err: any) {
    record(1, 'Unauthenticated user is blocked from initializing Paystack (HTTP 401)', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Authenticated + unverified user cannot initialize Paystack (HTTP 403)
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/payments/paystack/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenU}`,
      },
      body: JSON.stringify({ plan: 'STARTER' }),
    });
    const body = await res.json();
    const isForbidden = res.status === 403;
    const hasVerificationError = body.error && body.error.toLowerCase().includes('verify your email');
    const hasCode = body.code === 'EMAIL_VERIFICATION_REQUIRED';
    record(
      2,
      'Authenticated + unverified user cannot initialize Paystack (HTTP 403, EMAIL_VERIFICATION_REQUIRED)',
      isForbidden && hasVerificationError && hasCode
    );
  } catch (err: any) {
    record(2, 'Authenticated + unverified user cannot initialize Paystack', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Authenticated + verified user can initialize Paystack (or passes guard)
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/payments/paystack/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenV}`,
      },
      body: JSON.stringify({ plan: 'STARTER' }),
    });
    const body = await res.json();
    // Guard must NOT return 403 Forbidden for verified user.
    // If Paystack test key is configured, it returns 200 with authorization_url; if service unconfigured, 503.
    const guardPassed = res.status !== 403 && body.code !== 'EMAIL_VERIFICATION_REQUIRED';
    record(3, 'Authenticated + verified user passes email verification guard on Paystack initialize', guardPassed);
  } catch (err: any) {
    record(3, 'Authenticated + verified user passes email verification guard on Paystack initialize', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Unverified user is blocked from creating products (HTTP 403)
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenU}`,
      },
      body: JSON.stringify({
        name: 'Blocked Product',
        price: 9000,
        category: 'fashion',
      }),
    });
    const body = await res.json();
    record(
      4,
      'Unverified user is blocked from creating products (HTTP 403, EMAIL_VERIFICATION_REQUIRED)',
      res.status === 403 && body.code === 'EMAIL_VERIFICATION_REQUIRED'
    );
  } catch (err: any) {
    record(4, 'Unverified user is blocked from creating products', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Unverified user is blocked from updating products (HTTP 403)
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/products/${existingProdU.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenU}`,
      },
      body: JSON.stringify({ name: 'Tampered Name' }),
    });
    const body = await res.json();
    record(
      5,
      'Unverified user is blocked from updating products (HTTP 403, EMAIL_VERIFICATION_REQUIRED)',
      res.status === 403 && body.code === 'EMAIL_VERIFICATION_REQUIRED'
    );
  } catch (err: any) {
    record(5, 'Unverified user is blocked from updating products', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Unverified user is blocked from deleting products (HTTP 403)
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/products/${existingProdU.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenU}`,
      },
    });
    const body = await res.json();
    record(
      6,
      'Unverified user is blocked from deleting products (HTTP 403, EMAIL_VERIFICATION_REQUIRED)',
      res.status === 403 && body.code === 'EMAIL_VERIFICATION_REQUIRED'
    );
  } catch (err: any) {
    record(6, 'Unverified user is blocked from deleting products', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Unverified user is blocked from creating customers (HTTP 403)
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenU}`,
      },
      body: JSON.stringify({
        name: 'Blocked Customer',
        phone: '08012345678',
      }),
    });
    const body = await res.json();
    record(
      7,
      'Unverified user is blocked from creating customers (HTTP 403, EMAIL_VERIFICATION_REQUIRED)',
      res.status === 403 && body.code === 'EMAIL_VERIFICATION_REQUIRED'
    );
  } catch (err: any) {
    record(7, 'Unverified user is blocked from creating customers', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 8: Unverified user is blocked from updating customers (HTTP 403)
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/customers/${existingCustU.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenU}`,
      },
      body: JSON.stringify({ name: 'Tampered Customer Name' }),
    });
    const body = await res.json();
    record(
      8,
      'Unverified user is blocked from updating customers (HTTP 403, EMAIL_VERIFICATION_REQUIRED)',
      res.status === 403 && body.code === 'EMAIL_VERIFICATION_REQUIRED'
    );
  } catch (err: any) {
    record(8, 'Unverified user is blocked from updating customers', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 9: Unverified user is blocked from deleting customers (HTTP 403)
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/customers/${existingCustU.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenU}`,
      },
    });
    const body = await res.json();
    record(
      9,
      'Unverified user is blocked from deleting customers (HTTP 403, EMAIL_VERIFICATION_REQUIRED)',
      res.status === 403 && body.code === 'EMAIL_VERIFICATION_REQUIRED'
    );
  } catch (err: any) {
    record(9, 'Unverified user is blocked from deleting customers', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Unverified user is blocked from creating orders (HTTP 403)
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenU}`,
      },
      body: JSON.stringify({
        customerName: 'Test Buyer',
        items: [{ productName: 'Shoes', quantity: 1, unitPrice: 5000 }],
      }),
    });
    const body = await res.json();
    record(
      10,
      'Unverified user is blocked from creating orders (HTTP 403, EMAIL_VERIFICATION_REQUIRED)',
      res.status === 403 && body.code === 'EMAIL_VERIFICATION_REQUIRED'
    );
  } catch (err: any) {
    record(10, 'Unverified user is blocked from creating orders', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 11: Unverified user is blocked from updating orders (HTTP 403)
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/orders/${existingOrderU.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenU}`,
      },
      body: JSON.stringify({ orderStatus: 'Delivered' }),
    });
    const body = await res.json();
    record(
      11,
      'Unverified user is blocked from updating orders (HTTP 403, EMAIL_VERIFICATION_REQUIRED)',
      res.status === 403 && body.code === 'EMAIL_VERIFICATION_REQUIRED'
    );
  } catch (err: any) {
    record(11, 'Unverified user is blocked from updating orders', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 12: Unverified user is blocked from creating follow-ups (HTTP 403)
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/follow-ups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenU}`,
      },
      body: JSON.stringify({
        customerName: 'Test Customer',
        reason: 'Payment follow up',
      }),
    });
    const body = await res.json();
    record(
      12,
      'Unverified user is blocked from creating follow-ups (HTTP 403, EMAIL_VERIFICATION_REQUIRED)',
      res.status === 403 && body.code === 'EMAIL_VERIFICATION_REQUIRED'
    );
  } catch (err: any) {
    record(12, 'Unverified user is blocked from creating follow-ups', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 13: Unverified user is blocked from modifying profile & settings (HTTP 403)
  // -------------------------------------------------------------------------
  try {
    const resProfile = await fetch(`${BASE_URL}/api/business/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenU}`,
      },
      body: JSON.stringify({ name: 'Tampered Biz Name' }),
    });
    const resSettings = await fetch(`${BASE_URL}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenU}`,
      },
      body: JSON.stringify({ defaultTone: 'excited' }),
    });
    record(
      13,
      'Unverified user is blocked from modifying business profile and settings (HTTP 403)',
      resProfile.status === 403 && resSettings.status === 403
    );
  } catch (err: any) {
    record(13, 'Unverified user is blocked from modifying business profile and settings', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 14: Unverified user CAN view resources (read-only GET endpoints return HTTP 200)
  // -------------------------------------------------------------------------
  try {
    const resMe = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokenU}` },
    });
    const resProducts = await fetch(`${BASE_URL}/api/products`, {
      headers: { Authorization: `Bearer ${tokenU}` },
    });
    const resCustomers = await fetch(`${BASE_URL}/api/customers`, {
      headers: { Authorization: `Bearer ${tokenU}` },
    });
    const resOrders = await fetch(`${BASE_URL}/api/orders`, {
      headers: { Authorization: `Bearer ${tokenU}` },
    });
    const resFollowUps = await fetch(`${BASE_URL}/api/follow-ups`, {
      headers: { Authorization: `Bearer ${tokenU}` },
    });
    const resProfile = await fetch(`${BASE_URL}/api/business/profile`, {
      headers: { Authorization: `Bearer ${tokenU}` },
    });

    const bodyMe = await resMe.json();
    const canView =
      resMe.status === 200 &&
      bodyMe.user.emailVerified === false &&
      resProducts.status === 200 &&
      resCustomers.status === 200 &&
      resOrders.status === 200 &&
      resFollowUps.status === 200 &&
      resProfile.status === 200;

    record(14, 'Unverified user can view account data, profile, and read-only records (HTTP 200)', canView);
  } catch (err: any) {
    record(14, 'Unverified user can view account data and read-only records', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 15: Client-side tampering cannot bypass guard (server-authoritative)
  // -------------------------------------------------------------------------
  try {
    // Attempt bypass through body property
    const resBodyTamper = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenU}`,
      },
      body: JSON.stringify({
        name: 'Hacked Product',
        price: 1000,
        emailVerified: true,
        email_verified: true,
      }),
    });

    // Attempt bypass through query parameter
    const resQueryTamper = await fetch(`${BASE_URL}/api/products?emailVerified=true&verified=1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenU}`,
      },
      body: JSON.stringify({ name: 'Hacked Product 2', price: 1000 }),
    });

    // Attempt bypass through headers
    const resHeaderTamper = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenU}`,
        'X-Email-Verified': 'true',
        'X-User-Verified': 'true',
      },
      body: JSON.stringify({ name: 'Hacked Product 3', price: 1000 }),
    });

    const allBlocked =
      resBodyTamper.status === 403 &&
      resQueryTamper.status === 403 &&
      resHeaderTamper.status === 403;

    record(15, 'Client tampering (body/query/headers) cannot bypass email verification guard', allBlocked);
  } catch (err: any) {
    record(15, 'Client tampering cannot bypass email verification guard', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 16: Email verification endpoint remains accessible
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'test_fake_token' }),
    });
    // Returns 400 with invalid token, NOT 403 blocked by guard
    record(16, 'Email verification endpoint (POST /api/auth/verify-email) remains accessible', res.status === 400);
  } catch (err: any) {
    record(16, 'Email verification endpoint remains accessible', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 17: Resend verification endpoint remains accessible
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailU }),
    });
    // Unverified user can freely request verification email
    record(17, 'Resend verification endpoint (POST /api/auth/resend-verification) remains accessible', res.ok);
  } catch (err: any) {
    record(17, 'Resend verification endpoint remains accessible', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 18: Password reset endpoints remain accessible to unverified user
  // -------------------------------------------------------------------------
  try {
    const resReset = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailU }),
    });
    const bodyReset = await resReset.json();

    const resConfirm = await fetch(`${BASE_URL}/api/auth/confirm-reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalid_token', password: 'NewPassword123!' }),
    });

    const accessible = resReset.status === 200 && bodyReset.success && resConfirm.status === 400;
    record(18, 'Password reset endpoints remain fully accessible to unverified user', accessible);
  } catch (err: any) {
    record(18, 'Password reset endpoints remain accessible to unverified user', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 19: Tenant isolation: Verified User V cannot be used to unlock unverified User U
  // -------------------------------------------------------------------------
  try {
    // Attempting to modify User U's product using User V's token is rejected with 404 (multi-tenant boundary)
    const resCrossTenant = await fetch(`${BASE_URL}/api/products/${existingProdU.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenV}`,
      },
      body: JSON.stringify({ name: 'Cross Tenant Hack' }),
    });
    record(19, 'Tenant isolation: Verified User V cannot modify unverified User U resources (HTTP 404)', resCrossTenant.status === 404);
  } catch (err: any) {
    record(19, 'Tenant isolation between verified and unverified users', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 20: Verified user can create protected resources and initialize payments immediately
  // -------------------------------------------------------------------------
  try {
    const prodRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenV}`,
      },
      body: JSON.stringify({
        name: 'Verified Merchant Product',
        price: 15000,
        category: 'fashion',
      }),
    });

    const custRes = await fetch(`${BASE_URL}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenV}`,
      },
      body: JSON.stringify({
        name: 'Verified Merchant Customer',
        phone: '08022223333',
      }),
    });

    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenV}`,
      },
      body: JSON.stringify({
        customerName: 'Verified Order Buyer',
        items: [{ productName: 'Dress', quantity: 1, unitPrice: 15000 }],
      }),
    });

    const followUpRes = await fetch(`${BASE_URL}/api/follow-ups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenV}`,
      },
      body: JSON.stringify({
        customerName: 'Verified Order Buyer',
        reason: 'Payment check',
      }),
    });

    const allSucceeded =
      prodRes.status === 201 &&
      custRes.status === 201 &&
      orderRes.status === 201 &&
      followUpRes.status === 201;

    record(20, 'Verified user can create all protected resources (products, customers, orders, follow-ups)', allSucceeded);
  } catch (err: any) {
    record(20, 'Verified user can create all protected resources', false, err.message);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n=====================================================');
  const allPassed = results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`TEST SUMMARY: ${passedCount}/${results.length} PASSED`);
  console.log('=====================================================\n');

  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }

  if (!allPassed) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal error during email verification guard test suite execution:', err);
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(1);
});
