/**
 * AI generation endpoint
 *
 * POST /v1/ai/generate - Generate JSDoc for undocumented exports
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { getPlanLimits, type Plan } from '@doccov/db';
import { generateObject } from 'ai';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client';
import type { ApiKeyContext } from '../middleware/api-key-auth';

type AiVariables = {
  Variables: ApiKeyContext;
};

const aiRoute = new Hono<AiVariables>();

// Schema for request body
const GenerateRequestSchema = z.object({
  exports: z.array(
    z.object({
      name: z.string(),
      kind: z.string(),
      signature: z.string().optional(),
      members: z
        .array(
          z.object({
            name: z.string(),
            type: z.string().optional(),
          }),
        )
        .optional(),
    }),
  ),
  packageName: z.string().optional(),
});

// Schema for AI-generated JSDoc
const JSDocGenerationSchema = z.object({
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

type JSDocGenerationResult = z.infer<typeof JSDocGenerationSchema>;

/**
 * Get AI model - uses server-side API keys
 */
function getModel() {
  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic();
    return anthropic('claude-sonnet-4-20250514');
  }

  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI();
    return openai('gpt-4o-mini');
  }

  throw new Error('No AI provider configured');
}

/**
 * Check and update AI quota for an organization
 * Returns remaining quota or error
 */
async function checkAndUpdateQuota(
  orgId: string,
  plan: string,
  currentUsed: number,
  resetAt: Date | null,
  callCount: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date; error?: string }> {
  const limits = getPlanLimits(plan as Plan);
  const monthlyLimit = limits.aiCallsPerMonth;

  // Check if unlimited
  if (monthlyLimit === Infinity) {
    return { allowed: true, remaining: Infinity, resetAt: new Date() };
  }

  // Check if we need to reset the counter (monthly)
  const now = new Date();
  const shouldReset = !resetAt || now >= resetAt;

  let used = currentUsed;
  let nextReset = resetAt || getNextMonthReset();

  if (shouldReset) {
    // Reset the counter
    used = 0;
    nextReset = getNextMonthReset();

    await db
      .updateTable('organizations')
      .set({
        aiCallsUsed: 0,
        aiCallsResetAt: nextReset,
      })
      .where('id', '=', orgId)
      .execute();
  }

  // Check if over limit
  if (used + callCount > monthlyLimit) {
    return {
      allowed: false,
      remaining: Math.max(0, monthlyLimit - used),
      resetAt: nextReset,
      error: `Monthly AI limit reached (${used}/${monthlyLimit} calls used). Set OPENAI_API_KEY or ANTHROPIC_API_KEY for unlimited.`,
    };
  }

  // Increment usage
  await db
    .updateTable('organizations')
    .set({
      aiCallsUsed: used + callCount,
    })
    .where('id', '=', orgId)
    .execute();

  // Track in usage_records (async)
  db.insertInto('usage_records')
    .values({
      id: crypto.randomUUID(),
      orgId,
      feature: 'ai_generate',
      count: callCount,
    })
    .execute()
    .catch(console.error);

  return {
    allowed: true,
    remaining: monthlyLimit - (used + callCount),
    resetAt: nextReset,
  };
}

/**
 * Get the first day of next month
 */
