import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /orgs - List user's organizations
export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
      'organizations.aiCallsUsed',
      'org_members.role',
    ])
    .execute();

  return Response.json({ organizations: memberships });
}
