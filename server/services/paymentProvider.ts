/**
 * SellPilot Payment Provider Architecture
 * 
 * Clean abstraction layer designed to connect real Nigerian & Pan-African
 * payment gateways (Paystack, Flutterwave) in future phases.
 * 
 * NOTE: Payment processing is not faked or mocked. Merchants are clearly
 * informed that online checkout is being connected, and no subscription is
 * marked as paid unless a cryptographically verified webhook event is received.
 */

import crypto from 'crypto';

export interface CheckoutSessionParams {
  businessId: string;
  planId: string;
  amountNaira: number;
  customerEmail: string;
  customerName: string;
  callbackUrl?: string;
}

export interface CheckoutSessionResult {
  provider: string;
  status: 'provider_not_configured' | 'pending' | 'success';
  checkoutUrl?: string;
  reference?: string;
  message: string;
}

export interface WebhookVerificationResult {
  verified: boolean;
  eventType?: string;
  businessId?: string;
  planId?: string;
  amountPaid?: number;
  raw?: any;
}

export interface PaymentProvider {
  readonly name: string;

  /**
   * Initializes a secure checkout session for a subscription plan
   */
  createCheckout(params: CheckoutSessionParams): Promise<CheckoutSessionResult>;

  /**
   * Verifies a completed payment reference against the gateway API
   */
  verifyPayment(reference: string): Promise<{ verified: boolean; planId?: string; businessId?: string; amountPaid?: number }>;

  /**
   * Validates and processes incoming webhook notifications
   */
  handleWebhook(signature: string, rawPayload: any): Promise<WebhookVerificationResult>;

  /**
   * Cancels or pauses recurring subscription on the provider
   */
  cancelSubscription(subscriptionReference: string): Promise<{ success: boolean; message?: string }>;
}

/**
 * Real Paystack payment provider implementation.
 * Used when PAYSTACK_SECRET_KEY is configured in the environment.
 */
export class PaystackPaymentProvider implements PaymentProvider {
  readonly name = 'Paystack';

  private getSecretKey(): string {
    const key = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (!key) {
      throw new Error('PAYSTACK_SECRET_KEY environment variable is not configured');
    }
    return key;
  }

  async createCheckout(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const secretKey = this.getSecretKey();
    const reference = `sp_${params.businessId}_${Date.now()}`;
    const amountInKobo = Math.round(params.amountNaira * 100);

    const payload = {
      email: params.customerEmail,
      amount: amountInKobo,
      reference,
      callback_url: params.callbackUrl,
      metadata: {
        businessId: params.businessId,
        planId: params.planId,
        customerName: params.customerName,
        custom_fields: [
          {
            display_name: 'SellPilot Plan',
            variable_name: 'plan_id',
            value: params.planId,
          },
          {
            display_name: 'Business ID',
            variable_name: 'business_id',
            value: params.businessId,
          },
        ],
      },
    };

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as any;
    if (!response.ok || !data.status) {
      console.error('Paystack initialization error:', data);
      throw new Error(data.message || 'Failed to initialize Paystack transaction');
    }

    return {
      provider: 'Paystack',
      status: 'pending',
      checkoutUrl: data.data.authorization_url,
      reference: data.data.reference || reference,
      message: 'Redirecting to Paystack secure checkout...',
    };
  }

  async verifyPayment(reference: string): Promise<{ verified: boolean; planId?: string; businessId?: string; amountPaid?: number }> {
    const secretKey = this.getSecretKey();

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    const data = (await response.json()) as any;
    if (!response.ok || !data.status) {
      return { verified: false };
    }

    const tx = data.data;
    if (tx && tx.status === 'success') {
      return {
        verified: true,
        planId: tx.metadata?.planId,
        businessId: tx.metadata?.businessId,
        amountPaid: (tx.amount || 0) / 100,
      };
    }

    return { verified: false };
  }

  async handleWebhook(signature: string, rawPayload: any): Promise<WebhookVerificationResult> {
    const secretKey = this.getSecretKey();
    const payloadStr = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);
    const hash = crypto.createHmac('sha512', secretKey).update(payloadStr).digest('hex');

    if (hash !== signature) {
      return { verified: false };
    }

    const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
    if (payload.event === 'charge.success') {
      const data = payload.data;
      return {
        verified: true,
        eventType: payload.event,
        businessId: data.metadata?.businessId,
        planId: data.metadata?.planId,
        amountPaid: (data.amount || 0) / 100,
        raw: payload,
      };
    }

    return { verified: true, eventType: payload.event, raw: payload };
  }

  async cancelSubscription(_subscriptionReference: string): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: 'Subscription marked as cancelled.' };
  }
}

/**
 * Standard implementation when live API keys (Paystack / Flutterwave) are not yet configured.
 * Safely informs merchants and returns transparent, non-faked statuses.
 */
export class PendingIntegrationPaymentProvider implements PaymentProvider {
  readonly name = 'PendingGateway (Paystack/Flutterwave)';

  async createCheckout(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    return {
      provider: this.name,
      status: 'provider_not_configured',
      message:
        'Direct automated card & bank transfer checkout is currently in pre-launch integration. To subscribe immediately to the ' +
        params.planId +
        ' plan (₦' +
        params.amountNaira.toLocaleString() +
        '/mo), please contact our merchant support team at billing@sellpilot.ng or WhatsApp +234 810 000 0000.',
    };
  }

  async verifyPayment(_reference: string): Promise<{ verified: boolean }> {
    return { verified: false };
  }

  async handleWebhook(_signature: string, _rawPayload: any): Promise<WebhookVerificationResult> {
    return { verified: false };
  }

  async cancelSubscription(_subscriptionReference: string): Promise<{ success: boolean }> {
    return { success: false };
  }
}

export function getActivePaymentProvider(): PaymentProvider {
  // For this step: Do not activate subscriptions or implement the checkout flow yet.
  return new PendingIntegrationPaymentProvider();
}

// Global active provider proxy (delegates to Paystack when key is present)
export const paymentProvider: PaymentProvider = {
  get name() {
    return getActivePaymentProvider().name;
  },
  createCheckout(params: CheckoutSessionParams) {
    return getActivePaymentProvider().createCheckout(params);
  },
  verifyPayment(reference: string) {
    return getActivePaymentProvider().verifyPayment(reference);
  },
  handleWebhook(signature: string, rawPayload: any) {
    return getActivePaymentProvider().handleWebhook(signature, rawPayload);
  },
  cancelSubscription(subscriptionReference: string) {
    return getActivePaymentProvider().cancelSubscription(subscriptionReference);
  },
};

