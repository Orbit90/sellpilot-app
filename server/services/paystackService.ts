/**
 * Paystack Integration Service (Server-side Only)
 * 
 * Secure wrapper for Paystack API operations.
 * CRITICAL SECURITY INSTRUCTIONS:
 * - This file executes ONLY in the Node.js server environment.
 * - PAYSTACK_SECRET_KEY is NEVER logged, printed, or sent to client/browser.
 * - Configuration checks only return boolean status / mode ('test' | 'live').
 */

import crypto from 'crypto';

export interface PaystackConfigStatus {
  isConfigured: boolean;
  mode: 'test' | 'live' | 'unconfigured';
  provider: 'Paystack';
}

export interface PaystackInitParams {
  email: string;
  amountInKobo: number;
  reference: string;
  currency?: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

export interface PaystackInitResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    id: number;
    status: string;
    reference: string;
    amount: number;
    currency: string;
    channel: string;
    paid_at: string;
    metadata?: Record<string, any>;
    customer?: {
      email: string;
    };
  };
}

export class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';

  /**
   * Safely checks whether PAYSTACK_SECRET_KEY is configured in the environment.
   * Does NOT leak or return the key.
   */
  public isConfigured(): boolean {
    const key = process.env.PAYSTACK_SECRET_KEY;
    return Boolean(key && key.trim().length > 0);
  }

  /**
   * Returns non-sensitive status about the Paystack configuration.
   * Safe to call from server health checks or admin status queries.
   */
  public getStatus(): PaystackConfigStatus {
    const key = process.env.PAYSTACK_SECRET_KEY?.trim() || '';
    if (!key) {
      return {
        isConfigured: false,
        mode: 'unconfigured',
        provider: 'Paystack',
      };
    }

    const mode = key.startsWith('sk_live_')
      ? 'live'
      : key.startsWith('sk_test_')
      ? 'test'
      : 'test';

    return {
      isConfigured: true,
      mode,
      provider: 'Paystack',
    };
  }

  /**
   * Internal getter that safely retrieves the key for server-side HTTP calls only.
   * Throws a safe generic error if the key is missing, without logging anything sensitive.
   */
  private getSecretKey(): string {
    const key = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (!key) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured on the server.');
    }
    return key;
  }

  /**
   * Initializes a Paystack transaction.
   * Ready for future checkout steps; not called until checkout flow is enabled.
   */
  public async initializeTransaction(params: PaystackInitParams): Promise<PaystackInitResponse> {
    const secretKey = this.getSecretKey();

    try {
      const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: params.email,
          amount: params.amountInKobo,
          reference: params.reference,
          currency: params.currency || 'NGN',
          callback_url: params.callbackUrl,
          metadata: params.metadata,
        }),
      });

      const data = (await response.json()) as PaystackInitResponse;
      return data;
    } catch (err: any) {
      // Safe error handling: never rethrow or log secret keys or headers
      return {
        status: false,
        message: err?.message ? `Paystack gateway communication error: ${err.message}` : 'Payment gateway communication error',
      };
    }
  }

  /**
   * Verifies a transaction by reference with the Paystack API.
   * Ready for future payment confirmation; not called until payment flow is enabled.
   */
  public async verifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
    const secretKey = this.getSecretKey();

    try {
      const response = await fetch(`${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      });

      const data = (await response.json()) as PaystackVerifyResponse;
      return data;
    } catch (err: any) {
      return {
        status: false,
        message: err?.message ? `Paystack verification gateway error: ${err.message}` : 'Payment verification gateway error',
      };
    }
  }

  /**
   * Validates Paystack webhook HMAC-SHA512 signature.
   * Cryptographically verifies the payload using constant-time comparison
   * without exposing any secrets.
   */
  public verifyWebhookSignature(signature: string, rawBody: string | Buffer): boolean {
    try {
      const secretKey = this.getSecretKey();
      const hash = crypto
        .createHmac('sha512', secretKey)
        .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
        .digest('hex');

      const hashBuffer = Buffer.from(hash, 'utf8');
      const sigBuffer = Buffer.from(signature, 'utf8');

      if (hashBuffer.length !== sigBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(hashBuffer, sigBuffer);
    } catch {
      return false;
    }
  }
}

export const paystackService = new PaystackService();
