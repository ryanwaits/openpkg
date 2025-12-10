import type {
  OpenPkg,
  SpecExport,
  SpecDocsMetadata,
  SpecDocSignal,
  SpecDocDrift,
} from '@openpkg-ts/spec';
import { computeDocsCoverage } from './docs-coverage';

/**
 * An enriched export with computed documentation metadata.
 * Extends SpecExport with the `docs` field for coverage analysis.
 */
export type EnrichedExport = SpecExport & {
  docs?: SpecDocsMetadata;
};

/**
 * An enriched OpenPkg spec with computed documentation metadata.
 * Extends OpenPkg with per-export and aggregate coverage data.
 */
export type EnrichedOpenPkg = Omit<OpenPkg, 'exports'> & {
  exports: EnrichedExport[];
  docs?: SpecDocsMetadata;
};

/**
 * Collect all missing signals across exports.
 */
function collectAllMissing(exports: EnrichedExport[]): SpecDocSignal[] {
  const allMissing = new Set<SpecDocSignal>();
  for (const exp of exports) {
    if (exp.docs?.missing) {
      for (const signal of exp.docs.missing) {
        allMissing.add(signal);
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
 * This function computes coverage scores, missing documentation signals,
 * and drift issues to produce an EnrichedOpenPkg.
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
 * console.log(enriched.docs?.missing); // e.g., ['examples']
 * ```
 */
export function enrichSpec(spec: OpenPkg, options: EnrichOptions = {}): EnrichedOpenPkg {
  const { driftByExport } = options;

  // Use the existing coverage computation logic
  const coverageResult = computeDocsCoverage(spec);

  // Enrich each export with computed coverage data
  const enrichedExports: EnrichedExport[] = spec.exports.map((exp) => {
    const computedDocs = coverageResult.exports.get(exp.id ?? exp.name);
    const additionalDrift = driftByExport?.get(exp.id);

    const docs: SpecDocsMetadata = {
      ...computedDocs,
    };

    // Merge additional drift if provided
    if (additionalDrift && additionalDrift.length > 0) {
      docs.drift = [...(docs.drift ?? []), ...additionalDrift];
    }

    return {
      ...exp,
      docs,
    };
  });

  // Compute aggregate metadata
  const allMissing = collectAllMissing(enrichedExports);
  const allDrift = collectAllDrift(enrichedExports);

  const docs: SpecDocsMetadata = {
    coverageScore: coverageResult.spec.coverageScore,
  };

  if (allMissing.length > 0) {
    docs.missing = allMissing;
  }

  if (allDrift.length > 0) {
    docs.drift = allDrift;
  }

  return {
    ...spec,
    exports: enrichedExports,
    docs,
  };
}
