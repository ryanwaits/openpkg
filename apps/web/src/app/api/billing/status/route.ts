import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

const API_URL = process.env.API_URL || 'http://localhost:3001';

// GET /billing/status
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

  const org = await db
    .selectFrom('organizations')
    .innerJoin('org_members', 'org_members.orgId', 'organizations.id')
    .where('organizations.id', '=', orgId)
    .where('org_members.userId', '=', session.user.id)
    .select([
      'organizations.plan',
      'organizations.polarCustomerId',
      'organizations.polarSubscriptionId',
      'organizations.aiCallsUsed',
      'organizations.aiCallsResetAt',
    ])
    .executeTakeFirst();

  if (!org) {
    return Response.json({ error: 'Organization not found' }, { status: 404 });
  }

  return Response.json({
    plan: org.plan,
    hasSubscription: !!org.polarSubscriptionId,
    usage: { aiCalls: org.aiCallsUsed, resetAt: org.aiCallsResetAt },
    portalUrl: org.polarCustomerId ? `${API_URL}/billing/portal?orgId=${orgId}` : null,
  });
}
