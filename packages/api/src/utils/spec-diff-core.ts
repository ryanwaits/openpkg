/**
 * Core spec diff logic shared between routes.
 * Provides full CLI-parity diff with breaking changes, member changes, etc.
 */

import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DocCov,
  diffSpecWithDocs,
  enrichSpec,
  type MarkdownDocFile,
  parseMarkdownFiles,
  type SpecDiffWithDocs,
} from '@doccov/sdk';
import type { OpenPkg } from '@openpkg-ts/spec';
import { getTokenByInstallationId } from './github-app';
import { getCachedDiff, getCachedSpec, setCachedDiff, setCachedSpec } from './spec-cache';

/**
 * Source for fetching a spec
 */
export interface SpecSource {
  owner: string;
  repo: string;
  ref: string;
  installationId: string;
}

/**
 * Options for diff computation
 */
export interface DiffOptions {
  /** Include docs impact analysis */
  includeDocsImpact?: boolean;
  /** Markdown file patterns to fetch */
  markdownPatterns?: string[];
  /** Direct markdown files (for upload mode) */
  markdownFiles?: MarkdownDocFile[];
}

/**
 * Result from diff computation
 */
export interface DiffResult {
  diff: SpecDiffWithDocs;
  base: { ref: string; sha: string };
  head: { ref: string; sha: string };
  generatedAt: string;
  cached: boolean;
}

/**
 * Shallow clone a GitHub repo to a temp directory.
 */
