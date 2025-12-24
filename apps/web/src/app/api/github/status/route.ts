import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /github/status
export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');

  if (!orgId) {
    return Response.json({ error: 'orgId required' }, { status: 400 });
  }

  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const installation = await db
    .selectFrom('github_installations')
    .where('orgId', '=', orgId)
    .select(['id', 'installationId', 'createdAt'])
    .executeTakeFirst();

  return Response.json({
    installed: !!installation,
    installationId: installation?.installationId,
    installedAt: installation?.createdAt,
  });
}
