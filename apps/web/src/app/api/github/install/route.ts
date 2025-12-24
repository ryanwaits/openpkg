import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

// GET /github/install
export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');

  if (!orgId) {
    return Response.json({ error: 'orgId required' }, { status: 400 });
  }

  const session = await getSession(request);
  if (!session) {
    redirect(`${SITE_URL}/login?callbackUrl=/settings`);
  }

  const membership = await db
    .selectFrom('org_members')
    .where('orgId', '=', orgId)
    .where('userId', '=', session.user.id)
    .where('role', 'in', ['owner', 'admin'])
    .select('id')
    .executeTakeFirst();

  if (!membership) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const state = Buffer.from(JSON.stringify({ orgId })).toString('base64');
  const installUrl = `https://github.com/apps/doccov/installations/new?state=${state}`;

  redirect(installUrl);
}
