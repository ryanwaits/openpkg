import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /orgs/:slug - Get single org by slug
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;

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
    return Response.json({ error: 'Organization not found' }, { status: 404 });
  }

  return Response.json({ organization: org });
}
