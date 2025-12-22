/**
 * AI-powered JSDoc generation
 *
 * Uses AI SDK to generate missing documentation for undocumented exports
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { EnrichedExport, JSDocPatch } from '@doccov/sdk';
import { generateObject } from 'ai';
import { z } from 'zod';

/**
 * Schema for AI-generated JSDoc
 */
export const JSDocGenerationSchema = z.object({
  description: z.string().describe('1-2 sentence description of what this does'),
  params: z
    .array(
      z.object({
        name: z.string(),
        type: z.string().optional(),
        description: z.string(),
      }),
    )
    .optional()
    .describe('Parameter descriptions for functions'),
  returns: z
    .object({
      type: z.string().optional(),
      description: z.string(),
    })
    .optional()
    .describe('Return value description for functions'),
  example: z.string().optional().describe('Working code example showing typical usage'),
  typeParams: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
      }),
    )
    .optional()
    .describe('Type parameter descriptions for generics'),
});

export type JSDocGenerationResult = z.infer<typeof JSDocGenerationSchema>;

/**
 * Get the AI model based on environment configuration
 */
function getModel() {
  const provider = process.env.DOCCOV_LLM_PROVIDER?.toLowerCase();

  if (provider === 'anthropic' || process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic();
    return anthropic('claude-sonnet-4-20250514');
  }

  const openai = createOpenAI();
  return openai('gpt-4o-mini');
}

/**
 * Check if AI generation is available
 */
export function isAIGenerationAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

/**
 * Build signature string from export
 */
function buildSignature(exp: EnrichedExport): string {
  if (exp.signatures && exp.signatures.length > 0) {
    const sig = exp.signatures[0];
    const params = sig.parameters?.map((p) => `${p.name}: ${p.type ?? 'unknown'}`).join(', ') ?? '';
    const ret = sig.returnType ?? 'void';
    return `(${params}) => ${ret}`;
  }

  if (exp.type) {
    return typeof exp.type === 'string' ? exp.type : JSON.stringify(exp.type);
  }

  return exp.kind;
}

/**
 * Build context from export members for classes/interfaces
 */
function buildMembersContext(exp: EnrichedExport): string {
  if (!exp.members || exp.members.length === 0) return '';

  const memberLines = exp.members.slice(0, 10).map((m) => {
    const type = m.type ? `: ${typeof m.type === 'string' ? m.type : 'object'}` : '';
    return `  - ${m.name}${type}`;
  });

  if (exp.members.length > 10) {
    memberLines.push(`  - ... and ${exp.members.length - 10} more members`);
  }

  return `\n\nMembers:\n${memberLines.join('\n')}`;
}

/**
 * Generate JSDoc for a single export using AI
 */
export async function generateJSDocForExport(
  exp: EnrichedExport,
): Promise<JSDocGenerationResult | null> {
  if (!isAIGenerationAvailable()) {
    return null;
  }

  const signature = buildSignature(exp);
  const membersContext = buildMembersContext(exp);

  const prompt = `Generate JSDoc documentation for this TypeScript export.

Name: ${exp.name}
Kind: ${exp.kind}
Signature: ${signature}${membersContext}

Requirements:
- Description: 1-2 sentences explaining what this does and when to use it
- For functions: describe each parameter and return value
- Example: provide a working code snippet showing typical usage
- Be concise but informative

The documentation should help developers understand the purpose and usage at a glance.`;

  try {
    const { object } = await generateObject({
      model: getModel(),
      schema: JSDocGenerationSchema,
      prompt,
    });

    return object;
  } catch {
    return null;
  }
}

/**
 * Convert AI generation result to JSDocPatch format
 */
export function toJSDocPatch(result: JSDocGenerationResult): JSDocPatch {
  const patch: JSDocPatch = {};

  if (result.description) {
    patch.description = result.description;
  }

  if (result.params && result.params.length > 0) {
    patch.params = result.params.map((p) => ({
      name: p.name,
      type: p.type,
      description: p.description,
    }));
  }

  if (result.returns) {
    patch.returns = {
      type: result.returns.type,
      description: result.returns.description,
    };
  }

  if (result.example) {
    patch.examples = [result.example];
  }

  if (result.typeParams && result.typeParams.length > 0) {
    patch.typeParams = result.typeParams.map((tp) => ({
      name: tp.name,
      description: tp.description,
    }));
  }

  return patch;
}

/**
 * Result of batch generation
 */
export interface GenerationResult {
  exportName: string;
  patch: JSDocPatch;
  generated: boolean;
}

/**
 * Batch generate JSDoc for multiple exports
 */
export async function batchGenerateJSDocs(
  exports: EnrichedExport[],
  options: {
    maxConcurrent?: number;
    onProgress?: (completed: number, total: number, exportName: string) => void;
  } = {},
): Promise<GenerationResult[]> {
  const results: GenerationResult[] = [];
  const { maxConcurrent = 3, onProgress } = options;

  // Process in batches to avoid rate limits
  for (let i = 0; i < exports.length; i += maxConcurrent) {
    const batch = exports.slice(i, i + maxConcurrent);
    const promises = batch.map(async (exp) => {
      const generated = await generateJSDocForExport(exp);
      if (generated) {
        onProgress?.(results.length + 1, exports.length, exp.name);
        return {
          exportName: exp.name,
          patch: toJSDocPatch(generated),
          generated: true,
        };
      }
      return {
        exportName: exp.name,
        patch: {},
        generated: false,
      };
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }

  return results;
}
