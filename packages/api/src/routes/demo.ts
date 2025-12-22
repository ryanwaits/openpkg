/**
 * Demo route - public "Try it Now" endpoint for analyzing npm packages
 * Uses the /plan and /execute-stream endpoints from the Vercel API
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { anonymousRateLimit } from '../middleware/anonymous-rate-limit';

export const demoRoute = new Hono();

// Vercel API URL (where /plan and /execute-stream live)
const VERCEL_API_URL = process.env.VERCEL_API_URL || 'https://api-khaki-phi.vercel.app';

// Rate limit: 5 analyses per hour per IP
demoRoute.use(
  '*',
  anonymousRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: 'Demo limit reached. Sign up for unlimited access.',
    upgradeUrl: 'https://doccov.com/pricing',
  }),
);

/**
 * npm package info from registry
 */
interface NpmPackageInfo {
  name: string;
  version: string;
  description?: string;
  repository?: string;
}

/**
 * Fetch package info from npm registry
 */
async function fetchNpmPackage(packageName: string): Promise<NpmPackageInfo> {
  const encodedName = encodeURIComponent(packageName);
  const url = `https://registry.npmjs.org/${encodedName}/latest`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Package "${packageName}" not found on npm`);
    }
    throw new Error(`npm registry error: ${res.status}`);
  }

  const data = (await res.json()) as {
    name: string;
    version: string;
    description?: string;
    repository?: string | { type?: string; url?: string };
  };

  // Extract and normalize GitHub URL from repository field
  let repoUrl: string | undefined;
  if (data.repository) {
    if (typeof data.repository === 'string') {
      repoUrl = data.repository;
    } else if (data.repository.url) {
      // Normalize: git+https://github.com/... or git://github.com/...
      repoUrl = data.repository.url
        .replace(/^git\+/, '')
        .replace(/^git:\/\//, 'https://')
        .replace(/\.git$/, '');
    }
  }

  // Validate it's a GitHub URL
  if (repoUrl && !repoUrl.includes('github.com')) {
    repoUrl = undefined;
  }

  return {
    name: data.name,
    version: data.version,
    description: data.description,
    repository: repoUrl,
  };
}

/**
 * Analysis result summary (matches SpecSummary from Vercel API)
 */
interface AnalysisSummary {
  packageName: string;
  version: string;
  coverage: number;
  exportCount: number;
  documentedCount: number;
  undocumentedCount: number;
  driftCount: number;
  topUndocumented: string[];
  topDrift: Array<{ name: string; issue: string }>;
}

// GET /demo/analyze?package=lodash
demoRoute.get('/analyze', async (c) => {
  const packageName = c.req.query('package');

  if (!packageName) {
    return c.json({ error: 'Package name required' }, 400);
  }

  // Validate package name (basic sanitation)
  if (!/^(@[\w-]+\/)?[\w.-]+$/.test(packageName)) {
    return c.json({ error: 'Invalid package name format' }, 400);
  }

  return streamSSE(c, async (stream) => {
    const sendEvent = async (
      type: 'status' | 'log' | 'result' | 'error',
      data: { step?: string; message?: string; data?: unknown },
    ) => {
      await stream.writeSSE({
        data: JSON.stringify({ type, ...data }),
        event: type === 'error' ? 'error' : type === 'result' ? 'complete' : 'progress',
      });
    };

    try {
      // Step 1: Fetch from npm registry
      await sendEvent('status', {
        step: 'npm',
        message: `Fetching ${packageName} from npm registry...`,
      });

      const npmInfo = await fetchNpmPackage(packageName);

      await sendEvent('log', {
        message: `Found ${npmInfo.name}@${npmInfo.version}`,
      });

      if (!npmInfo.repository) {
        await sendEvent('error', {
          message: 'No GitHub repository linked to this package',
        });
        return;
      }

      await sendEvent('log', {
        message: `Repository: ${npmInfo.repository}`,
      });

      // Step 2: Generate build plan via /plan endpoint
      await sendEvent('status', {
        step: 'plan',
        message: 'Generating build plan...',
      });

      const planResponse = await fetch(`${VERCEL_API_URL}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: npmInfo.repository,
          package: packageName.startsWith('@') ? packageName : undefined,
        }),
      });

      if (!planResponse.ok) {
        const errorData = (await planResponse.json()) as { error?: string };
        throw new Error(errorData.error || `Plan generation failed: ${planResponse.status}`);
      }

      const planData = (await planResponse.json()) as {
        plan: unknown;
        context: { isMonorepo: boolean; packageManager: string };
      };

      await sendEvent('log', {
        message: `Build plan ready (${planData.context.packageManager}${planData.context.isMonorepo ? ', monorepo' : ''})`,
      });

      // Step 3: Execute build plan via /execute-stream endpoint
      await sendEvent('status', {
        step: 'build',
        message: 'Building and analyzing...',
      });

      const executeResponse = await fetch(`${VERCEL_API_URL}/execute-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planData.plan }),
      });

      if (!executeResponse.ok || !executeResponse.body) {
        throw new Error(`Execution failed: ${executeResponse.status}`);
      }

      // Stream the execute-stream SSE events and forward relevant ones
      const reader = executeResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            const eventType = line.slice(7).trim();

            // Get the next data line
            const dataLineIndex = lines.indexOf(line) + 1;
            if (dataLineIndex < lines.length && lines[dataLineIndex].startsWith('data:')) {
              const dataStr = lines[dataLineIndex].slice(5).trim();
              try {
                const eventData = JSON.parse(dataStr) as {
                  stage?: string;
                  message?: string;
                  stepId?: string;
                  name?: string;
                  success?: boolean;
                  summary?: {
                    name: string;
                    version: string;
                    coverage: number;
                    exports: number;
                    documented: number;
                    undocumented: number;
                  };
                  error?: string;
                };

                // Forward progress events
                if (eventType === 'progress') {
                  await sendEvent('log', { message: eventData.message || eventData.stage });
                } else if (eventType === 'step:start') {
                  await sendEvent('status', {
                    step: eventData.stepId === 'analyze' ? 'analyze' : 'build',
                    message: eventData.name || `Running ${eventData.stepId}...`,
                  });
                } else if (eventType === 'step:complete' && eventData.stepId) {
                  await sendEvent('log', {
                    message: `${eventData.stepId} completed`,
                  });
                } else if (eventType === 'complete' && eventData.summary) {
                  // Transform summary to our format
                  const summary: AnalysisSummary = {
                    packageName: eventData.summary.name,
                    version: eventData.summary.version,
                    coverage: eventData.summary.coverage,
                    exportCount: eventData.summary.exports,
                    documentedCount: eventData.summary.documented,
                    undocumentedCount: eventData.summary.undocumented,
                    driftCount: 0,
                    topUndocumented: [],
                    topDrift: [],
                  };

                  await sendEvent('log', {
                    message: `Found ${summary.exportCount} exports, ${summary.documentedCount} documented`,
                  });

                  await sendEvent('status', {
                    step: 'complete',
                    message: 'Analysis complete!',
                  });

                  await sendEvent('result', { data: summary });
                  return;
                } else if (eventType === 'error') {
                  throw new Error(eventData.error || 'Execution failed');
                }
              } catch (parseError) {
                // Ignore JSON parse errors for incomplete data
                if (parseError instanceof SyntaxError) continue;
                throw parseError;
              }
            }
          }
        }
      }

      // If we get here without a complete event, something went wrong
      throw new Error('Execution completed without results');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      await sendEvent('error', { message });
    }
  });
});

// Health check
demoRoute.get('/health', (c) => {
  return c.json({ status: 'ok' });
});
