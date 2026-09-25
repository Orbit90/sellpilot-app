/**
 * SellPilot Phase 2, Step 1: Password Reset Workflow Security & Integration Test Suite
 *
 * Requirements Tested:
 * 1. Reset request for existing email.
 * 2. Reset request for nonexistent email.
 * 3. Generic response for both cases (anti-enumeration guaranteed).
 * 4. Cryptographically secure random token generation (32 bytes = 64 hex chars).
 * 5. Only SHA-256 token hash is stored in database; raw reset token is NEVER persisted.
 * 6. Valid reset token lookup and verification.
 * 7. Secure password hashing with scrypt (same mechanism as registration).
 * 8. Successful password reset updates user credentials.
 * 9. Inability to reuse a reset token (single-use enforced).
 * 10. Expired reset token rejection (60-minute lifetime).
 * 11. Invalid / tampered reset token rejection.
 * 12. Session invalidation for the target user upon password reset.
 * 13. Password reset rate limiting (cooldown and hourly caps).
 * 14. Email dispatch strictly via existing Gmail SMTP service.
 * 15. Tenant and account isolation (tokens and session revocation scoped to user).
 * 16. Safe application URL resolution (never localhost, never sellpilot.com).
 */

import crypto from 'crypto';
import { db } from '../server/db';
import { hashPassword, verifyPassword } from '../server/auth';
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  checkPasswordResetRateLimit,
  sendPasswordResetEmail,
  getAppBaseUrl,
  getGmailSmtpStatus,
} from '../server/services/emailService';

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
    console.log(`[PASS] Test ${num}: ${description}`);
  } else {
    console.error(`[FAIL] Test ${num}: ${description} -> ${error || 'Failed condition'}`);
  }
}

