/**
 * POST /plan - Generate a build plan for a GitHub repository
 *
 * Request body:
 * - url: GitHub repository URL (required)
 * - ref: Git ref (branch/tag), defaults to default branch
 * - package: Target package name (for monorepos)
 *
 * Response:
 * - BuildPlan object with steps, environment, and reasoning
 */

import { fetchGitHubContext, parseScanGitHubUrl } from '@doccov/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateBuildPlan } from '../lib/plan-agent';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

interface PlanRequestBody {
  url: string;
  ref?: string;
  package?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as PlanRequestBody;

  if (!body.url) {
    return res.status(400).json({ error: 'url is required' });
  }

  // Validate URL format
  let repoUrl: string;
  try {
    const parsed = parseScanGitHubUrl(body.url);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid GitHub URL' });
    }
    repoUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;
  } catch {
    return res.status(400).json({ error: 'Invalid GitHub URL' });
  }

  try {
    // Fetch project context from GitHub
    const context = await fetchGitHubContext(repoUrl, body.ref);

    // Check for private repos (we can't access them without auth)
    if (context.metadata.isPrivate) {
      return res.status(403).json({
        error: 'Private repositories are not supported',
        hint: 'Use a public repository or run doccov locally',
      });
    }

    // Generate build plan using AI
    const plan = await generateBuildPlan(context, {
      targetPackage: body.package,
    });

    return res.status(200).json({
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
        return res.status(404).json({ error: 'Repository not found' });
      }
      if (error.message.includes('rate limit')) {
        return res.status(429).json({ error: 'GitHub API rate limit exceeded' });
      }
    }

    return res.status(500).json({
      error: 'Failed to generate build plan',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
