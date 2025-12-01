/**
 * Entry point detection for TypeScript projects
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface EntryPointResult {
  entryPath: string;
  source: 'types' | 'exports' | 'main' | 'module' | 'fallback';
}

/**
 * Detect the TypeScript entry point for a project.
 *
 * Priority order:
 * 1. package.json -> types or typings field
 * 2. package.json -> exports["."].types
 * 3. package.json -> main field (resolve to .ts)
 * 4. package.json -> module field (resolve to .ts)
 * 5. Common paths fallback
 *
 * @param repoDir - Root directory of the repository
 * @returns Entry point path relative to repoDir
 */
export function detectEntryPoint(repoDir: string): EntryPointResult {
  const pkgPath = path.join(repoDir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    throw new Error('No package.json found - not a valid npm package');
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    throw new Error('Failed to parse package.json');
  }

  // 1. Check types/typings field first (most explicit)
  if (typeof pkg.types === 'string') {
    const resolved = resolveToTs(repoDir, pkg.types);
    if (resolved) {
      return { entryPath: resolved, source: 'types' };
    }
  }

  if (typeof pkg.typings === 'string') {
    const resolved = resolveToTs(repoDir, pkg.typings);
    if (resolved) {
      return { entryPath: resolved, source: 'types' };
    }
  }

  // 2. Check exports map
  const exports = pkg.exports as Record<string, unknown> | undefined;
  if (exports) {
    const mainExport = exports['.'];
    if (typeof mainExport === 'object' && mainExport !== null) {
      const exportObj = mainExport as Record<string, unknown>;
      if (typeof exportObj.types === 'string') {
        const resolved = resolveToTs(repoDir, exportObj.types);
        if (resolved) {
          return { entryPath: resolved, source: 'exports' };
        }
      }
    }
  }

  // 3. Check main field
  if (typeof pkg.main === 'string') {
    const resolved = resolveToTs(repoDir, pkg.main);
    if (resolved) {
      return { entryPath: resolved, source: 'main' };
    }
  }

  // 4. Check module field
  if (typeof pkg.module === 'string') {
    const resolved = resolveToTs(repoDir, pkg.module);
    if (resolved) {
      return { entryPath: resolved, source: 'module' };
    }
  }

  // 5. Common paths fallback
  const commonPaths = [
    'src/index.ts',
    'src/index.tsx',
    'src/main.ts',
    'index.ts',
    'lib/index.ts',
    'source/index.ts',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(path.join(repoDir, p))) {
      return { entryPath: p, source: 'fallback' };
    }
  }

  throw new Error(
    'Could not detect TypeScript entry point. No types field in package.json and no common entry paths found.',
  );
}

/**
 * Resolve a file path to its TypeScript source equivalent.
 * Converts dist/index.js -> src/index.ts, etc.
 *
 * @param baseDir - Base directory
 * @param filePath - Original file path
 * @returns Resolved TypeScript path, or undefined if not found
 */
function resolveToTs(baseDir: string, filePath: string): string | undefined {
  // Normalize path
  const normalized = filePath.replace(/^\.\//, '');

  // Try original path first (might already be .ts, but NOT .d.ts declaration files)
  const isSourceTs = (normalized.endsWith('.ts') && !normalized.endsWith('.d.ts')) || normalized.endsWith('.tsx');
  if (isSourceTs) {
    if (fs.existsSync(path.join(baseDir, normalized))) {
      return normalized;
    }
  }

  // Generate candidate paths
  const candidates: string[] = [];

  // dist/ -> src/ conversion
  if (normalized.startsWith('dist/')) {
    const srcPath = normalized.replace(/^dist\//, 'src/');
    candidates.push(srcPath.replace(/\.js$/, '.ts'));
    candidates.push(srcPath.replace(/\.d\.ts$/, '.ts'));
    candidates.push(srcPath.replace(/\.js$/, '.tsx'));
  }

  // build/ -> src/ conversion
  if (normalized.startsWith('build/')) {
    const srcPath = normalized.replace(/^build\//, 'src/');
    candidates.push(srcPath.replace(/\.js$/, '.ts'));
    candidates.push(srcPath.replace(/\.d\.ts$/, '.ts'));
  }

  // lib/ -> src/ conversion
  if (normalized.startsWith('lib/')) {
    const srcPath = normalized.replace(/^lib\//, 'src/');
    candidates.push(srcPath.replace(/\.js$/, '.ts'));
    candidates.push(srcPath.replace(/\.d\.ts$/, '.ts'));
  }

  // Direct .js -> .ts conversion
  candidates.push(normalized.replace(/\.js$/, '.ts'));
  candidates.push(normalized.replace(/\.d\.ts$/, '.ts'));
  candidates.push(normalized.replace(/\.js$/, '.tsx'));

  // For .d.ts in root, try src/index.ts
  if (normalized.endsWith('.d.ts')) {
    const baseName = path.basename(normalized, '.d.ts');
    candidates.push(`src/${baseName}.ts`);
  }

  // Check each candidate (skip .d.ts files - we want source, not declarations)
  for (const candidate of candidates) {
    if (candidate.endsWith('.d.ts')) continue;
    if (fs.existsSync(path.join(baseDir, candidate))) {
      return candidate;
    }
  }

  return undefined;
}
