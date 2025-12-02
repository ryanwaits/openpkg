/**
 * Package manager detection based on lockfiles.
 */

import type { FileSystem, PackageManager, PackageManagerInfo } from './types';

/**
 * Package manager configurations in priority order.
 * First matching lockfile wins.
 */
const PM_CONFIGS: Array<{ lockfile: string; info: PackageManagerInfo }> = [
  {
    lockfile: 'pnpm-lock.yaml',
    info: {
      name: 'pnpm',
      lockfile: 'pnpm-lock.yaml',
      installArgs: ['install', '--frozen-lockfile'],
      runPrefix: ['pnpm'],
    },
  },
  {
    lockfile: 'bun.lock',
    info: {
      name: 'bun',
      lockfile: 'bun.lock',
      installArgs: ['install', '--frozen-lockfile'],
      runPrefix: ['bun'],
    },
  },
  {
    lockfile: 'bun.lockb',
    info: {
      name: 'bun',
      lockfile: 'bun.lockb',
      installArgs: ['install', '--frozen-lockfile'],
      runPrefix: ['bun'],
    },
  },
  {
    lockfile: 'yarn.lock',
    info: {
      name: 'yarn',
      lockfile: 'yarn.lock',
      installArgs: ['install', '--frozen-lockfile'],
      runPrefix: ['yarn'],
    },
  },
  {
    lockfile: 'package-lock.json',
    info: {
      name: 'npm',
      lockfile: 'package-lock.json',
      installArgs: ['install', '--legacy-peer-deps'],
      runPrefix: ['npm', 'run'],
    },
  },
];

/**
 * Default package manager when no lockfile is found.
 */
const DEFAULT_PM: PackageManagerInfo = {
  name: 'npm',
  lockfile: null,
  installArgs: ['install', '--legacy-peer-deps'],
  runPrefix: ['npm', 'run'],
};

/**
 * Detect package manager based on lockfile presence.
 *
 * Priority order:
 * 1. pnpm-lock.yaml
 * 2. bun.lock / bun.lockb
 * 3. yarn.lock
 * 4. package-lock.json
 * 5. Default to npm
 */
export async function detectPackageManager(fs: FileSystem): Promise<PackageManagerInfo> {
  for (const { lockfile, info } of PM_CONFIGS) {
    if (await fs.exists(lockfile)) {
      return info;
    }
  }
  return DEFAULT_PM;
}

/**
 * Get install command for a package manager.
 * Returns [command, ...args] array.
 */
export function getInstallCommand(pm: PackageManagerInfo): string[] {
  return [pm.name, ...pm.installArgs];
}

/**
 * Get run command for a package manager script.
 * Returns [command, ...args, scriptName] array.
 */
export function getRunCommand(pm: PackageManagerInfo, script: string): string[] {
  return [...pm.runPrefix, script];
}
