/**
 * Monorepo detection and package listing utilities
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';

export interface MonorepoInfo {
  isMonorepo: boolean;
  packages: PackageInfo[];
  type: 'npm' | 'pnpm' | 'lerna' | 'none';
}

export interface PackageInfo {
  name: string;
  path: string;
  relativePath: string;
}

/**
 * Detect if a repository is a monorepo and list its packages.
 *
 * Detection triggers:
 * - package.json has workspaces field (npm/yarn)
 * - pnpm-workspace.yaml exists
 * - lerna.json exists
 *
 * @param repoDir - Root directory of the repository
 * @returns Monorepo information
 */
export async function detectMonorepo(repoDir: string): Promise<MonorepoInfo> {
  const pkgPath = path.join(repoDir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return { isMonorepo: false, packages: [], type: 'none' };
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    return { isMonorepo: false, packages: [], type: 'none' };
  }

  // Check npm/yarn workspaces
  if (pkg.workspaces) {
    const patterns = extractWorkspacePatterns(pkg.workspaces);
    const packages = await resolveWorkspacePackages(repoDir, patterns);
    return { isMonorepo: packages.length > 0, packages, type: 'npm' };
  }

  // Check pnpm workspaces
  const pnpmPath = path.join(repoDir, 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpmPath)) {
    const patterns = parsePnpmWorkspace(pnpmPath);
    const packages = await resolveWorkspacePackages(repoDir, patterns);
    return { isMonorepo: packages.length > 0, packages, type: 'pnpm' };
  }

  // Check lerna
  const lernaPath = path.join(repoDir, 'lerna.json');
  if (fs.existsSync(lernaPath)) {
    try {
      const lerna = JSON.parse(fs.readFileSync(lernaPath, 'utf-8'));
      const patterns = lerna.packages ?? ['packages/*'];
      const packages = await resolveWorkspacePackages(repoDir, patterns);
      return { isMonorepo: packages.length > 0, packages, type: 'lerna' };
    } catch {
      // Fall through
    }
  }

  return { isMonorepo: false, packages: [], type: 'none' };
}

/**
 * Extract workspace patterns from package.json workspaces field
 */
function extractWorkspacePatterns(workspaces: unknown): string[] {
  if (Array.isArray(workspaces)) {
    return workspaces.filter((w): w is string => typeof w === 'string');
  }

  if (typeof workspaces === 'object' && workspaces !== null) {
    const ws = workspaces as Record<string, unknown>;
    if (Array.isArray(ws.packages)) {
      return ws.packages.filter((w): w is string => typeof w === 'string');
    }
  }

  return [];
}

/**
 * Parse pnpm-workspace.yaml to extract package patterns
 */
function parsePnpmWorkspace(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Simple YAML parsing for packages array
    const match = content.match(/packages:\s*\n((?:\s+-\s+.+\n?)+)/);
    if (match) {
      const lines = match[1].split('\n');
      return lines
        .map((line) => line.replace(/^\s+-\s+['"]?/, '').replace(/['"]?\s*$/, ''))
        .filter(Boolean);
    }
  } catch {
    // Fall through
  }
  return ['packages/*'];
}

/**
 * Resolve workspace patterns to actual package directories
 */
async function resolveWorkspacePackages(
  repoDir: string,
  patterns: string[],
): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = [];

  for (const pattern of patterns) {
    // Normalize pattern - ensure it matches directories
    const normalizedPattern = pattern.endsWith('/')
      ? pattern.slice(0, -1)
      : pattern;

    try {
      const matches = await glob(normalizedPattern, {
        cwd: repoDir,
        absolute: false,
      });

      for (const match of matches) {
        const pkgJsonPath = path.join(repoDir, match, 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
          try {
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
            packages.push({
              name: pkgJson.name ?? path.basename(match),
              path: path.join(repoDir, match),
              relativePath: match,
            });
          } catch {
            // Skip invalid package.json
          }
        }
      }
    } catch {
      // Skip invalid glob patterns
    }
  }

  // Sort by name for consistent output
  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Find a specific package in a monorepo by name
 *
 * @param repoDir - Root directory
 * @param packageName - Package name to find
 * @returns Package info or undefined
 */
export async function findPackage(
  repoDir: string,
  packageName: string,
): Promise<PackageInfo | undefined> {
  const mono = await detectMonorepo(repoDir);
  if (!mono.isMonorepo) {
    return undefined;
  }

  return mono.packages.find(
    (pkg) => pkg.name === packageName || pkg.relativePath === packageName,
  );
}

/**
 * Format monorepo packages for error message display
 */
export function formatPackageList(packages: PackageInfo[], limit = 10): string {
  const lines = packages.slice(0, limit).map((pkg) => `  --package ${pkg.name}`);

  if (packages.length > limit) {
    lines.push(`  ... and ${packages.length - limit} more`);
  }

  return lines.join('\n');
}

