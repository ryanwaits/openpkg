import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { auth } from '../auth/config';
import { db } from '../db/client';

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

type Env = {
  Variables: {
    session: NonNullable<Session>;
  };
};

export const orgsRoute = new Hono<Env>();

// Middleware: require auth
orgsRoute.use('*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('session', session);
  await next();
});

// List user's organizations
orgsRoute.get('/', async (c) => {
  const session = c.get('session');

  const memberships = await db
    .selectFrom('org_members')
    .innerJoin('organizations', 'organizations.id', 'org_members.orgId')
    .where('org_members.userId', '=', session.user.id)
    .select([
      'organizations.id',
      'organizations.name',
      'organizations.slug',
      'organizations.plan',
      'organizations.isPersonal',
      'organizations.aiCallsUsed',
      'org_members.role',
    ])
    .execute();

  return c.json({ organizations: memberships });
});

// Get single org by slug
orgsRoute.get('/:slug', async (c) => {
  const session = c.get('session');
  const { slug } = c.req.param();

  const org = await db
    .selectFrom('organizations')
    .innerJoin('org_members', 'org_members.orgId', 'organizations.id')
    .where('organizations.slug', '=', slug)
    .where('org_members.userId', '=', session.user.id)
    .select([
      'organizations.id',
      'organizations.name',
      'organizations.slug',
      'organizations.plan',
      'organizations.isPersonal',
      'organizations.aiCallsUsed',
      'organizations.aiCallsResetAt',
      'org_members.role',
    ])
    .executeTakeFirst();

  if (!org) {
    return c.json({ error: 'Organization not found' }, 404);
  }

  return c.json({ organization: org });
});

// Get org's projects
orgsRoute.get('/:slug/projects', async (c) => {
  const session = c.get('session');
  const { slug } = c.req.param();

  // Verify membership
  const membership = await db
    .selectFrom('org_members')
    .innerJoin('organizations', 'organizations.id', 'org_members.orgId')
    .where('organizations.slug', '=', slug)
    .where('org_members.userId', '=', session.user.id)
    .select(['org_members.orgId'])
    .executeTakeFirst();

  if (!membership) {
    return c.json({ error: 'Organization not found' }, 404);
  }

  const projects = await db
    .selectFrom('projects')
    .where('orgId', '=', membership.orgId)
    .selectAll()
    .execute();

  return c.json({ projects });
});

// Create a project
orgsRoute.post('/:slug/projects', async (c) => {
  const session = c.get('session');
  const { slug } = c.req.param();
  const body = await c.req.json<{ name: string; fullName: string; isPrivate?: boolean }>();

  // Verify owner/admin membership
  const membership = await db
    .selectFrom('org_members')
    .innerJoin('organizations', 'organizations.id', 'org_members.orgId')
    .where('organizations.slug', '=', slug)
    .where('org_members.userId', '=', session.user.id)
    .where('org_members.role', 'in', ['owner', 'admin'])
    .select(['org_members.orgId'])
    .executeTakeFirst();

  if (!membership) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const project = await db
    .insertInto('projects')
    .values({
      id: nanoid(21),
      orgId: membership.orgId,
      name: body.name,
      fullName: body.fullName,
      isPrivate: body.isPrivate ?? false,
      defaultBranch: 'main',
    })
    .returningAll()
    .executeTakeFirst();

  return c.json({ project }, 201);
});

// ============ Members ============

// List org members
orgsRoute.get('/:slug/members', async (c) => {
  const session = c.get('session');
  const { slug } = c.req.param();

  // Verify membership
  const org = await db
    .selectFrom('organizations')
    .innerJoin('org_members', 'org_members.orgId', 'organizations.id')
    .where('organizations.slug', '=', slug)
    .where('org_members.userId', '=', session.user.id)
    .select(['organizations.id as orgId', 'org_members.role as myRole'])
    .executeTakeFirst();

  if (!org) {
    return c.json({ error: 'Organization not found' }, 404);
  }

  const members = await db
    .selectFrom('org_members')
    .innerJoin('user', 'user.id', 'org_members.userId')
    .where('org_members.orgId', '=', org.orgId)
    .select([
      'org_members.id',
      'org_members.userId',
      'org_members.role',
      'org_members.createdAt',
      'user.email',
      'user.name',
      'user.image',
    ])
    .orderBy('org_members.createdAt', 'asc')
    .execute();

  return c.json({ members, myRole: org.myRole });
});

