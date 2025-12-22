import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { auth } from '../auth/config';
import { db } from '../db/client';

export const invitesRoute = new Hono();

// Get invite info (public, for displaying on invite page)
invitesRoute.get('/:token', async (c) => {
  const { token } = c.req.param();

  const invite = await db
    .selectFrom('org_invites')
    .innerJoin('organizations', 'organizations.id', 'org_invites.orgId')
    .where('org_invites.token', '=', token)
    .where('org_invites.expiresAt', '>', new Date())
    .select([
      'org_invites.id',
      'org_invites.email',
      'org_invites.role',
      'org_invites.expiresAt',
      'organizations.name as orgName',
      'organizations.slug as orgSlug',
    ])
    .executeTakeFirst();

  if (!invite) {
    return c.json({ error: 'Invite not found or expired' }, 404);
  }

  return c.json({ invite });
});

// Accept invite (requires auth)
invitesRoute.post('/:token/accept', async (c) => {
  const { token } = c.req.param();

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: 'Unauthorized - please sign in first' }, 401);
  }

  const invite = await db
    .selectFrom('org_invites')
    .where('token', '=', token)
    .where('expiresAt', '>', new Date())
    .selectAll()
    .executeTakeFirst();

  if (!invite) {
    return c.json({ error: 'Invite not found or expired' }, 404);
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
    return c.json({ success: true, message: 'Already a member' });
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

  return c.json({ success: true, orgSlug: org?.slug });
});
