import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import {
  Subscription,
  SubscriptionMetric,
  SubscriptionPlanId,
  SubscriptionStatus,
  SubscriptionSummary,
  User,
} from '../../src/types';
import {
  getPlanConfig,
  PLAN_CONFIGS,
  TRIAL_DURATION_DAYS,
  TRIAL_DURATION_MS,
} from '../../src/config/plans';

/**
 * Ensures a subscription exists for a business, defaulting to a 7-day FREE_TRIAL.
 */
export async function ensureBusinessSubscription(
  businessId: string,
  businessCreatedAt?: string
): Promise<Subscription> {
  const existing = await db.subscriptions.findByBusinessId(businessId);
  if (existing) {
    return checkAndRefreshSubscriptionStatus(existing);
  }

  const now = new Date();
  const startedAt = businessCreatedAt ? new Date(businessCreatedAt) : now;
  const trialEndsAt = new Date(startedAt.getTime() + TRIAL_DURATION_MS);
  const isPastExpiry = now.getTime() > trialEndsAt.getTime();

  const newSub: Subscription = {
    id: `sub_${businessId}_${Date.now()}`,
    businessId,
    plan: 'FREE_TRIAL',
    status: isPastExpiry ? 'expired' : 'trialing',
    trialStartedAt: startedAt.toISOString(),
    trialEndsAt: trialEndsAt.toISOString(),
    currentPeriodStart: startedAt.toISOString(),
    currentPeriodEnd: trialEndsAt.toISOString(),
    cancelledAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  return db.subscriptions.create(newSub);
}

/**
 * Checks if a trialing or active subscription has passed its expiration time
 * and automatically transitions it to 'expired' server-side.
 */
export async function checkAndRefreshSubscriptionStatus(
  sub: Subscription
): Promise<Subscription> {
  const now = Date.now();

  if (sub.status === 'trialing' && sub.trialEndsAt) {
    const expiryTime = new Date(sub.trialEndsAt).getTime();
    if (now > expiryTime) {
      const updated = await db.subscriptions.update(sub.businessId, {
        status: 'expired',
      });
      return updated || { ...sub, status: 'expired' };
    }
  }

  if (sub.status === 'active' && sub.currentPeriodEnd) {
    const periodEndTime = new Date(sub.currentPeriodEnd).getTime();
    if (now > periodEndTime) {
      const updated = await db.subscriptions.update(sub.businessId, {
        status: 'past_due',
      });
      return updated || { ...sub, status: 'past_due' };
    }
  }

  return sub;
}

/**
 * Fetches the full subscription summary including live usage against plan limits.
 */
export async function getSubscriptionSummary(
  businessId: string,
  user?: User
): Promise<SubscriptionSummary> {
  const sub = await ensureBusinessSubscription(businessId);
  const planConfig = getPlanConfig(sub.plan);

  const usage = await db.usage.getUsage(
    businessId,
    sub.currentPeriodStart,
    sub.currentPeriodEnd
  );

  const now = Date.now();
  let trialDaysLeft = 0;
  if (sub.trialEndsAt) {
    const msLeft = new Date(sub.trialEndsAt).getTime() - now;
    trialDaysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  }

  const isExpired = sub.status === 'expired' || sub.status === 'cancelled';
  const isActive = (sub.status === 'active' || sub.status === 'trialing') && !isExpired;
  const isAdmin = user?.role === 'admin';

  return {
    subscription: sub,
    planConfig,
    isTrial: sub.plan === 'FREE_TRIAL',
    trialDaysLeft,
    isExpired,
    isActive,
    usage,
    limits: planConfig.limits,
    isAdmin,
  };
}

export interface AccessCheckResult {
  allowed: boolean;
  code?: 'SUBSCRIPTION_EXPIRED' | 'USAGE_LIMIT_REACHED' | 'ACCESS_DENIED';
  metric?: SubscriptionMetric;
  limit?: number;
  used?: number;
  error?: string;
  summary?: SubscriptionSummary;
}

/**
 * Server-side check for subscription validity and usage capacity.
 * Admins are unconditionally allowed full access.
 */
export async function checkSubscriptionAccess(
  businessId: string,
  metric?: SubscriptionMetric,
  user?: User
): Promise<AccessCheckResult> {
  // 1. Admin bypass: Admins have unrestricted system access
  if (user?.role === 'admin') {
    return { allowed: true };
  }

  const summary = await getSubscriptionSummary(businessId, user);

  // 2. Expiration check: Expired or cancelled subscriptions cannot perform locked actions
  if (summary.isExpired || summary.subscription.status === 'expired') {
    return {
      allowed: false,
      code: 'SUBSCRIPTION_EXPIRED',
      error:
        'Your SellPilot trial has ended. Your business data is safe. Choose a plan to continue using SellPilot sales tools.',
      summary,
    };
  }

  // 3. Usage limit check: If a specific metric action is requested, enforce plan limits
  if (metric) {
    const limit = summary.limits[metric];
    const used = summary.usage[metric] || 0;

    if (used >= limit) {
      return {
        allowed: false,
        code: 'USAGE_LIMIT_REACHED',
        metric,
        limit,
        used,
        error: `You've reached your ${metric.replace('_', ' ')} limit (${limit}) for this period. Upgrade your plan to continue.`,
        summary,
      };
    }
  }

  return { allowed: true, summary };
}

/**
 * Middleware that strictly verifies an active subscription and available usage quota
 * before executing paid actions (AI conversation analysis, product creation, order creation, etc.)
 */
export function requireActiveSubscription(metric?: SubscriptionMetric) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res.status(401).json({ error: 'Business identification required.' });
      }

      const result = await checkSubscriptionAccess(businessId, metric, req.user);
      if (!result.allowed) {
        return res.status(403).json(result);
      }

      next();
    } catch (err: any) {
      console.error('Subscription enforcement error:', err);
      res.status(500).json({ error: 'Subscription check failed. Please try again.' });
    }
  };
}

