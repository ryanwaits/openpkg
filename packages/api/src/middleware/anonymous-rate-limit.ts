import type { Context, MiddlewareHandler, Next } from 'hono';

interface AnonymousRateLimitOptions {
  /** Time window in milliseconds (default: 24 hours) */
  windowMs: number;
  /** Max requests per window */
  max: number;
  /** Message to return when rate limited */
  message?: string;
  /** URL for upgrade CTA */
  upgradeUrl?: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory store for anonymous rate limiting
 */
class AnonymousRateLimitStore {
  private store = new Map<string, RateLimitEntry>();

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (entry && Date.now() > entry.resetAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  increment(key: string, windowMs: number): RateLimitEntry {
    const now = Date.now();
    const existing = this.get(key);

    if (existing) {
      existing.count++;
      return existing;
    }

    const entry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    this.store.set(key, entry);
    return entry;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

const store = new AnonymousRateLimitStore();

// Cleanup expired entries every minute
setInterval(() => store.cleanup(), 60 * 1000).unref();

/**
 * Get client IP from request headers
 */
function getClientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const vercelIp = c.req.header('x-vercel-forwarded-for');
  if (vercelIp) {
    return vercelIp.split(',')[0].trim();
  }

  return 'unknown';
}

/**
 * Anonymous IP-based rate limiting middleware
 * Skips authenticated requests (with API key)
 * Returns upgrade CTA when limit reached
 */
export function anonymousRateLimit(options: AnonymousRateLimitOptions): MiddlewareHandler {
  const {
    windowMs,
    max,
    message = 'Rate limit reached. Sign up free for 100/day.',
    upgradeUrl = 'https://doccov.com/signup',
  } = options;

  return async (c: Context, next: Next) => {
    // Skip if authenticated (has API key)
    if (c.get('apiKey')) {
      return next();
    }

    const ip = getClientIp(c);
    const key = `anon:${ip}`;

    const entry = store.increment(key, windowMs);

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      return c.json(
        {
          error: message,
          limit: max,
          resetAt: new Date(entry.resetAt).toISOString(),
          upgrade: upgradeUrl,
        },
        429,
      );
    }

    await next();
  };
}
