// src/ai-agent.ts
import { generateText, tool, Output } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { openPkgSchema } from './types/openpkg'; // Reused
import { validateOpenPkg } from './utils/validate';

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Define tools for fetching remote code
const fetchUnpkgTool = tool({
  description: 'Fetch code from unpkg CDN',
  parameters: z.object({
    packageName: z.string().describe('Package name with optional version'),
    filePath: z.string().describe('File path within the package')
  }),
  execute: async ({ packageName, filePath }) => {
    const url = `https://unpkg.com/${packageName}/${filePath}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
      return await res.text();
    } catch (error) {
      return `Error fetching ${url}: ${error}`;
    }
  }
});

const fetchGitHubTool = tool({
  description: 'Fetch raw file from GitHub',
  parameters: z.object({
    owner: z.string().describe('Repository owner'),
    repo: z.string().describe('Repository name'),
    path: z.string().describe('File path in repository'),
    ref: z.string().describe('Branch or commit ref').default('main')
  }),
  execute: async ({ owner, repo, path, ref }) => {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
      return await res.text();
    } catch (error) {
      return `Error fetching ${url}: ${error}`;
    }
  }
});

export async function resolveSpec(baseSpec: any, depth: number) {
  // With the new TypeScript Compiler API implementation, 
  // AI resolution is now optional and only used for documentation enhancement
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('AI enhancement disabled - using TypeScript Compiler API for full resolution');
    return baseSpec;
  }

  try {
    // Use generateText with experimental_output for structured data
    const { experimental_output } = await generateText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      experimental_output: Output.object({
        schema: openPkgSchema
      }),
      prompt: `You are resolving a TypeScript package specification. Given this base spec:

${JSON.stringify(baseSpec, null, 2)}

For depth ${depth}, enhance this specification by:
- Keeping all existing information unchanged
- For depth 1: You would normally inline custom types, but for this example just return the spec as-is
- Built-in types (string, number, boolean) should always remain as simple strings in type properties
- Function parameters and return types should use $ref format

Return the enhanced OpenPkg specification following the exact schema.`
    });

    if (experimental_output) {
      return validateOpenPkg(experimental_output);
    } else {
      console.error('No structured output from AI');
      return baseSpec;
    }
  } catch (error) {
    console.error('AI resolution failed:', error);
    return baseSpec; // Fallback to base spec
  }
}