/**
 * Paystack Payment Verification & Subscription Activation Service
 *
 * Implements strict, server-authoritative payment verification,
 * atomic database transactions, idempotency guarantees, and
 * multi-tenant security isolation.
 */

import { withTransaction } from '../db/pool';
import { paystackService } from './paystackService';
import { PaymentRecord, Subscription, SubscriptionPlanId, SubscriptionStatus } from '../../src/types';

export const EXPECTED_PLAN_PRICES_KOBO: Record<string, number> = {
  STARTER: 500000,   // ₦5,000 = 500,000 kobo
  PRO: 1000000,      // ₦10,000 = 1,000,000 kobo
  BUSINESS: 2000000, // ₦20,000 = 2,000,000 kobo
};

export interface ProcessPaymentParams {
  reference: string;
  paystackData?: any;
  expectedBusinessId?: string;
  expectedUserId?: string;
}

export interface ProcessPaymentResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  alreadyProcessed?: boolean;
  payment?: PaymentRecord;
  subscription?: Subscription;
  message?: string;
}

function safeJsonParse<T>(val: any, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function mapPaymentRow(r: any): PaymentRecord {
  return {
    id: r.id,
    businessId: r.business_id,
    userId: r.user_id,
    plan: r.plan as SubscriptionPlanId,
    amount: Number(r.amount),
    currency: r.currency,
    reference: r.reference,
    provider: r.provider,
    status: r.status,
    authorizationUrl: r.authorization_url,
    accessCode: r.access_code,
    metadata: safeJsonParse(r.metadata, {}),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

function mapSubscriptionRow(r: any): Subscription {
  return {
    id: r.id,
    businessId: r.business_id,
    plan: (r.plan as SubscriptionPlanId) || 'FREE_TRIAL',
    status: (r.status as SubscriptionStatus) || 'trialing',
    trialStartedAt: r.trial_started_at ? new Date(r.trial_started_at).toISOString() : null,
    trialEndsAt: r.trial_ends_at ? new Date(r.trial_ends_at).toISOString() : null,
    currentPeriodStart: r.current_period_start ? new Date(r.current_period_start).toISOString() : new Date().toISOString(),
    currentPeriodEnd: r.current_period_end ? new Date(r.current_period_end).toISOString() : new Date().toISOString(),
    cancelledAt: r.cancelled_at ? new Date(r.cancelled_at).toISOString() : null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Single, unified server-side function to process verified Paystack payments.
 * Shared by both the GET /api/payments/paystack/verify/:reference endpoint
 * and the POST /api/payments/paystack/webhook event receiver.
 *
 * Enforces:
 * 1. Atomicity: Database transaction wrapping payment update + subscription activation.
 * 2. Idempotency: Duplicate calls on already-successful payments return the existing record
 *    without re-extending periods or creating duplicates.
 * 3. Multi-Tenant Security: Validates business/user ownership when expected ids are supplied.
 * 4. Data Validation: Direct verification with Paystack, status === 'success', currency === 'NGN',
 *    and exact expected Kobo price match.
 */
export async function processVerifiedPayment(params: {
  reference: string;
  paystackData?: any;
  expectedBusinessId?: string;
  expectedUserId?: string;
}): Promise<ProcessPaymentResult> {
  const { reference, expectedBusinessId, expectedUserId } = params;

  if (!reference || typeof reference !== 'string') {
    return {
      success: false,
      error: 'Payment reference is required.',
      statusCode: 400,
    };
  }

  // Execute within an atomic database transaction
  return await withTransaction(async (client) => {
    // 1. Fetch pending payment record with row-level lock (FOR UPDATE)
    const payRes = await client.query(
      'SELECT * FROM payments WHERE reference = $1 FOR UPDATE',
      [reference]
    );

    if (payRes.rows.length === 0) {
      return {
        success: false,
        error: `Payment reference '${reference}' not found in SellPilot records.`,
        statusCode: 404,
      };
    }

    const paymentRow = payRes.rows[0];

    // 2. IDEMPOTENCY CHECK
    // If already marked as 'success', do not re-process or re-extend
    if (paymentRow.status === 'success') {
      const subRes = await client.query(
        'SELECT * FROM subscriptions WHERE business_id = $1',
        [paymentRow.business_id]
      );
      return {
        success: true,
        alreadyProcessed: true,
        message: 'Payment has already been successfully verified and subscription activated.',
        payment: mapPaymentRow(paymentRow),
        subscription: subRes.rows.length > 0 ? mapSubscriptionRow(subRes.rows[0]) : undefined,
      };
    }

    // 3. MULTI-TENANT OWNERSHIP VERIFICATION
    if (expectedBusinessId && paymentRow.business_id !== expectedBusinessId) {
      return {
        success: false,
        error: 'Access denied: Payment record does not belong to your business account.',
        statusCode: 403,
      };
    }

    if (expectedUserId && paymentRow.user_id !== expectedUserId) {
      return {
        success: false,
        error: 'Access denied: Payment record does not belong to your user account.',
        statusCode: 403,
      };
    }

    // 4. VERIFY WITH PAYSTACK GATEWAY
    // Use supplied paystackData (e.g. from cryptographically validated webhook)
    // or query the Paystack API directly using PAYSTACK_SECRET_KEY
    let txData = params.paystackData;
    if (!txData) {
      const verifyRes = await paystackService.verifyTransaction(reference);
      if (!verifyRes.status || !verifyRes.data) {
        await client.query(
          `UPDATE payments
           SET status = 'failed',
               metadata = metadata || $1::jsonb,
               updated_at = NOW()
           WHERE reference = $2`,
          [
            JSON.stringify({ failureReason: verifyRes.message || 'Verification API call failed' }),
            reference,
          ]
        );
        return {
          success: false,
          error: verifyRes.message || 'Unable to verify transaction with Paystack gateway.',
          statusCode: 400,
        };
      }
      txData = verifyRes.data;
    }

    // 5. TRANSACTION STATUS CHECK
    if (txData.status !== 'success') {
      await client.query(
        `UPDATE payments
         SET status = 'failed',
             metadata = metadata || $1::jsonb,
             updated_at = NOW()
         WHERE reference = $2`,
        [
          JSON.stringify({
            failureReason: `Transaction status is '${txData.status}', expected 'success'`,
          }),
          reference,
        ]
      );
      return {
        success: false,
        error: `Payment failed or incomplete. Gateway status: '${txData.status}'.`,
        statusCode: 400,
      };
    }

    // 6. REFERENCE MATCH CHECK
    if (txData.reference && txData.reference !== reference) {
      return {
        success: false,
        error: 'Payment reference mismatch with gateway record.',
        statusCode: 400,
      };
    }

    // 7. CURRENCY CHECK (Must strictly be NGN)
    const currency = (txData.currency || '').toUpperCase();
    if (currency !== 'NGN') {
      await client.query(
        `UPDATE payments
         SET status = 'failed',
             metadata = metadata || $1::jsonb,
             updated_at = NOW()
         WHERE reference = $2`,
        [
          JSON.stringify({ failureReason: `Invalid currency: '${currency}', expected 'NGN'` }),
          reference,
        ]
      );
      return {
        success: false,
        error: `Invalid payment currency '${currency}'. SellPilot subscriptions require NGN.`,
        statusCode: 400,
      };
    }

    // 8. EXACT AMOUNT CHECK (Compare Kobo against expected plan price)
    const plan = paymentRow.plan as string;
    const expectedKobo = EXPECTED_PLAN_PRICES_KOBO[plan];
    if (!expectedKobo) {
      return {
        success: false,
        error: `Unrecognized plan '${plan}' on payment record.`,
        statusCode: 400,
      };
    }

    const actualKobo = Number(txData.amount);
    if (actualKobo !== expectedKobo) {
      await client.query(
        `UPDATE payments
         SET status = 'failed',
             metadata = metadata || $1::jsonb,
             updated_at = NOW()
         WHERE reference = $2`,
        [
          JSON.stringify({
            failureReason: `Amount mismatch: paid ${actualKobo} kobo, expected ${expectedKobo} kobo for ${plan}`,
          }),
          reference,
        ]
      );
      return {
        success: false,
        error: `Payment amount mismatch. Paid ${actualKobo} kobo, but expected ${expectedKobo} kobo for ${plan} plan.`,
        statusCode: 400,
      };
    }

    // 9. ALL CHECKS PASSED -> ATOMICALLY MARK PAYMENT AS SUCCESSFUL
    const updatedPayRes = await client.query(
      `UPDATE payments
       SET status = 'success',
           metadata = metadata || $1::jsonb,
           updated_at = NOW()
       WHERE reference = $2
       RETURNING *`,
      [
        JSON.stringify({
          verifiedAt: new Date().toISOString(),
          paystackTransactionId: txData.id,
          channel: txData.channel,
          paidAt: txData.paid_at,
          customerEmail: txData.customer?.email,
        }),
        reference,
      ]
    );
    const updatedPayment = mapPaymentRow(updatedPayRes.rows[0]);

    // 10. ATOMICALLY ACTIVATE / EXTEND USER SUBSCRIPTION
    const subRes = await client.query(
      'SELECT * FROM subscriptions WHERE business_id = $1',
      [paymentRow.business_id]
    );
    const existingSub = subRes.rows.length > 0 ? subRes.rows[0] : null;

    const now = new Date();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    let periodStart = now;
    let periodEnd = new Date(now.getTime() + thirtyDaysMs);

    // If currently active and period end is still in the future, extend from current end
    if (existingSub && existingSub.status === 'active' && existingSub.current_period_end) {
      const existingEnd = new Date(existingSub.current_period_end);
      if (existingEnd.getTime() > now.getTime()) {
        periodStart = existingSub.current_period_start ? new Date(existingSub.current_period_start) : now;
        periodEnd = new Date(existingEnd.getTime() + thirtyDaysMs);
      }
    }

    const subId = existingSub?.id || `sub_${paymentRow.business_id}_${Date.now()}`;

    const upsertSubRes = await client.query(
      `INSERT INTO subscriptions (
        id, business_id, plan, status, trial_started_at, trial_ends_at,
        current_period_start, current_period_end, cancelled_at, created_at, updated_at
      ) VALUES ($1, $2, $3, 'active', NULL, NULL, $4, $5, NULL, NOW(), NOW())
      ON CONFLICT (business_id) DO UPDATE SET
        plan = EXCLUDED.plan,
        status = 'active',
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        cancelled_at = NULL,
        updated_at = NOW()
      RETURNING *`,
      [
        subId,
        paymentRow.business_id,
        plan,
        periodStart.toISOString(),
        periodEnd.toISOString(),
      ]
    );

    const updatedSub = mapSubscriptionRow(upsertSubRes.rows[0]);

    return {
      success: true,
      alreadyProcessed: false,
      message: `Payment verified and ${plan} plan activated successfully.`,
      payment: updatedPayment,
      subscription: updatedSub,
    };
  });
}
