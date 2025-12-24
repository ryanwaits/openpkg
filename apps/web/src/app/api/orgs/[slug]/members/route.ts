import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /orgs/:slug/members - List org members
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
    .select(['organizations.id as orgId', 'org_members.role as myRole'])
    .executeTakeFirst();

  if (!org) {
    return Response.json({ error: 'Organization not found' }, { status: 404 });
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

  return Response.json({ members, myRole: org.myRole });
}
