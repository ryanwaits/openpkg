import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// DELETE /api-keys/:keyId - Revoke key
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { keyId } = await params;

  const key = await db
    .selectFrom('api_keys')
    .where('id', '=', keyId)
    .select(['id', 'orgId'])
    .executeTakeFirst();

  if (!key) {
    return Response.json({ error: 'Key not found' }, { status: 404 });
  }

  const membership = await db
    .selectFrom('org_members')
    .where('orgId', '=', key.orgId)
    .where('userId', '=', session.user.id)
    .where('role', 'in', ['owner', 'admin'])
    .select('role')
    .executeTakeFirst();

  if (!membership) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  await db.deleteFrom('api_keys').where('id', '=', keyId).execute();

  return Response.json({ deleted: true });
}
