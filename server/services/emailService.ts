/**
 * SellPilot Production Transactional Email Service
 *
 * Email Delivery Provider:
 * - Exclusively Gmail SMTP via Nodemailer
 * - Strict SSL/TLS configuration (Default: smtp.gmail.com:465)
 * - Required Environment Variables:
 *   - GMAIL_SMTP_HOST
 *   - GMAIL_SMTP_PORT
 *   - GMAIL_SMTP_SECURE
 *   - GMAIL_SMTP_USER
 *   - GMAIL_SMTP_PASS (Google App Password)
 *   - GMAIL_FROM_EMAIL
 *
 * Security:
 * - Tokens are cryptographically random (crypto.randomBytes(32))
 * - Only SHA-256 hashes are persisted in the database
 * - Raw tokens and passwords are NEVER exposed in logs
 * - GMAIL_SMTP_PASS is kept strictly server-side
 * - NO mock or simulation fallbacks in production: returns clear configuration error if unconfigured
 */

import crypto from 'crypto';
import nodemailer, { type Transporter } from 'nodemailer';

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
 * Strictly guarantees neither localhost nor sellpilot.com is used.
 */
export function getAppBaseUrl(reqOrigin?: string): string {
  // 1. Priority: APP_URL environment variable
  let envUrl = process.env.APP_URL?.trim();
  if (envUrl) {
    envUrl = envUrl.replace(/\/+$/, '');
    if (!envUrl.includes('localhost') && !envUrl.includes('127.0.0.1') && !envUrl.includes('sellpilot.com')) {
      return envUrl;
    }
  }

  // 2. Origin header from incoming request (if from a non-localhost, valid domain)
  if (reqOrigin) {
    const origin = reqOrigin.trim().replace(/\/+$/, '');
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1') && !origin.includes('sellpilot.com')) {
      return origin;
    }
  }

  // 3. Fallback: must NEVER be localhost or sellpilot.com
  return 'https://sellpilot.ng';
}

// --- RATE LIMITING ---
interface RateLimitRecord {
  lastRequestedAt: number;
  requestCountLastHour: number;
  firstRequestInHour: number;
}

const emailResendRateLimitMap = new Map<string, RateLimitRecord>();

/**
 * Checks whether an email or IP can request a verification email re-send.
 * Limits:
 * - Minimum 60 seconds between resends
 * - Maximum 5 resends per hour
 */
