// src/ai-agent-enhanced.ts
import { generateText, tool, Output } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { openPkgSchema } from './types/openpkg';
import { validateOpenPkg } from './utils/validate';

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Enhanced AI agent that complements the TypeScript Compiler API
 * Now focuses on:
 * - Documentation enhancement
 * - Example generation
 * - Usage pattern detection
 * - Best practices suggestions
 */
export async function enhanceWithAI(
  spec: z.infer<typeof openPkgSchema>,
  options: {
    generateExamples?: boolean;
    enhanceDescriptions?: boolean;
    suggestBestPractices?: boolean;
    analyzeUsagePatterns?: boolean;
  } = {}
): Promise<z.infer<typeof openPkgSchema>> {
  // AI is now purely optional enhancement
  if (!process.env.ANTHROPIC_API_KEY) {
    return spec; // Return unchanged if no API key
  }

  const {
    generateExamples = true,
    enhanceDescriptions = true,
    suggestBestPractices = false,
    analyzeUsagePatterns = false
  } = options;

  try {
    const { experimental_output } = await generateText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      experimental_output: Output.object({
        schema: openPkgSchema
      }),
      prompt: `You are enhancing a TypeScript package specification that has already been fully resolved by the TypeScript Compiler API.

The spec already has complete type information. Your role is to enhance the human-readable aspects:

${JSON.stringify(spec, null, 2)}

Please enhance this specification by:

${generateExamples ? '1. Adding practical code examples for exported functions and classes' : ''}
${enhanceDescriptions ? '2. Improving descriptions to be more helpful and comprehensive' : ''}
${suggestBestPractices ? '3. Adding best practice notes in descriptions where relevant' : ''}
${analyzeUsagePatterns ? '4. Identifying common usage patterns and documenting them' : ''}

Important rules:
- Keep ALL type information exactly as provided
- Only modify: descriptions, examples, and documentation fields
- Do not change any type definitions, they are already correct
- Focus on making the spec more useful for developers

Return the enhanced OpenPkg specification.`
    });

    if (experimental_output) {
      return validateOpenPkg(experimental_output);
    }
    return spec;
  } catch (error) {
    console.warn('AI enhancement failed, returning original spec:', error);
    return spec;
  }
}

/**
 * Generate usage examples for a specific function or class
 */
export async function generateExamplesForExport(
  exportName: string,
  exportInfo: any,
  typeContext: any[]
): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return [];
  }

  try {
    const { text } = await generateText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      prompt: `Generate 2-3 practical usage examples for this TypeScript export:

Export: ${exportName}
Info: ${JSON.stringify(exportInfo, null, 2)}
Available Types: ${JSON.stringify(typeContext, null, 2)}

Return only the code examples, one per line, no explanations.`
    });

    return text.split('\n').filter(line => line.trim().length > 0);
  } catch (error) {
    console.warn('Failed to generate examples:', error);
    return [];
  }
}

/**
 * Suggest improvements for API design
 */
export async function suggestAPIImprovements(
  spec: z.infer<typeof openPkgSchema>
): Promise<{
  suggestions: Array<{
    type: 'naming' | 'structure' | 'documentation' | 'typing';
    item: string;
    current: string;
    suggestion: string;
    reason: string;
  }>;
}> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { suggestions: [] };
  }

  try {
    const { text } = await generateText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      prompt: `Analyze this TypeScript API specification and suggest improvements:

${JSON.stringify(spec, null, 2)}

Focus on:
1. Naming conventions
2. Type structure improvements
3. Missing documentation
4. API consistency

Return a JSON array of suggestions with format:
{ type, item, current, suggestion, reason }`
    });

    const suggestions = JSON.parse(text);
    return { suggestions };
  } catch (error) {
    console.warn('Failed to generate suggestions:', error);
    return { suggestions: [] };
  }
}