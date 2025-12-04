import type { Context, MiddlewareHandler, Next } from 'hono';

interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Max requests per window */
  max: number;
  /** Message to return when rate limited */
  message?: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limiter store
 * Can be swapped for Redis in production
 */
class RateLimitStore {
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

const store = new RateLimitStore();

// Cleanup expired entries every minute
setInterval(() => store.cleanup(), 60 * 1000).unref();

/**
 * Get client IP from request
 */
function getClientIp(c: Context): string {
  // Check common proxy headers
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Vercel-specific
  const vercelIp = c.req.header('x-vercel-forwarded-for');
  if (vercelIp) {
    return vercelIp.split(',')[0].trim();
  }

  return 'unknown';
}

/**
 * Rate limiting middleware for Hono
 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const { windowMs, max, message = 'Too many requests, please try again later' } = options;

  return async (c: Context, next: Next) => {
    const ip = getClientIp(c);
    const key = `ratelimit:${ip}`;

    const entry = store.increment(key, windowMs);

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      return c.json({ error: message }, 429);
    }

    await next();
  };
}
