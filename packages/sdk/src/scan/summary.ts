/**
 * Utilities for extracting summary statistics from OpenPkg specs.
 */

import type { EnrichedOpenPkg } from '../analysis/enrich';

/**
 * A documentation drift issue in a spec summary.
 */
export interface SummaryDriftIssue {
  /** Name of the export with drift */
  export: string;
  /** Type of drift (e.g., 'param-mismatch', 'return-type') */
  type: string;
  /** Human-readable description of the issue */
  issue: string;
  /** Optional suggestion for fixing the issue */
  suggestion?: string;
}

/**
 * Summary of a spec's documentation coverage.
 * Simpler than full ReportStats - focused on scan output.
 */
export interface SpecSummary {
  /** Overall coverage percentage */
  coverage: number;
  /** Number of exports */
  exportCount: number;
  /** Number of types */
  typeCount: number;
  /** Number of drift issues */
  driftCount: number;
  /** Names of undocumented or partially documented exports */
  undocumented: string[];
  /** Drift issues */
  drift: SummaryDriftIssue[];
}

/**
 * Extract a summary from an enriched OpenPkg spec.
 *
 * This consolidates the logic previously duplicated in:
 * - CLI scan.ts (drift collection)
 * - CLI reports/stats.ts (computeStats)
 * - API scan-stream.ts (inline extraction script)
 *
 * @param spec - The enriched OpenPkg spec to summarize (must be enriched via enrichSpec())
 * @returns Summary of documentation coverage
 *
 * @example
 * ```typescript
 * import { enrichSpec, extractSpecSummary } from '@doccov/sdk';
 *
 * const enriched = enrichSpec(spec);
 * const summary = extractSpecSummary(enriched);
 * console.log(`Coverage: ${summary.coverage}%`);
 * console.log(`Undocumented: ${summary.undocumented.length}`);
 * ```
 */
export function extractSpecSummary(spec: EnrichedOpenPkg): SpecSummary {
  const exports = spec.exports ?? [];
  const undocumented: string[] = [];
  const drift: SummaryDriftIssue[] = [];

  for (const exp of exports) {
    const docs = exp.docs;
    if (!docs) continue;

    // Track undocumented or partially documented exports
    const hasMissing = (docs.missing?.length ?? 0) > 0;
    const isPartial = (docs.coverageScore ?? 0) < 100;
    if (hasMissing || isPartial) {
      undocumented.push(exp.name);
    }

    // Collect drift issues
    for (const d of docs.drift ?? []) {
      drift.push({
        export: exp.name,
        type: d.type,
        issue: d.issue,
        suggestion: d.suggestion,
      });
    }
  }

  return {
    coverage: spec.docs?.coverageScore ?? 0,
    exportCount: exports.length,
    typeCount: spec.types?.length ?? 0,
    driftCount: drift.length,
    undocumented,
    drift,
  };
}
