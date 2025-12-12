/**
 * DocCov API - Plain Vercel Node.js handlers
 *
 * No framework, just VercelRequest/VercelResponse for maximum reliability.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import type {
  BuildPlan,
  BuildPlanEnvironment,
  BuildPlanExecutionResult,
  BuildPlanStep,
  BuildPlanStepResult,
  BuildPlanTarget,
  GitHubProjectContext,
} from '@doccov/sdk';
import { fetchGitHubContext, parseScanGitHubUrl } from '@doccov/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Sandbox } from '@vercel/sandbox';
import { generateObject } from 'ai';
import ms from 'ms';
import { z } from 'zod';

export const config = {
  runtime: 'nodejs',
  maxDuration: 300,
};

// =============================================================================
// Types & Helpers
// =============================================================================

type BadgeColor =
  | 'brightgreen'
  | 'green'
  | 'yellowgreen'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'lightgrey';

interface OpenPkgSpec {
  docs?: { coverageScore?: number };
  [key: string]: unknown;
}

function cors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res: VercelResponse, data: unknown, status = 200): void {
  res.status(status).json(data);
}

function getColorForScore(score: number): BadgeColor {
  if (score >= 90) return 'brightgreen';
  if (score >= 80) return 'green';
  if (score >= 70) return 'yellowgreen';
  if (score >= 60) return 'yellow';
  if (score >= 50) return 'orange';
  return 'red';
}

function generateBadgeSvg(label: string, message: string, color: BadgeColor): string {
  const colors: Record<BadgeColor, string> = {
    brightgreen: '#4c1',
    green: '#97ca00',
    yellowgreen: '#a4a61d',
    yellow: '#dfb317',
    orange: '#fe7d37',
    red: '#e05d44',
    lightgrey: '#9f9f9f',
  };

  const bgColor = colors[color];
  const labelWidth = label.length * 7 + 10;
  const messageWidth = message.length * 7 + 10;
  const totalWidth = labelWidth + messageWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${bgColor}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text aria-hidden="true" x="${labelWidth + messageWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${message}</text>
    <text x="${labelWidth + messageWidth / 2}" y="14">${message}</text>
  </g>
</svg>`;
}

async function fetchSpecFromGitHub(
  owner: string,
  repo: string,
  ref = 'main',
): Promise<OpenPkgSpec | null> {
  const urls = [
    `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/openpkg.json`,
    ...(ref === 'main'
      ? [`https://raw.githubusercontent.com/${owner}/${repo}/master/openpkg.json`]
      : []),
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return (await response.json()) as OpenPkgSpec;
      }
    } catch {
      // Try next URL
    }
  }
  return null;
}

function getSandboxRuntime(_runtime: string): 'node22' {
  return 'node22'; // Always use node22 for Vercel Sandbox
}

/**
 * Common CLI tools that are typically devDependencies (not globally available).
 * These need to be run via package manager exec (npx, pnpm exec, etc.)
 */
const LOCAL_BINARIES = new Set([
  'turbo',
  'tsc',
  'tsup',
  'esbuild',
  'vite',
  'rollup',
  'webpack',
  'parcel',
  'swc',
  'bunchee',
  'unbuild',
  'microbundle',
  'preconstruct',
  'changesets',
  'eslint',
  'prettier',
  'vitest',
  'jest',
  'mocha',
  'ava',
  'c8',
  'nyc',
  'size-limit',
  'publint',
  'attw',
  'are-the-types-wrong',
]);

/**
 * Wrap local binaries with package manager exec command.
 * Transforms ["turbo", "build"] -> ["pnpm", "exec", "turbo", "build"] (or npx for npm)
 */
function wrapLocalBinary(
  cmd: string,
  args: string[],
  packageManager: string,
): { cmd: string; args: string[] } {
  // If command is a local binary, wrap with package manager exec
  if (LOCAL_BINARIES.has(cmd)) {
    switch (packageManager) {
      case 'pnpm':
        return { cmd: 'pnpm', args: ['exec', cmd, ...args] };
      case 'yarn':
        return { cmd: 'yarn', args: [cmd, ...args] }; // yarn runs local bins directly
      case 'bun':
        return { cmd: 'bunx', args: [cmd, ...args] };
      case 'npm':
      default:
        return { cmd: 'npx', args: [cmd, ...args] };
    }
  }
  return { cmd, args };
}

