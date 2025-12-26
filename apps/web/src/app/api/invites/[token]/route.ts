import { db } from '@/lib/db';

// GET /invites/:token - Get invite info (public)
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

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
    return Response.json({ error: 'Invite not found or expired' }, { status: 404 });
  }

  return Response.json({ invite });
}
