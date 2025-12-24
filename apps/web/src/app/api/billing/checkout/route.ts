import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN!;
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
const PRODUCTS = {
  team: process.env.POLAR_PRODUCT_TEAM!,
  pro: process.env.POLAR_PRODUCT_PRO!,
};
const POLAR_API =
  process.env.NODE_ENV === 'production' ? 'https://api.polar.sh' : 'https://sandbox-api.polar.sh';

// GET /billing/checkout
export async function GET(request: Request) {
  const url = new URL(request.url);
  const plan = url.searchParams.get('plan') as 'team' | 'pro' | null;
  const orgId = url.searchParams.get('orgId');

  if (!plan || !PRODUCTS[plan]) {
    return Response.json({ error: 'Invalid plan' }, { status: 400 });
  }
  if (!orgId) {
    return Response.json({ error: 'orgId required' }, { status: 400 });
  }

  const session = await getSession(request);
  if (!session) {
    redirect(`${SITE_URL}/login?callbackUrl=/pricing`);
  }

  const membership = await db
    .selectFrom('org_members')
    .where('orgId', '=', orgId)
    .where('userId', '=', session.user.id)
    .where('role', 'in', ['owner', 'admin'])
    .select('id')
    .executeTakeFirst();

  if (!membership) {
    return Response.json({ error: 'Not authorized' }, { status: 403 });
  }

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
    return Response.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }

  const checkout = await res.json();
  redirect(checkout.url);
}