function getNextMonthReset(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

/**
 * Generate JSDoc for a single export
 */
async function generateJSDocForExport(
  exp: {
    name: string;
    kind: string;
    signature?: string;
    members?: { name: string; type?: string }[];
  },
  packageName?: string,
): Promise<JSDocGenerationResult> {
  const membersContext =
    exp.members && exp.members.length > 0
      ? `\n\nMembers:\n${exp.members
          .slice(0, 10)
          .map((m) => `  - ${m.name}${m.type ? `: ${m.type}` : ''}`)
          .join('\n')}`
      : '';

  const prompt = `Generate JSDoc documentation for this TypeScript export.

Name: ${exp.name}
Kind: ${exp.kind}
${exp.signature ? `Signature: ${exp.signature}` : ''}${membersContext}
${packageName ? `Package: ${packageName}` : ''}

Requirements:
- Description: 1-2 sentences explaining what this does and when to use it
- For functions: describe each parameter and return value
- Example: provide a working code snippet showing typical usage
- Be concise but informative`;

  // biome-ignore lint/suspicious/noExplicitAny: AI SDK type mismatch between LanguageModelV1/V2
  const { object } = await generateObject({
    model: getModel() as any,
    schema: JSDocGenerationSchema,
    prompt,
  });

  return object;
}

// POST /v1/ai/generate
aiRoute.post('/generate', async (c) => {
  const org = c.get('org') as {
    id: string;
    plan: string;
    aiCallsUsed: number;
    aiCallsResetAt: Date | null;
  };

  if (!org) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Parse request body
  let body: z.infer<typeof GenerateRequestSchema>;
  try {
    const raw = await c.req.json();
    body = GenerateRequestSchema.parse(raw);
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  if (body.exports.length === 0) {
    return c.json({ error: 'No exports provided' }, 400);
  }

  // Limit batch size
  if (body.exports.length > 20) {
    return c.json({ error: 'Maximum 20 exports per request' }, 400);
  }

  // Check quota before processing
  const quotaCheck = await checkAndUpdateQuota(
    org.id,
    org.plan,
    org.aiCallsUsed,
    org.aiCallsResetAt,
    body.exports.length,
  );

  if (!quotaCheck.allowed) {
    return c.json(
      {
        error: quotaCheck.error,
        remaining: quotaCheck.remaining,
        resetAt: quotaCheck.resetAt.toISOString(),
        byok: 'Set OPENAI_API_KEY or ANTHROPIC_API_KEY for unlimited generation',
      },
      429,
    );
  }

  // Generate JSDoc for each export
  const results: Array<{
    name: string;
    patch: JSDocGenerationResult | null;
    error?: string;
  }> = [];

  // Process in batches of 3 to avoid rate limits
  for (let i = 0; i < body.exports.length; i += 3) {
    const batch = body.exports.slice(i, i + 3);
    const promises = batch.map(async (exp) => {
      try {
        const patch = await generateJSDocForExport(exp, body.packageName);
        return { name: exp.name, patch };
      } catch (err) {
        return {
          name: exp.name,
          patch: null,
          error: err instanceof Error ? err.message : 'Generation failed',
        };
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }

  const successful = results.filter((r) => r.patch !== null).length;
  const failed = results.filter((r) => r.patch === null).length;

  return c.json({
    success: true,
    generated: successful,
    failed,
    results,
    quota: {
      remaining: quotaCheck.remaining,
      resetAt: quotaCheck.resetAt.toISOString(),
    },
  });
});

// GET /v1/ai/quota - Check remaining AI quota
aiRoute.get('/quota', async (c) => {
  const org = c.get('org') as {
    id: string;
    plan: string;
    aiCallsUsed: number;
    aiCallsResetAt: Date | null;
  };

  if (!org) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const limits = getPlanLimits(org.plan as Plan);
  const monthlyLimit = limits.aiCallsPerMonth;

  // Check if reset is needed
  const now = new Date();
  const shouldReset = !org.aiCallsResetAt || now >= org.aiCallsResetAt;

  let used = org.aiCallsUsed;
  let resetAt = org.aiCallsResetAt || getNextMonthReset();

  if (shouldReset) {
    used = 0;
    resetAt = getNextMonthReset();
  }

  return c.json({
    plan: org.plan,
    used,
    limit: monthlyLimit === Infinity ? 'unlimited' : monthlyLimit,
    remaining: monthlyLimit === Infinity ? 'unlimited' : Math.max(0, monthlyLimit - used),
    resetAt: resetAt.toISOString(),
  });
});

export { aiRoute };
