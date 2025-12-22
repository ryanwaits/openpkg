/**
 * GitHub utilities for URL parsing and spec fetching.
 * Single source of truth for GitHub-related operations.
 */

import type { OpenPkg } from '@openpkg-ts/spec';

/**
 * Parsed components of a GitHub URL.
 */
export interface ParsedGitHubUrl {
  /** Repository owner (user or org) */
  owner: string;
  /** Repository name */
  repo: string;
  /** Git ref (branch or tag) */
  ref: string;
}

/**
 * Parse a GitHub URL or shorthand into components.
 *
 * Supported formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo/tree/branch
 * - https://github.com/owner/repo/tree/v1.0.0
 * - github.com/owner/repo
 * - owner/repo (shorthand)
 * - git@github.com:owner/repo.git
 *
 * @param input - GitHub URL or shorthand
 * @param defaultRef - Default ref if not specified in URL (default: 'main')
 * @returns Parsed components
 * @throws Error if the URL format is invalid
 *
 * @example
 * ```typescript
 * import { parseGitHubUrl } from '@doccov/sdk';
 *
 * const parsed = parseGitHubUrl('https://github.com/vercel/next.js/tree/canary');
 * // { owner: 'vercel', repo: 'next.js', ref: 'canary' }
 *
 * const shorthand = parseGitHubUrl('vercel/next.js');
 * // { owner: 'vercel', repo: 'next.js', ref: 'main' }
 * ```
 */
export function parseGitHubUrl(input: string, defaultRef = 'main'): ParsedGitHubUrl {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error('GitHub URL cannot be empty');
  }

  // Remove protocol if present
  let normalized = trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^git@github\.com:/, '')
    .replace(/\.git$/, '');

  // Remove github.com prefix if present
  normalized = normalized.replace(/^github\.com\//, '');

  // Now we should have: owner/repo or owner/repo/tree/ref
  const parts = normalized.split('/').filter(Boolean);

  if (parts.length < 2) {
    throw new Error(
      `Invalid GitHub URL format: "${input}". Expected owner/repo or https://github.com/owner/repo`,
    );
  }

  const owner = parts[0];
  const repo = parts[1];

  // Check for /tree/ref or /blob/ref pattern
  let ref = defaultRef;
  if (parts.length >= 4 && (parts[2] === 'tree' || parts[2] === 'blob')) {
    ref = parts.slice(3).join('/'); // Handle refs with slashes like feature/branch
  }

  if (!owner || !repo) {
    throw new Error(`Could not parse owner/repo from: "${input}"`);
  }

  return { owner, repo, ref };
}

/**
 * Build a clone URL from parsed components.
 *
 * @param parsed - Parsed GitHub URL components
 * @returns HTTPS clone URL
 *
 * @example
 * ```typescript
 * const cloneUrl = buildCloneUrl({ owner: 'vercel', repo: 'next.js', ref: 'main' });
 * // 'https://github.com/vercel/next.js.git'
 * ```
 */
export function buildCloneUrl(parsed: ParsedGitHubUrl): string {
  return `https://github.com/${parsed.owner}/${parsed.repo}.git`;
}

/**
 * Build a display-friendly URL (without protocol or .git suffix).
 *
 * @param parsed - Parsed GitHub URL components
 * @returns Display URL like 'github.com/owner/repo'
 *
 * @example
 * ```typescript
 * const displayUrl = buildDisplayUrl({ owner: 'vercel', repo: 'next.js', ref: 'main' });
 * // 'github.com/vercel/next.js'
 * ```
 */
export function buildDisplayUrl(parsed: ParsedGitHubUrl): string {
  return `github.com/${parsed.owner}/${parsed.repo}`;
}

/**
 * Build a raw.githubusercontent.com URL for a file.
 *
 * @param parsed - Parsed GitHub URL components
 * @param filePath - Path to the file in the repo
 * @returns Raw content URL
 */
export function buildRawUrl(parsed: ParsedGitHubUrl, filePath: string): string {
  return `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.ref}/${filePath}`;
}

/**
 * Fetch an OpenPkg spec from a GitHub repository.
 *
 * Tries the specified ref first, then falls back to 'master' if not found.
 *
 * @param parsed - Parsed GitHub URL components
 * @returns The OpenPkg spec, or null if not found
 *
 * @example
 * ```typescript
 * import { parseGitHubUrl, fetchSpecFromGitHub } from '@doccov/sdk';
 *
 * const parsed = parseGitHubUrl('vercel/next.js');
 * const spec = await fetchSpecFromGitHub(parsed);
 * if (spec) {
 *   console.log(`Coverage: ${spec.docs?.coverageScore}%`);
 * }
 * ```
 */
export async function fetchSpecFromGitHub(parsed: ParsedGitHubUrl): Promise<OpenPkg | null> {
  const urls = [
    buildRawUrl(parsed, 'openpkg.json'),
    // Fallback to master if the ref doesn't have the file
    `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/master/openpkg.json`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return (await response.json()) as OpenPkg;
      }
    } catch {
      // Try next URL
    }
  }

  return null;
}

/**
 * Options for fetching a spec from GitHub.
 */
export interface FetchSpecOptions {
  /** Git ref (branch or tag). Default: 'main' */
  ref?: string;
  /** Path to openpkg.json (for monorepos). Default: 'openpkg.json' */
  path?: string;
}

/**
 * Fetch an OpenPkg spec from a GitHub repository by owner/repo/branch.
 *
 * Convenience function that creates ParsedGitHubUrl internally.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branchOrOptions - Branch name (default: 'main') or options object
 * @returns The OpenPkg spec, or null if not found
 */
export async function fetchSpec(
  owner: string,
  repo: string,
  branchOrOptions: string | FetchSpecOptions = 'main',
): Promise<OpenPkg | null> {
  const options =
    typeof branchOrOptions === 'string'
      ? { ref: branchOrOptions, path: 'openpkg.json' }
      : { ref: branchOrOptions.ref ?? 'main', path: branchOrOptions.path ?? 'openpkg.json' };

  const parsed: ParsedGitHubUrl = { owner, repo, ref: options.ref };
  return fetchSpecFromGitHubWithPath(parsed, options.path);
}

/**
 * Fetch an OpenPkg spec from a GitHub repository with custom path support.
 *
 * @param parsed - Parsed GitHub URL components
 * @param specPath - Path to the openpkg.json file (default: 'openpkg.json')
 * @returns The OpenPkg spec, or null if not found
 */
export async function fetchSpecFromGitHubWithPath(
  parsed: ParsedGitHubUrl,
  specPath = 'openpkg.json',
): Promise<OpenPkg | null> {
  const urls = [
    buildRawUrl(parsed, specPath),
    // Fallback to master if the ref doesn't have the file
    `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/master/${specPath}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return (await response.json()) as OpenPkg;
      }
    } catch {
      // Try next URL
    }
  }

  return null;
}
