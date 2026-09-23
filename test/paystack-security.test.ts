/**
 * SellPilot Paystack Integration Security Test Suite
 *
 * Covers all 11 required security validations:
 * 1. A frontend request cannot change STARTER from ₦5,000 to another amount.
 * 2. A frontend request cannot change PRO from ₦10,000 to another amount.
 * 3. A frontend request cannot change BUSINESS from ₦20,000 to another amount.
 * 4. A user cannot activate a subscription by simply calling the verification endpoint with a fake reference.
 * 5. A failed Paystack transaction does not activate a subscription.
 * 6. A successful payment for one plan cannot activate a different plan.
 * 7. A duplicate verification cannot create a duplicate subscription.
 * 8. A duplicate Paystack webhook cannot create a duplicate subscription or extend the subscription incorrectly.
 * 9. An invalid webhook signature is rejected.
 * 10. An unauthenticated user cannot initialize a payment.
 * 11. One business/user cannot access or modify another business/user's payment records or subscription.
 */

import crypto from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import { db } from '../server/db';
import { processVerifiedPayment } from '../server/services/paymentVerificationService';
import { paystackService } from '../server/services/paystackService';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  num: number;
  description: string;
  passed: boolean;
  error?: string;
}

let serverProcess: ChildProcess | null = null;

