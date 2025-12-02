/**
 * AI-powered docs impact analysis
 *
 * Uses AI SDK to analyze code block usage patterns and suggest fixes
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import type { MarkdownCodeBlock, DocsImpactReference } from '@doccov/sdk';

/**
 * Schema for code block usage analysis
 */
export const CodeBlockUsageSchema = z.object({
  isImpacted: z.boolean().describe('Whether the code block is affected by the change'),
  reason: z.string().describe('Explanation of why/why not the code is impacted'),
  usageType: z
    .enum(['direct-call', 'import-only', 'indirect', 'not-used'])
    .describe('How the export is used in this code block'),
  suggestedFix: z
    .string()
    .optional()
    .describe('If impacted, the suggested code change'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe('Confidence level of the analysis'),
});

export type CodeBlockUsageResult = z.infer<typeof CodeBlockUsageSchema>;

/**
 * Schema for multi-block analysis
 */
export const MultiBlockAnalysisSchema = z.object({
  groups: z
    .array(
      z.object({
        blockIndices: z.array(z.number()).describe('Indices of blocks that should run together'),
        reason: z.string().describe('Why these blocks are related'),
      }),
    )
    .describe('Groups of related code blocks'),
  skippedBlocks: z
    .array(z.number())
    .describe('Indices of blocks that should be skipped (incomplete/illustrative)'),
});

export type MultiBlockAnalysisResult = z.infer<typeof MultiBlockAnalysisSchema>;

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
 * Check if AI docs analysis is available
 */
export function isAIDocsAnalysisAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

/**
 * Analyze how a code block uses an export and if it's impacted by a change
 */
export async function analyzeCodeBlockUsage(
  block: MarkdownCodeBlock,
  exportName: string,
  changeDetails: {
    oldSignature?: string;
    newSignature?: string;
    changeType: 'signature-changed' | 'removed' | 'deprecated';
  },
): Promise<CodeBlockUsageResult | null> {
  if (!isAIDocsAnalysisAvailable()) {
    return null;
  }

  const changeDescription =
    changeDetails.changeType === 'signature-changed'
      ? `The signature changed from:\n${changeDetails.oldSignature || 'unknown'}\n\nTo:\n${changeDetails.newSignature || 'unknown'}`
      : changeDetails.changeType === 'removed'
        ? 'The export has been removed from the package'
        : 'The export has been deprecated';

  try {
    const { object } = await generateObject({
      model: getModel(),
      schema: CodeBlockUsageSchema,
      prompt: `Analyze this code block from a documentation tutorial.

Export being analyzed: ${exportName}
Change: ${changeDescription}

Code block:
\`\`\`${block.lang}
${block.code}
\`\`\`

Determine:
1. Is this code block impacted by the change to ${exportName}?
2. How is ${exportName} used (direct call, import only, indirectly via another function)?
3. If impacted, what specific change is needed to fix it?

Be precise - only mark as impacted if the code would break or behave incorrectly after the change.`,
    });

    return object;
  } catch {
    return null;
  }
}

/**
 * Analyze multiple code blocks to identify related groups
 */
export async function analyzeBlockRelationships(
  blocks: MarkdownCodeBlock[],
  surroundingContext?: string,
): Promise<MultiBlockAnalysisResult | null> {
  if (!isAIDocsAnalysisAvailable()) {
    return null;
  }

  if (blocks.length === 0) {
    return { groups: [], skippedBlocks: [] };
  }

  if (blocks.length === 1) {
    return { groups: [{ blockIndices: [0], reason: 'Single block' }], skippedBlocks: [] };
  }

  try {
    const blocksText = blocks
      .map(
        (b, i) =>
          `[Block ${i}] (lines ${b.lineStart}-${b.lineEnd})\n\`\`\`${b.lang}\n${b.code}\n\`\`\``,
      )
      .join('\n\n');

    const { object } = await generateObject({
      model: getModel(),
      schema: MultiBlockAnalysisSchema,
      prompt: `Analyze these code blocks from a markdown tutorial.

${surroundingContext ? `Context (surrounding text):\n${surroundingContext}\n\n` : ''}
Code blocks:
${blocksText}

Identify:
1. Which blocks should be run together (share state/variables)
2. Which blocks are incomplete snippets that shouldn't be executed

Consider:
- Blocks that define variables used in later blocks
- Blocks that are setup code for subsequent examples
- Blocks that are intentionally incomplete (showing partial code, types only, etc.)`,
    });

    return object;
  } catch {
    return null;
  }
}

/**
 * Generate a fix suggestion for an impacted documentation reference
 */
export async function generateDocFix(
  block: MarkdownCodeBlock,
  impact: DocsImpactReference,
  exportInfo: {
    oldSignature?: string;
    newSignature?: string;
    description?: string;
  },
): Promise<string | null> {
  if (!isAIDocsAnalysisAvailable()) {
    return null;
  }

  try {
    const { text } = await generateText({
      model: getModel(),
      prompt: `Fix this code block from a documentation tutorial.

The export "${impact.exportName}" has changed:
- Old: ${exportInfo.oldSignature || 'unknown'}
- New: ${exportInfo.newSignature || 'unknown'}
${exportInfo.description ? `- Description: ${exportInfo.description}` : ''}

Current code block:
\`\`\`${block.lang}
${block.code}
\`\`\`

Provide ONLY the corrected code block content. Do not include any explanation or markdown fencing.
If no fix is needed, return the original code unchanged.`,
    });

    return text.trim();
  } catch {
    return null;
  }
}

/**
 * Batch analyze multiple impacts with AI
 */
export async function batchAnalyzeImpacts(
  blocks: MarkdownCodeBlock[],
  impacts: DocsImpactReference[],
  options: {
    maxConcurrent?: number;
    includeFixSuggestions?: boolean;
  } = {},
): Promise<Map<number, CodeBlockUsageResult>> {
  const results = new Map<number, CodeBlockUsageResult>();
  const { maxConcurrent = 3 } = options;

  // Group impacts by block index
  const impactsByBlock = new Map<number, DocsImpactReference[]>();
  for (const impact of impacts) {
    // Find block that contains this reference (simplified - uses line matching)
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.code.includes(impact.exportName)) {
        const existing = impactsByBlock.get(i) ?? [];
        existing.push(impact);
        impactsByBlock.set(i, existing);
        break;
      }
    }
  }

  // Process in batches
  const entries = Array.from(impactsByBlock.entries());
  for (let i = 0; i < entries.length; i += maxConcurrent) {
    const batch = entries.slice(i, i + maxConcurrent);
    const promises = batch.map(async ([blockIndex, blockImpacts]) => {
      const block = blocks[blockIndex];
      const firstImpact = blockImpacts[0];
      const result = await analyzeCodeBlockUsage(block, firstImpact.exportName, {
        changeType: firstImpact.changeType,
      });
      if (result) {
        results.set(blockIndex, result);
      }
    });
    await Promise.all(promises);
  }

  return results;
}

