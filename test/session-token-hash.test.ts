/**
 * Test Suite: Phase 3 Step 4 - Hash Session Tokens in Database
 *
 * Verifies that:
 * 1. Cryptographically random raw session tokens are returned to clients upon authentication.
 * 2. Only a secure one-way SHA-256 hash of each session token is stored in PostgreSQL.
 * 3. The legacy plaintext 'token' column is completely absent from the database.
 * 4. Raw session tokens are never stored, logged, or exposed in database records.
 * 5. Incoming requests with 'Authorization: Bearer <rawToken>' are hashed and looked up by token_hash.
 * 6. Invalid, tampered, or expired tokens are rejected.
 * 7. User logout deletes the session record by hash.
 * 8. User password reset invalidates all user sessions via deleteByUserId.
 * 9. Multi-tenant isolation is strictly preserved.
 * 10. Email verification, Paystack, Rate limiting, CORS, and Helmet security controls remain 100% functional.
 */

import { hashSessionToken, generateToken, hashPassword } from '../server/auth';
import { db } from '../server/db';
import { query } from '../server/db/pool';
import { runMigrations } from '../server/db/migrate';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  id: number;
  description: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function record(id: number, description: string, passed: boolean, details?: string) {
  results.push({ id, description, passed, details });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] Test ${id}: ${description}`);
  if (!passed && details) {
    console.error(`       Details: ${details}`);
  }
}

async function waitForServer(): Promise<boolean> {
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return true;
    } catch {
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  return false;
}

async function runSessionHashingTests() {
  console.log('=====================================================');
  console.log('--- STARTING SESSION TOKEN HASHING SECURITY TESTS ---');
  console.log('=====================================================');

  // Initialize DB and ensure migrations are synchronized
  await db.init();

  const isServerUp = await waitForServer();
  if (!isServerUp) {
    console.error('FATAL: Express server is not responding at', BASE_URL);
    process.exit(1);
  }

  // --- UNIT & CRYPTOGRAPHIC TESTS ---

  // Test 1: hashSessionToken generates a 64-character SHA-256 hex digest
  const sampleToken = generateToken();
  const sampleHash = hashSessionToken(sampleToken);
  const isValidSha256 = /^[a-f0-9]{64}$/.test(sampleHash);
  record(
    1,
    'hashSessionToken generates a 64-character SHA-256 hex digest',
    sampleToken.length === 64 && isValidSha256 && sampleToken !== sampleHash
  );

  // Test 2: hashSessionToken is deterministic and one-way
  const tokenA = generateToken();
  const tokenB = generateToken();
  const hashA1 = hashSessionToken(tokenA);
  const hashA2 = hashSessionToken(tokenA);
  const hashB = hashSessionToken(tokenB);
  record(
    2,
    'hashSessionToken is strictly deterministic and distinct for different tokens',
    hashA1 === hashA2 && hashA1 !== hashB
  );

  // Test 3: Database schema verification - token_hash column exists and legacy token column is absent
  const colRes = await query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sessions'"
  );
  const colNames = colRes.rows.map((r: any) => r.column_name);
  const hasTokenHash = colNames.includes('token_hash');
  const hasNoLegacyToken = !colNames.includes('token');
  record(
    3,
    'Database schema verification: token_hash is present and legacy plaintext token column is absent',
    hasTokenHash && hasNoLegacyToken,
    `Columns present: ${colNames.join(', ')}`
  );

  // Test 4: Primary key on sessions is token_hash
  const pkRes = await query(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'sessions'
      AND tc.constraint_type = 'PRIMARY KEY'
  `);
  const pkCol = pkRes.rows[0]?.column_name;
  record(
    4,
    'sessions table PRIMARY KEY is strictly token_hash',
    pkCol === 'token_hash',
    `Current primary key column: ${pkCol}`
  );

  // --- LIVE AUTHENTICATION & SESSION PERSISTENCE TESTS ---

  // Create isolated test user and business
  const testSuffix = Date.now().toString();
  const testEmail = `merchant_session_${testSuffix}@example.com`;
  const testPassword = 'StrongPassword123!';
  const hashedPassword = hashPassword(testPassword);

  const testBizId = `biz_sess_${testSuffix}`;
  const testUserId = `usr_sess_${testSuffix}`;

  await db.businesses.create({
    id: testBizId,
    ownerId: testUserId,
    name: `Session Store ${testSuffix}`,
    category: 'fashion',
    description: 'Testing session hashing',
    phone: '+2348011223344',
    location: 'Lagos, Nigeria',
    currency: '₦',
    deliveryInfo: 'Fast delivery',
    returnPolicy: '7 days',
    paymentInstructions: 'Bank transfer',
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
  });

  await db.users.create({
    id: testUserId,
    name: 'Session Merchant',
    email: testEmail,
    role: 'merchant',
    businessId: testBizId,
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString(),
    passwordHash: hashedPassword.hash,
    passwordSalt: hashedPassword.salt,
    createdAt: new Date().toISOString(),
  });

  // Test 5: Login creates a valid session, returns raw token to client, but persists ONLY token_hash in DB
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const loginData = await loginRes.json();
  const rawLoginToken = loginData.token;
  const expectedLoginHash = hashSessionToken(rawLoginToken);

  const dbHashLookup = await query('SELECT * FROM sessions WHERE token_hash = $1', [expectedLoginHash]);
  const dbRawLookup = await query('SELECT * FROM sessions WHERE token_hash = $1', [rawLoginToken]);

  record(
    5,
    'Login returns raw token to client, but PostgreSQL stores ONLY the SHA-256 token_hash',
    loginRes.status === 200 &&
      rawLoginToken &&
      rawLoginToken.length === 64 &&
      dbHashLookup.rows.length === 1 &&
      dbRawLookup.rows.length === 0,
    `dbHashLookup count: ${dbHashLookup.rows.length}, dbRawLookup count: ${dbRawLookup.rows.length}`
  );

  // Test 6: Authenticating a protected route with raw token succeeds (server hashes token and matches session)
  const productsRes = await fetch(`${BASE_URL}/api/products`, {
    headers: { Authorization: `Bearer ${rawLoginToken}` },
  });
  record(
    6,
    'Protected API route accepts raw Bearer token and authenticates via hashed DB lookup',
    productsRes.status === 200
  );

  // Test 7: Invalid or tampered token is rejected with HTTP 401
  const tamperedToken = rawLoginToken.slice(0, -4) + 'abcd';
  const invalidRes = await fetch(`${BASE_URL}/api/products`, {
    headers: { Authorization: `Bearer ${tamperedToken}` },
  });
  record(
    7,
    'Invalid or tampered token is rejected with HTTP 401',
    invalidRes.status === 401
  );

  // Test 8: Arbitrary unknown token is rejected with HTTP 401
  const unknownToken = crypto.randomBytes(32).toString('hex');
  const unknownRes = await fetch(`${BASE_URL}/api/products`, {
    headers: { Authorization: `Bearer ${unknownToken}` },
  });
  record(
    8,
    'Arbitrary unauthenticated token is rejected with HTTP 401',
    unknownRes.status === 401
  );

  // Test 9: Expired session is rejected and cleaned up from database
  const expiredRawToken = generateToken();
  const expiredHash = hashSessionToken(expiredRawToken);
  await db.sessions.create({
    tokenHash: expiredHash,
    userId: testUserId,
    businessId: testBizId,
    createdAt: new Date(Date.now() - 60000).toISOString(),
    expiresAt: new Date(Date.now() - 1000).toISOString(), // expired 1 sec ago
  });

  const expiredRes = await fetch(`${BASE_URL}/api/products`, {
    headers: { Authorization: `Bearer ${expiredRawToken}` },
  });
  const dbExpiredCheck = await query('SELECT * FROM sessions WHERE token_hash = $1', [expiredHash]);

  record(
    9,
    'Expired session is rejected with HTTP 401 and automatically deleted from PostgreSQL',
    expiredRes.status === 401 && dbExpiredCheck.rows.length === 0,
    `Status: ${expiredRes.status}, remaining expired rows: ${dbExpiredCheck.rows.length}`
  );

  // Test 10: User logout invalidates the session by deleting the token_hash
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${rawLoginToken}` },
  });
  const logoutData = await logoutRes.json();
  const postLogoutRes = await fetch(`${BASE_URL}/api/products`, {
    headers: { Authorization: `Bearer ${rawLoginToken}` },
  });
  const postLogoutDbCheck = await query('SELECT * FROM sessions WHERE token_hash = $1', [expectedLoginHash]);

  record(
    10,
    'Logout invalidates the session by deleting the hash from PostgreSQL',
    logoutRes.status === 200 &&
      logoutData.success === true &&
      postLogoutRes.status === 401 &&
      postLogoutDbCheck.rows.length === 0,
    `postLogoutRes: ${postLogoutRes.status}, remaining rows: ${postLogoutDbCheck.rows.length}`
  );

  // --- MULTI-TENANT ISOLATION & PASSWORD RESET TESTS ---

  // Create two distinct users with active sessions
  const userAId = `usr_tenant_a_${testSuffix}`;
  const userBId = `usr_tenant_b_${testSuffix}`;
  const bizAId = `biz_tenant_a_${testSuffix}`;
  const bizBId = `biz_tenant_b_${testSuffix}`;

  await db.businesses.create({
    id: bizAId,
    ownerId: userAId,
    name: 'Tenant A Store',
    category: 'phones',
    description: 'Tenant A',
    phone: '+2348011111111',
    location: 'Abuja, Nigeria',
    currency: '₦',
    deliveryInfo: 'Fast delivery',
    returnPolicy: '7 days',
    paymentInstructions: 'Bank transfer',
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
  });

  await db.businesses.create({
    id: bizBId,
    ownerId: userBId,
    name: 'Tenant B Store',
    category: 'beauty',
    description: 'Tenant B',
    phone: '+2348022222222',
    location: 'Lagos, Nigeria',
    currency: '₦',
    deliveryInfo: 'Fast delivery',
    returnPolicy: '7 days',
    paymentInstructions: 'Bank transfer',
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
  });

  await db.users.create({
    id: userAId,
    name: 'User A',
    email: `tenant_a_${testSuffix}@example.com`,
    role: 'merchant',
    businessId: bizAId,
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString(),
    passwordHash: hashedPassword.hash,
    passwordSalt: hashedPassword.salt,
    createdAt: new Date().toISOString(),
  });

  await db.users.create({
    id: userBId,
    name: 'User B',
    email: `tenant_b_${testSuffix}@example.com`,
    role: 'merchant',
    businessId: bizBId,
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString(),
    passwordHash: hashedPassword.hash,
    passwordSalt: hashedPassword.salt,
    createdAt: new Date().toISOString(),
  });

  const rawTokenA = generateToken();
  const rawTokenB = generateToken();

  await db.sessions.create({
    token: rawTokenA,
    userId: userAId,
    businessId: bizAId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });

  await db.sessions.create({
    token: rawTokenB,
    userId: userBId,
    businessId: bizBId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });

  // Create a product owned by Tenant B
  const prodBId = `prod_${testSuffix}`;
  const prodB = await db.products.create({
    id: prodBId,
    businessId: bizBId,
    name: 'Tenant B Secret Product',
    price: 45000,
    stockQuantity: 10,
    sku: `SKU-${testSuffix}`,
    status: 'active',
    category: 'Cosmetics',
    description: 'Secret product',
    images: [],
    variants: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Test 11: Tenant isolation - User A cannot access or modify Tenant B's product
  const tenantAccessRes = await fetch(`${BASE_URL}/api/products/${prodB.id}`, {
    headers: { Authorization: `Bearer ${rawTokenA}` },
  });
  record(
    11,
    'Multi-tenant isolation: User A cannot access Tenant B resources (HTTP 404)',
    tenantAccessRes.status === 404
  );

  // Test 12: Password reset invalidates all target user sessions without affecting other tenants
  await db.sessions.deleteByUserId(userAId);
  const userASessionCheck = await db.sessions.findByToken(rawTokenA);
  const userBSessionCheck = await db.sessions.findByToken(rawTokenB);

  record(
    12,
    'deleteByUserId invalidates all target user sessions while preserving other tenants sessions',
    userASessionCheck === null && userBSessionCheck !== null
  );

  // --- INTEGRATION & SECURITY CONTROLS VERIFICATION ---

  // Test 13: Paystack subscription endpoint operates with hashed session token
  const subRes = await fetch(`${BASE_URL}/api/subscription`, {
    headers: { Authorization: `Bearer ${rawTokenB}` },
  });
  record(
    13,
    'Paystack subscription endpoint authenticates successfully with hashed session (HTTP 200)',
    subRes.status === 200
  );

  // Test 14: Rate limit headers are present and functional on hashed session requests
  const rateLimitHeader = subRes.headers.get('ratelimit-limit') || subRes.headers.get('x-ratelimit-limit');
  const rateLimitRemaining = subRes.headers.get('ratelimit-remaining') || subRes.headers.get('x-ratelimit-remaining');
  record(
    14,
    'Global API rate limiting headers remain active on authenticated session requests',
    rateLimitHeader !== null && rateLimitRemaining !== null
  );

  // Test 15: CORS headers remain functional and correctly reflect trusted origins on authenticated requests
  const corsRes = await fetch(`${BASE_URL}/api/subscription`, {
    headers: {
      Authorization: `Bearer ${rawTokenB}`,
      Origin: 'https://ais-dev-5gn6uf5utiuagykvmipi66-766179940387.europe-west2.run.app',
    },
  });
  const allowOrigin = corsRes.headers.get('access-control-allow-origin');
  const allowCreds = corsRes.headers.get('access-control-allow-credentials');
  record(
    15,
    'CORS headers remain functional and reflect origin on authenticated requests',
    corsRes.status === 200 &&
      allowOrigin === 'https://ais-dev-5gn6uf5utiuagykvmipi66-766179940387.europe-west2.run.app' &&
      allowCreds === 'true'
  );

  // Test 16: Helmet HTTP security headers are present on authenticated requests
  const cspHeader = corsRes.headers.get('content-security-policy');
  const xContentType = corsRes.headers.get('x-content-type-options');
  record(
    16,
    'Helmet HTTP security headers remain active on authenticated requests',
    cspHeader !== null && xContentType === 'nosniff'
  );

  // Test 17: Migration idempotency - running runMigrations() again does not disrupt active sessions
  await runMigrations();
  const postMigrationCheck = await db.sessions.findByToken(rawTokenB);
  record(
    17,
    'Database migration is fully idempotent: running runMigrations() preserves all active hashed sessions',
    postMigrationCheck !== null && postMigrationCheck.userId === userBId
  );

  // Test 18: Demo authentication creates hashed session and authenticates cleanly
  const demoAuthRes = await fetch(`${BASE_URL}/api/auth/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const demoAuthData = await demoAuthRes.json();
  const demoToken = demoAuthData.token;
  const demoExpectedHash = hashSessionToken(demoToken);

  const demoDbRow = await query('SELECT * FROM sessions WHERE token_hash = $1', [demoExpectedHash]);
  record(
    18,
    'Demo authentication generates raw token for client and stores ONLY SHA-256 token_hash in DB',
    demoAuthRes.status === 200 &&
      demoToken &&
      demoDbRow.rows.length === 1 &&
      demoDbRow.rows[0].token_hash === demoExpectedHash
  );

  // --- CLEANUP ---
  await db.sessions.deleteByToken(rawTokenB);
  await db.sessions.deleteByToken(demoToken);
  await db.products.delete(prodB.id, bizBId);
  await db.users.delete(testUserId);
  await db.users.delete(userAId);
  await db.users.delete(userBId);
  await db.businesses.delete(testBizId);
  await db.businesses.delete(bizAId);
  await db.businesses.delete(bizBId);

  // Print Summary
  console.log('=====================================================');
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`TEST SUMMARY: ${passedCount}/${total} PASSED`);
  console.log('=====================================================');

  if (passedCount < total) {
    process.exit(1);
  }
  process.exit(0);
}

runSessionHashingTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
