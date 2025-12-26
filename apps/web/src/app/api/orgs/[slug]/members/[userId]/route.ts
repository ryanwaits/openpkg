import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// PATCH /orgs/:slug/members/:userId - Update member role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; userId: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug, userId } = await params;
  const body = (await request.json()) as { role: 'admin' | 'member' };

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
    return Response.json({ error: 'Only owner can change roles' }, { status: 403 });
  }

  // Don't allow changing owner role
  const targetMember = await db
    .selectFrom('org_members')
    .where('orgId', '=', org.orgId)
    .where('userId', '=', userId)
    .select('role')
    .executeTakeFirst();

  if (!targetMember) {
    return Response.json({ error: 'Member not found' }, { status: 404 });
  }

  if (targetMember.role === 'owner') {
    return Response.json({ error: 'Cannot change owner role' }, { status: 400 });
  }

  await db
    .updateTable('org_members')
    .set({ role: body.role })
    .where('orgId', '=', org.orgId)
    .where('userId', '=', userId)
    .execute();

  return Response.json({ success: true });
}

// DELETE /orgs/:slug/members/:userId - Remove member
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; userId: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug, userId } = await params;

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
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Don't allow removing owner
  const targetMember = await db
    .selectFrom('org_members')
    .where('orgId', '=', org.orgId)
    .where('userId', '=', userId)
    .select('role')
    .executeTakeFirst();

  if (!targetMember) {
    return Response.json({ error: 'Member not found' }, { status: 404 });
  }

  if (targetMember.role === 'owner') {
    return Response.json({ error: 'Cannot remove owner' }, { status: 400 });
  }

  // Admins can only remove members, not other admins
  if (org.myRole === 'admin' && targetMember.role === 'admin') {
    return Response.json({ error: 'Admins cannot remove other admins' }, { status: 403 });
  }

  await db
    .deleteFrom('org_members')
    .where('orgId', '=', org.orgId)
    .where('userId', '=', userId)
    .execute();

  return Response.json({ success: true });
}
