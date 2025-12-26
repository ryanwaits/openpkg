import { db } from '@/lib/db';

const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET!;

async function verifyPolarWebhook(body: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(POLAR_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const computed = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Polar uses different signature formats depending on version
    return signature === computed || signature === `sha256=${computed}`;
  } catch {
    return false;
  }
}

// POST /billing/webhook - Polar webhook handler with TRANSACTION support
export async function POST(request: Request) {
  const signature =
    request.headers.get('polar-signature') || request.headers.get('x-polar-signature');

  if (!signature) {
    return Response.json({ error: 'Missing signature' }, { status: 400 });
  }

  const body = await request.text();
  const isValid = await verifyPolarWebhook(body, signature);

  if (!isValid) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(body);
  const { type, data } = payload;

  try {
    switch (type) {
      case 'subscription.active': {
        const metadata = data.metadata as { orgId?: string; plan?: string };
        if (!metadata?.orgId || !metadata?.plan) {
          console.error('Missing metadata in subscription.active:', data.id);
          break;
        }

        const orgId = metadata.orgId;
        const plan = metadata.plan as 'team' | 'pro';

        // Use transaction to ensure atomic update (fixes CRITICAL audit issue)
        await db.transaction().execute(async (trx) => {
          await trx
            .updateTable('organizations')
            .set({
              plan,
              polarCustomerId: data.customerId,
              polarSubscriptionId: data.id,
            })
            .where('id', '=', orgId)
            .execute();
        });

        console.log(`Org ${metadata.orgId} upgraded to ${metadata.plan}`);
        break;
      }

      case 'subscription.canceled':
      case 'subscription.revoked': {
        const org = await db
          .selectFrom('organizations')
          .where('polarSubscriptionId', '=', data.id)
          .select('id')
          .executeTakeFirst();

        if (org) {
          await db
            .updateTable('organizations')
            .set({
              plan: 'free',
              ...(type === 'subscription.revoked' ? { polarSubscriptionId: null } : {}),
            })
            .where('id', '=', org.id)
            .execute();
        }
        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return Response.json({ error: 'Processing failed' }, { status: 500 });
  }
}
