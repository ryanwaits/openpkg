import { generateApiKey } from '@doccov/api-shared';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /api-keys - List keys for org
export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');

  if (!orgId) {
    return Response.json({ error: 'orgId required' }, { status: 400 });
  }

  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await db
    .selectFrom('org_members')
    .where('orgId', '=', orgId)
    .where('userId', '=', session.user.id)
    .select('role')
    .executeTakeFirst();

  if (!membership) {
    return Response.json({ error: 'Not a member' }, { status: 403 });
  }

  const keys = await db
    .selectFrom('api_keys')
    .where('orgId', '=', orgId)
    .select(['id', 'name', 'keyPrefix', 'lastUsedAt', 'expiresAt', 'createdAt'])
    .orderBy('createdAt', 'desc')
    .execute();

  return Response.json({ keys });
}

// POST /api-keys - Create key (paid only)
export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { orgId, name, expiresIn } = await request.json() as {
    orgId: string;
    name: string;
    expiresIn?: number;
  };

  if (!orgId || !name) {
    return Response.json({ error: 'orgId and name required' }, { status: 400 });
  }

  const membership = await db
    .selectFrom('org_members')
    .innerJoin('organizations', 'organizations.id', 'org_members.orgId')
    .where('org_members.orgId', '=', orgId)
    .where('org_members.userId', '=', session.user.id)
    .where('org_members.role', 'in', ['owner', 'admin'])
    .select(['org_members.role', 'organizations.plan'])
    .executeTakeFirst();

  if (!membership) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  if (membership.plan === 'free') {
    return Response.json(
      {
        error: 'API keys require a paid plan',
        upgrade: 'https://doccov.com/pricing',
      },
      { status: 403 }
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

  return Response.json(
    {
      id,
      key, // Shown once!
      name,
      prefix,
      expiresAt,
      message: 'Save this key now. It cannot be retrieved again.',
    },
    { status: 201 }
  );
}
