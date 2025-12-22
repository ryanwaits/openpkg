/**
 * CODEOWNERS file parsing and ownership attribution.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { minimatch } from 'minimatch';
import type { EnrichedExport, EnrichedOpenPkg } from '../analysis/enrich';

/**
 * A single CODEOWNERS rule.
 */
export interface CodeOwnerRule {
  /** Line number in the CODEOWNERS file (1-indexed) */
  line: number;
  /** The glob pattern for matching files */
  pattern: string;
  /** List of owners (e.g., @user, @org/team, email) */
  owners: string[];
}

/**
 * Parsed CODEOWNERS file.
 */
export interface CodeOwnersFile {
  /** Path to the CODEOWNERS file */
  filePath: string;
  /** All parsed rules (in order, later rules take precedence) */
  rules: CodeOwnerRule[];
}

/**
 * Coverage stats for a single owner.
 */
export interface OwnerCoverageStats {
  /** The owner identifier */
  owner: string;
  /** Total exports owned */
  totalExports: number;
  /** Documented exports (has description) */
  documentedExports: number;
  /** Coverage percentage */
  coverageScore: number;
  /** Exports with drift issues */
  exportsWithDrift: number;
  /** Drift percentage */
  driftScore: number;
  /** Exports missing @example */
  missingExamples: number;
  /** List of undocumented export names */
  undocumentedExports: string[];
}

/**
 * Result of ownership analysis.
 */
export interface OwnershipAnalysisResult {
  /** Path to the CODEOWNERS file used */
  codeownersPath: string;
  /** Stats per owner */
  byOwner: Map<string, OwnerCoverageStats>;
  /** Exports with no matching owner */
  unowned: EnrichedExport[];
  /** Total exports analyzed */
  totalExports: number;
}

/**
 * Standard locations for CODEOWNERS files.
 */
const CODEOWNERS_LOCATIONS = [
  'CODEOWNERS',
  '.github/CODEOWNERS',
  'docs/CODEOWNERS',
] as const;

/**
 * Parse a CODEOWNERS file content into rules.
 */
export function parseCodeOwners(content: string): CodeOwnerRule[] {
  const rules: CodeOwnerRule[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    // Split into pattern and owners
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;

    const pattern = parts[0];
    const owners = parts.slice(1).filter((o) => o.startsWith('@') || o.includes('@'));

    if (owners.length > 0) {
      rules.push({
        line: i + 1,
        pattern,
        owners,
      });
    }
  }

  return rules;
}

/**
 * Find and load CODEOWNERS file from a directory.
 */
export function loadCodeOwners(baseDir: string): CodeOwnersFile | null {
  for (const location of CODEOWNERS_LOCATIONS) {
    const filePath = path.join(baseDir, location);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        filePath,
        rules: parseCodeOwners(content),
      };
    }
  }
  return null;
}

/**
 * Find owners for a file path based on CODEOWNERS rules.
 * Returns the owners from the last matching rule (CODEOWNERS precedence).
 */
export function findOwners(filePath: string, rules: CodeOwnerRule[]): string[] {
  // Normalize path
  const normalizedPath = filePath.replace(/^\.\//, '');

  // Find all matching rules, return the last one (highest precedence)
  let matchingOwners: string[] = [];

  for (const rule of rules) {
    // Convert CODEOWNERS pattern to minimatch pattern
    let pattern = rule.pattern;

    // Handle directory patterns (ending with /)
    if (pattern.endsWith('/')) {
      pattern = pattern + '**';
    }

    // Handle patterns starting with /
    if (pattern.startsWith('/')) {
      pattern = pattern.slice(1);
    } else if (!pattern.startsWith('*')) {
      // Patterns without / prefix match anywhere
      pattern = '**/' + pattern;
    }

    if (minimatch(normalizedPath, pattern, { matchBase: true, dot: true })) {
      matchingOwners = rule.owners;
    }
  }

  return matchingOwners;
}

/**
 * Attribute owners to exports based on their source file paths.
 */
export function attributeOwners(
  exports: EnrichedExport[],
  rules: CodeOwnerRule[],
  baseDir: string,
): Map<EnrichedExport, string[]> {
  const ownershipMap = new Map<EnrichedExport, string[]>();

  for (const exp of exports) {
    const filePath = exp.source?.file;
    if (!filePath) {
      ownershipMap.set(exp, []);
      continue;
    }

    // Convert to relative path if absolute
    let relativePath = filePath;
    if (path.isAbsolute(filePath)) {
      relativePath = path.relative(baseDir, filePath);
    }

    const owners = findOwners(relativePath, rules);
    ownershipMap.set(exp, owners);
  }

  return ownershipMap;
}

/**
 * Analyze ownership and coverage breakdown by owner.
 */
export function analyzeOwnership(
  spec: EnrichedOpenPkg,
  codeowners: CodeOwnersFile,
  baseDir: string,
): OwnershipAnalysisResult {
  const exports = spec.exports ?? [];
  const ownershipMap = attributeOwners(exports, codeowners.rules, baseDir);

  // Group exports by owner
  const byOwnerExports = new Map<string, EnrichedExport[]>();
  const unowned: EnrichedExport[] = [];

  for (const [exp, owners] of ownershipMap) {
    if (owners.length === 0) {
      unowned.push(exp);
    } else {
      // Attribute to all owners
      for (const owner of owners) {
        const existing = byOwnerExports.get(owner) ?? [];
        existing.push(exp);
        byOwnerExports.set(owner, existing);
      }
    }
  }

  // Calculate stats per owner
  const byOwner = new Map<string, OwnerCoverageStats>();

  for (const [owner, ownerExports] of byOwnerExports) {
    const documented = ownerExports.filter((e) => e.description);
    const withDrift = ownerExports.filter(
      (e) => e.docs?.drift && e.docs.drift.length > 0,
    );
    const withExamples = ownerExports.filter(
      (e) => e.examples && e.examples.length > 0,
    );
    const undocumented = ownerExports.filter((e) => !e.description);

    const coverageScore =
      ownerExports.length === 0
        ? 100
        : Math.round((documented.length / ownerExports.length) * 100);

    const driftScore =
      ownerExports.length === 0
        ? 0
        : Math.round((withDrift.length / ownerExports.length) * 100);

    byOwner.set(owner, {
      owner,
      totalExports: ownerExports.length,
      documentedExports: documented.length,
      coverageScore,
      exportsWithDrift: withDrift.length,
      driftScore,
      missingExamples: ownerExports.length - withExamples.length,
      undocumentedExports: undocumented.map((e) => e.name),
    });
  }

  return {
    codeownersPath: codeowners.filePath,
    byOwner,
    unowned,
    totalExports: exports.length,
  };
}

/**
 * Options for ownership analysis.
 */
export interface AnalyzeOwnershipOptions {
  /** Base directory for the project */
  baseDir: string;
}

/**
 * Load CODEOWNERS and analyze ownership for a spec.
 * Returns null if no CODEOWNERS file is found.
 */
export function analyzeSpecOwnership(
  spec: EnrichedOpenPkg,
  options: AnalyzeOwnershipOptions,
): OwnershipAnalysisResult | null {
  const codeowners = loadCodeOwners(options.baseDir);
  if (!codeowners) return null;

  return analyzeOwnership(spec, codeowners, options.baseDir);
}
