/**
 * GitHub App routes for installation and webhooks
 */

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { auth } from '../auth/config';
import { db } from '../db/client';
import { listInstallationRepos } from '../utils/github-app';
import { createCheckRun, postPRComment } from '../utils/github-checks';
import { analyzeRemoteRepo, computeAnalysisDiff } from '../utils/remote-analyzer';

const GITHUB_APP_WEBHOOK_SECRET = process.env.GITHUB_APP_WEBHOOK_SECRET!;
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

export const githubAppRoute = new Hono();

// ============ Installation Flow ============

// Redirect to GitHub App installation
githubAppRoute.get('/install', async (c) => {
  const orgId = c.req.query('orgId');
  if (!orgId) {
    return c.json({ error: 'orgId required' }, 400);
  }

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.redirect(`${SITE_URL}/login?callbackUrl=/settings`);
  }

  // Verify user has access to org
  const membership = await db
    .selectFrom('org_members')
    .where('orgId', '=', orgId)
    .where('userId', '=', session.user.id)
    .where('role', 'in', ['owner', 'admin'])
    .select('id')
    .executeTakeFirst();

  if (!membership) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Redirect to GitHub App installation with state
  const state = Buffer.from(JSON.stringify({ orgId })).toString('base64');
  const installUrl = `https://github.com/apps/doccov/installations/new?state=${state}`;

  return c.redirect(installUrl);
});

// Handle installation callback
githubAppRoute.get('/callback', async (c) => {
  const installationId = c.req.query('installation_id');
  const state = c.req.query('state');

  if (!installationId || !state) {
    return c.redirect(`${SITE_URL}/settings?error=missing_params`);
  }

  let orgId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
    orgId = decoded.orgId;
  } catch {
    return c.redirect(`${SITE_URL}/settings?error=invalid_state`);
  }

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.redirect(`${SITE_URL}/login`);
  }

  // Check if installation already exists
  const existing = await db
    .selectFrom('github_installations')
    .where('installationId', '=', installationId)
    .select('id')
    .executeTakeFirst();

  if (existing) {
    // Update org reference if different
    await db
      .updateTable('github_installations')
      .set({ orgId, updatedAt: new Date() })
      .where('installationId', '=', installationId)
      .execute();
  } else {
    // Create new installation record
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

  // Also update the org's githubInstallationId for quick lookup
  await db
    .updateTable('organizations')
    .set({ githubInstallationId: installationId })
    .where('id', '=', orgId)
    .execute();

  return c.redirect(`${SITE_URL}/settings?github=connected`);
});

// ============ Webhook Handler ============

githubAppRoute.post('/webhook', async (c) => {
  const signature = c.req.header('x-hub-signature-256');
  const event = c.req.header('x-github-event');

  if (!signature || !event) {
    return c.json({ error: 'Missing headers' }, 400);
  }

  // Verify webhook signature
  const body = await c.req.text();
  const isValid = await verifyWebhookSignature(body, signature);

  if (!isValid) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const payload = JSON.parse(body);

  // Handle different events
  switch (event) {
    case 'installation':
      await handleInstallationEvent(payload);
      break;

    case 'push':
      await handlePushEvent(payload);
      break;

    case 'pull_request':
      await handlePullRequestEvent(payload);
      break;
  }

  return c.json({ received: true });
});

// ============ API Endpoints ============

// List repos accessible via GitHub App
githubAppRoute.get('/repos', async (c) => {
  const orgId = c.req.query('orgId');
  if (!orgId) {
    return c.json({ error: 'orgId required' }, 400);
  }

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Verify membership
  const membership = await db
    .selectFrom('org_members')
    .where('orgId', '=', orgId)
    .where('userId', '=', session.user.id)
    .select('id')
    .executeTakeFirst();

  if (!membership) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const repos = await listInstallationRepos(orgId);

  if (!repos) {
    return c.json(
      {
        error: 'No GitHub App installation found',
        installUrl: `/github/install?orgId=${orgId}`,
      },
      404,
    );
  }

  return c.json({ repos });
});