// Create invite
orgsRoute.post('/:slug/invites', async (c) => {
  const session = c.get('session');
  const { slug } = c.req.param();
  const body = await c.req.json<{ email: string; role: 'admin' | 'member' }>();

  // Verify owner/admin
  const org = await db
    .selectFrom('organizations')
    .innerJoin('org_members', 'org_members.orgId', 'organizations.id')
    .where('organizations.slug', '=', slug)
    .where('org_members.userId', '=', session.user.id)
    .where('org_members.role', 'in', ['owner', 'admin'])
    .select(['organizations.id as orgId', 'organizations.name'])
    .executeTakeFirst();

  if (!org) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Check if already a member
  const existingMember = await db
    .selectFrom('org_members')
    .innerJoin('user', 'user.id', 'org_members.userId')
    .where('org_members.orgId', '=', org.orgId)
    .where('user.email', '=', body.email)
    .select('org_members.id')
    .executeTakeFirst();

  if (existingMember) {
    return c.json({ error: 'User is already a member' }, 400);
  }

  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invite = await db
    .insertInto('org_invites')
    .values({
      id: nanoid(21),
      orgId: org.orgId,
      email: body.email,
      role: body.role || 'member',
      token,
      expiresAt,
      createdBy: session.user.id,
    })
    .returningAll()
    .executeTakeFirst();

  const inviteUrl = `${SITE_URL}/invite/${token}`;

  return c.json({ invite, inviteUrl }, 201);
});

// List pending invites
orgsRoute.get('/:slug/invites', async (c) => {
  const session = c.get('session');
  const { slug } = c.req.param();

  // Verify owner/admin
  const org = await db
    .selectFrom('organizations')
    .innerJoin('org_members', 'org_members.orgId', 'organizations.id')
    .where('organizations.slug', '=', slug)
    .where('org_members.userId', '=', session.user.id)
    .where('org_members.role', 'in', ['owner', 'admin'])
    .select(['organizations.id as orgId'])
    .executeTakeFirst();

  if (!org) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const invites = await db
    .selectFrom('org_invites')
    .where('orgId', '=', org.orgId)
    .where('expiresAt', '>', new Date())
    .select(['id', 'email', 'role', 'expiresAt', 'createdAt'])
    .orderBy('createdAt', 'desc')
    .execute();

  return c.json({ invites });
});

// Delete invite
orgsRoute.delete('/:slug/invites/:inviteId', async (c) => {
  const session = c.get('session');
  const { slug, inviteId } = c.req.param();

  // Verify owner/admin
  const org = await db
    .selectFrom('organizations')
    .innerJoin('org_members', 'org_members.orgId', 'organizations.id')
    .where('organizations.slug', '=', slug)
    .where('org_members.userId', '=', session.user.id)
    .where('org_members.role', 'in', ['owner', 'admin'])
    .select(['organizations.id as orgId'])
    .executeTakeFirst();

  if (!org) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await db
    .deleteFrom('org_invites')
    .where('id', '=', inviteId)
    .where('orgId', '=', org.orgId)
    .execute();

  return c.json({ success: true });
});

// Update member role
orgsRoute.patch('/:slug/members/:userId', async (c) => {
  const session = c.get('session');
  const { slug, userId } = c.req.param();
  const body = await c.req.json<{ role: 'admin' | 'member' }>();

  // Verify owner
  const org = await db
    .selectFrom('organizations')
    .innerJoin('org_members', 'org_members.orgId', 'organizations.id')
    .where('organizations.slug', '=', slug)
    .where('org_members.userId', '=', session.user.id)
    .where('org_members.role', '=', 'owner')
    .select(['organizations.id as orgId'])
    .executeTakeFirst();

  if (!org) {
    return c.json({ error: 'Only owner can change roles' }, 403);
  }

  // Don't allow changing owner role
  const targetMember = await db
    .selectFrom('org_members')
    .where('orgId', '=', org.orgId)
    .where('userId', '=', userId)
    .select('role')
    .executeTakeFirst();

  if (!targetMember) {
    return c.json({ error: 'Member not found' }, 404);
  }

  if (targetMember.role === 'owner') {
    return c.json({ error: 'Cannot change owner role' }, 400);
  }

  await db
    .updateTable('org_members')
    .set({ role: body.role })
    .where('orgId', '=', org.orgId)
    .where('userId', '=', userId)
    .execute();

  return c.json({ success: true });
});

// Remove member
orgsRoute.delete('/:slug/members/:userId', async (c) => {
  const session = c.get('session');
  const { slug, userId } = c.req.param();

  // Verify owner/admin
  const org = await db
    .selectFrom('organizations')
    .innerJoin('org_members', 'org_members.orgId', 'organizations.id')
    .where('organizations.slug', '=', slug)
    .where('org_members.userId', '=', session.user.id)
    .where('org_members.role', 'in', ['owner', 'admin'])
    .select(['organizations.id as orgId', 'org_members.role as myRole'])
    .executeTakeFirst();

  if (!org) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Don't allow removing owner
  const targetMember = await db
    .selectFrom('org_members')
    .where('orgId', '=', org.orgId)
    .where('userId', '=', userId)
    .select('role')
    .executeTakeFirst();

  if (!targetMember) {
    return c.json({ error: 'Member not found' }, 404);
  }

  if (targetMember.role === 'owner') {
    return c.json({ error: 'Cannot remove owner' }, 400);
  }

  // Admins can only remove members, not other admins
  if (org.myRole === 'admin' && targetMember.role === 'admin') {
    return c.json({ error: 'Admins cannot remove other admins' }, 403);
  }

  await db
    .deleteFrom('org_members')
    .where('orgId', '=', org.orgId)
    .where('userId', '=', userId)
    .execute();

  return c.json({ success: true });
});
