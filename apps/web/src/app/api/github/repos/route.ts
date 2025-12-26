import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// TODO: Import from @doccov/api-shared when moved there
// For now, stub the function - will be connected to sandbox
async function listInstallationRepos(orgId: string) {
  // Get installation
  const installation = await db
    .selectFrom('github_installations')
    .where('orgId', '=', orgId)
    .select(['installationId', 'repos'])
    .executeTakeFirst();

  if (!installation) {
    return null;
  }

  // If we have cached repos, return them
  if (installation.repos) {
    try {
      return JSON.parse(installation.repos);
    } catch {
      // Fall through to fetch
    }
  }

  // TODO: Fetch from GitHub API using installation token
  // This requires the github-app utilities to be moved to api-shared
  return [];
}

// GET /github/repos
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

  const membership = await db
    .selectFrom('org_members')
    .where('orgId', '=', orgId)
    .where('userId', '=', session.user.id)
    .select('id')
    .executeTakeFirst();

  if (!membership) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const repos = await listInstallationRepos(orgId);

  if (!repos) {
    return Response.json(
      {
        error: 'No GitHub App installation found',
        installUrl: `/github/install?orgId=${orgId}`,
      },
      { status: 404 },
    );
  }

  return Response.json({ repos });
}
