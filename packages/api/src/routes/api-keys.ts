import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { auth } from '../auth/config';
import { db } from '../db/client';
import { generateApiKey } from '../utils/api-keys';

export const apiKeysRoute = new Hono();

// List keys for org
apiKeysRoute.get('/', async (c) => {
  const orgId = c.req.query('orgId');
  if (!orgId) return c.json({ error: 'orgId required' }, 400);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const membership = await db
    .selectFrom('org_members')
    .where('orgId', '=', orgId)
    .where('userId', '=', session.user.id)
    .select('role')
    .executeTakeFirst();

  if (!membership) return c.json({ error: 'Not a member' }, 403);

  const keys = await db
    .selectFrom('api_keys')
    .where('orgId', '=', orgId)
    .select(['id', 'name', 'keyPrefix', 'lastUsedAt', 'expiresAt', 'createdAt'])
    .orderBy('createdAt', 'desc')
    .execute();

  return c.json({ keys });
});

// Create key (paid only)
apiKeysRoute.post('/', async (c) => {
  const { orgId, name, expiresIn } = await c.req.json<{
    orgId: string;
    name: string;
    expiresIn?: number;
  }>();

  if (!orgId || !name) return c.json({ error: 'orgId and name required' }, 400);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const membership = await db
    .selectFrom('org_members')
    .innerJoin('organizations', 'organizations.id', 'org_members.orgId')
    .where('org_members.orgId', '=', orgId)
    .where('org_members.userId', '=', session.user.id)
    .where('org_members.role', 'in', ['owner', 'admin'])
    .select(['org_members.role', 'organizations.plan'])
    .executeTakeFirst();

  if (!membership) return c.json({ error: 'Admin access required' }, 403);

  if (membership.plan === 'free') {
    return c.json(
      {
        error: 'API keys require a paid plan',
        upgrade: 'https://doccov.com/pricing',
      },
      403,
    );
  }

  const { key, hash, prefix } = generateApiKey();
  const id = nanoid(21);
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : null;

  await db
    .insertInto('api_keys')
    .values({
      id,
      orgId,
      name,
      keyHash: hash,
      keyPrefix: prefix,
      expiresAt,
    })
    .execute();

  return c.json(
    {
      id,
      key, // Shown once!
      name,
      prefix,
      expiresAt,
      message: 'Save this key now. It cannot be retrieved again.',
    },
    201,
  );
});

// Revoke key
apiKeysRoute.delete('/:keyId', async (c) => {
  const keyId = c.req.param('keyId');

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const key = await db
    .selectFrom('api_keys')
    .where('id', '=', keyId)
    .select(['id', 'orgId'])
    .executeTakeFirst();

  if (!key) return c.json({ error: 'Key not found' }, 404);

  const membership = await db
    .selectFrom('org_members')
    .where('orgId', '=', key.orgId)
    .where('userId', '=', session.user.id)
    .where('role', 'in', ['owner', 'admin'])
    .select('role')
    .executeTakeFirst();

  if (!membership) return c.json({ error: 'Admin access required' }, 403);

  await db.deleteFrom('api_keys').where('id', '=', keyId).execute();

  return c.json({ deleted: true });
});
