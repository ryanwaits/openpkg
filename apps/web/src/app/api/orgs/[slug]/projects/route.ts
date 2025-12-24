import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /orgs/:slug/projects - List org's projects
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;

  const membership = await db
    .selectFrom('org_members')
    .innerJoin('organizations', 'organizations.id', 'org_members.orgId')
    .where('organizations.slug', '=', slug)
    .where('org_members.userId', '=', session.user.id)
    .select(['org_members.orgId'])
    .executeTakeFirst();

  if (!membership) {
    return Response.json({ error: 'Organization not found' }, { status: 404 });
  }

  const projects = await db
    .selectFrom('projects')
    .where('orgId', '=', membership.orgId)
    .selectAll()
    .execute();

  return Response.json({ projects });
}

// POST /orgs/:slug/projects - Create a project
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;
  const body = await request.json() as { name: string; fullName: string; isPrivate?: boolean };

  const membership = await db
    .selectFrom('org_members')
    .innerJoin('organizations', 'organizations.id', 'org_members.orgId')
    .where('organizations.slug', '=', slug)
    .where('org_members.userId', '=', session.user.id)
    .where('org_members.role', 'in', ['owner', 'admin'])
    .select(['org_members.orgId'])
    .executeTakeFirst();

  if (!membership) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const project = await db
    .insertInto('projects')
    .values({
      id: nanoid(21),
      orgId: membership.orgId,
      name: body.name,
      fullName: body.fullName,
      isPrivate: body.isPrivate ?? false,
      defaultBranch: 'main',
    })
    .returningAll()
    .executeTakeFirst();

  return Response.json({ project }, { status: 201 });
}