/**
 * Result of generating a fix for a docs file
 */
export interface DocFileFix {
  file: string;
  fixes: Array<{
    line: number;
    exportName: string;
    originalCode: string;
    fixedCode: string;
    explanation: string;
  }>;
}

/**
 * Generate fixes for all impacts in a file
 */
export async function generateDocFileFixes(
  file: string,
  blocks: MarkdownCodeBlock[],
  impacts: DocsImpactReference[],
  exportInfo: Map<string, { oldSignature?: string; newSignature?: string; description?: string }>,
): Promise<DocFileFix | null> {
  if (!isAIDocsAnalysisAvailable()) {
    return null;
  }

  const fixes: DocFileFix['fixes'] = [];

  for (const impact of impacts) {
    // Find the block containing this impact
    const block = blocks.find(
      (b) => b.lineStart <= impact.line && b.lineEnd >= impact.line && b.code.includes(impact.exportName),
    );

    if (!block) continue;

    const info = exportInfo.get(impact.exportName) ?? {};
    const fixedCode = await generateDocFix(block, impact, info);

    if (fixedCode && fixedCode !== block.code) {
      fixes.push({
        line: block.lineStart,
        exportName: impact.exportName,
        originalCode: block.code,
        fixedCode,
        explanation: `Updated for ${impact.changeType} of ${impact.exportName}`,
      });
    }
  }

  if (fixes.length === 0) {
    return null;
  }

  return { file, fixes };
}

/**
 * Generate a summary explanation of all impacts for a PR comment
 */
export async function generateImpactSummary(
  impacts: Array<{
    file: string;
    exportName: string;
    changeType: string;
    context?: string;
  }>,
): Promise<string | null> {
  if (!isAIDocsAnalysisAvailable()) {
    return null;
  }

  if (impacts.length === 0) {
    return 'No documentation impacts detected.';
  }

  try {
    const { text } = await generateText({
      model: getModel(),
      prompt: `Summarize these documentation impacts for a GitHub PR comment.

Impacts:
${impacts.map((i) => `- ${i.file}: ${i.exportName} (${i.changeType})`).join('\n')}

Write a brief, actionable summary (2-3 sentences) explaining:
1. How many files/references are affected
2. What type of updates are needed
3. Priority recommendation

Keep it concise and developer-friendly.`,
    });

    return text.trim();
  } catch {
    return null;
  }
}

