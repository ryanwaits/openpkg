/**
 * Detect endpoint - uses SDK detection via SandboxFileSystem.
 * Detects monorepo structure and package manager for a GitHub repository.
 */

import {
  detectPackageManager,
  SandboxFileSystem,
  detectMonorepo as sdkDetectMonorepo,
} from '@doccov/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Sandbox } from '@vercel/sandbox';

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
    const result = await detectRepoStructure(body.url);
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

/**
 * Detect repository structure using SDK utilities via SandboxFileSystem.
 */
async function detectRepoStructure(url: string): Promise<DetectResponse> {
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
    // Create SDK FileSystem abstraction for sandbox
    const fs = new SandboxFileSystem(sandbox);

    // Use SDK detection functions
    const [monoInfo, pmInfo] = await Promise.all([sdkDetectMonorepo(fs), detectPackageManager(fs)]);

    if (!monoInfo.isMonorepo) {
      return {
        isMonorepo: false,
        packageManager: pmInfo.name,
      };
    }

    // Map SDK package info to API response format
    const packages: PackageInfo[] = monoInfo.packages
      .filter((p) => !p.private)
      .map((p) => ({
        name: p.name,
        path: p.path,
        description: p.description,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      isMonorepo: true,
      packageManager: pmInfo.name,
      packages,
      defaultPackage: packages[0]?.name,
    };
  } finally {
    await sandbox.stop();
  }
}
