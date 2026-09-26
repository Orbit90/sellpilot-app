/**
 * SellPilot Production Security Architecture: Global API Rate Limiter
 * Phase 3, Step 3
 *
 * Implements IP-based rate limiting across all /api/* endpoints to defend against:
 * - Brute force credential stuffing
 * - Rapid API scraping and enumeration
 * - Denial of Service (DoS) and API flooding
 *
 * Characteristics:
 * - Applied strictly to /api/* routes (never throttles static assets, Vite assets, or SPA html)
 * - Configurable via environment variables RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX
 * - Emits both IETF Draft-7 RateLimit headers and legacy X-RateLimit headers
 * - Returns HTTP 429 Too Many Requests with informative JSON payload and Retry-After header
 * - Excludes automated payment webhooks (Paystack) to guarantee merchant transactions are never dropped
 * - Excludes CORS preflight OPTIONS requests so browser preflight negotiations are never penalized
 * - Preserves authentication, session validation, email verification, and multi-tenant isolation
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { rateLimit, Options } from 'express-rate-limit';

// Default configuration: 500 requests per 15-minute window per IP
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_RATE_LIMIT_MAX = 500; // 500 requests / 15 mins

export interface RateLimiterCustomOptions {
  windowMs?: number;
  max?: number;
  skipWebhooks?: boolean;
  skipOptions?: boolean;
  message?: string;
}

/**
 * Returns the effective rate limit window in milliseconds from env or default.
 */
export function getRateLimitWindowMs(env: NodeJS.ProcessEnv = process.env): number {
  const envVal = Number(env.RATE_LIMIT_WINDOW_MS);
  if (!Number.isNaN(envVal) && envVal > 0) {
    return envVal;
  }
  return DEFAULT_RATE_LIMIT_WINDOW_MS;
}

/**
 * Returns the effective rate limit request count from env or default.
 */
export function getRateLimitMax(env: NodeJS.ProcessEnv = process.env): number {
  const envVal = Number(env.RATE_LIMIT_MAX);
  if (!Number.isNaN(envVal) && envVal > 0) {
    return envVal;
  }
  return DEFAULT_RATE_LIMIT_MAX;
}

/**
 * Checks whether an incoming request should bypass the global rate limiter.
 * Specifically skips:
 * 1. HTTP OPTIONS preflight requests (so browser CORS negotiations are never blocked)
 * 2. Paystack automated payment webhook callbacks (so merchant transactions are never lost)
 */
export function shouldSkipRateLimit(req: Request): boolean {
  // 1. Skip CORS preflights
  if (req.method === 'OPTIONS') {
    return true;
  }

  // 2. Skip Paystack webhooks
  const path = req.path || '';
  const originalUrl = req.originalUrl || '';
  if (
    path === '/payments/paystack/webhook' ||
    originalUrl.startsWith('/api/payments/paystack/webhook')
  ) {
    return true;
  }

  return false;
}

/**
 * Factory to create a production-safe Express rate limiter middleware.
 */
export function createGlobalRateLimiter(
  options: RateLimiterCustomOptions = {},
  env: NodeJS.ProcessEnv = process.env
): RequestHandler {
  const windowMs = options.windowMs ?? getRateLimitWindowMs(env);
  const limit = options.max ?? getRateLimitMax(env);
  const customMessage =
    options.message || 'Too many requests from this IP address. Please try again later.';

  const limiter = rateLimit({
    windowMs,
    limit,
    standardHeaders: true, // Return standard RateLimit-* headers (IETF draft-7)
    legacyHeaders: true, // Return X-RateLimit-* headers for legacy client compatibility
    statusCode: 429,
    validate: {
      trustProxy: false, // Trust proxy handled by top-level Express app.set('trust proxy', 1)
      xForwardedForHeader: false,
    },
    skip: (req: Request) => {
      if (options.skipOptions !== false && req.method === 'OPTIONS') {
        return true;
      }
      if (options.skipWebhooks !== false && shouldSkipRateLimit(req)) {
        return true;
      }
      return false;
    },
    handler: (req: Request, res: Response, _next: NextFunction, limitOptions: Options) => {
      res.status(limitOptions.statusCode).json({
        error: customMessage,
        statusCode: 429,
      });
    },
  });

  return limiter;
}

/**
 * Singleton instance of the global API rate limiter for the SellPilot Express application.
 */
export const globalApiRateLimiter: RequestHandler = createGlobalRateLimiter();
