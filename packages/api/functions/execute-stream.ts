/**
 * GET /execute-stream - Execute a build plan with SSE streaming progress
 *
 * Query params:
 * - plan: Base64-encoded BuildPlan JSON (required)
 *
 * SSE Events:
 * - step-start: { stepId, name }
 * - step-progress: { stepId, output }
 * - step-complete: { stepId, success, duration, error? }
 * - complete: { success, spec?, totalDuration, error? }
 * - error: { message }
 */

import type { BuildPlan, BuildPlanExecutionResult, BuildPlanStepResult } from '@doccov/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';
import { Sandbox } from '@vercel/sandbox';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import ms from 'ms';

export const config = {
  runtime: 'nodejs',
  maxDuration: 300, // 5 minutes for full execution
};

/**
 * SSE event types for execute streaming
 */
type ExecuteEvent =
  | { type: 'step-start'; stepId: string; name: string }
  | { type: 'step-progress'; stepId: string; output: string }
  | { type: 'step-complete'; stepId: string; success: boolean; duration: number; error?: string }
  | { type: 'complete'; success: boolean; spec?: OpenPkg; totalDuration: number; error?: string }
  | { type: 'error'; message: string };

/**
 * Map runtime to Vercel sandbox runtime
 */
function getSandboxRuntime(runtime: string): 'node22' | 'node24' {
  if (runtime === 'node24') return 'node24';
  return 'node22'; // Default to node22 for everything else
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get plan from query string (base64 encoded)
  const planBase64 = req.query.plan as string;

  if (!planBase64) {
    return res.status(400).json({ error: 'plan query param is required (base64 encoded JSON)' });
  }

  let plan: BuildPlan;
  try {
    const planJson = Buffer.from(planBase64, 'base64').toString('utf-8');
    plan = JSON.parse(planJson) as BuildPlan;
  } catch {
    return res.status(400).json({ error: 'Invalid plan: must be valid base64-encoded JSON' });
  }

  // Validate plan structure
  if (!plan.target?.repoUrl || !plan.steps) {
    return res.status(400).json({ error: 'Invalid plan structure' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial comment
  res.write(':ok\n\n');

  // Helper to send SSE event
  const sendEvent = (event: ExecuteEvent) => {
    const data = JSON.stringify(event);
    res.write(`data: ${data}\n\n`);
  };

  // Run execution with streaming progress
  await runExecuteWithProgress(plan, sendEvent);

  res.end();
}

async function runExecuteWithProgress(
  plan: BuildPlan,
  sendEvent: (event: ExecuteEvent) => void,
): Promise<void> {
  const startTime = Date.now();
  const stepResults: BuildPlanStepResult[] = [];
  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | null = null;

  try {
    // Create sandbox with git source
    sandbox = await Sandbox.create({
      source: {
        url: plan.target.repoUrl,
        type: 'git',
      },
      resources: { vcpus: 4 },
      timeout: ms('5m'),
      runtime: getSandboxRuntime(plan.environment.runtime),
    });

    // Execute each step
    for (const step of plan.steps) {
      const stepStart = Date.now();

      sendEvent({
        type: 'step-start',
        stepId: step.id,
        name: step.name,
      });

      try {
        const result = await sandbox.runCommand({
          cmd: step.command,
          args: step.args,
          cwd: step.cwd,
          timeout: step.timeout ?? 60000,
        });

        // stdout/stderr are async functions in Vercel Sandbox
        const stdout = result.stdout ? await result.stdout() : '';
        const stderr = result.stderr ? await result.stderr() : '';

        const success = result.exitCode === 0;
        const duration = Date.now() - stepStart;

        stepResults.push({
          stepId: step.id,
          success,
          duration,
          output: stdout.slice(0, 5000),
          error: !success ? stderr.slice(0, 2000) : undefined,
        });

        sendEvent({
          type: 'step-complete',
          stepId: step.id,
          success,
          duration,
          error: !success ? stderr.slice(0, 500) : undefined,
        });

        // Stop on non-optional failures
        if (!success && !step.optional) {
          throw new Error(`Step '${step.name}' failed: ${stderr.slice(0, 500)}`);
        }
      } catch (stepError) {
        const duration = Date.now() - stepStart;
        const errorMsg = stepError instanceof Error ? stepError.message : 'Unknown error';

        stepResults.push({
          stepId: step.id,
          success: false,
          duration,
          error: errorMsg,
        });

        sendEvent({
          type: 'step-complete',
          stepId: step.id,
          success: false,
          duration,
          error: errorMsg.slice(0, 500),
        });

        if (!step.optional) {
          throw stepError;
        }
      }
    }

    // Run doccov spec to generate the OpenPkg spec
    const analyzeStep = {
      id: 'analyze',
      name: 'Generate OpenPkg spec',
    };

    sendEvent({
      type: 'step-start',
      stepId: analyzeStep.id,
      name: analyzeStep.name,
    });

    const specStart = Date.now();
    const entryPoint = plan.target.entryPoints[0] ?? 'src/index.ts';

    // Install doccov CLI first
    await sandbox.runCommand({
      cmd: 'npm',
      args: ['install', '-g', '@doccov/cli@latest'],
    });

    // Run spec generation
    const specResult = await sandbox.runCommand({
      cmd: 'doccov',
      args: ['spec', entryPoint, '--output', 'openpkg.json'],
      cwd: plan.target.rootPath,
    });

    const specStdout = specResult.stdout ? await specResult.stdout() : '';
    const specStderr = specResult.stderr ? await specResult.stderr() : '';
    const specDuration = Date.now() - specStart;

    stepResults.push({
      stepId: 'analyze',
      success: specResult.exitCode === 0,
      duration: specDuration,
      output: specStdout.slice(0, 2000),
      error: specResult.exitCode !== 0 ? specStderr.slice(0, 2000) : undefined,
    });

    sendEvent({
      type: 'step-complete',
      stepId: 'analyze',
      success: specResult.exitCode === 0,
      duration: specDuration,
      error: specResult.exitCode !== 0 ? specStderr.slice(0, 500) : undefined,
    });

    if (specResult.exitCode !== 0) {
      throw new Error(`Spec generation failed: ${specStderr.slice(0, 500)}`);
    }

    // Read the generated spec - readFile returns a readable stream
    const specStream = await sandbox.readFile({ path: 'openpkg.json' });
    const chunks: Buffer[] = [];
    for await (const chunk of specStream as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const specContent = Buffer.concat(chunks).toString('utf-8');
    const spec = JSON.parse(specContent) as OpenPkg;

    sendEvent({
      type: 'complete',
      success: true,
      spec,
      totalDuration: Date.now() - startTime,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    sendEvent({
      type: 'complete',
      success: false,
      totalDuration: Date.now() - startTime,
      error: errorMsg,
    });
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
