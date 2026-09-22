/**
 * Paystack Payment Verification & Webhook Test Suite
 *
 * Covers all required test scenarios:
 * 1. successful payment
 * 2. wrong amount
 * 3. wrong currency
 * 4. invalid reference
 * 5. failed transaction
 * 6. duplicate verification
 * 7. duplicate webhook
 * 8. invalid webhook signature
 * 9. successful subscription activation
 */

import crypto from 'crypto';
import { db } from '../server/db';
import { processVerifiedPayment } from '../server/services/paymentVerificationService';
import { paystackService } from '../server/services/paystackService';

async function runTests() {
  console.log('--- STARTING PAYSTACK VERIFICATION TEST SUITE ---');
  await db.init();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  // Setup test tenant
  const testBizId = `biz_test_${Date.now()}`;
  const testUserId = `usr_test_${Date.now()}`;

  // Insert business and user
  await db.query(
    `INSERT INTO businesses (id, owner_id, name, category, created_at)
     VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (id) DO NOTHING`,
    [testBizId, testUserId, 'Test Paystack Business', 'fashion']
  );

  await db.query(
    `INSERT INTO users (id, business_id, name, email, role, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (id) DO NOTHING`,
    [testUserId, testBizId, 'Test User', `test_${Date.now()}@paystacktest.ng`, 'merchant']
  );

  // Initial subscription on trial
  const initialTrialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.query(
    `INSERT INTO subscriptions (
      id, business_id, plan, status, trial_started_at, trial_ends_at,
      current_period_start, current_period_end, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $6, NOW(), NOW())
    ON CONFLICT (business_id) DO NOTHING`,
    [`sub_${testBizId}`, testBizId, 'FREE_TRIAL', 'trialing', new Date().toISOString(), initialTrialEnd]
  );

  // -------------------------------------------------------------
  // Test 1: Successful payment
  // -------------------------------------------------------------
  const ref1 = `sp_pro_${Date.now()}_test1`;
  await db.payments.create({
    id: `pay_test1_${Date.now()}`,
    businessId: testBizId,
    userId: testUserId,
    plan: 'PRO',
    amount: 1000000,
    currency: 'NGN',
    reference: ref1,
    provider: 'PAYSTACK',
    status: 'pending',
  });

  const res1 = await processVerifiedPayment({
    reference: ref1,
    expectedBusinessId: testBizId,
    expectedUserId: testUserId,
    paystackData: {
      status: 'success',
      reference: ref1,
      amount: 1000000,
      currency: 'NGN',
      id: 99901,
      channel: 'card',
      paid_at: new Date().toISOString(),
    },
  });

  assert(
    res1.success === true && res1.payment?.status === 'success',
    '1. Successful payment verification marks payment as success',
    res1.error
  );

  // -------------------------------------------------------------
  // Test 2: Wrong amount
  // -------------------------------------------------------------
  const ref2 = `sp_starter_${Date.now()}_test2`;
  await db.payments.create({
    id: `pay_test2_${Date.now()}`,
    businessId: testBizId,
    userId: testUserId,
    plan: 'STARTER', // Expected: 500,000 kobo (₦5,000)
    amount: 500000,
    currency: 'NGN',
    reference: ref2,
    provider: 'PAYSTACK',
    status: 'pending',
  });

  const res2 = await processVerifiedPayment({
    reference: ref2,
    expectedBusinessId: testBizId,
    paystackData: {
      status: 'success',
      reference: ref2,
      amount: 100000, // ❌ WRONG AMOUNT: paid 100,000 kobo instead of 500,000
      currency: 'NGN',
    },
  });

  const dbPay2 = await db.payments.findByReference(ref2);
  assert(
    res2.success === false && dbPay2?.status === 'failed',
    '2. Wrong amount rejects and marks payment as failed',
    `Expected failure, got: ${JSON.stringify(res2)}`
  );

  // -------------------------------------------------------------
  // Test 3: Wrong currency
  // -------------------------------------------------------------
  const ref3 = `sp_pro_${Date.now()}_test3`;
  await db.payments.create({
    id: `pay_test3_${Date.now()}`,
    businessId: testBizId,
    userId: testUserId,
    plan: 'PRO',
    amount: 1000000,
    currency: 'NGN',
    reference: ref3,
    provider: 'PAYSTACK',
    status: 'pending',
  });

  const res3 = await processVerifiedPayment({
    reference: ref3,
    expectedBusinessId: testBizId,
    paystackData: {
      status: 'success',
      reference: ref3,
      amount: 1000000,
      currency: 'USD', // ❌ WRONG CURRENCY: paid in USD instead of NGN
    },
  });

  const dbPay3 = await db.payments.findByReference(ref3);
  assert(
    res3.success === false && dbPay3?.status === 'failed',
    '3. Wrong currency rejects and marks payment as failed',
    `Expected failure, got: ${JSON.stringify(res3)}`
  );

  // -------------------------------------------------------------
  // Test 4: Invalid reference
  // -------------------------------------------------------------
  const res4 = await processVerifiedPayment({
    reference: 'sp_nonexistent_reference_999999',
    expectedBusinessId: testBizId,
  });

  assert(
    res4.success === false && res4.statusCode === 404,
    '4. Invalid reference returns 404 not found',
    `Expected 404, got: ${res4.statusCode}`
  );

  // -------------------------------------------------------------
  // Test 5: Failed transaction
  // -------------------------------------------------------------
  const ref5 = `sp_biz_${Date.now()}_test5`;
  await db.payments.create({
    id: `pay_test5_${Date.now()}`,
    businessId: testBizId,
    userId: testUserId,
    plan: 'BUSINESS',
    amount: 2000000,
    currency: 'NGN',
    reference: ref5,
    provider: 'PAYSTACK',
    status: 'pending',
  });

  const res5 = await processVerifiedPayment({
    reference: ref5,
    expectedBusinessId: testBizId,
    paystackData: {
      status: 'failed', // ❌ FAILED TRANSACTION
      reference: ref5,
      amount: 2000000,
      currency: 'NGN',
    },
  });

  const dbPay5 = await db.payments.findByReference(ref5);
  assert(
    res5.success === false && dbPay5?.status === 'failed',
    '5. Failed transaction rejects and marks payment failed',
    `Expected failure, got: ${JSON.stringify(res5)}`
  );

  // -------------------------------------------------------------
  // Test 6: Duplicate verification
  // -------------------------------------------------------------
  // Re-verify ref1 which was already verified and successful
  const res6 = await processVerifiedPayment({
    reference: ref1,
    expectedBusinessId: testBizId,
    expectedUserId: testUserId,
  });

  assert(
    res6.success === true && res6.alreadyProcessed === true,
    '6. Duplicate verification is idempotent (alreadyProcessed = true)',
    `Expected alreadyProcessed: true, got: ${JSON.stringify(res6)}`
  );

  // -------------------------------------------------------------
  // Test 7: Duplicate webhook
  // -------------------------------------------------------------
  // Send webhook data for ref1 again
  const res7 = await processVerifiedPayment({
    reference: ref1,
    paystackData: {
      status: 'success',
      reference: ref1,
      amount: 1000000,
      currency: 'NGN',
    },
  });

  assert(
    res7.success === true && res7.alreadyProcessed === true,
    '7. Duplicate webhook is idempotent and does not duplicate activation',
    `Expected alreadyProcessed: true, got: ${JSON.stringify(res7)}`
  );

  // -------------------------------------------------------------
  // Test 8: Invalid webhook signature
  // -------------------------------------------------------------
  const secretKey = process.env.PAYSTACK_SECRET_KEY || 'test_secret_key';
  const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'sp_some_ref' } });

  const validSignature = crypto
    .createHmac('sha512', secretKey)
    .update(payload)
    .digest('hex');

  const invalidSignature = 'tampered_signature_1234567890abcdef';

  const isSigValid1 = paystackService.verifyWebhookSignature(validSignature, payload);
  const isSigValid2 = paystackService.verifyWebhookSignature(invalidSignature, payload);

  assert(
    isSigValid1 === true && isSigValid2 === false,
    '8. Webhook signature verification validates true signature and rejects invalid/tampered signature',
    `validSignature check: ${isSigValid1}, invalidSignature check: ${isSigValid2}`
  );

  // -------------------------------------------------------------
  // Test 9: Successful subscription activation
  // -------------------------------------------------------------
  const subAfter = await db.subscriptions.findByBusinessId(testBizId);
  assert(
    subAfter !== null &&
      subAfter.status === 'active' &&
      subAfter.plan === 'PRO' &&
      new Date(subAfter.currentPeriodEnd).getTime() > Date.now(),
    '9. Successful subscription activation updates plan to PRO, status to active, and valid period end',
    `Subscription status: ${subAfter?.status}, plan: ${subAfter?.plan}, end: ${subAfter?.currentPeriodEnd}`
  );

  console.log('--- TEST SUITE COMPLETE ---');
  console.log(`Passed: ${passed} / ${passed + failed}`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