/**
 * Normalize cwd for sandbox commands.
 * Vercel Sandbox default working directory is /vercel/sandbox (where git repos are cloned).
 * - If cwd is undefined, empty, or '.' - return undefined (use sandbox default)
 * - If cwd is an absolute path - return as-is
 * - If cwd is a relative subdirectory - convert to absolute path under /vercel/sandbox
 */
function normalizeCwd(cwd: string | undefined): string | undefined {
  if (!cwd || cwd === '.' || cwd === './') return undefined;
  // If already absolute, return as-is
  if (cwd.startsWith('/')) return cwd;
  // Convert relative path to absolute path within sandbox
  return `/vercel/sandbox/${cwd}`;
}

interface SpecSummary {
  name: string;
  version: string;
  coverage: number;
  exports: number;
  types: number;
  documented: number;
  undocumented: number;
}

function createSpecSummary(spec: OpenPkg): SpecSummary {
  const exports = spec.exports?.length ?? 0;
  const types = spec.types?.length ?? 0;

  // Count documented vs undocumented exports
  const documented =
    spec.exports?.filter((e) => e.description && e.description.trim().length > 0).length ?? 0;
  const undocumented = exports - documented;

  // Calculate coverage (documented / total * 100)
  const coverage = exports > 0 ? Math.round((documented / exports) * 100) : 0;

  return {
    name: spec.meta?.name ?? 'unknown',
    version: spec.meta?.version ?? '0.0.0',
    coverage,
    exports,
    types,
    documented,
    undocumented,
  };
}

// =============================================================================
// Plan Agent (AI-powered build plan generation)
// =============================================================================

const BuildPlanStepSchema = z.object({
  id: z.string().describe('Unique identifier (e.g., "install", "build-types")'),
  name: z.string().describe('Human-readable step name'),
  command: z.string().describe('Command to execute'),
  args: z.array(z.string()).describe('Command arguments'),
  cwd: z.string().optional().describe('Working directory relative to repo root'),
  timeout: z.number().optional().describe('Timeout in milliseconds'),
  optional: z.boolean().optional().describe('If true, failure does not stop execution'),
});

const BuildPlanEnvironmentSchema = z.object({
  runtime: z.literal('node22').describe('Runtime (always node22)'),
  packageManager: z.enum(['npm', 'yarn', 'pnpm', 'bun']).describe('Package manager'),
  requiredTools: z.array(z.string()).optional().describe('Additional required tools'),
});

const BuildPlanReasoningSchema = z.object({
  summary: z.string().describe('Brief summary of the approach (1-2 sentences)'),
  rationale: z.string().describe('Why this approach was chosen'),
  concerns: z.array(z.string()).describe('Potential issues or concerns'),
});

const AIBuildPlanSchema = z.object({
  environment: BuildPlanEnvironmentSchema,
  steps: z.array(BuildPlanStepSchema).describe('Steps to execute in order'),
  entryPoints: z.array(z.string()).describe('Entry point files to analyze'),
  reasoning: BuildPlanReasoningSchema,
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence in this plan'),
});

type AIBuildPlanOutput = z.infer<typeof AIBuildPlanSchema>;

interface GenerateBuildPlanOptions {
  targetPackage?: string;
}

