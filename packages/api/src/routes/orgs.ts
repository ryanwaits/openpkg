import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { auth } from '../auth/config';
import { db } from '../db/client';

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
