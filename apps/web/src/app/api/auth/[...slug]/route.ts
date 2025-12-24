import { createPersonalOrg } from '@doccov/auth/hooks';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /auth/session - Custom session endpoint with orgs
async function getSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return Response.json({ user: null, session: null, organizations: [] });
  }

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

  return Response.json({
    user: session.user,
    session: session.session,
    organizations: memberships,
  });
}

// POST /auth/webhook/user-created - Post-signup webhook
async function handleUserCreated(request: Request) {
  const { userId, email, name } = await request.json();

  const existingMembership = await db
    .selectFrom('org_members')
    .where('userId', '=', userId)
    .select('id')
    .executeTakeFirst();

  if (!existingMembership) {
    await createPersonalOrg(db, userId, name, email);
  }

  return Response.json({ ok: true });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/auth', '');

  // Custom session endpoint
  if (path === '/session') {
    return getSession(request);
  }

  // All other GET requests go to better-auth
  return auth.handler(request);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/auth', '');

  // Custom webhook endpoint
  if (path === '/webhook/user-created') {
    return handleUserCreated(request);
  }

  // All other POST requests go to better-auth
  return auth.handler(request);
}