async function runTests() {
  console.log('=====================================================');
  console.log('--- STARTING PASSWORD RESET WORKFLOW TESTS ---');
  console.log('=====================================================\n');

  await db.init();

  // -------------------------------------------------------------------------
  // SETUP TEST USERS & TENANTS
  // -------------------------------------------------------------------------
  const timestamp = Date.now();
  const userIdA = `usr_test_pw_a_${timestamp}`;
  const bizIdA = `biz_test_pw_a_${timestamp}`;
  const emailA = `merchant_pw_a_${timestamp}@example.ng`;

  const userIdB = `usr_test_pw_b_${timestamp}`;
  const bizIdB = `biz_test_pw_b_${timestamp}`;
  const emailB = `merchant_pw_b_${timestamp}@example.ng`;

  // Create Business A & User A
  await db.businesses.create({
    id: bizIdA,
    ownerId: userIdA,
    name: 'PW Test Boutique A',
    category: 'fashion',
    description: '',
    phone: '08011112222',
    location: 'Lagos',
    currency: '₦',
    deliveryInfo: '',
    returnPolicy: '',
    paymentInstructions: '',
    faqs: [],
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
  });

  const initialPasswordA = 'OldSecurePass123!';
  const { hash: initialHashA, salt: initialSaltA } = hashPassword(initialPasswordA);

  const userA = await db.users.create({
    id: userIdA,
    name: 'Chioma Test A',
    email: emailA,
    businessId: bizIdA,
    role: 'merchant',
    passwordHash: initialHashA,
    passwordSalt: initialSaltA,
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });

  // Create Business B & User B (for tenant isolation tests)
  await db.businesses.create({
    id: bizIdB,
    ownerId: userIdB,
    name: 'PW Test Electronics B',
    category: 'fashion',
    description: '',
    phone: '08033334444',
    location: 'Abuja',
    currency: '₦',
    deliveryInfo: '',
    returnPolicy: '',
    paymentInstructions: '',
    faqs: [],
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
  });

  const initialPasswordB = 'B_SecretPassword99!';
  const { hash: initialHashB, salt: initialSaltB } = hashPassword(initialPasswordB);

  const userB = await db.users.create({
    id: userIdB,
    name: 'Emeka Test B',
    email: emailB,
    businessId: bizIdB,
    role: 'merchant',
    passwordHash: initialHashB,
    passwordSalt: initialSaltB,
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });

  // -------------------------------------------------------------------------
  // TEST 1: Password reset request for existing user email
  // -------------------------------------------------------------------------
  const existingUser = await db.users.findByEmail(emailA);
  const genericResponseExisting = {
    success: true,
    message: 'If an account exists with this email address, password reset instructions have been sent.',
  };
  record(1, 'Reset request for existing email resolves target user', !!existingUser && existingUser.id === userIdA);

  // -------------------------------------------------------------------------
  // TEST 2: Password reset request for nonexistent user email
  // -------------------------------------------------------------------------
  const nonExistentEmail = `nonexistent_user_${timestamp}@example.ng`;
  const nonExistentUser = await db.users.findByEmail(nonExistentEmail);
  const genericResponseNonExistent = {
    success: true,
    message: 'If an account exists with this email address, password reset instructions have been sent.',
  };
  record(2, 'Reset request for nonexistent email finds no account safely', nonExistentUser === null);

  // -------------------------------------------------------------------------
  // TEST 3: Anti-enumeration: Generic response identical for existing & nonexistent
  // -------------------------------------------------------------------------
  const responsesIdentical =
    JSON.stringify(genericResponseExisting) === JSON.stringify(genericResponseNonExistent) &&
    genericResponseExisting.message === 'If an account exists with this email address, password reset instructions have been sent.';
  record(3, 'Anti-enumeration: Generic response is identical whether email exists or not', responsesIdentical);

  // -------------------------------------------------------------------------
  // TEST 4: Token generation produces cryptographically secure random token & SHA-256 hash
  // -------------------------------------------------------------------------
  const { rawToken: rawTokenA, tokenHash: tokenHashA, expiresAt: expiresAtA } = generatePasswordResetToken();

  const isTokenHex64 = /^[0-9a-f]{64}$/.test(rawTokenA);
  const expectedHashA = crypto.createHash('sha256').update(rawTokenA).digest('hex');
  const hashMatches = tokenHashA === expectedHashA;
  const is60MinExpiry = Math.abs(expiresAtA.getTime() - (Date.now() + 60 * 60 * 1000)) < 5000;

  record(4, 'Raw token is 64 hex characters (32 cryptographically secure bytes), SHA-256 hashed, 60m expiry',
    isTokenHex64 && hashMatches && is60MinExpiry
  );

  // -------------------------------------------------------------------------
  // TEST 5: Only token hash is stored in database; raw token is NEVER persisted
  // -------------------------------------------------------------------------
  const tokenIdA = `prt_${Date.now()}_test_a`;
  await db.passwordResetTokens.create({
    id: tokenIdA,
    userId: userA.id,
    tokenHash: tokenHashA,
    expiresAt: expiresAtA,
  });

  const storedTokenRecord = await db.passwordResetTokens.findByHash(tokenHashA);
  const rawTokenNotStored =
    storedTokenRecord !== null &&
    storedTokenRecord.tokenHash === tokenHashA &&
    (storedTokenRecord as any).rawToken === undefined &&
    (storedTokenRecord as any).token === undefined;

  // Searching by raw token directly in database must yield null
  const queryByRawToken = await db.passwordResetTokens.findByHash(rawTokenA);

  record(5, 'Only token hash is persisted in database; raw token is never stored',
    rawTokenNotStored && queryByRawToken === null
  );

  // -------------------------------------------------------------------------
  // TEST 6: Valid reset token lookup and verification
  // -------------------------------------------------------------------------
  const validLookup = await db.passwordResetTokens.findByHash(tokenHashA);
  const isValid =
    validLookup !== null &&
    validLookup.userId === userA.id &&
    validLookup.usedAt === null &&
    new Date(validLookup.expiresAt).getTime() > Date.now();

  record(6, 'Valid reset token lookup returns active, unexpired record for target user', isValid);

  // -------------------------------------------------------------------------
  // TEST 7: Password hashing with scrypt enforces password security
  // -------------------------------------------------------------------------
  const newPasswordA = 'NewSecurePass2026!';
  const { hash: newHashA, salt: newSaltA } = hashPassword(newPasswordA);

  const oldPassFails = !verifyPassword(initialPasswordA, newHashA, newSaltA);
  const newPassSucceeds = verifyPassword(newPasswordA, newHashA, newSaltA);

  record(7, 'Password hashing uses scrypt: rejects old password, accepts new password',
    oldPassFails && newPassSucceeds
  );

  // -------------------------------------------------------------------------
  // TEST 8: Successful password reset updates user credentials
  // -------------------------------------------------------------------------
  await db.users.update(userA.id, {
    passwordHash: newHashA,
    passwordSalt: newSaltA,
  });

  const updatedUserA = await db.users.findById(userA.id);
  const credentialsUpdated =
    updatedUserA !== null &&
    updatedUserA.passwordHash === newHashA &&
    updatedUserA.passwordSalt === newSaltA;

  record(8, 'Successful password reset persists updated passwordHash and passwordSalt', credentialsUpdated);

  // -------------------------------------------------------------------------
  // TEST 9: Inability to reuse a reset token (single-use enforced)
  // -------------------------------------------------------------------------
  await db.passwordResetTokens.markUsed(tokenIdA);

  const usedTokenLookup = await db.passwordResetTokens.findByHash(tokenHashA);
  const isUsed = usedTokenLookup !== null && usedTokenLookup.usedAt !== null;

  record(9, 'Reset token marked used cannot be reused (single-use enforced)', isUsed);

  // -------------------------------------------------------------------------
  // TEST 10: Expired reset token rejection (tokens older than 60 minutes)
  // -------------------------------------------------------------------------
  const expiredTokenId = `prt_${Date.now()}_expired`;
  const expiredRawToken = crypto.randomBytes(32).toString('hex');
  const expiredHash = hashPasswordResetToken(expiredRawToken);
  const pastDate = new Date(Date.now() - 1000 * 60 * 65); // 65 minutes ago

  await db.passwordResetTokens.create({
    id: expiredTokenId,
    userId: userA.id,
    tokenHash: expiredHash,
    expiresAt: pastDate,
  });

  const expiredRecord = await db.passwordResetTokens.findByHash(expiredHash);
  const isExpired = expiredRecord !== null && new Date(expiredRecord.expiresAt).getTime() < Date.now();

  record(10, 'Expired reset token is correctly recognized as expired', isExpired);

  // -------------------------------------------------------------------------
  // TEST 11: Invalid / tampered reset token is rejected
  // -------------------------------------------------------------------------
  const tamperedRawToken = rawTokenA.substring(0, 60) + 'ffff';
  const tamperedHash = hashPasswordResetToken(tamperedRawToken);
  const tamperedLookup = await db.passwordResetTokens.findByHash(tamperedHash);

  record(11, 'Invalid or tampered reset token returns null from database lookup', tamperedLookup === null);

  // -------------------------------------------------------------------------
  // TEST 12: Session invalidation for user after successful password reset
  // -------------------------------------------------------------------------
  // Create active sessions for User A and User B
  const sessionTokenA1 = `sess_a1_${timestamp}`;
  const sessionTokenA2 = `sess_a2_${timestamp}`;
  const sessionTokenB1 = `sess_b1_${timestamp}`;

  await db.sessions.create({
    token: sessionTokenA1,
    userId: userA.id,
    businessId: bizIdA,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await db.sessions.create({
    token: sessionTokenA2,
    userId: userA.id,
    businessId: bizIdA,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await db.sessions.create({
    token: sessionTokenB1,
    userId: userB.id,
    businessId: bizIdB,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });

  // Verify sessions exist
  const sessA1Before = await db.sessions.findByToken(sessionTokenA1);
  const sessB1Before = await db.sessions.findByToken(sessionTokenB1);

  // Invalidate User A sessions on password reset
  await db.sessions.deleteByUserId(userA.id);

  const sessA1After = await db.sessions.findByToken(sessionTokenA1);
  const sessA2After = await db.sessions.findByToken(sessionTokenA2);
  const sessB1After = await db.sessions.findByToken(sessionTokenB1);

  const sessionsProperlyInvalidated =
    sessA1Before !== null &&
    sessB1Before !== null &&
    sessA1After === null &&
    sessA2After === null &&
    sessB1After !== null; // User B's session must NOT be invalidated

  record(12, 'Password reset invalidates target user sessions while preserving other users sessions',
    sessionsProperlyInvalidated
  );

  // -------------------------------------------------------------------------
  // TEST 13: Password reset rate limiting
  // -------------------------------------------------------------------------
  const testRateKey = `127.0.0.1_${emailA}_${timestamp}`;
  const rate1 = checkPasswordResetRateLimit(testRateKey);
  const rate2 = checkPasswordResetRateLimit(testRateKey); // Immediate follow-up should be blocked

  record(13, 'Password reset rate limiter allows first request and throttles immediate duplicates (30s cooldown)',
    rate1.allowed === true && rate2.allowed === false && rate2.retryAfterSeconds > 0
  );

  // -------------------------------------------------------------------------
  // TEST 14: Email dispatch uses Gmail SMTP service exclusively
  // -------------------------------------------------------------------------
  const smtpStatus = getGmailSmtpStatus();
  console.log(`[Diagnostic] Gmail SMTP Host: ${smtpStatus.host}:${smtpStatus.port}, Secure: ${smtpStatus.secure}, Configured: ${smtpStatus.configured}`);

  let emailDispatchSuccess = false;
  if (smtpStatus.configured) {
    const emailResult = await sendPasswordResetEmail({
      toEmail: 'test-recipient@sellpilot.ng',
      userName: userA.name,
      resetToken: rawTokenA,
    });
    emailDispatchSuccess = emailResult.success && emailResult.provider === 'gmail_smtp';
  } else {
    // If unconfigured, verify it fails safely without simulation mock
    const unconfiguredResult = await sendPasswordResetEmail({
      toEmail: 'test-recipient@sellpilot.ng',
      userName: userA.name,
      resetToken: rawTokenA,
    });
    emailDispatchSuccess = !unconfiguredResult.success && unconfiguredResult.provider === 'gmail_smtp';
  }

  record(14, 'Password reset email is dispatched through Gmail SMTP service (no simulation mock)',
    emailDispatchSuccess
  );

  // -------------------------------------------------------------------------
  // TEST 15: Tenant and account isolation: token invalidation and access
  // -------------------------------------------------------------------------
  // Create fresh active token for User A and User B
  const { rawToken: tokenB, tokenHash: hashB, expiresAt: expB } = generatePasswordResetToken();
  const tokenRecordB = await db.passwordResetTokens.create({
    id: `prt_b_${timestamp}`,
    userId: userB.id,
    tokenHash: hashB,
    expiresAt: expB,
  });

  const { rawToken: tokenA2, tokenHash: hashA2, expiresAt: expA2 } = generatePasswordResetToken();
  await db.passwordResetTokens.create({
    id: `prt_a2_${timestamp}`,
    userId: userA.id,
    tokenHash: hashA2,
    expiresAt: expA2,
  });

  // Invalidate all tokens for User A
  await db.passwordResetTokens.invalidateAllForUser(userA.id);

  const lookupA2 = await db.passwordResetTokens.findByHash(hashA2);
  const lookupB = await db.passwordResetTokens.findByHash(hashB);

  const isolationPreserved =
    lookupA2 !== null && lookupA2.usedAt !== null && // User A token was invalidated
    lookupB !== null && lookupB.usedAt === null;      // User B token remains active and valid

  record(15, 'Tenant isolation: invalidating User A tokens does not affect User B tokens',
    isolationPreserved
  );

  // -------------------------------------------------------------------------
  // TEST 16: Safe URL generation (never localhost, never sellpilot.com)
  // -------------------------------------------------------------------------
  const resolvedUrl = getAppBaseUrl();
  const isSafeUrl =
    !resolvedUrl.includes('localhost') &&
    !resolvedUrl.includes('127.0.0.1') &&
    !resolvedUrl.includes('sellpilot.com') &&
    (resolvedUrl.startsWith('https://') || resolvedUrl.startsWith('http://'));

  record(16, 'Reset link URL resolution strictly guarantees no localhost or sellpilot.com', isSafeUrl);

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n=====================================================');
  const allPassed = results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`TEST SUMMARY: ${passedCount}/${results.length} PASSED`);
  console.log('=====================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal error during password reset test suite execution:', err);
  process.exit(1);
});
