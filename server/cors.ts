import { Request, Response, NextFunction, RequestHandler } from 'express';
import cors, { CorsOptions } from 'cors';

/**
 * Normalizes a URL or origin string into a canonical origin (scheme + hostname + port).
 * Returns null if the URL is invalid.
 */
export function normalizeOrigin(rawUrl?: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.origin.toLowerCase();
  } catch {
    // If protocol was missing, attempt with https://
    try {
      const url = new URL(`https://${trimmed.replace(/^https?:\/\//, '')}`);
      return url.origin.toLowerCase();
    } catch {
      return null;
    }
  }
}

/**
 * Returns the list of trusted production origins derived from environment variables.
 * Primary source: APP_URL (e.g. Render production URL or custom domain).
 * Secondary source: ALLOWED_ORIGINS (comma-separated list of additional trusted origins).
 */
export function getTrustedProductionOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const origins: string[] = [];

  // 1. Primary: APP_URL environment variable
  const appUrlOrigin = normalizeOrigin(env.APP_URL);
  if (appUrlOrigin) {
    origins.push(appUrlOrigin);
  }

  // 2. Secondary: ALLOWED_ORIGINS comma-separated list
  if (env.ALLOWED_ORIGINS) {
    const extras = env.ALLOWED_ORIGINS.split(',');
    for (const extra of extras) {
      const parsed = normalizeOrigin(extra);
      if (parsed && !origins.includes(parsed)) {
        origins.push(parsed);
      }
    }
  }

  // 3. Optional FRONTEND_URL if explicitly specified
  if (env.FRONTEND_URL) {
    const frontendOrigin = normalizeOrigin(env.FRONTEND_URL);
    if (frontendOrigin && !origins.includes(frontendOrigin)) {
      origins.push(frontendOrigin);
    }
  }

  return origins;
}

/**
 * Validates whether an incoming HTTP Origin header is authorized to access SellPilot APIs.
 *
 * Rules:
 * 1. Requests with no Origin header (e.g. same-origin GET, curl, server-to-server Paystack webhooks) are allowed.
 * 2. In Development mode (NODE_ENV !== 'production'):
 *    - Standard localhost / 127.0.0.1 development ports (e.g. 3000, 5173) are allowed.
 *    - Cloud Run development preview origins are allowed.
 * 3. In Production mode (NODE_ENV === 'production'):
 *    - Localhost origins are STRICTLY DISALLOWED.
 *    - Wildcard ('*') is STRICTLY DISALLOWED.
 *    - Only origins matching the trusted production origins derived from APP_URL / ALLOWED_ORIGINS are allowed.
 */
export function isOriginAllowed(origin?: string, env: NodeJS.ProcessEnv = process.env): boolean {
  // Same-origin, server-to-server (Paystack webhooks, backend cron), or curl/tools
  if (!origin) {
    return true;
  }

  const cleanOrigin = origin.trim().toLowerCase();
  const isProduction = env.NODE_ENV === 'production';

  // Check against trusted production origins
  const trustedProductionOrigins = getTrustedProductionOrigins(env);
  if (trustedProductionOrigins.includes(cleanOrigin)) {
    return true;
  }

  // Check development-only origins
  if (!isProduction) {
    // Standard localhost / 127.0.0.1 on any port (e.g., :3000, :5173)
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin);
    if (isLocalhost) {
      return true;
    }

    // Google Cloud Run / AI Studio preview subdomains in development
    const isCloudRunPreview = /^https:\/\/[a-z0-9\-]+\.run\.app$/.test(cleanOrigin);
    if (isCloudRunPreview) {
      return true;
    }
  }

  // Production forbids localhost, unlisted origins, and wildcards
  return false;
}

/**
 * Creates the production CORS middleware for the Express application.
 */
export function createCorsMiddleware(env: NodeJS.ProcessEnv = process.env): RequestHandler {
  const corsOptions: CorsOptions = {
    origin: (requestOrigin, callback) => {
      // 1. Same-origin or non-browser server-to-server requests
      if (!requestOrigin) {
        return callback(null, true);
      }

      // 2. Origin check against SellPilot CORS policy
      if (isOriginAllowed(requestOrigin, env)) {
        return callback(null, true);
      }

      // 3. Untrusted origin
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'x-forwarded-proto',
    ],
    maxAge: 86400, // 24-hour preflight cache
    optionsSuccessStatus: 204,
  };

  const underlyingCors = cors(corsOptions);

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    // Explicitly reject preflight OPTIONS requests originating from untrusted domains
    if (origin && !isOriginAllowed(origin, env)) {
      if (req.method === 'OPTIONS') {
        return res.status(403).json({ error: 'CORS policy: Origin not allowed.' });
      }
    }

    return underlyingCors(req, res, next);
  };
}
