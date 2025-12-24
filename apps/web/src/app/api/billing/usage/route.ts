import { getPlanLimits, type Plan } from '@doccov/db';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// GET /billing/usage
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
      'organizations.id',
      'organizations.plan',
      'organizations.aiCallsUsed',
      'organizations.aiCallsResetAt',
    ])
    .executeTakeFirst();

  if (!org) {
    return Response.json({ error: 'Organization not found' }, { status: 404 });
  }

  const memberResult = await db
    .selectFrom('org_members')
    .where('orgId', '=', orgId)
    .select(db.fn.countAll<number>().as('count'))
    .executeTakeFirst();

  const seats = memberResult?.count ?? 1;
  const limits = getPlanLimits(org.plan as Plan);

  const now = new Date();
  const resetAt = org.aiCallsResetAt || new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const shouldReset = !org.aiCallsResetAt || now >= org.aiCallsResetAt;
  const aiUsed = shouldReset ? 0 : org.aiCallsUsed;

  const pricing: Record<string, number> = { free: 0, team: 15, pro: 49 };
  const monthlyCost = (pricing[org.plan] ?? 0) * seats;

  return Response.json({
    plan: org.plan,
    seats,
    monthlyCost,
    aiCalls: {
      used: aiUsed,
      limit: limits.aiCallsPerMonth === Infinity ? 'unlimited' : limits.aiCallsPerMonth,
      resetAt: resetAt.toISOString(),
    },
    analyses: {
      limit: limits.analysesPerDay === Infinity ? 'unlimited' : limits.analysesPerDay,
      resetAt: 'daily',
    },
    history: {
      days: limits.historyDays,
    },
    privateRepos: limits.privateRepos === Infinity,
  });
}
