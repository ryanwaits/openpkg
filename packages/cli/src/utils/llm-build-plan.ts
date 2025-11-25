/**
 * LLM-powered build plan generation for exotic project setups
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export const BuildPlanSchema = z.object({
  installCommand: z.string().optional().describe('Additional install command if needed'),
  buildCommands: z.array(z.string()).describe('Build steps to run, e.g. ["npm run build:wasm"]'),
  entryPoint: z.string().describe('Path to TS/TSX entry file after build'),
  notes: z.string().optional().describe('Caveats or warnings'),
});

export type BuildPlan = z.infer<typeof BuildPlanSchema>;

const CONTEXT_FILES = [
  'package.json',
  'README.md',
  'README',
  'tsconfig.json',
  'Cargo.toml',
  '.nvmrc',
  '.node-version',
  'pnpm-workspace.yaml',
  'lerna.json',
  'wasm-pack.json',
];

const MAX_FILE_CHARS = 2000;

function getModel() {
  const provider = process.env.DOCCOV_LLM_PROVIDER?.toLowerCase();

  if (provider === 'anthropic' || process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic();
    return anthropic('claude-sonnet-4-20250514');
  }

  const openai = createOpenAI();
  return openai('gpt-4o-mini');
}

async function gatherContextFiles(repoDir: string): Promise<string> {
  const sections: string[] = [];

  for (const fileName of CONTEXT_FILES) {
    const filePath = path.join(repoDir, fileName);
    if (fs.existsSync(filePath)) {
      try {
        let content = fs.readFileSync(filePath, 'utf-8');
        if (content.length > MAX_FILE_CHARS) {
          content = `${content.slice(0, MAX_FILE_CHARS)}\n... (truncated)`;
        }
        sections.push(`--- ${fileName} ---\n${content}`);
      } catch {
        // Skip unreadable files
      }
    }
  }

  return sections.join('\n\n');
}

const BUILD_PLAN_PROMPT = (context: string) => `Analyze this project to determine how to build it for TypeScript API analysis.

The standard entry detection failed. This might be a WASM project, unusual monorepo, or require a build step before the TypeScript entry point exists.

<files>
${context}
</files>

Return:
- buildCommands: Commands to run in order (e.g., ["npm run build:wasm", "npm run build"]). Empty array if no build needed.
- entryPoint: Path to the TypeScript entry file AFTER build completes (e.g., "src/index.ts" or "pkg/index.d.ts")
- installCommand: Additional install command if needed beyond what was already run
- notes: Any caveats (e.g., "requires Rust/wasm-pack installed")

Important:
- Look for build scripts in package.json that might generate TypeScript bindings
- Check README for build instructions
- For WASM projects, look for wasm-pack or similar tooling
- The entry point should be a .ts, .tsx, or .d.ts file`;

/**
 * Generate a build plan using an LLM when standard heuristics fail.
 * Returns null if no API key is configured.
 */
export async function generateBuildPlan(repoDir: string): Promise<BuildPlan | null> {
  const hasApiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!hasApiKey) {
    return null;
  }

  const context = await gatherContextFiles(repoDir);
  if (!context.trim()) {
    return null;
  }

  const model = getModel();

  const { object } = await generateObject({
    model,
    schema: BuildPlanSchema,
    prompt: BUILD_PLAN_PROMPT(context),
  });

  return object;
}

