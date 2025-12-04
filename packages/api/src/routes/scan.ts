import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { Hono } from 'hono';
import { isSandboxAvailable, runScanInSandbox } from '../sandbox-runner';
import { type ScanJob, type ScanResult, scanJobStore } from '../scan-worker';
import { scanRequestSchema } from '../schemas/scan';

export const scanRoute = new Hono();

/**
 * POST /scan
 * Start a new scan job
 */
scanRoute.post('/', async (c) => {
  // Parse JSON with error handling
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  // Validate request body with Zod schema
  const parsed = scanRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json(
      {
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => i.message),
      },
      400,
    );
  }

  const body = parsed.data;

  // Generate job ID
  const jobId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Check cache first
  const cacheKey = buildCacheKey(body.url, body.ref, body.package);
  const cached = scanJobStore.getFromCache(cacheKey);
  if (cached) {
    return c.json({
      jobId,
      status: 'complete',
      cached: true,
      result: cached,
    });
  }

  // Create job
  const job: ScanJob = {
    id: jobId,
    status: 'pending',
    url: body.url,
    ref: body.ref,
    package: body.package,
    createdAt: Date.now(),
  };

  scanJobStore.set(jobId, job);

  // Start background worker (sandbox or local based on environment)
  startScanWorker(job, cacheKey);

  return c.json({
    jobId,
    status: 'pending',
    pollUrl: `/scan/${jobId}`,
  });
});

/**
 * GET /scan/:jobId
 * Get scan job status and result
 */
scanRoute.get('/:jobId', (c) => {
  const jobId = c.req.param('jobId');
  const job = scanJobStore.get(jobId);

  if (!job) {
    return c.json({ error: 'Job not found' }, 404);
  }

  if (job.status === 'complete') {
    return c.json({
      jobId,
      status: 'complete',
      result: job.result,
    });
  }

  if (job.status === 'failed') {
    return c.json({
      jobId,
      status: 'failed',
      error: job.error,
    });
  }

  return c.json({
    jobId,
    status: job.status,
    startedAt: job.startedAt,
  });
});

/**
 * Build cache key from scan parameters
 */
function buildCacheKey(url: string, ref?: string, pkg?: string): string {
  const parts = [url, ref ?? 'main'];
  if (pkg) parts.push(pkg);
  return parts.join('::');
}

/**
 * Start background scan worker
 * Uses Vercel Sandbox in production, local spawn in development
 */
function startScanWorker(job: ScanJob, cacheKey: string): void {
  if (isSandboxAvailable()) {
    runSandboxScan(job, cacheKey);
  } else {
    runLocalScan(job, cacheKey);
  }
}

/**
 * Run scan in Vercel Sandbox (production)
 */
async function runSandboxScan(job: ScanJob, cacheKey: string): Promise<void> {
  job.status = 'running';
  job.startedAt = Date.now();
  scanJobStore.set(job.id, job);

  try {
    const result = await runScanInSandbox({
      url: job.url,
      ref: job.ref,
      package: job.package,
    });

    job.status = 'complete';
    job.result = result;
    job.completedAt = Date.now();
    scanJobStore.setCache(cacheKey, result);
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
  }

  scanJobStore.set(job.id, job);
}

/**
 * Run scan locally via CLI spawn (development fallback)
 */
function runLocalScan(job: ScanJob, cacheKey: string): void {
  // Update job status
  job.status = 'running';
  job.startedAt = Date.now();
  scanJobStore.set(job.id, job);

  // Get monorepo root (packages/api/src/routes -> root)
  const monorepoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
  const cliPath = path.join(monorepoRoot, 'packages/cli/src/cli.ts');

  // Build command args
  const args = [cliPath, 'scan', job.url, '--output', 'json'];
  if (job.ref) {
    args.push('--ref', job.ref);
  }
  if (job.package) {
    args.push('--package', job.package);
  }

  // Spawn doccov scan process
  const proc = spawn('bun', args, {
    cwd: monorepoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  proc.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  proc.on('close', (code) => {
    if (code === 0) {
      try {
        // Extract JSON from output (skip any non-JSON lines)
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]) as ScanResult;
          job.status = 'complete';
          job.result = result;
          job.completedAt = Date.now();

          // Cache result
          scanJobStore.setCache(cacheKey, result);
        } else {
          job.status = 'failed';
          job.error = 'No JSON output from scan';
        }
      } catch (parseError) {
        job.status = 'failed';
        job.error = `Failed to parse scan output: ${parseError instanceof Error ? parseError.message : parseError}`;
      }
    } else {
      job.status = 'failed';
      job.error = stderr || `Scan exited with code ${code}`;
    }

    scanJobStore.set(job.id, job);
  });

  proc.on('error', (err) => {
    job.status = 'failed';
    job.error = `Process error: ${err.message}`;
    scanJobStore.set(job.id, job);
  });

  // Timeout after 3 minutes
  setTimeout(() => {
    if (job.status === 'running') {
      proc.kill();
      job.status = 'failed';
      job.error = 'Scan timed out after 3 minutes';
      scanJobStore.set(job.id, job);
    }
  }, 180000);
}
