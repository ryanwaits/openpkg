import type { EnrichedOpenPkg } from '@doccov/sdk';
import type { SpecExportKind } from '@openpkg-ts/spec';

export type SignalStats = { covered: number; total: number; pct: number };

export type ReportStats = {
  packageName: string;
  version: string;
  coverageScore: number;
  totalExports: number;
  fullyDocumented: number;
  partiallyDocumented: number;
  undocumented: number;
  driftCount: number;
  signalCoverage: Record<'description' | 'params' | 'returns' | 'examples', SignalStats>;
  byKind: Array<{ kind: SpecExportKind; count: number; avgScore: number }>;
  exports: Array<{ name: string; kind: SpecExportKind; score: number; missing: string[] }>;
  driftIssues: Array<{ exportName: string; type: string; issue: string; suggestion?: string }>;
};

/**
 * Compute report statistics from an enriched OpenPkg spec.
 * The spec must be enriched with coverage data via enrichSpec() first.
 */
export function computeStats(spec: EnrichedOpenPkg): ReportStats {
  const exports = spec.exports ?? [];
  const signals = {
    description: { covered: 0, total: 0 },
    params: { covered: 0, total: 0 },
    returns: { covered: 0, total: 0 },
    examples: { covered: 0, total: 0 },
  };
  const kindMap = new Map<SpecExportKind, { count: number; totalScore: number }>();
  const driftIssues: ReportStats['driftIssues'] = [];
  let fullyDocumented = 0;
  let partiallyDocumented = 0;
  let undocumented = 0;

  for (const exp of exports) {
    const score = exp.docs?.coverageScore ?? 0;
    const missing = exp.docs?.missing ?? [];

    // Tally signals
    for (const sig of ['description', 'params', 'returns', 'examples'] as const) {
      signals[sig].total++;
      if (!missing.includes(sig)) signals[sig].covered++;
    }

    // Tally by kind
    const kindEntry = kindMap.get(exp.kind) ?? { count: 0, totalScore: 0 };
    kindEntry.count++;
    kindEntry.totalScore += score;
    kindMap.set(exp.kind, kindEntry);

    // Categorize
    if (score === 100) fullyDocumented++;
    else if (score > 0) partiallyDocumented++;
    else undocumented++;

    // Collect drift
    for (const d of exp.docs?.drift ?? []) {
      driftIssues.push({
        exportName: exp.name,
        type: d.type,
        issue: d.issue,
        suggestion: d.suggestion,
      });
    }
  }

  const signalCoverage = Object.fromEntries(
    Object.entries(signals).map(([k, v]) => [
      k,
      { ...v, pct: v.total ? Math.round((v.covered / v.total) * 100) : 0 },
    ]),
  ) as ReportStats['signalCoverage'];

  const byKind = Array.from(kindMap.entries())
    .map(([kind, { count, totalScore }]) => ({
      kind,
      count,
      avgScore: Math.round(totalScore / count),
    }))
    .sort((a, b) => b.count - a.count);

  const sortedExports = exports
    .map((e) => ({
      name: e.name,
      kind: e.kind,
      score: e.docs?.coverageScore ?? 0,
      missing: e.docs?.missing ?? [],
    }))
    .sort((a, b) => a.score - b.score);

  return {
    packageName: spec.meta.name ?? 'unknown',
    version: spec.meta.version ?? '0.0.0',
    coverageScore: spec.docs?.coverageScore ?? 0,
    totalExports: exports.length,
    fullyDocumented,
    partiallyDocumented,
    undocumented,
    driftCount: driftIssues.length,
    signalCoverage,
    byKind,
    exports: sortedExports,
    driftIssues,
  };
}
