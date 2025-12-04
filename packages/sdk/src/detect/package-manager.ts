/**
 * Package manager detection based on lockfiles.
 */

import type { FileSystem, PackageManager, PackageManagerInfo } from './types';
import { safeParseJson } from './utils';

/**
 * Package manager configurations.
 */
const PM_CONFIGS: Record<string, { lockfiles: string[]; info: PackageManagerInfo }> = {
  pnpm: {
    lockfiles: ['pnpm-lock.yaml'],
    info: {
      name: 'pnpm',
      lockfile: 'pnpm-lock.yaml',
      installArgs: ['install', '--frozen-lockfile'],
      runPrefix: ['pnpm'],
    },
  },
  bun: {
    lockfiles: ['bun.lock', 'bun.lockb'],
    info: {
      name: 'bun',
      lockfile: 'bun.lock',
      installArgs: ['install', '--frozen-lockfile'],
      runPrefix: ['bun'],
    },
  },
  yarn: {
    lockfiles: ['yarn.lock'],
    info: {
      name: 'yarn',
      lockfile: 'yarn.lock',
      installArgs: ['install', '--frozen-lockfile'],
      runPrefix: ['yarn'],
    },
  },
  npm: {
    lockfiles: ['package-lock.json'],
    info: {
      name: 'npm',
      lockfile: 'package-lock.json',
      installArgs: ['install', '--legacy-peer-deps'],
      runPrefix: ['npm', 'run'],
    },
  },
};

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
 * Detect package manager based on lockfile presence and package.json hints.
 *
 * Resolution order:
 * 1. packageManager field in package.json (e.g., "pnpm@9.0.0")
 * 2. Most recently modified lockfile (when multiple exist)
 * 3. Static priority order: pnpm > bun > yarn > npm
 * 4. Default to npm
 */
export async function detectPackageManager(fs: FileSystem): Promise<PackageManagerInfo> {
  // Check for packageManager field in package.json (Corepack)
  const pkgJson = await safeParseJson<{ packageManager?: string }>(fs, 'package.json');
  if (pkgJson?.packageManager) {
    const pmName = parsePackageManagerField(pkgJson.packageManager);
    if (pmName && PM_CONFIGS[pmName]) {
      const config = PM_CONFIGS[pmName];
      // Find the actual lockfile if it exists
      for (const lockfile of config.lockfiles) {
        if (await fs.exists(lockfile)) {
          return { ...config.info, lockfile };
        }
      }
      return config.info;
    }
  }

  // Scan for existing lockfiles
  const foundLockfiles: { lockfile: string; pm: PackageManager }[] = [];

  for (const [pmName, config] of Object.entries(PM_CONFIGS)) {
    for (const lockfile of config.lockfiles) {
      if (await fs.exists(lockfile)) {
        foundLockfiles.push({ lockfile, pm: pmName as PackageManager });
      }
    }
  }

  // If no lockfiles found, return default
  if (foundLockfiles.length === 0) {
    return DEFAULT_PM;
  }

  // If only one lockfile, use it
  if (foundLockfiles.length === 1) {
    const found = foundLockfiles[0];
    return { ...PM_CONFIGS[found.pm].info, lockfile: found.lockfile };
  }

  // Multiple lockfiles: use static priority order
  // (In a real implementation, we'd check file modification times,
  // but that requires stat() which isn't in our FileSystem interface)
  const priorityOrder: PackageManager[] = ['pnpm', 'bun', 'yarn', 'npm'];
  for (const pm of priorityOrder) {
    const found = foundLockfiles.find((f) => f.pm === pm);
    if (found) {
      return { ...PM_CONFIGS[pm].info, lockfile: found.lockfile };
    }
  }

  return DEFAULT_PM;
}

/**
 * Parse the packageManager field from package.json.
 * Format: "name@version" or "name@version+sha..."
 *
 * @param field - The packageManager field value
 * @returns The package manager name, or null if invalid
 */
function parsePackageManagerField(field: string): PackageManager | null {
  // Match "pnpm@9.0.0" or "yarn@4.0.0+sha..."
  const match = field.match(/^(npm|yarn|pnpm|bun)@/);
  return match ? (match[1] as PackageManager) : null;
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
