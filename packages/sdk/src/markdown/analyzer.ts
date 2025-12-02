/**
 * Docs impact analyzer
 *
 * Analyzes markdown files against spec changes to find impacted documentation
 */

import type { SpecDiff } from '@openpkg-ts/spec';
import { findExportReferences } from './parser';
import type {
  DocsChangeType,
  DocsImpact,
  DocsImpactResult,
  ExportReference,
  MarkdownDocFile,
} from './types';

/**
 * Map spec diff categories to change types
 */
function getChangeType(
  exportName: string,
  diff: SpecDiff,
): DocsChangeType | null {
  if (diff.breaking.includes(exportName)) {
    return 'signature-changed';
  }
  // Check if it's in breaking but was removed (not just changed)
  // For now, treat all breaking as signature-changed
  // In future, we could check old vs new spec to distinguish
  return null;
}

/**
 * Analyze docs impact from a spec diff
 *
 * @param diff - The spec diff result
 * @param markdownFiles - Parsed markdown files
 * @param newExportNames - All export names in the new spec (for missing docs detection)
 */
export function analyzeDocsImpact(
  diff: SpecDiff,
  markdownFiles: MarkdownDocFile[],
  newExportNames: string[] = [],
): DocsImpactResult {
  // Collect all changed export names
  const changedExports = [
    ...diff.breaking,
    // Note: nonBreaking are new exports, not changes to existing
  ];

  // Find all references to changed exports
  const references = findExportReferences(markdownFiles, changedExports);

  // Group references by file
  const impactByFile = new Map<string, DocsImpact>();

  for (const ref of references) {
    const changeType = getChangeType(ref.exportName, diff);
    if (!changeType) continue;

    let impact = impactByFile.get(ref.file);
    if (!impact) {
      impact = { file: ref.file, references: [] };
      impactByFile.set(ref.file, impact);
    }

    impact.references.push({
      exportName: ref.exportName,
      line: ref.line,
      changeType,
      context: ref.context,
    });
  }

  // Find new exports without documentation
  const documentedExports = new Set<string>();
  for (const file of markdownFiles) {
    for (const block of file.codeBlocks) {
      // Simple check: if export name appears in code, consider it documented
      for (const exportName of newExportNames) {
        if (block.code.includes(exportName)) {
          documentedExports.add(exportName);
        }
      }
    }
  }

  const missingDocs = diff.nonBreaking.filter(
    (name) => !documentedExports.has(name),
  );

  // Calculate stats
  const totalCodeBlocks = markdownFiles.reduce(
    (sum, f) => sum + f.codeBlocks.length,
    0,
  );
  const allReferences = findExportReferences(markdownFiles, [
    ...changedExports,
    ...diff.nonBreaking,
  ]);

  return {
    impactedFiles: Array.from(impactByFile.values()),
    missingDocs,
    stats: {
      filesScanned: markdownFiles.length,
      codeBlocksFound: totalCodeBlocks,
      referencesFound: allReferences.length,
      impactedReferences: references.length,
    },
  };
}

/**
 * Find references to deprecated exports
 */
export function findDeprecatedReferences(
  markdownFiles: MarkdownDocFile[],
  deprecatedExports: string[],
): ExportReference[] {
  return findExportReferences(markdownFiles, deprecatedExports);
}

/**
 * Find references to removed exports
 */
export function findRemovedReferences(
  markdownFiles: MarkdownDocFile[],
  removedExports: string[],
): ExportReference[] {
  return findExportReferences(markdownFiles, removedExports);
}

/**
 * Check if any docs reference a specific export
 */
export function hasDocsForExport(
  markdownFiles: MarkdownDocFile[],
  exportName: string,
): boolean {
  const refs = findExportReferences(markdownFiles, [exportName]);
  return refs.length > 0;
}

/**
 * Get all exports that have documentation
 */
export function getDocumentedExports(
  markdownFiles: MarkdownDocFile[],
  exportNames: string[],
): string[] {
  const documented: string[] = [];
  for (const name of exportNames) {
    if (hasDocsForExport(markdownFiles, name)) {
      documented.push(name);
    }
  }
  return documented;
}

/**
 * Get all exports that lack documentation
 */
export function getUndocumentedExports(
  markdownFiles: MarkdownDocFile[],
  exportNames: string[],
): string[] {
  const documented = new Set(getDocumentedExports(markdownFiles, exportNames));
  return exportNames.filter((name) => !documented.has(name));
}

