import { nanoid } from 'nanoid';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

// GET /github/callback
export async function GET(request: Request) {
  const url = new URL(request.url);
  const installationId = url.searchParams.get('installation_id');
  const state = url.searchParams.get('state');

  if (!installationId || !state) {
    redirect(`${SITE_URL}/settings?error=missing_params`);
  }

  let orgId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
    orgId = decoded.orgId;
  } catch {
    redirect(`${SITE_URL}/settings?error=invalid_state`);
  }

  const session = await getSession(request);
  if (!session) {
    redirect(`${SITE_URL}/login`);
  }

  const existing = await db
    .selectFrom('github_installations')
    .where('installationId', '=', installationId)
    .select('id')
    .executeTakeFirst();

  if (existing) {
    await db
      .updateTable('github_installations')
      .set({ orgId, updatedAt: new Date() })
      .where('installationId', '=', installationId)
      .execute();
  } else {
    await db
      .insertInto('github_installations')
      .values({
        id: nanoid(21),
        orgId,
        installationId,
        accessToken: null,
        tokenExpiresAt: null,
        repos: null,
      })
      .execute();
  }

  await db
    .updateTable('organizations')
    .set({ githubInstallationId: installationId })
    .where('id', '=', orgId)
    .execute();

  redirect(`${SITE_URL}/settings?github=connected`);
}
