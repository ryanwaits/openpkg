import type { OpenPkg, SpecExport } from './types';

export type SpecDiff = {
  // Structural changes
  breaking: string[];
  nonBreaking: string[];
  docsOnly: string[];
  // Coverage delta
  coverageDelta: number;
  oldCoverage: number;
  newCoverage: number;
  // Docs health changes
  newUndocumented: string[];
  improvedExports: string[];
  regressedExports: string[];
  driftIntroduced: number;
  driftResolved: number;
};

export function diffSpec(oldSpec: OpenPkg, newSpec: OpenPkg): SpecDiff {
  const result: SpecDiff = {
    breaking: [],
    nonBreaking: [],
    docsOnly: [],
    coverageDelta: 0,
    oldCoverage: 0,
    newCoverage: 0,
    newUndocumented: [],
    improvedExports: [],
    regressedExports: [],
    driftIntroduced: 0,
    driftResolved: 0,
  };

  diffCollections(result, oldSpec.exports, newSpec.exports);
  diffCollections(result, oldSpec.types ?? [], newSpec.types ?? []);

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

function toExportMap(exports: SpecExport[]): Map<string, SpecExport> {
  const map = new Map<string, SpecExport>();
  for (const exp of exports) {
    if (exp && typeof exp.id === 'string') {
      map.set(exp.id, exp);
    }
  }
  return map;
}

type WithId = { id: string };

function diffCollections(result: SpecDiff, oldItems: WithId[], newItems: WithId[]): void {
  const oldMap = toMap(oldItems);
  const newMap = toMap(newItems);

  for (const [id, oldItem] of oldMap.entries()) {
    const newItem = newMap.get(id);
    if (!newItem) {
      result.breaking.push(id);
      continue;
    }

    const docOnly = isDocOnlyChange(oldItem, newItem);
    const identical = isDeepEqual(oldItem, newItem);

    if (identical) {
      continue;
    }

    if (docOnly) {
      result.docsOnly.push(id);
      continue;
    }

    result.breaking.push(id);
  }

  for (const id of newMap.keys()) {
    if (!oldMap.has(id)) {
      result.nonBreaking.push(id);
    }
  }
}

function toMap<T extends WithId>(items: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (item && typeof item.id === 'string') {
      map.set(item.id, item);
    }
  }
  return map;
}

const DOC_KEYS = new Set(['description', 'examples', 'tags', 'source', 'rawComments']);

function isDocOnlyChange(a: unknown, b: unknown): boolean {
  const structuralA = normalizeForComparison(removeDocFields(a));
  const structuralB = normalizeForComparison(removeDocFields(b));
  if (structuralA !== structuralB) {
    return false;
  }

  const fullA = normalizeForComparison(a);
  const fullB = normalizeForComparison(b);
  return fullA !== fullB;
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  return normalizeForComparison(a) === normalizeForComparison(b);
}

function removeDocFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => removeDocFields(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([key]) => !DOC_KEYS.has(key),
  );

  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of entries) {
    cleaned[key] = removeDocFields(val);
  }
  return cleaned;
}

function normalizeForComparison(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeys(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const result: Record<string, unknown> = {};
  for (const [key, val] of entries) {
    result[key] = sortKeys(val);
  }
  return result;
}
