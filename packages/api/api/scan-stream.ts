import { Writable } from 'node:stream';
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

interface ScanResult {
  owner: string;
  repo: string;
  ref: string;
  packageName?: string;
  coverage: number;
  exportCount: number;
  typeCount: number;
  driftCount: number;
  undocumented: string[];
  drift: Array<{
    export: string;
    type: string;
    issue: string;
  }>;
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

// Helper to get install args for each package manager
function getPmInstallArgs(pm: 'pnpm' | 'bun' | 'yarn' | 'npm'): string[] {
  switch (pm) {
    case 'pnpm':
      return ['install', '--frozen-lockfile'];
    case 'bun':
      return ['install', '--frozen-lockfile'];
    case 'yarn':
      return ['install', '--frozen-lockfile'];
    case 'npm':
      return ['install', '--ignore-scripts', '--legacy-peer-deps'];
  }
}

// Helper to get workspace patterns from package.json, pnpm-workspace.yaml, or lerna.json
function getWorkspacePatterns(
  pkgJson: { workspaces?: string[] | { packages: string[] } },
  pnpmWorkspaceContent?: string,
  lernaContent?: string,
): string[] {
  // Check package.json workspaces (npm/yarn)
  if (pkgJson.workspaces) {
    return Array.isArray(pkgJson.workspaces)
      ? pkgJson.workspaces
      : pkgJson.workspaces.packages || [];
  }

  // Check pnpm-workspace.yaml
  if (pnpmWorkspaceContent) {
    // Match all lines that start with "- " after packages:
    const lines = pnpmWorkspaceContent.split('\n');
    const patterns: string[] = [];
    let inPackages = false;

    for (const line of lines) {
      if (line.match(/^packages:/i)) {
        inPackages = true;
        continue;
      }
      if (inPackages) {
        // Stop if we hit another top-level key
        if (line.match(/^\w+:/) && !line.startsWith(' ') && !line.startsWith('\t')) {
          break;
        }
        // Extract pattern from "- pattern" format
        const match = line.match(/^\s*-\s*['"]?([^'"]+)['"]?\s*$/);
        if (match) {
          patterns.push(match[1].trim());
        }
      }
    }

    if (patterns.length > 0) {
      return patterns;
    }
  }

  // Check lerna.json
  if (lernaContent) {
    try {
      const lerna = JSON.parse(lernaContent) as { packages?: string[] };
      if (lerna.packages && Array.isArray(lerna.packages)) {
        return lerna.packages;
      }
    } catch {
      // Ignore parse errors
    }
  }

  return [];
}

// Helper to list available packages in a monorepo
async function listMonorepoPackages(
  sandbox: Sandbox,
  workspacePatterns: string[],
  rootPackageName?: string,
  rootIsPrivate?: boolean,
): Promise<string[]> {
  const packages: string[] = [];

  // Include root package if it's a real publishable package (not private, not named "root")
  if (rootPackageName && !rootIsPrivate && rootPackageName !== 'root') {
    packages.push(rootPackageName);
  }

  // Collect unique directories to scan
  const dirsToScan = new Set<string>();
  for (const pattern of workspacePatterns) {
    // Skip negation patterns
    if (pattern.startsWith('!')) continue;
    const dir = pattern.replace('/**', '').replace('/*', '');
    if (dir && !dir.includes('*')) {
      dirsToScan.add(dir);
    }
  }

  // Always scan packages/ as fallback (most common monorepo structure)
  dirsToScan.add('packages');

  for (const dir of dirsToScan) {
    // List subdirectories in the workspace directory
    const lsCapture = createCaptureStream();
    await sandbox.runCommand({
      cmd: 'ls',
      args: ['-1', dir],
      stdout: lsCapture.stream,
      stderr: lsCapture.stream,
    });

    const output = lsCapture.getOutput();
    // Skip if directory doesn't exist
    if (output.includes('No such file') || output.includes('cannot access')) {
      continue;
    }

    const subdirs = output.split('\n').filter((d) => d.trim().length > 0);

    // Read package.json from each subdirectory to get package name
    for (const subdir of subdirs) {
      const pkgPath = `${dir}/${subdir}/package.json`;
      const catCapture = createCaptureStream();
      await sandbox.runCommand({
        cmd: 'cat',
        args: [pkgPath],
        stdout: catCapture.stream,
        stderr: catCapture.stream,
      });

      try {
        const pkgContent = catCapture.getOutput();
        if (pkgContent && !pkgContent.includes('No such file')) {
          const pkg = JSON.parse(pkgContent) as { name?: string; private?: boolean };
          // Include package if it has a name and is not private
          if (pkg.name && !pkg.private) {
            packages.push(pkg.name);
          }
        }
      } catch {
        // Skip packages with invalid package.json
      }
    }
  }

  // Remove duplicates and sort
  return [...new Set(packages)].sort();
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
            args: ['fetch', '--depth', '1', 'origin', `refs/tags/${options.ref}:refs/tags/${options.ref}`],
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

      // Detect package manager from lockfiles
      const lsCapture = createCaptureStream();
      await sandbox.runCommand({
        cmd: 'ls',
        args: ['-1'],
        stdout: lsCapture.stream,
      });
      const files = lsCapture.getOutput();

      let pm: 'pnpm' | 'bun' | 'yarn' | 'npm' = 'npm';
      let pmMessage = 'No lockfile detected';

      if (files.includes('pnpm-lock.yaml')) {
        pm = 'pnpm';
        pmMessage = 'Detected pnpm project';
      } else if (files.includes('bun.lock') || files.includes('bun.lockb')) {
        pm = 'bun';
        pmMessage = 'Detected bun project';
      } else if (files.includes('yarn.lock')) {
        pm = 'yarn';
        pmMessage = 'Detected yarn project';
      } else if (files.includes('package-lock.json')) {
        pm = 'npm';
        pmMessage = 'Detected npm project';
      }

      sendEvent({ type: 'progress', stage: 'detecting', message: pmMessage, progress: 15 });

      // Early monorepo detection - fail fast if monorepo without package param
      if (!options.package) {
        // Read package.json to check for workspaces and entry point
        const rootPkgCapture = createCaptureStream();
        await sandbox.runCommand({
          cmd: 'cat',
          args: ['package.json'],
          stdout: rootPkgCapture.stream,
          stderr: rootPkgCapture.stream,
        });

        let rootPkgJson: {
          name?: string;
          private?: boolean;
          workspaces?: string[] | { packages: string[] };
          types?: string;
          typings?: string;
          main?: string;
        } = {};
        try {
          rootPkgJson = JSON.parse(rootPkgCapture.getOutput());
        } catch {
          // Ignore parse errors
        }

        // Check for pnpm-workspace.yaml
        let pnpmWorkspaceContent: string | undefined;
        if (files.includes('pnpm-workspace.yaml')) {
          const pnpmCapture = createCaptureStream();
          await sandbox.runCommand({
            cmd: 'cat',
            args: ['pnpm-workspace.yaml'],
            stdout: pnpmCapture.stream,
          });
          pnpmWorkspaceContent = pnpmCapture.getOutput();
        }

        // Check for lerna.json
        let lernaContent: string | undefined;
        if (files.includes('lerna.json')) {
          const lernaCapture = createCaptureStream();
          await sandbox.runCommand({
            cmd: 'cat',
            args: ['lerna.json'],
            stdout: lernaCapture.stream,
          });
          lernaContent = lernaCapture.getOutput();
        }

        const workspacePatterns = getWorkspacePatterns(rootPkgJson, pnpmWorkspaceContent, lernaContent);
        const hasWorkspaces = workspacePatterns.length > 0;

        // If it's a monorepo (has workspaces), require package param
        // Even if root has types, monorepos usually need explicit package targeting
        if (hasWorkspaces) {
          sendEvent({
            type: 'progress',
            stage: 'detecting',
            message: 'Monorepo detected, listing packages...',
            progress: 17,
          });

          const availablePackages = await listMonorepoPackages(
            sandbox,
            workspacePatterns,
            rootPkgJson.name,
            rootPkgJson.private,
          );

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
      if (pm === 'bun') {
        sendEvent({
          type: 'progress',
          stage: 'installing',
          message: 'Installing bun...',
          progress: 18,
        });
        await sandbox.runCommand({ cmd: 'npm', args: ['install', '-g', 'bun'] });
      } else if (pm === 'yarn') {
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
      const installCapture = createCaptureStream();

      // Try primary package manager
      const primaryArgs = getPmInstallArgs(pm);
      const primaryResult = await sandbox.runCommand({
        cmd: pm,
        args: primaryArgs,
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
          if (pm !== 'bun') {
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
            pm = 'bun'; // Update pm for build step
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

      // Check for build script
      const pkgCapture = createCaptureStream();
      await sandbox.runCommand({
        cmd: 'cat',
        args: ['package.json'],
        stdout: pkgCapture.stream,
      });

      try {
        const pkgJson = JSON.parse(pkgCapture.getOutput()) as { scripts?: Record<string, string> };
        const scripts = pkgJson.scripts ?? {};
        const buildScript = scripts.build ? 'build' : scripts.compile ? 'compile' : null;

        if (buildScript) {
          sendEvent({
            type: 'progress',
            stage: 'building',
            message: 'Running build...',
            progress: 45,
          });

          const buildCapture = createCaptureStream();
          const buildCmd = pm === 'npm' || pm === 'yarn' ? pm : pm;
          const buildArgs = pm === 'npm' || pm === 'yarn' ? ['run', buildScript] : [buildScript];
          const buildResult = await sandbox.runCommand({
            cmd: buildCmd,
            args: buildArgs,
            stdout: buildCapture.stream,
            stderr: buildCapture.stream,
          });

          const buildMessage =
            buildResult.exitCode === 0 ? 'Build complete' : 'Build failed (continuing)';
          sendEvent({ type: 'progress', stage: 'building', message: buildMessage, progress: 55 });
        }
      } catch {
        // Ignore package.json errors
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
