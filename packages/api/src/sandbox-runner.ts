/**
 * Vercel Sandbox runner for isolated repo scanning
 */

import { Sandbox } from '@vercel/sandbox';
import ms from 'ms';
import type { ScanResult } from './scan-worker';

export interface ScanOptions {
  url: string;
  ref?: string;
  package?: string;
}

/**
 * Run a documentation coverage scan in an isolated Vercel Sandbox.
 * 
 * The sandbox:
 * 1. Clones the repository (automatic via source.url)
 * 2. Installs dependencies (with --ignore-scripts for security)
 * 3. Installs @doccov/cli globally
 * 4. Runs doccov scan with --skip-install (deps already installed)
 * 5. Returns the scan result
 */
export async function runScanInSandbox(options: ScanOptions): Promise<ScanResult> {
  const sandbox = await Sandbox.create({
    source: { 
      url: options.url, 
      type: 'git',
    },
    resources: { vcpus: 4 },
    timeout: ms('5m'),
    runtime: 'node22',
  });

  try {
    // Install project dependencies (with security flags)
    await sandbox.runCommand({ 
      cmd: 'npm', 
      args: ['install', '--ignore-scripts', '--legacy-peer-deps'],
    });

    // Install doccov CLI globally
    await sandbox.runCommand({ 
      cmd: 'npm', 
      args: ['install', '-g', '@doccov/cli'],
    });

    // Build the scan command args
    const scanArgs = ['scan', '.', '--output', 'json', '--skip-install'];
    if (options.package) {
      scanArgs.push('--package', options.package);
    }

    // Run the scan
    const result = await sandbox.runCommand({
      cmd: 'doccov',
      args: scanArgs,
    });

    // Parse and return the JSON result
    // The output may contain spinner text before the JSON, so extract JSON portion
    const stdout = result.stdout ?? '';
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('No JSON output from scan');
    }

    return JSON.parse(jsonMatch[0]) as ScanResult;
  } finally {
    // Always stop the sandbox to clean up resources
    await sandbox.stop();
  }
}

/**
 * Check if Vercel Sandbox is available (OIDC token present)
 */
export function isSandboxAvailable(): boolean {
  return process.env.VERCEL_OIDC_TOKEN !== undefined;
}

