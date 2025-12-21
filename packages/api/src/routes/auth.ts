import { Hono } from 'hono';
import { auth } from '../auth/config';
import { createPersonalOrg } from '../auth/hooks';
import { db } from '../db/client';

export const authRoute = new Hono();

// Custom routes BEFORE better-auth catch-all

// Get current session with orgs
authRoute.get('/session', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ user: null, session: null, organizations: [] });
  }

  // Get user's orgs
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
      'org_members.role',
    ])
    .execute();

  return c.json({
    user: session.user,
    session: session.session,
    organizations: memberships,
  });
});

// Webhook for post-signup actions
authRoute.post('/webhook/user-created', async (c) => {
  const { userId, email, name } = await c.req.json();

  // Check if user already has an org
  const existingMembership = await db
    .selectFrom('org_members')
    .where('userId', '=', userId)
    .select('id')
    .executeTakeFirst();

  if (!existingMembership) {
    await createPersonalOrg(userId, name, email);
  }

  return c.json({ ok: true });
});

// Better Auth handles all other routes
authRoute.on(['GET', 'POST'], '/*', async (c) => {
  const response = await auth.handler(c.req.raw);
  return response;
});