function formatContext(context: GitHubProjectContext): string {
  const sections: string[] = [];

  sections.push(`=== Repository ===
Owner: ${context.metadata.owner}
Repo: ${context.metadata.repo}
Language: ${context.metadata.language ?? 'unknown'}
Topics: ${context.metadata.topics.join(', ') || 'none'}
Description: ${context.metadata.description ?? 'none'}`);

  sections.push(`=== Environment ===
Package Manager: ${context.packageManager}
Is Monorepo: ${context.workspace.isMonorepo}
Workspace Tool: ${context.workspace.tool ?? 'none'}
Workspace Packages: ${context.workspace.packages?.join(', ') ?? 'none'}`);

  sections.push(`=== Build Hints ===
Has TypeScript: ${context.buildHints.hasTypeScript}
Has WASM: ${context.buildHints.hasWasm}
Has Native Modules: ${context.buildHints.hasNativeModules}
Has Build Script: ${context.buildHints.hasBuildScript}
Build Script: ${context.buildHints.buildScript ?? 'none'}
Frameworks: ${context.buildHints.frameworks.join(', ') || 'none'}`);

  if (context.files.packageJson) {
    const truncated =
      context.files.packageJson.length > 3000
        ? `${context.files.packageJson.slice(0, 3000)}\n... (truncated)`
        : context.files.packageJson;
    sections.push(`=== package.json ===\n${truncated}`);
  }

  if (context.files.tsconfigJson) {
    sections.push(`=== tsconfig.json ===\n${context.files.tsconfigJson}`);
  }

  if (context.files.lockfile) {
    const preview = context.files.lockfile.content.slice(0, 500);
    sections.push(`=== ${context.files.lockfile.name} (preview) ===\n${preview}\n...`);
  }

  return sections.join('\n\n');
}

const PLAN_SYSTEM_PROMPT = `You are a build system expert. Your task is to analyze a GitHub repository and generate a build plan to analyze its TypeScript/JavaScript API.

The goal is to:
1. Install dependencies
2. Build the project (if needed) to generate TypeScript declarations
3. Identify entry points for API documentation analysis

Package Manager Selection:
- If a lockfile is detected (package-lock.json, yarn.lock, pnpm-lock.yaml, bun.lockb), use that package manager
- If Package Manager is "unknown" (no lockfile), default to npm with "npm install" (NOT "npm ci")
- IMPORTANT: "npm ci" and "--frozen-lockfile" flags ONLY work when a lockfile exists
- When no lockfile: use "npm install", "yarn install", "pnpm install", or "bun install" (without frozen flags)

Install Commands by Package Manager:
- npm with lockfile: ["npm", "ci"]
- npm without lockfile: ["npm", "install"]
- yarn with lockfile: ["yarn", "install", "--frozen-lockfile"]
- yarn without lockfile: ["yarn", "install"]
- pnpm with lockfile: ["pnpm", "install", "--frozen-lockfile"]
- pnpm without lockfile: ["pnpm", "install"]
- bun with lockfile: ["bun", "install", "--frozen-lockfile"]
- bun without lockfile: ["bun", "install"]

General Guidelines:
- For TypeScript projects, look for "types" or "exports" fields in package.json
- For monorepos, focus on the target package if specified
- Common entry points: src/index.ts, dist/index.d.ts, lib/index.ts, distribution/index.d.ts
- WASM projects may need build steps before .d.ts files exist
- Be conservative with timeouts (default 60000ms, increase for builds)
- Installation is usually required first
- Build step is needed if package.json has a "build" script and the types are in dist/distribution folder

Step ID conventions:
- "install" - install dependencies
- "build" - main build step
- "build-types" - generate type declarations
- "analyze" - run doccov spec (added automatically)`;

function generatePlanPrompt(
  context: GitHubProjectContext,
  options: GenerateBuildPlanOptions,
): string {
  let prompt = `Analyze this repository and generate a build plan:\n\n${formatContext(context)}`;

  if (options.targetPackage) {
    prompt += `\n\nTarget Package: ${options.targetPackage}
Focus the plan on building and analyzing only this package within the monorepo.`;
  }

  prompt += `\n\nGenerate a build plan with:
- environment: Runtime and package manager configuration
- steps: Ordered build steps (install, build, etc.)
- entryPoints: TypeScript entry files to analyze (relative paths)
- reasoning: Explain your approach
- confidence: How confident you are in this plan`;

  return prompt;
}

function transformToBuildPlan(
  output: AIBuildPlanOutput,
  context: GitHubProjectContext,
  options: GenerateBuildPlanOptions,
): BuildPlan {
  const target: BuildPlanTarget = {
    type: 'github',
    repoUrl: `https://github.com/${context.metadata.owner}/${context.metadata.repo}`,
    ref: context.ref,
    rootPath: options.targetPackage,
    entryPoints: output.entryPoints,
  };

  const environment: BuildPlanEnvironment = {
    runtime: output.environment.runtime,
    packageManager: output.environment.packageManager,
    requiredTools: output.environment.requiredTools,
  };

  const steps: BuildPlanStep[] = output.steps.map((step) => ({
    id: step.id,
    name: step.name,
    command: step.command,
    args: step.args,
    cwd: step.cwd,
    timeout: step.timeout,
    optional: step.optional,
  }));

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    target,
    environment,
    steps,
    reasoning: {
      summary: output.reasoning.summary,
      rationale: output.reasoning.rationale,
      concerns: output.reasoning.concerns,
    },
    confidence: output.confidence,
  };
}

