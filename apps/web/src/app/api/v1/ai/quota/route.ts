import { validateApiKey } from '@doccov/api-shared';
import { getPlanLimits, type Plan } from '@doccov/db';
import { db } from '@/lib/db';

function getNextMonthReset(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

// GET /v1/ai/quota
export async function GET(request: Request) {
  const validation = await validateApiKey(request, db);
  if (!validation.ok) {
    return Response.json(
      { error: validation.error, docs: validation.docs, upgrade: validation.upgrade },
      { status: validation.status }
    );
  }

  const { org } = validation.context;
  const limits = getPlanLimits(org.plan as Plan);
  const monthlyLimit = limits.aiCallsPerMonth;

  const now = new Date();
  const shouldReset = !org.aiCallsResetAt || now >= org.aiCallsResetAt;

  let used = org.aiCallsUsed;
  let resetAt = org.aiCallsResetAt || getNextMonthReset();

  if (shouldReset) {
    used = 0;
    resetAt = getNextMonthReset();
  }

  return Response.json({
    plan: org.plan,
    used,
    limit: monthlyLimit === Infinity ? 'unlimited' : monthlyLimit,
    remaining: monthlyLimit === Infinity ? 'unlimited' : Math.max(0, monthlyLimit - used),
    resetAt: resetAt.toISOString(),
  });
}
