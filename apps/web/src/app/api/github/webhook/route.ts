import { db } from '@/lib/db';

const GITHUB_APP_WEBHOOK_SECRET = process.env.GITHUB_APP_WEBHOOK_SECRET!;

async function verifyWebhookSignature(body: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(GITHUB_APP_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const computed = `sha256=${Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`;

    return computed === signature;
  } catch {
    return false;
  }
}

// POST /github/webhook
export async function POST(request: Request) {
  const signature = request.headers.get('x-hub-signature-256');
  const event = request.headers.get('x-github-event');

  if (!signature || !event) {
    return Response.json({ error: 'Missing headers' }, { status: 400 });
  }

  const body = await request.text();
  const isValid = await verifyWebhookSignature(body, signature);

  if (!isValid) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(body);

  try {
    switch (event) {
      case 'installation': {
        const { action, installation } = payload;
        const installationId = String(installation.id);

        if (action === 'deleted' || action === 'suspend') {
          await db
            .deleteFrom('github_installations')
            .where('installationId', '=', installationId)
            .execute();

          await db
            .updateTable('organizations')
            .set({ githubInstallationId: null })
            .where('githubInstallationId', '=', installationId)
            .execute();
        }
        break;
      }

      case 'push': {
        // Push events trigger analysis via sandbox
        // For now, just log - actual analysis will call sandbox API
        const defaultBranch = payload.repository.default_branch ?? 'main';
        if (!payload.ref.endsWith(`/${defaultBranch}`)) {
          break;
        }

        const { owner, name: repo } = payload.repository;
        const sha = payload.after;
        console.log(`[webhook] Push to ${owner.login}/${repo}@${defaultBranch} (${sha.slice(0, 7)})`);

        // TODO: Call sandbox API for analysis
        // This will be implemented when sandbox package is ready
        break;
      }

      case 'pull_request': {
        const { action, repository, pull_request } = payload;

        if (action !== 'opened' && action !== 'synchronize') {
          break;
        }

        const { owner, name: repo } = repository;
        const prNumber = pull_request.number;
        const headSha = pull_request.head.sha;

        console.log(`[webhook] PR #${prNumber} ${action} on ${owner.login}/${repo} (${headSha.slice(0, 7)})`);

        // TODO: Call sandbox API for PR analysis
        // This will be implemented when sandbox package is ready
        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return Response.json({ error: 'Processing failed' }, { status: 500 });
  }
}
