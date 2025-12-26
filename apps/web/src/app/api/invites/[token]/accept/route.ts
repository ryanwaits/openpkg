import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// POST /invites/:token/accept - Accept invite (requires auth)
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized - please sign in first' }, { status: 401 });
  }

  const { token } = await params;

  const invite = await db
    .selectFrom('org_invites')
    .where('token', '=', token)
    .where('expiresAt', '>', new Date())
    .selectAll()
    .executeTakeFirst();

  if (!invite) {
    return Response.json({ error: 'Invite not found or expired' }, { status: 404 });
  }

  // Check if already a member
  const existingMember = await db
    .selectFrom('org_members')
    .where('orgId', '=', invite.orgId)
    .where('userId', '=', session.user.id)
    .select('id')
    .executeTakeFirst();

  if (existingMember) {
    // Delete the invite and return success (already a member)
    await db.deleteFrom('org_invites').where('id', '=', invite.id).execute();
    return Response.json({ success: true, message: 'Already a member' });
  }

  // Add as member
  await db
    .insertInto('org_members')
    .values({
      id: nanoid(21),
      orgId: invite.orgId,
      userId: session.user.id,
      role: invite.role,
    })
    .execute();

  // Delete the invite
  await db.deleteFrom('org_invites').where('id', '=', invite.id).execute();

  // Get org slug for redirect
  const org = await db
    .selectFrom('organizations')
    .where('id', '=', invite.orgId)
    .select('slug')
    .executeTakeFirst();

  return Response.json({ success: true, orgSlug: org?.slug });
}
