import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

// GET /orgs/:slug/invites - List pending invites
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;

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

  const invites = await db
    .selectFrom('org_invites')
    .where('orgId', '=', org.orgId)
    .where('expiresAt', '>', new Date())
    .select(['id', 'email', 'role', 'expiresAt', 'createdAt'])
    .orderBy('createdAt', 'desc')
    .execute();

  return Response.json({ invites });
}

// POST /orgs/:slug/invites - Create invite
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;
  const body = (await request.json()) as { email: string; role: 'admin' | 'member' };

  // Verify owner/admin
  const org = await db
    .selectFrom('organizations')
    .innerJoin('org_members', 'org_members.orgId', 'organizations.id')
    .where('organizations.slug', '=', slug)
    .where('org_members.userId', '=', session.user.id)
    .where('org_members.role', 'in', ['owner', 'admin'])
    .select(['organizations.id as orgId', 'organizations.name'])
    .executeTakeFirst();

  if (!org) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check if already a member
  const existingMember = await db
    .selectFrom('org_members')
    .innerJoin('user', 'user.id', 'org_members.userId')
    .where('org_members.orgId', '=', org.orgId)
    .where('user.email', '=', body.email)
    .select('org_members.id')
    .executeTakeFirst();

  if (existingMember) {
    return Response.json({ error: 'User is already a member' }, { status: 400 });
  }

  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invite = await db
    .insertInto('org_invites')
    .values({
      id: nanoid(21),
      orgId: org.orgId,
      email: body.email,
      role: body.role || 'member',
      token,
      expiresAt,
      createdBy: session.user.id,
    })
    .returningAll()
    .executeTakeFirst();

  const inviteUrl = `${SITE_URL}/invite/${token}`;

  return Response.json({ invite, inviteUrl }, { status: 201 });
}
