/**
 * Monorepo detection and workspace package listing.
 */

import type { FileSystem, MonorepoInfo, WorkspacePackage } from './types';
import { readPackageJson, safeParseJson } from './utils';

/**
 * Detect if a project is a monorepo and list its packages.
 *
 * Detection triggers (in order):
 * 1. package.json has workspaces field (npm/yarn)
 * 2. pnpm-workspace.yaml exists
 * 3. lerna.json exists
 */
export async function detectMonorepo(fs: FileSystem): Promise<MonorepoInfo> {
  const pkgJson = await readPackageJson(fs, '.');

  // npm/yarn workspaces
  if (pkgJson?.workspaces) {
    const patterns = extractWorkspacePatterns(pkgJson.workspaces);
    const packages = await resolveWorkspacePackages(fs, patterns, pkgJson.name, pkgJson.private);
    return {
      isMonorepo: packages.length > 0,
      type: 'npm-workspaces',
      patterns,
      packages,
    };
  }

  // pnpm-workspace.yaml
  if (await fs.exists('pnpm-workspace.yaml')) {
    const content = await fs.readFile('pnpm-workspace.yaml');
    const patterns = parsePnpmWorkspace(content);
    const packages = await resolveWorkspacePackages(fs, patterns, pkgJson?.name, pkgJson?.private);
    return {
      isMonorepo: packages.length > 0,
      type: 'pnpm-workspaces',
      patterns,
      packages,
    };
  }

  // lerna.json
  if (await fs.exists('lerna.json')) {
    const lerna = await safeParseJson<{ packages?: string[] }>(fs, 'lerna.json');
    const patterns = lerna?.packages ?? ['packages/*'];
    const packages = await resolveWorkspacePackages(fs, patterns, pkgJson?.name, pkgJson?.private);
    return {
      isMonorepo: packages.length > 0,
      type: 'lerna',
      patterns,
      packages,
    };
  }

  return { isMonorepo: false, type: 'none', patterns: [], packages: [] };
}

/**
 * Extract workspace patterns from package.json workspaces field.
 * Handles both array format and object format with packages key.
 */
function extractWorkspacePatterns(workspaces: string[] | { packages: string[] }): string[] {
  if (Array.isArray(workspaces)) {
    return workspaces.filter((w): w is string => typeof w === 'string');
  }
  if (typeof workspaces === 'object' && workspaces !== null) {
    if (Array.isArray(workspaces.packages)) {
      return workspaces.packages.filter((w): w is string => typeof w === 'string');
    }
  }
  return [];
}

/**
 * Parse pnpm-workspace.yaml to extract package patterns.
 *
 * Handles common YAML formats:
 * - packages:
 *     - "packages/*"
 *     - 'apps/*'
 *     - libs/*
 * - packages: ["packages/*", "apps/*"]
 * - packages: ['packages/*']
 */
function parsePnpmWorkspace(content: string): string[] {
  const patterns: string[] = [];

  // Try to find packages section
  const packagesMatch = content.match(/^packages:\s*(.*)$/m);
  if (!packagesMatch) {
    return ['packages/*'];
  }

  const inlineContent = packagesMatch[1]?.trim() ?? '';

  // Check for inline array format: packages: ["a", "b"] or packages: ['a', 'b']
  if (inlineContent.startsWith('[')) {
    const arrayMatch = inlineContent.match(/\[([^\]]*)\]/);
    if (arrayMatch) {
      const items = arrayMatch[1]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.replace(/^['"]|['"]$/g, ''));
      if (items.length > 0) {
        return items;
      }
    }
  }

  // Parse multi-line format with proper indentation tracking
  const lines = content.split('\n');
  let inPackages = false;
  let baseIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Check for packages: key
    if (/^packages:/i.test(trimmed)) {
      inPackages = true;
      baseIndent = -1; // Will be set by first list item
      continue;
    }

    if (inPackages) {
      // Check current line indentation
      const indentMatch = line.match(/^(\s*)/);
      const currentIndent = indentMatch?.[1]?.length ?? 0;

      // If we hit a top-level key (no indentation and ends with :), stop
      if (currentIndent === 0 && trimmed.endsWith(':') && !trimmed.startsWith('-')) {
        break;
      }

      // Set base indent from first list item
      if (baseIndent === -1 && trimmed.startsWith('-')) {
        baseIndent = currentIndent;
      }

      // Only process items at the expected indent level
      if (currentIndent >= baseIndent || trimmed.startsWith('-')) {
        // Extract pattern from "- pattern" format
        // Handles: - pattern, - "pattern", - 'pattern'
        const match = trimmed.match(/^-\s*(['"]?)([^'"#]+)\1\s*(?:#.*)?$/);
        if (match?.[2]) {
          const pattern = match[2].trim();
          if (pattern) {
            patterns.push(pattern);
          }
        }
      }
    }
  }

  return patterns.length > 0 ? patterns : ['packages/*'];
}

/**
 * Resolve workspace patterns to actual package directories.
 * Scans each pattern directory for subdirectories with package.json.
 */
async function resolveWorkspacePackages(
  fs: FileSystem,
  patterns: string[],
  rootPackageName?: string,
  rootIsPrivate?: boolean,
): Promise<WorkspacePackage[]> {
  const packages: WorkspacePackage[] = [];
  const seen = new Set<string>();

  // Include root package if it's a real publishable package
  if (rootPackageName && !rootIsPrivate && rootPackageName !== 'root') {
    packages.push({
      name: rootPackageName,
      path: '.',
      private: false,
    });
    seen.add(rootPackageName);
  }

  // Collect unique directories to scan
  const dirsToScan = new Set<string>();
  for (const pattern of patterns) {
    if (pattern.startsWith('!')) continue;

    // Convert glob pattern to directory: "packages/*" -> "packages"
    const dir = pattern.replace(/\/?\*\*?$/, '');
    if (dir && !dir.includes('*')) {
      dirsToScan.add(dir);
    }
  }

  // Always scan packages/ as fallback (most common monorepo structure)
  dirsToScan.add('packages');

  for (const dir of dirsToScan) {
    if (!(await fs.exists(dir))) continue;
    if (!(await fs.isDirectory(dir))) continue;

    const subdirs = await fs.readDir(dir);
    for (const subdir of subdirs) {
      const pkgPath = `${dir}/${subdir}`;
      const pkgJsonPath = `${pkgPath}/package.json`;

      if (!(await fs.exists(pkgJsonPath))) continue;

      try {
        const content = await fs.readFile(pkgJsonPath);
        const pkg = JSON.parse(content) as { name?: string; private?: boolean };

        if (pkg.name && !seen.has(pkg.name)) {
          seen.add(pkg.name);
          packages.push({
            name: pkg.name,
            path: pkgPath,
            private: pkg.private ?? false,
          });
        }
      } catch {
        // Skip packages with invalid/missing package.json
        // fs.readFile may throw for missing files, or JSON.parse may fail
      }
    }
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Find a package by name or path in a list of workspace packages.
 */
export function findPackageByName(
  packages: WorkspacePackage[],
  nameOrPath: string,
): WorkspacePackage | undefined {
  return packages.find((p) => p.name === nameOrPath || p.path === nameOrPath);
}

/**
 * Format package list for display in error messages.
 */
export function formatPackageList(packages: WorkspacePackage[], limit = 10): string {
  const publicPackages = packages.filter((p) => !p.private);
  const lines = publicPackages.slice(0, limit).map((pkg) => `  --package ${pkg.name}`);

  if (publicPackages.length > limit) {
    lines.push(`  ... and ${publicPackages.length - limit} more`);
  }

  return lines.join('\n');
}