export function checkEmailResendRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number; reason?: string } {
  const now = Date.now();
  const normalizedKey = key.toLowerCase().trim();
  const record = emailResendRateLimitMap.get(normalizedKey);

  if (!record) {
    emailResendRateLimitMap.set(normalizedKey, {
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

// --- GMAIL SMTP CONFIGURATION & DIAGNOSTICS ---

export interface GmailSmtpStatus {
  configured: boolean;
  missing: string[];
  host: string;
  port: number;
  secure: boolean;
  userConfigured: boolean;
  passConfigured: boolean;
  fromEmail?: string;
}

/**
 * Returns configuration diagnostics for Gmail SMTP.
 * Never leaks the App Password.
 */
export function getGmailSmtpStatus(): GmailSmtpStatus {
  const host = process.env.GMAIL_SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = parseInt(process.env.GMAIL_SMTP_PORT?.trim() || '465', 10);
  const secure = process.env.GMAIL_SMTP_SECURE ? process.env.GMAIL_SMTP_SECURE.trim() === 'true' : port === 465;
  const user = process.env.GMAIL_SMTP_USER?.trim();
  const pass = process.env.GMAIL_SMTP_PASS?.trim();
  const fromEmail = process.env.GMAIL_FROM_EMAIL?.trim();

  const missing: string[] = [];
  if (!user) missing.push('GMAIL_SMTP_USER');
  if (!pass) missing.push('GMAIL_SMTP_PASS');

  return {
    configured: missing.length === 0,
    missing,
    host,
    port,
    secure,
    userConfigured: !!user,
    passConfigured: !!pass,
    fromEmail: fromEmail || user,
  };
}

/**
 * Resolves the sender email address from GMAIL_FROM_EMAIL or GMAIL_SMTP_USER.
 */
function getSenderAddress(): string {
  const customFrom = process.env.GMAIL_FROM_EMAIL?.trim();
  const smtpUser = process.env.GMAIL_SMTP_USER?.trim();

  if (customFrom) {
    if (customFrom.includes('<') && customFrom.includes('>')) {
      return customFrom;
    }
    return `SellPilot <${customFrom}>`;
  }

  if (smtpUser) {
    return `SellPilot <${smtpUser}>`;
  }

  return 'SellPilot <no-reply@sellpilot.ng>';
}

/**
 * Creates a secure Nodemailer transporter configured strictly for Gmail SMTP.
 * Enforces TLS 1.2+ minimum.
 * Returns null if required credentials (GMAIL_SMTP_USER, GMAIL_SMTP_PASS) are missing.
 */
function createGmailTransporter(): { transporter: Transporter | null; missing: string[] } {
  const host = process.env.GMAIL_SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = parseInt(process.env.GMAIL_SMTP_PORT?.trim() || '465', 10);
  const secure = process.env.GMAIL_SMTP_SECURE ? process.env.GMAIL_SMTP_SECURE.trim() === 'true' : port === 465;
  const user = process.env.GMAIL_SMTP_USER?.trim();
  const pass = process.env.GMAIL_SMTP_PASS?.trim();

  const missing: string[] = [];
  if (!user) missing.push('GMAIL_SMTP_USER');
  if (!pass) missing.push('GMAIL_SMTP_PASS');

  if (missing.length > 0) {
    return { transporter: null, missing };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    },
  });

  return { transporter, missing: [] };
}

// --- EMAIL DISPATCH ---

export interface SendVerificationEmailParams {
  toEmail: string;
  userName: string;
  rawToken: string;
  reqOrigin?: string;
}

export interface SendPasswordResetEmailParams {
  toEmail: string;
  userName: string;
  resetToken: string;
  reqOrigin?: string;
}

export interface EmailDispatchResult {
  success: boolean;
  provider: 'gmail_smtp';
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
 * Sends a verification email via Gmail SMTP.
 * Returns a clear error if Gmail SMTP is not configured (no simulation in production).
 */
export async function sendVerificationEmail(params: SendVerificationEmailParams): Promise<EmailDispatchResult> {
  const { toEmail, userName, rawToken, reqOrigin } = params;
  const baseUrl = getAppBaseUrl(reqOrigin);
  const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
  const subject = 'Verify your SellPilot account';
  const html = buildVerificationEmailHtml(userName, verificationUrl);
  const text = buildVerificationEmailText(userName, verificationUrl);
  const from = getSenderAddress();

  const { transporter, missing } = createGmailTransporter();

  // If Gmail SMTP credentials are not configured, reject with clear configuration error
  if (!transporter) {
    const errorMsg = `[EmailService] Gmail SMTP is not configured (missing environment variables: ${missing.join(', ')}). Verification email was not sent to ${toEmail}.`;
    console.error(errorMsg);
    return {
      success: false,
      provider: 'gmail_smtp',
      error: `Gmail SMTP configuration missing: ${missing.join(', ')}`,
    };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: toEmail,
      subject,
      html,
      text,
    });

    console.log(`[EmailService] Verification email sent to ${toEmail} via Gmail SMTP. Message ID: ${info.messageId}`);
    return {
      success: true,
      provider: 'gmail_smtp',
      messageId: info.messageId,
    };
  } catch (err: any) {
    // CRITICAL SECURITY: Never print or leak passwords or SMTP credentials to logs
    const safeErrMessage = err?.message
      ? String(err.message).replace(/(pass|auth|key|password)=[^&\s]+/gi, '$1=[REDACTED]')
      : 'SMTP error';
    console.error('[EmailService] Failed to send email via Gmail SMTP:', safeErrMessage);
    return {
      success: false,
      provider: 'gmail_smtp',
      error: `Failed to dispatch email via Gmail SMTP: ${safeErrMessage}`,
    };
  }
}

/**
 * Sends a password reset email using Gmail SMTP.
 * Returns a clear error if Gmail SMTP is not configured.
 */
export async function sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<EmailDispatchResult> {
  const { toEmail, userName, resetToken, reqOrigin } = params;
  const baseUrl = getAppBaseUrl(reqOrigin);
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const subject = 'Reset your SellPilot password';
  const safeName = userName ? userName.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Merchant';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Reset your SellPilot password</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc; }
    .container { max-width: 580px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #0f172a; border: 1px solid #334155; border-radius: 16px; padding: 40px 32px; }
    .btn { display: inline-block; background: #0d9488; color: #ffffff !important; text-decoration: none; font-weight: 700; padding: 14px 28px; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h2>Reset Password Request</h2>
      <p>Hello <strong>${safeName}</strong>,</p>
      <p>We received a request to reset your password for your SellPilot merchant account.</p>
      <p><a href="${resetUrl}" class="btn">Reset My Password →</a></p>
      <p style="font-size: 13px; color: #94a3b8;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Hello ${userName || 'Merchant'},

We received a request to reset your password for your SellPilot account:
${resetUrl}

This link is valid for 1 hour. If you didn't request this, please ignore this email.
  `.trim();

  const from = getSenderAddress();
  const { transporter, missing } = createGmailTransporter();

  if (!transporter) {
    const errorMsg = `[EmailService] Gmail SMTP is not configured (missing environment variables: ${missing.join(', ')}). Password reset email was not sent to ${toEmail}.`;
    console.error(errorMsg);
    return {
      success: false,
      provider: 'gmail_smtp',
      error: `Gmail SMTP configuration missing: ${missing.join(', ')}`,
    };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: toEmail,
      subject,
      html,
      text,
    });
    return {
      success: true,
      provider: 'gmail_smtp',
      messageId: info.messageId,
    };
  } catch (err: any) {
    const safeErrMessage = err?.message
      ? String(err.message).replace(/(pass|auth|key|password)=[^&\s]+/gi, '$1=[REDACTED]')
      : 'SMTP error';
    console.error('[EmailService] Failed to send password reset via Gmail SMTP:', safeErrMessage);
    return {
      success: false,
      provider: 'gmail_smtp',
      error: `Failed to dispatch password reset via Gmail SMTP: ${safeErrMessage}`,
    };
  }
}
