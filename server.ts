import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';
import { analyzeConversation, generateAIReply, generateFollowUpMessage } from './server/gemini';
import { Business, ConversationAnalysis, Customer, Order, Product, User, SubscriptionMetric } from './src/types';
import { generateToken, hashPassword, sanitizeUser, verifyPassword } from './server/auth';
import { DEMO_BUSINESS_ID, DEMO_USER_ID } from './src/data/demoData';
import {
  ensureBusinessSubscription,
  getSubscriptionSummary,
  checkSubscriptionAccess,
  requireActiveSubscription,
  requireAdmin,
  recordMetricUsage,
  normalizeEmail,
  normalizePhone,
  checkRegistrationRateLimit,
  checkLoginRateLimit,
  recordFailedLogin,
} from './server/services/subscriptionService';
import { paymentProvider } from './server/services/paymentProvider';
import { paystackService } from './server/services/paystackService';
import { processVerifiedPayment } from './server/services/paymentVerificationService';
import { PLAN_CONFIGS, getPlanConfig, SubscriptionPlanId } from './src/config/plans';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      business?: Business;
      businessId?: string;
      token?: string;
      rawBody?: Buffer;
    }
  }
}

async function startServer() {
  // Initialize Database Schema & Migrations
  console.log('Initializing SellPilot Database Layer...');
  await db.init();

  const app = express();
  // On Render/external hosts, listen on assigned process.env.PORT. In the AI Studio container sandbox, bind to 3000.
  const PORT = process.env.APPLET_ID ? 3000 : (Number(process.env.PORT) || 3000);

  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // --- STRICT AUTHENTICATION & MULTI-TENANT MIDDLEWARE ---
  // Guarantees data isolation: req.businessId is derived strictly from the verified session!
  const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
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
      req.business = business;
      req.businessId = business.id;
      req.token = token;
      next();
    } catch (err: any) {
      console.error('Authentication middleware error:', err);
      res.status(500).json({ error: 'Authentication service temporarily unavailable.' });
    }
  };

  // --- HEALTH CHECK ---
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasPaystackKey: paystackService.isConfigured(),
      database: db.isPostgresConnected() ? 'PostgreSQL (External)' : 'PostgreSQL (Relational Engine)',
      timestamp: new Date().toISOString(),
    });
  });

  // --- SAFE PAYSTACK CONFIGURATION STATUS ---
  // Safely reports whether the Paystack secret key exists and its operating mode
  // NEVER returns, logs, or prints the secret key.
  app.get('/api/paystack/status', (_req, res) => {
    const status = paystackService.getStatus();
    res.json({
      configured: status.isConfigured,
      mode: status.mode,
      provider: status.provider,
      message: status.isConfigured
        ? `Paystack is securely configured on the server in ${status.mode} mode.`
        : 'Paystack secret key is not configured on the server.',
    });
  });

  // --- AUTHENTICATION & SESSIONS ---
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { name, email, password, businessName, businessCategory, phone } = req.body;
      if (!name || !email || !password || !businessName) {
        return res.status(400).json({ error: 'Name, email, password, and business name are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Registration rate limit check
      const rateCheck = checkRegistrationRateLimit(req.ip || 'anonymous');
      if (!rateCheck.allowed) {
        return res.status(429).json({
          error: `Too many registration attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
        });
      }

      const normalizedEmail = normalizeEmail(email);
      const existingUser = await db.users.findByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }

      const userId = `usr_${Date.now()}`;
      const businessId = `biz_${Date.now()}`;

      const { hash, salt } = hashPassword(password);

      const newBiz: Business = {
        id: businessId,
        ownerId: userId,
        name: businessName.trim(),
        category: businessCategory || 'fashion',
        description: '',
        phone: phone ? normalizePhone(phone) : '',
        location: '',
        currency: '₦',
        deliveryInfo: '',
        returnPolicy: '',
        paymentInstructions: '',
        createdAt: new Date().toISOString(),
        onboardingCompleted: false,
      };

      const newUser: User = {
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        businessId,
        role: 'merchant',
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: new Date().toISOString(),
      };

      await db.businesses.create(newBiz);
      await db.users.create(newUser);

      // Automatically provision 7-Day FREE TRIAL subscription for new merchant
      // Client-provided plan or expiry dates are strictly disregarded!
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await db.subscriptions.create({
        id: `sub_${businessId}_${Date.now()}`,
        businessId,
        plan: 'FREE_TRIAL',
        status: 'trialing',
        trialStartedAt: now.toISOString(),
        trialEndsAt: trialEndsAt.toISOString(),
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: trialEndsAt.toISOString(),
        cancelledAt: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });

      // Create session
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
      await db.sessions.create({
        token,
        userId,
        businessId,
        createdAt: new Date().toISOString(),
        expiresAt,
      });

      await db.persist();

      const subscription = await getSubscriptionSummary(businessId, newUser);

      res.status(201).json({
        user: sanitizeUser(newUser),
        business: newBiz,
        token,
        subscription,
      });
    } catch (err: any) {
      console.error('Signup error:', err);
      res.status(500).json({ error: 'Failed to register account. Please try again.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const normalizedEmail = normalizeEmail(email);

      // Login brute-force rate limit check
      const rateCheck = checkLoginRateLimit(normalizedEmail);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          error: `Too many login attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
        });
      }

      const user = await db.users.findByEmail(normalizedEmail);
      if (!user) {
        recordFailedLogin(normalizedEmail);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (user.passwordHash && user.passwordSalt) {
        const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
        if (!isValid) {
          recordFailedLogin(normalizedEmail);
          return res.status(401).json({ error: 'Invalid email or password' });
        }
      }

      const business = await db.businesses.findById(user.businessId);
      if (!business) {
        return res.status(404).json({ error: 'Business profile not found' });
      }

      // Generate session
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.sessions.create({
        token,
        userId: user.id,
        businessId: business.id,
        createdAt: new Date().toISOString(),
        expiresAt,
      });

      await db.persist();

      const subscription = await getSubscriptionSummary(business.id, user);

      res.json({
        user: sanitizeUser(user),
        business,
        token,
        subscription,
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  });

  // Demo 1-Click Login: creates authenticated session for DEMO store
  app.post('/api/auth/demo', async (req, res) => {
    try {
      const allUsers = await db.users.findAll();
      const demoUser = (await db.users.findById(DEMO_USER_ID)) || allUsers[0];
      if (!demoUser) {
        return res.status(500).json({ error: 'Demo store user not initialized' });
      }

      const allBiz = await db.businesses.findAll();
      const demoBiz = (await db.businesses.findById(demoUser.businessId)) || allBiz[0];
      if (!demoBiz) {
        return res.status(500).json({ error: 'Demo store profile not initialized' });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.sessions.create({
        token,
        userId: demoUser.id,
        businessId: demoBiz.id,
        createdAt: new Date().toISOString(),
        expiresAt,
      });

      await db.persist();

      const subscription = await getSubscriptionSummary(demoBiz.id, demoUser);

      res.json({
        user: sanitizeUser(demoUser),
        business: demoBiz,
        token,
        subscription,
      });
    } catch (err: any) {
      console.error('Demo login error:', err);
      res.status(500).json({ error: 'Demo login failed' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
      const subscription = await getSubscriptionSummary(req.businessId!, req.user);
      res.json({
        user: sanitizeUser(req.user!),
        business: req.business!,
        subscription,
      });
    } catch (err) {
      res.json({
        user: sanitizeUser(req.user!),
        business: req.business!,
      });
    }
  });

  // --- COMMERCIAL SUBSCRIPTION & BILLING APIS ---
  app.get('/api/plans', (_req, res) => {
    res.json(Object.values(PLAN_CONFIGS));
  });

  app.get('/api/subscription/plans', (_req, res) => {
    res.json(Object.values(PLAN_CONFIGS));
  });

  app.get('/api/subscription', requireAuth, async (req, res) => {
    try {
      const summary = await getSubscriptionSummary(req.businessId!, req.user);
      res.json(summary);
    } catch (err: any) {
      console.error('Fetch subscription error:', err);
      res.status(500).json({ error: 'Failed to retrieve subscription status.' });
    }
  });

  app.get('/api/subscription/usage', requireAuth, async (req, res) => {
    try {
      const summary = await getSubscriptionSummary(req.businessId!, req.user);
      res.json({
        usage: summary.usage,
        limits: summary.limits,
        plan: summary.planConfig.id,
        planName: summary.planConfig.name,
      });
    } catch (err: any) {
      console.error('Fetch usage error:', err);
      res.status(500).json({ error: 'Failed to retrieve usage stats.' });
    }
  });

  // Client attempt to directly alter plan without payment gateway verification is strictly rejected!
  app.post('/api/subscription/change-plan', requireAuth, (_req, res) => {
    res.status(403).json({
      error: 'Direct client modification of subscription plans is forbidden. Upgrades require verified billing confirmation or administrator activation.',
    });
  });

  // Payment checkout initiator (Paystack / Flutterwave abstraction)
  app.post('/api/subscription/checkout', requireAuth, async (req, res) => {
    try {
      const { planId } = req.body;
      const plan = planId && planId in PLAN_CONFIGS ? PLAN_CONFIGS[planId as SubscriptionPlanId] : null;
      if (!plan || plan.id === 'FREE_TRIAL') {
        return res.status(400).json({ error: 'Please choose a valid paid plan (STARTER, PRO, or BUSINESS).' });
      }

      const result = await paymentProvider.createCheckout({
        businessId: req.businessId!,
        planId: plan.id,
        amountNaira: plan.priceNaira,
        customerEmail: req.user!.email,
        customerName: req.user!.name,
        callbackUrl: `${process.env.APP_URL || ''}/?section=settings&payment=callback`,
      });

      res.json(result);
    } catch (err: any) {
      console.error('Subscription checkout error:', err);
      res.status(500).json({ error: 'Unable to initialize checkout.' });
    }
  });

  // --- PAYSTACK PAYMENT INITIALIZATION ---
  // POST /api/payments/paystack/initialize
  // Requirements:
  // 1. Authenticated SellPilot user required
  // 2. Accepts only STARTER, PRO, BUSINESS
  // 3. Server strictly calculates price in Kobo (ignoring any client amount)
  // 4. Currency NGN
  // 5. Unique server-generated reference
  // 6. Pending record created in PostgreSQL
  // 7. Calls Paystack initialize API with PAYSTACK_SECRET_KEY
  // 8. Returns only authorization_url, access_code, reference
  // 9. Does NOT activate subscription at initialization
  // 10. Handles errors safely without exposing secret keys
  app.post('/api/payments/paystack/initialize', requireAuth, async (req, res) => {
    try {
      const planRaw = (req.body.plan || req.body.planId || '').toString().trim().toUpperCase();

      // Accept ONLY plan identifiers: STARTER, PRO, BUSINESS
      if (!['STARTER', 'PRO', 'BUSINESS'].includes(planRaw)) {
        return res.status(400).json({
          status: false,
          error: 'Invalid plan. Supported plans are STARTER, PRO, or BUSINESS.',
        });
      }

      const plan = planRaw as 'STARTER' | 'PRO' | 'BUSINESS';

      // Server strictly determines the price in Kobo (1 NGN = 100 kobo)
      // STARTER = ₦5,000 = 500000 kobo
      // PRO = ₦10,000 = 1000000 kobo
      // BUSINESS = ₦20,000 = 2000000 kobo
      // Never trust an amount sent by the frontend
      const PLAN_PRICING: Record<'STARTER' | 'PRO' | 'BUSINESS', { kobo: number; naira: number; name: string }> = {
        STARTER: { kobo: 500000, naira: 5000, name: 'Starter Plan' },
        PRO: { kobo: 1000000, naira: 10000, name: 'Pro Plan' },
        BUSINESS: { kobo: 2000000, naira: 20000, name: 'Business Plan' },
      };

      const pricing = PLAN_PRICING[plan];
      const currency = 'NGN';

      if (!paystackService.isConfigured()) {
        return res.status(503).json({
          status: false,
          error: 'Paystack payment provider is not configured on this server.',
        });
      }

      // Generate unique payment reference on the server
      const reference = `sp_${plan.toLowerCase()}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const paymentId = `pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      // Create a pending payment record in PostgreSQL
      // Minimum fields: business/user ID, plan, amount, currency, payment reference, provider = PAYSTACK, status = pending
      await db.payments.create({
        id: paymentId,
        businessId: req.businessId!,
        userId: req.user!.id,
        plan,
        amount: pricing.kobo,
        currency,
        reference,
        provider: 'PAYSTACK',
        status: 'pending',
        metadata: {
          businessId: req.businessId,
          userId: req.user!.id,
          userEmail: req.user!.email,
          userName: req.user!.name,
          amountNaira: pricing.naira,
          plan,
        },
      });
      await db.persist();

      // Determine dynamic callback URL pointing to /payment/callback
      const reqOrigin = (req.headers.origin as string) || (req.headers.referer ? new URL(req.headers.referer as string).origin : '') || process.env.APP_URL || '';
      const baseOrigin = reqOrigin ? reqOrigin.replace(/\/$/, '') : (process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : '');
      const callbackUrl = baseOrigin ? `${baseOrigin}/payment/callback` : '/payment/callback';

      // Call Paystack transaction initialization API using server-side PAYSTACK_SECRET_KEY
      const initResponse = await paystackService.initializeTransaction({
        email: req.user!.email,
        amountInKobo: pricing.kobo,
        reference,
        currency,
        callbackUrl,
        metadata: {
          businessId: req.businessId,
          userId: req.user!.id,
          plan,
          paymentId,
        },
      });

      if (!initResponse.status || !initResponse.data) {
        // Record failure status in payment audit record
        await db.payments.updateStatus(reference, 'failed', {
          metadata: { failureReason: initResponse.message },
        });
        return res.status(502).json({
          status: false,
          error: initResponse.message || 'Failed to initialize payment with Paystack gateway.',
        });
      }

      // Update payment record with gateway authorization URL & access code
      await db.payments.updateStatus(reference, 'pending', {
        authorizationUrl: initResponse.data.authorization_url,
        accessCode: initResponse.data.access_code,
      });
      await db.persist();

      // Return ONLY what the frontend needs to open Paystack Checkout
      // Never return PAYSTACK_SECRET_KEY
      return res.json({
        status: true,
        message: 'Payment initialized successfully',
        data: {
          authorization_url: initResponse.data.authorization_url,
          access_code: initResponse.data.access_code,
          reference: initResponse.data.reference || reference,
        },
      });
    } catch (err: any) {
      console.error('Paystack initialization error:', err?.message || err);
      return res.status(500).json({
        status: false,
        error: 'Unable to initialize Paystack transaction. Please try again later.',
      });
    }
  });

  // --- PAYSTACK PAYMENT VERIFICATION ---
  // GET /api/payments/paystack/verify/:reference
  // Requirements:
  // 1. Authenticated SellPilot user required
  // 2. Direct server-side Paystack verification with PAYSTACK_SECRET_KEY
  // 3. Verifies status === 'success', reference match, currency === 'NGN', amount === plan price, ownership
  // 4. Activates subscription upon success
  // 5. Idempotent: repeated calls do not duplicate or re-extend
  app.get('/api/payments/paystack/verify/:reference', requireAuth, async (req, res) => {
    try {
      const { reference } = req.params;
      if (!reference) {
        return res.status(400).json({ status: false, error: 'Payment reference is required.' });
      }

      const result = await processVerifiedPayment({
        reference,
        expectedBusinessId: req.businessId!,
        expectedUserId: req.user!.id,
      });

      if (!result.success) {
        return res.status(result.statusCode || 400).json({
          status: false,
          error: result.error || 'Payment verification failed.',
        });
      }

      await db.persist();

      return res.json({
        status: true,
        message: result.message || 'Payment verified and subscription activated successfully.',
        alreadyProcessed: !!result.alreadyProcessed,
        data: {
          payment: result.payment,
          subscription: result.subscription,
        },
      });
    } catch (err: any) {
      console.error('Paystack verification error:', err?.message || err);
      return res.status(500).json({
        status: false,
        error: 'Unable to verify payment at this time. Please try again later.',
      });
    }
  });

  // --- PAYSTACK WEBHOOK HANDLER ---
  // POST /api/payments/paystack/webhook
  // Requirements:
  // 1. Verify HMAC-SHA512 webhook signature against PAYSTACK_SECRET_KEY
  // 2. Reject invalid signatures with 400 Bad Request
  // 3. Process charge.success events idempotently
  // 4. Never activate or extend subscriptions repeatedly
  // 5. Never expose PAYSTACK_SECRET_KEY
  app.post('/api/payments/paystack/webhook', async (req, res) => {
    try {
      const signature = req.headers['x-paystack-signature'] as string;
      if (!signature) {
        return res.status(400).json({ status: false, error: 'Missing webhook signature header.' });
      }

      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
      const isValid = paystackService.verifyWebhookSignature(signature, rawBody);
      if (!isValid) {
        return res.status(400).json({ status: false, error: 'Invalid webhook signature.' });
      }

      const event = req.body;
      if (!event || typeof event !== 'object') {
        return res.status(400).json({ status: false, error: 'Invalid webhook payload.' });
      }

      // Only process valid Paystack events, especially charge.success
      if (event.event === 'charge.success' && event.data) {
        const reference = event.data.reference;
        if (reference) {
          const result = await processVerifiedPayment({
            reference,
            paystackData: event.data,
          });

          await db.persist();

          if (!result.success) {
            console.warn(`Webhook notice for reference ${reference}: ${result.error}`);
          }
        }
      }

      // Acknowledge valid webhook receipt to prevent Paystack retries
      return res.status(200).json({ status: true, message: 'Webhook processed successfully.' });
    } catch (err: any) {
      console.error('Paystack webhook error:', err?.message || err);
      return res.status(500).json({ status: false, error: 'Webhook processing error.' });
    }
  });



  // --- ADMIN SUBSCRIPTION CONTROL & METRICS ---
  app.get('/api/admin/subscriptions', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const subscriptions = await db.subscriptions.findAll();
      const businesses = await db.businesses.findAll();
      const users = await db.users.findAll();

      const combined = subscriptions.map((s) => {
        const biz = businesses.find((b) => b.id === s.businessId);
        const owner = users.find((u) => u.businessId === s.businessId);
        return {
          ...s,
          businessName: biz?.name || 'Unknown Business',
          businessCategory: biz?.category || 'General',
          ownerEmail: owner?.email || 'N/A',
          ownerName: owner?.name || 'N/A',
        };
      });

      res.json(combined);
    } catch (err: any) {
      console.error('Admin subscriptions error:', err);
      res.status(500).json({ error: 'Failed to load subscriptions list' });
    }
  });

  app.post('/api/admin/subscriptions/:businessId', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { businessId } = req.params;
      const { plan, status, extendDays } = req.body;

      const sub = await db.subscriptions.findByBusinessId(businessId);
      if (!sub) {
        return res.status(404).json({ error: 'Subscription not found for this business' });
      }

      const updates: any = {};
      if (plan) updates.plan = plan;
      if (status) updates.status = status;
      if (extendDays && typeof extendDays === 'number') {
        const currentEnd = new Date(sub.currentPeriodEnd).getTime();
        updates.currentPeriodEnd = new Date(currentEnd + extendDays * 24 * 60 * 60 * 1000).toISOString();
        if (sub.trialEndsAt) {
          const currentTrialEnd = new Date(sub.trialEndsAt).getTime();
          updates.trialEndsAt = new Date(currentTrialEnd + extendDays * 24 * 60 * 60 * 1000).toISOString();
        }
      }

      const updated = await db.subscriptions.update(businessId, updates);
      await db.persist();
      res.json(updated);
    } catch (err: any) {
      console.error('Admin update subscription error:', err);
      res.status(500).json({ error: 'Failed to update subscription' });
    }
  });

  // Admin/Testing tool to artificially set metric usage to verify limit enforcement
  app.post('/api/admin/subscriptions/:businessId/set-usage', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { businessId } = req.params;
      const { metric, count } = req.body;

      if (!metric || count === undefined) {
        return res.status(400).json({ error: 'metric and count are required' });
      }

      const sub = await db.subscriptions.findByBusinessId(businessId);
      if (!sub) return res.status(404).json({ error: 'Subscription not found' });

      const newCount = await db.usage.setUsageCount(
        businessId,
        metric as SubscriptionMetric,
        sub.currentPeriodStart,
        sub.currentPeriodEnd,
        Number(count)
      );

      res.json({ success: true, metric, count: newCount });
    } catch (err: any) {
      console.error('Admin set usage error:', err);
      res.status(500).json({ error: 'Failed to set usage count' });
    }
  });

  app.get('/api/admin/stats', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const subscriptions = await db.subscriptions.findAll();
      const businesses = await db.businesses.findAll();

      const stats = {
        totalBusinesses: businesses.length,
        totalSubscriptions: subscriptions.length,
        activeTrials: subscriptions.filter((s) => s.status === 'trialing').length,
        expiredTrials: subscriptions.filter((s) => s.status === 'expired').length,
        activePaid: subscriptions.filter((s) => s.status === 'active' && s.plan !== 'FREE_TRIAL').length,
        planBreakdown: {
          FREE_TRIAL: subscriptions.filter((s) => s.plan === 'FREE_TRIAL').length,
          STARTER: subscriptions.filter((s) => s.plan === 'STARTER').length,
          PRO: subscriptions.filter((s) => s.plan === 'PRO').length,
          BUSINESS: subscriptions.filter((s) => s.plan === 'BUSINESS').length,
        },
      };

      res.json(stats);
    } catch (err: any) {
      console.error('Admin stats error:', err);
      res.status(500).json({ error: 'Failed to load admin statistics' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        await db.sessions.deleteByToken(token);
        await db.persist();
      }
      res.json({ success: true });
    } catch (err) {
      res.json({ success: true });
    }
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    res.json({ success: true, message: `Password reset instructions sent to ${email}` });
  });

  // --- ONBOARDING FLOW ---
  app.post('/api/business/onboarding', requireAuth, async (req, res) => {
    try {
      const businessId = req.businessId!;
      const { name, category, location, phone, firstProduct, deliveryInfo, paymentInstructions } = req.body;

      const updatedBiz = await db.businesses.update(businessId, {
        name: name ? name.trim() : undefined,
        category: category || undefined,
        location: location ? location.trim() : undefined,
        phone: phone ? phone.trim() : undefined,
        deliveryInfo: deliveryInfo ? deliveryInfo.trim() : undefined,
        paymentInstructions: paymentInstructions ? paymentInstructions.trim() : undefined,
        onboardingCompleted: true,
      });

      // Optionally add their first product
      if (firstProduct && firstProduct.name && firstProduct.price) {
        await db.products.create({
          id: `prd_${Date.now()}`,
          businessId,
          name: firstProduct.name.trim(),
          price: Math.max(0, Math.round(Number(firstProduct.price) || 0)),
          category: category || 'General',
          description: firstProduct.description ? firstProduct.description.trim() : '',
          images: firstProduct.image ? [firstProduct.image] : [],
          stockQuantity: Math.max(0, Math.round(Number(firstProduct.stock) || 10)),
          sku: `SKU-${Date.now().toString().slice(-4)}`,
          status: 'active',
          variants: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await recordMetricUsage(businessId, 'product');
      }

      await db.persist();
      res.json({ success: true, business: updatedBiz });
    } catch (err: any) {
      console.error('Onboarding update error:', err);
      res.status(500).json({ error: 'Onboarding update failed. Please try again.' });
    }
  });

  // --- BUSINESS PROFILE ---
  app.get('/api/business/profile', requireAuth, (req, res) => {
    res.json(req.business!);
  });

  app.put('/api/business/profile', requireAuth, async (req, res) => {
    try {
      const updated = await db.businesses.update(req.businessId!, req.body);
      if (!updated) return res.status(404).json({ error: 'Business not found' });
      await db.persist();
      res.json(updated);
    } catch (err: any) {
      console.error('Profile update error:', err);
      res.status(500).json({ error: 'Failed to update business profile' });
    }
  });

  // --- PRODUCTS ---
  app.get('/api/products', requireAuth, async (req, res) => {
    try {
      const products = await db.products.findAllByBusinessId(req.businessId!);
      res.json(products);
    } catch (err: any) {
      console.error('Get products error:', err);
      res.status(500).json({ error: 'Failed to retrieve products' });
    }
  });

  app.post('/api/products', requireAuth, requireActiveSubscription('product'), async (req, res) => {
    try {
      const businessId = req.businessId!;
      const { name, price, category, description, images, stockQuantity, sku, status, variants } = req.body;

      if (!name || price === undefined) {
        return res.status(400).json({ error: 'Product name and price are required' });
      }

      const safePrice = Math.max(0, Math.round(Number(price) || 0));
      const safeStock = Math.max(0, Math.round(Number(stockQuantity) || 0));

      const newProduct: Product = {
        id: `prd_${Date.now()}`,
        businessId,
        name: name.trim(),
        price: safePrice,
        category: category || 'General',
        description: description?.trim() || '',
        images: Array.isArray(images) && images.length > 0 ? images : ['https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80'],
        stockQuantity: safeStock,
        sku: sku?.trim() || `SKU-${Date.now().toString().slice(-4)}`,
        status: status || 'active',
        variants: Array.isArray(variants)
          ? variants.map((v: any) => ({
              id: v.id || `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: String(v.name || '').trim(),
              stock: Math.max(0, Math.round(Number(v.stock) || 0)),
            }))
          : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await db.products.create(newProduct);
      await recordMetricUsage(businessId, 'product');
      await db.persist();
      res.status(201).json(saved);
    } catch (err: any) {
      console.error('Product create error:', err);
      res.status(500).json({ error: 'Failed to create product' });
    }
  });

  app.get('/api/products/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const product = await db.products.findById(id, req.businessId!);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json(product);
    } catch (err: any) {
      console.error('Get product by id error:', err);
      res.status(500).json({ error: 'Failed to retrieve product' });
    }
  });

  app.put('/api/products/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await db.products.update(id, req.businessId!, req.body);
      if (!updated) return res.status(404).json({ error: 'Product not found' });
      await db.persist();
      res.json(updated);
    } catch (err: any) {
      console.error('Product update error:', err);
      res.status(500).json({ error: 'Failed to update product' });
    }
  });

  app.delete('/api/products/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await db.products.delete(id, req.businessId!);
      if (!success) return res.status(404).json({ error: 'Product not found' });
      await db.persist();
      res.json({ success: true });
    } catch (err: any) {
      console.error('Product delete error:', err);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  // --- CUSTOMERS ---
  app.get('/api/customers', requireAuth, async (req, res) => {
    try {
      const customers = await db.customers.findAllByBusinessId(req.businessId!);
      res.json(customers);
    } catch (err: any) {
      console.error('Get customers error:', err);
      res.status(500).json({ error: 'Failed to retrieve customers' });
    }
  });

  app.get('/api/customers/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const customer = await db.customers.findById(id, req.businessId!);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      res.json(customer);
    } catch (err: any) {
      console.error('Get customer by id error:', err);
      res.status(500).json({ error: 'Failed to retrieve customer' });
    }
  });

  app.post('/api/customers', requireAuth, requireActiveSubscription('customer'), async (req, res) => {
    try {
      const businessId = req.businessId!;
      const { name, phone, email, location, status, notes } = req.body;

      if (!name || !phone) {
        return res.status(400).json({ error: 'Customer name and phone number are required' });
      }

      const newCustomer: Customer = {
        id: `cust_${Date.now()}`,
        businessId,
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || undefined,
        location: location?.trim() || 'Nigeria',
        ordersCount: 0,
        totalSpent: 0,
        status: status || 'New',
        notes: notes?.trim() || '',
        interactions: [
          {
            id: `int_${Date.now()}`,
            type: 'inquiry',
            channel: 'WhatsApp',
            summary: 'Customer added to SellPilot directory',
            timestamp: new Date().toISOString(),
          },
        ],
        dateAdded: new Date().toISOString(),
      };

      const saved = await db.customers.create(newCustomer);
      await recordMetricUsage(businessId, 'customer');
      await db.persist();
      res.status(201).json(saved);
    } catch (err: any) {
      console.error('Customer create error:', err);
      res.status(500).json({ error: 'Failed to create customer' });
    }
  });

  app.put('/api/customers/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await db.customers.update(id, req.businessId!, req.body);
      if (!updated) return res.status(404).json({ error: 'Customer not found' });
      await db.persist();
      res.json(updated);
    } catch (err: any) {
      console.error('Customer update error:', err);
      res.status(500).json({ error: 'Failed to update customer' });
    }
  });

  app.delete('/api/customers/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await db.customers.delete(id, req.businessId!);
      if (!success) return res.status(404).json({ error: 'Customer not found' });
      await db.persist();
      res.json({ success: true });
    } catch (err: any) {
      console.error('Customer delete error:', err);
      res.status(500).json({ error: 'Failed to delete customer' });
    }
  });

  // --- ORDERS (Transactional & Stock-Protected) ---
  app.get('/api/orders', requireAuth, async (req, res) => {
    try {
      const orders = await db.orders.findAllByBusinessId(req.businessId!);
      res.json(orders);
    } catch (err: any) {
      console.error('Get orders error:', err);
      res.status(500).json({ error: 'Failed to retrieve orders' });
    }
  });

  app.get('/api/orders/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const order = await db.orders.findById(id, req.businessId!);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.json(order);
    } catch (err: any) {
      console.error('Get order by id error:', err);
      res.status(500).json({ error: 'Failed to retrieve order' });
    }
  });

  app.post('/api/orders', requireAuth, requireActiveSubscription('order'), async (req, res) => {
    try {
      const businessId = req.businessId!;
      const { customerId, items, deliveryFee, discount, deliveryAddress, notes, paymentStatus, orderStatus, idempotencyKey } = req.body;
      let customerName = req.body.customerName;
      let customerPhone = req.body.customerPhone;

      // Check idempotency if key provided
      const orderIdentifier = idempotencyKey ? `SP-${idempotencyKey}` : undefined;
      if (orderIdentifier) {
        const existing = await db.orders.findById(orderIdentifier, businessId);
        if (existing) {
          return res.status(200).json(existing);
        }
      }

      // Auto-populate customer info from customerId if name wasn't explicitly supplied
      if ((!customerName || !customerName.trim()) && customerId) {
        const custRecord = await db.customers.findById(customerId, businessId);
        if (custRecord) {
          customerName = custRecord.name;
          customerPhone = customerPhone || custRecord.phone;
        }
      }

      if (!customerName || !customerName.trim() || !items || !items.length) {
        return res.status(400).json({ error: 'Customer name and at least one item are required' });
      }

      // Safe integer calculations and product lookup fallback
      const safeItems = await Promise.all(
        items.map(async (it: any, idx: number) => {
          let pName = String(it.productName || '').trim();
          let uPrice = Math.max(0, Math.round(Number(it.unitPrice) || 0));

          if ((!pName || uPrice === 0) && it.productId) {
            const prod = await db.products.findById(it.productId, businessId);
            if (prod) {
              pName = pName || prod.name;
              uPrice = uPrice || prod.price;
            }
          }

          const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
          return {
            id: `item_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
            productId: it.productId,
            productName: pName || 'Item',
            variantName: it.variantName ? String(it.variantName).trim() : undefined,
            quantity: qty,
            unitPrice: uPrice,
            totalPrice: uPrice * qty,
          };
        })
      );

      const subtotal = safeItems.reduce((sum: number, it: any) => sum + it.totalPrice, 0);
      const dFee = Math.max(0, Math.round(Number(deliveryFee) || 0));
      const disc = Math.max(0, Math.round(Number(discount) || 0));
      const total = Math.max(0, subtotal + dFee - disc);

      const orderId = orderIdentifier || (await db.orders.generateNextOrderId());

      const newOrder: Order = {
        id: orderId,
        businessId,
        customerId: customerId || `cust_${Date.now()}`,
        customerName: customerName.trim(),
        customerPhone: customerPhone?.trim() || '',
        items: safeItems,
        productSubtotal: subtotal,
        deliveryFee: dFee,
        discount: disc,
        total,
        paymentStatus: paymentStatus || 'Unpaid',
        orderStatus: orderStatus || 'New',
        deliveryAddress: deliveryAddress?.trim() || '',
        notes: notes?.trim() || '',
        createdDate: new Date().toISOString(),
      };

      // Atomic Order Creation in PostgreSQL Transaction
      const saved = await db.orders.create(newOrder);
      await recordMetricUsage(businessId, 'order');
      await db.persist();
      res.status(201).json(saved);
    } catch (err: any) {
      console.error('Order creation error:', err);
      // Return clear merchant-facing error without internal technical noise
      res.status(400).json({ error: err.message || 'Failed to create order. Please check item stock.' });
    }
  });

  app.put('/api/orders/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await db.orders.update(id, req.businessId!, req.body);
      if (!updated) return res.status(404).json({ error: 'Order not found' });
      await db.persist();
      res.json(updated);
    } catch (err: any) {
      console.error('Order update error:', err);
      res.status(500).json({ error: 'Failed to update order' });
    }
  });

  app.delete('/api/orders/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await db.orders.delete(id, req.businessId!);
      if (!success) return res.status(404).json({ error: 'Order not found' });
      await db.persist();
      res.json({ success: true });
    } catch (err: any) {
      console.error('Order delete error:', err);
      res.status(500).json({ error: 'Failed to delete order' });
    }
  });

  // --- FOLLOW-UPS ---
  app.get('/api/follow-ups', requireAuth, async (req, res) => {
    try {
      const followUps = await db.followUps.findAllByBusinessId(req.businessId!);
      res.json(followUps);
    } catch (err: any) {
      console.error('Get follow-ups error:', err);
      res.status(500).json({ error: 'Failed to retrieve follow-ups' });
    }
  });

  app.post('/api/follow-ups', requireAuth, requireActiveSubscription('follow_up'), async (req, res) => {
    try {
      const businessId = req.businessId!;
      const { customerId, customerName, customerPhone, reason, suggestedMessage, dueDate } = req.body;

      if (!customerName || !reason) {
        return res.status(400).json({ error: 'Customer name and follow-up reason are required' });
      }

      const newFollowUp = {
        id: `fu_${Date.now()}`,
        businessId,
        customerId: customerId || '',
        customerName: customerName.trim(),
        customerPhone: customerPhone?.trim() || '',
        reason: reason.trim(),
        suggestedMessage: suggestedMessage?.trim() || '',
        status: 'Pending' as const,
        dueDate: dueDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      const saved = await db.followUps.create(newFollowUp);
      await recordMetricUsage(businessId, 'follow_up');
      await db.persist();
      res.status(201).json(saved);
    } catch (err: any) {
      console.error('Follow-up create error:', err);
      res.status(500).json({ error: 'Failed to create follow-up' });
    }
  });

  app.put('/api/follow-ups/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await db.followUps.update(id, req.businessId!, req.body);
      if (!updated) return res.status(404).json({ error: 'Follow-up not found' });
      await db.persist();
      res.json(updated);
    } catch (err: any) {
      console.error('Follow-up update error:', err);
      res.status(500).json({ error: 'Failed to update follow-up' });
    }
  });

  app.delete('/api/follow-ups/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await db.followUps.delete(id, req.businessId!);
      if (!success) return res.status(404).json({ error: 'Follow-up not found' });
      await db.persist();
      res.json({ success: true });
    } catch (err: any) {
      console.error('Follow-up delete error:', err);
      res.status(500).json({ error: 'Failed to delete follow-up' });
    }
  });

  // --- SETTINGS ---
  app.get('/api/settings', requireAuth, async (req, res) => {
    try {
      const settings = await db.settings.findByBusinessId(req.businessId!);
      res.json(settings);
    } catch (err: any) {
      console.error('Get settings error:', err);
      res.status(500).json({ error: 'Failed to retrieve settings' });
    }
  });

  app.put('/api/settings', requireAuth, async (req, res) => {
    try {
      const updated = await db.settings.update(req.businessId!, req.body);
      await db.persist();
      res.json(updated);
    } catch (err: any) {
      console.error('Settings update error:', err);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  // --- AI ASSISTANT ROUTES ---
  app.post('/api/ai/generate-reply', requireAuth, requireActiveSubscription('ai_analysis'), async (req, res) => {
    try {
      const businessId = req.businessId!;
      const business = req.business!;
      const { customerMessage, tone = 'friendly', customerId } = req.body;

      if (!customerMessage || !customerMessage.trim()) {
        return res.status(400).json({ error: 'Customer message is required' });
      }

      const products = await db.products.findAllByBusinessId(businessId);
      const customer = customerId ? await db.customers.findById(customerId, businessId) : null;

      const result = await generateAIReply({
        customerMessage,
        tone,
        business,
        products,
        customer,
      });

      await recordMetricUsage(businessId, 'ai_analysis');
      await db.persist();
      res.json(result);
    } catch (err: any) {
      console.error('Error generating AI reply:', err);
      res.status(500).json({ error: 'Unable to generate reply at this time. Please try again.' });
    }
  });

  app.post('/api/ai/adjust-reply', requireAuth, requireActiveSubscription('ai_analysis'), async (req, res) => {
    try {
      const businessId = req.businessId!;
      const business = req.business!;
      const { customerMessage, tone = 'friendly', adjustmentType, existingDraft } = req.body;

      if (!existingDraft) {
        return res.status(400).json({ error: 'Existing draft reply is required to adjust' });
      }

      const products = await db.products.findAllByBusinessId(businessId);

      const result = await generateAIReply({
        customerMessage: customerMessage || '',
        tone,
        business,
        products,
        adjustmentType,
        existingDraft,
      });

      res.json(result);
    } catch (err: any) {
      console.error('Error adjusting reply:', err);
      res.status(500).json({ error: 'Unable to adjust reply.' });
    }
  });

  app.post('/api/ai/generate-followup', requireAuth, requireActiveSubscription('follow_up'), async (req, res) => {
    try {
      const businessId = req.businessId!;
      const business = req.business!;
      const { customerId, reason, tone = 'friendly' } = req.body;

      let customer = customerId ? await db.customers.findById(customerId, businessId) : null;
      if (!customer) {
        customer = {
          id: 'temp',
          businessId,
          name: req.body.customerName || 'Customer',
          phone: '',
          location: 'Nigeria',
          ordersCount: 0,
          totalSpent: 0,
          status: 'Interested',
          notes: '',
          dateAdded: new Date().toISOString(),
        };
      }

      const message = await generateFollowUpMessage({
        customer,
        business,
        reason: reason || 'Following up on recent inquiry',
        tone,
      });

      await recordMetricUsage(businessId, 'follow_up');
      await db.persist();
      res.json({ message });
    } catch (err: any) {
      console.error('Error generating follow-up:', err);
      res.status(500).json({ error: 'Failed to generate follow-up message.' });
    }
  });

  // --- CONVERSATION ANALYZER ROUTES ---
  app.post(['/api/conversations/analyze', '/api/ai/analyze'], requireAuth, requireActiveSubscription('ai_analysis'), async (req, res) => {
    try {
      const businessId = req.businessId!;
      const business = req.business!;
      const rawText = req.body.conversationText || req.body.text || req.body.message;
      const tone = req.body.tone || 'friendly';

      if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
        return res.status(400).json({ error: 'Conversation text is required.' });
      }

      const products = await db.products.findAllByBusinessId(businessId);
      const customers = await db.customers.findAllByBusinessId(businessId);

      const analysis = await analyzeConversation({
        conversationText: rawText.trim(),
        business,
        products,
        customers,
        tone,
      });

      // Customer matching against existing store database
      let matchedCustomer: Customer | undefined;
      if (analysis.customerPhone) {
        const cleanPhone = analysis.customerPhone.replace(/\D/g, '');
        matchedCustomer = customers.find(
          (c) =>
            (cleanPhone.length >= 7 && c.phone.replace(/\D/g, '').includes(cleanPhone)) ||
            (cleanPhone.length >= 7 && cleanPhone.includes(c.phone.replace(/\D/g, '')))
        );
      }
      if (!matchedCustomer && analysis.customerName) {
        matchedCustomer = customers.find(
          (c) => c.name.toLowerCase() === analysis.customerName.toLowerCase()
        );
      }

      const newRecord: ConversationAnalysis = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        businessId,
        customerId: matchedCustomer ? matchedCustomer.id : null,
        customerName: matchedCustomer ? matchedCustomer.name : (analysis.customerName || undefined),
        customerPhone: matchedCustomer ? matchedCustomer.phone : (analysis.customerPhone || undefined),
        rawConversation: rawText.trim(),
        detectedIntent: analysis.intent,
        leadStage: analysis.leadStage,
        interestLevel: analysis.interestLevel,
        productsDetected: analysis.productsMentioned,
        questionsAsked: analysis.questionsAsked,
        objections: analysis.objections,
        missingInformation: analysis.missingInformation,
        purchaseLikelihood: analysis.purchaseLikelihood,
        recommendedAction: analysis.recommendedAction,
        suggestedReply: analysis.suggestedReply,
        followUpRecommended: analysis.followUpRecommended,
        followUpReason: analysis.followUpReason,
        orderOpportunity: analysis.orderOpportunity,
        orderItems: analysis.orderItems,
        deliveryFeeEstimated: analysis.deliveryFeeEstimated,
        deliveryFeeConfirmed: analysis.deliveryFeeConfirmed,
        confidence: analysis.confidence,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await db.conversations.create(newRecord);

      // If matched existing customer, record interaction in customer profile
      if (matchedCustomer) {
        await db.customers.addInteraction(matchedCustomer.id, businessId, {
          id: `int_${Date.now()}`,
          type: 'inquiry',
          channel: 'WhatsApp',
          summary: `Analyzed conversation: ${analysis.intent} (${analysis.leadStage})`,
          timestamp: new Date().toISOString(),
        });
      }

      await recordMetricUsage(businessId, 'ai_analysis');
      await db.persist();
      res.status(201).json(saved);
    } catch (err: any) {
      console.error('Conversation analysis error:', err);
      res.status(500).json({ error: 'Unable to analyze this conversation right now. Please try again.' });
    }
  });

  app.post('/api/conversations/:id/customer', requireAuth, requireActiveSubscription('customer'), async (req, res) => {
    try {
      const { id } = req.params;
      const businessId = req.businessId!;
      const conv = await db.conversations.findById(id, businessId);
      if (!conv) {
        return res.status(404).json({ error: 'Conversation analysis not found' });
      }

      const { name, phone, location, notes } = req.body;
      if (!name || !name.trim() || !phone || !phone.trim()) {
        return res.status(400).json({ error: 'Customer name and phone number are required.' });
      }

      const newCustomer = {
        id: `cust_${Date.now()}`,
        businessId,
        name: name.trim(),
        phone: phone.trim(),
        location: location?.trim() || 'Nigeria',
        ordersCount: 0,
        totalSpent: 0,
        status: 'Interested' as const,
        notes: notes?.trim() || `Created from analyzed WhatsApp chat (${conv.detectedIntent})`,
        interactions: [
          {
            id: `int_${Date.now()}`,
            type: 'inquiry' as const,
            channel: 'WhatsApp' as const,
            summary: `Customer created from WhatsApp conversation analysis (${conv.detectedIntent})`,
            timestamp: new Date().toISOString(),
          },
        ],
        dateAdded: new Date().toISOString(),
      };

      const savedCustomer = await db.customers.create(newCustomer);
      const updatedConv = await db.conversations.update(id, businessId, {
        customerId: savedCustomer.id,
        customerName: savedCustomer.name,
        customerPhone: savedCustomer.phone,
      });

      await recordMetricUsage(businessId, 'customer');
      await db.persist();
      res.status(201).json({ customer: savedCustomer, conversation: updatedConv });
    } catch (err: any) {
      console.error('Customer save from analysis error:', err);
      res.status(500).json({ error: err.message || 'Failed to create customer' });
    }
  });

  app.post('/api/conversations/:id/order', requireAuth, requireActiveSubscription('order'), async (req, res) => {
    try {
      const { id } = req.params;
      const businessId = req.businessId!;
      const conv = await db.conversations.findById(id, businessId);
      if (!conv) {
        return res.status(404).json({ error: 'Conversation analysis not found' });
      }

      const {
        customerId,
        customerName,
        customerPhone,
        items,
        deliveryFee = 0,
        discount = 0,
        deliveryAddress = 'Pending address from customer',
        notes = '',
      } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Order must contain at least one item.' });
      }

      const safeDeliveryFee = Math.max(0, Math.round(Number(deliveryFee) || 0));
      const safeDiscount = Math.max(0, Math.round(Number(discount) || 0));

      const orderItems = await Promise.all(
        items.map(async (item: any, idx: number) => {
          const prod = await db.products.findById(item.productId, businessId);
          const unitPrice = prod ? prod.price : Math.round(Number(item.unitPrice) || 0);
          const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
          return {
            id: `item_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
            productId: item.productId,
            productName: prod ? prod.name : item.productName,
            variantName: item.variantName || undefined,
            quantity,
            unitPrice,
            totalPrice: unitPrice * quantity,
          };
        })
      );

      const productSubtotal = orderItems.reduce((acc: number, item: any) => acc + item.totalPrice, 0);
      const total = Math.max(0, productSubtotal + safeDeliveryFee - safeDiscount);

      const newOrder = {
        id: await db.orders.generateNextOrderId(),
        businessId,
        customerId: customerId || conv.customerId || '',
        customerName: (customerName || conv.customerName || 'Customer').trim(),
        customerPhone: (customerPhone || conv.customerPhone || '').trim(),
        items: orderItems,
        productSubtotal,
        deliveryFee: safeDeliveryFee,
        discount: safeDiscount,
        total,
        paymentStatus: 'Payment Pending' as const,
        orderStatus: 'New' as const,
        deliveryAddress: deliveryAddress.trim(),
        notes: notes.trim() || `Created from conversation analysis (${conv.id})`,
        createdDate: new Date().toISOString(),
      };

      const savedOrder = await db.orders.create(newOrder);

      // Update conversation state: mark order opportunity converted
      const updatedConv = await db.conversations.update(id, businessId, {
        orderOpportunity: false,
        leadStage: 'purchased',
        recommendedAction: `Order ${savedOrder.id} created for ₦${savedOrder.total.toLocaleString()}. Awaiting customer payment proof.`,
      });

      await recordMetricUsage(businessId, 'order');
      await db.persist();
      res.status(201).json({ order: savedOrder, conversation: updatedConv });
    } catch (err: any) {
      console.error('Order save from analysis error:', err);
      res.status(400).json({ error: err.message || 'Failed to create order' });
    }
  });

  app.post('/api/conversations/:id/follow-up', requireAuth, requireActiveSubscription('follow_up'), async (req, res) => {
    try {
      const { id } = req.params;
      const businessId = req.businessId!;
      const conv = await db.conversations.findById(id, businessId);
      if (!conv) {
        return res.status(404).json({ error: 'Conversation analysis not found' });
      }

      const { customerId, customerName, customerPhone, reason, suggestedMessage, dueDate } = req.body;

      const newFollowUp = {
        id: `fu_${Date.now()}`,
        businessId,
        customerId: customerId || conv.customerId || '',
        customerName: (customerName || conv.customerName || 'Customer').trim(),
        customerPhone: (customerPhone || conv.customerPhone || '').trim(),
        reason: (reason || conv.followUpReason || 'Follow up on WhatsApp conversation').trim(),
        suggestedMessage: (suggestedMessage || conv.suggestedReply || '').trim(),
        status: 'Pending' as const,
        dueDate: dueDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      const savedFollowUp = await db.followUps.create(newFollowUp);
      const updatedConv = await db.conversations.update(id, businessId, {
        followUpRecommended: false,
      });

      await recordMetricUsage(businessId, 'follow_up');
      await db.persist();
      res.status(201).json({ followUp: savedFollowUp, conversation: updatedConv });
    } catch (err: any) {
      console.error('Follow-up save from analysis error:', err);
      res.status(500).json({ error: err.message || 'Failed to schedule follow-up' });
    }
  });

  app.post('/api/conversations/:id/adjust-reply', requireAuth, requireActiveSubscription('ai_analysis'), async (req, res) => {
    try {
      const { id } = req.params;
      const businessId = req.businessId!;
      const conv = await db.conversations.findById(id, businessId);
      if (!conv) {
        return res.status(404).json({ error: 'Conversation analysis not found' });
      }

      const { adjustmentType, tone = 'friendly' } = req.body;
      const products = await db.products.findAllByBusinessId(businessId);

      const result = await generateAIReply({
        customerMessage: conv.rawConversation,
        tone: adjustmentType === 'nigerian_business' || adjustmentType === 'pidgin' ? adjustmentType : tone,
        business: req.business!,
        products,
        adjustmentType: ['shorter', 'professional', 'friendly', 'cta'].includes(adjustmentType)
          ? adjustmentType
          : null,
        existingDraft: conv.suggestedReply,
      });

      const updatedConv = await db.conversations.update(id, businessId, {
        suggestedReply: result.reply,
      });

      await db.persist();
      res.json({ suggestedReply: result.reply, conversation: updatedConv });
    } catch (err: any) {
      console.error('Adjust reply error:', err);
      res.status(500).json({ error: 'Failed to adjust suggested reply' });
    }
  });

  app.get('/api/conversations', requireAuth, async (req, res) => {
    try {
      const list = await db.conversations.findAllByBusinessId(req.businessId!);
      res.json(list);
    } catch (err: any) {
      console.error('Get conversations error:', err);
      res.status(500).json({ error: 'Failed to retrieve conversations' });
    }
  });

  app.get('/api/conversations/:id', requireAuth, async (req, res) => {
    try {
      const item = await db.conversations.findById(req.params.id, req.businessId!);
      if (!item) return res.status(404).json({ error: 'Conversation not found' });
      res.json(item);
    } catch (err: any) {
      console.error('Get conversation error:', err);
      res.status(500).json({ error: 'Failed to retrieve conversation' });
    }
  });

  // --- RESET DEMO DATA ---
  app.post('/api/data/reset-demo', requireAuth, async (req, res) => {
    try {
      // Strictly isolate: only permitted if current tenant is DEMO store
      if (req.businessId !== DEMO_BUSINESS_ID) {
        return res.status(403).json({
          error: 'Demo reset is only permitted on the sample store. Real merchant data cannot be modified or cleared.',
        });
      }
      await db.resetDemo(DEMO_BUSINESS_ID);
      res.json({ success: true, message: 'Sample demo data successfully restored' });
    } catch (err: any) {
      console.error('Demo reset error:', err);
      res.status(500).json({ error: 'Failed to reset demo data' });
    }
  });

  // --- VITE MIDDLEWARE / SPA SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SellPilot server listening on port ${PORT}`);
  });
}

startServer();