async function generateBuildPlan(
  context: GitHubProjectContext,
  options: GenerateBuildPlanOptions = {},
): Promise<BuildPlan> {
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  const model = anthropic('claude-sonnet-4-20250514');
  const prompt = generatePlanPrompt(context, options);

  const { object } = await generateObject({
    model,
    schema: AIBuildPlanSchema,
    system: PLAN_SYSTEM_PROMPT,
    prompt,
  });

  return transformToBuildPlan(object, context, options);
}

// =============================================================================
// Route Handlers
// =============================================================================

async function handleRoot(_req: VercelRequest, res: VercelResponse): Promise<void> {
  json(res, {
    name: 'DocCov API',
    version: '0.4.0',
    status: 'ok',
    timestamp: new Date().toISOString(),
    endpoints: [
      { method: 'GET', path: '/', description: 'API info and health status' },
      {
        method: 'GET',
        path: '/badge/:owner/:repo',
        description: 'Get coverage badge for a GitHub repo',
      },
      {
        method: 'GET',
        path: '/spec/:owner/:repo/:ref?',
        description: 'Get OpenPkg spec for a GitHub repo',
      },
      { method: 'POST', path: '/plan', description: 'Generate AI build plan for a GitHub repo' },
      { method: 'POST', path: '/execute', description: 'Execute a build plan and return results' },
      {
        method: 'POST',
        path: '/execute-stream',
        description: 'Execute a build plan with SSE streaming',
      },
    ],
  });
}

async function handleBadge(
  req: VercelRequest,
  res: VercelResponse,
  owner: string,
  repo: string,
): Promise<void> {
  const branch = (req.query.branch as string) ?? 'main';

  try {
    const spec = await fetchSpecFromGitHub(owner, repo, branch);

    if (!spec) {
      const svg = generateBadgeSvg('docs', 'not found', 'lightgrey');
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'no-cache');
      res.status(404).send(svg);
      return;
    }

    const coverageScore = spec.docs?.coverageScore ?? 0;
    const svg = generateBadgeSvg('docs', `${coverageScore}%`, getColorForScore(coverageScore));
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).send(svg);
  } catch {
    const svg = generateBadgeSvg('docs', 'error', 'red');
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(500).send(svg);
  }
}

async function handleSpec(
  _req: VercelRequest,
  res: VercelResponse,
  owner: string,
  repo: string,
  ref?: string,
): Promise<void> {
  const actualRef = ref ?? 'main';
  const spec = await fetchSpecFromGitHub(owner, repo, actualRef);

  if (!spec) {
    json(res, { error: 'Spec not found' }, 404);
    return;
  }

  res.setHeader('Cache-Control', 'public, max-age=300');
  json(res, spec);
}

async function handleSpecPr(
  _req: VercelRequest,
  res: VercelResponse,
  owner: string,
  repo: string,
  pr: string,
): Promise<void> {
  try {
    const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr}`, {
      headers: { 'User-Agent': 'DocCov' },
    });

    if (!prResponse.ok) {
      json(res, { error: 'PR not found' }, 404);
      return;
    }

    const prData = (await prResponse.json()) as { head: { sha: string } };
    const specUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${prData.head.sha}/openpkg.json`;
    const specResponse = await fetch(specUrl);

    if (!specResponse.ok) {
      json(res, { error: 'Spec not found in PR' }, 404);
      return;
    }

    const spec = await specResponse.json();
    res.setHeader('Cache-Control', 'no-cache');
    json(res, spec);
  } catch {
    json(res, { error: 'Failed to fetch PR spec' }, 500);
  }
}

