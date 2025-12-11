/**
 * POST /execute - Execute a build plan in a Vercel Sandbox
 *
 * Request body:
 * - plan: BuildPlan object (required)
 *
 * Response:
 * - BuildPlanExecutionResult with spec and step results
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

interface ExecuteRequestBody {
  plan: BuildPlan;
}

/**
 * Map package manager to install command
 */
function getInstallCommand(pm: string): { cmd: string; args: string[] } {
  switch (pm) {
    case 'bun':
      return { cmd: 'bun', args: ['install', '--ignore-scripts'] };
    case 'pnpm':
      return { cmd: 'pnpm', args: ['install', '--ignore-scripts'] };
    case 'yarn':
      return { cmd: 'yarn', args: ['install', '--ignore-scripts'] };
    default:
      return { cmd: 'npm', args: ['install', '--ignore-scripts', '--legacy-peer-deps'] };
  }
}

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as ExecuteRequestBody;

  if (!body.plan) {
    return res.status(400).json({ error: 'plan is required' });
  }

  const { plan } = body;

  // Validate plan structure
  if (!plan.target?.repoUrl || !plan.steps) {
    return res.status(400).json({ error: 'Invalid plan structure' });
  }

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

        stepResults.push({
          stepId: step.id,
          success: result.exitCode === 0,
          duration: Date.now() - stepStart,
          output: stdout.slice(0, 5000), // Truncate output
          error: result.exitCode !== 0 ? stderr.slice(0, 2000) : undefined,
        });

        // Stop on non-optional failures
        if (result.exitCode !== 0 && !step.optional) {
          throw new Error(`Step '${step.name}' failed: ${stderr}`);
        }
      } catch (stepError) {
        stepResults.push({
          stepId: step.id,
          success: false,
          duration: Date.now() - stepStart,
          error: stepError instanceof Error ? stepError.message : 'Unknown error',
        });

        if (!step.optional) {
          throw stepError;
        }
      }
    }

    // Run doccov spec to generate the OpenPkg spec
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

    stepResults.push({
      stepId: 'analyze',
      success: specResult.exitCode === 0,
      duration: Date.now() - specStart,
      output: specStdout.slice(0, 2000),
      error: specResult.exitCode !== 0 ? specStderr.slice(0, 2000) : undefined,
    });

    if (specResult.exitCode !== 0) {
      throw new Error(`Spec generation failed: ${specStderr}`);
    }

    // Read the generated spec - readFile returns a readable stream
    const specStream = await sandbox.readFile({ path: 'openpkg.json' });
    const chunks: Buffer[] = [];
    for await (const chunk of specStream as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const specContent = Buffer.concat(chunks).toString('utf-8');
    const spec = JSON.parse(specContent) as OpenPkg;

    const result: BuildPlanExecutionResult = {
      success: true,
      spec,
      stepResults,
      totalDuration: Date.now() - startTime,
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('Execution error:', error);

    const result: BuildPlanExecutionResult = {
      success: false,
      stepResults,
      totalDuration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    return res.status(200).json(result); // Return 200 with success: false
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
