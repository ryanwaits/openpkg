import type { Context, MiddlewareHandler, Next } from 'hono';
import { db } from '../db/client';
import { hashApiKey, isValidKeyFormat } from '../utils/api-keys';

export interface ApiKeyContext {
  apiKey: { id: string; orgId: string; name: string };
  org: { id: string; plan: string; aiCallsUsed: number; aiCallsResetAt: Date | null };
}

/**
 * Required API key authentication for /v1/* endpoints
 * Rejects requests without valid API key
 */
export function requireApiKey(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader) {
      return c.json(
        {
          error: 'API key required',
          docs: 'https://docs.doccov.com/api-keys',
        },
        401,
      );
    }

    if (!authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Invalid Authorization header. Use: Bearer <api_key>' }, 401);
    }

    const key = authHeader.slice(7);

    if (!isValidKeyFormat(key)) {
      return c.json({ error: 'Invalid API key format' }, 401);
    }

    const keyHash = hashApiKey(key);

    const result = await db
      .selectFrom('api_keys')
      .innerJoin('organizations', 'organizations.id', 'api_keys.orgId')
      .where('api_keys.keyHash', '=', keyHash)
      .where((eb) =>
        eb.or([eb('api_keys.expiresAt', 'is', null), eb('api_keys.expiresAt', '>', new Date())]),
      )
      .select([
        'api_keys.id as keyId',
        'api_keys.orgId',
        'api_keys.name as keyName',
        'organizations.plan',
        'organizations.aiCallsUsed',
        'organizations.aiCallsResetAt',
      ])
      .executeTakeFirst();

    if (!result) {
      return c.json({ error: 'Invalid or expired API key' }, 401);
    }

    // Free tier shouldn't have API keys, but guard anyway
    if (result.plan === 'free') {
      return c.json(
        {
          error: 'API access requires a paid plan',
          upgrade: 'https://doccov.com/pricing',
        },
        403,
      );
    }

    // Update last used (async, don't block)
    db.updateTable('api_keys')
      .set({ lastUsedAt: new Date() })
      .where('id', '=', result.keyId)
      .execute()
      .catch(console.error);

    c.set('apiKey', {
      id: result.keyId,
      orgId: result.orgId,
      name: result.keyName,
    });

    c.set('org', {
      id: result.orgId,
      plan: result.plan,
      aiCallsUsed: result.aiCallsUsed,
      aiCallsResetAt: result.aiCallsResetAt,
    });

    await next();
  };
}
