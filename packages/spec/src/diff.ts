import type { OpenPkg, SpecExport, SpecType } from './types';

export type SpecDiff = {
  breaking: string[];
  nonBreaking: string[];
  docsOnly: string[];
};

export function diffSpec(a: OpenPkg, b: OpenPkg): SpecDiff {
  const result: SpecDiff = { breaking: [], nonBreaking: [], docsOnly: [] };

  diffCollections(result, a.exports, b.exports);
  diffCollections(result, a.types ?? [], b.types ?? []);

  return result;
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

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !DOC_KEYS.has(key));

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

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b));
  const result: Record<string, unknown> = {};
  for (const [key, val] of entries) {
    result[key] = sortKeys(val);
  }
  return result;
}
