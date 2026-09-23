/**
 * SellPilot Production Transactional Email Service
 *
 * Supported Providers:
 * 1. Resend API (Preferred for modern serverless / Render apps via RESEND_API_KEY)
 * 2. SMTP Provider via Nodemailer (SendGrid, Postmark, AWS SES, Brevo, or custom SMTP)
 * 3. Safe Development / Testing Fallback (when no external credentials are configured)
 *
 * Security:
 * - Tokens are generated using crypto.randomBytes(32)
 * - Only SHA-256 hashes are persisted in the database
 * - Raw tokens are NEVER exposed in production logs
 * - Strict rate limiting on email resend requests
 */

import crypto from 'crypto';
import nodemailer from 'nodemailer';

// --- CONFIGURATION ---
const TOKEN_EXPIRY_HOURS = 24;

export interface TokenGenerationResult {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Generates a cryptographically secure random token and its SHA-256 hash.
 */
export function generateVerificationToken(): TokenGenerationResult {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  return { rawToken, tokenHash, expiresAt };
}

/**
 * Computes the SHA-256 hash of a raw verification token.
 */
export function hashVerificationToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Resolves the public application URL for email links.
 * Priority: APP_URL env > reqOrigin > fallback
 */
export function getAppBaseUrl(reqOrigin?: string): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  if (reqOrigin && !reqOrigin.includes('localhost:3000')) {
    return reqOrigin.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

// --- RATE LIMITING ---
interface RateLimitRecord {
  lastRequestedAt: number;
  requestCountLastHour: number;
  firstRequestInHour: number;
}

const resendRateLimitMap = new Map<string, RateLimitRecord>();

/**
 * Checks whether an email or IP can request a verification email.
 * Limits:
 * - Minimum 60 seconds between resends
 * - Maximum 5 resends per hour
 */
export function checkEmailResendRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number; reason?: string } {
  const now = Date.now();
  const record = resendRateLimitMap.get(key.toLowerCase().trim());

  if (!record) {
    resendRateLimitMap.set(key.toLowerCase().trim(), {
      lastRequestedAt: now,
      requestCountLastHour: 1,
      firstRequestInHour: now,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // 1. Minimum 60-second cooldown check
  const secondsSinceLast = Math.floor((now - record.lastRequestedAt) / 1000);
  if (secondsSinceLast < 60) {
    return {
      allowed: false,
      retryAfterSeconds: 60 - secondsSinceLast,
      reason: `Please wait ${60 - secondsSinceLast}s before requesting another verification email.`,
    };
  }

  // 2. Hourly burst limit check
  const oneHour = 60 * 60 * 1000;
  if (now - record.firstRequestInHour > oneHour) {
    // Reset hourly window
    record.firstRequestInHour = now;
    record.requestCountLastHour = 1;
    record.lastRequestedAt = now;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (record.requestCountLastHour >= 5) {
    const retryAfter = Math.ceil((record.firstRequestInHour + oneHour - now) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, retryAfter),
      reason: 'Too many verification requests. Please try again in an hour.',
    };
  }

  record.lastRequestedAt = now;
  record.requestCountLastHour += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// --- EMAIL DISPATCH ---

export interface SendVerificationEmailParams {
  toEmail: string;
  userName: string;
  rawToken: string;
  reqOrigin?: string;
}

export interface EmailDispatchResult {
  success: boolean;
  provider: 'resend' | 'smtp' | 'simulated';
  messageId?: string;
  error?: string;
}

/**
 * Builds the HTML content for SellPilot verification email.
 */
function buildVerificationEmailHtml(name: string, verificationUrl: string): string {
  const safeName = name ? name.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Merchant';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your SellPilot account</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; }
    .container { max-width: 580px; margin: 0 auto; padding: 40px 20px; }
    .card { background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%); border: 1px solid #334155; border-radius: 16px; padding: 40px 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    .logo { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 28px; }
    .logo-badge { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #0d9488 0%, #10b981 100%); color: #ffffff; font-size: 20px; font-weight: 900; text-align: center; line-height: 36px; display: inline-block; }
    .logo-text { font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; vertical-align: middle; margin-left: 8px; }
    h1 { font-size: 24px; font-weight: 800; color: #ffffff; margin: 0 0 16px 0; line-height: 1.3; }
    p { font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0 0 20px 0; }
    .highlight { color: #38bdf8; font-weight: 600; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #059669 100%); color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 10px; box-shadow: 0 10px 15px -3px rgba(13, 148, 136, 0.4); }
    .link-fallback { background: #0b1120; border: 1px solid #1e293b; border-radius: 8px; padding: 14px; word-break: break-all; font-family: monospace; font-size: 12px; color: #38bdf8; margin: 24px 0; }
    .divider { border-top: 1px solid #334155; margin: 32px 0 24px 0; }
    .footer { text-align: center; font-size: 12px; color: #64748b; line-height: 1.5; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; background: rgba(13, 148, 136, 0.15); border: 1px solid rgba(13, 148, 136, 0.3); color: #2dd4bf; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <span class="logo-badge">₦</span>
        <span class="logo-text">SellPilot</span>
      </div>

      <div><span class="badge">Account Verification</span></div>

      <h1>Confirm your email address</h1>

      <p>Hello <strong>${safeName}</strong>,</p>

      <p>Welcome to SellPilot! Before you start automating your Instagram & WhatsApp sales and accepting customer orders, please confirm that this is your email address.</p>

      <div class="btn-container">
        <a href="${verificationUrl}" target="_blank" rel="noopener noreferrer" class="btn">
          Verify My Email Address →
        </a>
      </div>

      <p style="font-size: 13px; color: #64748b;">
        Or copy and paste this verification URL into your browser:
      </p>
      <div class="link-fallback">${verificationUrl}</div>

      <p style="font-size: 13px; color: #94a3b8;">
        ⏳ <strong>Security Note:</strong> This link will expire in <strong>24 hours</strong>. If you did not create a SellPilot account, no action is needed — you can safely ignore this email.
      </p>

      <div class="divider"></div>

      <div class="footer">
        <p style="margin: 0 0 6px 0;">SellPilot — Nigerian Social Commerce Automation</p>
        <p style="margin: 0; color: #475569;">Lagos, Nigeria • Secure Cloud Infrastructure</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function buildVerificationEmailText(name: string, verificationUrl: string): string {
  const safeName = name || 'Merchant';
  return `
Hello ${safeName},

Welcome to SellPilot!

Please verify your email address to activate your account and access your merchant dashboard:

${verificationUrl}

This link is valid for 24 hours.

If you did not sign up for SellPilot, please disregard this email.

---
SellPilot — Social Commerce Automation for Nigerian Merchants
  `.trim();
}

/**
 * Sends a verification email using the configured email provider.
 * Supports: Resend API > SMTP > Simulated (development)
 */
export async function sendVerificationEmail(params: SendVerificationEmailParams): Promise<EmailDispatchResult> {
  const { toEmail, userName, rawToken, reqOrigin } = params;
  const baseUrl = getAppBaseUrl(reqOrigin);
  const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
  const subject = 'Verify your SellPilot account';
  const html = buildVerificationEmailHtml(userName, verificationUrl);
  const text = buildVerificationEmailText(userName, verificationUrl);

  // 1. OPTION A: RESEND REST API
  if (process.env.RESEND_API_KEY) {
    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'SellPilot <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject,
          html,
          text,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('[EmailService] Resend API error:', res.status, errorData);
        return {
          success: false,
          provider: 'resend',
          error: errorData.message || `Resend API failed with status ${res.status}`,
        };
      }

      const data: any = await res.json();
      console.log(`[EmailService] Verification email sent to ${toEmail} via Resend. Message ID: ${data?.id}`);
      return {
        success: true,
        provider: 'resend',
        messageId: data?.id,
      };
    } catch (err: any) {
      console.error('[EmailService] Failed to send via Resend:', err?.message || err);
      return {
        success: false,
        provider: 'resend',
        error: err?.message || 'Failed to dispatch email via Resend',
      };
    }
  }

  // 2. OPTION B: SMTP (Nodemailer)
  if (process.env.SMTP_HOST) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      });

      const fromEmail = process.env.SMTP_FROM || 'SellPilot <no-reply@sellpilot.ng>';
      const info = await transporter.sendMail({
        from: fromEmail,
        to: toEmail,
        subject,
        html,
        text,
      });

      console.log(`[EmailService] Verification email sent to ${toEmail} via SMTP. Message ID: ${info.messageId}`);
      return {
        success: true,
        provider: 'smtp',
        messageId: info.messageId,
      };
    } catch (err: any) {
      console.error('[EmailService] Failed to send via SMTP:', err?.message || err);
      return {
        success: false,
        provider: 'smtp',
        error: err?.message || 'Failed to dispatch email via SMTP',
      };
    }
  }

  // 3. OPTION C: SIMULATED (Development / CI / Prototyping)
  // When no production provider credentials are set, simulate cleanly.
  // In development, log the URL safely so developer can test.
  // In production, do not log raw token.
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    console.log(`[EmailService] [DEV SIMULATION] Verification email dispatched to: ${toEmail}`);
    console.log(`[EmailService] [DEV SIMULATION] Action URL: ${verificationUrl}`);
  } else {
    console.warn(`[EmailService] No email provider configured (RESEND_API_KEY or SMTP_HOST missing). Verification email simulation recorded for ${toEmail}.`);
  }

  return {
    success: true,
    provider: 'simulated',
    messageId: `sim_${Date.now()}`,
  };
}