async function cloneRepo(
  owner: string,
  repo: string,
  ref: string,
  authToken: string,
): Promise<string> {
  const tmpDir = join(tmpdir(), `doccov-diff-${owner}-${repo}-${Date.now()}`);

  const cloneUrl = `https://x-access-token:${authToken}@github.com/${owner}/${repo}.git`;

  const proc = Bun.spawn(['git', 'clone', '--depth', '1', '--branch', ref, cloneUrl, tmpDir], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();

    // Try fetching specific SHA if branch clone fails
    if (ref.length === 40) {
      const shallowProc = Bun.spawn(['git', 'clone', '--depth', '1', cloneUrl, tmpDir], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      await shallowProc.exited;

      const fetchProc = Bun.spawn(['git', '-C', tmpDir, 'fetch', 'origin', ref], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      await fetchProc.exited;

      const checkoutProc = Bun.spawn(['git', '-C', tmpDir, 'checkout', ref], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const checkoutExit = await checkoutProc.exited;

      if (checkoutExit !== 0) {
        throw new Error(`Failed to checkout ${ref}: ${stderr}`);
      }
    } else {
      throw new Error(`Failed to clone ${owner}/${repo}@${ref}: ${stderr}`);
    }
  }

  return tmpDir;
}

/**
 * Detect the entry point for a package.
 */
async function detectEntryPoint(repoDir: string): Promise<string | null> {
  try {
    const packageJsonPath = join(repoDir, 'package.json');
    const packageJson = await Bun.file(packageJsonPath).json();

    // Check exports first (modern packages)
    if (packageJson.exports) {
      const mainExport = packageJson.exports['.'];
      if (typeof mainExport === 'string') {
        return mainExport.replace(/^\.\//, '');
      }
      if (mainExport?.import) {
        const importPath =
          typeof mainExport.import === 'string' ? mainExport.import : mainExport.import.default;
        if (importPath) return importPath.replace(/^\.\//, '');
      }
      if (mainExport?.types) {
        return mainExport.types.replace(/^\.\//, '');
      }
    }

    // Check types field
    if (packageJson.types) {
      return packageJson.types.replace(/^\.\//, '');
    }

    // Check main field
    if (packageJson.main) {
      const main = packageJson.main.replace(/^\.\//, '');
      const tsMain = main.replace(/\.js$/, '.ts');
      const tsxMain = main.replace(/\.js$/, '.tsx');

      const tsFile = Bun.file(join(repoDir, tsMain));
      if (await tsFile.exists()) return tsMain;

      const tsxFile = Bun.file(join(repoDir, tsxMain));
      if (await tsxFile.exists()) return tsxMain;

      return main;
    }

    // Common fallbacks
    const fallbacks = ['src/index.ts', 'src/index.tsx', 'index.ts', 'lib/index.ts'];
    for (const fallback of fallbacks) {
      const file = Bun.file(join(repoDir, fallback));
      if (await file.exists()) return fallback;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve a git ref to a SHA
 */
async function resolveRefToSha(
  owner: string,
  repo: string,
  ref: string,
  authToken: string,
): Promise<string> {
  // If already looks like a SHA, return as-is
  if (/^[a-f0-9]{40}$/i.test(ref)) {
    return ref;
  }

  // Resolve via GitHub API
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${ref}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'DocCov',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to resolve ref ${ref}: ${res.status}`);
  }

  const data = (await res.json()) as { sha: string };
  return data.sha;
}

/**
 * Try to fetch existing openpkg.json from repo
 */
async function fetchExistingSpec(
  owner: string,
  repo: string,
  ref: string,
  authToken: string,
): Promise<OpenPkg | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/openpkg.json`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'User-Agent': 'DocCov',
      },
    });

    if (res.ok) {
      return (await res.json()) as OpenPkg;
    }
  } catch {
    // Not found or error - will generate
  }

  return null;
}

/**
 * Generate spec by cloning repo and running DocCov
 */
async function generateSpec(
  owner: string,
  repo: string,
  ref: string,
  authToken: string,
): Promise<OpenPkg> {
  let tmpDir: string | null = null;

  try {
    tmpDir = await cloneRepo(owner, repo, ref, authToken);

    const entryPoint = await detectEntryPoint(tmpDir);
    if (!entryPoint) {
      throw new Error(`No entry point found for ${owner}/${repo}`);
    }

    const entryPath = join(tmpDir, entryPoint);

    const doccov = new DocCov({
      resolveExternalTypes: false,
      useCache: false,
    });

    const result = await doccov.analyzeFileWithDiagnostics(entryPath);
    return result.spec;
  } finally {
    if (tmpDir) {
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Get spec for a ref (checks cache -> existing openpkg.json -> generates)
 */
export async function getSpecForRef(source: SpecSource): Promise<{ spec: OpenPkg; sha: string }> {
  const { owner, repo, ref, installationId } = source;

  const token = await getTokenByInstallationId(installationId);
  if (!token) {
    throw new Error(`No token for installation ${installationId}`);
  }

  // Resolve ref to SHA for caching
  const sha = await resolveRefToSha(owner, repo, ref, token);

  // Check cache first
  const cached = getCachedSpec(owner, repo, sha);
  if (cached) {
    return { spec: cached, sha };
  }

  // Try existing openpkg.json
  let spec = await fetchExistingSpec(owner, repo, sha, token);

  // Generate if not found
  if (!spec) {
    spec = await generateSpec(owner, repo, sha, token);
  }

  // Enrich and cache
  const enriched = enrichSpec(spec) as OpenPkg;
  setCachedSpec(owner, repo, sha, enriched);

  return { spec: enriched, sha };
}

/**
 * Compute full diff between two refs with CLI parity
 */
export async function computeFullDiff(
  base: SpecSource,
  head: SpecSource,
  options: DiffOptions = {},
): Promise<DiffResult> {
  // Get both specs in parallel
  const [baseResult, headResult] = await Promise.all([getSpecForRef(base), getSpecForRef(head)]);

  // Check diff cache
  const cachedDiff = getCachedDiff(baseResult.sha, headResult.sha);
  if (cachedDiff) {
    return {
      diff: cachedDiff,
      base: { ref: base.ref, sha: baseResult.sha },
      head: { ref: head.ref, sha: headResult.sha },
      generatedAt: new Date().toISOString(),
      cached: true,
    };
  }

  // Compute diff
  const diff = diffSpecWithDocs(baseResult.spec, headResult.spec, {
    markdownFiles: options.markdownFiles,
  });

  // Cache result
  setCachedDiff(baseResult.sha, headResult.sha, diff);

  return {
    diff,
    base: { ref: base.ref, sha: baseResult.sha },
    head: { ref: head.ref, sha: headResult.sha },
    generatedAt: new Date().toISOString(),
    cached: false,
  };
}

/**
 * Direct diff from uploaded specs (no GitHub access needed)
 */
export function diffSpecs(
  baseSpec: OpenPkg,
  headSpec: OpenPkg,
  markdownFiles?: Array<{ path: string; content: string }>,
): SpecDiffWithDocs {
  // Parse markdown files if provided
  const parsedMarkdown = markdownFiles ? parseMarkdownFiles(markdownFiles) : undefined;

  return diffSpecWithDocs(baseSpec, headSpec, {
    markdownFiles: parsedMarkdown,
  });
}

/**
 * Format diff result for API response
 */
export function formatDiffResponse(result: DiffResult): {
  breaking: string[];
  nonBreaking: string[];
  docsOnly: string[];
  coverageDelta: number;
  oldCoverage: number;
  newCoverage: number;
  driftIntroduced: number;
  driftResolved: number;
  newUndocumented: string[];
  improvedExports: string[];
  regressedExports: string[];
  memberChanges?: unknown[];
  categorizedBreaking?: unknown[];
  docsImpact?: unknown;
  base: { ref: string; sha: string };
  head: { ref: string; sha: string };
  generatedAt: string;
  cached: boolean;
} {
  const { diff } = result;

  return {
    // Core diff fields
    breaking: diff.breaking,
    nonBreaking: diff.nonBreaking,
    docsOnly: diff.docsOnly,
    coverageDelta: diff.coverageDelta,
    oldCoverage: diff.oldCoverage,
    newCoverage: diff.newCoverage,
    driftIntroduced: diff.driftIntroduced,
    driftResolved: diff.driftResolved,
    newUndocumented: diff.newUndocumented,
    improvedExports: diff.improvedExports,
    regressedExports: diff.regressedExports,

    // Extended fields
    memberChanges: diff.memberChanges,
    categorizedBreaking: diff.categorizedBreaking,
    docsImpact: diff.docsImpact,

    // Metadata
    base: result.base,
    head: result.head,
    generatedAt: result.generatedAt,
    cached: result.cached,
  };
}
