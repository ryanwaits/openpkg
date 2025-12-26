import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { validateApiKey } from '@doccov/api-shared';
import { getPlanLimits, type Plan } from '@doccov/db';
import { generateObject } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db';

const GenerateRequestSchema = z.object({
  exports: z.array(
    z.object({
      name: z.string(),
      kind: z.string(),
      signature: z.string().optional(),
      members: z.array(z.object({ name: z.string(), type: z.string().optional() })).optional(),
    }),
  ),
  packageName: z.string().optional(),
});

const JSDocGenerationSchema = z.object({
  description: z.string().describe('1-2 sentence description of what this does'),
  params: z
    .array(z.object({ name: z.string(), type: z.string().optional(), description: z.string() }))
    .optional()
    .describe('Parameter descriptions for functions'),
  returns: z
    .object({ type: z.string().optional(), description: z.string() })
    .optional()
    .describe('Return value description for functions'),
  example: z.string().optional().describe('Working code example showing typical usage'),
  typeParams: z
    .array(z.object({ name: z.string(), description: z.string() }))
    .optional()
    .describe('Type parameter descriptions for generics'),
});

type JSDocGenerationResult = z.infer<typeof JSDocGenerationSchema>;

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

function getNextMonthReset(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

async function checkAndUpdateQuota(
  orgId: string,
  plan: string,
  currentUsed: number,
  resetAt: Date | null,
  callCount: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date; error?: string }> {
  const limits = getPlanLimits(plan as Plan);
  const monthlyLimit = limits.aiCallsPerMonth;

  if (monthlyLimit === Infinity) {
    return { allowed: true, remaining: Infinity, resetAt: new Date() };
  }

  const now = new Date();
  const shouldReset = !resetAt || now >= resetAt;

  let used = currentUsed;
  let nextReset = resetAt || getNextMonthReset();

  if (shouldReset) {
    used = 0;
    nextReset = getNextMonthReset();
    await db
      .updateTable('organizations')
      .set({ aiCallsUsed: 0, aiCallsResetAt: nextReset })
      .where('id', '=', orgId)
      .execute();
  }

  if (used + callCount > monthlyLimit) {
    return {
      allowed: false,
      remaining: Math.max(0, monthlyLimit - used),
      resetAt: nextReset,
      error: `Monthly AI limit reached (${used}/${monthlyLimit} calls used).`,
    };
  }

  await db
    .updateTable('organizations')
    .set({ aiCallsUsed: used + callCount })
    .where('id', '=', orgId)
    .execute();

  db.insertInto('usage_records')
    .values({ id: crypto.randomUUID(), orgId, feature: 'ai_generate', count: callCount })
    .execute()
    .catch(console.error);

  return { allowed: true, remaining: monthlyLimit - (used + callCount), resetAt: nextReset };
}

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

  const { object } = await generateObject({
    // biome-ignore lint/suspicious/noExplicitAny: AI SDK type mismatch
    model: getModel() as any,
    schema: JSDocGenerationSchema,
    prompt,
  });

  return object;
}

// POST /v1/ai/generate
export async function POST(request: Request) {
  const validation = await validateApiKey(request, db);
  if (!validation.ok) {
    return Response.json(
      { error: validation.error, docs: validation.docs, upgrade: validation.upgrade },
      { status: validation.status },
    );
  }

  const { org } = validation.context;

  let body: z.infer<typeof GenerateRequestSchema>;
  try {
    const raw = await request.json();
    body = GenerateRequestSchema.parse(raw);
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (body.exports.length === 0) {
    return Response.json({ error: 'No exports provided' }, { status: 400 });
  }

  if (body.exports.length > 20) {
    return Response.json({ error: 'Maximum 20 exports per request' }, { status: 400 });
  }

  const quotaCheck = await checkAndUpdateQuota(
    org.id,
    org.plan,
    org.aiCallsUsed,
    org.aiCallsResetAt,
    body.exports.length,
  );

  if (!quotaCheck.allowed) {
    return Response.json(
      {
        error: quotaCheck.error,
        remaining: quotaCheck.remaining,
        resetAt: quotaCheck.resetAt.toISOString(),
      },
      { status: 429 },
    );
  }

  const results: Array<{ name: string; patch: JSDocGenerationResult | null; error?: string }> = [];

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

  return Response.json({
    success: true,
    generated: successful,
    failed,
    results,
    quota: { remaining: quotaCheck.remaining, resetAt: quotaCheck.resetAt.toISOString() },
  });
}
