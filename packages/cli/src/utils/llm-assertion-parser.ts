/**
 * LLM-powered assertion parsing for non-standard comment patterns
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

/**
 * Schema for LLM assertion parsing output
 */
export const AssertionParseSchema = z.object({
  assertions: z
    .array(
      z.object({
        lineNumber: z.number().describe('1-indexed line number where the assertion appears'),
        expected: z.string().describe('The expected output value'),
        originalComment: z.string().describe('The original comment text'),
        suggestedSyntax: z.string().describe('The line rewritten with standard // => value syntax'),
      }),
    )
    .describe('List of assertion-like comments found in the code'),
  hasAssertions: z.boolean().describe('Whether any assertion-like comments were found'),
});

export type LLMAssertionResult = z.infer<typeof AssertionParseSchema>;

const ASSERTION_PARSE_PROMPT = (
  code: string,
) => `Analyze this TypeScript/JavaScript example code for assertion-like comments.

Look for comments that appear to specify expected output values, such as:
- "// should be 3"
- "// returns 5"
- "// outputs: hello"
- "// expected: [1, 2, 3]"
- "// 42" (bare value after console.log)
- "// result: true"

Do NOT include:
- Regular code comments that explain what the code does
- Comments that are instructions or documentation
- Comments with // => (already using standard syntax)

For each assertion found, extract:
1. The line number (1-indexed)
2. The expected value (just the value, not the comment prefix)
3. The original comment text
4. A suggested rewrite of the ENTIRE line using "// => value" syntax

Code:
\`\`\`
${code}
\`\`\``;

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
 * Check if LLM assertion parsing is available (API key configured)
 */
export function isLLMAssertionParsingAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

/**
 * Parse assertions from example code using an LLM.
 * Used as a fallback when standard // => syntax is not found but comments exist.
 * Returns null if no API key is configured or if an error occurs.
 */
export async function parseAssertionsWithLLM(code: string): Promise<LLMAssertionResult | null> {
  if (!isLLMAssertionParsingAvailable()) {
    return null;
  }

  try {
    const model = getModel();

    const { object } = await generateObject({
      model,
      schema: AssertionParseSchema,
      prompt: ASSERTION_PARSE_PROMPT(code),
    });

    return object;
  } catch {
    // Graceful degradation - LLM failure shouldn't break assertion checking
    return null;
  }
}
