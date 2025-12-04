/**
 * Shared utilities for project detection.
 */

import type { FileSystem } from './types';

/**
 * Safely parse a JSON file, returning null on any error.
 */
export async function safeParseJson<T = Record<string, unknown>>(
  fs: FileSystem,
  path: string,
): Promise<T | null> {
  try {
    if (!(await fs.exists(path))) return null;
    const content = await fs.readFile(path);
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Standard package.json structure for detection purposes.
 */
export interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  main?: string;
  module?: string;
  types?: string;
  typings?: string;
  exports?: PackageExports;
  workspaces?: string[] | { packages: string[] };
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Package.json exports field structure.
 */
export type PackageExports =
  | string
  | {
      '.'?: string | { types?: string; import?: string; require?: string; default?: string };
      [key: string]: unknown;
    };

/**
 * Read and parse package.json from a directory.
 */
export async function readPackageJson(fs: FileSystem, dir: string): Promise<PackageJson | null> {
  const path = dir === '.' ? 'package.json' : `${dir}/package.json`;
  return safeParseJson<PackageJson>(fs, path);
}
