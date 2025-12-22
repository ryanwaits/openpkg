import type { OpenPkg, SpecDocDrift, SpecDocsMetadata, SpecExport } from '@openpkg-ts/spec';
import { evaluateExportQuality } from '../quality/engine';
import type { QualityConfig, QualityViolation } from '../quality/types';
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
 * Extended docs metadata with quality violations.
 */
export type EnrichedDocsMetadata = SpecDocsMetadata & {
  violations?: QualityViolation[];
};

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
 * Collect all quality violations across exports.
 */
function collectAllViolations(exports: EnrichedExport[]): QualityViolation[] {
  const allViolations: QualityViolation[] = [];
  for (const exp of exports) {
    if (exp.docs?.violations) {
      allViolations.push(...exp.docs.violations);
    }
  }
  return allViolations;
}

export interface EnrichOptions {
  /**
   * Per-export drift issues to include in enrichment.
   * Map from export ID to drift issues.
   */
  driftByExport?: Map<string, SpecDocDrift[]>;

  /**
   * Quality configuration with rule severities.
   */
  qualityConfig?: QualityConfig;

  /**
   * Per-export raw JSDoc text for style rule checks.
   * Map from export ID to raw JSDoc string.
   */
  rawJSDocByExport?: Map<string, string>;
}

/**
 * Enrich an OpenPkg spec with documentation coverage metadata.
 *
 * This function computes coverage scores using quality rules,
 * detects drift issues, and produces an EnrichedOpenPkg.
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
 * // Enrich with coverage data
 * const enriched = enrichSpec(spec);
 * console.log(enriched.docs?.coverageScore); // e.g., 85
 * console.log(enriched.docs?.missing); // e.g., ['has-examples']
 * ```
 */
export function enrichSpec(spec: OpenPkg, options: EnrichOptions = {}): EnrichedOpenPkg {
  const { driftByExport, qualityConfig = { rules: {} }, rawJSDocByExport } = options;

  // Build registry for cross-reference validation
  const exportRegistry = buildExportRegistry(spec);

  let totalCoverage = 0;

  // Enrich each export with quality and drift data
  const enrichedExports: EnrichedExport[] = spec.exports.map((exp) => {
    // Evaluate quality rules (coverage + violations)
    const rawJSDoc = rawJSDocByExport?.get(exp.id);
    const quality = evaluateExportQuality(exp, rawJSDoc, qualityConfig, exportRegistry);

    // Compute drift separately
    const drift = computeExportDrift(exp, exportRegistry);
    const additionalDrift = driftByExport?.get(exp.id);

    // Merge all drift
    const allDrift = additionalDrift ? [...drift, ...additionalDrift] : drift;

    totalCoverage += quality.coverageScore;

    const docs: EnrichedDocsMetadata = {
      coverageScore: quality.coverageScore,
    };

    if (quality.coverage.missing.length > 0) {
      docs.missing = quality.coverage.missing;
    }

    if (allDrift.length > 0) {
      docs.drift = allDrift;
    }

    if (quality.violations.length > 0) {
      docs.violations = quality.violations;
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
  const allViolations = collectAllViolations(enrichedExports);

  const docs: EnrichedDocsMetadata = {
    coverageScore: count === 0 ? 100 : Math.round(totalCoverage / count),
  };

  if (allMissing.length > 0) {
    docs.missing = allMissing;
  }

  if (allDrift.length > 0) {
    docs.drift = allDrift;
  }

  if (allViolations.length > 0) {
    docs.violations = allViolations;
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
