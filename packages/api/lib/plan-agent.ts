/**
 * AI-powered build plan generation agent.
 * Uses Claude to analyze repository context and generate execution plans.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import type {
  BuildPlan,
  BuildPlanEnvironment,
  BuildPlanStep,
  BuildPlanTarget,
  GitHubProjectContext,
} from '@doccov/sdk';

/**
 * Zod schema for build plan validation.
 */
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
  runtime: z.enum(['node22', 'node24']).describe('Runtime to use (node22 or node24)'),
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

/**
 * Options for build plan generation.
 */
export interface GenerateBuildPlanOptions {
  /** Target a specific package in a monorepo */
  targetPackage?: string;
  /** Override the default model */
  model?: string;
}

/**
 * Format project context for the AI prompt.
 */
function formatContext(context: GitHubProjectContext): string {
  const sections: string[] = [];

  // Repository metadata
  sections.push(`=== Repository ===
Owner: ${context.metadata.owner}
Repo: ${context.metadata.repo}
Language: ${context.metadata.language ?? 'unknown'}
Topics: ${context.metadata.topics.join(', ') || 'none'}
Description: ${context.metadata.description ?? 'none'}`);

  // Environment detection
  sections.push(`=== Environment ===
Package Manager: ${context.packageManager}
Is Monorepo: ${context.workspace.isMonorepo}
Workspace Tool: ${context.workspace.tool ?? 'none'}
Workspace Packages: ${context.workspace.packages?.join(', ') ?? 'none'}`);

  // Build hints
  sections.push(`=== Build Hints ===
Has TypeScript: ${context.buildHints.hasTypeScript}
Has WASM: ${context.buildHints.hasWasm}
Has Native Modules: ${context.buildHints.hasNativeModules}
Has Build Script: ${context.buildHints.hasBuildScript}
Build Script: ${context.buildHints.buildScript ?? 'none'}
Frameworks: ${context.buildHints.frameworks.join(', ') || 'none'}`);

  // File contents
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
    // Only include first 500 chars of lockfile
    const preview = context.files.lockfile.content.slice(0, 500);
    sections.push(`=== ${context.files.lockfile.name} (preview) ===\n${preview}\n...`);
  }

  return sections.join('\n\n');
}

/**
 * System prompt for build plan generation.
 */
const SYSTEM_PROMPT = `You are a build system expert. Your task is to analyze a GitHub repository and generate a build plan to analyze its TypeScript/JavaScript API.

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

/**
 * Generate a build plan prompt.
 */
function generatePrompt(
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

/**
 * Get the Anthropic model for plan generation.
 */
function getModel() {
  const anthropic = createAnthropic();
  return anthropic('claude-sonnet-4-20250514');
}

/**
 * Generate a build plan for a GitHub repository.
 */
export async function generateBuildPlan(
  context: GitHubProjectContext,
  options: GenerateBuildPlanOptions = {},
): Promise<BuildPlan> {
  const model = getModel();
  const prompt = generatePrompt(context, options);

  const { object } = await generateObject({
    model,
    schema: AIBuildPlanSchema,
    system: SYSTEM_PROMPT,
    prompt,
  });

  return transformToBuildPlan(object, context, options);
}

/**
 * Transform AI output to full BuildPlan.
 */
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
