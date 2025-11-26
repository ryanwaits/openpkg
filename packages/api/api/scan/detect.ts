import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Sandbox } from '@vercel/sandbox';
import { Writable } from 'stream';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60, // Quick detection, 1 minute max
};

interface DetectRequestBody {
  url: string;
  ref?: string;
}

interface PackageInfo {
  name: string;
  path: string;
  description?: string;
}

interface DetectResponse {
  isMonorepo: boolean;
  packageManager: 'npm' | 'pnpm' | 'bun' | 'yarn';
  packages?: PackageInfo[];
  defaultPackage?: string;
  error?: string;
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as DetectRequestBody;

  if (!body.url) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    const result = await detectMonorepo(body.url, body.ref ?? 'main');
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      isMonorepo: false,
      packageManager: 'npm',
      error: message,
    } as DetectResponse);
  }
}

async function detectMonorepo(url: string, ref: string): Promise<DetectResponse> {
  const sandbox = await Sandbox.create({
    source: {
      url,
      type: 'git',
    },
    resources: { vcpus: 2 },
    timeout: 60 * 1000, // 1 minute
    runtime: 'node22',
  });

  try {
    // List root files
    const lsCapture = createCaptureStream();
    await sandbox.runCommand({
      cmd: 'ls',
      args: ['-1'],
      stdout: lsCapture.stream,
    });
    const files = lsCapture.getOutput();

    // Detect package manager
    let packageManager: DetectResponse['packageManager'] = 'npm';
    if (files.includes('pnpm-lock.yaml')) {
      packageManager = 'pnpm';
    } else if (files.includes('bun.lock') || files.includes('bun.lockb')) {
      packageManager = 'bun';
    } else if (files.includes('yarn.lock')) {
      packageManager = 'yarn';
    }

    // Read root package.json
    const pkgCapture = createCaptureStream();
    await sandbox.runCommand({
      cmd: 'cat',
      args: ['package.json'],
      stdout: pkgCapture.stream,
    });

    let rootPkg: { workspaces?: string[] | { packages?: string[] }; name?: string } = {};
    try {
      rootPkg = JSON.parse(pkgCapture.getOutput());
    } catch {
      // Not a valid package.json
    }

    // Check for workspaces (npm/yarn/bun) or pnpm-workspace.yaml
    let workspacePatterns: string[] = [];

    if (rootPkg.workspaces) {
      if (Array.isArray(rootPkg.workspaces)) {
        workspacePatterns = rootPkg.workspaces;
      } else if (rootPkg.workspaces.packages) {
        workspacePatterns = rootPkg.workspaces.packages;
      }
    }

    // Check pnpm-workspace.yaml
    if (files.includes('pnpm-workspace.yaml')) {
      const wsCapture = createCaptureStream();
      await sandbox.runCommand({
        cmd: 'cat',
        args: ['pnpm-workspace.yaml'],
        stdout: wsCapture.stream,
      });
      const wsContent = wsCapture.getOutput();
      // Simple YAML parsing for packages array
      const packagesMatch = wsContent.match(/packages:\s*\n((?:\s+-\s*.+\n?)+)/);
      if (packagesMatch) {
        const lines = packagesMatch[1].split('\n');
        for (const line of lines) {
          const match = line.match(/^\s+-\s*['"]?([^'"]+)['"]?\s*$/);
          if (match) {
            workspacePatterns.push(match[1]);
          }
        }
      }
    }

    // Not a monorepo
    if (workspacePatterns.length === 0) {
      return {
        isMonorepo: false,
        packageManager,
      };
    }

    // Find all packages
    const packages: PackageInfo[] = [];

    // Use find to locate package.json files in workspace dirs
    const findCapture = createCaptureStream();
    await sandbox.runCommand({
      cmd: 'find',
      args: ['.', '-name', 'package.json', '-maxdepth', '3', '-type', 'f'],
      stdout: findCapture.stream,
    });

    const packagePaths = findCapture
      .getOutput()
      .trim()
      .split('\n')
      .filter((p) => p && p !== './package.json');

    for (const pkgPath of packagePaths.slice(0, 30)) {
      // Limit to 30 packages
      const catCapture = createCaptureStream();
      await sandbox.runCommand({
        cmd: 'cat',
        args: [pkgPath],
        stdout: catCapture.stream,
      });

      try {
        const pkg = JSON.parse(catCapture.getOutput()) as {
          name?: string;
          description?: string;
          private?: boolean;
        };
        if (pkg.name && !pkg.private) {
          packages.push({
            name: pkg.name,
            path: pkgPath.replace('./package.json', '.').replace('/package.json', ''),
            description: pkg.description,
          });
        }
      } catch {
        // Skip invalid package.json
      }
    }

    // Sort by name
    packages.sort((a, b) => a.name.localeCompare(b.name));

    return {
      isMonorepo: true,
      packageManager,
      packages,
      defaultPackage: packages[0]?.name,
    };
  } finally {
    await sandbox.stop();
  }
}
