/**
 * Spec routes - session authenticated endpoints for dashboard
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { auth } from '../auth/config';
import { db } from '../db/client';
import {
  computeFullDiff,
  type DiffOptions,
  diffSpecs,
  formatDiffResponse,
} from '../utils/spec-diff-core';

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

type Env = {
  Variables: {
    session: NonNullable<Session>;
  };
};

export const specRoute = new Hono<Env>();

// Middleware: require session auth
specRoute.use('*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('session', session);
  await next();
});

// Request schemas
const GitHubDiffSchema = z.object({
  mode: z.literal('github'),
  owner: z.string().min(1),
  repo: z.string().min(1),
  base: z.string().min(1),
  head: z.string().min(1),
  installationId: z.string().optional(),
  includeDocsImpact: z.boolean().optional(),
});

const SpecsDiffSchema = z.object({
  mode: z.literal('specs'),
  baseSpec: z.object({}).passthrough(),
  headSpec: z.object({}).passthrough(),
  markdownFiles: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
      }),
    )
    .optional(),
});

const DiffRequestSchema = z.discriminatedUnion('mode', [GitHubDiffSchema, SpecsDiffSchema]);

/**
 * POST /spec/diff - Compare two specs
 *
 * Supports two modes:
 * 1. GitHub refs: Clone and compare specs from GitHub refs
 * 2. Direct specs: Compare uploaded spec objects
 */
specRoute.post('/diff', async (c) => {
  const session = c.get('session');

  // Parse and validate request body
  let body: z.infer<typeof DiffRequestSchema>;
  try {
    const rawBody = await c.req.json();
    body = DiffRequestSchema.parse(rawBody);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json(
        {
          error: 'Invalid request',
          details: err.errors,
        },
        400,
      );
    }
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  try {
    if (body.mode === 'github') {
      // GitHub mode: need to verify access and get installation
      const { owner, repo, base, head, installationId, includeDocsImpact } = body;

      // Find installation ID if not provided
      let resolvedInstallationId = installationId;

      if (!resolvedInstallationId) {
        // Look up installation from user's orgs
        const installation = await db
          .selectFrom('github_installations')
          .innerJoin('org_members', 'org_members.orgId', 'github_installations.orgId')
          .where('org_members.userId', '=', session.user.id)
          .select(['github_installations.installationId'])
          .executeTakeFirst();

        if (!installation) {
          return c.json(
            {
              error: 'No GitHub App installation found for this repository',
              hint: 'Install the DocCov GitHub App to compare repos',
            },
            403,
          );
        }

        resolvedInstallationId = installation.installationId;
      }

      // Compute diff with timeout
      const diffOptions: DiffOptions = {
        includeDocsImpact,
      };

      const result = await Promise.race([
        computeFullDiff(
          { owner, repo, ref: base, installationId: resolvedInstallationId },
          { owner, repo, ref: head, installationId: resolvedInstallationId },
          diffOptions,
        ),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 60_000)),
      ]);

      return c.json(formatDiffResponse(result));
    }

    // Specs mode: direct comparison
    const { baseSpec, headSpec, markdownFiles } = body;

    const diff = diffSpecs(
      baseSpec as Parameters<typeof diffSpecs>[0],
      headSpec as Parameters<typeof diffSpecs>[1],
      markdownFiles,
    );

    return c.json({
      // Core diff fields
      breaking: diff.breaking,
      nonBreaking: diff.nonBreaking,
      docsOnly: diff.docsOnly,
      coverageDelta: diff.coverageDelta,
      oldCoverage: diff.oldCoverage,
      newCoverage: diff.newCoverage,
      driftIntroduced: diff.driftIntroduced,
      driftResolved: diff.driftResolved,
      newUndocumented: diff.newUndocumented,
      improvedExports: diff.improvedExports,
      regressedExports: diff.regressedExports,

      // Extended fields
      memberChanges: diff.memberChanges,
      categorizedBreaking: diff.categorizedBreaking,
      docsImpact: diff.docsImpact,

      // Metadata
      generatedAt: new Date().toISOString(),
      cached: false,
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'TIMEOUT') {
        return c.json({ error: 'Spec generation timed out' }, 408);
      }
      if (err.message.includes('not found') || err.message.includes('404')) {
        return c.json({ error: 'Repository or ref not found' }, 404);
      }
      if (err.message.includes('No token')) {
        return c.json({ error: 'GitHub App access required' }, 403);
      }
    }

    console.error('Spec diff error:', err);
    return c.json({ error: 'Failed to compute diff' }, 500);
  }
});
