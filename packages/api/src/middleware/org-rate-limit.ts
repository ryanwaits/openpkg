import { getPlanLimits, type Plan } from '@doccov/db';
import type { Context, MiddlewareHandler, Next } from 'hono';
import { db } from '../db/client';

const usageStore = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  usageStore.forEach((entry, key) => {
    if (now > entry.resetAt) usageStore.delete(key);
  });
}, 60_000).unref();

/**
 * Rate limit by org plan
 * Requires apiKey middleware to run first
 */
export function orgRateLimit(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const org = c.get('org');
    if (!org) return c.json({ error: 'Auth required' }, 401);

    const limits = getPlanLimits(org.plan as Plan);
    const dailyLimit = limits.analysesPerDay;

    // Unlimited for enterprise
    if (dailyLimit === Infinity) {
      await next();
      return;
    }

    const key = `org:${org.id}`;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    let entry = usageStore.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + dayMs };
      usageStore.set(key, entry);
    }

    if (entry.count >= dailyLimit) {
      c.header('X-RateLimit-Limit', String(dailyLimit));
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

      return c.json(
        {
          error: 'Daily analysis limit exceeded',
          limit: dailyLimit,
          plan: org.plan,
          resetAt: new Date(entry.resetAt).toISOString(),
          upgrade: org.plan === 'team' ? 'https://doccov.com/pricing' : undefined,
        },
        429,
      );
    }

    entry.count++;

    c.header('X-RateLimit-Limit', String(dailyLimit));
    c.header('X-RateLimit-Remaining', String(dailyLimit - entry.count));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    // Track in DB (async, don't block)
    db.insertInto('usage_records')
      .values({
        id: crypto.randomUUID(),
        orgId: org.id,
        feature: 'analysis',
        count: 1,
      })
      .execute()
      .catch(console.error);

    await next();
  };
}
