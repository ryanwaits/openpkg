/**
 * Extended spec diff with docs impact analysis
 *
 * Wraps the base diffSpec() and adds markdown impact detection
 */

import {
  categorizeBreakingChanges,
  diffSpec,
  type CategorizedBreaking,
  type OpenPkg,
  type SpecDiff,
} from '@openpkg-ts/spec';
import { analyzeDocsImpact } from './analyzer';
import { diffMemberChanges, type MemberChange } from './member-diff';
import type { DocsImpactResult, MarkdownDocFile } from './types';

/**
 * Extended spec diff result with docs impact
 */
export interface SpecDiffWithDocs extends SpecDiff {
  /** Docs impact analysis (only present if markdown files provided) */
  docsImpact?: DocsImpactResult;
  /** Member-level changes for classes (methods added/removed/changed) */
  memberChanges?: MemberChange[];
  /** Breaking changes categorized by severity (high/medium/low) */
  categorizedBreaking?: CategorizedBreaking[];
}

/**
 * Options for diffSpecWithDocs
 */
export interface DiffWithDocsOptions {
  /** Parsed markdown documentation files */
  markdownFiles?: MarkdownDocFile[];
}

/**
 * Compute spec diff with optional docs impact analysis
 *
 * @param oldSpec - Previous version of the spec
 * @param newSpec - Current version of the spec
 * @param options - Options including markdown files to analyze
 * @returns Extended diff result with docs impact
 *
 * @example
 * ```ts
 * import { diffSpecWithDocs, parseMarkdownFiles } from '@doccov/sdk';
 *
 * const markdownFiles = parseMarkdownFiles([
 *   { path: 'docs/guide.md', content: '...' },
 * ]);
 *
 * const diff = diffSpecWithDocs(oldSpec, newSpec, { markdownFiles });
 *
 * if (diff.docsImpact?.impactedFiles.length) {
 *   console.log('Docs need updating!');
 * }
 * ```
 */
export function diffSpecWithDocs(
  oldSpec: OpenPkg,
  newSpec: OpenPkg,
  options: DiffWithDocsOptions = {},
): SpecDiffWithDocs {
  // Get base diff
  const baseDiff = diffSpec(oldSpec, newSpec);

  // Get member-level changes for classes marked as breaking
  const memberChanges = diffMemberChanges(oldSpec, newSpec, baseDiff.breaking);

  // Categorize breaking changes by severity
  const categorizedBreaking = categorizeBreakingChanges(
    baseDiff.breaking,
    oldSpec,
    newSpec,
    memberChanges,
  );

  // If no markdown files, return base diff with member changes
  if (!options.markdownFiles?.length) {
    return {
      ...baseDiff,
      memberChanges: memberChanges.length > 0 ? memberChanges : undefined,
      categorizedBreaking: categorizedBreaking.length > 0 ? categorizedBreaking : undefined,
    };
  }

  // Get all export names from new spec for missing docs detection
  const newExportNames = newSpec.exports?.map((e) => e.name) ?? [];

  // Analyze docs impact with member-level granularity
  const docsImpact = analyzeDocsImpact(
    baseDiff,
    options.markdownFiles,
    newExportNames,
    memberChanges,
  );

  return {
    ...baseDiff,
    docsImpact,
    memberChanges: memberChanges.length > 0 ? memberChanges : undefined,
    categorizedBreaking: categorizedBreaking.length > 0 ? categorizedBreaking : undefined,
  };
}

/**
 * Check if a diff has any docs impact
 */
export function hasDocsImpact(diff: SpecDiffWithDocs): boolean {
  if (!diff.docsImpact) return false;
  return diff.docsImpact.impactedFiles.length > 0 || diff.docsImpact.missingDocs.length > 0;
}

/**
 * Get summary of docs impact for display
 */
export function getDocsImpactSummary(diff: SpecDiffWithDocs): {
  impactedFileCount: number;
  impactedReferenceCount: number;
  missingDocsCount: number;
  totalIssues: number;
  memberChangesCount: number;
} {
  if (!diff.docsImpact) {
    return {
      impactedFileCount: 0,
      impactedReferenceCount: 0,
      missingDocsCount: 0,
      totalIssues: 0,
      memberChangesCount: diff.memberChanges?.length ?? 0,
    };
  }

  const impactedFileCount = diff.docsImpact.impactedFiles.length;
  const impactedReferenceCount = diff.docsImpact.impactedFiles.reduce(
    (sum, f) => sum + f.references.length,
    0,
  );
  const missingDocsCount = diff.docsImpact.missingDocs.length;

  return {
    impactedFileCount,
    impactedReferenceCount,
    missingDocsCount,
    totalIssues: impactedReferenceCount + missingDocsCount,
    memberChangesCount: diff.memberChanges?.length ?? 0,
  };
}
