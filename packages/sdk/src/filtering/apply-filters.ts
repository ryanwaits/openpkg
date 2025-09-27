import type { OpenPkgSpec } from '../types/openpkg';
import type { FilterDiagnostic, FilterOptions, FilterResult } from './types';

const TYPE_REF_PREFIX = '#/types/';

interface ExportEntry {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface TypeEntry {
  id: string;
  name: string;
  [key: string]: unknown;
}

const toLowerKey = (value: string): string => value.trim().toLowerCase();

const buildLookupMap = (values: string[] | undefined): Map<string, string> => {
  const map = new Map<string, string>();
  if (!values) {
    return map;
  }

  for (const value of values) {
    const key = toLowerKey(value);
    if (!map.has(key)) {
      map.set(key, value);
    }
  }

  return map;
};

const matches = (
  candidate: { id?: string; name?: string },
  lookup: Map<string, string>,
): string | undefined => {
  if (!candidate) {
    return undefined;
  }

  const keys = [candidate.id, candidate.name];
  for (const key of keys) {
    if (!key) {
      continue;
    }
    const normalized = toLowerKey(key);
    if (lookup.has(normalized)) {
      return normalized;
    }
  }

  return undefined;
};

const collectTypeRefs = (value: unknown, refs: Set<string>, seen = new Set<unknown>()): void => {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectTypeRefs(item, refs, seen);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  for (const [key, nested] of Object.entries(record)) {
    if (key === '$ref' && typeof nested === 'string' && nested.startsWith(TYPE_REF_PREFIX)) {
      const typeId = nested.slice(TYPE_REF_PREFIX.length);
      if (typeId) {
        refs.add(typeId);
      }
    }

    collectTypeRefs(nested, refs, seen);
  }
};

export const applyFilters = (
  spec: OpenPkgSpec,
  options: FilterOptions,
): FilterResult<OpenPkgSpec> => {
  const includeLookup = buildLookupMap(options.include);
  const excludeLookup = buildLookupMap(options.exclude);

  if (includeLookup.size === 0 && excludeLookup.size === 0) {
    return { spec, diagnostics: [], changed: false };
  }

  const includeMatches = new Set<string>();
  const diagnostics: FilterDiagnostic[] = [];

  const exportsList = spec.exports ?? [];
  const typesList = spec.types ?? [];

  const keptExports: ExportEntry[] = [];

  for (const entry of exportsList as ExportEntry[]) {
    const includeMatch = includeLookup.size === 0 ? undefined : matches(entry, includeLookup);
    const excludeMatch = matches(entry, excludeLookup);

    const allowedByInclude = includeLookup.size === 0 || Boolean(includeMatch);
    const allowedByExclude = !excludeMatch;

    if (includeMatch) {
      includeMatches.add(includeMatch);
    }

    if (allowedByInclude && allowedByExclude) {
      keptExports.push(entry);
    }
  }

  const typeMap = new Map(typesList.map((typeEntry) => [typeEntry.id, typeEntry as TypeEntry]));

  const requestedTypeIds = new Set<string>();
  const excludedTypeIds = new Set<string>();

  for (const typeEntry of typesList as TypeEntry[]) {
    const includeMatch = includeLookup.size === 0 ? undefined : matches(typeEntry, includeLookup);
    if (includeMatch) {
      includeMatches.add(includeMatch);
      requestedTypeIds.add(typeEntry.id);
    }

    const excludeMatch = matches(typeEntry, excludeLookup);
    if (excludeMatch) {
      excludedTypeIds.add(typeEntry.id);
    }
  }

  const referencedTypeIds = new Set<string>();

  for (const entry of keptExports) {
    collectTypeRefs(entry, referencedTypeIds);
  }

  for (const requestedId of requestedTypeIds) {
    referencedTypeIds.add(requestedId);
  }

  const processedTypeIds = new Set<string>();
  const finalTypeIds = new Set<string>();
  const excludedButReferenced = new Set<string>();

  const queue: string[] = Array.from(referencedTypeIds);

  while (queue.length > 0) {
    const currentId = queue.pop();
    if (!currentId || processedTypeIds.has(currentId)) {
      continue;
    }

    processedTypeIds.add(currentId);

    if (excludedTypeIds.has(currentId)) {
      excludedButReferenced.add(currentId);
      continue;
    }

    if (!typeMap.has(currentId)) {
      continue;
    }

    finalTypeIds.add(currentId);

    const typeEntry = typeMap.get(currentId);
    if (typeEntry) {
      const nestedRefs = new Set<string>();
      collectTypeRefs(typeEntry, nestedRefs);
      for (const ref of nestedRefs) {
        if (!processedTypeIds.has(ref)) {
          queue.push(ref);
        }
      }
    }
  }

  if (includeLookup.size > 0 && keptExports.length === 0 && finalTypeIds.size === 0) {
    diagnostics.push({
      message: 'Include filters did not match any exports or types.',
      severity: 'warning',
    });
  }

  if (excludedButReferenced.size > 0) {
    const labels = Array.from(excludedButReferenced).map((id) => {
      const entry = typeMap.get(id);
      return entry?.name ?? id;
    });
    diagnostics.push({
      message: `Excluded types are still referenced: ${labels.join(', ')}`,
      severity: 'warning',
      target: 'type',
    });
  }

  const unmatchedIncludes = Array.from(includeLookup.keys()).filter(
    (key) => !includeMatches.has(key),
  );
  if (unmatchedIncludes.length > 0) {
    const labels = unmatchedIncludes.map((key) => includeLookup.get(key) ?? key);
    diagnostics.push({
      message: `Include filters with no matches: ${labels.join(', ')}`,
      severity: 'warning',
    });
  }

  const filteredTypes = typesList.filter((typeEntry) => finalTypeIds.has(typeEntry.id));

  const filteredSpec: OpenPkgSpec = {
    ...spec,
    exports: keptExports,
    types: filteredTypes.length > 0 ? filteredTypes : spec.types ? [] : undefined,
  };

  const changed =
    keptExports.length !== exportsList.length || filteredTypes.length !== typesList.length;

  return {
    spec: filteredSpec,
    diagnostics,
    changed,
  };
};
