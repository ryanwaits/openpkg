/**
 * Plan route for local development (mirrors api/plan.ts)
 * Does NOT use Vercel Sandbox - only GitHub API + Anthropic Claude
 */

import { fetchGitHubContext, parseScanGitHubUrl } from '@doccov/sdk';
import { Hono } from 'hono';
import { generateBuildPlan } from '../../lib/plan-agent';

export const planRoute = new Hono();

planRoute.post('/', async (c) => {
  const body = await c.req.json<{ url: string; ref?: string; package?: string }>();

  if (!body.url) {
    return c.json({ error: 'url is required' }, 400);
  }

  // Validate URL format
  let repoUrl: string;
  try {
    const parsed = parseScanGitHubUrl(body.url);
    if (!parsed) {
      return c.json({ error: 'Invalid GitHub URL' }, 400);
    }
    repoUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;
  } catch {
    return c.json({ error: 'Invalid GitHub URL' }, 400);
  }

  try {
    // Fetch project context from GitHub
    const context = await fetchGitHubContext(repoUrl, body.ref);

    // Check for private repos
    if (context.metadata.isPrivate) {
      return c.json(
        {
          error: 'Private repositories are not supported',
          hint: 'Use a public repository or run doccov locally',
        },
        403,
      );
    }

    // Generate build plan using AI
    const plan = await generateBuildPlan(context, {
      targetPackage: body.package,
    });

    return c.json({
      plan,
      context: {
        owner: context.metadata.owner,
        repo: context.metadata.repo,
        ref: context.ref,
        packageManager: context.packageManager,
        isMonorepo: context.workspace.isMonorepo,
      },
    });
  } catch (error) {
    console.error('Plan generation error:', error);

    if (error instanceof Error) {
      if (error.message.includes('404') || error.message.includes('not found')) {
        return c.json({ error: 'Repository not found' }, 404);
      }
      if (error.message.includes('rate limit')) {
        return c.json({ error: 'GitHub API rate limit exceeded' }, 429);
      }
    }

    return c.json(
      {
        error: 'Failed to generate build plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});
