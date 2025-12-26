import type { OpenPkg, SpecExport, SpecExportKind } from './types';

export type BreakingSeverity = 'high' | 'medium' | 'low';

export interface CategorizedBreaking {
  id: string;
  name: string;
  kind: SpecExportKind;
  severity: BreakingSeverity;
  reason: string;
}

/** Minimal member change info for categorization (avoids circular dep with SDK) */
export interface MemberChangeInfo {
  className: string;
  memberName: string;
  memberKind: 'method' | 'property' | 'accessor' | 'constructor';
  changeType: 'added' | 'removed' | 'signature-changed';
}

export type SpecDiff = {
  breaking: string[];
  nonBreaking: string[];
  docsOnly: string[];
};

/**
 * Compare two OpenPkg specs and compute differences.
 */
export function diffSpec(oldSpec: OpenPkg, newSpec: OpenPkg): SpecDiff {
  const result: SpecDiff = {
    breaking: [],
    nonBreaking: [],
    docsOnly: [],
  };

  diffCollections(result, oldSpec.exports, newSpec.exports);
  diffCollections(result, oldSpec.types ?? [], newSpec.types ?? []);

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

/**
 * Keys considered documentation-only. Changes to these are non-breaking.
 */
const DOC_KEYS = new Set([
  'description',
  'examples',
  'tags',
  'rawComments',
  'source',
]);

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

/**
 * Categorize breaking changes by severity
 */
export function categorizeBreakingChanges(
  breaking: string[],
  oldSpec: OpenPkg,
  newSpec: OpenPkg,
  memberChanges?: MemberChangeInfo[],
): CategorizedBreaking[] {
  const oldExportMap = toExportMap(oldSpec.exports);
  const newExportMap = toExportMap(newSpec.exports);

  const categorized: CategorizedBreaking[] = [];

  for (const id of breaking) {
    const oldExport = oldExportMap.get(id);
    const newExport = newExportMap.get(id);

    // Removed entirely
    if (!newExport) {
      const kind = oldExport?.kind ?? 'variable';
      categorized.push({
        id,
        name: oldExport?.name ?? id,
        kind,
        severity: kind === 'function' || kind === 'class' ? 'high' : 'medium',
        reason: 'removed',
      });
      continue;
    }

    // Class with member changes
    if (oldExport?.kind === 'class' && memberChanges?.length) {
      const classChanges = memberChanges.filter((mc) => mc.className === id);
      if (classChanges.length > 0) {
        const hasConstructorChange = classChanges.some((mc) => mc.memberKind === 'constructor');
        const hasMethodRemoval = classChanges.some(
          (mc) => mc.changeType === 'removed' && mc.memberKind === 'method',
        );

        categorized.push({
          id,
          name: oldExport.name,
          kind: 'class',
          severity: hasConstructorChange || hasMethodRemoval ? 'high' : 'medium',
          reason: hasConstructorChange
            ? 'constructor changed'
            : hasMethodRemoval
              ? 'methods removed'
              : 'methods changed',
        });
        continue;
      }
    }

    // Interface/type changed
    if (oldExport?.kind === 'interface' || oldExport?.kind === 'type') {
      categorized.push({
        id,
        name: oldExport.name,
        kind: oldExport.kind,
        severity: 'medium',
        reason: 'type definition changed',
      });
      continue;
    }

    // Function signature changed
    if (oldExport?.kind === 'function') {
      categorized.push({
        id,
        name: oldExport.name,
        kind: 'function',
        severity: 'high',
        reason: 'signature changed',
      });
      continue;
    }

    // Default fallback
    categorized.push({
      id,
      name: oldExport?.name ?? id,
      kind: oldExport?.kind ?? 'variable',
      severity: 'low',
      reason: 'changed',
    });
  }

  // Sort by severity: high > medium > low
  const severityOrder: Record<BreakingSeverity, number> = { high: 0, medium: 1, low: 2 };
  return categorized.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// ============================================================================
// Semver Recommendation
// ============================================================================

/**
 * Semver version bump type.
 */
export type SemverBump = 'major' | 'minor' | 'patch' | 'none';

/**
 * Semver recommendation result.
 */
export interface SemverRecommendation {
  /** Recommended version bump */
  bump: SemverBump;
  /** Reason for the recommendation */
  reason: string;
  /** Count of breaking changes */
  breakingCount: number;
  /** Count of non-breaking additions */
  additionCount: number;
  /** Whether only docs changed */
  docsOnlyChanges: boolean;
}

/**
 * Recommend a semver version bump based on spec diff.
 *
 * - MAJOR: Any breaking changes (removals or signature changes)
 * - MINOR: New exports/types added (non-breaking)
 * - PATCH: Documentation-only changes
 * - NONE: No changes
 *
 * @param diff - The spec diff result
 * @returns Semver recommendation with reason
 *
 * @example
 * ```typescript
 * import { diffSpec, recommendSemverBump } from '@openpkg-ts/spec';
 *
 * const diff = diffSpec(oldSpec, newSpec);
 * const recommendation = recommendSemverBump(diff);
 *
 * console.log(`Recommended: ${recommendation.bump}`);
 * console.log(`Reason: ${recommendation.reason}`);
 * ```
 */
export function recommendSemverBump(diff: SpecDiff): SemverRecommendation {
  const breakingCount = diff.breaking.length;
  const additionCount = diff.nonBreaking.length;
  const docsOnlyCount = diff.docsOnly.length;

  // MAJOR: Any breaking changes
  if (breakingCount > 0) {
    return {
      bump: 'major',
      reason: `${breakingCount} breaking change${breakingCount === 1 ? '' : 's'} detected`,
      breakingCount,
      additionCount,
      docsOnlyChanges: false,
    };
  }

  // MINOR: New exports/types added
  if (additionCount > 0) {
    return {
      bump: 'minor',
      reason: `${additionCount} new export${additionCount === 1 ? '' : 's'} added`,
      breakingCount: 0,
      additionCount,
      docsOnlyChanges: false,
    };
  }

  // PATCH: Documentation-only changes
  if (docsOnlyCount > 0) {
    return {
      bump: 'patch',
      reason: `${docsOnlyCount} documentation-only change${docsOnlyCount === 1 ? '' : 's'}`,
      breakingCount: 0,
      additionCount: 0,
      docsOnlyChanges: true,
    };
  }

  // NONE: No changes
  return {
    bump: 'none',
    reason: 'No changes detected',
    breakingCount: 0,
    additionCount: 0,
    docsOnlyChanges: false,
  };
}

/**
 * Calculate the next version number based on current version and recommended bump.
 *
 * @param currentVersion - Current version string (e.g., "1.2.3")
 * @param bump - Recommended bump type
 * @returns Next version string
 *
 * @example
 * ```typescript
 * calculateNextVersion('1.2.3', 'major'); // '2.0.0'
 * calculateNextVersion('1.2.3', 'minor'); // '1.3.0'
 * calculateNextVersion('1.2.3', 'patch'); // '1.2.4'
 * ```
 */
export function calculateNextVersion(currentVersion: string, bump: SemverBump): string {
  if (bump === 'none') {
    return currentVersion;
  }

  // Parse version, handling optional 'v' prefix
  const normalized = currentVersion.replace(/^v/, '');
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/);

  if (!match) {
    // Can't parse - return as-is
    return currentVersion;
  }

  let [, major, minor, patch] = match.map(Number);

  switch (bump) {
    case 'major':
      major++;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor++;
      patch = 0;
      break;
    case 'patch':
      patch++;
      break;
  }

  const prefix = currentVersion.startsWith('v') ? 'v' : '';
  return `${prefix}${major}.${minor}.${patch}`;
}