async function handlePlan(req: VercelRequest, res: VercelResponse): Promise<void> {
  const body = req.body as { url?: string; ref?: string; package?: string };

  if (!body.url) {
    json(res, { error: 'url is required' }, 400);
    return;
  }

  let repoUrl: string;
  try {
    const parsed = parseScanGitHubUrl(body.url);
    if (!parsed) {
      json(res, { error: 'Invalid GitHub URL' }, 400);
      return;
    }
    repoUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;
  } catch {
    json(res, { error: 'Invalid GitHub URL' }, 400);
    return;
  }

  try {
    const context = await fetchGitHubContext(repoUrl, body.ref);

    if (context.metadata.isPrivate) {
      json(
        res,
        {
          error: 'Private repositories are not supported',
          hint: 'Use a public repository or run doccov locally',
        },
        403,
      );
      return;
    }

    const plan = await generateBuildPlan(context, { targetPackage: body.package });

    json(res, {
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
        json(res, { error: 'Repository not found' }, 404);
        return;
      }
      if (error.message.includes('rate limit')) {
        json(res, { error: 'GitHub API rate limit exceeded' }, 429);
        return;
      }
    }

    json(
      res,
      {
        error: 'Failed to generate build plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
}

async function handleExecute(req: VercelRequest, res: VercelResponse): Promise<void> {
  const includeSpec = req.query.includeSpec === 'true';
  const body = req.body as { plan?: BuildPlan };

  if (!body.plan) {
    json(res, { error: 'plan is required' }, 400);
    return;
  }

  const { plan } = body;

  if (!plan.target?.repoUrl || !plan.steps) {
    json(res, { error: 'Invalid plan structure' }, 400);
    return;
  }

  const startTime = Date.now();
  const stepResults: BuildPlanStepResult[] = [];
  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | null = null;

  try {
    sandbox = await Sandbox.create({
      source: { url: plan.target.repoUrl, type: 'git' as const },
      resources: { vcpus: 4 },
      timeout: ms('5m'),
      runtime: getSandboxRuntime(plan.environment.runtime),
    });

    for (const step of plan.steps) {
      const stepStart = Date.now();

      try {
        const normalizedCwd = normalizeCwd(step.cwd);
        const { cmd, args } = wrapLocalBinary(step.command, step.args, plan.environment.packageManager);
        const result = await sandbox.runCommand({
          cmd,
          args,
          ...(normalizedCwd ? { cwd: normalizedCwd } : {}),
        });

        const stdout = result.stdout ? await result.stdout() : '';
        const stderr = result.stderr ? await result.stderr() : '';

        stepResults.push({
          stepId: step.id,
          success: result.exitCode === 0,
          duration: Date.now() - stepStart,
          output: stdout.slice(0, 5000),
          error: result.exitCode !== 0 ? stderr.slice(0, 2000) : undefined,
        });

        if (result.exitCode !== 0 && !step.optional) {
          throw new Error(`Step '${step.name}' failed: ${stderr}`);
        }
      } catch (stepError) {
        stepResults.push({
          stepId: step.id,
          success: false,
          duration: Date.now() - stepStart,
          error: stepError instanceof Error ? stepError.message : 'Unknown error',
        });

        if (!step.optional) {
          throw stepError;
        }
      }
    }

    // Run doccov spec
    const specStart = Date.now();
    let entryPoint = plan.target.entryPoints[0] ?? 'src/index.ts';
    const analyzeCwd = normalizeCwd(plan.target.rootPath);

    // If running in a subdirectory (rootPath), strip the rootPath prefix from entryPoint
    if (plan.target.rootPath && entryPoint.startsWith(plan.target.rootPath + '/')) {
      entryPoint = entryPoint.slice(plan.target.rootPath.length + 1);
    }

    await sandbox.runCommand({ cmd: 'npm', args: ['install', '-g', '@doccov/cli@latest'] });

    const specResult = await sandbox.runCommand({
      cmd: 'doccov',
      args: ['spec', entryPoint, '--output', 'openpkg.json'],
      ...(analyzeCwd ? { cwd: analyzeCwd } : {}),
    });

    const specStdout = specResult.stdout ? await specResult.stdout() : '';
    const specStderr = specResult.stderr ? await specResult.stderr() : '';

    stepResults.push({
      stepId: 'analyze',
      success: specResult.exitCode === 0,
      duration: Date.now() - specStart,
      output: specStdout.slice(0, 2000),
      error: specResult.exitCode !== 0 ? specStderr.slice(0, 2000) : undefined,
    });

    if (specResult.exitCode !== 0) {
      throw new Error(`Spec generation failed: ${specStderr}`);
    }

    // Read openpkg.json from the correct location (rootPath subdirectory if set)
    const specFilePath = plan.target.rootPath
      ? `${plan.target.rootPath}/openpkg.json`
      : 'openpkg.json';
    const specStream = await sandbox.readFile({ path: specFilePath });
    const chunks: Buffer[] = [];
    for await (const chunk of specStream as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const specContent = Buffer.concat(chunks).toString('utf-8');
    const spec = JSON.parse(specContent) as OpenPkg;
    const summary = createSpecSummary(spec);

    const result = {
      success: true,
      summary,
      stepResults,
      totalDuration: Date.now() - startTime,
      ...(includeSpec ? { spec } : {}),
    };

    json(res, result);
  } catch (error) {
    console.error('Execution error:', error);

    const result: BuildPlanExecutionResult = {
      success: false,
      stepResults,
      totalDuration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    json(res, result);
  } finally {
    if (sandbox) {
      try {
        await sandbox.stop();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

async function handleExecuteStream(req: VercelRequest, res: VercelResponse): Promise<void> {
  const includeSpec = req.query.includeSpec === 'true';

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const body = req.body as { plan?: BuildPlan };

  if (!body.plan) {
    send('error', { error: 'plan is required' });
    res.end();
    return;
  }

  const { plan } = body;

  if (!plan.target?.repoUrl || !plan.steps) {
    send('error', { error: 'Invalid plan structure' });
    res.end();
    return;
  }

  const startTime = Date.now();
  const stepResults: BuildPlanStepResult[] = [];
  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | null = null;

  try {
    send('progress', { stage: 'init', message: 'Creating sandbox...', progress: 5 });

    sandbox = await Sandbox.create({
      source: { url: plan.target.repoUrl, type: 'git' as const },
      resources: { vcpus: 4 },
      timeout: ms('5m'),
      runtime: getSandboxRuntime(plan.environment.runtime),
    });

    send('progress', { stage: 'cloned', message: 'Repository cloned', progress: 15 });

    const totalSteps = plan.steps.length + 1; // +1 for analyze step
    let completedSteps = 0;

    for (const step of plan.steps) {
      const stepStart = Date.now();
      const progressBase = 15 + (completedSteps / totalSteps) * 70;

      send('step:start', { stepId: step.id, name: step.name, progress: Math.round(progressBase) });

      try {
        const normalizedCwd = normalizeCwd(step.cwd);
        const { cmd, args } = wrapLocalBinary(step.command, step.args, plan.environment.packageManager);
        const result = await sandbox.runCommand({
          cmd,
          args,
          ...(normalizedCwd ? { cwd: normalizedCwd } : {}),
        });

        const stdout = result.stdout ? await result.stdout() : '';
        const stderr = result.stderr ? await result.stderr() : '';

        const stepResult: BuildPlanStepResult = {
          stepId: step.id,
          success: result.exitCode === 0,
          duration: Date.now() - stepStart,
          output: stdout.slice(0, 5000),
          error: result.exitCode !== 0 ? stderr.slice(0, 2000) : undefined,
        };

        stepResults.push(stepResult);
        completedSteps++;

        send('step:complete', {
          ...stepResult,
          progress: Math.round(15 + (completedSteps / totalSteps) * 70),
        });

        if (result.exitCode !== 0 && !step.optional) {
          throw new Error(`Step '${step.name}' failed: ${stderr}`);
        }
      } catch (stepError) {
        const stepResult: BuildPlanStepResult = {
          stepId: step.id,
          success: false,
          duration: Date.now() - stepStart,
          error: stepError instanceof Error ? stepError.message : 'Unknown error',
        };

        stepResults.push(stepResult);
        send('step:error', stepResult);

        if (!step.optional) {
          throw stepError;
        }
      }
    }

    // Run doccov spec
    send('step:start', { stepId: 'analyze', name: 'Analyzing API', progress: 85 });
    const specStart = Date.now();
    let entryPoint = plan.target.entryPoints[0] ?? 'src/index.ts';
    const analyzeCwd = normalizeCwd(plan.target.rootPath);

    // If running in a subdirectory (rootPath), strip the rootPath prefix from entryPoint
    // e.g., rootPath="packages/v0-sdk", entryPoint="packages/v0-sdk/src/index.ts" -> "src/index.ts"
    if (plan.target.rootPath && entryPoint.startsWith(plan.target.rootPath + '/')) {
      entryPoint = entryPoint.slice(plan.target.rootPath.length + 1);
    }

    await sandbox.runCommand({ cmd: 'npm', args: ['install', '-g', '@doccov/cli@latest'] });

    const specResult = await sandbox.runCommand({
      cmd: 'doccov',
      args: ['spec', entryPoint, '--output', 'openpkg.json'],
      ...(analyzeCwd ? { cwd: analyzeCwd } : {}),
    });

    const specStdout = specResult.stdout ? await specResult.stdout() : '';
    const specStderr = specResult.stderr ? await specResult.stderr() : '';

    stepResults.push({
      stepId: 'analyze',
      success: specResult.exitCode === 0,
      duration: Date.now() - specStart,
      output: specStdout.slice(0, 2000),
      error: specResult.exitCode !== 0 ? specStderr.slice(0, 2000) : undefined,
    });

    if (specResult.exitCode !== 0) {
      throw new Error(`Spec generation failed: ${specStderr}`);
    }

    send('step:complete', { stepId: 'analyze', success: true, progress: 95 });

    // Read openpkg.json from the correct location (rootPath subdirectory if set)
    const specFilePath = plan.target.rootPath
      ? `${plan.target.rootPath}/openpkg.json`
      : 'openpkg.json';
    const specStream = await sandbox.readFile({ path: specFilePath });
    const chunks: Buffer[] = [];
    for await (const chunk of specStream as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const specContent = Buffer.concat(chunks).toString('utf-8');
    const spec = JSON.parse(specContent) as OpenPkg;
    const summary = createSpecSummary(spec);

    const result = {
      success: true,
      summary,
      stepResults,
      totalDuration: Date.now() - startTime,
      ...(includeSpec ? { spec } : {}),
    };

    send('complete', result);
  } catch (error) {
    console.error('Execution error:', error);

    const result: BuildPlanExecutionResult = {
      success: false,
      stepResults,
      totalDuration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    send('error', result);
  } finally {
    if (sandbox) {
      try {
        await sandbox.stop();
      } catch {
        // Ignore cleanup errors
      }
    }
    res.end();
  }
}

// =============================================================================
// Main Router
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // CORS
  cors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    // GET /
    if (path === '/' && req.method === 'GET') {
      return handleRoot(req, res);
    }

    // GET /badge/:owner/:repo
    const badgeMatch = path.match(/^\/badge\/([^/]+)\/([^/]+)$/);
    if (badgeMatch && req.method === 'GET') {
      return handleBadge(req, res, badgeMatch[1], badgeMatch[2]);
    }

    // GET /spec/:owner/:repo/pr/:pr
    const specPrMatch = path.match(/^\/spec\/([^/]+)\/([^/]+)\/pr\/(\d+)$/);
    if (specPrMatch && req.method === 'GET') {
      return handleSpecPr(req, res, specPrMatch[1], specPrMatch[2], specPrMatch[3]);
    }

    // GET /spec/:owner/:repo/:ref?
    const specMatch = path.match(/^\/spec\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/);
    if (specMatch && req.method === 'GET') {
      return handleSpec(req, res, specMatch[1], specMatch[2], specMatch[3]);
    }

    // POST /plan
    if (path === '/plan' && req.method === 'POST') {
      return handlePlan(req, res);
    }

    // POST /execute
    if (path === '/execute' && req.method === 'POST') {
      return handleExecute(req, res);
    }

    // POST /execute-stream (SSE)
    if (path === '/execute-stream' && req.method === 'POST') {
      return handleExecuteStream(req, res);
    }

    // 404
    json(res, { error: 'Not found' }, 404);
  } catch (error) {
    console.error('Handler error:', error);
    json(res, { error: 'Internal server error' }, 500);
  }
}
