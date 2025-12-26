import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DRIFT_CATEGORIES,
  parseMarkdownFiles,
  type EnrichedExport,
  type MarkdownDocFile,
  type SpecDocDrift,
} from '@doccov/sdk';
import { glob } from 'glob';
import type { CollectedDrift } from './types';

/**
 * Collect all drift issues from enriched exports
 */
export function collectDriftsFromExports(
  exports: EnrichedExport[],
): Array<{ export: EnrichedExport; drift: SpecDocDrift }> {
  const results: Array<{ export: EnrichedExport; drift: SpecDocDrift }> = [];
  for (const exp of exports) {
    for (const drift of exp.docs?.drift ?? []) {
      results.push({ export: exp, drift });
    }
  }
  return results;
}

/**
 * Group drifts by export
 */
export function groupByExport(
  drifts: Array<{ export: EnrichedExport; drift: SpecDocDrift }>,
): Map<EnrichedExport, SpecDocDrift[]> {
  const map = new Map<EnrichedExport, SpecDocDrift[]>();
  for (const { export: exp, drift } of drifts) {
    const existing = map.get(exp) ?? [];
    existing.push(drift);
    map.set(exp, existing);
  }
  return map;
}

/**
 * Collect drift from exports list
 */
export function collectDrift(
  exportsList: Array<{
    name: string;
    docs?: { drift?: SpecDocDrift[] };
  }>,
): CollectedDrift[] {
  const drifts: CollectedDrift[] = [];
  for (const entry of exportsList) {
    const drift = entry.docs?.drift;
    if (!drift || drift.length === 0) {
      continue;
    }

    for (const d of drift) {
      drifts.push({
        name: entry.name,
        type: d.type,
        issue: d.issue ?? 'Documentation drift detected.',
        suggestion: d.suggestion,
        category: DRIFT_CATEGORIES[d.type],
      });
    }
  }
  return drifts;
}

/**
 * Collect multiple values for an option
 */
export function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Load markdown files from glob patterns
 */
export async function loadMarkdownFiles(
  patterns: string[],
  cwd: string,
): Promise<MarkdownDocFile[]> {
  const files: Array<{ path: string; content: string }> = [];

  for (const pattern of patterns) {
    const matches = await glob(pattern, { nodir: true, cwd });
    for (const filePath of matches) {
      try {
        const fullPath = path.resolve(cwd, filePath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        files.push({ path: filePath, content });
      } catch {
        // Skip files that can't be read
      }
    }
  }

  return parseMarkdownFiles(files);
}
