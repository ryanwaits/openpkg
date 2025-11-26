import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface ExampleRunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface RunExampleOptions {
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Working directory for execution */
  cwd?: string;
}

/**
 * Strip markdown code block markers from example code
 */
function stripCodeBlockMarkers(code: string): string {
  return code
    .replace(/^```(?:ts|typescript|js|javascript)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

/**
 * Run an example code snippet in an isolated Node process.
 * Uses Node 22+ --experimental-strip-types for direct TS execution.
 */
export async function runExample(
  code: string,
  options: RunExampleOptions = {},
): Promise<ExampleRunResult> {
  const { timeout = 5000, cwd = process.cwd() } = options;
  const cleanCode = stripCodeBlockMarkers(code);

  // Create temp file
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(
    tmpDir,
    `doccov-example-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`,
  );

  try {
    fs.writeFileSync(tmpFile, cleanCode, 'utf-8');

    const startTime = Date.now();

    return await new Promise<ExampleRunResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;

      const proc = spawn('node', ['--experimental-strip-types', tmpFile], {
        cwd,
        timeout,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        killed = true;
        proc.kill('SIGKILL');
      }, timeout);

      proc.on('close', (exitCode) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        if (killed) {
          resolve({
            success: false,
            stdout,
            stderr: stderr || `Example timed out after ${timeout}ms`,
            exitCode: exitCode ?? 1,
            duration,
          });
        } else {
          resolve({
            success: exitCode === 0,
            stdout,
            stderr,
            exitCode: exitCode ?? 1,
            duration,
          });
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          stdout,
          stderr: error.message,
          exitCode: 1,
          duration: Date.now() - startTime,
        });
      });
    });
  } finally {
    // Cleanup temp file
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Run multiple examples and collect results
 */
export async function runExamples(
  examples: string[],
  options: RunExampleOptions = {},
): Promise<Map<number, ExampleRunResult>> {
  const results = new Map<number, ExampleRunResult>();

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    if (typeof example === 'string' && example.trim()) {
      results.set(i, await runExample(example, options));
    }
  }

  return results;
}