/**
 * Middleware that restricts access strictly to users with role='admin'.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      code: 'FORBIDDEN',
      error: 'Access denied. SellPilot administrator privileges required.',
    });
  }
  next();
}

/**
 * Strict server-authoritative middleware that requires an authenticated user's email to be verified.
 * Guarantees:
 * 1. An authenticated session exists (via req.user or resolving Authorization Bearer token).
 * 2. Re-queries PostgreSQL directly for the authoritative email_verified flag (never trusts frontend client state).
 * 3. Rejects unverified accounts with HTTP 403 Forbidden and a clear, safe security message.
 * 4. Allows verified users to continue cleanly.
 */
export async function requireEmailVerified(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Ensure authenticated session
    if (!req.user || !req.user.id) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required. Please sign in.' });
      }
      const token = authHeader.substring(7).trim();
      if (!token) {
        return res.status(401).json({ error: 'Valid session token required.' });
      }
      const session = await db.sessions.findByToken(token);
      if (!session) {
        return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
      }
      const user = await db.users.findById(session.userId);
      if (!user) {
        return res.status(401).json({ error: 'User account not found.' });
      }
      const business = await db.businesses.findById(session.businessId);
      if (!business) {
        return res.status(401).json({ error: 'Business account not found.' });
      }
      req.user = user;
      (req as any).business = business;
      (req as any).businessId = business.id;
      (req as any).token = token;
    }

    // 2. Query database directly for authoritative email verification status (never trust stale or client boolean)
    const freshUser = await db.users.findById(req.user.id);
    if (!freshUser) {
      return res.status(401).json({ error: 'User account not found.' });
    }
    req.user = freshUser;

    // 3. Reject unverified accounts
    if (freshUser.emailVerified === false) {
      return res.status(403).json({
        status: false,
        error: 'Please verify your email address before continuing.',
        code: 'EMAIL_VERIFICATION_REQUIRED',
        emailVerified: false,
      });
    }

    next();
  } catch (err: any) {
    console.error('Email verification guard error:', err);
    res.status(500).json({ error: 'Verification check temporarily unavailable.' });
  }
}

/**
 * Records usage event atomically in the current billing period.
 */
export async function recordMetricUsage(
  businessId: string,
  metric: SubscriptionMetric,
  count: number = 1
): Promise<void> {
  try {
    const sub = await ensureBusinessSubscription(businessId);
    await db.usage.incrementUsage(
      businessId,
      metric,
      sub.currentPeriodStart,
      sub.currentPeriodEnd,
      count
    );
  } catch (err) {
    console.error(`Failed to record metric usage for ${metric}:`, err);
  }
}

// ==========================================
// REGISTRATION & LOGIN ABUSE PROTECTION
// ==========================================

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '').trim();
  // Nigerian format normalization: 0803... -> +234803...
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = `+234${cleaned.slice(1)}`;
  }
  return cleaned;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const registrationRateLimits = new Map<string, RateLimitBucket>();
const loginRateLimits = new Map<string, RateLimitBucket>();

/**
 * In-memory sliding rate limiter.
 */
function checkRateLimit(
  store: Map<string, RateLimitBucket>,
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  bucket.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function checkRegistrationRateLimit(ipOrKey: string) {
  // Max 5 registrations per 15 minutes per IP
  return checkRateLimit(registrationRateLimits, ipOrKey, 5, 15 * 60 * 1000);
}

export function checkLoginRateLimit(ipOrKey: string) {
  // Max 10 attempts per 15 minutes per IP or Email
  return checkRateLimit(loginRateLimits, ipOrKey, 10, 15 * 60 * 1000);
}

export function recordFailedLogin(ipOrKey: string) {
  checkRateLimit(loginRateLimits, ipOrKey, 10, 15 * 60 * 1000);
}
