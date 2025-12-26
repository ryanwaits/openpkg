import { validateApiKey } from '@doccov/api-shared';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getInstallationToken } from '@/lib/github-app';

const SANDBOX_URL = process.env.SANDBOX_URL;

const GitHubDiffSchema = z.object({
  mode: z.literal('github'),
  owner: z.string().min(1),
  repo: z.string().min(1),
  base: z.string().min(1),
  head: z.string().min(1),
  includeDocsImpact: z.boolean().optional(),
});

const SpecsDiffSchema = z.object({
  mode: z.literal('specs'),
  baseSpec: z.object({}).passthrough(),
  headSpec: z.object({}).passthrough(),
  markdownFiles: z.array(z.object({ path: z.string(), content: z.string() })).optional(),
});

const DiffRequestSchema = z.discriminatedUnion('mode', [GitHubDiffSchema, SpecsDiffSchema]);

// POST /v1/spec/diff
export async function POST(request: Request) {
  const validation = await validateApiKey(request, db);
  if (!validation.ok) {
    return Response.json(
      { error: validation.error, docs: validation.docs, upgrade: validation.upgrade },
      { status: validation.status },
    );
  }

  const { org } = validation.context;

  let body: z.infer<typeof DiffRequestSchema>;
  try {
    const rawBody = await request.json();
    body = DiffRequestSchema.parse(rawBody);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'Invalid request', details: err.errors }, { status: 400 });
    }
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!SANDBOX_URL) {
    return Response.json({ error: 'Diff service not available' }, { status: 501 });
  }

  try {
    if (body.mode === 'github') {
      const { owner, repo, base, head, includeDocsImpact } = body;

      // Get access token for this org
      const accessToken = await getInstallationToken(org.id);
      if (!accessToken) {
        return Response.json(
          {
            error: 'No GitHub App installation found',
            hint: 'Install the DocCov GitHub App to compare repos',
          },
          { status: 403 },
        );
      }

      const sandboxRes = await fetch(`${SANDBOX_URL}/diff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': process.env.SANDBOX_SECRET!,
        },
        body: JSON.stringify({
          mode: 'github',
          owner,
          repo,
          base,
          head,
          accessToken,
          includeDocsImpact,
        }),
      });

      if (!sandboxRes.ok) {
        const error = await sandboxRes.json().catch(() => ({ error: 'Sandbox error' }));
        return Response.json(error, { status: sandboxRes.status });
      }

      return Response.json(await sandboxRes.json());
    }

    // Specs mode: proxy to sandbox
    const sandboxRes = await fetch(`${SANDBOX_URL}/diff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': process.env.SANDBOX_SECRET!,
      },
      body: JSON.stringify(body),
    });

    if (!sandboxRes.ok) {
      const error = await sandboxRes.json().catch(() => ({ error: 'Sandbox error' }));
      return Response.json(error, { status: sandboxRes.status });
    }

    return Response.json(await sandboxRes.json());
  } catch (err) {
    console.error('Spec diff error:', err);
    return Response.json({ error: 'Failed to compute diff' }, { status: 500 });
  }
}