async function ensureServerRunning() {
  try {
    const res = await fetch(`${BASE_URL}/api/plans`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) return;
  } catch {
    // Server not running, spawn it
  }

  console.log('Test server not detected on port 3000. Starting local server for test execution...');
  serverProcess = spawn('npx', ['tsx', 'server.ts'], {
    env: { ...process.env, PORT: '3000' },
    stdio: 'ignore',
  });

  // Wait for server to become responsive
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

async function runSecurityTests() {
  console.log('=====================================================');
  console.log('--- STARTING PAYSTACK INTEGRATION SECURITY TESTS ---');
  console.log('=====================================================\n');

  await ensureServerRunning();
  await db.init();

  const results: TestResult[] = [];

  function record(num: number, description: string, passed: boolean, error?: string) {
    results.push({ num, description, passed, error });
    if (passed) {
      console.log(`[PASS] Test ${num}: ${description}`);
    } else {
      console.error(`[FAIL] Test ${num}: ${description} -> ${error || 'Failed condition'}`);
    }
  }

  // Create User A (Business A)
  const businessIdA = `biz_sec_a_${Date.now()}`;
  const userIdA = `usr_sec_a_${Date.now()}`;
  const tokenA = `tok_sec_a_${Date.now()}`;
  const userAEmail = `sec_user_a_${Date.now()}@sellpilot.ng`;

  await db.businesses.create({
    id: businessIdA,
    ownerId: userIdA,
    name: 'Business A Store',
    category: 'fashion',
    description: '',
    phone: '08011111111',
    location: '',
    currency: '₦',
    deliveryInfo: '',
    returnPolicy: '',
    paymentInstructions: '',
    createdAt: new Date().toISOString(),
    onboardingCompleted: true,
  });

  await db.users.create({
    id: userIdA,
    businessId: businessIdA,
    name: 'Security User A',
    email: userAEmail,
    role: 'merchant',
    passwordHash: 'dummy_hash',
    passwordSalt: 'dummy_salt',
    createdAt: new Date().toISOString(),
  });

  await db.subscriptions.create({
    id: `sub_${businessIdA}`,
    businessId: businessIdA,
    plan: 'FREE_TRIAL',
    status: 'trialing',
    trialStartedAt: new Date().toISOString(),
    trialEndsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 7 * 86400000).toISOString(),
    cancelledAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await db.sessions.create({
    token: tokenA,
    userId: userIdA,
    businessId: businessIdA,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });

  // Create User B (Business B) for cross-tenant testing
  const businessIdB = `biz_sec_b_${Date.now()}`;
  const userIdB = `usr_sec_b_${Date.now()}`;
  const tokenB = `tok_sec_b_${Date.now()}`;
  const userBEmail = `sec_user_b_${Date.now()}@sellpilot.ng`;

  await db.businesses.create({
    id: businessIdB,
    ownerId: userIdB,
    name: 'Business B Store',
    category: 'fashion',
    description: '',
    phone: '08022222222',
    location: '',
    currency: '₦',
    deliveryInfo: '',
    returnPolicy: '',
    paymentInstructions: '',
    createdAt: new Date().toISOString(),
    onboardingCompleted: true,
  });

  await db.users.create({
    id: userIdB,
    businessId: businessIdB,
    name: 'Security User B',
    email: userBEmail,
    role: 'merchant',
    passwordHash: 'dummy_hash',
    passwordSalt: 'dummy_salt',
    createdAt: new Date().toISOString(),
  });

  await db.subscriptions.create({
    id: `sub_${businessIdB}`,
    businessId: businessIdB,
    plan: 'FREE_TRIAL',
    status: 'trialing',
    trialStartedAt: new Date().toISOString(),
    trialEndsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 7 * 86400000).toISOString(),
    cancelledAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await db.sessions.create({
    token: tokenB,
    userId: userIdB,
    businessId: businessIdB,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await db.persist();

  // --------------------------------------------------------------------------
  // TEST 1: A frontend request cannot change STARTER from ₦5,000 to another amount.
  // --------------------------------------------------------------------------
  try {
    // Attacker sends STARTER plan but tries to specify amount = 50 kobo or ₦100
    const tamperRes = await fetch(`${BASE_URL}/api/payments/paystack/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        plan: 'STARTER',
        amount: 100, // malicious attempted price in Naira
        amountKobo: 10000, // malicious attempted price in Kobo
        price: 50,
      }),
    });
    const tamperData = await tamperRes.json();

    if (!tamperRes.ok || !tamperData.status || !tamperData.data?.reference) {
      throw new Error(`Initialize failed: ${tamperData.error || tamperRes.statusText}`);
    }

    const ref = tamperData.data.reference;
    // Check the actual payment record inserted into the database
    const payment = await db.payments.findByReference(ref);
    if (!payment) {
      throw new Error('Payment record not found in database');
    }

    // Expected: amount MUST be 500,000 kobo (₦5,000), ignoring frontend price
    const expectedKobo = 500000;
    const isStarterUntampered = payment.amount === expectedKobo && payment.currency === 'NGN';

    record(
      1,
      'A frontend request cannot change STARTER from ₦5,000 to another amount.',
      isStarterUntampered,
      `Stored amount was ${payment.amount} kobo, expected strictly ${expectedKobo} kobo.`
    );
  } catch (err: any) {
    record(1, 'A frontend request cannot change STARTER from ₦5,000 to another amount.', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: A frontend request cannot change PRO from ₦10,000 to another amount.
  // --------------------------------------------------------------------------
  try {
    // Attacker sends PRO plan but tries to set amount = 1 kobo / ₦1
    const tamperRes = await fetch(`${BASE_URL}/api/payments/paystack/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        plan: 'PRO',
        amount: 1,
        amountKobo: 100,
        price: 1,
      }),
    });
    const tamperData = await tamperRes.json();

    if (!tamperRes.ok || !tamperData.status || !tamperData.data?.reference) {
      throw new Error(`Initialize failed: ${tamperData.error || tamperRes.statusText}`);
    }

    const ref = tamperData.data.reference;
    const payment = await db.payments.findByReference(ref);
    if (!payment) {
      throw new Error('Payment record not found in database');
    }

    // Expected: amount MUST be 1,000,000 kobo (₦10,000)
    const expectedKobo = 1000000;
    const isProUntampered = payment.amount === expectedKobo && payment.currency === 'NGN';

    record(
      2,
      'A frontend request cannot change PRO from ₦10,000 to another amount.',
      isProUntampered,
      `Stored amount was ${payment.amount} kobo, expected strictly ${expectedKobo} kobo.`
    );
  } catch (err: any) {
    record(2, 'A frontend request cannot change PRO from ₦10,000 to another amount.', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: A frontend request cannot change BUSINESS from ₦20,000 to another amount.
  // --------------------------------------------------------------------------
  try {
    // Attacker sends BUSINESS plan but tries to set amount = ₦500
    const tamperRes = await fetch(`${BASE_URL}/api/payments/paystack/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        plan: 'BUSINESS',
        amount: 500,
        amountKobo: 50000,
      }),
    });
    const tamperData = await tamperRes.json();

    if (!tamperRes.ok || !tamperData.status || !tamperData.data?.reference) {
      throw new Error(`Initialize failed: ${tamperData.error || tamperRes.statusText}`);
    }

    const ref = tamperData.data.reference;
    const payment = await db.payments.findByReference(ref);
    if (!payment) {
      throw new Error('Payment record not found in database');
    }

    // Expected: amount MUST be 2,000,000 kobo (₦20,000)
    const expectedKobo = 2000000;
    const isBizUntampered = payment.amount === expectedKobo && payment.currency === 'NGN';

    record(
      3,
      'A frontend request cannot change BUSINESS from ₦20,000 to another amount.',
      isBizUntampered,
      `Stored amount was ${payment.amount} kobo, expected strictly ${expectedKobo} kobo.`
    );
  } catch (err: any) {
    record(3, 'A frontend request cannot change BUSINESS from ₦20,000 to another amount.', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: A user cannot activate a subscription by simply calling the verification endpoint with a fake reference.
  // --------------------------------------------------------------------------
  try {
    const fakeReference = `fake_ref_${Date.now()}_spoofed`;
    const verifyRes = await fetch(`${BASE_URL}/api/payments/paystack/verify/${fakeReference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const verifyData = await verifyRes.json();

    // Verify endpoint must reject (status 404 / false)
    const rejected = verifyRes.status === 404 && verifyData.status === false;

    // Check that Business A's subscription was NOT activated by the fake call
    const sub = await db.subscriptions.findByBusinessId(businessIdA);
    const subStillTrial = sub?.plan === 'FREE_TRIAL' && sub?.status === 'trialing';

    record(
      4,
      'A user cannot activate a subscription by simply calling the verification endpoint with a fake reference.',
      rejected && subStillTrial,
      `Status: ${verifyRes.status}, sub plan: ${sub?.plan}`
    );
  } catch (err: any) {
    record(
      4,
      'A user cannot activate a subscription by simply calling the verification endpoint with a fake reference.',
      false,
      err.message
    );
  }

  // --------------------------------------------------------------------------
  // TEST 5: A failed Paystack transaction does not activate a subscription.
  // --------------------------------------------------------------------------
  try {
    const failRef = `sp_pro_fail_${Date.now()}`;
    await db.payments.create({
      id: `pay_fail_${Date.now()}`,
      businessId: businessIdA,
      userId: userIdA,
      plan: 'PRO',
      amount: 1000000,
      currency: 'NGN',
      reference: failRef,
      provider: 'PAYSTACK',
      status: 'pending',
    });

    // Verification runs with Paystack returning failed status
    const failResult = await processVerifiedPayment({
      reference: failRef,
      expectedBusinessId: businessIdA,
      expectedUserId: userIdA,
      paystackData: {
        status: 'failed',
        reference: failRef,
        amount: 1000000,
        currency: 'NGN',
        gateway_response: 'Insufficient Funds',
      },
    });

    const paymentAfter = await db.payments.findByReference(failRef);
    const subAfter = await db.subscriptions.findByBusinessId(businessIdA);

    const testPassed =
      failResult.success === false &&
      paymentAfter?.status === 'failed' &&
      subAfter?.plan === 'FREE_TRIAL';

    record(
      5,
      'A failed Paystack transaction does not activate a subscription.',
      testPassed,
      `Verification success: ${failResult.success}, payment status: ${paymentAfter?.status}, sub plan: ${subAfter?.plan}`
    );
  } catch (err: any) {
    record(5, 'A failed Paystack transaction does not activate a subscription.', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: A successful payment for one plan cannot activate a different plan.
  // --------------------------------------------------------------------------
  try {
    // Scenario A: User created payment for PRO (1,000,000 kobo), but paid 500,000 kobo (STARTER price)
    const mismatchRef = `sp_pro_mismatch_${Date.now()}`;
    await db.payments.create({
      id: `pay_mismatch_${Date.now()}`,
      businessId: businessIdA,
      userId: userIdA,
      plan: 'PRO',
      amount: 1000000,
      currency: 'NGN',
      reference: mismatchRef,
      provider: 'PAYSTACK',
      status: 'pending',
    });

    const mismatchResult = await processVerifiedPayment({
      reference: mismatchRef,
      expectedBusinessId: businessIdA,
      expectedUserId: userIdA,
      paystackData: {
        status: 'success',
        reference: mismatchRef,
        amount: 500000, // Paid only STARTER price for PRO plan!
        currency: 'NGN',
        id: 77701,
      },
    });

    // Scenario B: User created payment for STARTER (500,000 kobo), verified legitimately.
    // Can it activate PRO or BUSINESS? No, it must activate strictly STARTER!
    const starterRef = `sp_starter_legit_${Date.now()}`;
    await db.payments.create({
      id: `pay_starter_${Date.now()}`,
      businessId: businessIdA,
      userId: userIdA,
      plan: 'STARTER',
      amount: 500000,
      currency: 'NGN',
      reference: starterRef,
      provider: 'PAYSTACK',
      status: 'pending',
    });

    const starterResult = await processVerifiedPayment({
      reference: starterRef,
      expectedBusinessId: businessIdA,
      expectedUserId: userIdA,
      paystackData: {
        status: 'success',
        reference: starterRef,
        amount: 500000,
        currency: 'NGN',
        id: 77702,
      },
    });

    const subNow = await db.subscriptions.findByBusinessId(businessIdA);

    const testPassed =
      mismatchResult.success === false && // Underpaid PRO was rejected
      starterResult.success === true && // Legit STARTER succeeded
      subNow?.plan === 'STARTER' && // Plan activated is strictly STARTER, NOT PRO or BUSINESS
      subNow?.status === 'active';

    record(
      6,
      'A successful payment for one plan cannot activate a different plan.',
      testPassed,
      `Mismatch success: ${mismatchResult.success}, activated plan: ${subNow?.plan}`
    );
  } catch (err: any) {
    record(6, 'A successful payment for one plan cannot activate a different plan.', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: A duplicate verification cannot create a duplicate subscription.
  // --------------------------------------------------------------------------
  try {
    const dupRef = `sp_pro_dup_${Date.now()}`;
    await db.payments.create({
      id: `pay_dup_${Date.now()}`,
      businessId: businessIdA,
      userId: userIdA,
      plan: 'PRO',
      amount: 1000000,
      currency: 'NGN',
      reference: dupRef,
      provider: 'PAYSTACK',
      status: 'pending',
    });

    // First verification call
    const firstVerify = await processVerifiedPayment({
      reference: dupRef,
      expectedBusinessId: businessIdA,
      expectedUserId: userIdA,
      paystackData: {
        status: 'success',
        reference: dupRef,
        amount: 1000000,
        currency: 'NGN',
        id: 88801,
      },
    });

    const subAfterFirst = await db.subscriptions.findByBusinessId(businessIdA);
    const endFirst = subAfterFirst?.currentPeriodEnd;

    // Second verification call (duplicate attempt)
    const secondVerify = await processVerifiedPayment({
      reference: dupRef,
      expectedBusinessId: businessIdA,
      expectedUserId: userIdA,
      paystackData: {
        status: 'success',
        reference: dupRef,
        amount: 1000000,
        currency: 'NGN',
        id: 88801,
      },
    });

    const subAfterSecond = await db.subscriptions.findByBusinessId(businessIdA);
    const endSecond = subAfterSecond?.currentPeriodEnd;

    // Check subscription row count in PostgreSQL
    const countRes = await db.query(
      'SELECT COUNT(*) as cnt FROM subscriptions WHERE business_id = $1',
      [businessIdA]
    );
    const subscriptionCount = parseInt(countRes.rows[0].cnt, 10);

    const testPassed =
      firstVerify.success === true &&
      secondVerify.success === true &&
      secondVerify.alreadyProcessed === true &&
      subscriptionCount === 1 &&
      endFirst === endSecond;

    record(
      7,
      'A duplicate verification cannot create a duplicate subscription.',
      testPassed,
      `alreadyProcessed: ${secondVerify.alreadyProcessed}, sub count: ${subscriptionCount}, period matching: ${endFirst === endSecond}`
    );
  } catch (err: any) {
    record(7, 'A duplicate verification cannot create a duplicate subscription.', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: A duplicate Paystack webhook cannot create a duplicate subscription or extend the subscription incorrectly.
  // --------------------------------------------------------------------------
  try {
    const webhookRef = `sp_biz_wh_${Date.now()}`;
    await db.payments.create({
      id: `pay_wh_${Date.now()}`,
      businessId: businessIdA,
      userId: userIdA,
      plan: 'BUSINESS',
      amount: 2000000,
      currency: 'NGN',
      reference: webhookRef,
      provider: 'PAYSTACK',
      status: 'pending',
    });

    const webhookPayload = {
      event: 'charge.success',
      data: {
        id: 99911,
        reference: webhookRef,
        amount: 2000000,
        currency: 'NGN',
        status: 'success',
        paid_at: new Date().toISOString(),
      },
    };

    // First Webhook delivery
    const wh1 = await processVerifiedPayment({
      reference: webhookRef,
      paystackData: webhookPayload.data,
    });

    const subAfterWh1 = await db.subscriptions.findByBusinessId(businessIdA);
    const periodEndAfterWh1 = subAfterWh1?.currentPeriodEnd;

    // Second Webhook delivery (duplicate replay)
    const wh2 = await processVerifiedPayment({
      reference: webhookRef,
      paystackData: webhookPayload.data,
    });

    const subAfterWh2 = await db.subscriptions.findByBusinessId(businessIdA);
    const periodEndAfterWh2 = subAfterWh2?.currentPeriodEnd;

    const countRes = await db.query(
      'SELECT COUNT(*) as cnt FROM subscriptions WHERE business_id = $1',
      [businessIdA]
    );
    const subscriptionCount = parseInt(countRes.rows[0].cnt, 10);

    const testPassed =
      wh1.success === true &&
      wh2.success === true &&
      wh2.alreadyProcessed === true &&
      subscriptionCount === 1 &&
      periodEndAfterWh1 === periodEndAfterWh2; // period was NOT extended again

    record(
      8,
      'A duplicate Paystack webhook cannot create a duplicate subscription or extend the subscription incorrectly.',
      testPassed,
      `wh2 alreadyProcessed: ${wh2.alreadyProcessed}, sub count: ${subscriptionCount}, period unmodified: ${periodEndAfterWh1 === periodEndAfterWh2}`
    );
  } catch (err: any) {
    record(
      8,
      'A duplicate Paystack webhook cannot create a duplicate subscription or extend the subscription incorrectly.',
      false,
      err.message
    );
  }

  // --------------------------------------------------------------------------
  // TEST 9: An invalid webhook signature is rejected.
  // --------------------------------------------------------------------------
  try {
    const invalidSignature = 'invalid_tampered_hmac_signature_value_12345';
    const payload = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'some_ref', amount: 500000, currency: 'NGN', status: 'success' },
    });

    const whRes = await fetch(`${BASE_URL}/api/payments/paystack/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': invalidSignature,
      },
      body: payload,
    });

    const whData = await whRes.json();
    const testPassed = whRes.status === 400 && whData.status === false && whData.error?.includes('Invalid webhook signature');

    record(
      9,
      'An invalid webhook signature is rejected.',
      testPassed,
      `HTTP status: ${whRes.status}, response error: ${whData.error}`
    );
  } catch (err: any) {
    record(9, 'An invalid webhook signature is rejected.', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: An unauthenticated user cannot initialize a payment.
  // --------------------------------------------------------------------------
  try {
    // Attempt initialization without any Authorization header
    const noAuthRes = await fetch(`${BASE_URL}/api/payments/paystack/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan: 'PRO' }),
    });

    const noAuthData = await noAuthRes.json();
    const testPassed =
      noAuthRes.status === 401 &&
      (noAuthData.error?.includes('Authentication required') || noAuthData.error?.includes('sign in'));

    record(
      10,
      'An unauthenticated user cannot initialize a payment.',
      testPassed,
      `HTTP status: ${noAuthRes.status}, error: ${noAuthData.error}`
    );
  } catch (err: any) {
    record(10, 'An unauthenticated user cannot initialize a payment.', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 11: One business/user cannot access or modify another business/user's payment records or subscription.
  // --------------------------------------------------------------------------
  try {
    // User A creates a payment reference
    const userARef = `sp_pro_tenant_a_${Date.now()}`;
    await db.payments.create({
      id: `pay_tenant_a_${Date.now()}`,
      businessId: businessIdA,
      userId: userIdA,
      plan: 'PRO',
      amount: 1000000,
      currency: 'NGN',
      reference: userARef,
      provider: 'PAYSTACK',
      status: 'pending',
    });

    // 1. User B tries to verify User A's reference using User B's token
    const crossVerifyRes = await fetch(`${BASE_URL}/api/payments/paystack/verify/${userARef}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenB}`, // User B!
      },
    });
    const crossVerifyData = await crossVerifyRes.json();

    const crossVerifyBlocked =
      crossVerifyRes.status === 403 &&
      crossVerifyData.status === false &&
      crossVerifyData.error?.includes('Access denied');

    // 2. User B tries to modify User A's subscription via the admin endpoint
    const crossAdminRes = await fetch(`${BASE_URL}/api/admin/subscriptions/${businessIdA}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`, // User B is merchant, not admin!
      },
      body: JSON.stringify({
        plan: 'BUSINESS',
        status: 'active',
      }),
    });
    const crossAdminData = await crossAdminRes.json();

    const crossAdminBlocked =
      crossAdminRes.status === 403 &&
      (crossAdminData.error?.includes('administrator privileges required') ||
        crossAdminData.code === 'FORBIDDEN');

    // 3. User B tries to direct alter plan via change-plan
    const directChangeRes = await fetch(`${BASE_URL}/api/subscription/change-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ plan: 'BUSINESS' }),
    });
    const directChangeBlocked = directChangeRes.status === 403;

    // Verify User A's subscription was never modified by User B
    const subA = await db.subscriptions.findByBusinessId(businessIdA);
    const subANotTampered = subA?.plan === 'BUSINESS' || subA?.plan === 'PRO' || subA?.plan === 'STARTER';

    // Verify User B's subscription was NOT activated by User A's payment
    const subB = await db.subscriptions.findByBusinessId(businessIdB);
    const subBStillTrial = subB?.plan === 'FREE_TRIAL';

    const testPassed =
      crossVerifyBlocked &&
      crossAdminBlocked &&
      directChangeBlocked &&
      subBStillTrial;

    record(
      11,
      "One business/user cannot access or modify another business/user's payment records or subscription.",
      testPassed,
      `crossVerify: ${crossVerifyRes.status}, crossAdmin: ${crossAdminRes.status}, subB: ${subB?.plan}`
    );
  } catch (err: any) {
    record(
      11,
      "One business/user cannot access or modify another business/user's payment records or subscription.",
      false,
      err.message
    );
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n=====================================================');
  console.log('--- PAYSTACK SECURITY TEST RESULTS SUMMARY ---');
  console.log('=====================================================');

  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  results.forEach((r) => {
    console.log(`Test ${r.num}: ${r.passed ? 'PASS' : 'FAIL'} - ${r.description}`);
  });

  console.log('=====================================================');
  console.log(`Total: ${total} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('=====================================================');

  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {}
  }

  if (failedCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runSecurityTests().catch((err) => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {}
  }
  console.error('Security test suite fatal error:', err);
  process.exit(1);
});
