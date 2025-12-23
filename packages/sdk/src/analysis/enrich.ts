import type { OpenPkg, SpecDocDrift, SpecDocsMetadata, SpecExport } from '@openpkg-ts/spec';
import {
  buildExportRegistry,
  computeExportDrift,
  type DriftSummary,
  getDriftSummary,
} from './docs-coverage';

/**
 * An enriched export with computed documentation metadata.
 * Extends SpecExport with the `docs` field for coverage analysis.
 */
export type EnrichedExport = SpecExport & {
  docs?: EnrichedDocsMetadata;
};

/**
 * Extended docs metadata.
 */
export type EnrichedDocsMetadata = SpecDocsMetadata;

/**
 * An enriched OpenPkg spec with computed documentation metadata.
 * Extends OpenPkg with per-export and aggregate coverage data.
 */
export type EnrichedOpenPkg = Omit<OpenPkg, 'exports'> & {
  exports: EnrichedExport[];
  docs?: EnrichedDocsMetadata;
  /** Drift summary with category breakdown (if drift exists) */
  driftSummary?: DriftSummary;
};

/**
 * Collect all missing rule IDs across exports.
 */
function collectAllMissing(exports: EnrichedExport[]): string[] {
  const allMissing = new Set<string>();
  for (const exp of exports) {
    if (exp.docs?.missing) {
      for (const ruleId of exp.docs.missing) {
        allMissing.add(ruleId);
      }
    }
  }
  return Array.from(allMissing);
}

/**
 * Collect all drift issues across exports.
 */
function collectAllDrift(exports: EnrichedExport[]): SpecDocDrift[] {
  const allDrift: SpecDocDrift[] = [];
  for (const exp of exports) {
    if (exp.docs?.drift) {
      allDrift.push(...exp.docs.drift);
    }
  }
  return allDrift;
}

/**
 * Simple coverage calculation for an export.
 * Returns 0-100 based on presence of description.
 */
function computeExportCoverage(exp: SpecExport): { score: number; missing: string[] } {
  const missing: string[] = [];

  // Has description = 100%, no description = 0%
  if (!exp.description) {
    missing.push('has-description');
    return { score: 0, missing };
  }

  return { score: 100, missing: [] };
}

export interface EnrichOptions {
  /**
   * Per-export drift issues to include in enrichment.
   * Map from export ID to drift issues.
   */
  driftByExport?: Map<string, SpecDocDrift[]>;
}

/**
 * Enrich an OpenPkg spec with documentation coverage metadata.
 *
 * Computes coverage scores and detects drift issues.
 *
 * @param spec - The pure OpenPkg spec to enrich
 * @param options - Optional enrichment configuration
 * @returns An enriched spec with documentation metadata
 *
 * @example
 * ```ts
 * import { DocCov, enrichSpec } from '@doccov/sdk';
 *
 * const doccov = new DocCov();
 * const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts');
 *
 * const enriched = enrichSpec(spec);
 * console.log(enriched.docs?.coverageScore); // e.g., 85
 * ```
 */
export function enrichSpec(spec: OpenPkg, options: EnrichOptions = {}): EnrichedOpenPkg {
  const { driftByExport } = options;

  // Build registry for cross-reference validation
  const exportRegistry = buildExportRegistry(spec);

  let totalCoverage = 0;

  // Enrich each export with coverage and drift data
  const enrichedExports: EnrichedExport[] = spec.exports.map((exp) => {
    // Simple coverage calculation
    const coverage = computeExportCoverage(exp);

    // Compute drift
    const drift = computeExportDrift(exp, exportRegistry);
    const additionalDrift = driftByExport?.get(exp.id);
    const allDrift = additionalDrift ? [...drift, ...additionalDrift] : drift;

    totalCoverage += coverage.score;

    const docs: EnrichedDocsMetadata = {
      coverageScore: coverage.score,
    };

    if (coverage.missing.length > 0) {
      docs.missing = coverage.missing;
    }

    if (allDrift.length > 0) {
      docs.drift = allDrift;
    }

    return {
      ...exp,
      docs,
    };
  });

  // Compute aggregate metadata
  const count = enrichedExports.length;
  const allMissing = collectAllMissing(enrichedExports);
  const allDrift = collectAllDrift(enrichedExports);

  const docs: EnrichedDocsMetadata = {
    coverageScore: count === 0 ? 100 : Math.round(totalCoverage / count),
  };

  if (allMissing.length > 0) {
    docs.missing = allMissing;
  }

  if (allDrift.length > 0) {
    docs.drift = allDrift;
  }

  // Compute drift summary with category breakdown
  const driftSummary = allDrift.length > 0 ? getDriftSummary(allDrift) : undefined;

  return {
    ...spec,
    exports: enrichedExports,
    docs,
    driftSummary,
  };
}
