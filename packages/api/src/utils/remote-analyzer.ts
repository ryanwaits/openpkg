/**
 * Remote repository analyzer - runs DocCov analysis on GitHub repos via webhooks.
 * Uses shallow clone to temp dir for full TypeScript resolution.
 */

import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocCov, enrichSpec, type OpenPkgSpec } from '@doccov/sdk';
import { getTokenByInstallationId } from './github-app';

/**
 * Result from remote analysis.
 */
export interface RemoteAnalysisResult {
  coveragePercent: number;
  documentedCount: number;
  totalCount: number;
  driftCount: number;
  qualityErrors: number;
  qualityWarnings: number;
  /** Full spec for detailed reports */
  spec?: OpenPkgSpec;
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
  const tmpDir = join(tmpdir(), `doccov-${owner}-${repo}-${Date.now()}`);

  // Use authenticated HTTPS URL for private repos
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
      // Looks like a SHA
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
      // Convert .js to .ts if applicable
      const main = packageJson.main.replace(/^\.\//, '');
      const tsMain = main.replace(/\.js$/, '.ts');
      const tsxMain = main.replace(/\.js$/, '.tsx');

      // Check if TS version exists
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
 * Analyze a remote GitHub repository.
 *
 * @param installationId - GitHub App installation ID
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param ref - Git ref (branch, tag, or SHA)
 * @param includeSpec - Whether to include full spec in result
 * @returns Analysis result or null if failed
 */
export async function analyzeRemoteRepo(
  installationId: string,
  owner: string,
  repo: string,
  ref: string,
  includeSpec = false,
): Promise<RemoteAnalysisResult | null> {
  // Get installation token
  const token = await getTokenByInstallationId(installationId);
  if (!token) {
    console.error(`No token for installation ${installationId}`);
    return null;
  }

  let tmpDir: string | null = null;

  try {
    // Clone repo to temp dir
    tmpDir = await cloneRepo(owner, repo, ref, token);

    // Detect entry point
    const entryPoint = await detectEntryPoint(tmpDir);
    if (!entryPoint) {
      console.error(`No entry point found for ${owner}/${repo}`);
      return null;
    }

    const entryPath = join(tmpDir, entryPoint);

    // Run analysis
    const doccov = new DocCov({
      resolveExternalTypes: false, // Skip for speed
      useCache: false, // No caching for webhook analysis
    });

    const result = await doccov.analyzeFileWithDiagnostics(entryPath);

    // Enrich with coverage metrics
    const enriched = enrichSpec(result.spec);

    // Extract metrics
    const docs = enriched.docs;
    const coveragePercent = docs?.coverageScore ?? 0;
    const documentedCount = docs?.documented ?? 0;
    const totalCount = docs?.total ?? 0;
    const driftCount = docs?.drift?.length ?? 0;

    // Count quality issues
    let qualityErrors = 0;
    let qualityWarnings = 0;

    if (docs?.quality) {
      for (const item of docs.quality) {
        if (item.severity === 'error') qualityErrors++;
        else if (item.severity === 'warning') qualityWarnings++;
      }
    }

    return {
      coveragePercent,
      documentedCount,
      totalCount,
      driftCount,
      qualityErrors,
      qualityWarnings,
      spec: includeSpec ? enriched : undefined,
    };
  } catch (err) {
    console.error(`Analysis failed for ${owner}/${repo}@${ref}:`, err);
    return null;
  } finally {
    // Cleanup temp dir
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
 * Compute diff between two analysis results.
 */
export function computeAnalysisDiff(
  base: RemoteAnalysisResult,
  head: RemoteAnalysisResult,
): {
  coverageDelta: number;
  documentedDelta: number;
  totalDelta: number;
  driftDelta: number;
} {
  return {
    coverageDelta: Number((head.coveragePercent - base.coveragePercent).toFixed(1)),
    documentedDelta: head.documentedCount - base.documentedCount,
    totalDelta: head.totalCount - base.totalCount,
    driftDelta: head.driftCount - base.driftCount,
  };
}
