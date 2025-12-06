import { Writable } from 'node:stream';
import {
  detectBuildInfo,
  detectMonorepo,
  detectPackageManager,
  getInstallCommand,
  getPrimaryBuildScript,
  SandboxFileSystem,
  type ScanResult,
} from '@doccov/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Sandbox } from '@vercel/sandbox';

export const config = {
  runtime: 'nodejs',
  maxDuration: 300,
};

interface JobEvent {
  type: 'progress' | 'complete' | 'error';
  stage?: string;
  message?: string;
  progress?: number;
  result?: ScanResult;
  availablePackages?: string[];
}

// Helper to capture stream output
function createCaptureStream(): { stream: Writable; getOutput: () => string } {
  let output = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  return { stream, getOutput: () => output };
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

  // Get params from query string
  const url = req.query.url as string;
  const ref = (req.query.ref as string) || 'main';
  const owner = req.query.owner as string;
  const repo = req.query.repo as string;
  const pkg = req.query.package as string | undefined;

  if (!url || !owner || !repo) {
    return res.status(400).json({ error: 'Missing required query params (url, owner, repo)' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial comment
  res.write(':ok\n\n');

  // Helper to send SSE event
  const sendEvent = (event: JobEvent) => {
    const data = JSON.stringify(event);
    res.write(`data: ${data}\n\n`);
  };

  // Run scan with streaming progress
  await runScanWithProgress({ url, ref, owner, repo, package: pkg }, sendEvent);

  res.end();
}

interface ScanOptions {
  url: string;
  ref: string;
  owner: string;
  repo: string;
  package?: string;
}

async function runScanWithProgress(
  options: ScanOptions,
  sendEvent: (event: JobEvent) => void,
): Promise<void> {
  try {
    sendEvent({
      type: 'progress',
      stage: 'cloning',
      message: `Cloning ${options.owner}/${options.repo}...`,
      progress: 5,
    });

    const sandbox = await Sandbox.create({
      source: {
        url: options.url,
        type: 'git',
      },
      resources: { vcpus: 4 },
      timeout: 5 * 60 * 1000,
      runtime: 'node22',
    });

    try {
      // Create filesystem abstraction for SDK detection functions
      const fs = new SandboxFileSystem(sandbox);

      // Checkout specific ref if not main/master
      if (options.ref && options.ref !== 'main' && options.ref !== 'master') {
        sendEvent({
          type: 'progress',
          stage: 'cloning',
          message: `Checking out ${options.ref}...`,
          progress: 7,
        });

        const checkoutCapture = createCaptureStream();
        const checkoutResult = await sandbox.runCommand({
          cmd: 'git',
          args: ['checkout', options.ref],
          stdout: checkoutCapture.stream,
          stderr: checkoutCapture.stream,
        });

        if (checkoutResult.exitCode !== 0) {
          // Try fetching the ref first (might be a tag not fetched by shallow clone)
          await sandbox.runCommand({
            cmd: 'git',
            args: [
              'fetch',
              '--depth',
              '1',
              'origin',
              `refs/tags/${options.ref}:refs/tags/${options.ref}`,
            ],
          });
          const retryResult = await sandbox.runCommand({
            cmd: 'git',
            args: ['checkout', options.ref],
          });
          if (retryResult.exitCode !== 0) {
            throw new Error(`Failed to checkout ${options.ref}: ${checkoutCapture.getOutput()}`);
          }
        }
      }

      sendEvent({
        type: 'progress',
        stage: 'detecting',
        message: 'Detecting project structure...',
        progress: 10,
      });

      // Detect package manager using SDK
      const pmInfo = await detectPackageManager(fs);
      const pmMessage = pmInfo.lockfile
        ? `Detected ${pmInfo.name} project`
        : 'No lockfile detected';
      sendEvent({ type: 'progress', stage: 'detecting', message: pmMessage, progress: 15 });

      // Early monorepo detection - fail fast if monorepo without package param
      if (!options.package) {
        const mono = await detectMonorepo(fs);

        if (mono.isMonorepo) {
          sendEvent({
            type: 'progress',
            stage: 'detecting',
            message: 'Monorepo detected, listing packages...',
            progress: 17,
          });

          const availablePackages = mono.packages.filter((p) => !p.private).map((p) => p.name);

          await sandbox.stop();
          sendEvent({
            type: 'error',
            message: `Monorepo detected. Please specify a package to analyze using the 'package' query parameter.`,
            availablePackages,
          });
          return;
        }
      }

      // Install package manager if needed (npm and pnpm are pre-installed in node22)
      if (pmInfo.name === 'bun') {
        sendEvent({
          type: 'progress',
          stage: 'installing',
          message: 'Installing bun...',
          progress: 18,
        });
        await sandbox.runCommand({ cmd: 'npm', args: ['install', '-g', 'bun'] });
      } else if (pmInfo.name === 'yarn') {
        sendEvent({
          type: 'progress',
          stage: 'installing',
          message: 'Installing yarn...',
          progress: 18,
        });
        await sandbox.runCommand({ cmd: 'npm', args: ['install', '-g', 'yarn'] });
      }

      // Install dependencies with fallback chain
      sendEvent({
        type: 'progress',
        stage: 'installing',
        message: 'Installing dependencies...',
        progress: 20,
      });

      let installed = false;
      let activePm = pmInfo.name;
      const installCapture = createCaptureStream();

      // Try primary package manager using SDK's getInstallCommand
      const primaryCmd = getInstallCommand(pmInfo);
      const primaryResult = await sandbox.runCommand({
        cmd: primaryCmd[0],
        args: primaryCmd.slice(1),
        stdout: installCapture.stream,
        stderr: installCapture.stream,
      });

      if (primaryResult.exitCode === 0) {
        installed = true;
      } else {
        const errorOutput = installCapture.getOutput();

        // Check if it's a workspace:* protocol error - try bun fallback
        if (errorOutput.includes('workspace:') || errorOutput.includes('EUNSUPPORTEDPROTOCOL')) {
          sendEvent({
            type: 'progress',
            stage: 'installing',
            message: 'Trying bun fallback for workspace protocol...',
            progress: 25,
          });

          // Install bun if not already the primary
          if (pmInfo.name !== 'bun') {
            await sandbox.runCommand({ cmd: 'npm', args: ['install', '-g', 'bun'] });
          }

          const bunCapture = createCaptureStream();
          const bunResult = await sandbox.runCommand({
            cmd: 'bun',
            args: ['install'],
            stdout: bunCapture.stream,
            stderr: bunCapture.stream,
          });

          if (bunResult.exitCode === 0) {
            installed = true;
            activePm = 'bun'; // Update pm for build step
          }
        }
      }

      if (installed) {
        sendEvent({
          type: 'progress',
          stage: 'installing',
          message: 'Dependencies installed',
          progress: 40,
        });
      } else {
        // Graceful degradation - continue with limited analysis
        sendEvent({
          type: 'progress',
          stage: 'installing',
          message: 'Install failed (continuing with limited analysis)',
          progress: 40,
        });
      }

      // Check for build script using SDK
      const buildInfo = await detectBuildInfo(fs);
      const buildScript = getPrimaryBuildScript(buildInfo);

      if (buildScript) {
        sendEvent({
          type: 'progress',
          stage: 'building',
          message: 'Running build...',
          progress: 45,
        });

        const buildCapture = createCaptureStream();
        // Use activePm (may have changed to bun as fallback)
        const buildCmd =
          activePm === 'npm' || activePm === 'yarn'
            ? [activePm, 'run', buildScript]
            : [activePm, buildScript];

        const buildResult = await sandbox.runCommand({
          cmd: buildCmd[0],
          args: buildCmd.slice(1),
          stdout: buildCapture.stream,
          stderr: buildCapture.stream,
        });

        const buildMessage =
          buildResult.exitCode === 0 ? 'Build complete' : 'Build failed (continuing)';
        sendEvent({ type: 'progress', stage: 'building', message: buildMessage, progress: 55 });
      }

      // Install doccov CLI
      sendEvent({
        type: 'progress',
        stage: 'analyzing',
        message: 'Installing DocCov CLI...',
        progress: 60,
      });

      const cliInstall = await sandbox.runCommand({
        cmd: 'npm',
        args: ['install', '-g', '@doccov/cli'],
      });

      if (cliInstall.exitCode !== 0) {
        throw new Error('Failed to install @doccov/cli');
      }

      // Run generate
      const specFile = '/tmp/spec.json';
      const genArgs = ['generate', '--cwd', '.', '-o', specFile];
      const analyzeMessage = options.package
        ? `Analyzing ${options.package}...`
        : 'Generating DocCov spec...';
      if (options.package) {
        genArgs.push('--package', options.package);
      }

      sendEvent({ type: 'progress', stage: 'analyzing', message: analyzeMessage, progress: 65 });

      const genCapture = createCaptureStream();
      const genResult = await sandbox.runCommand({
        cmd: 'doccov',
        args: genArgs,
        stdout: genCapture.stream,
        stderr: genCapture.stream,
      });

      const genOutput = genCapture.getOutput();
      if (genResult.exitCode !== 0) {
        throw new Error(`doccov generate failed: ${genOutput.slice(-300)}`);
      }

      sendEvent({
        type: 'progress',
        stage: 'extracting',
        message: 'Extracting results...',
        progress: 85,
      });

      // Check if spec file was created
      const checkFileCapture = createCaptureStream();
      await sandbox.runCommand({
        cmd: 'cat',
        args: [specFile],
        stdout: checkFileCapture.stream,
        stderr: checkFileCapture.stream,
      });
      const specContent = checkFileCapture.getOutput();

      if (!specContent.trim() || specContent.includes('No such file')) {
        throw new Error(`Spec file not found or empty. Generate output: ${genOutput.slice(-500)}`);
      }

      // Extract summary with error handling
      const extractScript = `
        const fs = require('fs');
        try {
          if (!fs.existsSync('${specFile}')) {
            console.error('Spec file not found: ${specFile}');
            process.exit(1);
          }
          const content = fs.readFileSync('${specFile}', 'utf-8');
          const spec = JSON.parse(content);
          const undocumented = [];
          const drift = [];
          for (const exp of spec.exports || []) {
            const docs = exp.docs;
            if (!docs) continue;
            if ((docs.missing?.length || 0) > 0 || (docs.coverageScore || 0) < 100) {
              undocumented.push(exp.name);
            }
            for (const d of docs.drift || []) {
              drift.push({ export: exp.name, type: d.type, issue: d.issue });
            }
          }
          console.log(JSON.stringify({
            coverage: spec.docs?.coverageScore || 0,
            exportCount: spec.exports?.length || 0,
            typeCount: spec.types?.length || 0,
            undocumented: undocumented.slice(0, 50),
            drift: drift.slice(0, 20),
            driftCount: drift.length,
          }));
        } catch (e) {
          console.error('Extract error:', e.message);
          process.exit(1);
        }
      `.replace(/\n/g, ' ');

      const nodeCapture = createCaptureStream();
      const nodeResult = await sandbox.runCommand({
        cmd: 'node',
        args: ['-e', extractScript],
        stdout: nodeCapture.stream,
        stderr: nodeCapture.stream,
      });

      const summaryJson = nodeCapture.getOutput();
      if (nodeResult.exitCode !== 0 || !summaryJson.trim()) {
        throw new Error(`Failed to extract summary: ${summaryJson.slice(0, 300)}`);
      }

      const summary = JSON.parse(summaryJson.trim()) as {
        coverage: number;
        exportCount: number;
        typeCount: number;
        undocumented: string[];
        drift: ScanResult['drift'];
        driftCount: number;
      };

      const result: ScanResult = {
        owner: options.owner,
        repo: options.repo,
        ref: options.ref,
        packageName: options.package,
        coverage: summary.coverage,
        exportCount: summary.exportCount,
        typeCount: summary.typeCount,
        driftCount: summary.driftCount,
        undocumented: summary.undocumented,
        drift: summary.drift,
      };

      sendEvent({ type: 'complete', result });
    } finally {
      await sandbox.stop();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendEvent({ type: 'error', message });
  }
}
