/**
 * Git blame-based contributor analysis for documentation attribution.
 */

import { execSync } from 'node:child_process';
import * as path from 'node:path';
import type { EnrichedExport, EnrichedOpenPkg } from '../analysis/enrich';

/**
 * Git blame info for a single line.
 */
export interface BlameInfo {
  /** Commit hash */
  commit: string;
  /** Author name */
  author: string;
  /** Author email */
  email: string;
  /** Line number (1-indexed) */
  line: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Stats for a single contributor.
 */
export interface ContributorStats {
  /** Contributor name */
  name: string;
  /** Contributor email */
  email: string;
  /** Number of exports this contributor documented */
  documentedExports: number;
  /** Names of exports documented by this contributor */
  exports: string[];
  /** Number of JSDoc lines authored */
  linesAuthored: number;
  /** Most recent documentation contribution */
  lastContribution: Date | null;
}

/**
 * Result of contributor analysis.
 */
export interface ContributorAnalysisResult {
  /** Stats per contributor */
  byContributor: Map<string, ContributorStats>;
  /** Total documented exports analyzed */
  totalDocumented: number;
  /** Exports that couldn't be attributed (no git history) */
  unattributed: string[];
}

/**
 * Parse git blame output with porcelain format.
 */
function parseBlameOutput(output: string): BlameInfo[] {
  const results: BlameInfo[] = [];
  const lines = output.split('\n');

  let currentCommit = '';
  let currentAuthor = '';
  let currentEmail = '';
  let currentTime = 0;
  let lineNumber = 0;

  for (const line of lines) {
    if (line.match(/^[0-9a-f]{40}/)) {
      // New commit line: <sha> <orig-line> <final-line> [<count>]
      const parts = line.split(' ');
      currentCommit = parts[0];
      lineNumber = parseInt(parts[2], 10);
    } else if (line.startsWith('author ')) {
      currentAuthor = line.slice(7);
    } else if (line.startsWith('author-mail ')) {
      currentEmail = line.slice(12).replace(/[<>]/g, '');
    } else if (line.startsWith('author-time ')) {
      currentTime = parseInt(line.slice(12), 10);
    } else if (line.startsWith('\t')) {
      // Content line - record the blame info
      results.push({
        commit: currentCommit,
        author: currentAuthor,
        email: currentEmail,
        line: lineNumber,
        timestamp: currentTime,
      });
    }
  }

  return results;
}

/**
 * Get git blame for a file.
 */
export function getFileBlame(
  filePath: string,
  cwd: string,
): BlameInfo[] | null {
  try {
    const relativePath = path.isAbsolute(filePath)
      ? path.relative(cwd, filePath)
      : filePath;

    const output = execSync(
      `git blame --porcelain "${relativePath}"`,
      {
        cwd,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    return parseBlameOutput(output);
  } catch {
    return null;
  }
}

/**
 * Get blame info for specific line range.
 */
export function getBlameForLines(
  filePath: string,
  startLine: number,
  endLine: number,
  cwd: string,
): BlameInfo[] | null {
  try {
    const relativePath = path.isAbsolute(filePath)
      ? path.relative(cwd, filePath)
      : filePath;

    const output = execSync(
      `git blame --porcelain -L ${startLine},${endLine} "${relativePath}"`,
      {
        cwd,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    return parseBlameOutput(output);
  } catch {
    return null;
  }
}

/**
 * Find the primary author of a set of blame lines.
 * Returns the author who wrote the most lines.
 */
function findPrimaryAuthor(blameLines: BlameInfo[]): BlameInfo | null {
  if (blameLines.length === 0) return null;

  const authorCounts = new Map<string, { count: number; info: BlameInfo }>();

  for (const line of blameLines) {
    const key = line.email;
    const existing = authorCounts.get(key);
    if (existing) {
      existing.count++;
      // Keep the most recent contribution
      if (line.timestamp > existing.info.timestamp) {
        existing.info = line;
      }
    } else {
      authorCounts.set(key, { count: 1, info: line });
    }
  }

  let maxCount = 0;
  let primaryAuthor: BlameInfo | null = null;

  for (const { count, info } of authorCounts.values()) {
    if (count > maxCount) {
      maxCount = count;
      primaryAuthor = info;
    }
  }

  return primaryAuthor;
}

/**
 * Analyze contributors for documented exports.
 */
export function analyzeContributors(
  spec: EnrichedOpenPkg,
  baseDir: string,
): ContributorAnalysisResult {
  const exports = spec.exports ?? [];
  const byContributor = new Map<string, ContributorStats>();
  const unattributed: string[] = [];
  let totalDocumented = 0;

  // Cache file blame to avoid repeated git calls
  const fileBlameCache = new Map<string, BlameInfo[] | null>();

  for (const exp of exports) {
    // Only analyze documented exports
    if (!exp.description) continue;

    const filePath = exp.source?.file;
    const line = exp.source?.line;

    if (!filePath || !line) {
      unattributed.push(exp.name);
      continue;
    }

    // Get or fetch file blame
    let fileBlame = fileBlameCache.get(filePath);
    if (fileBlame === undefined) {
      fileBlame = getFileBlame(filePath, baseDir);
      fileBlameCache.set(filePath, fileBlame);
    }

    if (!fileBlame) {
      unattributed.push(exp.name);
      continue;
    }

    // Find JSDoc lines (typically above the export declaration)
    // Look at lines just before the declaration for the JSDoc comment
    const jsDocStartLine = Math.max(1, line - 20); // Look up to 20 lines before
    const declarationLine = line;

    // Get blame for the JSDoc region
    const jsDocBlame = fileBlame.filter(
      (b) => b.line >= jsDocStartLine && b.line < declarationLine,
    );

    // Find lines that are likely JSDoc (we can't easily detect /** here, so we use heuristics)
    // Just use all lines in the region and find primary author
    const primaryAuthor = findPrimaryAuthor(jsDocBlame);

    if (!primaryAuthor) {
      // Fall back to the declaration line author
      const declBlame = fileBlame.find((b) => b.line === declarationLine);
      if (declBlame) {
        attributeToContributor(byContributor, declBlame, exp.name, 1);
        totalDocumented++;
      } else {
        unattributed.push(exp.name);
      }
      continue;
    }

    const linesAuthored = jsDocBlame.filter(
      (b) => b.email === primaryAuthor.email,
    ).length;

    attributeToContributor(byContributor, primaryAuthor, exp.name, linesAuthored);
    totalDocumented++;
  }

  return {
    byContributor,
    totalDocumented,
    unattributed,
  };
}

/**
 * Add attribution to a contributor.
 */
function attributeToContributor(
  byContributor: Map<string, ContributorStats>,
  blame: BlameInfo,
  exportName: string,
  lines: number,
): void {
  const key = blame.email;
  const existing = byContributor.get(key);

  if (existing) {
    existing.documentedExports++;
    existing.exports.push(exportName);
    existing.linesAuthored += lines;
    const blameDate = new Date(blame.timestamp * 1000);
    if (!existing.lastContribution || blameDate > existing.lastContribution) {
      existing.lastContribution = blameDate;
    }
  } else {
    byContributor.set(key, {
      name: blame.author,
      email: blame.email,
      documentedExports: 1,
      exports: [exportName],
      linesAuthored: lines,
      lastContribution: new Date(blame.timestamp * 1000),
    });
  }
}

/**
 * Options for contributor analysis.
 */
export interface AnalyzeContributorsOptions {
  /** Base directory for the project (must be a git repo) */
  baseDir: string;
}

/**
 * Analyze spec contributors.
 * Returns null if not in a git repository.
 */
export function analyzeSpecContributors(
  spec: EnrichedOpenPkg,
  options: AnalyzeContributorsOptions,
): ContributorAnalysisResult | null {
  try {
    // Check if we're in a git repo
    execSync('git rev-parse --git-dir', {
      cwd: options.baseDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }

  return analyzeContributors(spec, options.baseDir);
}
