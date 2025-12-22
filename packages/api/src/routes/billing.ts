import { getPlanLimits, type Plan } from '@doccov/db';
import { CustomerPortal, Webhooks } from '@polar-sh/hono';
import { Hono } from 'hono';
import { auth } from '../auth/config';
import { db } from '../db/client';

export const billingRoute = new Hono();

const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN!;
const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET!;
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';

const PRODUCTS = {
  team: process.env.POLAR_PRODUCT_TEAM!,
  pro: process.env.POLAR_PRODUCT_PRO!,
};

const POLAR_API =
  process.env.NODE_ENV === 'production' ? 'https://api.polar.sh' : 'https://sandbox-api.polar.sh';

// ============ Checkout ============
billingRoute.get('/checkout', async (c) => {
  const plan = c.req.query('plan') as 'team' | 'pro';
  const orgId = c.req.query('orgId');

  if (!plan || !PRODUCTS[plan]) {
    return c.json({ error: 'Invalid plan' }, 400);
  }
  if (!orgId) {
    return c.json({ error: 'orgId required' }, 400);
  }

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.redirect(`${SITE_URL}/login?callbackUrl=/pricing`);
  }

  // Verify user is owner/admin of org
  const membership = await db
    .selectFrom('org_members')
    .where('orgId', '=', orgId)
    .where('userId', '=', session.user.id)
    .where('role', 'in', ['owner', 'admin'])
    .select('id')
    .executeTakeFirst();

  if (!membership) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  // Create Polar checkout session via API
  const res = await fetch(`${POLAR_API}/v1/checkouts/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${POLAR_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      products: [PRODUCTS[plan]],
      success_url: `${SITE_URL}/dashboard?upgraded=true`,
      metadata: { orgId, plan },
      customer_email: session.user.email,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('Polar checkout error:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }

  const checkout = await res.json();
  return c.redirect(checkout.url);
});

// ============ Customer Portal ============
billingRoute.get('/portal', async (c) => {
  const orgId = c.req.query('orgId');
  if (!orgId) return c.json({ error: 'orgId required' }, 400);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.redirect(`${SITE_URL}/login`);

  const org = await db
    .selectFrom('organizations')
    .innerJoin('org_members', 'org_members.orgId', 'organizations.id')
    .where('organizations.id', '=', orgId)
    .where('org_members.userId', '=', session.user.id)
    .where('org_members.role', 'in', ['owner', 'admin'])
    .select(['organizations.polarCustomerId'])
    .executeTakeFirst();

  if (!org?.polarCustomerId) {
    return c.json({ error: 'No billing account found' }, 404);
  }

  const portalHandler = CustomerPortal({
    accessToken: POLAR_ACCESS_TOKEN,
    getCustomerId: async () => org.polarCustomerId!,
    server: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
  });

  return portalHandler(c);
});

// ============ Webhooks ============
billingRoute.post(
  '/webhook',
  Webhooks({
    webhookSecret: POLAR_WEBHOOK_SECRET,

    onSubscriptionActive: async (payload) => {
      const subscription = payload.data;
      const metadata = subscription.metadata as { orgId?: string; plan?: string };

      if (!metadata?.orgId || !metadata?.plan) {
        console.error('Missing metadata:', subscription.id);
        return;
      }

      await db
        .updateTable('organizations')
        .set({
          plan: metadata.plan as 'team' | 'pro',
          polarCustomerId: subscription.customerId,
          polarSubscriptionId: subscription.id,
        })
        .where('id', '=', metadata.orgId)
        .execute();

      console.log(`Org ${metadata.orgId} upgraded to ${metadata.plan}`);
    },

    onSubscriptionCanceled: async (payload) => {
      const subscription = payload.data;

      const org = await db
        .selectFrom('organizations')
        .where('polarSubscriptionId', '=', subscription.id)
        .select('id')
        .executeTakeFirst();

      if (org) {
        await db
          .updateTable('organizations')
          .set({ plan: 'free' })
          .where('id', '=', org.id)
          .execute();
      }
    },

    onSubscriptionRevoked: async (payload) => {
      const subscription = payload.data;

      const org = await db
        .selectFrom('organizations')
        .where('polarSubscriptionId', '=', subscription.id)
        .select('id')
        .executeTakeFirst();

      if (org) {
        await db
          .updateTable('organizations')
          .set({ plan: 'free', polarSubscriptionId: null })
          .where('id', '=', org.id)
          .execute();
      }
    },
  }),
);

// ============ Status ============
billingRoute.get('/status', async (c) => {
  const orgId = c.req.query('orgId');
  if (!orgId) return c.json({ error: 'orgId required' }, 400);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

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

  if (!org) return c.json({ error: 'Organization not found' }, 404);

  return c.json({
    plan: org.plan,
    hasSubscription: !!org.polarSubscriptionId,
    usage: { aiCalls: org.aiCallsUsed, resetAt: org.aiCallsResetAt },
    portalUrl: org.polarCustomerId ? `${API_URL}/billing/portal?orgId=${orgId}` : null,
  });
});

// ============ Usage Details ============
billingRoute.get('/usage', async (c) => {
  const orgId = c.req.query('orgId');
  if (!orgId) return c.json({ error: 'orgId required' }, 400);

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  // Get org with member count
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

  if (!org) return c.json({ error: 'Organization not found' }, 404);

  // Get member count
  const memberResult = await db
    .selectFrom('org_members')
    .where('orgId', '=', orgId)
    .select(db.fn.countAll<number>().as('count'))
    .executeTakeFirst();

  const seats = memberResult?.count ?? 1;
  const limits = getPlanLimits(org.plan as Plan);

  // Calculate next reset date
  const now = new Date();
  const resetAt = org.aiCallsResetAt || new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const shouldReset = !org.aiCallsResetAt || now >= org.aiCallsResetAt;
  const aiUsed = shouldReset ? 0 : org.aiCallsUsed;

  // Calculate pricing based on plan
  const pricing: Record<string, number> = { free: 0, team: 15, pro: 49 };
  const monthlyCost = (pricing[org.plan] ?? 0) * seats;

  return c.json({
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
});
