import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN!;
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
const POLAR_API =
  process.env.NODE_ENV === 'production' ? 'https://api.polar.sh' : 'https://sandbox-api.polar.sh';

// GET /billing/portal
export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');

  if (!orgId) {
    return Response.json({ error: 'orgId required' }, { status: 400 });
  }

  const session = await getSession(request);
  if (!session) {
    redirect(`${SITE_URL}/login`);
  }

  const org = await db
    .selectFrom('organizations')
    .innerJoin('org_members', 'org_members.orgId', 'organizations.id')
    .where('organizations.id', '=', orgId)
    .where('org_members.userId', '=', session.user.id)
    .where('org_members.role', 'in', ['owner', 'admin'])
    .select(['organizations.polarCustomerId'])
    .executeTakeFirst();

  if (!org?.polarCustomerId) {
    return Response.json({ error: 'No billing account found' }, { status: 404 });
  }

  // Create portal session via Polar API
  const res = await fetch(`${POLAR_API}/v1/customer-portal/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${POLAR_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customer_id: org.polarCustomerId,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('Polar portal error:', error);
    return Response.json({ error: 'Failed to create portal session' }, { status: 500 });
  }

  const portal = await res.json();
  redirect(portal.url);
}
