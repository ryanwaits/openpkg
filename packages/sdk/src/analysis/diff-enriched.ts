/**
 * Enhanced diff function that tracks coverage changes (doccov-specific).
 * Wraps the base @openpkg-ts/spec diffSpec with coverage tracking.
 */
import { diffSpec, type SpecDiff } from '@openpkg-ts/spec';
import type { EnrichedOpenPkg, EnrichedExport } from './enrich';
import type { SpecDocsMetadata } from './drift/types';

/**
 * Extended diff result with doccov-specific coverage tracking.
 */
export interface EnrichedSpecDiff extends SpecDiff {
  coverageDelta: number;
  oldCoverage: number;
  newCoverage: number;
  newUndocumented: string[];
  improvedExports: string[];
  regressedExports: string[];
  driftIntroduced: number;
  driftResolved: number;
}

type ExportWithDocs = EnrichedExport & { docs?: SpecDocsMetadata };
type SpecWithDocs = EnrichedOpenPkg & { docs?: SpecDocsMetadata; exports: ExportWithDocs[] };

/**
 * Compare two enriched OpenPkg specs with coverage tracking.
 */
export function diffEnrichedSpec(oldSpec: SpecWithDocs, newSpec: SpecWithDocs): EnrichedSpecDiff {
  // Get base structural diff
  const baseDiff = diffSpec(oldSpec, newSpec);

  const result: EnrichedSpecDiff = {
    ...baseDiff,
    coverageDelta: 0,
    oldCoverage: 0,
    newCoverage: 0,
    newUndocumented: [],
    improvedExports: [],
    regressedExports: [],
    driftIntroduced: 0,
    driftResolved: 0,
  };

  // Calculate coverage delta
  result.oldCoverage = oldSpec.docs?.coverageScore ?? 0;
  result.newCoverage = newSpec.docs?.coverageScore ?? 0;
  result.coverageDelta = Math.round((result.newCoverage - result.oldCoverage) * 10) / 10;

  // Analyze docs health changes
  const oldExportMap = toExportMap(oldSpec.exports);
  const newExportMap = toExportMap(newSpec.exports);

  for (const [id, newExport] of newExportMap.entries()) {
    const oldExport = oldExportMap.get(id);
    const newScore = newExport.docs?.coverageScore ?? 0;
    const newDriftCount = newExport.docs?.drift?.length ?? 0;

    if (!oldExport) {
      // New export - check if undocumented
      if (newScore < 100 || (newExport.docs?.missing?.length ?? 0) > 0) {
        result.newUndocumented.push(id);
      }
      result.driftIntroduced += newDriftCount;
      continue;
    }

    const oldScore = oldExport.docs?.coverageScore ?? 0;
    const oldDriftCount = oldExport.docs?.drift?.length ?? 0;

    // Track coverage changes per export
    if (newScore > oldScore) {
      result.improvedExports.push(id);
    } else if (newScore < oldScore) {
      result.regressedExports.push(id);
    }

    // Track drift changes
    if (newDriftCount > oldDriftCount) {
      result.driftIntroduced += newDriftCount - oldDriftCount;
    } else if (oldDriftCount > newDriftCount) {
      result.driftResolved += oldDriftCount - newDriftCount;
    }
  }

  return result;
}

function toExportMap(exports: ExportWithDocs[]): Map<string, ExportWithDocs> {
  const map = new Map<string, ExportWithDocs>();
  for (const exp of exports) {
    if (exp && typeof exp.id === 'string') {
      map.set(exp.id, exp);
    }
  }
  return map;
}