// Check installation status
githubAppRoute.get('/status', async (c) => {
  const orgId = c.req.query('orgId');
  if (!orgId) {
    return c.json({ error: 'orgId required' }, 400);
  }

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const installation = await db
    .selectFrom('github_installations')
    .where('orgId', '=', orgId)
    .select(['id', 'installationId', 'createdAt'])
    .executeTakeFirst();

  return c.json({
    installed: !!installation,
    installationId: installation?.installationId,
    installedAt: installation?.createdAt,
  });
});

// ============ Helpers ============

async function verifyWebhookSignature(body: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(GITHUB_APP_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
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

async function handleInstallationEvent(payload: { action: string; installation: { id: number } }) {
  const { action, installation } = payload;
  const installationId = String(installation.id);

  if (action === 'deleted' || action === 'suspend') {
    // Remove installation
    await db
      .deleteFrom('github_installations')
      .where('installationId', '=', installationId)
      .execute();

    // Clear from org
    await db
      .updateTable('organizations')
      .set({ githubInstallationId: null })
      .where('githubInstallationId', '=', installationId)
      .execute();
  }
}

async function handlePushEvent(payload: {
  installation: { id: number };
  repository: { owner: { login: string }; name: string; default_branch?: string };
  after: string;
  ref: string;
}) {
  // Only process pushes to default branch
  const defaultBranch = payload.repository.default_branch ?? 'main';
  if (!payload.ref.endsWith(`/${defaultBranch}`)) {
    return;
  }

  const installationId = String(payload.installation.id);
  const { owner, name: repo } = payload.repository;
  const sha = payload.after;

  console.log(`[webhook] Push to ${owner.login}/${repo}@${defaultBranch} (${sha.slice(0, 7)})`);

  // Run actual analysis
  const result = await analyzeRemoteRepo(installationId, owner.login, repo, sha);

  if (result) {
    console.log(`[webhook] Analysis complete: ${result.coverageScore}% coverage`);

    // Create check run with analysis results
    await createCheckRun(installationId, owner.login, repo, sha, result);

    // Update project in database with latest coverage
    await db
      .updateTable('projects')
      .set({
        coverageScore: result.coverageScore,
        driftCount: result.driftCount,
        updatedAt: new Date(),
      })
      .where('fullName', '=', `${owner.login}/${repo}`)
      .execute();
  } else {
    console.log(`[webhook] Analysis failed for ${owner.login}/${repo}`);
  }
}

async function handlePullRequestEvent(payload: {
  action: string;
  installation: { id: number };
  repository: { owner: { login: string }; name: string };
  pull_request: {
    number: number;
    head: { sha: string };
  };
}) {
  const { action, installation, repository, pull_request } = payload;

  // Only process opened and synchronize (new commits)
  if (action !== 'opened' && action !== 'synchronize') {
    return;
  }

  const installationId = String(installation.id);
  const { owner, name: repo } = repository;
  const prNumber = pull_request.number;
  const headSha = pull_request.head.sha;

  console.log(
    `[webhook] PR #${prNumber} ${action} on ${owner.login}/${repo} (${headSha.slice(0, 7)})`,
  );

  // Analyze PR head (the changes)
  const headResult = await analyzeRemoteRepo(installationId, owner.login, repo, headSha);

  if (!headResult) {
    console.log(`[webhook] Analysis failed for PR #${prNumber}`);
    return;
  }

  console.log(`[webhook] PR analysis complete: ${headResult.coverageScore}% coverage`);

  // Try to get baseline from database or analyze base
  let diff: ReturnType<typeof computeAnalysisDiff> | null = null;

  // First check if we have cached baseline in project
  const project = await db
    .selectFrom('projects')
    .where('fullName', '=', `${owner.login}/${repo}`)
    .select(['coverageScore', 'driftCount'])
    .executeTakeFirst();

  if (project && project.coverageScore !== null) {
    // Use cached baseline for speed
    diff = computeAnalysisDiff(
      {
        coverageScore: project.coverageScore,
        documentedExports: 0,
        totalExports: 0,
        driftCount: project.driftCount ?? 0,
        qualityErrors: 0,
        qualityWarnings: 0,
      },
      headResult,
    );
  }

  // Create check run and post PR comment
  await Promise.all([
    createCheckRun(installationId, owner.login, repo, headSha, headResult, diff),
    postPRComment(installationId, owner.login, repo, prNumber, headResult, diff),
  ]);
}
