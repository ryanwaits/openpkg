import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// DELETE /orgs/:slug/invites/:inviteId - Delete invite
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; inviteId: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug, inviteId } = await params;

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
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db
    .deleteFrom('org_invites')
    .where('id', '=', inviteId)
    .where('orgId', '=', org.orgId)
    .execute();

  return Response.json({ success: true });
}
