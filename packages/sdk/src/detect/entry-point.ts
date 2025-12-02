/**
 * Entry point detection for TypeScript projects.
 * Resolves dist/build paths to source .ts files when possible.
 */

import type { FileSystem, EntryPointInfo, EntryPointSource } from './types';
import { readPackageJson } from './utils';

/**
 * Detect the TypeScript entry point for a package.
 *
 * Priority order:
 * 1. package.json -> types or typings field
 * 2. package.json -> exports["."].types
 * 3. package.json -> main field (resolve to .ts)
 * 4. package.json -> module field (resolve to .ts)
 * 5. Common fallback paths
 *
 * @param fs - FileSystem implementation
 * @param packagePath - Path to package directory (default: ".")
 * @returns Entry point info
 * @throws Error if no entry point can be found
 */
export async function detectEntryPoint(
  fs: FileSystem,
  packagePath = '.',
): Promise<EntryPointInfo> {
  const pkgJson = await readPackageJson(fs, packagePath);

  if (!pkgJson) {
    throw new Error('No package.json found - not a valid npm package');
  }

  // 1. Check types/typings field (most explicit)
  const typesField = pkgJson.types || pkgJson.typings;
  if (typesField && typeof typesField === 'string') {
    const resolved = await resolveToSource(fs, packagePath, typesField);
    if (resolved) {
      return { ...resolved, source: 'types' };
    }
  }

  // 2. Check exports["."].types
  if (pkgJson.exports && typeof pkgJson.exports === 'object') {
    const dotExport = pkgJson.exports['.'];
    if (dotExport && typeof dotExport === 'object' && 'types' in dotExport) {
      const typesPath = (dotExport as { types?: string }).types;
      if (typesPath && typeof typesPath === 'string') {
        const resolved = await resolveToSource(fs, packagePath, typesPath);
        if (resolved) {
          return { ...resolved, source: 'exports' };
        }
      }
    }
  }

  // 3. Check main field
  if (pkgJson.main && typeof pkgJson.main === 'string') {
    const resolved = await resolveToSource(fs, packagePath, pkgJson.main);
    if (resolved) {
      return { ...resolved, source: 'main' };
    }
  }

  // 4. Check module field
  if (pkgJson.module && typeof pkgJson.module === 'string') {
    const resolved = await resolveToSource(fs, packagePath, pkgJson.module);
    if (resolved) {
      return { ...resolved, source: 'module' };
    }
  }

  // 5. Fallback to common paths
  const fallbacks = [
    'src/index.ts',
    'src/index.tsx',
    'src/main.ts',
    'index.ts',
    'lib/index.ts',
    'source/index.ts',
  ];

  for (const fallback of fallbacks) {
    const fullPath = packagePath === '.' ? fallback : `${packagePath}/${fallback}`;
    if (await fs.exists(fullPath)) {
      return { path: fullPath, source: 'fallback', isDeclarationOnly: false };
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
 * @param fs - FileSystem implementation
 * @param basePath - Base directory path
 * @param filePath - Original file path from package.json
 * @returns Resolved path info, or null if not found
 */
async function resolveToSource(
  fs: FileSystem,
  basePath: string,
  filePath: string,
): Promise<{ path: string; isDeclarationOnly: boolean } | null> {
  // Normalize path (remove leading ./)
  const normalized = filePath.replace(/^\.\//, '');

  // Helper to build full path
  const fullPath = (p: string) => (basePath === '.' ? p : `${basePath}/${p}`);

  // Already a .ts source file (not .d.ts)
  const isSourceTs =
    (normalized.endsWith('.ts') && !normalized.endsWith('.d.ts')) ||
    normalized.endsWith('.tsx');
  if (isSourceTs) {
    const path = fullPath(normalized);
    if (await fs.exists(path)) {
      return { path, isDeclarationOnly: false };
    }
  }

  // Generate candidate source paths
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
    const baseName = normalized.replace(/\.d\.ts$/, '').split('/').pop();
    if (baseName) {
      candidates.push(`src/${baseName}.ts`);
    }
  }

  // Check each candidate (skip .d.ts files - we want source, not declarations)
  for (const candidate of candidates) {
    if (candidate.endsWith('.d.ts')) continue;
    const path = fullPath(candidate);
    if (await fs.exists(path)) {
      return { path, isDeclarationOnly: false };
    }
  }

  // Fall back to .d.ts if that's all we have
  if (normalized.endsWith('.d.ts')) {
    const path = fullPath(normalized);
    if (await fs.exists(path)) {
      return { path, isDeclarationOnly: true };
    }
  }

  return null;
}
